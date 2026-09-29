/**
 * Splits a streamed Nemotron completion into three channels:
 *   <think>…</think> → reasoning   <say>…</say> → spoken line   rest → markdown
 * Tags may arrive split across chunks at any byte, so we hold back text that
 * could still turn out to be the start of a tag.
 */
export type SplitOut =
  | { kind: "reasoning"; text: string }
  | { kind: "say"; text: string }
  | { kind: "body"; text: string };

export class StreamSplitter {
  private buf = "";
  private phase: "start" | "think" | "say" | "body" = "start";

  push(chunk: string): SplitOut[] {
    const out: SplitOut[] = [];
    this.buf += chunk;
    for (;;) {
      if (this.phase === "start") {
        const trimmed = this.buf.trimStart();
        if (trimmed.startsWith("<think>")) {
          this.buf = trimmed.slice(7);
          this.phase = "think";
        } else if (trimmed.startsWith("<say>")) {
          this.buf = trimmed.slice(5);
          this.phase = "say";
        } else if ("<think>".startsWith(trimmed.slice(0, 7)) || "<say>".startsWith(trimmed.slice(0, 5))) {
          break; // could still be the start of a tag — wait for more text
        } else {
          this.buf = trimmed;
          this.phase = "body";
        }
      } else if (this.phase === "think") {
        const end = this.buf.indexOf("</think>");
        if (end >= 0) {
          if (end > 0) out.push({ kind: "reasoning", text: this.buf.slice(0, end) });
          this.buf = this.buf.slice(end + 8);
          this.phase = "start";
        } else {
          const keep = this.buf.length - 8; // "</think>" might be split
          if (keep > 0) out.push({ kind: "reasoning", text: this.buf.slice(0, keep) });
          this.buf = this.buf.slice(Math.max(keep, 0));
          break;
        }
      } else if (this.phase === "say") {
        const end = this.buf.indexOf("</say>");
        if (end < 0) break;
        out.push({ kind: "say", text: this.buf.slice(0, end).trim() });
        this.buf = this.buf.slice(end + 6);
        this.phase = "start"; // skips the blank lines before the markdown
      } else {
        if (this.buf) out.push({ kind: "body", text: this.buf });
        this.buf = "";
        break;
      }
    }
    return out;
  }

  /** Flush whatever is left when the stream ends. */
  end(): SplitOut[] {
    const rest = this.buf;
    this.buf = "";
    if (this.phase === "say") return [{ kind: "say", text: rest.trim() }]; // tag never closed
    if (this.phase === "think") return rest ? [{ kind: "reasoning", text: rest }] : [];
    return rest.trim() ? [{ kind: "body", text: rest }] : [];
  }
}
