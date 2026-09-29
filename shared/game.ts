/**
 * Rafiki game rules — the single source of truth for rewards, levels, badges,
 * daily quests and the wardrobe shop. The client uses these for instant
 * feedback; supabase/migrations/*.sql mirrors the same numbers server-side so
 * progress is authoritative when Supabase is connected. Keep them in sync
 * (tests/game-parity.test.ts checks the SQL against this file).
 */

/* ------------------------------------------------------------------------ */
/* Rewards                                                                  */
/* ------------------------------------------------------------------------ */
export const REWARDS = {
  exploration: { xp: 20, stardust: 5 },
  deepExploration: { xp: 40, stardust: 10 },
  voiceBonus: { xp: 5, stardust: 0 },
  trailBonus: { xp: 5, stardust: 0 }, // per step of an unbroken follow-up trail (max 5)
  discovery: { xp: 5, stardust: 2 }, // opening a source you haven't opened before
  newWorld: { xp: 0, stardust: 10 }, // …from a domain you've never visited
  quizCorrect: { xp: 15, stardust: 5 },
  quizWrong: { xp: 3, stardust: 0 },
  dailyStreak: { xp: 0, stardust: 10 }, // × min(streak, 7) on the first exploration of the day
  dailyQuest: { xp: 30, stardust: 15 },
} as const;

export const MAX_TRAIL_BONUS_STEPS = 5;

/** Total XP needed to *reach* a level. L1 = 0, L2 = 100, L3 = 300, L4 = 600 … */
export const xpForLevel = (level: number) => 50 * level * (level - 1);

export function levelFor(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

export function levelProgress(xp: number) {
  const level = levelFor(xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return { level, into: xp - from, span: to - from, pct: (xp - from) / (to - from) };
}

export const LEVEL_TITLES = [
  "Stargazer",
  "Wanderer",
  "Pathfinder",
  "Trailblazer",
  "Navigator",
  "Voyager",
  "Explorer Royale",
  "Cosmic Sage",
];
export const titleFor = (level: number) => LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];

/* ------------------------------------------------------------------------ */
/* Stats tracked for badges & quests                                        */
/* ------------------------------------------------------------------------ */
export type Stats = {
  explorations: number;
  deepDives: number;
  voiceQuestions: number;
  newsExplorations: number;
  quizCorrect: number;
  discoveries: number;
  domains: number;
  bestTrail: number;
  bestStreak: number;
  nightOwl: number;
};

export const EMPTY_STATS: Stats = {
  explorations: 0,
  deepDives: 0,
  voiceQuestions: 0,
  newsExplorations: 0,
  quizCorrect: 0,
  discoveries: 0,
  domains: 0,
  bestTrail: 0,
  bestStreak: 0,
  nightOwl: 0,
};

export type BadgeId =
  | "first_steps"
  | "curious_cat"
  | "deep_diver"
  | "chatterbox"
  | "quiz_whiz"
  | "globetrotter"
  | "on_fire"
  | "night_owl"
  | "trailblazer"
  | "news_hound";

export type Badge = { id: BadgeId; name: string; desc: string; icon: string; stat: keyof Stats; goal: number };

export const BADGES: Badge[] = [
  { id: "first_steps", name: "First Steps", desc: "Go on your first expedition", icon: "sprout", stat: "explorations", goal: 1 },
  { id: "curious_cat", name: "Curious Cat", desc: "Complete 10 expeditions", icon: "paw", stat: "explorations", goal: 10 },
  { id: "deep_diver", name: "Deep Diver", desc: "Take 3 Deep Dives", icon: "galaxy", stat: "deepDives", goal: 3 },
  { id: "chatterbox", name: "Chatterbox", desc: "Ask 3 questions with your voice", icon: "mic", stat: "voiceQuestions", goal: 3 },
  { id: "quiz_whiz", name: "Quiz Whiz", desc: "Ace 5 pop quizzes", icon: "bulb", stat: "quizCorrect", goal: 5 },
  { id: "globetrotter", name: "Globetrotter", desc: "Discover 15 different worlds (websites)", icon: "globe", stat: "domains", goal: 15 },
  { id: "on_fire", name: "On Fire", desc: "Keep a 3-day streak", icon: "streak", stat: "bestStreak", goal: 3 },
  { id: "night_owl", name: "Night Owl", desc: "Explore between midnight and 5am", icon: "owl", stat: "nightOwl", goal: 1 },
  { id: "trailblazer", name: "Trailblazer", desc: "Follow a trail 3 questions deep", icon: "compass", stat: "bestTrail", goal: 3 },
  { id: "news_hound", name: "News Hound", desc: "Explore 3 news stories", icon: "news", stat: "newsExplorations", goal: 3 },
];

export function earnedBadges(stats: Stats): BadgeId[] {
  return BADGES.filter((b) => stats[b.stat] >= b.goal).map((b) => b.id);
}

/* ------------------------------------------------------------------------ */
/* Daily quests — three per day, picked deterministically from the date     */
/* ------------------------------------------------------------------------ */
export type DailyCounter = "explorations" | "deepDives" | "discoveries" | "quizCorrect" | "voiceQuestions" | "newsExplorations" | "trail";
export type QuestDef = { id: string; title: string; icon: string; counter: DailyCounter; goal: number };

export const QUEST_POOL: QuestDef[] = [
  { id: "explore_3", title: "Go on 3 expeditions", icon: "rocket", counter: "explorations", goal: 3 },
  { id: "deep_1", title: "Take a Deep Dive", icon: "galaxy", counter: "deepDives", goal: 1 },
  { id: "discover_3", title: "Discover 3 worlds", icon: "planet", counter: "discoveries", goal: 3 },
  { id: "quiz_2", title: "Ace 2 pop quizzes", icon: "bulb", counter: "quizCorrect", goal: 2 },
  { id: "voice_1", title: "Ask Rafiki out loud", icon: "mic", counter: "voiceQuestions", goal: 1 },
  { id: "news_1", title: "Explore today's news", icon: "news", counter: "newsExplorations", goal: 1 },
  { id: "trail_2", title: "Follow a trail 2 steps", icon: "compass", counter: "trail", goal: 2 },
];

/** Stable daily pick: same 3 quests for everyone on a given UTC date. */
export function questsForDate(isoDate: string): QuestDef[] {
  // Exact uint32 arithmetic (Math.imul) so the SQL twin produces the same picks.
  let h = 0;
  for (const ch of isoDate) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  const pool = [...QUEST_POOL];
  const out: QuestDef[] = [];
  for (let i = 0; i < 3; i++) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    out.push(pool.splice(h % pool.length, 1)[0]);
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Character & wardrobe                                                     */
/* ------------------------------------------------------------------------ */
export type Species = "bear" | "bunny" | "cat" | "sprout" | "antenna" | "unicorn";
export type EyeStyle = "round" | "sparkle" | "sleepy";
export type Pattern = "belly" | "spots" | "none";
export type Slot = "hat" | "neck" | "face";

export type Character = {
  species: Species;
  color: string; // palette id
  eyes: EyeStyle;
  pattern: Pattern;
  hat: string | null;
  neck: string | null;
  face: string | null;
};

export type Palette = { id: string; name: string; body: string; belly: string; accent: string; cheek: string };

export const PALETTES: Palette[] = [
  { id: "peach", name: "Peach", body: "#ffb59a", belly: "#fff1e8", accent: "#ff8f7a", cheek: "#ff7f9e" },
  { id: "lilac", name: "Lilac", body: "#bfaaff", belly: "#f3efff", accent: "#9d86ff", cheek: "#ff8fc4" },
  { id: "mint", name: "Mint", body: "#8fe0c2", belly: "#ecfff7", accent: "#5cc8a3", cheek: "#ff9ab5" },
  { id: "sky", name: "Sky", body: "#95c8ff", belly: "#eef6ff", accent: "#6aa8ff", cheek: "#ff9ec2" },
  { id: "butter", name: "Butter", body: "#ffdd7e", belly: "#fff9e3", accent: "#ffbe3d", cheek: "#ff9a8a" },
  { id: "rose", name: "Rose", body: "#ff9fbf", belly: "#fff0f5", accent: "#ff77a4", cheek: "#ff6f93" },
  { id: "coral", name: "Coral", body: "#ff8a78", belly: "#ffece6", accent: "#ff6a55", cheek: "#ff5f7e" },
  { id: "midnight", name: "Midnight", body: "#6c6fc4", belly: "#dcdcff", accent: "#ffd36e", cheek: "#ff8fc4" },
];

export const paletteOf = (id: string) => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

export type ShopItem = {
  id: string;
  name: string;
  icon: string;
  kind: Slot | "color" | "species";
  price: number; // stardust
  minLevel: number;
};

export const SHOP: ShopItem[] = [
  { id: "scarf", name: "Cozy scarf", icon: "scarf", kind: "neck", price: 0, minLevel: 1 },
  { id: "bow", name: "Bow tie", icon: "ribbon", kind: "neck", price: 40, minLevel: 1 },
  { id: "beanie", name: "Beanie", icon: "cap", kind: "hat", price: 30, minLevel: 1 },
  { id: "flower", name: "Hibiscus", icon: "flower", kind: "hat", price: 40, minLevel: 1 },
  { id: "headphones", name: "Headphones", icon: "headphone", kind: "hat", price: 60, minLevel: 2 },
  { id: "tophat", name: "Top hat", icon: "tophat", kind: "hat", price: 80, minLevel: 3 },
  { id: "grad", name: "Scholar cap", icon: "grad", kind: "hat", price: 100, minLevel: 4 },
  { id: "crown", name: "Crown", icon: "crown", kind: "hat", price: 150, minLevel: 5 },
  { id: "glasses", name: "Reading glasses", icon: "glasses", kind: "face", price: 50, minLevel: 1 },
  { id: "shades", name: "Cool shades", icon: "sunglasses", kind: "face", price: 70, minLevel: 2 },
  { id: "coral", name: "Coral fur", icon: "paint", kind: "color", price: 50, minLevel: 1 },
  { id: "midnight", name: "Midnight fur", icon: "moon", kind: "color", price: 120, minLevel: 3 },
  { id: "unicorn", name: "Unicorn horn", icon: "horn", kind: "species", price: 100, minLevel: 4 },
];

export const STARTER_ITEMS = ["scarf"];
export const STARTING_STARDUST = 20;

/** Items anyone can use without buying (base palettes/species). */
export const isFreeCosmetic = (id: string) =>
  PALETTES.some((p) => p.id === id && !SHOP.some((s) => s.id === id)) ||
  ["bear", "bunny", "cat", "sprout", "antenna"].includes(id);

export const DEFAULT_CHARACTER: Character = {
  species: "bear",
  color: "peach",
  eyes: "round",
  pattern: "belly",
  hat: null,
  neck: "scarf",
  face: null,
};
