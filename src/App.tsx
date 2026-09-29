import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ask } from "./lib/api";
import { historyFrom, useRafiki, type Answer } from "./lib/store";
import { World } from "./scene/World";
import { AnswerPanel } from "./ui/AnswerPanel";
import { Composer } from "./ui/Composer";
import { enableHdVoice, speak, stopSpeaking } from "./voice/voice";

const SUGGESTIONS = [
  "What happened in AI this week?",
  "How do black holes evaporate?",
  "Best hikes near Nairobi",
  "Is Nemotron 3 good at coding?",
];

const GREETINGS = [
  "Jambo! I'm Rafiki. What should we explore today?",
  "Hi friend! Ask me anything — I'll scout the web for you.",
  "Hey there! My antennae are tingling. What are we curious about?",
];

export default function App() {
  const current = useRafiki((s) => s.current);
  const pose = useRafiki((s) => s.pose);
  const voiceOn = useRafiki((s) => s.voiceOn);
  const hdVoice = useRafiki((s) => s.hdVoice);
  const hdProgress = useRafiki((s) => s.hdVoiceProgress);
  const journal = useRafiki((s) => s.journal);
  const set = useRafiki((s) => s.set);
  const [busy, setBusy] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [mock, setMock] = useState(false);
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => setMock(!!h.mock))
      .catch(() => {});
  }, []);

  const onAsk = useCallback(async (question: string) => {
    abort.current?.abort();
    stopSpeaking();
    const store = useRafiki.getState();
    const history = historyFrom(store.journal, null);
    store.begin(question);
    const ac = new AbortController();
    abort.current = ac;
    setBusy(true);
    let spoke = false;
    try {
      await ask(
        { question, mode: store.mode, history },
        (ev) => {
          useRafiki.getState().apply(ev);
          // Speak as soon as the spoken line lands — the written answer keeps
          // streaming underneath, so Rafiki feels instant.
          if (ev.type === "say" && !spoke) {
            spoke = true;
            speak(ev.text);
          }
          if (ev.type === "done" && !spoke) {
            const s = useRafiki.getState().current?.say;
            if (s) speak(s);
          }
          if (ev.type === "error" && !spoke) speak("Oops, I hit a snag. Can you try that again?");
        },
        ac.signal,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") useRafiki.getState().apply({ type: "error", message: (err as Error).message });
    } finally {
      if (abort.current === ac) {
        setBusy(false);
        const s = useRafiki.getState();
        if (s.pose !== "speaking") s.set({ pose: "idle" });
      }
    }
  }, []);

  const stop = () => {
    abort.current?.abort();
    stopSpeaking();
    setBusy(false);
    set({ pose: "idle" });
  };

  const openFromJournal = (a: Answer) => {
    stop();
    set({ current: a });
    setJournalOpen(false);
  };

  return (
    <div className="app">
      <World />

      <header className="topbar">
        <motion.div className="brand" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <span className="logo">rafiki</span>
          {mock && <span className="pill mock" title="Add NEBIUS_API_KEY and TAVILY_API_KEY to .env">demo mode</span>}
        </motion.div>
        <div className="actions">
          <button
            className={`icon-btn ${voiceOn ? "on" : ""}`}
            onClick={() => {
              if (voiceOn) stopSpeaking();
              set({ voiceOn: !voiceOn });
            }}
            title={voiceOn ? "Mute Rafiki" : "Unmute Rafiki"}
          >
            {voiceOn ? "🔊" : "🔈"}
          </button>
          <button
            className={`icon-btn wide ${hdVoice ? "on" : ""}`}
            onClick={() => !hdVoice && enableHdVoice()}
            title="Use the open-source Kokoro-82M neural voice, running locally in your browser"
          >
            {hdProgress !== null ? `${Math.round(hdProgress * 100)}%` : "✨"}
            <span className="label">{hdProgress !== null ? " loading voice" : " HD voice"}</span>
          </button>
          <button className="icon-btn" onClick={() => setJournalOpen(true)} title="Journal">
            📓
          </button>
          {current && (
            <button className="icon-btn" onClick={() => (stop(), set({ current: null }))} title="New exploration">
              ✦
            </button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {!current && (
          <motion.div className="hello" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Bubble text={pose === "listening" ? "I'm listening…" : greeting} />
            <div className="suggestions">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s}
                  className="chip"
                  onClick={() => onAsk(s)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {current && (
          <motion.div className="say-bubble" key={current.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Bubble text={current.say || (pose === "searching" ? `Exploring ${current.queries.length || ""} trails…` : "Hmm, let me think…")} thinking={!current.say} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">{current && <AnswerPanel key={current.id} answer={current} onAsk={onAsk} />}</AnimatePresence>

      <Composer onAsk={onAsk} busy={busy} onStop={stop} />

      <AnimatePresence>
        {journalOpen && (
          <>
            <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setJournalOpen(false)} />
            <motion.aside className="journal" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
              <h3>📓 Rafiki's journal</h3>
              <p className="muted">Everything we explored together — stored only in this browser.</p>
              {journal.length === 0 && <p className="muted">Nothing yet. Ask me something!</p>}
              {journal.map((a) => (
                <button key={a.id} className="journal-item" onClick={() => openFromJournal(a)}>
                  <span>{a.emoji}</span>
                  <div>
                    <b>{a.question}</b>
                    <small>
                      {new Date(a.at).toLocaleString()} · {a.sources.length} sources
                    </small>
                  </div>
                </button>
              ))}
              {journal.length > 0 && (
                <button
                  className="link"
                  onClick={() => {
                    localStorage.removeItem("rafiki.journal.v1");
                    set({ journal: [] });
                  }}
                >
                  Clear journal
                </button>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Speech bubble with a typewriter reveal. */
function Bubble({ text, thinking }: { text: string; thinking?: boolean }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [text]);
  return (
    <motion.div className={`bubble ${thinking ? "thinking" : ""}`} layout transition={{ type: "spring", stiffness: 300, damping: 25 }}>
      {shown}
      {thinking && (
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
      )}
    </motion.div>
  );
}
