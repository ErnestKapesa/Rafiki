import "./env.js";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AskRequest, NewsCategory, RemixStyle, Source } from "../shared/types.js";
import { runAgent } from "./agent.js";
import { askPage, digestPage, newsDigest, NEWS_QUERIES, publicUrl, readPage, remixAnswer } from "./features.js";
import { mockAskPage, mockDigest, mockDigestPage, mockRead, mockRemix, runMock } from "./mock.js";
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

/* ── Reader: clean article text + can-it-be-iframed probe ─────────────── */
app.post("/api/read", async (c) => {
  const { url } = (await c.req.json().catch(() => ({}))) as { url?: string };
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return c.json({ error: "That link can't be opened here." }, 400);
  if (mock) return c.json(mockRead(url));
  if (!(await publicUrl(url))) return c.json({ error: "That link can't be opened here." }, 400);
  const page = await readPage(url);
  if (!page) return c.json({ error: "That link can't be opened here." }, 400);
  return c.json(page);
});

/* ── Page TL;DR and "ask this page" ───────────────────────────────────── */
app.post("/api/page", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { markdown?: string; mode?: string; question?: string };
  const md = typeof body.markdown === "string" ? body.markdown.slice(0, 24_000) : "";
  if (!md.trim()) return c.json({ error: "Nothing to read on that page." }, 400);
  await warmUp();
  if (body.mode === "ask") {
    const q = typeof body.question === "string" ? body.question.trim() : "";
    if (!q) return c.json({ error: "question is required" }, 400);
    return c.json({ answer: mock ? mockAskPage(q) : await askPage(md, q) });
  }
  return c.json(mock ? mockDigestPage() : await digestPage(md));
});

/* ── Daily news digest ────────────────────────────────────────────────── */
app.post("/api/digest", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { categories?: unknown };
  const cats = (Array.isArray(body.categories) ? body.categories : []).filter((x): x is NewsCategory => typeof x === "string" && x in NEWS_QUERIES);
  await warmUp();
  try {
    return c.json(mock ? mockDigest(cats) : await newsDigest(cats));
  } catch (err) {
    return c.json({ error: (err as Error).message }, 502);
  }
});

/* ── Remix an answer (same sources, new telling), streamed ────────────── */
const STYLES: RemixStyle[] = ["simpler", "points", "deeper", "views"];
app.post("/api/remix", async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { question?: string; markdown?: string; sources?: Source[]; style?: RemixStyle };
  if (!b.style || !STYLES.includes(b.style) || typeof b.markdown !== "string" || typeof b.question !== "string") return c.json({ error: "bad request" }, 400);
  const sources = (Array.isArray(b.sources) ? b.sources : [])
    .slice(0, 12)
    .map((s, i) => ({
      id: Number(s?.id) || i + 1,
      title: String(s?.title ?? "").slice(0, 300),
      url: String(s?.url ?? ""),
      domain: String(s?.domain ?? "").slice(0, 100),
      snippet: String(s?.snippet ?? "").slice(0, 1200),
      score: 0,
    }));
  await warmUp();
  c.header("X-Accel-Buffering", "no");
  return streamSSE(c, async (stream) => {
    const ac = new AbortController();
    stream.onAbort(() => ac.abort());
    try {
      const events = mock ? mockRemix(b.markdown!, b.style!) : remixAnswer({ question: b.question!.slice(0, 1000), markdown: b.markdown!, sources, style: b.style! }, ac.signal);
      for await (const ev of events) await stream.writeSSE({ data: JSON.stringify(ev) });
    } catch (err) {
      await stream.writeSSE({ data: JSON.stringify({ type: "error", message: (err as Error).message }) });
      await stream.writeSSE({ data: JSON.stringify({ type: "done" }) });
    }
  });
});
