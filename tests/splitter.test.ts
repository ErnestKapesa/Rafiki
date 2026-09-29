import { describe, expect, it } from "vitest";
import { shuffleQuiz } from "../server/agent";
import { StreamSplitter, type SplitOut } from "../server/splitter";

function run(chunks: string[]) {
  const s = new StreamSplitter();
  const out: SplitOut[] = [];
  for (const c of chunks) out.push(...s.push(c));
  out.push(...s.end());
  const join = (k: SplitOut["kind"]) => out.filter((o) => o.kind === k).map((o) => o.text).join("");
  return { reasoning: join("reasoning"), say: join("say"), body: join("body") };
}

const full = "<think>weigh sources</think>\n<say>Black holes leak away.</say>\n\nThey **evaporate** [1].";

describe("StreamSplitter", () => {
  it("handles one big chunk", () => {
    expect(run([full])).toEqual({ reasoning: "weigh sources", say: "Black holes leak away.", body: "They **evaporate** [1]." });
  });

  it("gives identical output however the stream is chopped", () => {
    for (let size = 1; size <= 9; size++) {
      const chunks = full.match(new RegExp(`[\\s\\S]{1,${size}}`, "g"))!;
      expect(run(chunks), `chunk size ${size}`).toEqual(run([full]));
    }
  });

  it("works without think or say", () => {
    expect(run(["Just ", "markdown ", "here."])).toEqual({ reasoning: "", say: "", body: "Just markdown here." });
  });

  it("does not swallow text that merely starts with <", () => {
    expect(run(["<b>bold</b> text"]).body).toBe("<b>bold</b> text");
  });

  it("recovers from an unclosed <say>", () => {
    expect(run(["<say>Hello there"])).toEqual({ reasoning: "", say: "Hello there", body: "" });
  });
});

describe("shuffleQuiz", () => {
  it("keeps the correct option pointed at by answer", () => {
    for (let i = 0; i < 20; i++) {
      const q = shuffleQuiz({ question: "?", options: ["right", "wrong a", "wrong b"], answer: 0, explain: "" });
      expect(q.options[q.answer]).toBe("right");
      expect([...q.options].sort()).toEqual(["right", "wrong a", "wrong b"]);
    }
  });
});
