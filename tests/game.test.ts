import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { levelFor, questsForDate, xpForLevel } from "../shared/game";
import {
  buyItem,
  claimQuest,
  GameError,
  newState,
  questProgress,
  recordDiscovery,
  recordExploration,
  recordQuiz,
  saveCharacter,
  utcDay,
} from "../src/game/engine";

const at = (iso: string) => new Date(iso);

describe("levels", () => {
  it("follows the 50·L·(L−1) curve", () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
    expect(levelFor(0)).toBe(1);
    expect(levelFor(99)).toBe(1);
    expect(levelFor(100)).toBe(2);
    expect(levelFor(1000)).toBe(5);
  });
});

describe("engine mirrors the SQL scenario (tests/sql/game.test.sql)", () => {
  it("awards the same numbers step by step", () => {
    let s = newState();
    expect(s.profile.stardust).toBe(20);
    expect(s.inventory).toContain("scarf");

    const t0 = at("2026-09-29T14:00:00Z");
    let r = recordExploration(s, { question: "what is a quasar?", mode: "quick", topic: "general", emoji: "🔭", sourceCount: 5, viaVoice: false, parentId: null, localHour: 14 }, t0);
    s = r.state;
    expect(r.result.gained).toEqual({ xp: 20, stardust: 15 });
    expect(r.result.stardust).toBe(35);
    expect(r.result.streak).toBe(1);
    expect(r.result.newBadges).toContain("first_steps");
    const e1 = r.result.explorationId!;

    expect(() =>
      recordExploration(s, { question: "again", mode: "quick", topic: "general", emoji: null, sourceCount: 1, viaVoice: false, parentId: null, localHour: 14 }, at("2026-09-29T14:00:01Z")),
    ).toThrow(/slow down/);

    r = recordExploration(s, { question: "how far away?", mode: "deep", topic: "news", emoji: "🌌", sourceCount: 8, viaVoice: true, parentId: e1, localHour: 2 }, at("2026-09-29T14:01:00Z"));
    s = r.state;
    expect(r.result.gained).toEqual({ xp: 50, stardust: 10 });
    expect(r.result.trailDepth).toBe(1);
    expect(r.result.newBadges).toContain("night_owl");
    expect(r.result.xp).toBe(70);

    let d = recordDiscovery(s, "https://www.example.com/a", e1, at("2026-09-29T14:02:00Z"));
    s = d.state;
    expect(d.result.gained).toEqual({ xp: 5, stardust: 12 });
    expect(d.result.newWorld).toBe(true);
    d = recordDiscovery(s, "https://www.example.com/a", e1);
    expect(d.result.gained.xp).toBe(0);
    d = recordDiscovery(s, "https://example.com/b", e1, at("2026-09-29T14:03:00Z"));
    s = d.state;
    expect(d.result.gained.stardust).toBe(2);
    expect(d.result.newWorld).toBe(false);
    expect(() => recordDiscovery(s, "javascript:alert(1)", null)).toThrow(/invalid url/);

    let q = recordQuiz(s, e1, true, at("2026-09-29T14:04:00Z"));
    s = q.state;
    expect(q.result.gained).toEqual({ xp: 15, stardust: 5 });
    q = recordQuiz(s, e1, true);
    expect(q.result.gained.xp).toBe(0);
    expect(q.result).toMatchObject({ xp: 95, stardust: 64, level: 1 });

    expect(() => buyItem(s, "tophat")).toThrow(/reach level 3/);
    expect(() => buyItem(s, "scarf")).toThrow(/already owned/);
    const b = buyItem(s, "beanie");
    s = b.state;
    expect(b.result.stardust).toBe(34);
    expect(() => buyItem(s, "crown")).toThrow(/reach level 5/);

    const base = { species: "bear", color: "peach", eyes: "round", pattern: "belly", hat: null, neck: null, face: null } as const;
    expect(() => saveCharacter(s, { ...base, hat: "crown" })).toThrow(/not owned/);
    expect(() => saveCharacter(s, { ...base, species: "unicorn" })).toThrow(/species not owned/);
    s = saveCharacter(s, { species: "bunny", color: "mint", eyes: "sparkle", pattern: "spots", hat: "beanie", neck: "scarf", face: null }, "Ernest", "Rafi");
    expect(s.profile.character.hat).toBe("beanie");
    expect(s.profile.friendName).toBe("Rafi");

    const progress = questProgress(s, "2026-09-29");
    expect(progress).toMatchObject({ explorations: 2, deepDives: 1, voiceQuestions: 1, newsExplorations: 1, trail: 1, discoveries: 2, quizCorrect: 1 });
  });

  it("builds and resets streaks across days", () => {
    let s = newState();
    const ask = (iso: string) => {
      const r = recordExploration(s, { question: "q", mode: "quick", topic: "general", emoji: null, sourceCount: 1, viaVoice: false, parentId: null, localHour: 12 }, at(iso));
      s = r.state;
      return r.result;
    };
    expect(ask("2026-09-01T10:00:00Z").streakBonus).toBe(10);
    expect(ask("2026-09-01T12:00:00Z").streakBonus).toBe(0);
    expect(ask("2026-09-02T09:00:00Z")).toMatchObject({ streak: 2, streakBonus: 20 });
    expect(ask("2026-09-03T09:00:00Z")).toMatchObject({ streak: 3, streakBonus: 30, newBadges: ["on_fire"] });
    expect(ask("2026-09-05T09:00:00Z")).toMatchObject({ streak: 1, bestStreak: 3 });
  });

  it("caps the trail bonus at 5 steps", () => {
    let s = newState();
    let parent: string | null = null;
    let t = Date.parse("2026-09-01T10:00:00Z");
    let last = 0;
    for (let i = 0; i < 8; i++) {
      const r = recordExploration(s, { question: `q${i}`, mode: "quick", topic: "general", emoji: null, sourceCount: 1, viaVoice: false, parentId: parent, localHour: 12 }, new Date((t += 60_000)));
      s = r.state;
      parent = r.result.explorationId!;
      last = r.result.gained.xp;
    }
    expect(last).toBe(20 + 5 * 5);
    expect(s.profile.bestTrail).toBe(7);
  });
});

describe("daily quests", () => {
  it("match the SQL implementation for every day in the fixture", () => {
    const lines = readFileSync(new URL("./sql/quest_fixture.txt", import.meta.url), "utf8").trim().split("\n");
    expect(lines.length).toBeGreaterThan(40);
    for (const line of lines) {
      const [day, ids] = line.split(" ");
      expect(questsForDate(day).map((q) => q.id).join(","), day).toBe(ids);
    }
  });

  it("only pays out completed quests, once", () => {
    const now = at("2026-09-29T15:00:00Z");
    const [quest] = questsForDate(utcDay(now));
    let s = newState();
    expect(() => claimQuest(s, quest.id, now)).toThrow(GameError);
    // Satisfy every counter generously.
    let parent: string | null = null;
    let t = now.getTime() - 3_600_000;
    for (let i = 0; i < 4; i++) {
      const r = recordExploration(s, { question: "q", mode: "deep", topic: "news", emoji: null, sourceCount: 3, viaVoice: true, parentId: parent, localHour: 12 }, new Date((t += 60_000)));
      s = r.state;
      parent = r.result.explorationId!;
      s = recordDiscovery(s, `https://site${i}.com/`, parent, new Date(t)).state;
      s = recordQuiz(s, parent, true, new Date(t)).state;
    }
    const r = claimQuest(s, quest.id, now);
    expect(r.result.gained).toEqual({ xp: 30, stardust: 15 });
    expect(() => claimQuest(r.state, quest.id, now)).toThrow(/already claimed/);
  });
});
