// Types shared by the agent server and the web client (streamed as SSE).

export type Mode = "quick" | "deep";
export type Mood = "curious" | "excited" | "serious" | "playful" | "calm";

export type Turn = { role: "user" | "assistant"; content: string };

export type AskRequest = {
  question: string;
  mode: Mode;
  history?: Turn[];
};

export type Source = {
  id: number; // 1-based, matches [n] citations in the answer
  title: string;
  url: string;
  domain: string;
  snippet: string;
  favicon?: string;
  score: number;
  published?: string;
};

export type WebImage = { url: string; description?: string };

/** A one-question pop quiz generated from the answer (Nemotron Nano). */
export type Quiz = { question: string; options: string[]; answer: number; explain: string };

export type Stage = "plan" | "search" | "read" | "write" | "done";

export type StepMetric = { step: string; model?: string; ms: number; tokens?: number };

export type AgentEvent =
  | { type: "stage"; stage: Stage; label: string; model?: string }
  | { type: "plan"; intent: "search" | "chat"; queries: string[]; mood: Mood; emoji: string; topic: "general" | "news" }
  | { type: "sources"; sources: Source[] }
  | { type: "images"; images: WebImage[] }
  | { type: "reasoning"; text: string }
  | { type: "say"; text: string }
  | { type: "token"; text: string }
  | { type: "related"; questions: string[] }
  | { type: "quiz"; quiz: Quiz }
  | { type: "metrics"; steps: StepMetric[] }
  | { type: "error"; message: string }
  | { type: "done" };

/* ── Reader (in-app browser) ─────────────────────────────────────────── */
export type PageRead = { url: string; title: string; markdown: string; embeddable: boolean; words: number };
export type PageDigest = { summary: string; points: string[]; minutes: number };

/* ── News digest ─────────────────────────────────────────────────────── */
export type NewsCategory = "world" | "tech" | "science" | "business" | "africa" | "sports" | "health" | "culture";
export type NewsStory = {
  id: string;
  category: NewsCategory;
  headline: string;
  summary: string;
  why: string;
  sources: Source[];
  image?: string;
};
export type Digest = { date: string; stories: NewsStory[] };

/* ── Answer remix ────────────────────────────────────────────────────── */
export type RemixStyle = "simpler" | "points" | "deeper" | "views";
