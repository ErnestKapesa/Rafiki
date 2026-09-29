import "./env.ts";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AskRequest } from "../shared/types.ts";
import { runAgent } from "./agent.ts";
import { runMock } from "./mock.ts";
import { models, resolveModels } from "./nebius.ts";

const mock = process.env.RAFIKI_MOCK === "1" || !process.env.NEBIUS_API_KEY || !process.env.TAVILY_API_KEY;
const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true, mock, models }));

app.post("/api/ask", async (c) => {
  const body = (await c.req.json()) as AskRequest;
  const question = body.question?.trim();
  if (!question) return c.json({ error: "question is required" }, 400);
  const req: AskRequest = {
    question: question.slice(0, 1000),
    mode: body.mode === "deep" ? "deep" : "quick",
    history: Array.isArray(body.history) ? body.history.slice(-6) : [],
  };

  return streamSSE(c, async (stream) => {
    const ac = new AbortController();
    stream.onAbort(() => ac.abort());
    const events = mock ? runMock(req) : runAgent(req, ac.signal);
    for await (const ev of events) {
      if (ac.signal.aborted) break;
      await stream.writeSSE({ data: JSON.stringify(ev) });
    }
  });
});

if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

const port = Number(process.env.PORT || 8787);
if (!mock) await resolveModels();
serve({ fetch: app.fetch, port }, () => {
  console.log(`🪐 Rafiki agent on http://localhost:${port} ${mock ? "(MOCK MODE — add keys to .env)" : ""}`);
  console.log(`   fast=${models.fast}\n   smart=${models.smart}\n   deep=${models.deep}`);
});
