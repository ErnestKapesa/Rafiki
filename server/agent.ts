import type OpenAI from "openai";
import type { AgentEvent, AskRequest, Mood, Quiz, Source, StepMetric, WebImage } from "../shared/types.ts";
import { models, nebius, parseJson, type Tier } from "./nebius.ts";
import { StreamSplitter, type SplitOut } from "./splitter.ts";
import { tavilyExtract, tavilySearch, type TavilyResult } from "./tavily.ts";

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const PERSONA = `You are Rafiki ("friend" in Swahili) — a small, warm, endlessly curious alien companion who lives on a tiny planet and explores the internet for your human. You are upbeat but never fake, concise, and you care about getting facts right.`;

// Nemotron exposes a reasoning on/off switch through the chat template. Some
// deployments reject unknown params, so we remember if it fails and stop sending it.
let thinkToggleSupported = true;

async function chat(
  tier: Tier,
  messages: Msg[],
  opts: { think: boolean; maxTokens?: number; temperature?: number },
) {
  const base = {
    model: models[tier],
    messages,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.4,
  };
  if (thinkToggleSupported) {
    try {
      return await nebius.chat.completions.create({
        ...base,
        // @ts-expect-error — vendor extension understood by Nemotron chat templates
        chat_template_kwargs: { enable_thinking: opts.think },
      });
    } catch (err) {
      if ((err as { status?: number }).status !== 400) throw err;
      thinkToggleSupported = false;
    }
  }
  return nebius.chat.completions.create(base);
}

async function chatStream(tier: Tier, messages: Msg[], opts: { think: boolean; maxTokens?: number }) {
  const base = {
    model: models[tier],
    messages,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: 0.5,
    stream: true as const,
    stream_options: { include_usage: true },
  };
  if (thinkToggleSupported) {
    try {
      return await nebius.chat.completions.create({
        ...base,
        // @ts-expect-error — vendor extension understood by Nemotron chat templates
        chat_template_kwargs: { enable_thinking: opts.think },
      });
    } catch (err) {
      if ((err as { status?: number }).status !== 400) throw err;
      thinkToggleSupported = false;
    }
  }
  return nebius.chat.completions.create(base);
}

/* ------------------------------------------------------------------------ */
/* Tiny async channel so parallel steps can emit events into one SSE stream */
/* ------------------------------------------------------------------------ */
function channel<T>() {
  const queue: T[] = [];
  let wake: (() => void) | null = null;
  let closed = false;
  return {
    push(v: T) {
      queue.push(v);
      wake?.();
    },
    close() {
      closed = true;
      wake?.();
    },
    async *drain() {
      while (true) {
        if (queue.length) {
          yield queue.shift()!;
          continue;
        }
        if (closed) return;
        await new Promise<void>((r) => (wake = r));
        wake = null;
      }
    },
  };
}

type Plan = {
  intent: "search" | "chat";
  queries: string[];
  topic: "general" | "news";
  time_range: "day" | "week" | "month" | "year" | null;
  mood: Mood;
  emoji: string;
};

const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export function runAgent(req: AskRequest, signal?: AbortSignal): AsyncIterable<AgentEvent> {
  const ch = channel<AgentEvent>();
  const emit = (e: AgentEvent) => {
    if (!signal?.aborted) ch.push(e);
  };
  pipeline(req, emit, signal)
    .catch((err) => emit({ type: "error", message: (err as Error).message ?? String(err) }))
    .finally(() => {
      emit({ type: "done" });
      ch.close();
    });
  return ch.drain();
}

async function pipeline(req: AskRequest, emit: (e: AgentEvent) => void, signal?: AbortSignal) {
  const deep = req.mode === "deep";
  const metrics: StepMetric[] = [];
  const history: Msg[] = (req.history ?? []).slice(-6).map((t) => ({ role: t.role, content: t.content }));
  const today = new Date().toISOString().slice(0, 10);

  /* 1. PLAN — Nemotron Nano decides whether to search and writes the queries. */
  emit({ type: "stage", stage: "plan", label: "Thinking about how to look this up", model: models.fast });
  let t0 = Date.now();
  const planRes = await chat(
    "fast",
    [
      {
        role: "system",
        content: `You are the planning brain of a web-search companion. Today is ${today}.
Return ONLY a JSON object:
{"intent":"search"|"chat","queries":[string],"topic":"general"|"news","time_range":null|"day"|"week"|"month"|"year","mood":"curious"|"excited"|"serious"|"playful"|"calm","emoji":string}
- intent "chat" only for greetings/small talk about Rafiki itself; anything factual → "search".
- queries: ${deep ? "3-4" : "1-3"} diverse, specific web search queries (resolve pronouns using the conversation).
- topic "news" for current events. time_range when recency matters.
- mood: the emotional tone Rafiki should react with. emoji: one emoji capturing the topic.`,
      },
      ...history,
      { role: "user", content: req.question },
    ],
    { think: false, maxTokens: 400, temperature: 0.2 },
  );
  const plan: Plan = {
    intent: "search",
    queries: [req.question],
    topic: "general",
    time_range: null,
    mood: "curious",
    emoji: "🔭",
    ...(parseJson<Partial<Plan>>(planRes.choices[0]?.message?.content ?? "") ?? {}),
  };
  if (!plan.queries?.length) plan.queries = [req.question];
  plan.queries = plan.queries.slice(0, deep ? 4 : 3);
  metrics.push({ step: "Plan", model: models.fast, ms: Date.now() - t0, tokens: planRes.usage?.total_tokens });
  if (plan.topic !== "news") plan.topic = "general";
  emit({ type: "plan", intent: plan.intent, queries: plan.queries, mood: plan.mood, emoji: plan.emoji, topic: plan.topic });
  if (signal?.aborted) return;

  /* 2. SEARCH — fan the queries out to Tavily in parallel. */
  let sources: Source[] = [];
  let images: WebImage[] = [];
  let raw = new Map<string, string>();
  if (plan.intent === "search") {
    emit({ type: "stage", stage: "search", label: `Exploring ${plan.queries.length} trails across the web` });
    t0 = Date.now();
    const settled = await Promise.allSettled(
      plan.queries.map((q) =>
        tavilySearch(q, {
          depth: deep ? "advanced" : "basic",
          topic: plan.topic,
          timeRange: plan.time_range ?? undefined,
          maxResults: deep ? 7 : 5,
        }),
      ),
    );
    const byUrl = new Map<string, TavilyResult>();
    const imgSeen = new Set<string>();
    for (const s of settled) {
      if (s.status !== "fulfilled") continue;
      for (const r of s.value.results) {
        const prev = byUrl.get(r.url);
        if (!prev || prev.score < r.score) byUrl.set(r.url, r);
      }
      for (const img of s.value.images ?? []) {
        const i = typeof img === "string" ? { url: img } : img;
        if (!imgSeen.has(i.url)) {
          imgSeen.add(i.url);
          images.push(i);
        }
      }
    }
    if (!byUrl.size) {
      const firstErr = settled.find((s) => s.status === "rejected") as PromiseRejectedResult | undefined;
      if (firstErr) throw firstErr.reason;
    }
    sources = [...byUrl.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, deep ? 12 : 8)
      .map((r, i) => ({
        id: i + 1,
        title: r.title,
        url: r.url,
        domain: domainOf(r.url),
        snippet: r.content,
        favicon: r.favicon,
        score: r.score,
        published: r.published_date,
      }));
    images = images.slice(0, 10);
    metrics.push({ step: `Search ×${plan.queries.length}`, model: "Tavily", ms: Date.now() - t0 });
    emit({ type: "sources", sources });
    if (images.length) emit({ type: "images", images });

    /* 2b. READ — in Deep Dive, pull the full text of the best pages. */
    if (deep && sources.length) {
      emit({ type: "stage", stage: "read", label: "Reading the most promising pages in full" });
      t0 = Date.now();
      const pages = await tavilyExtract(sources.slice(0, 4).map((s) => s.url)).catch(() => []);
      raw = new Map(pages.map((p) => [p.url, p.raw_content.slice(0, 7000)]));
      metrics.push({ step: `Extract ×${pages.length}`, model: "Tavily", ms: Date.now() - t0 });
    }
  }
  if (signal?.aborted) return;

  /* 3. Follow-up questions — Nano, running in parallel with the answer. */
  const relatedP = (async () => {
    const t = Date.now();
    const res = await chat(
      "fast",
      [
        {
          role: "system",
          content:
            'Suggest 3 short, intriguing follow-up questions (max 8 words each) a curious person would ask next. Return ONLY JSON: {"questions":[string,string,string]}',
        },
        {
          role: "user",
          content: `Question: ${req.question}\nSources: ${sources.map((s) => s.title).join(" | ") || "none"}`,
        },
      ],
      { think: false, maxTokens: 200, temperature: 0.8 },
    );
    const q = parseJson<{ questions: string[] }>(res.choices[0]?.message?.content ?? "")?.questions ?? [];
    metrics.push({ step: "Follow-ups", model: models.fast, ms: Date.now() - t, tokens: res.usage?.total_tokens });
    if (q.length) emit({ type: "related", questions: q.slice(0, 3) });
  })().catch(() => {});

  /* 4. WRITE — Nemotron Super (or Ultra in Deep Dive) synthesises a cited answer. */
  const tier: Tier = deep ? "deep" : "smart";
  emit({ type: "stage", stage: "write", label: deep ? "Reasoning it all through" : "Putting it together", model: models[tier] });
  t0 = Date.now();
  const context = sources
    .map((s) => {
      const body = raw.get(s.url) ?? s.snippet;
      return `[${s.id}] ${s.title} (${s.domain}${s.published ? `, ${s.published}` : ""})\n${body.slice(0, deep ? 7000 : 900)}`;
    })
    .join("\n\n");

  const stream = await chatStream(
    tier,
    [
      {
        role: "system",
        content: `${PERSONA}
Today is ${today}. Your mood right now: ${plan.mood}.
Respond in EXACTLY this format:
<say>One or two short, natural spoken sentences that directly answer — this is read aloud by your voice, so no markdown, no citations, no URLs, no lists.</say>
Then a well-structured markdown answer: ${deep ? "a thorough briefing with ## headings, key numbers, differing viewpoints, and a short 'Bottom line'" : "a crisp answer (≈120-200 words), bullets where helpful, **bold** key facts"}.
${sources.length ? "Cite sources inline as [n] using the numbered sources below — only cite what the sources support. If the sources disagree or are thin, say so honestly." : "No web sources were needed; just chat warmly and briefly."}`,
      },
      ...history,
      { role: "user", content: sources.length ? `Question: ${req.question}\n\nSources:\n${context}` : req.question },
    ],
    { think: deep, maxTokens: deep ? 4096 : 1500 },
  );

  // Route <think> → reasoning, <say> → voice, everything else → markdown.
  const splitter = new StreamSplitter();
  let tokens: number | undefined;
  let bodyText = "";
  const route = (parts: SplitOut[]) => {
    for (const p of parts) {
      if (p.kind === "reasoning") emit({ type: "reasoning", text: p.text });
      else if (p.kind === "say") emit({ type: "say", text: p.text });
      else {
        bodyText += p.text;
        emit({ type: "token", text: p.text });
      }
    }
  };

  for await (const chunk of stream) {
    if (signal?.aborted) {
      stream.controller.abort();
      return;
    }
    if (chunk.usage) tokens = chunk.usage.total_tokens;
    const delta = chunk.choices[0]?.delta as { content?: string | null; reasoning_content?: string | null } | undefined;
    if (delta?.reasoning_content) emit({ type: "reasoning", text: delta.reasoning_content });
    if (delta?.content) route(splitter.push(delta.content));
  }
  route(splitter.end());

  metrics.push({ step: deep ? "Deep answer" : "Answer", model: models[tier], ms: Date.now() - t0, tokens });

  /* 5. POP QUIZ — Nano turns the answer into one question for bonus XP. */
  const answerText = bodyText.trim();
  const quizP =
    sources.length && answerText.length > 80
      ? (async () => {
          const t = Date.now();
          const res = await chat(
            "fast",
            [
              {
                role: "system",
                content:
                  'Write ONE fun multiple-choice question that checks understanding of the text. It must be answerable from the text alone. Return ONLY JSON: {"question":string,"options":[string,string,string],"answer":0|1|2,"explain":string}. Options under 8 words; explain in one short friendly sentence.',
              },
              { role: "user", content: answerText.replace(/\[\d+\]/g, "").slice(0, 4000) },
            ],
            { think: false, maxTokens: 300, temperature: 0.6 },
          );
          const q = parseJson<Quiz>(res.choices[0]?.message?.content ?? "");
          metrics.push({ step: "Pop quiz", model: models.fast, ms: Date.now() - t, tokens: res.usage?.total_tokens });
          if (q && validQuiz(q)) emit({ type: "quiz", quiz: shuffleQuiz(q) });
        })().catch(() => {})
      : Promise.resolve();

  await Promise.all([relatedP, quizP]);
  emit({ type: "metrics", steps: metrics });
  emit({ type: "stage", stage: "done", label: "Done" });
}

function validQuiz(q: Quiz) {
  return (
    typeof q.question === "string" &&
    Array.isArray(q.options) &&
    q.options.length === 3 &&
    q.options.every((o) => typeof o === "string" && o.trim()) &&
    Number.isInteger(q.answer) &&
    q.answer >= 0 &&
    q.answer < 3
  );
}

/** Models love putting the right answer first — shuffle so it isn't guessable. */
export function shuffleQuiz(q: Quiz, rand = Math.random): Quiz {
  const order = [0, 1, 2].sort(() => rand() - 0.5);
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer), explain: q.explain ?? "" };
}
