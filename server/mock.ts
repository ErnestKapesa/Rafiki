import type { AgentEvent, AskRequest, Digest, NewsCategory, PageDigest, PageRead, RemixStyle } from "../shared/types.js";

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
    topic: /news|today|week/i.test(req.question) ? "news" : "general",
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
  yield {
    type: "quiz",
    quiz: {
      question: "Which NVIDIA model writes Rafiki's Deep Dive answers?",
      options: ["Nemotron Nano", "Nemotron Ultra", "Nemotron Super"],
      answer: 1,
      explain: "Deep Dive hands the full pages to Nemotron 3 Ultra for serious reasoning.",
    },
  };
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

/* ── Mocks for the reader, digest and remix endpoints ─────────────────── */

export function mockRead(url: string): PageRead {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "example.com";
    }
  })();
  const markdown = `# A friendly page from ${host}\n\nThis is **demo mode**, so Rafiki is showing a stand-in article instead of the real page.\n\n## What you'd normally see\n\nWith a Tavily key, the Reader pulls the page's real text, cleans away the ads and menus, and shows it right here — no pop-ups, no tab juggling.\n\n## Why it's nice\n\n- It works on every website, even ones that refuse to be embedded.\n- Nemotron writes a TL;DR at the top.\n- You can ask the page questions.\n\nVisiting a page also counts as discovering a new world — enjoy your XP!`;
  return { url, title: `A friendly page from ${host}`, markdown, embeddable: host.includes("wikipedia"), words: markdown.split(/\s+/).length };
}

export const mockDigestPage = (): PageDigest => ({
  summary: "This is a demo page explaining how Rafiki's Reader works. With real keys it summarises any article in two sentences.",
  points: ["The Reader shows clean article text", "It works even when sites block embedding", "Nemotron writes this TL;DR", "You can ask questions about the page"],
  minutes: 1,
});

export const mockAskPage = (q: string) => `Great question! In demo mode I can't read the real page, but with keys I'd answer **"${q.slice(0, 80)}"** using only what the page says.`;

const MOCK_HEADLINES: Record<NewsCategory, [string, string][]> = {
  world: [["Leaders agree on a new ocean clean-up plan", "Dozens of countries signed a plan to cut plastic reaching the sea by half. Funding will go to rivers and coastal cities first."], ["Record turnout in regional elections", "Voters showed up in huge numbers across several regions. Results are expected over the next two days."]],
  tech: [["NVIDIA releases a faster open Nemotron model", "A new open model promises quicker answers at lower cost. Developers can already try it on Nebius Token Factory."], ["Phones get smarter offline assistants", "New chips let voice assistants run without the internet. That means faster replies and more privacy."]],
  science: [["Telescope spots water on a distant planet", "Astronomers found signs of water vapour on a planet 120 light-years away. It is one of the smallest worlds where this has been seen."], ["Bees can count, new study suggests", "Researchers trained bees to pick the flower with the most dots. The bees got it right most of the time."]],
  business: [["Coffee prices dip after a strong harvest", "A bumper crop in several growing countries pushed prices down. Shoppers may notice cheaper beans in a few months."], ["Small businesses embrace AI helpers", "A new survey says half of small shops now use AI for everyday tasks. Most use it for writing and customer questions."]],
  africa: [["New rail link speeds up East African trade", "A cross-border railway opened, cutting cargo trips from days to hours. Farmers expect fresher produce to reach markets."], ["Solar mini-grids power thousands of homes", "Community solar projects switched on in rural villages. Schools and clinics are among the first to benefit."]],
  sports: [["Underdogs win a thrilling cup final", "A last-minute goal sealed a surprise victory. Fans celebrated late into the night."], ["Marathon record falls in perfect weather", "Cool temperatures helped a runner beat the course record by 40 seconds."]],
  health: [["Walking after meals helps blood sugar", "A short walk after eating can smooth out blood sugar spikes. Even ten minutes makes a difference."], ["New malaria vaccine rollout expands", "More countries are adding the vaccine to child immunisation programmes this year."]],
  culture: [["Animated film breaks box office records", "A family movie about a tiny robot had the biggest opening of the year."], ["Museums open free late nights for students", "Several major museums will stay open late with free entry for students this season."]],
};

export function mockDigest(cats: NewsCategory[]): Digest {
  const list = cats.length ? cats : (["world", "tech"] as NewsCategory[]);
  const stories = list.flatMap((c) =>
    MOCK_HEADLINES[c].map(([headline, summary], i) => ({
      id: `${c}-${i}`,
      category: c,
      headline,
      summary,
      why: "Demo mode — with real keys this line explains why the story matters to you.",
      image: `https://picsum.photos/seed/${c}${i}/800/500`,
      sources: [
        { id: 1, title: headline, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(c)}`, domain: "en.wikipedia.org", snippet: summary, score: 0.9, favicon: "https://www.google.com/s2/favicons?domain=wikipedia.org&sz=64" },
        { id: 2, title: `${headline} — analysis`, url: "https://www.bbc.com/news", domain: "bbc.com", snippet: summary, score: 0.8 },
      ],
    })),
  );
  return { date: new Date().toISOString().slice(0, 10), stories };
}

export async function* mockRemix(markdown: string, style: RemixStyle): AsyncIterable<AgentEvent> {
  const intro: Record<RemixStyle, string> = {
    simpler: "Imagine the internet is a giant library and I'm your library buddy! ",
    points: "",
    deeper: "## A closer look\n\n",
    views: "## Different ways to see it\n\n",
  };
  const body =
    style === "points"
      ? "- **Demo mode** is on right now [1]\n- **Nebius Token Factory** runs Nemotron for me [2]\n- **Tavily** lets me search the live web [3]\n- **Nano** plans, **Super** writes [4]\n- **Ultra** handles Deep Dives [4]"
      : intro[style] + markdown;
  for (const w of body.split(/(?<= )/)) {
    yield { type: "token", text: w };
    await sleep(12);
  }
  yield { type: "done" };
}
