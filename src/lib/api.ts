import type { AgentEvent, AskRequest } from "../../shared/types";

/** POST /api/ask and parse the Server-Sent Events stream. */
async function post(req: AskRequest, signal?: AbortSignal, attempt = 0): Promise<Response> {
  try {
    return await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
      signal,
    });
  } catch (err) {
    // Wi-Fi hiccups (ERR_NETWORK_CHANGED etc.) — retry twice with a short backoff.
    if (signal?.aborted || attempt >= 2) throw err;
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    return post(req, signal, attempt + 1);
  }
}

export async function ask(req: AskRequest, onEvent: (e: AgentEvent) => void, signal?: AbortSignal) {
  const res = await post(req, signal);
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
