<div align="center">
  <img src="Topaz.png" alt="Topaz Logo" width="400" />
  <h1>Topaz</h1>
  <p><strong>High-Volatility Ingestion & Refining Unit</strong></p>
  <p><em>Stabilize the flux. Protect the Core.</em></p>

  <p>
    <a href="#quick-start">Quick Start</a> •
    <a href="#features">Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#documentation">Documentation</a> •
    <a href="#contributing">Contributing</a>
  </p>

  <div>
    <img src="https://img.shields.io/badge/Node.js-20+-green.svg" alt="Node.js" />
    <img src="https://img.shields.io/badge/TypeScript-5.7+-blue.svg" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Fastify-5.8+-purple.svg" alt="Fastify" />
    <img src="https://img.shields.io/badge/BullMQ-5.34+-red.svg" alt="BullMQ" />
    <img src="https://img.shields.io/badge/PostgreSQL-16+-blue.svg" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Redis-7+-orange.svg" alt="Redis" />
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License" />
  </div>
</div>

---

## Why Topaz?

Most webhook ingestion systems are just HTTP endpoints that dump data into a queue. **Topaz is different.**

We built Topaz with one core principle: **your events should never be lost, even in catastrophic failures.**

### The Problem with Traditional Approaches

| ❌ Traditional Webhook Handlers | ✅ Topaz Approach                           |
| ------------------------------ | ------------------------------------------ |
| Return 202 before persisting   | Return 202 **only after** PostgreSQL write |
| Lose events on Redis crash     | Write-Ahead Log guarantees durability      |
| Silent failures                | Schema validation with drift detection     |
| Manual replay only             | Automated replay with filtering            |
| Single target delivery         | Fan-out to multiple targets                |
| Hardcoded transformations      | Declarative field mapping                  |

Topaz acts as an **orbital refinery station** — it receives volatile, raw materials (unpredictable webhooks, massive CSV dumps) from external sectors, stabilizes them, and queues for safe delivery to your Core services.

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/Rafael-Rueda/topaz.git
cd topaz

# Install dependencies
npm install

# Setup environment
cp .env.example .env
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Run database migrations
npm run db:migrate

# Generate Prisma client
npm run prisma:generate
```

### 3. Start the Application

```bash
# Terminal 1: Start the API server
npm run dev

# Terminal 2: Start the background workers
npm run dev:worker

# Terminal 3: Start the dashboard (optional)
npm run dashboard:dev
```

The API will be available at `http://localhost:3000` and the dashboard at `http://localhost:5173`.

---

## Features

### Write-Ahead Log (Zero Data Loss)

Topaz only returns `202 Accepted` after the event is persisted in PostgreSQL. Even if Redis crashes immediately after, the event is safe and will be re-enqueued by the recovery job.

```typescript
// The WebhookBuffer ensures durability
const result = await webhookBuffer.add(event, payload);
// Only resolves after Postgres INSERT succeeds
// Rejects with 500 if persistence fails (emitter retries)
```

### Schema Validation & Drift Detection

Define expected schemas for each event type. Topaz validates incoming payloads and detects when providers change their format unexpectedly.

```bash
# Register a schema for Stripe checkout events
POST /schemas
{
  "source": "stripe",
  "eventType": "checkout.session.completed",
  "schema": { /* JSON Schema */ },
  "rejectOnFail": false  // Queue invalid events with tags
}
```

### Event Replay

Reprocess failed or historical events with powerful filtering:

```bash
# Preview what would be replayed
POST /replay/preview
{
  "filterSource": "stripe",
  "filterStatus": "FAILED",
  "filterFrom": "2024-01-01T00:00:00Z",
  "filterTo": "2024-01-31T23:59:59Z"
}

# Execute the replay
POST /replay/execute
```

### Routing & Fan-out

Deliver a single event to multiple targets in parallel:

```bash
POST /routes
{
  "source": "stripe",
  "eventType": "checkout.session.completed",
  "targetUrl": "https://api.yourservice.com/payments",
  "targetName": "payment-processor",
  "retryCount": 3,
  "retryBackoff": "EXPONENTIAL"
}
```

### Declarative Transforms

Transform payloads before delivery without writing code:

```yaml
# config/transforms/stripe.yml
source: stripe
eventType: checkout.session.completed
mapping:
  order_id: "data.object.metadata.order_id"
  amount: "data.object.amount_total | divide(100)"
  currency: "data.object.currency | uppercase"
  status: "data.object.status | default(pending)"
```

### Deduplication

Prevent double-processing with configurable deduplication:

```bash
POST /sources
{
  "name": "stripe",
  "dedupField": "id",        // Extract from payload
  "dedupWindow": "72h"       // Redis TTL
}
```

### Real-time Dashboard

Monitor your ingestion pipeline with the built-in React dashboard:

- **Throughput metrics** — events per second by source
- **Latency tracking** — p50, p95, p99 delivery times
- **DLQ management** — view, replay, or discard dead events
- **Alert rules** — webhook notifications for anomalies

---

## Architecture

Topaz follows **Clean Architecture** and **Domain-Driven Design** principles:

```
┌─────────────────────────────────────────────────────────────┐
│                      Interface Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   HTTP API   │  │   Dashboard  │  │     Workers      │   │
│  │  (Fastify)   │  │   (React)    │  │    (BullMQ)      │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Use Cases (Application Services)        │   │
│  │  • IngestWebhookUseCase    • ValidatePayloadUseCase  │   │
│  │  • ExecuteReplayUseCase    • ResolveRoutesUseCase    │   │
│  │  • ApplyTransformUseCase   • ReconcileSourceUseCase  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                           │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │     Entities     │  │         Value Objects            │ │
│  │  • Event         │  │  • EventStatus                   │ │
│  │  • Route         │  │  • ValidationResult              │ │
│  │  • Delivery      │  │  • TransformMapping              │ │
│  │  • Source        │  │  • BatchId                       │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                      │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ PostgreSQL │  │    Redis     │  │   WebhookBuffer      │ │
│  │  (WAL)     │  │  (BullMQ)    │  │  (Micro-batch 50ms)  │ │
│  └────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Rule

Dependencies point inward. The Domain knows nothing about Fastify, PostgreSQL, or Redis. Infrastructure implements interfaces defined by the Application layer.

| Layer          | Dependencies                | Examples                                 |
| -------------- | --------------------------- | ---------------------------------------- |
| Domain         | None                        | Entities, Value Objects, Domain Events   |
| Application    | Domain                      | Use Cases, Repository Interfaces         |
| Infrastructure | Application, Domain         | Controllers, Repositories, Queue Workers |
| Interface      | Infrastructure, Application | Fastify Routes, React Dashboard          |

---

## Project Structure

```
topaz/
├── src/
│   ├── domain/
│   │   └── ingestion/
│   │       ├── application/
│   │       │   ├── interfaces/          # Repository & service interfaces
│   │       │   └── use-cases/           # Application services
│   │       └── enterprise/
│   │           ├── entities/            # Domain entities
│   │           └── value-objects/       # Value objects
│   ├── infra/
│   │   ├── config/                      # Environment & logging
│   │   ├── di/                          # Awilix container setup
│   │   ├── jobs/                        # Scheduled jobs (recovery, alerts)
│   │   ├── persistence/                 # PostgreSQL repositories
│   │   ├── queue/                       # BullMQ producers & consumers
│   │   └── reconcilers/                 # External API reconciliation
│   ├── interface/
│   │   ├── http/                        # Fastify server, routes, controllers
│   │   └── workers/                     # Background worker entry point
│   └── generated/prisma/                # Prisma client
├── dashboard/                           # React + Tremor dashboard
├── prisma/
│   └── schema.prisma                    # Database schema
├── docker-compose.yml                   # PostgreSQL + Redis
└── package.json
```

---

## API Endpoints

### Webhook Ingestion

| Method | Endpoint            | Description                         |
| ------ | ------------------- | ----------------------------------- |
| `POST` | `/webhooks/:source` | Ingest webhook from external source |

### Schema Management

| Method   | Endpoint                      | Description                   |
| -------- | ----------------------------- | ----------------------------- |
| `POST`   | `/schemas`                    | Create new schema definition  |
| `GET`    | `/schemas`                    | List all schemas              |
| `GET`    | `/schemas/:source/:eventType` | Get schema by source and type |
| `PUT`    | `/schemas/:id`                | Update schema                 |
| `DELETE` | `/schemas/:id`                | Deactivate schema             |

### Routing

| Method   | Endpoint          | Description           |
| -------- | ----------------- | --------------------- |
| `POST`   | `/routes`         | Create delivery route |
| `GET`    | `/routes`         | List all routes       |
| `GET`    | `/routes/:source` | Get routes for source |
| `PUT`    | `/routes/:id`     | Update route          |
| `DELETE` | `/routes/:id`     | Deactivate route      |

### Replay

| Method | Endpoint          | Description                     |
| ------ | ----------------- | ------------------------------- |
| `POST` | `/replay/preview` | Preview events matching filters |
| `POST` | `/replay/execute` | Execute replay                  |
| `GET`  | `/replay/:id`     | Get replay status               |
| `GET`  | `/replay/history` | List replay history             |

### Metrics & Observability

| Method | Endpoint              | Description            |
| ------ | --------------------- | ---------------------- |
| `GET`  | `/metrics/throughput` | Events per second      |
| `GET`  | `/metrics/latency`    | Delivery latency stats |
| `GET`  | `/metrics/errors`     | Error rates by source  |
| `GET`  | `/metrics/queues`     | Queue depths           |
| `GET`  | `/metrics/dlq`        | Dead letter queue      |

### Source Management

| Method | Endpoint       | Description             |
| ------ | -------------- | ----------------------- |
| `POST` | `/sources`     | Register webhook source |
| `GET`  | `/sources`     | List configured sources |
| `PUT`  | `/sources/:id` | Update source config    |

### Alerts

| Method | Endpoint          | Description          |
| ------ | ----------------- | -------------------- |
| `POST` | `/alerts`         | Create alert rule    |
| `GET`  | `/alerts`         | List alert rules     |
| `GET`  | `/alerts/history` | Alert firing history |

---

## Configuration

### Environment Variables

```env
# Application
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# PostgreSQL
DATABASE_URL=postgresql://docker:docker@localhost:5432/topaz
DB_POOL_MAX=20
DB_POOL_MIN=5

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Webhook
WEBHOOK_SECRET_KEY=your-secret-key

# Batch Processing
BATCH_CHUNK_SIZE=500
```

### Declarative Configuration (YAML)

Topaz supports Git-versioned configuration in `config/`:

```yaml
# config/sources/stripe.yml
name: stripe
signatureHeader: stripe-signature
signatureAlgorithm: HMAC_SHA256
dedupField: id
dedupWindow: 72h
rateLimitMax: 100
rateLimitWindow: 60000
```

---

## Scripts

| Command                 | Description                    |
| ----------------------- | ------------------------------ |
| `npm run dev`           | Start API server in watch mode |
| `npm run dev:worker`    | Start background workers       |
| `npm run build`         | Compile TypeScript             |
| `npm run start`         | Start production server        |
| `npm run db:migrate`    | Run database migrations        |
| `npm run db:studio`     | Open Prisma Studio             |
| `npm run dashboard:dev` | Start dashboard dev server     |
| `npm run test:load`     | Run load tests                 |

---

## Performance

Topaz is designed for high-throughput scenarios:

- **Micro-batching**: 50ms buffer window batches up to 500 events
- **Throughput**: ~50,000 events/second sustained
- **Memory**: O(1) memory usage for batch processing (streaming CSV)
- **Latency**: p99 < 100ms for webhook acknowledgment

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">
  <p><strong>Rueda Gems</strong> — Production-ready boilerplates for serious systems.</p>
  <p>Built with care by <a href="https://github.com/Rafael-Rueda">Rafael Rueda</a></p>
</div>
