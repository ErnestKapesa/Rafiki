import { create } from "zustand";
import { BADGES, levelFor, questsForDate, type BadgeId, type Character } from "../../shared/game";
import { sfx } from "../audio/sfx";
import { ensureSession, supabase } from "../lib/supabase";
import * as engine from "./engine";
import type { ExplorationInput, LocalState, Result } from "./engine";

/**
 * Game state. Local-first: every action runs through the local engine for
 * instant animation + sound, then (if Supabase is configured) the same action
 * is sent to the authoritative RPC and the server's totals win.
 */

export type Toast = { id: number; icon: string; text: string; tone: "xp" | "gem" | "streak" | "info" };
export type Celebration = { kind: "level"; level: number } | { kind: "badge"; badge: BadgeId };
export type LeaderRow = { rank: number; display_name: string; friend_name: string; avatar: Character; xp: number; level: number; streak: number; is_me: boolean };

type GameStore = {
  s: LocalState;
  onboarded: boolean;
  online: boolean;
  preview: Character | null; // wardrobe try-on
  toasts: Toast[];
  celebrations: Celebration[];
  serverIds: Record<string, string>; // local exploration id → server id
  bump: number; // increments on every reward (HUD pulse)

  init(): Promise<void>;
  finishOnboarding(displayName: string, friendName: string, c: Character): void;
  exploration(input: ExplorationInput): Result | null;
  discover(url: string, localExplorationId: string | null): Result | null;
  quiz(localExplorationId: string, correct: boolean): Result | null;
  claim(questId: string): Result | null;
  buy(itemId: string): Result | null;
  wear(c: Character): string | null;
  rename(displayName: string, friendName: string): void;
  setPreview(c: Character | null): void;
  dismissToast(id: number): void;
  popCelebration(): void;
  leaderboard(): Promise<LeaderRow[] | null>;
};

const KEY = "rafiki.game.v1";
const load = (): { s: LocalState; onboarded: boolean; serverIds: Record<string, string> } => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw?.s?.profile) return { s: { ...engine.newState(), ...raw.s }, onboarded: !!raw.onboarded, serverIds: raw.serverIds ?? {} };
  } catch {
    /* fall through */
  }
  return { s: engine.newState(), onboarded: false, serverIds: {} };
};

let toastId = 0;

export const useGame = create<GameStore>((set, get) => {
  const persist = () => {
    const { s, onboarded, serverIds } = get();
    try {
      // Keep storage bounded — the journal holds the rich answers anyway.
      const trimmed = { ...s, explorations: s.explorations.slice(-300), discoveries: s.discoveries.slice(-1000) };
      localStorage.setItem(KEY, JSON.stringify({ s: trimmed, onboarded, serverIds }));
    } catch {
      /* private mode */
    }
  };

  const toast = (t: Omit<Toast, "id">) => {
    const id = ++toastId;
    set((st) => ({ toasts: [...st.toasts, { ...t, id }] }));
    setTimeout(() => get().dismissToast(id), 2600);
  };

  /** Turn an engine result into toasts, sounds and celebrations. */
  const reward = (before: LocalState, r: Result, label?: string) => {
    if (r.gained.xp > 0) toast({ icon: "xp", text: `+${r.gained.xp} XP${label ? ` · ${label}` : ""}`, tone: "xp" });
    if (r.gained.stardust > 0) setTimeout(() => toast({ icon: "gem", text: `+${r.gained.stardust} stardust`, tone: "gem" }), 180);
    if (r.streakBonus) setTimeout(() => toast({ icon: "streak", text: `${r.streak}-day streak!`, tone: "streak" }), 360);
    if (r.newWorld) setTimeout(() => toast({ icon: "planet", text: "New world discovered!", tone: "info" }), 90);
    if (r.gained.xp > 0 || r.gained.stardust > 0) {
      sfx.coin();
      if (r.gained.stardust > 0) setTimeout(sfx.gem, 180);
    }
    const lvlBefore = levelFor(before.profile.xp);
    const cel: Celebration[] = [];
    if (r.level > lvlBefore) cel.push({ kind: "level", level: r.level });
    for (const b of r.newBadges) cel.push({ kind: "badge", badge: b });
    if (cel.length) setTimeout(() => set((st) => ({ celebrations: [...st.celebrations, ...cel] })), 700);
    set((st) => ({ bump: st.bump + 1 }));
  };

  /** Server totals are authoritative — overwrite local numbers. */
  const reconcile = (r: Partial<Result> | null) => {
    if (!r || typeof r.xp !== "number") return;
    set((st) => ({
      s: {
        ...st.s,
        profile: {
          ...st.s.profile,
          xp: r.xp!,
          stardust: r.stardust ?? st.s.profile.stardust,
          streak: r.streak ?? st.s.profile.streak,
          bestStreak: r.bestStreak ?? st.s.profile.bestStreak,
          trail: r.trail ?? st.s.profile.trail,
        },
        badges: [...new Set([...st.s.badges, ...(r.newBadges ?? [])])],
      },
    }));
    persist();
  };

  const remote = async (fn: string, args: Record<string, unknown>) => {
    if (!supabase || !get().online) return null;
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      console.warn(`[supabase] ${fn}:`, error.message);
      return null;
    }
    return data as Result & { explorationId?: string };
  };

  /** Run a local engine step with error → friendly toast. */
  const step = <T,>(fn: () => T): T | null => {
    try {
      return fn();
    } catch (err) {
      if (err instanceof engine.GameError) {
        toast({ icon: "hourglass", text: err.message, tone: "info" });
        sfx.error();
        return null;
      }
      throw err;
    }
  };

  const initial = load();
  return {
    ...initial,
    online: false,
    preview: null,
    toasts: [],
    celebrations: [],
    bump: 0,

    async init() {
      if (!supabase) return;
      try {
        await ensureSession();
        const { data, error } = await supabase.rpc("get_my_state");
        if (error) throw error;
        const p = data.profile;
        set((st) => ({
          online: true,
          s: {
            ...st.s,
            profile: {
              displayName: p.display_name,
              friendName: p.friend_name,
              character: p.character,
              xp: p.xp,
              stardust: p.stardust,
              streak: p.streak,
              bestStreak: p.best_streak,
              lastActive: p.last_active,
              trail: p.trail,
              bestTrail: p.best_trail,
            },
            badges: data.badges,
            inventory: data.inventory,
            questClaims: (data.questClaims as string[]).map((q) => ({ questId: q, day: engine.utcDay(new Date()) })),
          },
          // A returning cloud player skips onboarding on a new device.
          onboarded: st.onboarded || p.display_name !== "Explorer",
        }));
        persist();
      } catch (err) {
        console.warn("[supabase] offline mode:", (err as Error).message);
      }
    },

    finishOnboarding(displayName, friendName, c) {
      const s = engine.saveCharacter(get().s, c, displayName, friendName);
      set({ s, onboarded: true, preview: null });
      persist();
      void remote("save_character", { p_character: c, p_display_name: displayName, p_friend_name: friendName });
    },

    exploration(input) {
      const before = get().s;
      const out = step(() => engine.recordExploration(before, input));
      if (!out) return null;
      set({ s: out.state });
      persist();
      reward(before, out.result, input.parentId ? `trail ×${out.result.trailDepth}` : undefined);
      const localId = out.result.explorationId!;
      const parentServer = input.parentId ? get().serverIds[input.parentId] ?? null : null;
      void remote("record_exploration", {
        p_question: input.question,
        p_mode: input.mode,
        p_topic: input.topic,
        p_emoji: input.emoji,
        p_source_count: input.sourceCount,
        p_via_voice: input.viaVoice,
        p_parent: parentServer,
        p_local_hour: input.localHour,
      }).then((r) => {
        if (r?.explorationId) set((st) => ({ serverIds: { ...st.serverIds, [localId]: r.explorationId! } }));
        reconcile(r);
      });
      return out.result;
    },

    discover(url, localExplorationId) {
      const before = get().s;
      const out = step(() => engine.recordDiscovery(before, url, localExplorationId));
      if (!out || out.state === before) return out?.result ?? null;
      set({ s: out.state });
      persist();
      sfx.discover();
      reward(before, out.result);
      const sid = localExplorationId ? get().serverIds[localExplorationId] ?? null : null;
      void remote("record_discovery", { p_url: url, p_exploration: sid }).then(reconcile);
      return out.result;
    },

    quiz(localExplorationId, correct) {
      const before = get().s;
      const out = step(() => engine.recordQuiz(before, localExplorationId, correct));
      if (!out || out.state === before) return null;
      set({ s: out.state });
      persist();
      reward(before, out.result, correct ? "quiz ace" : "nice try");
      const sid = get().serverIds[localExplorationId];
      if (sid) void remote("record_quiz", { p_exploration: sid, p_correct: correct }).then(reconcile);
      return out.result;
    },

    claim(questId) {
      const before = get().s;
      const out = step(() => engine.claimQuest(before, questId));
      if (!out) return null;
      set({ s: out.state });
      persist();
      sfx.chime();
      reward(before, out.result, "quest complete");
      void remote("claim_daily_quest", { p_quest: questId }).then(reconcile);
      return out.result;
    },

    buy(itemId) {
      const before = get().s;
      const out = step(() => engine.buyItem(before, itemId));
      if (!out) return null;
      set({ s: out.state });
      persist();
      sfx.purchase();
      toast({ icon: "shop", text: "Added to your wardrobe!", tone: "info" });
      void remote("buy_item", { p_item: itemId }).then(reconcile);
      return out.result;
    },

    wear(c) {
      const err = engine.canWear(get().s, c);
      if (err) return err;
      const s = engine.saveCharacter(get().s, c);
      set({ s });
      persist();
      void remote("save_character", { p_character: c, p_display_name: s.profile.displayName, p_friend_name: s.profile.friendName });
      return null;
    },

    rename(displayName, friendName) {
      const s = engine.saveCharacter(get().s, get().s.profile.character, displayName, friendName);
      set({ s });
      persist();
      void remote("save_character", { p_character: s.profile.character, p_display_name: displayName, p_friend_name: friendName });
    },

    setPreview: (c) => set({ preview: c }),
    dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
    popCelebration: () => set((st) => ({ celebrations: st.celebrations.slice(1) })),

    async leaderboard() {
      if (!supabase) return null;
      const { data, error } = await supabase.rpc("get_leaderboard", { p_limit: 20 });
      if (error) return null;
      return data as LeaderRow[];
    },
  };
});

export const todaysQuests = () => questsForDate(engine.utcDay(new Date()));
export const badgeDef = (id: BadgeId) => BADGES.find((b) => b.id === id)!;
export const useCharacter = () => useGame((g) => g.preview ?? g.s.profile.character);
