#!/usr/bin/env node

/**
 * Quick Load Test - 50k requests with progress tracking
 * Simple version without complex rate limiting
 */

import { performance } from "node:perf_hooks";
import axios from "axios";

const TOTAL_REQUESTS = 50000;
const CONCURRENCY = 200;
const BASE_URL = process.env.TARGET_URL || "http://localhost:3333";
const SOURCE = process.env.SOURCE || "stripe";

const payload = {
    id: "evt_load_test",
    type: "payment_intent.succeeded",
    data: {
        object: {
            id: "pi_load_test",
            amount: 49990,
            currency: "brl",
            status: "succeeded",
            customer: "cus_load_test",
            metadata: { order_id: "ORD-LOAD-001", product: "Load Test" },
        },
    },
};

let completed = 0;
let success = 0;
let failed = 0;
const latencies = [];
const errors = new Map();
const startTime = performance.now();

async function sendRequest(id) {
    const start = performance.now();
    try {
        const res = await axios.post(
            `${BASE_URL}/webhooks/${SOURCE}`,
            { ...payload, id: `evt_${id}`, data: { object: { ...payload.data.object, id: `pi_${id}` } } },
            { timeout: 10000, validateStatus: () => true },
        );
        latencies.push(performance.now() - start);
        if (res.status === 200) success++;
        else {
            failed++;
            errors.set(`HTTP_${res.status}`, (errors.get(`HTTP_${res.status}`) || 0) + 1);
        }
    } catch (err) {
        failed++;
        latencies.push(performance.now() - start);
        errors.set(err.code || "ERROR", (errors.get(err.code || "ERROR") || 0) + 1);
    }
    completed++;
}

async function runBatch(start, size) {
    const promises = [];
    for (let i = 0; i < size; i++) {
        promises.push(sendRequest(start + i));
    }
    await Promise.all(promises);
}

console.log(`\n🚀 Starting Load Test: ${TOTAL_REQUESTS} requests with ${CONCURRENCY} concurrency\n`);

// Progress reporter
const reportInterval = setInterval(() => {
    const elapsed = (performance.now() - startTime) / 1000;
    const rps = completed / elapsed;
    const pct = ((completed / TOTAL_REQUESTS) * 100).toFixed(1);
    process.stdout.write(
        `\r⏱️  ${elapsed.toFixed(0)}s | ${pct}% | ✅ ${success} | ❌ ${failed} | ⚡ ${rps.toFixed(0)}/s`,
    );
}, 500);

// Run batches
let sent = 0;
while (sent < TOTAL_REQUESTS) {
    const batchSize = Math.min(CONCURRENCY, TOTAL_REQUESTS - sent);
    await runBatch(sent, batchSize);
    sent += batchSize;
}

clearInterval(reportInterval);

const duration = (performance.now() - startTime) / 1000;
const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
const sorted = latencies.sort((a, b) => a - b);
const p95 = sorted[Math.floor(sorted.length * 0.95)];
const p99 = sorted[Math.floor(sorted.length * 0.99)];

console.log(`\n\n${"=".repeat(60)}`);
console.log("📊 LOAD TEST RESULTS");
console.log("=".repeat(60));
console.log(`Total Requests: ${completed}`);
console.log(`Duration: ${duration.toFixed(2)}s`);
console.log(`Throughput: ${(completed / duration).toFixed(0)} req/sec`);
console.log(`Success: ${success} (${((success / completed) * 100).toFixed(1)}%)`);
console.log(`Failed: ${failed} (${((failed / completed) * 100).toFixed(1)}%)`);
console.log("-".repeat(60));
console.log("Latency (ms):");
console.log(`  Avg: ${avgLatency.toFixed(2)}`);
console.log(`  P95: ${p95.toFixed(2)}`);
console.log(`  P99: ${p99.toFixed(2)}`);
console.log(`  Max: ${Math.max(...latencies).toFixed(2)}`);
if (errors.size > 0) {
    console.log("-".repeat(60));
    console.log("Errors:");
    for (const [k, v] of errors) console.log(`  ${k}: ${v}`);
}
console.log("=".repeat(60));

// Verdict
if (success / completed > 0.99 && p95 < 1000) {
    console.log("\n✅ PASS - Excellent performance!");
} else if (success / completed > 0.95 && p95 < 3000) {
    console.log("\n⚠️  WARNING - Acceptable but could be better");
} else {
    console.log("\n❌ FAIL - System struggled under load");
}
console.log();
