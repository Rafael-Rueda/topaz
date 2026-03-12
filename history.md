# Prompt Specification: Project Topaz (Rueda Gems)

**Role:** Senior Backend Software Architect (Node.js & Distributed Systems Specialist)
**Project Name:** Rueda Gems - Module "Topaz"
**Context:** Creating a high-performance boilerplate for Interoperability and Ingestion.

---

## 1. Project Identity & Lore
* **Codename:** Topaz
* **Designation:** High-Volatility Ingestion & Refining Unit.
* **Sci-Fi Metaphor:** Topaz acts as an orbital refinery station located on the edge of the system. It receives volatile, raw materials (unpredictable webhooks, massive legacy CSV dumps) from external sectors. Its sole purpose is to stabilize, refine, and queue these materials before safely transporting them to the fragile "Core Cities" (the main Domain Services).
* **Motto:** *"Stabilize the flux. Protect the Core."*

## 2. The Core Problem (Interoperability)
We need a robust gateway to handle external chaos without coupling it to our clean domain logic. The system must handle:
1.  **High-Concurrency Webhooks:** Bursts of traffic (e.g., payment gateways, marketing hooks) that must be acknowledged immediately (low latency) and processed asynchronously.
2.  **Legacy Batch Ingestion:** Large datasets (CSV/Excel) that cannot be loaded entirely into memory (RAM) and must be processed via Streams.

## 3. Technical Stack (Strict Constraints)
We are avoiding opinionated frameworks like NestJS for this specific Gem to maximize raw performance and control.

* **Language:** TypeScript (Strict mode).
* **Runtime:** Node.js (Current LTS).
* **Web Framework:** **Fastify** (Pure) - chosen for low overhead.
* **Dependency Injection:** **Awilix** - to implement IoC/DI purely, keeping the Domain decoupled from Fastify.
* **Queue/Background Jobs:** **BullMQ** (Redis) - for reliable async processing.
* **Validation:** **Zod**.
* **Streaming/Parsing:** Native Node.js Streams + `@fastify/multipart` (busboy) + `csv-parser`.
* **Architecture:** Domain-Driven Design (DDD).

## 4. Architectural Guidelines (DDD)
The folder structure must clearly separate concerns:

* `src/domain/{bounded-context}/enterprise`: Pure business logic, Entities, Value Objects. **NO external dependencies** (except maybe Zod for validation).
* `src/domain/{bounded-context}/application`: Use Cases (Application Services), Repository Interfaces, Providers Interfaces, Unit Tests. These orchestrate the domain and talk to ports.
* `src/infra`: Implementations of interfaces.
    * `di`: Awilix container setup.
    * `queue`: BullMQ Producer/Consumer setup.
    * `persistence`: Database adapters.
* `src/interface`: Entry points.
    * `http`: Fastify server, routes, schemas, and controllers.
    * `workers`: Entry point for background workers.

## 5. Required Implementation Flows

### Flow A: The "Flash" Ingest (Webhook)
* **Goal:** Zero-blocking ingestion.
* **Process:**
    1.  `POST /webhooks/:source` receives a payload.
    2.  Validate simple auth (Header token/HMAC).
    3.  **Immediately** push payload to `webhook-ingest-queue`.
    4.  Return `202 Accepted` to the provider.
    5.  **Worker:** Picks up the job later to perform heavy processing/database writes.

### Flow B: The "Refiner" Stream (CSV Batch)
* **Goal:** Constant memory usage O(1), regardless of file size (10MB or 10GB).
* **Process:**
    1.  `POST /ingest/batch` receives a `multipart/form-data` stream.
    2.  Pipe the stream through a parser (`csv-parser`).
    3.  **Backpressure Handling:** Do not load all rows into an array.
    4.  **Batching:** Accumulate rows in small chunks (e.g., 500 rows).
    5.  When a chunk is full, pause stream -> send chunk to `batch-processing-queue` -> resume stream.
    6.  Return `200 OK` with a `batchId` for tracking.

## 6. Deliverables
Please generate the following code artifacts:

1.  **Project Structure:** A complete ASCII tree view of the folders.
2.  **Dependencies:** The `package.json` content with the specific libraries mentioned.
3.  **DI Setup:** The `awilix` container configuration file (`src/infra/di/container.ts`) showing how to register Fastify controllers and Use Cases automatically.
4.  **The Streaming Controller:** The specific Fastify controller code for **Flow B** (CSV Stream) demonstrating how to handle `busboy` events and pause/resume streams to push to BullMQ without memory leaks.
5.  **The Worker:** A sample Worker setup that processes the queued chunks.

---
**Instruction:** Act as the Architect and output the code blocks ready for implementation.