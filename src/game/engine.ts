/**
 * Local game engine — a pure-TypeScript twin of the Supabase RPCs in
 * supabase/migrations/*_rafiki_game.sql. Used offline / without Supabase, and
 * for instant feedback before the server confirms. Same inputs → same numbers
 * (tests/game.test.ts replays the SQL scenario against this file).
 */
import {
  BADGES,
  DEFAULT_CHARACTER,
  EMPTY_STATS,
  MAX_TRAIL_BONUS_STEPS,
  PALETTES,
  QUEST_POOL,
  REWARDS,
  SHOP,
  STARTER_ITEMS,
  STARTING_STARDUST,
  levelFor,
  questsForDate,
  type BadgeId,
  type Character,
  type DailyCounter,
  type Stats,
} from "../../shared/game";

export type Profile = {
  displayName: string;
  friendName: string;
  character: Character;
  xp: number;
  stardust: number;
  streak: number;
  bestStreak: number;
  lastActive: string | null; // UTC yyyy-mm-dd
  trail: number;
  bestTrail: number;
};

export type Exploration = {
  id: string;
  question: string;
  mode: "quick" | "deep";
  topic: "general" | "news";
  emoji: string | null;
  sourceCount: number;
  viaVoice: boolean;
  parentId: string | null;
  trailDepth: number;
  localHour: number;
  at: number;
};

export type LocalState = {
  profile: Profile;
  explorations: Exploration[];
  discoveries: { url: string; domain: string; explorationId: string | null; at: number }[];
  quizzes: { explorationId: string; correct: boolean; at: number }[];
  badges: BadgeId[];
  inventory: string[];
  questClaims: { questId: string; day: string }[];
};

export type Result = {
  xp: number;
  stardust: number;
  level: number;
  streak: number;
  bestStreak: number;
  trail: number;
  gained: { xp: number; stardust: number };
  newBadges: BadgeId[];
  explorationId?: string;
  streakBonus?: number;
  trailDepth?: number;
  newWorld?: boolean;
};

export class GameError extends Error {}

export const utcDay = (d: Date) => d.toISOString().slice(0, 10);
const dayBefore = (day: string) => utcDay(new Date(Date.parse(day + "T00:00:00Z") - 86_400_000));

export function domainOf(url: string): string | null {
  const m = url.match(/^https?:\/\/(?:www\.)?([^/:?#]+)/i);
  return m ? m[1].toLowerCase() : null;
}

export function newState(): LocalState {
  return {
    profile: {
      displayName: "Explorer",
      friendName: "Rafiki",
      character: { ...DEFAULT_CHARACTER },
      xp: 0,
      stardust: STARTING_STARDUST,
      streak: 0,
      bestStreak: 0,
      lastActive: null,
      trail: 0,
      bestTrail: 0,
    },
    explorations: [],
    discoveries: [],
    quizzes: [],
    badges: [],
    inventory: [...STARTER_ITEMS],
    questClaims: [],
  };
}

export function statsOf(s: LocalState): Stats {
  return {
    ...EMPTY_STATS,
    explorations: s.explorations.length,
    deepDives: s.explorations.filter((e) => e.mode === "deep").length,
    voiceQuestions: s.explorations.filter((e) => e.viaVoice).length,
    newsExplorations: s.explorations.filter((e) => e.topic === "news").length,
    quizCorrect: s.quizzes.filter((q) => q.correct).length,
    discoveries: s.discoveries.length,
    domains: new Set(s.discoveries.map((d) => d.domain)).size,
    bestTrail: s.profile.bestTrail,
    bestStreak: s.profile.bestStreak,
    nightOwl: s.explorations.filter((e) => e.localHour >= 0 && e.localHour <= 4).length,
  };
}

export function questProgress(s: LocalState, day: string): Record<DailyCounter, number> {
  const onDay = (at: number) => utcDay(new Date(at)) === day;
  const e = s.explorations.filter((x) => onDay(x.at));
  return {
    explorations: e.length,
    deepDives: e.filter((x) => x.mode === "deep").length,
    voiceQuestions: e.filter((x) => x.viaVoice).length,
    newsExplorations: e.filter((x) => x.topic === "news").length,
    trail: e.reduce((m, x) => Math.max(m, x.trailDepth), 0),
    discoveries: s.discoveries.filter((d) => onDay(d.at)).length,
    quizCorrect: s.quizzes.filter((q) => q.correct && onDay(q.at)).length,
  };
}

function awardBadges(s: LocalState): BadgeId[] {
  const stats = statsOf(s);
  const fresh = BADGES.filter((b) => stats[b.stat] >= b.goal && !s.badges.includes(b.id)).map((b) => b.id);
  s.badges.push(...fresh);
  return fresh;
}

function result(s: LocalState, gx: number, gs: number, newBadges: BadgeId[], extra: Partial<Result> = {}): Result {
  const p = s.profile;
  return {
    xp: p.xp,
    stardust: p.stardust,
    level: levelFor(p.xp),
    streak: p.streak,
    bestStreak: p.bestStreak,
    trail: p.trail,
    gained: { xp: gx, stardust: gs },
    newBadges,
    ...extra,
  };
}

const clone = <T,>(v: T): T => structuredClone(v);

export type ExplorationInput = {
  id?: string;
  question: string;
  mode: "quick" | "deep";
  topic: "general" | "news";
  emoji: string | null;
  sourceCount: number;
  viaVoice: boolean;
  parentId: string | null;
  localHour: number;
};

export function recordExploration(prev: LocalState, input: ExplorationInput, now = new Date()): { state: LocalState; result: Result } {
  const s = clone(prev);
  const p = s.profile;
  const today = utcDay(now);
  const last = s.explorations[s.explorations.length - 1];
  if (last && now.getTime() - last.at < 3000) throw new GameError("slow down, explorer");

  let streakBonus = 0;
  let streak = p.streak;
  if (p.lastActive !== today) {
    streak = p.lastActive === dayBefore(today) ? p.streak + 1 : 1;
    streakBonus = REWARDS.dailyStreak.stardust * Math.min(streak, 7);
  }

  const parent = input.parentId ? s.explorations.find((e) => e.id === input.parentId) : undefined;
  const depth = parent ? parent.trailDepth + 1 : 0;

  const base = input.mode === "deep" ? REWARDS.deepExploration : REWARDS.exploration;
  const gx = base.xp + (input.viaVoice ? REWARDS.voiceBonus.xp : 0) + REWARDS.trailBonus.xp * Math.min(depth, MAX_TRAIL_BONUS_STEPS);
  const gs = base.stardust + streakBonus;

  const id = input.id ?? crypto.randomUUID();
  s.explorations.push({
    id,
    question: input.question.slice(0, 1000),
    mode: input.mode,
    topic: input.topic,
    emoji: input.emoji,
    sourceCount: Math.max(0, input.sourceCount),
    viaVoice: input.viaVoice,
    parentId: depth > 0 ? input.parentId : null,
    trailDepth: depth,
    localHour: input.localHour,
    at: now.getTime(),
  });
  p.xp += gx;
  p.stardust += gs;
  p.streak = streak;
  p.bestStreak = Math.max(p.bestStreak, streak);
  p.lastActive = today;
  p.trail = depth;
  p.bestTrail = Math.max(p.bestTrail, depth);
  const badges = awardBadges(s);
  return { state: s, result: result(s, gx, gs, badges, { explorationId: id, streakBonus, trailDepth: depth }) };
}

export function recordDiscovery(prev: LocalState, url: string, explorationId: string | null, now = new Date()) {
  const d = domainOf(url);
  if (!d) throw new GameError("invalid url");
  const s = clone(prev);
  if (s.discoveries.some((x) => x.url === url)) return { state: prev, result: result(prev, 0, 0, [], { newWorld: false }) };
  const newWorld = !s.discoveries.some((x) => x.domain === d);
  const exists = explorationId && s.explorations.some((e) => e.id === explorationId);
  s.discoveries.push({ url, domain: d, explorationId: exists ? explorationId : null, at: now.getTime() });
  const gx = REWARDS.discovery.xp;
  const gs = REWARDS.discovery.stardust + (newWorld ? REWARDS.newWorld.stardust : 0);
  s.profile.xp += gx;
  s.profile.stardust += gs;
  return { state: s, result: result(s, gx, gs, awardBadges(s), { newWorld }) };
}

export function recordQuiz(prev: LocalState, explorationId: string, correct: boolean, now = new Date()) {
  if (!prev.explorations.some((e) => e.id === explorationId)) throw new GameError("unknown expedition");
  if (prev.quizzes.some((q) => q.explorationId === explorationId)) return { state: prev, result: result(prev, 0, 0, []) };
  const s = clone(prev);
  s.quizzes.push({ explorationId, correct, at: now.getTime() });
  const r = correct ? REWARDS.quizCorrect : REWARDS.quizWrong;
  s.profile.xp += r.xp;
  s.profile.stardust += r.stardust;
  return { state: s, result: result(s, r.xp, r.stardust, awardBadges(s)) };
}

export function claimQuest(prev: LocalState, questId: string, now = new Date()) {
  const today = utcDay(now);
  if (!questsForDate(today).some((q) => q.id === questId)) throw new GameError("not today's quest");
  const q = QUEST_POOL.find((x) => x.id === questId)!;
  if (questProgress(prev, today)[q.counter] < q.goal) throw new GameError("quest not complete yet");
  if (prev.questClaims.some((c) => c.questId === questId && c.day === today)) throw new GameError("already claimed");
  const s = clone(prev);
  s.questClaims.push({ questId, day: today });
  s.profile.xp += REWARDS.dailyQuest.xp;
  s.profile.stardust += REWARDS.dailyQuest.stardust;
  return { state: s, result: result(s, REWARDS.dailyQuest.xp, REWARDS.dailyQuest.stardust, awardBadges(s)) };
}

export function buyItem(prev: LocalState, itemId: string) {
  const it = SHOP.find((x) => x.id === itemId);
  if (!it) throw new GameError("no such item");
  if (prev.inventory.includes(itemId)) throw new GameError("already owned");
  if (levelFor(prev.profile.xp) < it.minLevel) throw new GameError(`reach level ${it.minLevel} first`);
  if (prev.profile.stardust < it.price) throw new GameError("not enough stardust");
  const s = clone(prev);
  s.profile.stardust -= it.price;
  s.inventory.push(itemId);
  return { state: s, result: result(s, 0, -it.price, []) };
}

const FREE_COLORS = PALETTES.map((p) => p.id).filter((id) => !SHOP.some((s) => s.id === id));
const FREE_SPECIES = ["bear", "bunny", "cat", "sprout", "antenna"];

export function canWear(state: Pick<LocalState, "inventory">, c: Character): string | null {
  const owned = state.inventory;
  if (![...FREE_COLORS, ...owned].includes(c.color)) return "color not owned";
  if (![...FREE_SPECIES, ...owned].includes(c.species)) return "species not owned";
  for (const slot of ["hat", "neck", "face"] as const) {
    const v = c[slot];
    if (v && !owned.includes(v)) return `${v} not owned`;
  }
  return null;
}

export function saveCharacter(prev: LocalState, c: Character, displayName?: string, friendName?: string) {
  const err = canWear(prev, c);
  if (err) throw new GameError(err);
  const s = clone(prev);
  s.profile.character = { species: c.species, color: c.color, eyes: c.eyes, pattern: c.pattern, hat: c.hat, neck: c.neck, face: c.face };
  if (displayName?.trim()) s.profile.displayName = displayName.trim().slice(0, 32);
  if (friendName?.trim()) s.profile.friendName = friendName.trim().slice(0, 24);
  return s;
}
