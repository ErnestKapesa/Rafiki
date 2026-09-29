import type { AgentEvent, AskRequest } from "../shared/types.ts";

// Canned run used when RAFIKI_MOCK=1 or no API keys are set, so the UI can be
// developed and demoed offline. Real runs go through ./agent.ts.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function* runMock(req: AskRequest): AsyncIterable<AgentEvent> {
  yield { type: "stage", stage: "plan", label: "Thinking about how to look this up", model: "mock/nemotron-nano" };
  await sleep(500);
  yield {
    type: "plan",
    intent: "search",
    queries: [req.question, `${req.question} latest news`, `${req.question} explained`],
    mood: "excited",
    emoji: "🪐",
  };
  yield { type: "stage", stage: "search", label: "Exploring 3 trails across the web" };
  await sleep(700);
  const domains = ["nvidia.com", "nebius.com", "wikipedia.org", "arxiv.org", "theverge.com", "github.com", "nature.com"];
  yield {
    type: "sources",
    sources: domains.map((d, i) => ({
      id: i + 1,
      title: `${["Inside", "Why", "How", "A guide to", "The story of", "Understanding", "What's next for"][i]} ${req.question}`,
      url: `https://${d}/`,
      domain: d,
      snippet: "Mock mode: set NEBIUS_API_KEY and TAVILY_API_KEY in .env to get real results from the web.",
      favicon: `https://www.google.com/s2/favicons?domain=${d}&sz=64`,
      score: 0.9 - i * 0.07,
    })),
  };
  yield {
    type: "images",
    images: [1, 2, 3, 4, 5].map((n) => ({ url: `https://picsum.photos/seed/rafiki${n}/600/400`, description: "A picture from the web" })),
  };
  yield { type: "stage", stage: "write", label: "Putting it together", model: "mock/nemotron-super" };
  await sleep(400);
  const say = `Ooh, great question! Here's what I found about ${req.question}.`;
  yield { type: "say", text: say };
  const body = `This is **mock mode**, so I'm not really on the internet right now [1].\n\n- Add your **Nebius Token Factory** key to run me on NVIDIA Nemotron [2]\n- Add a **Tavily** key so I can search the live web [3]\n\nOnce both are set I'll plan queries with *Nemotron Nano*, search in parallel, and write cited answers with *Nemotron Super* — or *Ultra* in Deep Dive [4].`;
  for (const word of body.split(/(?<= )/)) {
    yield { type: "token", text: word };
    await sleep(25);
  }
  yield { type: "related", questions: ["How does Nemotron reasoning work?", "What is Nebius Token Factory?", "Show me today's AI news"] };
  yield {
    type: "metrics",
    steps: [
      { step: "Plan", model: "mock/nemotron-nano", ms: 500 },
      { step: "Search ×3", model: "Tavily", ms: 700 },
      { step: "Answer", model: "mock/nemotron-super", ms: 1400 },
    ],
  };
  yield { type: "stage", stage: "done", label: "Done" };
  yield { type: "done" };
}
