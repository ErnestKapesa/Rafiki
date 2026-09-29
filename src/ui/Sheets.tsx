import { AnimatePresence, motion } from "motion/react";
import { lazy, Suspense, useEffect, useState } from "react";
import { BADGES, QUEST_POOL, REWARDS, SHOP, levelFor, paletteOf, titleFor, type Character } from "../../shared/game";
import { audioPrefs, setAudioPrefs, sfx } from "../audio/sfx";
import { questProgress, statsOf, utcDay } from "../game/engine";
import { todaysQuests, useGame, type LeaderRow } from "../game/store";
import { useRafiki, type Answer, type Sheet as SheetId, type VoiceMode } from "../lib/store";
import { saveProgressWithEmail, supabase } from "../lib/supabase";
import { speak, warmVoice } from "../voice/voice";
import { Avatar, topicIcon } from "./Avatar";
import { Customizer, type Tab } from "./Customizer";
import { Icon } from "./Icon";

const Galaxy = lazy(() => import("./Galaxy"));

const META: Record<Exclude<SheetId, null>, { title: string; icon: string }> = {
  quests: { title: "Daily quests", icon: "quest" },
  wardrobe: { title: "Closet", icon: "hanger" },
  galaxy: { title: "Knowledge galaxy", icon: "galaxy" },
  badges: { title: "Trophy case", icon: "trophy" },
  leaders: { title: "Explorer ranks", icon: "crown" },
  journal: { title: "Journal", icon: "journal" },
  settings: { title: "Settings", icon: "gear" },
};

export function Sheets({ onOpenAnswer }: { onOpenAnswer: (a: Answer) => void }) {
  const sheet = useRafiki((s) => s.sheet);
  const close = () => {
    sfx.close();
    useGame.getState().setPreview(null);
    useRafiki.getState().set({ sheet: null });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && sheet && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  const full = sheet === "galaxy";
  return (
    <AnimatePresence>
      {sheet && (
        <>
          {sheet !== "wardrobe" && <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />}
          <motion.aside
            key={sheet}
            className={`sheet ${sheet} ${full ? "full" : ""}`}
            role="dialog"
            aria-label={META[sheet].title}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            <div className="grabber" />
            <header className="sheet-head">
              <Icon name={META[sheet].icon} size={38} float />
              <h2>{META[sheet].title}</h2>
              <button className="x" onClick={close} aria-label="Close">
                ✕
              </button>
            </header>
            <div className="sheet-body">
              {sheet === "quests" && <Quests />}
              {sheet === "wardrobe" && <Wardrobe />}
              {sheet === "galaxy" && (
                <Suspense fallback={<div className="muted">Charting the stars…</div>}>
                  <Galaxy onOpen={(a) => (close(), onOpenAnswer(a))} />
                </Suspense>
              )}
              {sheet === "badges" && <Badges />}
              {sheet === "leaders" && <Leaders />}
              {sheet === "journal" && <Journal onOpen={(a) => (close(), onOpenAnswer(a))} />}
              {sheet === "settings" && <Settings />}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------------ */

function Quests() {
  const s = useGame((g) => g.s);
  const today = utcDay(new Date());
  const prog = questProgress(s, today);
  const quests = todaysQuests();
  const [left, setLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const ms = Date.parse(today + "T24:00:00Z") - Date.now();
      setLeft(`${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [today]);

  return (
    <>
      <p className="muted">
        New quests in <b>{left}</b>. Each one pays <b>{REWARDS.dailyQuest.xp} XP</b> + <b>{REWARDS.dailyQuest.stardust} stardust</b>.
      </p>
      <div className="quest-list">
        {quests.map((q, i) => {
          const have = Math.min(prog[q.counter], q.goal);
          const done = have >= q.goal;
          const claimed = s.questClaims.some((c) => c.questId === q.id && c.day === today);
          return (
            <motion.div key={q.id} className={`quest ${claimed ? "claimed" : done ? "ready" : ""}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Icon name={q.icon} size={44} float={done && !claimed} />
              <div className="quest-main">
                <b>{q.title}</b>
                <div className="bar">
                  <motion.i initial={{ width: 0 }} animate={{ width: `${(have / q.goal) * 100}%` }} transition={{ type: "spring", stiffness: 80 }} />
                </div>
                <small>
                  {have}/{q.goal}
                </small>
              </div>
              {claimed ? (
                <span className="claimed-tag">
                  <Icon name="check" size={22} /> Done
                </span>
              ) : (
                <motion.button className="btn primary small" disabled={!done} onClick={() => useGame.getState().claim(q.id)} whileTap={{ scale: 0.92 }} animate={done ? { scale: [1, 1.06, 1] } : {}} transition={{ repeat: done ? Infinity : 0, duration: 1.4 }}>
                  <Icon name="gift" size={20} /> Claim
                </motion.button>
              )}
            </motion.div>
          );
        })}
      </div>
      <h4>How to earn</h4>
      <ul className="earn">
        <li><Icon name="rocket" size={22} /><span>Finish an expedition <b>+{REWARDS.exploration.xp} XP</b> (Deep Dive <b>+{REWARDS.deepExploration.xp}</b>)</span></li>
        <li><Icon name="planet" size={22} /><span>Visit a source world <b>+{REWARDS.discovery.xp} XP</b>, brand-new site <b>+{REWARDS.newWorld.stardust} stardust</b></span></li>
        <li><Icon name="bulb" size={22} /><span>Ace the pop quiz <b>+{REWARDS.quizCorrect.xp} XP</b></span></li>
        <li><Icon name="compass" size={22} /><span>Follow the trail with follow-ups <b>+{REWARDS.trailBonus.xp} XP</b> per step</span></li>
        <li><Icon name="mic" size={22} /><span>Ask out loud <b>+{REWARDS.voiceBonus.xp} XP</b></span></li>
        <li><Icon name="streak" size={22} /><span>Come back daily: streak bonus up to <b>+{REWARDS.dailyStreak.stardust * 7} stardust</b></span></li>
      </ul>
      <p className="muted small">{QUEST_POOL.length} quest types rotate daily.</p>
    </>
  );
}

/* ------------------------------------------------------------------------ */

function Wardrobe() {
  const current = useGame((g) => g.s.profile.character);
  const profile = useGame((g) => g.s.profile);
  const inventory = useGame((g) => g.s.inventory);
  const [draft, setDraft] = useState<Character>(current);
  const [tab, setTab] = useState<Tab>("look");
  const [friend, setFriend] = useState(profile.friendName);
  const level = levelFor(profile.xp);

  const change = (c: Character) => {
    setDraft(c);
    useGame.getState().setPreview(c);
  };
  // Which equipped-but-unowned item should the buy button offer?
  const needed = [draft.species, draft.color, draft.hat, draft.neck, draft.face]
    .filter(Boolean)
    .map((id) => SHOP.find((s) => s.id === id))
    .find((it) => it && !inventory.includes(it.id));
  const dirty = JSON.stringify(draft) !== JSON.stringify(current) || friend !== profile.friendName;

  return (
    <>
      <label className="field">
        <span>Name</span>
        <input value={friend} onChange={(e) => setFriend(e.target.value)} maxLength={24} />
      </label>
      <div className="tabs">
        {(
          [
            ["look", "Look"],
            ["hat", "Hats"],
            ["neck", "Neck"],
            ["face", "Face"],
          ] as const
        ).map(([t, label]) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => (sfx.tap(), setTab(t))}>
            {label}
          </button>
        ))}
      </div>
      <Customizer value={draft} onChange={change} tab={tab} />
      <div className="wardrobe-foot">
        {needed ? (
          <motion.button
            className="btn primary big"
            disabled={level < needed.minLevel || profile.stardust < needed.price}
            onClick={() => useGame.getState().buy(needed.id)}
            whileTap={{ scale: 0.95 }}
          >
            <Icon name="shop" size={24} />
            {level < needed.minLevel ? `Unlocks at level ${needed.minLevel}` : `Buy ${needed.name} · ${needed.price}`}
            {level >= needed.minLevel && <Icon name="gem" size={20} />}
          </motion.button>
        ) : (
          <motion.button
            className="btn primary big"
            disabled={!dirty}
            onClick={() => {
              const err = useGame.getState().wear(draft);
              if (friend !== profile.friendName) useGame.getState().rename(profile.displayName, friend);
              if (!err) {
                sfx.chime();
                useRafiki.getState().set({ pose: "celebrate" });
                setTimeout(() => useRafiki.getState().set({ pose: "idle" }), 1300);
                speak(["Ooh, I love it!", "Looking fabulous!", "So cozy!"][Math.floor(Math.random() * 3)]);
              }
            }}
            whileTap={{ scale: 0.95 }}
          >
            <Icon name="sparkles" size={24} /> {dirty ? "Wear this look" : "Looking great!"}
          </motion.button>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------ */

function Badges() {
  const s = useGame((g) => g.s);
  const stats = statsOf(s);
  return (
    <div className="badge-grid">
      {BADGES.map((b, i) => {
        const earned = s.badges.includes(b.id);
        const have = Math.min(stats[b.stat], b.goal);
        return (
          <motion.div key={b.id} className={`badge ${earned ? "earned" : ""}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
            <div className="badge-medal">
              <Icon name={b.icon} size={48} float={earned} />
            </div>
            <b>{b.name}</b>
            <small>{b.desc}</small>
            {!earned && (
              <div className="bar thin">
                <i style={{ width: `${(have / b.goal) * 100}%` }} />
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function Leaders() {
  const [rows, setRows] = useState<LeaderRow[] | null | "loading">("loading");
  const me = useGame((g) => g.s.profile);
  useEffect(() => {
    useGame.getState().leaderboard().then(setRows);
  }, []);
  if (rows === "loading") return <p className="muted">Scanning the cosmos…</p>;
  const list: LeaderRow[] =
    rows ?? [{ rank: 1, display_name: me.displayName, friend_name: me.friendName, avatar: me.character, xp: me.xp, level: levelFor(me.xp), streak: me.streak, is_me: true }];
  return (
    <>
      {!rows && <p className="muted">Connect Supabase (see README) to compete with explorers everywhere. For now it's just you, and you're winning.</p>}
      <ol className="leaders">
        {list.map((r, i) => (
          <motion.li key={i} className={r.is_me ? "me" : ""} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
            <span className="rank">{r.rank <= 3 ? <Icon name={["trophy", "medal", "medal"][r.rank - 1]} size={28} /> : r.rank}</span>
            <span className="avatar sm">
              <Avatar c={{ species: r.avatar?.species ?? "bear", color: r.avatar?.color ?? "peach", eyes: r.avatar?.eyes ?? "round" }} size={40} />
            </span>
            <span className="lname">
              <b>{r.display_name}</b>
              <small>
                with {r.friend_name} · {titleFor(r.level)}
              </small>
            </span>
            <span className="lxp">
              <Icon name="xp" size={18} /> {r.xp.toLocaleString()}
            </span>
          </motion.li>
        ))}
      </ol>
    </>
  );
}

/* ------------------------------------------------------------------------ */

function Journal({ onOpen }: { onOpen: (a: Answer) => void }) {
  const journal = useRafiki((s) => s.journal);
  const online = useGame((g) => g.online);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  return (
    <>
      {journal.length === 0 && <p className="muted">Nothing yet. Your expeditions will be logged here.</p>}
      <div className="journal-list">
        {journal.map((a) => (
          <button key={a.id} className="journal-item" onClick={() => onOpen(a)}>
            <span className="j-emoji">
              <Icon name={topicIcon(a)} size={28} />
            </span>
            <span>
              <b>{a.question}</b>
              <small>
                {new Date(a.at).toLocaleString()} · {a.discovered.length}/{a.sources.length} worlds
                {a.quizPick !== null && a.quiz ? (a.quizPick === a.quiz.answer ? " · quiz aced" : " · quiz tried") : ""}
              </small>
            </span>
          </button>
        ))}
      </div>
      {supabase && online && (
        <form
          className="save-progress"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await saveProgressWithEmail(email);
              setSent("Check your inbox to confirm. Your progress is now yours on any device.");
            } catch (err) {
              setSent((err as Error).message);
            }
          }}
        >
          <b>
            <Icon name="lock" size={20} /> Keep your progress forever
          </b>
          <div className="ob-input light">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" aria-label="Email" />
            <button className="btn small primary" type="submit" aria-label="Save">
              Save
            </button>
          </div>
          {sent && <small>{sent}</small>}
        </form>
      )}
    </>
  );
}

/* ------------------------------------------------------------------------ */

function Settings() {
  const voiceMode = useRafiki((s) => s.voiceMode);
  const hdProgress = useRafiki((s) => s.hdVoiceProgress);
  const [prefs, setPrefs] = useState(audioPrefs());
  const toggle = (k: "sfx" | "music") => {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    setAudioPrefs(next);
    sfx.tap();
  };
  const voices: { id: VoiceMode; name: string; icon: string; note: string }[] = [
    { id: "cute", name: "Cute voice", icon: "sparkle", note: hdProgress !== null ? `Learning to talk… ${Math.round(hdProgress * 100)}%` : "Neural Kokoro voice, runs on your device" },
    { id: "babble", name: "Babble", icon: "chat", note: "Critter-speak, like a village friend" },
    { id: "system", name: "System", icon: "mic", note: "Your device's built-in voice" },
    { id: "off", name: "Quiet", icon: "muted", note: "Text only" },
  ];
  return (
    <>
      <h4>Voice</h4>
      <div className="opt-grid voices">
        {voices.map((v) => (
          <motion.button
            key={v.id}
            className={`opt wide ${voiceMode === v.id ? "on" : ""}`}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              useRafiki.getState().set({ voiceMode: v.id });
              sfx.pop();
              if (v.id === "cute") warmVoice();
              if (v.id !== "off") setTimeout(() => speak("Hi hi! This is how I sound!"), 60);
            }}
          >
            <Icon name={v.icon} size={36} />
            <span>
              <b>{v.name}</b>
              <small>{v.note}</small>
            </span>
          </motion.button>
        ))}
      </div>
      <h4>Sound</h4>
      <div className="toggles">
        <button className={`toggle ${prefs.sfx ? "on" : ""}`} onClick={() => toggle("sfx")}>
          <Icon name={prefs.sfx ? "sound" : "muted"} size={28} /> Sound effects <i />
        </button>
        <button className={`toggle ${prefs.music ? "on" : ""}`} onClick={() => toggle("music")}>
          <Icon name="music" size={28} /> Music <i />
        </button>
      </div>
      <h4>About</h4>
      <p className="muted small">
        Rafiki thinks with <b>NVIDIA Nemotron</b> on <b>Nebius Token Factory</b>, searches with <b>Tavily</b>, and keeps score in <b>Supabase</b>. 3D icons: Microsoft Fluent Emoji (MIT).
      </p>
      <button
        className="link danger"
        onClick={() => {
          if (!confirm("Start over? Your local progress, journal and friend will be reset.")) return;
          ["rafiki.game.v1", "rafiki.journal.v2"].forEach((k) => localStorage.removeItem(k));
          location.reload();
        }}
      >
        Reset local progress
      </button>
    </>
  );
}
