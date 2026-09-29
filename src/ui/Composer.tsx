import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useRafiki } from "../lib/store";
import { canListen, isListening, listen, stopListening } from "../voice/voice";

export function Composer({ onAsk, busy, onStop }: { onAsk: (q: string) => void; busy: boolean; onStop: () => void }) {
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const pose = useRafiki((s) => s.pose);
  const interim = useRafiki((s) => s.interim);
  const mode = useRafiki((s) => s.mode);
  const set = useRafiki((s) => s.set);
  const listening = pose === "listening";
  const mic = canListen();

  const submit = (q = text) => {
    const v = q.trim();
    if (!v) return;
    setText("");
    onAsk(v);
  };

  // "/" focuses the box; holding Space (outside inputs) is push-to-talk.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === "INPUT";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.code === "Space" && !typing && !e.repeat && mic) {
        e.preventDefault();
        listen(submit);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && isListening()) stopListening();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic]);

  return (
    <div className="composer-wrap">
      <div className="mode-toggle" role="radiogroup" aria-label="Search mode">
        {(["quick", "deep"] as const).map((m) => (
          <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? "on" : ""} onClick={() => set({ mode: m })}>
            {mode === m && <motion.span layoutId="mode-pill" className="mode-pill" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
            <span>{m === "quick" ? "⚡ Quick" : "🌌 Deep Dive"}</span>
          </button>
        ))}
      </div>
      <form
        className={`composer ${listening ? "listening" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={input}
          value={listening ? interim : text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? "I'm all ears…" : "Ask Rafiki anything…"}
          aria-label="Ask Rafiki"
          readOnly={listening}
        />
        {busy ? (
          <button type="button" className="send stop" onClick={onStop} aria-label="Stop">
            ■
          </button>
        ) : (
          text.trim() && (
            <motion.button type="submit" className="send" aria-label="Send" initial={{ scale: 0 }} animate={{ scale: 1 }}>
              ↑
            </motion.button>
          )
        )}
        {mic && (
          <motion.button
            type="button"
            className={`mic ${listening ? "on" : ""}`}
            aria-label={listening ? "Stop listening" : "Talk to Rafiki"}
            onClick={() => (listening ? stopListening() : listen(submit))}
            whileTap={{ scale: 0.9 }}
          >
            {listening && <span className="ripple" />}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
            </svg>
          </motion.button>
        )}
      </form>
      <div className="hint">{mic ? "Hold Space to talk · / to type" : "Press / to type"}</div>
    </div>
  );
}
