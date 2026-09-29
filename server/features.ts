import { lookup } from "node:dns/promises";
import net from "node:net";
import type OpenAI from "openai";
import type { AgentEvent, Digest, NewsCategory, NewsStory, PageDigest, PageRead, RemixStyle, Source } from "../shared/types.js";
import { chat, chatStream } from "./agent.js";
import { parseJson } from "./nebius.js";
import { StreamSplitter } from "./splitter.js";
import { tavilyExtract, tavilySearch } from "./tavily.js";

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/* ────────────────────────────────────────────────────────────────────── */
/* URL safety (the embeddability probe fetches user-supplied URLs)        */
/* ────────────────────────────────────────────────────────────────────── */

function privateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return privateIp(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb");
}

/** Only public http(s) URLs — blocks localhost, private ranges and metadata IPs (SSRF). */
export async function publicUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) return null;
  if (net.isIP(host)) return privateIp(host) ? null : u;
  try {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => privateIp(a.address))) return null;
  } catch {
    return null;
  }
  return u;
}

/** Can this page be shown in an <iframe>? Checks X-Frame-Options and CSP frame-ancestors. */
async function embeddable(start: URL): Promise<boolean> {
  if (start.protocol !== "https:") return false; // mixed content would be blocked anyway
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; RafikiReader/1.0)", accept: "text/html" },
    }).catch(() => null);
    if (!res) return false;
    res.body?.cancel().catch(() => {});
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      const safe = next ? await publicUrl(new URL(next, url).toString()) : null;
      if (!safe || safe.protocol !== "https:") return false;
      url = safe;
      continue;
    }
    if (!res.ok) return false;
    const xfo = (res.headers.get("x-frame-options") ?? "").toLowerCase();
    if (xfo.includes("deny") || xfo.includes("sameorigin")) return false;
    const csp = (res.headers.get("content-security-policy") ?? "").toLowerCase();
    const fa = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("frame-ancestors"));
    if (fa && !/\s(\*|https:)(\s|$)/.test(fa + " ")) return false;
    return true;
  }
  return false;
}

/* ────────────────────────────────────────────────────────────────────── */
/* Reader                                                                  */
/* ────────────────────────────────────────────────────────────────────── */

export async function readPage(raw: string): Promise<PageRead | null> {
  const u = await publicUrl(raw);
  if (!u) return null;
  const [pages, canFrame] = await Promise.all([tavilyExtract([u.toString()]).catch(() => []), embeddable(u).catch(() => false)]);
  const md = (pages[0]?.raw_content ?? "").slice(0, 24_000);
  const title = md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? u.hostname.replace(/^www\./, "");
  return { url: u.toString(), title, markdown: md, embeddable: canFrame, words: md.split(/\s+/).filter(Boolean).length };
}

export async function digestPage(markdown: string): Promise<PageDigest> {
  const words = markdown.split(/\s+/).length;
  const res = await chat(
    "fast",
    [
      {
        role: "system",
        content:
          'Summarise the web page for a busy, curious reader. Return ONLY JSON: {"summary": string (2 sentences), "points": [3-5 short key points, each under 18 words]}. Use only facts in the page.',
      },
      { role: "user", content: markdown.slice(0, 12_000) },
    ],
    { think: false, maxTokens: 500, temperature: 0.3 },
  );
  const d = parseJson<{ summary: string; points: string[] }>(res.choices[0]?.message?.content ?? "");
  return { summary: d?.summary ?? "", points: (d?.points ?? []).slice(0, 5), minutes: Math.max(1, Math.round(words / 220)) };
}

export async function askPage(markdown: string, question: string): Promise<string> {
  const res = await chat(
    "fast",
    [
      {
        role: "system",
        content: "Answer the question using ONLY the web page below. Be brief and friendly (≤ 90 words, markdown allowed). If the page doesn't say, answer: \"This page doesn't say — try asking Rafiki to search!\"",
      },
      { role: "user", content: `PAGE:\n${markdown.slice(0, 12_000)}\n\nQUESTION: ${question.slice(0, 400)}` },
    ],
    { think: false, maxTokens: 400, temperature: 0.3 },
  );
  return (res.choices[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/* ────────────────────────────────────────────────────────────────────── */
/* Daily news digest                                                       */
/* ────────────────────────────────────────────────────────────────────── */

export const NEWS_QUERIES: Record<NewsCategory, string> = {
  world: "top world news today",
  tech: "technology and artificial intelligence news today",
  science: "science and space news today",
  business: "business, economy and markets news today",
  africa: "Africa news today",
  sports: "sports news today",
  health: "health and medicine news today",
  culture: "entertainment, arts and culture news today",
};

const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const digestCache = new Map<string, { at: number; data: Digest }>();

export async function newsDigest(categories: NewsCategory[]): Promise<Digest> {
  const cats = [...new Set(categories)].filter((c) => c in NEWS_QUERIES).slice(0, 6);
  if (!cats.length) cats.push("world", "tech");
  const key = cats.slice().sort().join(",");
  const hit = digestCache.get(key);
  if (hit && Date.now() - hit.at < 15 * 60_000) return hit.data;

  const settled = await Promise.allSettled(
    cats.map((c) => tavilySearch(NEWS_QUERIES[c], { topic: "news", timeRange: "day", maxResults: 6, depth: "fast" })),
  );
  const pool = new Map<string, Source & { category: NewsCategory }>();
  const images = new Map<NewsCategory, string[]>();
  settled.forEach((s, i) => {
    if (s.status !== "fulfilled") return;
    const cat = cats[i];
    images.set(
      cat,
      (s.value.images ?? []).map((im) => (typeof im === "string" ? im : im.url)),
    );
    s.value.results.forEach((r, j) => {
      const ref = `${cat}-${j + 1}`;
      pool.set(ref, { id: 0, title: r.title, url: r.url, domain: domainOf(r.url), snippet: r.content, favicon: r.favicon, score: r.score, published: r.published_date, category: cat });
    });
  });
  if (!pool.size) {
    const err = settled.find((s) => s.status === "rejected") as PromiseRejectedResult | undefined;
    throw err?.reason ?? new Error("No news found right now");
  }

  const listing = [...pool.entries()].map(([ref, s]) => `[${ref}] ${s.title} — ${s.domain}${s.published ? ` (${s.published})` : ""}\n${s.snippet.slice(0, 380)}`).join("\n\n");
  const today = new Date().toISOString().slice(0, 10);
  let stories: NewsStory[] = [];
  try {
    const res = await chat(
      "smart",
      [
        {
          role: "system",
          content: `You are the editor of a friendly daily news digest (${today}). From the articles below, pick the 2 most important DISTINCT stories per category (${cats.join(", ")}). Merge articles about the same story.
Return ONLY JSON: {"stories":[{"category": one of ${JSON.stringify(cats)}, "headline": string (≤ 12 words, no clickbait), "summary": string (2 clear sentences), "why": string (1 sentence: why it matters to a regular person), "refs": [article ids like "tech-2"]}]}
Only use facts present in the articles.`,
        },
        { role: "user", content: listing },
      ],
      { think: false, maxTokens: 2200, temperature: 0.3 },
    );
    const parsed = parseJson<{ stories: { category: NewsCategory; headline: string; summary: string; why: string; refs: string[] }[] }>(res.choices[0]?.message?.content ?? "");
    stories = (parsed?.stories ?? [])
      .filter((s) => s.headline && s.summary && cats.includes(s.category))
      .map((s, i) => ({
        id: `${s.category}-${i}`,
        category: s.category,
        headline: s.headline,
        summary: s.summary,
        why: s.why ?? "",
        sources: (s.refs ?? []).map((r) => pool.get(r)).filter((x): x is Source & { category: NewsCategory } => !!x),
      }));
  } catch {
    /* fall back to raw headlines below */
  }
  if (!stories.length) {
    // Model unavailable → still ship a digest straight from the top results.
    stories = cats.flatMap((c) =>
      [1, 2]
        .map((j) => pool.get(`${c}-${j}`))
        .filter((s): s is Source & { category: NewsCategory } => !!s)
        .map((s, j) => ({ id: `${c}-${j}`, category: c, headline: s.title, summary: s.snippet.slice(0, 260), why: "", sources: [s] })),
    );
  }
  // Number sources per story and attach a picture from that category's image results.
  const used = new Map<NewsCategory, number>();
  for (const st of stories) {
    st.sources = st.sources.slice(0, 4).map((s, i) => ({ ...s, id: i + 1 }));
    const n = used.get(st.category) ?? 0;
    st.image = images.get(st.category)?.[n];
    used.set(st.category, n + 1);
  }
  const data = { date: today, stories: stories.slice(0, 12) };
  digestCache.set(key, { at: Date.now(), data });
  return data;
}

/* ────────────────────────────────────────────────────────────────────── */
/* Answer remix — same sources, different telling                           */
/* ────────────────────────────────────────────────────────────────────── */

const REMIX: Record<RemixStyle, string> = {
  simpler: "Rewrite the answer for a curious 10-year-old: short sentences, everyday words, one friendly analogy. About 120 words.",
  points: "Rewrite as exactly 5 punchy key takeaways — a markdown bullet list, each starting with the key fact in **bold**.",
  deeper: "Go deeper using ONLY the sources: add specifics, numbers, dates and context, then finish with a short 'What we still don't know' line. About 250 words, with ## headings.",
  views: "Lay out the different perspectives or debates found in the sources under short ## headings, fairly and without taking sides. If the sources all agree, say so and explain why.",
};

export async function* remixAnswer(input: { question: string; markdown: string; sources: Source[]; style: RemixStyle }, signal?: AbortSignal): AsyncIterable<AgentEvent> {
  const ctx = input.sources.map((s) => `[${s.id}] ${s.title} (${s.domain})\n${s.snippet.slice(0, 600)}`).join("\n\n");
  const msgs: Msg[] = [
    {
      role: "system",
      content: `You are Rafiki, a warm, curious companion. ${REMIX[input.style]} Keep inline [n] citations that match the numbered sources. Output markdown only.`,
    },
    { role: "user", content: `Question: ${input.question}\n\nCurrent answer:\n${input.markdown.slice(0, 6000)}\n\nSources:\n${ctx}` },
  ];
  const stream = await chatStream("smart", msgs, { think: false, maxTokens: 1200 });
  const splitter = new StreamSplitter();
  for await (const chunk of stream) {
    if (signal?.aborted) {
      stream.controller.abort();
      return;
    }
    const text = chunk.choices[0]?.delta?.content;
    if (!text) continue;
    for (const p of splitter.push(text)) if (p.kind === "body") yield { type: "token", text: p.text };
  }
  for (const p of splitter.end()) if (p.kind === "body") yield { type: "token", text: p.text };
  yield { type: "done" };
}
