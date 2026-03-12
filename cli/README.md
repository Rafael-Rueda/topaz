# @rueda.dev/gems-topaz

<p align="center">
  <img src="https://raw.githubusercontent.com/Rafael-Rueda/topaz/main/Topaz.png" alt="Topaz Logo" width="400"/>
</p>

<h3 align="center">High-Volatility Ingestion & Refining Unit</h3>

<p align="center">
  Stabilize the flux. Protect the Core.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-green.svg" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7+-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Fastify-5.8+-purple.svg" alt="Fastify" />
  <img src="https://img.shields.io/badge/BullMQ-5.34+-red.svg" alt="BullMQ" />
  <img src="https://img.shields.io/badge/PostgreSQL-16+-blue.svg" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-7+-orange.svg" alt="Redis" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License" />
</p>

---

## What is Topaz?

Topaz is an **enterprise-grade webhook ingestion and event streaming system** designed for fault tolerance. It acts as an orbital refinery station — receives volatile, raw materials (webhooks, CSV dumps) from external sources, stabilizes them through validation and transformation, and queues them for safe delivery.

**Your events should never be lost, even in catastrophic failures.**

## Quick Start

```bash
npx "@rueda.dev/gems-topaz" my-project
cd my-project
cp .env.example .env
docker-compose up -d
npm run db:migrate
npm run prisma:generate
npm run dev
```

Your API is now running at `http://localhost:3000`

> Dependencies are installed automatically during scaffolding.

## Why Topaz?

| Traditional Webhook Handlers | Topaz Approach                             |
| ---------------------------- | ------------------------------------------ |
| Return 202 before persisting | Return 202 **only after** PostgreSQL write |
| Lose events on Redis crash   | Write-Ahead Log guarantees durability      |
| Silent failures              | Schema validation with drift detection     |
| Manual replay only           | Automated replay with filtering            |
| Single target delivery       | Fan-out to multiple targets                |
| Hardcoded transformations    | Declarative field mapping                  |

## What's Included

| Feature                    | Description                                             |
| -------------------------- | ------------------------------------------------------- |
| **Write-Ahead Log**        | Zero data loss — events persisted before queuing        |
| **Schema Validation**      | JSON Schema validation with drift detection             |
| **Event Replay**           | Automated replay with source, status, and date filters  |
| **Routing & Fan-out**      | Deliver events to multiple targets with retry policies  |
| **Declarative Transforms** | Field mapping without writing code                      |
| **Deduplication**          | Configurable dedup window per source                    |
| **Source Management**      | HMAC signature verification, rate limiting              |
| **Alert Rules**            | Webhook notifications for error rate, latency, DLQ size |
| **Batch Processing**       | Streaming CSV ingestion with chunked processing         |
| **Real-time Dashboard**    | React + Tremor monitoring UI                            |

## Architecture

Topaz follows **Clean Architecture** and **Domain-Driven Design**:

```
┌──────────────────────────────────────────────────────┐
│                   Interface Layer                    │
│   HTTP API (Fastify)  │  Dashboard (React)  │ Workers│
├──────────────────────────────────────────────────────┤
│                  Application Layer                   │
│   IngestWebhook  │  ValidatePayload  │  ResolveRoutes│
│   ExecuteReplay  │  ApplyTransform   │  Reconcile    │
├──────────────────────────────────────────────────────┤
│                    Domain Layer                      │
│   Event  │  Route  │  Delivery  │  Source  │  Schema │
├──────────────────────────────────────────────────────┤
│                Infrastructure Layer                  │
│   PostgreSQL (WAL)  │  Redis (BullMQ)  │  Awilix DI  │
└──────────────────────────────────────────────────────┘
```

## Project Structure

```
src/
├── domain/              # Pure business logic (no framework deps)
│   └── ingestion/
│       ├── application/ # Use cases & repository interfaces
│       └── enterprise/  # Entities & value objects
├── infra/               # External implementations
│   ├── config/          # Environment, logger, Redis, database
│   ├── di/              # Awilix dependency injection container
│   ├── jobs/            # Recovery, reconciliation, alert jobs
│   ├── persistence/     # PostgreSQL repositories
│   ├── queue/           # BullMQ producers & consumers
│   └── reconcilers/     # External API reconciliation
├── interface/
│   ├── http/            # Fastify server, routes, controllers
│   └── workers/         # Background worker entry point
dashboard/               # React + Tremor monitoring UI
prisma/                  # Database schema & migrations
```

## API Endpoints

### Core

| Method | Endpoint            | Description      |
| ------ | ------------------- | ---------------- |
| `POST` | `/webhooks/:source` | Ingest webhook   |
| `POST` | `/:source/batch`    | Batch CSV upload |
| `GET`  | `/health`           | Health check     |

### Configuration

| Resource       | Endpoints     | Operations                                  |
| -------------- | ------------- | ------------------------------------------- |
| **Sources**    | `/sources`    | Register, list, update webhook sources      |
| **Schemas**    | `/schemas`    | Define JSON Schema per event type           |
| **Routes**     | `/routes`     | Configure delivery targets & retry policies |
| **Transforms** | `/transforms` | Declarative field mapping rules             |
| **Alerts**     | `/alerts`     | Metric-based alert rules                    |

### Operations

| Resource    | Endpoints  | Operations                          |
| ----------- | ---------- | ----------------------------------- |
| **Replay**  | `/replay`  | Preview, execute, track replays     |
| **DLQ**     | `/dlq`     | View & manage dead letter events    |
| **Metrics** | `/metrics` | Throughput, latency, errors, queues |

## Available Commands

```bash
# Development
npm run dev              # API server with hot reload
npm run dev:worker       # Background workers with hot reload
npm run dashboard:dev    # Dashboard dev server on :5173

# Database
npm run db:migrate       # Run Prisma migrations
npm run db:studio        # Visual database editor
npm run prisma:generate  # Generate Prisma client

# Production
npm run build            # Compile TypeScript
npm run start            # Start production server
npm run start:worker     # Start production workers
npm run dashboard:build  # Build dashboard
npm run dashboard:serve  # Serve dashboard on :3001

# Quality
npm run lint             # Format with Biome
npm run typecheck        # Type checking
npm run test:load        # Load testing
```

## Performance

- **Micro-batching**: 50ms buffer window, up to 500 events per flush
- **Throughput**: ~50,000 events/second sustained
- **Memory**: O(1) for batch processing (streaming CSV)
- **Latency**: p99 < 100ms for webhook acknowledgment

## Learn More

See the full documentation at the [Topaz GitHub repository](https://github.com/rafael-rueda/topaz).

## License

MIT - [Rueda Gems](https://gems.rueda.dev) by [Rafael Rueda](https://github.com/Rafael-Rueda)
