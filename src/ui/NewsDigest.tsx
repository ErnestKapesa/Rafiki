import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import type { Digest, NewsCategory, NewsStory } from "../../shared/types";
import { sfx } from "../audio/sfx";
import { useGame } from "../game/store";
import { getDigest } from "../lib/api";
import { useRafiki } from "../lib/store";
import { speak, stopSpeaking } from "../voice/voice";
import { Icon } from "./Icon";

export const CATS: Record<NewsCategory, { label: string; icon: string; color: string }> = {
  world: { label: "World", icon: "globe", color: "#4AA8FF" },
  tech: { label: "Tech & AI", icon: "bolt", color: "#8E6CFF" },
  science: { label: "Science", icon: "planet", color: "#2ECC8F" },
  business: { label: "Money", icon: "gem", color: "#E3A318" },
  africa: { label: "Africa", icon: "map", color: "#FF8A3D" },
  sports: { label: "Sports", icon: "trophy", color: "#FF5A8A" },
  health: { label: "Health", icon: "sprout", color: "#22B07D" },
  culture: { label: "Culture", icon: "music", color: "#D85AD8" },
};

const KEY = "rafiki.news.cats";
const loadCats = (): NewsCategory[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (Array.isArray(v) && v.length) return v;
  } catch {
    /* ignore */
  }
  return ["world", "tech", "science", "africa"];
};

/** Today's news as swipeable story cards, summarised by Nemotron. */
export function NewsDigest({ onAsk }: { onAsk: (q: string) => void }) {
  const open = useRafiki((s) => s.sheet === "news");
  const close = () => {
    stopSpeaking();
    sfx.close();
    useRafiki.getState().set({ sheet: null });
  };
  return <AnimatePresence>{open && <DigestView key="digest" onClose={close} onAsk={onAsk} />}</AnimatePresence>;
}

function DigestView({ onClose, onAsk }: { onClose: () => void; onAsk: (q: string) => void }) {
  const [cats, setCats] = useState<NewsCategory[]>(loadCats);
  const [stage, setStage] = useState<"pick" | "loading" | "stories" | "error">("pick");
  const [digest, setDigest] = useState<Digest | null>(null);
  const [error, setError] = useState("");
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [narrate, setNarrate] = useState(false);

  const brew = async () => {
    sfx.whoosh();
    try {
      localStorage.setItem(KEY, JSON.stringify(cats));
    } catch {
      /* ignore */
    }
    setStage("loading");
    speak("Ooh, let me fetch today's news for you!");
    try {
      const d = await getDigest(cats);
      setDigest(d);
      setI(0);
      setStage(d.stories.length ? "stories" : "error");
      if (!d.stories.length) setError("No fresh stories right now. Try other topics!");
      sfx.chime();
    } catch (e) {
      setError((e as Error).message);
      setStage("error");
    }
  };

  const total = digest?.stories.length ?? 0;
  const go = useCallback(
    (d: number) => {
      setDir(d);
      setI((x) => Math.max(0, Math.min(total, x + d)));
      sfx.tap();
    },
    [total],
  );

  // Keyboard: ← → to flip, Esc to close.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (stage !== "stories") return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [go, stage]);

  const story = digest && i < total ? digest.stories[i] : null;

  useEffect(() => {
    if (narrate && story) speak(`${story.headline}. ${story.summary} ${story.why}`);
  }, [narrate, story]);

  const accent = story ? CATS[story.category].color : "#7B5CFF";

  return (
    <motion.div className="digest" style={{ ["--accent" as string]: accent }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="digest-bg" onClick={onClose} />
      <motion.div className="digest-card-wrap" initial={{ y: 40, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, scale: 0.96 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
        <header className="digest-top">
          {stage === "stories" && (
            <div className="segments">
              {digest!.stories.map((_, k) => (
                <button key={k} className={k < i ? "seen" : k === i ? "now" : ""} onClick={() => (setDir(k > i ? 1 : -1), setI(k))} aria-label={`Story ${k + 1}`} />
              ))}
            </div>
          )}
          <div className="digest-bar">
            <Icon name="news2" size={30} />
            <div>
              <b>Daily Digest</b>
              <small>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</small>
            </div>
            {stage === "stories" && (
              <button className={`x ${narrate ? "on" : ""}`} onClick={() => (setNarrate(!narrate), narrate && stopSpeaking())} aria-label={narrate ? "Stop narrating" : "Narrate stories"} title="Rafiki reads each story">
                <Icon name={narrate ? "pause" : "play"} size={24} />
              </button>
            )}
            <button className="x" onClick={onClose} aria-label="Close digest">
              ✕
            </button>
          </div>
        </header>

        {stage === "pick" && (
          <div className="digest-pick">
            <h2>What's on your radar today?</h2>
            <p className="muted">Pick up to 6 topics. Nemotron reads the day's news and serves the stories that matter.</p>
            <div className="cat-grid">
              {(Object.keys(CATS) as NewsCategory[]).map((c) => {
                const on = cats.includes(c);
                return (
                  <motion.button
                    key={c}
                    className={`cat ${on ? "on" : ""}`}
                    style={{ ["--c" as string]: CATS[c].color }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => {
                      sfx.pop();
                      setCats((l) => (on ? l.filter((x) => x !== c) : l.length >= 6 ? l : [...l, c]));
                    }}
                    aria-pressed={on}
                  >
                    <Icon name={CATS[c].icon} size={34} />
                    <span>{CATS[c].label}</span>
                    {on && <i className="tick">✓</i>}
                  </motion.button>
                );
              })}
            </div>
            <button className="btn primary big" disabled={!cats.length} onClick={brew}>
              <Icon name="sparkle" size={26} /> Brew my digest
            </button>
          </div>
        )}

        {stage === "loading" && (
          <div className="digest-loading">
            <motion.div animate={{ rotate: [0, -8, 8, 0], y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1.4 }}>
              <Icon name="news2" size={84} />
            </motion.div>
            <b>Reading today's headlines…</b>
            <p className="muted">
              Searching {cats.length} beats with Tavily and summarising with NVIDIA Nemotron
              <span className="dots">
                <i />
                <i />
                <i />
              </span>
            </p>
          </div>
        )}

        {stage === "error" && (
          <div className="digest-loading">
            <Icon name="cross" size={64} />
            <b>The newsroom is closed for a sec.</b>
            <p className="muted">{error}</p>
            <button className="btn primary" onClick={() => setStage("pick")}>
              Try again
            </button>
          </div>
        )}

        {stage === "stories" && (
          <div className="stories">
            <AnimatePresence mode="popLayout" custom={dir} initial={false}>
              {story ? (
                <StoryCard key={story.id} story={story} dir={dir} onNext={() => go(1)} onPrev={() => go(-1)} onAsk={(q) => (onClose(), onAsk(q))} />
              ) : (
                <motion.div key="end" className="story end" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <Icon name="party" size={90} float />
                  <h2>You're all caught up!</h2>
                  <p className="muted">
                    {total} stories from {new Set(digest!.stories.map((s) => s.category)).size} topics. Come back tomorrow for a fresh digest.
                  </p>
                  <div className="end-actions">
                    <button className="btn white" onClick={() => (setDir(-1), setI(0))}>
                      Read again
                    </button>
                    <button className="btn primary" onClick={() => setStage("pick")}>
                      Change topics
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function StoryCard({ story, dir, onNext, onPrev, onAsk }: { story: NewsStory; dir: number; onNext: () => void; onPrev: () => void; onAsk: (q: string) => void }) {
  const [imgOk, setImgOk] = useState(!!story.image);
  const cat = CATS[story.category];
  const openSource = (s: NewsStory["sources"][number]) => {
    if (!/^https?:\/\//i.test(s.url)) return;
    sfx.open();
    useRafiki.getState().set({ reader: { url: s.url, title: s.title, domain: s.domain, favicon: s.favicon, answerId: null } });
    useGame.getState().discover(s.url, null);
  };
  return (
    <motion.article
      className="story"
      custom={dir}
      initial={{ x: dir * 80, opacity: 0, rotate: dir * 2 }}
      animate={{ x: 0, opacity: 1, rotate: 0 }}
      exit={{ x: dir * -80, opacity: 0, rotate: dir * -2 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      onDragEnd={(_, info) => {
        if (info.offset.x < -70) onNext();
        else if (info.offset.x > 70) onPrev();
      }}
    >
      <div className="story-media" style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.color}aa)` }}>
        {imgOk && story.image && <img src={story.image} alt="" onError={() => setImgOk(false)} draggable={false} />}
        {!imgOk && <Icon name={cat.icon} size={90} />}
        <span className="story-cat">
          <Icon name={cat.icon} size={20} /> {cat.label}
        </span>
        <button className="tap-zone left" onClick={onPrev} aria-label="Previous story" />
        <button className="tap-zone right" onClick={onNext} aria-label="Next story" />
      </div>
      <div className="story-body">
        <h3>{story.headline}</h3>
        <p>{story.summary}</p>
        {story.why && (
          <div className="why">
            <Icon name="bulb" size={24} />
            <span>
              <b>Why it matters:</b> {story.why}
            </span>
          </div>
        )}
        {story.sources.length > 0 && (
          <div className="story-sources">
            {story.sources.map((s) => (
              <button key={s.url} className="src-chip" onClick={() => openSource(s)} title={s.title}>
                {s.favicon ? <img src={s.favicon} alt="" onError={(e) => (e.currentTarget.style.display = "none")} /> : <Icon name="globe" size={16} />}
                {s.domain}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="story-actions">
        <button className="btn white" onClick={() => speak(`${story.headline}. ${story.summary} ${story.why}`)} aria-label="Listen">
          <Icon name="sound" size={22} />
        </button>
        <button className="btn yellow" onClick={() => onAsk(`Tell me more about this news: ${story.headline}`)}>
          <Icon name="rocket" size={22} /> Dig deeper
        </button>
        <button className="btn primary" onClick={onNext} aria-label="Next story">
          Next
        </button>
      </div>
    </motion.article>
  );
}
