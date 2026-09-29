import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { sfx } from "../audio/sfx";
import { useRafiki } from "../lib/store";
import { canListen, isListening, listen, stopListening } from "../voice/voice";
import { Icon } from "./Icon";

export type AskOpts = { viaVoice?: boolean };

export function Composer({ onAsk, busy, onStop }: { onAsk: (q: string, opts?: AskOpts) => void; busy: boolean; onStop: () => void }) {
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const pose = useRafiki((s) => s.pose);
  const interim = useRafiki((s) => s.interim);
  const mode = useRafiki((s) => s.mode);
  const set = useRafiki((s) => s.set);
  const listening = pose === "listening";
  const mic = canListen();
  const onAskRef = useRef(onAsk);
  onAskRef.current = onAsk;

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    setText("");
    onAsk(v);
  };
  const talk = () => listen((heard) => onAskRef.current(heard, { viaVoice: true }));

  // "/" focuses the box; holding Space (outside inputs) is push-to-talk.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.code === "Space" && !typing && !e.repeat && mic && !useRafiki.getState().sheet) {
        e.preventDefault();
        talk();
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
      <div className="mode-toggle" role="radiogroup" aria-label="Expedition type">
        {(["quick", "deep"] as const).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            className={mode === m ? "on" : ""}
            onClick={() => {
              sfx.tap();
              set({ mode: m });
            }}
          >
            {mode === m && <motion.span layoutId="mode-pill" className="mode-pill" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
            <span className="mode-label">
              <Icon name={m === "quick" ? "quick" : "galaxy"} size={18} />
              {m === "quick" ? "Quick trip" : "Deep Dive"}
              <small>{m === "quick" ? "+20 XP" : "+40 XP"}</small>
            </span>
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
        <Icon name="search" size={24} className="composer-icon" />
        <input
          ref={input}
          value={listening ? interim : text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? "I'm all ears…" : "Where should we explore?"}
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
              <Icon name="rocket" size={24} />
            </motion.button>
          )
        )}
        {mic && (
          <motion.button
            type="button"
            className={`mic ${listening ? "on" : ""}`}
            aria-label={listening ? "Stop listening" : "Talk to Rafiki"}
            onClick={() => (listening ? stopListening() : talk())}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.06 }}
          >
            {listening && <span className="ripple" />}
            <Icon name="mic" size={30} />
          </motion.button>
        )}
      </form>
      <div className="hint">{mic ? "Hold Space to talk · +5 XP for voice" : "Press / to type"}</div>
    </div>
  );
}
