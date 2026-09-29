import { create } from "zustand";
import type { AgentEvent, Mode, Mood, Source, Stage, StepMetric, Turn, WebImage } from "../../shared/types";

/** What Rafiki's body is doing — drives the 3D animation state machine. */
export type Pose = "idle" | "listening" | "thinking" | "searching" | "speaking" | "happy";

export type Answer = {
  id: string;
  question: string;
  mode: Mode;
  emoji: string;
  mood: Mood;
  queries: string[];
  sources: Source[];
  images: WebImage[];
  say: string;
  markdown: string;
  reasoning: string;
  related: string[];
  metrics: StepMetric[];
  stage: Stage;
  stageLabel: string;
  stageModel?: string;
  error?: string;
  at: number;
};

type State = {
  pose: Pose;
  mode: Mode;
  voiceOn: boolean;
  hdVoice: boolean;
  hdVoiceProgress: number | null; // 0..1 while the Kokoro model downloads
  interim: string; // live speech-to-text transcript
  current: Answer | null;
  journal: Answer[];
  hoveredSource: number | null;
  /** 0..1 mouth openness, written every frame by the voice engine. */
  mouth: { value: number };
  set: (p: Partial<State>) => void;
  apply: (ev: AgentEvent) => void;
  begin: (question: string) => Answer;
};

const JOURNAL_KEY = "rafiki.journal.v1";
const loadJournal = (): Answer[] => {
  try {
    return JSON.parse(localStorage.getItem(JOURNAL_KEY) || "[]");
  } catch {
    return [];
  }
};
const saveJournal = (j: Answer[]) => {
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(j.slice(0, 30)));
  } catch {
    /* private mode — journal just won't persist */
  }
};

export const useRafiki = create<State>((set, get) => ({
  pose: "idle",
  mode: "quick",
  voiceOn: true,
  hdVoice: false,
  hdVoiceProgress: null,
  interim: "",
  current: null,
  journal: loadJournal(),
  hoveredSource: null,
  mouth: { value: 0 },
  set: (p) => set(p),

  begin(question) {
    const a: Answer = {
      id: crypto.randomUUID(),
      question,
      mode: get().mode,
      emoji: "🔭",
      mood: "curious",
      queries: [],
      sources: [],
      images: [],
      say: "",
      markdown: "",
      reasoning: "",
      related: [],
      metrics: [],
      stage: "plan",
      stageLabel: "Listening…",
      at: Date.now(),
    };
    set({ current: a, pose: "thinking", hoveredSource: null });
    return a;
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
        saveJournal(journal);
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

export function historyFrom(journal: Answer[], current: Answer | null): Turn[] {
  const turns: Turn[] = [];
  const recent = [...journal].slice(0, 3).reverse();
  for (const a of recent) {
    if (current && a.id === current.id) continue;
    turns.push({ role: "user", content: a.question }, { role: "assistant", content: a.say || firstSentences(a.markdown) });
  }
  return turns;
}
