-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('RECEIVED', 'QUEUED', 'PROCESSING', 'DELIVERED', 'FAILED', 'DEAD', 'DISCARDED');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('VALID', 'INVALID', 'NO_SCHEMA', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ReplayStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AlertMetric" AS ENUM ('ERROR_RATE', 'QUEUE_SIZE', 'LATENCY_P95', 'DLQ_SIZE', 'SCHEMA_DRIFT');

-- CreateEnum
CREATE TYPE "RouteMethod" AS ENUM ('POST', 'PUT', 'PATCH');

-- CreateEnum
CREATE TYPE "RoutePriority" AS ENUM ('CRITICAL', 'HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "BackoffStrategy" AS ENUM ('FIXED', 'EXPONENTIAL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "SignatureAlgorithm" AS ENUM ('HMAC_SHA256', 'HMAC_SHA512');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "external_id" TEXT,
    "source" TEXT NOT NULL,
    "event_type" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "headers" JSONB NOT NULL,
    "signature" TEXT,
    "validation_status" "ValidationStatus" NOT NULL DEFAULT 'SKIPPED',
    "validation_errors" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queued_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_definitions" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "schema" JSONB NOT NULL,
    "reject_on_fail" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schema_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replay_requests" (
    "id" TEXT NOT NULL,
    "filter_source" TEXT,
    "filter_event_type" TEXT,
    "filter_status" "EventStatus",
    "filter_from" TIMESTAMP(3),
    "filter_to" TIMESTAMP(3),
    "total_events" INTEGER NOT NULL DEFAULT 0,
    "replayed_events" INTEGER NOT NULL DEFAULT 0,
    "status" "ReplayStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "replay_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metric" "AlertMetric" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "window" TEXT NOT NULL,
    "target_url" TEXT NOT NULL,
    "cooldown" TEXT NOT NULL DEFAULT '5m',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_history" (
    "id" TEXT NOT NULL,
    "alert_rule_id" TEXT NOT NULL,
    "metric_value" DOUBLE PRECISION NOT NULL,
    "message" TEXT NOT NULL,
    "fired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "event_type" TEXT NOT NULL DEFAULT '*',
    "target_url" TEXT NOT NULL,
    "target_name" TEXT NOT NULL,
    "method" "RouteMethod" NOT NULL DEFAULT 'POST',
    "timeout" INTEGER NOT NULL DEFAULT 5000,
    "retry_count" INTEGER NOT NULL DEFAULT 3,
    "retry_backoff" "BackoffStrategy" NOT NULL DEFAULT 'EXPONENTIAL',
    "priority" "RoutePriority" NOT NULL DEFAULT 'NORMAL',
    "headers" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "response_code" INTEGER,
    "response_body" TEXT,
    "duration_ms" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transforms" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "signature_header" TEXT,
    "signature_secret" TEXT,
    "signature_algorithm" "SignatureAlgorithm",
    "dedup_field" TEXT,
    "dedup_window" TEXT,
    "rate_limit_max" INTEGER,
    "rate_limit_window" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_source_status_idx" ON "events"("source", "status");

-- CreateIndex
CREATE INDEX "events_status_created_at_idx" ON "events"("status", "created_at");

-- CreateIndex
CREATE INDEX "events_source_event_type_created_at_idx" ON "events"("source", "event_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "events_source_external_id_key" ON "events"("source", "external_id");

-- CreateIndex
CREATE INDEX "schema_definitions_source_event_type_active_idx" ON "schema_definitions"("source", "event_type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "schema_definitions_source_event_type_version_key" ON "schema_definitions"("source", "event_type", "version");

-- CreateIndex
CREATE INDEX "replay_requests_status_idx" ON "replay_requests"("status");

-- CreateIndex
CREATE INDEX "alert_history_alert_rule_id_fired_at_idx" ON "alert_history"("alert_rule_id", "fired_at");

-- CreateIndex
CREATE INDEX "routes_source_event_type_active_idx" ON "routes"("source", "event_type", "active");

-- CreateIndex
CREATE INDEX "deliveries_event_id_idx" ON "deliveries"("event_id");

-- CreateIndex
CREATE INDEX "deliveries_route_id_status_idx" ON "deliveries"("route_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "transforms_source_event_type_key" ON "transforms"("source", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "sources_name_key" ON "sources"("name");

-- AddForeignKey
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
