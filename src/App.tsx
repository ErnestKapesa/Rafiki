import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { sfx, unlockAudio } from "./audio/sfx";
import { rewardExploration } from "./game/actions";
import { useGame } from "./game/store";
import { ask } from "./lib/api";
import { historyFrom, useRafiki, type Answer } from "./lib/store";
import { WorldScene } from "./scene/World";
import { AnswerPanel } from "./ui/AnswerPanel";
import { Composer, type AskOpts } from "./ui/Composer";
import { Hud } from "./ui/Hud";
import { Icon } from "./ui/Icon";
import { Onboarding } from "./ui/Onboarding";
import { RewardLayer } from "./ui/RewardLayer";
import { Sheets } from "./ui/Sheets";
import { speak, stopSpeaking, warmVoice } from "./voice/voice";

const IDEAS = [
  { q: "What happened in AI this week?", icon: "news" },
  { q: "How do black holes evaporate?", icon: "planet" },
  { q: "Best hikes near Nairobi", icon: "map" },
  { q: "Why do cats purr?", icon: "paw" },
];

export default function App() {
  const current = useRafiki((s) => s.current);
  const pose = useRafiki((s) => s.pose);
  const onboardStep = useRafiki((s) => s.onboardStep);
  const sheet = useRafiki((s) => s.sheet);
  const set = useRafiki((s) => s.set);
  const onboarded = useGame((g) => g.onboarded);
  const profile = useGame((g) => g.s.profile);
  const [busy, setBusy] = useState(false);
  const [mock, setMock] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => setMock(!!h.mock))
      .catch(() => {});
    void useGame.getState().init();
    if (!useGame.getState().onboarded) set({ onboardStep: "orb", hatched: false });
    const unlock = () => {
      unlockAudio();
      warmVoice(); // start downloading the cute neural voice in the background
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }, [set]);

  const onAsk = useCallback(async (question: string, opts: AskOpts & { trailFrom?: Answer } = {}) => {
    abort.current?.abort();
    stopSpeaking();
    unlockAudio();
    sfx.whoosh();
    const store = useRafiki.getState();
    const history = historyFrom(store.journal);
    const answer = store.begin(question, { viaVoice: !!opts.viaVoice, parentId: opts.trailFrom?.id ?? null });
    const ac = new AbortController();
    abort.current = ac;
    setBusy(true);
    let spoke = false;
    try {
      await ask(
        { question, mode: store.mode, history },
        (ev) => {
          if (useRafiki.getState().current?.id !== answer.id) return; // superseded
          useRafiki.getState().apply(ev);
          if (ev.type === "sources" && ev.sources.length) sfx.launch();
          // Speak as soon as the spoken line lands — the written answer keeps streaming.
          if (ev.type === "say" && !spoke) {
            spoke = true;
            speak(ev.text);
          }
          if (ev.type === "done") {
            const done = useRafiki.getState().current!;
            if (!spoke && done.say) speak(done.say);
            if (!done.error) {
              sfx.chime();
              rewardExploration(done);
            }
          }
          if (ev.type === "error" && !spoke) {
            spoke = true;
            speak("Oops, I hit a snag. Can you try that again?");
          }
        },
        ac.signal,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        useRafiki.getState().apply({ type: "error", message: (err as Error).message });
        useRafiki.getState().apply({ type: "done" });
      }
    } finally {
      if (abort.current === ac) {
        setBusy(false);
        const s = useRafiki.getState();
        if (s.pose !== "speaking" && s.pose !== "celebrate") s.set({ pose: "idle" });
      }
    }
  }, []);

  const stop = () => {
    abort.current?.abort();
    stopSpeaking();
    setBusy(false);
    set({ pose: "idle" });
  };

  const openAnswer = (a: Answer) => {
    stop();
    set({ current: a });
  };

  const onboarding = onboardStep !== null;
  const greeting = pose === "listening" ? "I'm listening…" : `Jambo, ${profile.displayName}! Where should we explore today?`;

  return (
    <div className={`app ${onboarding ? "is-onboarding" : ""}`}>
      <WorldScene />

      {onboarding ? (
        <Onboarding />
      ) : (
        <>
          <Hud />
          {mock && (
            <span className="pill mock" title="Add NEBIUS_API_KEY and TAVILY_API_KEY to .env for live results">
              demo mode
            </span>
          )}

          <AnimatePresence>
            {!current && !sheet && onboarded && (
              <motion.div className="hello" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <Bubble text={greeting} />
                <div className="suggestions">
                  <small className="eyebrow light">Expedition ideas</small>
                  <div>
                    {IDEAS.map((s, i) => (
                      <motion.button
                        key={s.q}
                        className="chip"
                        onClick={() => onAsk(s.q)}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.08 }}
                        whileHover={{ scale: 1.05, y: -3 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Icon name={s.icon} size={24} /> {s.q}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {current && sheet !== "wardrobe" && (
              <motion.div className="say-bubble" key={current.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Bubble
                  text={current.say || (pose === "searching" ? `Exploring ${current.queries.length || ""} trails…` : current.error ? "Hmm, that didn't work." : "Hmm, let me think…")}
                  thinking={!current.say && !current.error}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {current && !sheet && (
              <AnswerPanel key={current.id} answer={current} onAsk={(q, from) => onAsk(q, { trailFrom: from })} />
            )}
          </AnimatePresence>

          {sheet !== "wardrobe" && <Composer onAsk={onAsk} busy={busy} onStop={stop} />}
          {current && !sheet && (
            <button className="btn white new-trip" onClick={() => (stop(), sfx.tap(), set({ current: null }))} title="New expedition">
              <Icon name="home" size={22} /> Home
            </button>
          )}
          <Sheets onOpenAnswer={openAnswer} />
        </>
      )}
      <RewardLayer />
    </div>
  );
}

/** Animal-Crossing-style dialog: name tag, typewriter text, bouncing "next" arrow. */
function Bubble({ text, thinking }: { text: string; thinking?: boolean }) {
  const name = useGame((g) => g.s.profile.friendName);
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 24);
    return () => clearInterval(id);
  }, [text]);
  const done = shown.length >= text.length;
  return (
    <motion.div className={`dialog ${thinking ? "thinking" : ""}`} layout initial={{ scale: 0.85, y: 10 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 22 }}>
      <span className="nametag">{name}</span>
      <p>
        {shown}
        {thinking && (
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
        )}
      </p>
      {done && !thinking && <span className="next-arrow" aria-hidden />}
    </motion.div>
  );
}
