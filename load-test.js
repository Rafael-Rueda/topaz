#!/usr/bin/env node

/**
 * Load Test Script - Topaz Webhook Ingestion
 * Target: 50,000 requests/minute = ~833 req/second
 */

import { performance } from "node:perf_hooks";
import axios from "axios";

// Configuration
const TARGET_RPS = 833; // ~50k/min
const DURATION_SECONDS = 60; // Run for 1 minute
const CONCURRENCY = 100; // Concurrent connections
const BATCH_SIZE = 50; // Requests per batch per worker

const BASE_URL = process.env.TARGET_URL || "http://localhost:3333";
const SOURCE = process.env.SOURCE || "stripe";

// Sample webhook payloads (varied to simulate real traffic)
const payloads = [
    {
        id: "evt_test_{{seq}}",
        type: "payment_intent.succeeded",
        data: {
            object: {
                id: "pi_test_{{seq}}",
                amount: 49990,
                currency: "brl",
                status: "succeeded",
                customer: "cus_abc123",
                metadata: { order_id: "ORD-{{seq}}", product: "Premium Plan" },
            },
        },
        created: Date.now(),
    },
    {
        id: "evt_test_{{seq}}",
        type: "charge.succeeded",
        data: {
            object: {
                id: "ch_test_{{seq}}",
                amount: 2990,
                currency: "usd",
                status: "succeeded",
                customer: "cus_def456",
                receipt_url: "https://pay.stripe.com/receipts/...",
            },
        },
        created: Date.now(),
    },
    {
        id: "evt_test_{{seq}}",
        type: "invoice.paid",
        data: {
            object: {
                id: "in_test_{{seq}}",
                amount_due: 9990,
                currency: "eur",
                status: "paid",
                customer: "cus_ghi789",
                subscription: "sub_test_{{seq}}",
            },
        },
        created: Date.now(),
    },
    {
        id: "evt_test_{{seq}}",
        type: "customer.created",
        data: {
            object: {
                id: "cus_test_{{seq}}",
                email: "customer{{seq}}@example.com",
                name: "Test Customer {{seq}}",
                phone: "+1234567890",
            },
        },
        created: Date.now(),
    },
];

// Statistics
const stats = {
    total: 0,
    success: 0,
    failed: 0,
    errors: new Map(),
    latencies: [],
    startTime: null,
    endTime: null,
};

function generatePayload(seq) {
    const template = payloads[seq % payloads.length];
    return JSON.parse(JSON.stringify(template).replace(/\{\{seq\}\}/g, String(seq)));
}

async function sendRequest(seq) {
    const start = performance.now();
    const payload = generatePayload(seq);

    try {
        const response = await axios.post(`${BASE_URL}/webhooks/${SOURCE}`, payload, {
            headers: {
                "Content-Type": "application/json",
                "X-Test-Sequence": String(seq),
            },
            timeout: 30000,
            validateStatus: () => true, // Accept any status
        });

        const latency = performance.now() - start;
        stats.latencies.push(latency);

        if (response.status >= 200 && response.status < 300) {
            stats.success++;
        } else {
            stats.failed++;
            const key = `HTTP_${response.status}`;
            stats.errors.set(key, (stats.errors.get(key) || 0) + 1);
        }
    } catch (error) {
        const latency = performance.now() - start;
        stats.latencies.push(latency);
        stats.failed++;

        const errorKey = error.code || error.name || "UNKNOWN_ERROR";
        stats.errors.set(errorKey, (stats.errors.get(errorKey) || 0) + 1);
    }

    stats.total++;
}

async function workerBatch(startSeq, count) {
    const promises = [];
    for (let i = 0; i < count; i++) {
        promises.push(sendRequest(startSeq + i));
    }
    await Promise.all(promises);
}

async function runLoadTest() {
    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║         TOPAZ WEBHOOK LOAD TEST                          ║");
    console.log("╠══════════════════════════════════════════════════════════╣");
    console.log(`║  Target: ${TARGET_RPS} req/sec (~${TARGET_RPS * 60}/min)                   ║`);
    console.log(`║  Duration: ${DURATION_SECONDS} seconds                                ║`);
    console.log(`║  Concurrency: ${CONCURRENCY} workers                            ║`);
    console.log(`║  Endpoint: ${BASE_URL}/webhooks/${SOURCE}             ║`);
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    stats.startTime = performance.now();

    const targetTotal = TARGET_RPS * DURATION_SECONDS;
    let sent = 0;

    // Progress reporter
    const progressInterval = setInterval(() => {
        const elapsed = (performance.now() - stats.startTime) / 1000;
        const rps = stats.total / elapsed;
        const progress = ((stats.total / targetTotal) * 100).toFixed(1);

        process.stdout.write(
            `\r📊 Progress: ${progress}% | Sent: ${stats.total} | ` +
                `Success: ${stats.success} | Failed: ${stats.failed} | ` +
                `RPS: ${rps.toFixed(0)}`,
        );
    }, 1000);

    // Main load loop
    const requestsPerBatch = Math.ceil(TARGET_RPS / CONCURRENCY);
    const batchIntervalMs = 1000 / CONCURRENCY;

    const workers = [];
    const startTime = Date.now();

    while (Date.now() - startTime < DURATION_SECONDS * 1000 && sent < targetTotal) {
        const batchStart = sent;
        const batchCount = Math.min(requestsPerBatch, targetTotal - sent);

        // Launch concurrent batches
        for (let w = 0; w < CONCURRENCY && sent < targetTotal; w++) {
            const workerBatchCount = Math.min(BATCH_SIZE, targetTotal - sent);
            workers.push(workerBatch(sent, workerBatchCount));
            sent += workerBatchCount;

            // Small delay between launching workers
            if (w < CONCURRENCY - 1) {
                await new Promise((r) => setTimeout(r, 1));
            }
        }

        // Wait for batch to complete before next wave
        await Promise.all(workers.splice(0));

        // Control rate
        const elapsedMs = Date.now() - startTime;
        const expectedMs = (sent / TARGET_RPS) * 1000;
        const delay = Math.max(0, expectedMs - elapsedMs);
        if (delay > 0) {
            await new Promise((r) => setTimeout(r, delay));
        }
    }

    clearInterval(progressInterval);
    stats.endTime = performance.now();

    await printResults();
}

function calculatePercentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
}

async function printResults() {
    const duration = (stats.endTime - stats.startTime) / 1000;
    const actualRPS = stats.total / duration;

    console.log("\n\n╔══════════════════════════════════════════════════════════╗");
    console.log("║                    RESULTS                               ║");
    console.log("╠══════════════════════════════════════════════════════════╣");
    console.log(`║  Total Requests:    ${stats.total.toString().padStart(6)}                          ║`);
    console.log(
        `║  Successful:        ${stats.success.toString().padStart(6)} (${((stats.success / stats.total) * 100).toFixed(1)}%)              ║`,
    );
    console.log(
        `║  Failed:            ${stats.failed.toString().padStart(6)} (${((stats.failed / stats.total) * 100).toFixed(1)}%)              ║`,
    );
    console.log(`║  Duration:          ${duration.toFixed(1)}s                              ║`);
    console.log(`║  Actual RPS:        ${actualRPS.toFixed(0)}                              ║`);
    console.log("╠══════════════════════════════════════════════════════════╣");
    console.log("║  LATENCY (ms)                                            ║");
    console.log(
        `║    Min:    ${calculatePercentile(stats.latencies, 0).toFixed(2).padStart(8)}                                    ║`,
    );
    console.log(
        `║    P50:    ${calculatePercentile(stats.latencies, 50).toFixed(2).padStart(8)}                                    ║`,
    );
    console.log(
        `║    P95:    ${calculatePercentile(stats.latencies, 95).toFixed(2).padStart(8)}                                    ║`,
    );
    console.log(
        `║    P99:    ${calculatePercentile(stats.latencies, 99).toFixed(2).padStart(8)}                                    ║`,
    );
    console.log(
        `║    Max:    ${calculatePercentile(stats.latencies, 100).toFixed(2).padStart(8)}                                    ║`,
    );
    console.log("╠══════════════════════════════════════════════════════════╣");
    console.log("║  ERROR BREAKDOWN                                         ║");
    if (stats.errors.size === 0) {
        console.log("║    No errors!                                            ║");
    } else {
        for (const [key, count] of stats.errors) {
            console.log(`║    ${key.padEnd(15)}: ${count.toString().padStart(5)}                          ║`);
        }
    }
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    // Health check summary
    const successRate = (stats.success / stats.total) * 100;
    const p95Latency = calculatePercentile(stats.latencies, 95);

    console.log("📈 HEALTH CHECK:");
    if (successRate >= 99.9 && p95Latency < 1000) {
        console.log("   ✅ EXCELLENT - System handled load perfectly");
    } else if (successRate >= 99 && p95Latency < 2000) {
        console.log("   ✅ GOOD - Minor degradation under load");
    } else if (successRate >= 95 && p95Latency < 5000) {
        console.log("   ⚠️  FAIR - Some requests failed or were slow");
    } else {
        console.log("   ❌ POOR - Significant issues under load");
    }

    // Save detailed results
    const fs = await import("node:fs");
    const report = {
        timestamp: new Date().toISOString(),
        targetRPS: TARGET_RPS,
        targetTotal: TARGET_RPS * DURATION_SECONDS,
        actual: {
            total: stats.total,
            success: stats.success,
            failed: stats.failed,
            duration: duration,
            rps: actualRPS,
        },
        latency: {
            min: calculatePercentile(stats.latencies, 0),
            p50: calculatePercentile(stats.latencies, 50),
            p95: calculatePercentile(stats.latencies, 95),
            p99: calculatePercentile(stats.latencies, 99),
            max: calculatePercentile(stats.latencies, 100),
        },
        errors: Object.fromEntries(stats.errors),
    };

    const reportFile = `load-test-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportFile}\n`);
}

// Run the test
runLoadTest().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
