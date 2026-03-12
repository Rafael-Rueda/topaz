// Mini API de teste para receber webhooks do Topaz
// Roda em http://localhost:4000
// Endpoint: POST /webhooks/stripe

import { createServer } from "node:http";

const PORT = 4000;

const server = createServer((req, res) => {
    const timestamp = new Date().toISOString();

    console.log(`\n[${timestamp}] ${req.method} ${req.url}`);
    console.log("Headers:", JSON.stringify(req.headers, null, 2));

    if (req.method === "POST" && req.url === "/webhooks/stripe") {
        let body = "";

        req.on("data", (chunk) => {
            body += chunk.toString();
        });

        req.on("end", () => {
            try {
                const data = JSON.parse(body);
                console.log("Body:", JSON.stringify(data, null, 2));

                // Responde com sucesso (200 OK)
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ received: true, timestamp }));

                console.log("✅ Respondido com 200 OK\n");
            } catch (err) {
                console.log("Body (raw):", body);
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid JSON" }));
            }
        });
    } else if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
    } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
    }
});

server.listen(PORT, () => {
    console.log(`🎯 Target API rodando em http://localhost:${PORT}`);
    console.log(`   POST http://localhost:${PORT}/webhooks/stripe`);
    console.log(`   GET  http://localhost:${PORT}/health`);
    console.log("\nPronto para receber webhooks do Topaz!\n");
});
