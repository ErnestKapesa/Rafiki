import "./env.js";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AskRequest } from "../shared/types.js";
import { runAgent } from "./agent.js";
import { runMock } from "./mock.js";
import { models, resolveModels } from "./nebius.js";

/**
 * The HTTP API, shared by the local Node server (server/index.ts) and the
 * Vercel serverless function (api/[[...route]].ts).
 */
export const mock = process.env.RAFIKI_MOCK === "1" || !process.env.NEBIUS_API_KEY || !process.env.TAVILY_API_KEY;

// Resolve Nemotron ids against the Token Factory catalog once per process / cold start.
let ready: Promise<unknown> | null = null;
export const warmUp = () => (ready ??= mock ? Promise.resolve() : resolveModels());

export const app = new Hono();

app.get("/api/health", async (c) => {
  await warmUp();
  return c.json({ ok: true, mock, models });
});

app.post("/api/ask", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Partial<AskRequest>;
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return c.json({ error: "question is required" }, 400);
  const req: AskRequest = {
    question: question.slice(0, 1000),
    mode: body.mode === "deep" ? "deep" : "quick",
    history: Array.isArray(body.history)
      ? body.history
          .slice(-6)
          .filter((t) => (t?.role === "user" || t?.role === "assistant") && typeof t.content === "string")
          .map((t) => ({ role: t.role, content: t.content.slice(0, 2000) }))
      : [],
  };
  await warmUp();

  c.header("X-Accel-Buffering", "no"); // keep proxies from buffering the stream
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
