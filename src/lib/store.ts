import { create } from "zustand";
import type { AgentEvent, Mode, Mood, Quiz, Source, Stage, StepMetric, Turn, WebImage } from "../../shared/types";

/** What Rafiki's body is doing — drives the 3D animation state machine. */
export type Pose = "idle" | "listening" | "thinking" | "searching" | "speaking" | "happy" | "celebrate";

export type Sheet = "quests" | "wardrobe" | "galaxy" | "badges" | "leaders" | "settings" | "journal" | null;
export type OnboardStep = "orb" | "name" | "friend" | null;
export type VoiceMode = "cute" | "babble" | "system" | "off";

export type Answer = {
  id: string; // also the game-engine exploration id once rewarded
  question: string;
  mode: Mode;
  emoji: string;
  mood: Mood;
  topic: "general" | "news";
  viaVoice: boolean;
  parentId: string | null; // previous answer on the same trail
  queries: string[];
  sources: Source[];
  images: WebImage[];
  say: string;
  markdown: string;
  reasoning: string;
  related: string[];
  quiz: Quiz | null;
  quizPick: number | null;
  discovered: string[]; // source urls visited
  metrics: StepMetric[];
  stage: Stage;
  stageLabel: string;
  stageModel?: string;
  rewarded: boolean;
  error?: string;
  at: number;
};

type State = {
  pose: Pose;
  mode: Mode;
  voiceMode: VoiceMode;
  hdVoiceProgress: number | null; // 0..1 while the Kokoro model downloads
  interim: string; // live speech-to-text transcript
  current: Answer | null;
  journal: Answer[];
  hoveredSource: number | null;
  sheet: Sheet;
  onboardStep: OnboardStep;
  hatched: boolean; // orb has burst open → Rafiki visible
  /** 0..1 mouth openness, written every frame by the voice engine. */
  mouth: { value: number };
  set: (p: Partial<State>) => void;
  apply: (ev: AgentEvent) => void;
  begin: (question: string, opts: { viaVoice: boolean; parentId: string | null }) => Answer;
  patchCurrent: (p: Partial<Answer>) => void;
};

const JOURNAL_KEY = "rafiki.journal.v2";
const VOICE_KEY = "rafiki.voice.v1";
const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode — just won't persist */
  }
};

export const useRafiki = create<State>((set, get) => ({
  pose: "idle",
  mode: "quick",
  voiceMode: (() => {
    const v = read<string>(VOICE_KEY, "cute");
    return (["cute", "babble", "system", "off"].includes(v) ? v : "cute") as VoiceMode; // migrates old "speech"/"hd"
  })(),
  hdVoiceProgress: null,
  interim: "",
  current: null,
  journal: read<Answer[]>(JOURNAL_KEY, []),
  hoveredSource: null,
  sheet: null,
  onboardStep: null,
  hatched: true,
  mouth: { value: 0 },
  set: (p) => {
    if (p.voiceMode) write(VOICE_KEY, p.voiceMode);
    set(p);
  },

  begin(question, { viaVoice, parentId }) {
    const a: Answer = {
      id: crypto.randomUUID(),
      question,
      mode: get().mode,
      emoji: "🔭",
      mood: "curious",
      topic: "general",
      viaVoice,
      parentId,
      queries: [],
      sources: [],
      images: [],
      say: "",
      markdown: "",
      reasoning: "",
      related: [],
      quiz: null,
      quizPick: null,
      discovered: [],
      metrics: [],
      stage: "plan",
      stageLabel: "Listening…",
      rewarded: false,
      at: Date.now(),
    };
    set({ current: a, pose: "thinking", hoveredSource: null });
    return a;
  },

  patchCurrent(p) {
    const cur = get().current;
    if (!cur) return;
    const next = { ...cur, ...p };
    const journal = get().journal.map((j) => (j.id === next.id ? next : j));
    write(JOURNAL_KEY, journal.slice(0, 40));
    set({ current: next, journal });
  },

  apply(ev) {
    const cur = get().current;
    if (!cur) return;
    const next: Answer = { ...cur };
    let pose = get().pose;
    switch (ev.type) {
      case "stage":
        next.stage = ev.stage;
        next.stageLabel = ev.label;
        next.stageModel = ev.model;
        if (ev.stage === "search" || ev.stage === "read") pose = "searching";
        if (ev.stage === "plan") pose = "thinking";
        break;
      case "plan":
        next.queries = ev.queries;
        next.mood = ev.mood;
        next.emoji = ev.emoji;
        next.topic = ev.topic ?? "general";
        break;
      case "sources":
        next.sources = ev.sources;
        pose = "happy";
        break;
      case "images":
        next.images = ev.images;
        break;
      case "reasoning":
        next.reasoning += ev.text;
        break;
      case "say":
        next.say = ev.text;
        break;
      case "token":
        next.markdown += ev.text;
        break;
      case "related":
        next.related = ev.questions;
        break;
      case "quiz":
        next.quiz = ev.quiz;
        break;
      case "metrics":
        next.metrics = ev.steps;
        break;
      case "error":
        next.error = ev.message;
        pose = "idle";
        break;
      case "done": {
        if (!next.say && next.markdown) next.say = firstSentences(next.markdown);
        const journal = [next, ...get().journal.filter((j) => j.id !== next.id)];
        write(JOURNAL_KEY, journal.slice(0, 40));
        set({ current: next, journal });
        return;
      }
    }
    set({ current: next, pose });
  },
}));

/** Markdown → a couple of speakable sentences (fallback when the model skipped <say>). */
export function firstSentences(md: string, n = 2) {
  const plain = md
    .replace(/\[(\d+)\]/g, "")
    .replace(/[#*_`>|-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (plain.match(/[^.!?]+[.!?]+/g) ?? [plain]).slice(0, n).join(" ").trim();
}

export function historyFrom(journal: Answer[]): Turn[] {
  const turns: Turn[] = [];
  for (const a of journal.slice(0, 3).reverse()) {
    turns.push({ role: "user", content: a.question }, { role: "assistant", content: a.say || firstSentences(a.markdown) });
  }
  return turns;
}
