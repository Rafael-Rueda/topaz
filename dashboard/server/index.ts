import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

const app = new Hono();

const API_URL = process.env.TOPAZ_API_URL ?? "http://localhost:3333";

// Proxy API requests to the Topaz backend
app.all("/api/*", async (c) => {
    const path = c.req.path.replace(/^\/api/, "");
    const url = `${API_URL}${path}`;
    const headers = new Headers(c.req.raw.headers);
    headers.delete("host");

    const res = await fetch(url, {
        method: c.req.method,
        headers,
        body: ["GET", "HEAD"].includes(c.req.method) ? undefined : await c.req.raw.text(),
    });

    return new Response(res.body, {
        status: res.status,
        headers: res.headers,
    });
});

// Serve static files from Vite build output
app.use("/*", serveStatic({ root: "./dist" }));

// SPA fallback — serve index.html for all non-file routes
app.get("*", (c) => {
    const html = readFileSync(resolve("dist", "index.html"), "utf-8");
    return c.html(html);
});

const port = Number(process.env.DASHBOARD_PORT ?? 3001);

console.log(`Topaz Dashboard running at http://localhost:${port}`);

serve({ fetch: app.fetch, port });
