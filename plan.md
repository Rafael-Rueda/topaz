# Topaz — Plano de Implementação

## Visão Geral

Topaz é um middleware de ingestão self-hosted que recebe webhooks e arquivos em lote de fontes externas, enfileira com segurança e processa de forma assíncrona e resiliente. Este plano transforma o template atual (que simula processamento) em um sistema production-ready com três killer features: **Schema Validation**, **Replay** e **Dashboard de Observabilidade**.

A decisão arquitetural central é usar **PostgreSQL como fonte da verdade** (Write-Ahead Log) combinado com **Redis como motor de processamento** (BullMQ). A ingestão usa **micro-batch de 50ms** para manter throughput alto (~50.000 eventos/s) com segurança de dados garantida pelo Postgres.

---

## Princípio Arquitetural: Nunca retornar 202 sem ter persistido

Toda a arquitetura gira em torno de uma regra inviolável: o Topaz só responde `202 Accepted` ao emissor do webhook **depois** que o payload está salvo no PostgreSQL. Se qualquer coisa falhar antes disso, retorna `500` e o emissor (ex: Stripe) reenvia automaticamente. Isso garante que nenhum evento se perde, mesmo em falhas catastróficas.

---

## Fase 1 — Persistência Segura (Write-Ahead Log + Micro-Batch)

### 1.1 Configuração do PostgreSQL

Adicionar um serviço PostgreSQL ao `docker-compose.yml` ao lado do Redis existente. Definir as variáveis de ambiente que já existem no `.env` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`). Usar um volume nomeado para persistência dos dados.

### 1.2 Camada de Persistência (infra/persistence)

Seguindo a arquitetura DDD do projeto, criar a camada de persistência dentro de `src/infra/persistence/`. Usar um client PostgreSQL leve (pg ou postgres.js). A conexão deve ser gerenciada pelo container de DI do Awilix que já existe em `src/infra/di/container.ts`. Criar um pool de conexões configurável via variáveis de ambiente.

### 1.3 Tabela de Eventos (events)

Criar a tabela principal que serve como Write-Ahead Log. Campos essenciais:

- `id` — identificador único do evento (nanoid, gerado pelo Topaz)
- `source` — origem do webhook (ex: "stripe", "melhor-envio")
- `event_type` — tipo do evento (ex: "checkout.session.completed")
- `status` — enum: `received`, `queued`, `processing`, `delivered`, `failed`, `dead`
- `payload` — JSONB com o body completo do webhook (raw, como chegou)
- `headers` — JSONB com os headers do request original
- `signature` — assinatura do webhook para validação
- `attempts` — contador de tentativas de processamento
- `last_error` — último erro encontrado no processamento
- `created_at` — timestamp de quando o Topaz recebeu o evento
- `processed_at` — timestamp de quando foi entregue ao target com sucesso
- `failed_at` — timestamp de quando esgotou as tentativas

Índices necessários: `(source, status)`, `(status, created_at)`, `(source, event_type, created_at)`. Esses índices são essenciais para as queries do Replay e do Dashboard.

### 1.4 Entidade de Domínio: Event

Dentro de `src/domain/ingestion/enterprise/entities/`, criar a entidade `Event` que representa um evento persistido. Essa entidade encapsula as transições de status (`received → queued → processing → delivered` ou `→ failed → dead`). A entidade `WebhookPayload` que já existe continua representando o payload em trânsito; a entidade `Event` representa o registro persistido.

### 1.5 Repository Interface + Implementação

Na camada de application (`src/domain/ingestion/application/interfaces/`), criar a interface `EventRepository` com os métodos necessários: `saveBatch`, `updateStatus`, `findByStatus`, `findForReplay`, etc. A implementação concreta fica em `src/infra/persistence/` e é injetada via Awilix.

### 1.6 WebhookBuffer (o micro-batch)

Criar em `src/infra/persistence/webhook-buffer.ts` a classe que acumula webhooks em memória e faz flush em batch para o Postgres.

Funcionamento:

- Cada webhook recebido é adicionado ao buffer junto com a referência do `reply` do Fastify
- O buffer faz flush em duas condições: quando acumula 500 items OU quando passam 50ms (o que acontecer primeiro)
- No flush, executa um único `INSERT` batch no Postgres com todos os payloads acumulados
- Em seguida, faz `queue.addBulk` no Redis para enfileirar todos os jobs de uma vez
- Se o INSERT no Postgres falhar, responde `500` para todos os requests do batch (o emissor reenvia)
- Se o INSERT no Postgres der certo mas o Redis falhar, os eventos ficam com status `received` no Postgres e um job de recovery os reinjecta na fila depois
- Se tudo der certo, responde `202` para todos os requests do batch

O buffer de 50ms significa que no pior caso (crash do processo com buffer cheio), até ~250 eventos podem estar em memória sem persistir. Mas como o `202` ainda não foi enviado para nenhum deles, o emissor reenvia todos automaticamente. Perda zero.

### 1.7 Modificar o Use Case de Ingestão

O `IngestWebhookUseCase` em `src/domain/ingestion/application/use-cases/ingest-webhook.use-case.ts` precisa ser alterado para usar o `WebhookBuffer` em vez de enfileirar diretamente no Redis. O use case não deve conhecer detalhes do buffer — ele chama o repository, que internamente usa o buffer.

### 1.8 Job de Recovery

Criar um job periódico (rodando a cada 30 segundos) que busca eventos com status `received` há mais de 1 minuto no Postgres. Esses são eventos que foram salvos no Postgres mas não chegaram ao Redis (por crash do processo ou falha do Redis). O job reinjecta esses eventos na fila do BullMQ. Isso é a rede de segurança que garante que nada fica parado.

### 1.9 Atualização do Worker

O `WebhookWorker` em `src/infra/queue/consumers/webhook.worker.ts` precisa atualizar o status do evento no Postgres após processamento. Quando o job completa com sucesso, atualiza para `delivered`. Quando falha todas as tentativas, atualiza para `failed`. O worker também deve registrar o `last_error` a cada falha para facilitar debug no Dashboard.

---

## Fase 2 — Schema Validation

### 2.1 Conceito

Schema Validation permite cadastrar a estrutura esperada de cada tipo de evento de cada source. Quando um webhook chega, o Topaz valida o payload contra o schema registrado antes de enfileirar. Eventos com schema inválido não são rejeitados (o pagamento já aconteceu), mas são marcados com uma tag para tratamento especial e geram alertas no Dashboard.

### 2.2 Tabela de Schemas

Criar tabela `schemas` no Postgres:

- `id` — identificador único
- `source` — nome da source (ex: "stripe")
- `event_type` — tipo do evento (ex: "checkout.session.completed")
- `version` — versionamento do schema (permite evolução)
- `schema` — JSONB com a definição do schema (campos obrigatórios, tipos esperados, valores permitidos)
- `reject_on_fail` — boolean: se true, retorna 400 e não enfileira. Se false, enfileira com tag `schema_invalid`
- `active` — boolean: permite desativar um schema sem deletar
- `created_at`, `updated_at`

### 2.3 Domínio: Schema Registry

Criar um novo subdomínio ou módulo dentro do bounded context de ingestion. No `enterprise/entities/`, criar a entidade `SchemaDefinition`. No `application/use-cases/`, criar `ValidatePayloadUseCase` e `ManageSchemaUseCase`.

O `ValidatePayloadUseCase` recebe um payload e uma source, busca o schema ativo correspondente, e retorna um resultado de validação (válido, inválido com motivo, ou sem schema registrado). Usar uma lib de validação JSON como Ajv para validar contra o schema.

### 2.4 Integração no Fluxo de Ingestão

Após receber o webhook e antes de adicionar ao buffer, o `IngestWebhookUseCase` chama o `ValidatePayloadUseCase`. O resultado da validação é salvo junto com o evento no Postgres (campo `validation_status`: `valid`, `invalid`, `no_schema`). Se `reject_on_fail` estiver ativo para aquele schema e a validação falhar, retorna `400` imediatamente sem enfileirar.

### 2.5 Detecção de Schema Drift

Quando um campo que sempre existiu em payloads anteriores para de aparecer, ou quando um campo muda de tipo (ex: `amount` vem como string em vez de number), o sistema detecta isso como "schema drift". Essa detecção acontece no `ValidatePayloadUseCase` e gera um evento interno que o Dashboard consome para mostrar alertas.

### 2.6 API de Gerenciamento de Schemas

Criar rotas em `src/interface/http/routes/schema.routes.ts`:

- `POST /schemas` — cadastrar novo schema
- `GET /schemas` — listar todos
- `GET /schemas/:source/:eventType` — buscar schema específico
- `PUT /schemas/:id` — atualizar schema (cria nova versão)
- `DELETE /schemas/:id` — desativar schema

Criar controller e schemas Zod correspondentes seguindo o padrão existente no projeto.

### 2.7 Configuração Declarativa (YAML)

Além da API, permitir configuração via arquivos YAML em um diretório `config/schemas/`. Na inicialização do Topaz, carregar os YAML e sincronizar com o Postgres. Isso permite versionamento da configuração via Git. A API tem precedência sobre o YAML (alterações via API sobrescrevem o YAML no próximo sync).

---

## Fase 3 — Replay

### 3.1 Conceito

Replay permite reprocessar eventos que falharam ou que precisam ser processados novamente. Como o payload completo está salvo no Postgres (Write-Ahead Log da Fase 1), o Topaz pode reinjectar qualquer evento na fila do Redis a qualquer momento, sem depender do emissor original.

### 3.2 Tabela de Replay Requests

Criar tabela `replay_requests`:

- `id` — identificador único do pedido de replay
- `filter_source` — filtro por source (nullable, null = todas)
- `filter_event_type` — filtro por tipo de evento (nullable)
- `filter_status` — filtro por status (ex: "failed", "dead")
- `filter_from` — início do período
- `filter_to` — fim do período
- `total_events` — quantos eventos casam com os filtros
- `replayed_events` — quantos já foram reinjetados
- `status` — enum: `pending`, `in_progress`, `completed`, `cancelled`
- `requested_by` — quem pediu o replay (para auditoria)
- `created_at`

### 3.3 Domínio: Replay

No `application/use-cases/`, criar `RequestReplayUseCase` e `ExecuteReplayUseCase`.

O `RequestReplayUseCase` recebe os filtros, faz um `COUNT` no Postgres para mostrar quantos eventos serão afetados, e cria o registro na tabela `replay_requests` com status `pending`. Isso permite que o operador confirme antes de executar.

O `ExecuteReplayUseCase` pega um replay request com status `pending`, busca os eventos correspondentes no Postgres em batches de 100, reinjecta cada batch na fila do Redis, e atualiza o progresso (`replayed_events`). Os eventos reinjetados têm seu status atualizado para `queued` novamente no Postgres.

### 3.4 Auto-Replay

Configuração opcional que faz replay automático de eventos com status `failed` quando o target volta a responder. Funciona assim: um health check periódico (a cada 30s) faz ping nos targets configurados. Quando um target que estava fora volta a responder `200`, o sistema automaticamente cria um replay request para todos os eventos `failed` daquele target.

### 3.5 API de Replay

Rotas em `src/interface/http/routes/replay.routes.ts`:

- `POST /replay/preview` — recebe filtros, retorna contagem de eventos que seriam replayados (dry-run)
- `POST /replay/execute` — cria e inicia o replay
- `GET /replay/:id` — status e progresso de um replay em andamento
- `POST /replay/:id/cancel` — cancela um replay em andamento
- `GET /replay/history` — histórico de replays executados

### 3.6 Proteções

- Rate limiting no replay para não sobrecarregar os targets (reinjectar 10.000 eventos de uma vez pode derrubar o e-commerce). Usar um delay configurável entre batches.
- Impedir replay duplo: se um evento já está com status `queued` ou `processing`, não reinjectar.
- Log de auditoria: registrar quem pediu o replay, quando, com quais filtros, quantos eventos afetados.

---

## Fase 4 — Dashboard de Observabilidade

### 4.1 Conceito

Dashboard web que mostra em tempo real o estado de todo o sistema: throughput por source, latência de processamento, taxa de erro, estado das filas, DLQ, e alertas. É a interface visual para todas as features anteriores (schemas, replay, eventos).

### 4.2 Arquitetura do Dashboard

O Dashboard é uma aplicação separada que roda em seu próprio container. Frontend em React (ou framework leve como Preact) servido por um Fastify estático. O backend é a API do Topaz (as rotas de schema, replay, e novas rotas de métricas).

O Dashboard se comunica com:
- **Postgres** — para dados históricos, DLQ, schema drift, replay history
- **Redis** — para dados real-time: tamanho das filas, jobs ativos, workers conectados (via BullMQ API)

### 4.3 API de Métricas

Criar rotas em `src/interface/http/routes/metrics.routes.ts`:

- `GET /metrics/throughput` — eventos por segundo, por source, nos últimos N minutos. Query no Postgres agrupando por `source` e janela de tempo.
- `GET /metrics/latency` — tempo médio entre `created_at` e `processed_at`, por source e event_type.
- `GET /metrics/errors` — taxa de erro por source, por target, por tipo de erro. Agrupamento dos `last_error`.
- `GET /metrics/queues` — estado atual das filas Redis: pending, active, completed, failed, delayed. Usa a API do BullMQ direto.
- `GET /metrics/dlq` — eventos com status `dead`, agrupados por source e erro. Paginado.

### 4.4 Alertas

Criar tabela `alert_rules`:

- `id`
- `name` — nome descritivo (ex: "Taxa de erro Stripe > 5%")
- `metric` — qual métrica monitorar
- `condition` — operador e threshold (ex: `error_rate > 0.05`)
- `window` — janela de tempo (ex: "5m")
- `target` — para onde enviar o alerta: webhook URL (Slack, Discord, PagerDuty)
- `cooldown` — tempo mínimo entre alertas repetidos
- `active`

O sistema de alertas roda como um job periódico (a cada 30s) que avalia cada regra ativa. Quando uma condição é atingida, dispara um POST para o target do alerta com detalhes da métrica.

Alertas padrão (pré-configurados):
- Fila com mais de 1.000 jobs pendentes
- Taxa de erro > 5% nos últimos 5 minutos
- Schema drift detectado
- DLQ com mais de 10 jobs
- Target com latência > 5s (p95)

### 4.5 API de Alertas

Rotas em `src/interface/http/routes/alert.routes.ts`:

- `POST /alerts` — criar regra
- `GET /alerts` — listar regras ativas
- `PUT /alerts/:id` — atualizar regra
- `DELETE /alerts/:id` — desativar regra
- `GET /alerts/history` — histórico de alertas disparados

### 4.6 DLQ Management

O Dashboard deve oferecer uma visão completa da Dead Letter Queue com ações:

- Listar eventos com status `dead`, com filtros por source, event_type, erro, período
- Visualizar o payload completo de um evento da DLQ
- Replay individual (reinjetar um evento específico)
- Replay em massa com filtros
- Descartar eventos da DLQ (marcar como `discarded`)

Essas funcionalidades são expostas via API e consumidas pelo frontend do Dashboard.

---

## Fase 5 — Routing e Fan-out

### 5.1 Conceito

Routing define para onde cada tipo de evento deve ser enviado. Fan-out permite que um evento seja entregue a múltiplos targets em paralelo. Isso substitui a lógica hardcoded no worker por configuração declarativa.

### 5.2 Tabela de Routes

Criar tabela `routes`:

- `id`
- `source` — source do evento
- `event_type` — tipo do evento (wildcard `*` para "todos")
- `target_url` — URL do destino
- `target_name` — nome amigável (ex: "payment-confirm", "send-email")
- `method` — HTTP method (POST padrão)
- `timeout` — timeout do request em ms
- `retry_count` — quantas tentativas
- `retry_backoff` — strategy de backoff (fixed, exponential)
- `priority` — critical, high, normal, low
- `headers` — JSONB com headers customizados a enviar
- `active`

### 5.3 Domínio: Routing

Criar `ResolveRoutesUseCase` que recebe source + event_type e retorna a lista de targets. O worker usa esse use case para saber para onde entregar cada evento.

### 5.4 Fan-out no Worker

Quando o worker processa um evento, ele resolve as rotas e cria um sub-job para cada target. Cada sub-job é independente: se o email falhar, o pagamento não é afetado. O evento só é marcado como `delivered` no Postgres quando todos os sub-jobs completarem.

Adicionar tabela `deliveries` para rastrear cada entrega individual:

- `id`
- `event_id` — referência ao evento
- `route_id` — referência à rota
- `status` — `pending`, `delivered`, `failed`
- `response_code` — HTTP status code do target
- `response_body` — corpo da resposta (truncado)
- `duration_ms` — quanto tempo demorou
- `attempts` — tentativas gastas
- `last_error`
- `created_at`, `completed_at`

### 5.5 Configuração Declarativa (YAML)

Assim como schemas, rotas podem ser configuradas via YAML em `config/routing/`. Carregadas na inicialização e sincronizadas com o Postgres.

### 5.6 API de Routing

Rotas em `src/interface/http/routes/routing.routes.ts`:

- `POST /routes` — criar rota
- `GET /routes` — listar rotas
- `GET /routes/:source` — listar rotas de uma source
- `PUT /routes/:id` — atualizar rota
- `DELETE /routes/:id` — desativar rota

---

## Fase 6 — Transforms

### 6.1 Conceito

Transforms permitem transformar o payload do webhook antes de entregar ao target. Em vez do e-commerce receber o payload raw do Stripe e precisar extrair campos, o Topaz entrega um payload limpo e normalizado.

### 6.2 Tabela de Transforms

Criar tabela `transforms`:

- `id`
- `source`
- `event_type`
- `mapping` — JSONB com o mapeamento declarativo de campos
- `active`

### 6.3 Engine de Transformação

Criar um engine simples que suporta:

- Mapeamento de campos: `"order_id": "data.object.metadata.order_id"` — extrair valor de path aninhado
- Operações básicas: `divide(100)`, `uppercase`, `lowercase`, `default(valor)`
- Timestamp: `@timestamp` para usar o timestamp do evento
- Passthrough: `@raw` para incluir o payload original completo

O engine não precisa ser Turing-complete. Deve ser uma DSL simples e declarativa, fácil de entender e segura (sem eval, sem execução de código arbitrário).

### 6.4 Integração no Worker

O worker, após resolver a rota e antes de fazer o POST para o target, busca o transform correspondente e aplica ao payload. Se não houver transform, envia o payload raw.

### 6.5 Configuração Declarativa (YAML)

Transforms configuráveis via YAML em `config/transforms/`. Mesmo padrão de schemas e routing.

---

## Fase 7 — Deduplicação

### 7.1 Conceito

Emissores como Stripe enviam o mesmo evento múltiplas vezes por segurança. O Topaz precisa ignorar duplicatas para não processar um pagamento duas vezes.

### 7.2 Implementação

Usar um campo configurável por source como chave de deduplicação (ex: `id` para Stripe, `event_id` para Melhor Envio). A janela de deduplicação é configurável (ex: 72h para Stripe).

A deduplicação acontece em duas camadas:

- **Redis** (hot) — SET com TTL para verificação rápida. Chave: `dedup:{source}:{event_id}`. Se a chave existir, retorna `202` imediatamente sem processar (já foi recebido).
- **Postgres** (cold) — unique index em `(source, external_id)` como garantia. Se o Redis falhar na checagem, o Postgres pega na constraint.

Adicionar campo `external_id` na tabela `events` para armazenar o ID original do emissor, separado do `id` interno do Topaz.

### 7.3 Configuração por Source

Na tabela/YAML de sources, configurar:

- `dedup_field` — caminho no payload para extrair o ID (ex: "id", "event.id")
- `dedup_window` — tempo de janela (ex: "72h")

---

## Fase 8 — Source Management

### 8.1 Conceito

Centralizar a configuração de cada source (Stripe, Melhor Envio, etc.) com suas particularidades: como validar assinatura, como deduplicar, qual rate limit aceitar.

### 8.2 Tabela de Sources

Criar tabela `sources`:

- `id`
- `name` — identificador da source (slug usado na URL: `/webhooks/:source`)
- `signature_header` — nome do header que contém a assinatura
- `signature_secret` — secret para validação (encriptado em repouso)
- `signature_algorithm` — algoritmo: hmac-sha256, hmac-sha512, etc.
- `dedup_field` — campo do payload para deduplicação
- `dedup_window` — janela de deduplicação
- `rate_limit_max` — máximo de requests por janela
- `rate_limit_window` — janela do rate limit em ms
- `active`

### 8.3 Configuração Declarativa (YAML)

Sources configuráveis via YAML em `config/sources/`. Carregadas na inicialização.

---

## Fase 9 — Job de Reconciliação

### 9.1 Conceito

Última linha de defesa. Mesmo que webhook, retry e replay falhem, o job de reconciliação garante que nenhum pagamento se perde. Ele compara os dados do emissor (via API) com o que está no Postgres e identifica discrepâncias.

### 9.2 Implementação

Criar um job periódico (a cada 5 minutos) por source que:

1. Puxa eventos recentes da API do emissor (ex: Stripe List Events API, últimos 30 minutos)
2. Compara com eventos no Postgres para aquela source e período
3. Identifica eventos que existem no emissor mas não no Topaz
4. Cria eventos artificiais no Postgres e injeta na fila para processamento
5. Registra a discrepância no log e dispara alerta

### 9.3 Interface de Reconciliação

Criar interface no módulo de application com método `reconcile(source, period)` que cada adapter de source implementa. O adapter do Stripe sabe chamar a API do Stripe; o adapter do Melhor Envio sabe chamar a API do Melhor Envio.

---

## Estrutura Final de Diretórios (DDD)

```
src/
├── domain/
│   └── ingestion/
│       ├── application/
│       │   ├── interfaces/
│       │   │   ├── queue-producer.interface.ts      (existe)
│       │   │   ├── event-repository.interface.ts    (novo)
│       │   │   ├── schema-repository.interface.ts   (novo)
│       │   │   ├── route-repository.interface.ts    (novo)
│       │   │   ├── source-repository.interface.ts   (novo)
│       │   │   └── reconciler.interface.ts          (novo)
│       │   └── use-cases/
│       │       ├── ingest-webhook.use-case.ts       (modificar)
│       │       ├── validate-payload.use-case.ts     (novo)
│       │       ├── manage-schema.use-case.ts        (novo)
│       │       ├── request-replay.use-case.ts       (novo)
│       │       ├── execute-replay.use-case.ts       (novo)
│       │       ├── resolve-routes.use-case.ts       (novo)
│       │       ├── apply-transform.use-case.ts      (novo)
│       │       └── reconcile-source.use-case.ts     (novo)
│       └── enterprise/
│           ├── entities/
│           │   ├── webhook-payload.ts               (existe)
│           │   ├── batch-record.ts                  (existe)
│           │   ├── event.ts                         (novo)
│           │   ├── schema-definition.ts             (novo)
│           │   ├── route.ts                         (novo)
│           │   ├── replay-request.ts                (novo)
│           │   ├── delivery.ts                      (novo)
│           │   ├── source.ts                        (novo)
│           │   └── alert-rule.ts                    (novo)
│           └── value-objects/
│               ├── batch-id.ts                      (existe)
│               ├── event-status.ts                  (novo)
│               ├── validation-result.ts             (novo)
│               └── transform-mapping.ts             (novo)
│
├── infra/
│   ├── config/
│   │   ├── env.ts                                   (modificar: add PG vars)
│   │   ├── redis.ts                                 (existe)
│   │   ├── database.ts                              (novo: PG pool)
│   │   └── logger.ts                                (existe)
│   ├── di/
│   │   └── container.ts                             (modificar: registrar novos repos)
│   ├── persistence/
│   │   ├── pg/
│   │   │   ├── event.repository.ts                  (novo)
│   │   │   ├── schema.repository.ts                 (novo)
│   │   │   ├── route.repository.ts                  (novo)
│   │   │   ├── source.repository.ts                 (novo)
│   │   │   ├── alert.repository.ts                  (novo)
│   │   │   ├── replay.repository.ts                 (novo)
│   │   │   └── migrations/                          (novo: SQL migrations)
│   │   └── webhook-buffer.ts                        (novo: micro-batch 50ms)
│   ├── queue/
│   │   ├── consumers/
│   │   │   ├── webhook.worker.ts                    (modificar: routing + transforms)
│   │   │   └── batch.worker.ts                      (existe)
│   │   └── producers/
│   │       ├── webhook-queue.producer.ts             (existe)
│   │       └── batch-queue.producer.ts               (existe)
│   ├── jobs/                                         (novo)
│   │   ├── recovery.job.ts                          (novo: reinjecta events stuck)
│   │   ├── reconciliation.job.ts                    (novo: compara com API externa)
│   │   └── alert-evaluator.job.ts                   (novo: avalia regras de alerta)
│   └── reconcilers/                                  (novo)
│       ├── stripe.reconciler.ts                     (novo)
│       └── melhor-envio.reconciler.ts               (novo)
│
├── interface/
│   ├── http/
│   │   ├── controllers/
│   │   │   ├── webhook.controller.ts                (modificar)
│   │   │   ├── schema.controller.ts                 (novo)
│   │   │   ├── replay.controller.ts                 (novo)
│   │   │   ├── routing.controller.ts                (novo)
│   │   │   ├── metrics.controller.ts                (novo)
│   │   │   ├── alert.controller.ts                  (novo)
│   │   │   └── dlq.controller.ts                    (novo)
│   │   ├── routes/
│   │   │   ├── webhook.routes.ts                    (existe)
│   │   │   ├── schema.routes.ts                     (novo)
│   │   │   ├── replay.routes.ts                     (novo)
│   │   │   ├── routing.routes.ts                    (novo)
│   │   │   ├── metrics.routes.ts                    (novo)
│   │   │   ├── alert.routes.ts                      (novo)
│   │   │   └── dlq.routes.ts                        (novo)
│   │   └── schemas/                                 (Zod validation)
│   │       ├── schema.schema.ts                     (novo)
│   │       ├── replay.schema.ts                     (novo)
│   │       ├── routing.schema.ts                    (novo)
│   │       └── alert.schema.ts                      (novo)
│   ├── workers/
│   │   └── index.ts                                 (modificar: add recovery + alert jobs)
│   └── dashboard/                                    (novo: frontend)
│       ├── src/
│       └── Dockerfile
│
└── config/                                           (novo: declarative YAML)
    ├── sources/
    │   └── stripe.yml
    ├── schemas/
    │   └── stripe.yml
    ├── routing/
    │   └── stripe.yml
    └── transforms/
        └── stripe.yml
```

---

## Ordem de Implementação Recomendada

```
Fase 1 → Persistência (WAL + Buffer)    ← fundação, tudo depende disso
Fase 8 → Source Management               ← necessário pra saber como validar/deduplicar
Fase 7 → Deduplicação                    ← depende das sources configuradas
Fase 2 → Schema Validation              ← depende do Postgres da Fase 1
Fase 5 → Routing + Fan-out              ← substitui worker hardcoded
Fase 6 → Transforms                     ← complementa routing
Fase 3 → Replay                         ← depende do WAL da Fase 1
Fase 4 → Dashboard                      ← consome tudo que foi construído
Fase 9 → Reconciliação                  ← última camada, pode vir por último
```

Cada fase é independente o suficiente para ser entregue e testada isoladamente, mas a Fase 1 é pré-requisito para todas as outras.
