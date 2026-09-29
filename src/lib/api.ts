import type { AgentEvent, AskRequest, Digest, NewsCategory, PageDigest, PageRead, RemixStyle, Source } from "../../shared/types";

async function post(path: string, body: unknown, signal?: AbortSignal, attempt = 0): Promise<Response> {
  try {
    return await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (err) {
    // Wi-Fi hiccups (ERR_NETWORK_CHANGED etc.) — retry twice with a short backoff.
    if (signal?.aborted || attempt >= 2) throw err;
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    return post(path, body, signal, attempt + 1);
  }
}

async function json<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await post(path, body, signal);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Server said ${res.status}`);
  return data as T;
}

/** POST and parse a Server-Sent Events stream of AgentEvents. */
async function sse(path: string, body: unknown, onEvent: (e: AgentEvent) => void, signal?: AbortSignal) {
  const res = await post(path, body, signal);
  if (!res.ok || !res.body) {
    onEvent({ type: "error", message: `Server said ${res.status}` });
    onEvent({ type: "done" });
    return;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const data = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) onEvent(JSON.parse(data) as AgentEvent);
    }
  }
}

export const ask = (req: AskRequest, onEvent: (e: AgentEvent) => void, signal?: AbortSignal) => sse("/api/ask", req, onEvent, signal);

export const remix = (
  body: { question: string; markdown: string; sources: Source[]; style: RemixStyle },
  onEvent: (e: AgentEvent) => void,
  signal?: AbortSignal,
) => sse("/api/remix", body, onEvent, signal);

export const readPage = (url: string, signal?: AbortSignal) => json<PageRead>("/api/read", { url }, signal);
export const pageTldr = (markdown: string, signal?: AbortSignal) => json<PageDigest>("/api/page", { markdown, mode: "tldr" }, signal);
export const askPage = (markdown: string, question: string) => json<{ answer: string }>("/api/page", { markdown, mode: "ask", question });
export const getDigest = (categories: NewsCategory[], signal?: AbortSignal) => json<Digest>("/api/digest", { categories }, signal);
