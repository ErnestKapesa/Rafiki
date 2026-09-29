import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { REWARDS } from "../../shared/game";
import { answerQuiz, visitSource } from "../game/actions";
import type { Answer } from "../lib/store";
import { useRafiki } from "../lib/store";
import { Icon } from "./Icon";

const STAGES = [
  { key: "plan", label: "Plan", icon: "compass" },
  { key: "search", label: "Search", icon: "satellite" },
  { key: "read", label: "Read", icon: "books" },
  { key: "write", label: "Write", icon: "scroll" },
] as const;
const order = { plan: 0, search: 1, read: 2, write: 3, done: 4 } as const;

export function AnswerPanel({ answer, onAsk }: { answer: Answer; onAsk: (q: string, trailFrom?: Answer) => void }) {
  const md = useMemo(() => linkCitations(answer.markdown), [answer.markdown]);
  const streaming = answer.stage !== "done" && !answer.error;
  const found = answer.discovered.length;

  return (
    <motion.section
      className="panel"
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
    >
      <header className="panel-head">
        <motion.span className="emoji" key={answer.emoji} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }}>
          {answer.emoji}
        </motion.span>
        <div className="panel-title">
          <small className="eyebrow">
            {answer.mode === "deep" ? "Deep Dive expedition" : "Expedition"}
            {answer.parentId ? " · on the trail" : ""}
          </small>
          <h2>{answer.question}</h2>
        </div>
      </header>

      <Journey answer={answer} />

      {answer.sources.length > 0 && (
        <div className="worlds-head">
          <h3>
            <Icon name="planet" size={24} /> Worlds to explore
          </h3>
          <span className="found-count">
            <motion.b key={found} initial={{ scale: 1.6 }} animate={{ scale: 1 }}>
              {found}
            </motion.b>
            /{answer.sources.length} found
          </span>
        </div>
      )}
      {answer.sources.length > 0 && <WorldCards answer={answer} />}

      {answer.reasoning && <Reasoning text={answer.reasoning} live={streaming && !answer.markdown} />}

      {answer.error && (
        <div className="error">
          <Icon name="cross" size={22} />
          <span>
            <strong>Rafiki tripped over a moon rock.</strong> {answer.error}
          </span>
        </div>
      )}

      <div className={`markdown ${streaming ? "streaming" : ""}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => {
              if (href?.startsWith("#cite-")) {
                const n = Number(href.slice(6));
                const src = answer.sources.find((s) => s.id === n);
                return <Cite n={n} answer={answer} src={src} />;
              }
              return (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              );
            },
          }}
        >
          {md}
        </ReactMarkdown>
        {!answer.markdown && streaming && <Skeleton />}
      </div>

      {answer.images.length > 0 && <Gallery answer={answer} />}

      <AnimatePresence>{answer.quiz && <QuizCard answer={answer} />}</AnimatePresence>

      <AnimatePresence>
        {answer.related.length > 0 && (
          <motion.div className="related" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3>
              <Icon name="compass" size={24} /> Continue the trail <span className="xp-chip">+{REWARDS.trailBonus.xp} XP / step</span>
            </h3>
            {answer.related.map((q, i) => (
              <motion.button
                key={q}
                className="trail-chip"
                onClick={() => onAsk(q, answer)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.97 }}
              >
                <span className="step-dot">{i + 1}</span>
                {q}
                <span className="go">→</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {answer.metrics.length > 0 && <Metrics answer={answer} />}
    </motion.section>
  );
}

function Journey({ answer }: { answer: Answer }) {
  const now = order[answer.stage];
  const stages = answer.mode === "deep" ? STAGES : STAGES.filter((s) => s.key !== "read");
  return (
    <div className="journey">
      <div className="journey-track">
        {stages.map((s, i) => {
          const state = order[s.key] < now ? "done" : order[s.key] === now ? "active" : "todo";
          return (
            <div key={s.key} className={`step ${state}`}>
              <motion.span className="dot" animate={state === "active" ? { y: [0, -4, 0] } : { y: 0 }} transition={{ repeat: Infinity, duration: 0.9 }}>
                <Icon name={state === "done" ? "check" : s.icon} size={22} />
              </motion.span>
              <span>{s.label}</span>
              {i < stages.length - 1 && <i className={`link ${state === "done" ? "lit" : ""}`} />}
            </div>
          );
        })}
      </div>
      {answer.stage !== "done" && !answer.error && (
        <motion.div className="stage-label" key={answer.stageLabel} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
          {answer.stageLabel}…{answer.stageModel && <em> · {shortModel(answer.stageModel)}</em>}
        </motion.div>
      )}
      {answer.queries.length > 0 && (
        <div className="queries">
          {answer.queries.map((q, i) => (
            <motion.span key={q} className="query" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
              <Icon name="search" size={14} /> {q}
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
}

function WorldCards({ answer }: { answer: Answer }) {
  const setHover = (id: number | null) => useRafiki.getState().set({ hoveredSource: id });
  return (
    <div className="sources">
      {answer.sources.map((s, i) => {
        const found = answer.discovered.includes(s.url);
        return (
          <motion.a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className={`source ${found ? "found" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              visitSource(answer, s);
            }}
            initial={{ opacity: 0, y: 20, rotate: -3 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 260, damping: 20 }}
            whileHover={{ y: -5, rotate: i % 2 ? 1 : -1 }}
            onMouseEnter={() => setHover(s.id)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="source-top">
              {s.favicon ? <img src={s.favicon} alt="" onError={(e) => (e.currentTarget.style.display = "none")} /> : null}
              <span className="domain">{s.domain}</span>
              <span className="num">{s.id}</span>
            </div>
            <div className="source-title">{s.title}</div>
            <div className="source-foot">
              {found ? (
                <span className="stamp">
                  <Icon name="check" size={16} /> Discovered
                </span>
              ) : (
                <span className="visit">
                  Visit <b>+{REWARDS.discovery.xp} XP</b>
                </span>
              )}
            </div>
          </motion.a>
        );
      })}
    </div>
  );
}

function Cite({ n, answer, src }: { n: number; answer: Answer; src?: Answer["sources"][number] }) {
  const set = useRafiki((s) => s.set);
  return (
    <a
      className={`cite ${src && answer.discovered.includes(src.url) ? "seen" : ""}`}
      href={src?.url}
      target="_blank"
      rel="noreferrer"
      title={src ? `${src.title} · ${src.domain}` : undefined}
      onClick={(e) => {
        if (!src) return;
        e.preventDefault();
        visitSource(answer, src);
      }}
      onMouseEnter={() => set({ hoveredSource: n })}
      onMouseLeave={() => set({ hoveredSource: null })}
    >
      {n}
    </a>
  );
}

function QuizCard({ answer }: { answer: Answer }) {
  const q = answer.quiz!;
  const picked = answer.quizPick;
  const done = picked !== null;
  const right = done && picked === q.answer;
  return (
    <motion.div className={`quiz ${done ? (right ? "right" : "wrong") : ""}`} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 220, damping: 20 }}>
      <div className="quiz-head">
        <Icon name="bulb" size={32} float={!done} />
        <div>
          <small className="eyebrow">Pop quiz · +{REWARDS.quizCorrect.xp} XP</small>
          <b>{q.question}</b>
        </div>
      </div>
      <div className="quiz-options">
        {q.options.map((o, i) => {
          const state = !done ? "" : i === q.answer ? "correct" : i === picked ? "picked" : "dim";
          return (
            <motion.button
              key={i}
              className={`quiz-opt ${state}`}
              disabled={done}
              onClick={() => answerQuiz(answer, i)}
              whileHover={!done ? { scale: 1.02 } : {}}
              whileTap={!done ? { scale: 0.97 } : {}}
              animate={state === "picked" ? { x: [0, -8, 8, -5, 5, 0] } : state === "correct" ? { scale: [1, 1.05, 1] } : {}}
            >
              <span className="letter">{"ABC"[i]}</span>
              {o}
              {state === "correct" && <Icon name="check" size={20} />}
              {state === "picked" && <Icon name="cross" size={20} />}
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence>
        {done && (
          <motion.p className="quiz-explain" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
            {right ? "Brilliant! " : "So close! "}
            {q.explain}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Reasoning({ text, live }: { text: string; live: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`reasoning ${open ? "open" : ""}`}>
      <button onClick={() => setOpen(!open)}>
        <Icon name="brain" size={22} className={live ? "pulse" : ""} /> {live ? "Nemotron is reasoning…" : "How Rafiki reasoned"} <span className="caret">{open ? "▴" : "▾"}</span>
      </button>
      {(open || live) && <pre>{live && !open ? text.slice(-280) : text}</pre>}
    </div>
  );
}

function Gallery({ answer }: { answer: Answer }) {
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const imgs = answer.images.filter((i) => !broken.has(i.url)).slice(0, 6);
  if (!imgs.length) return null;
  return (
    <div className="gallery">
      {imgs.map((img, i) => (
        <motion.a
          key={img.url}
          href={img.url}
          target="_blank"
          rel="noreferrer"
          initial={{ opacity: 0, scale: 0.8, rotate: i % 2 ? 4 : -4 }}
          animate={{ opacity: 1, scale: 1, rotate: i % 2 ? 1.5 : -1.5 }}
          whileHover={{ scale: 1.06, rotate: 0, zIndex: 2 }}
          transition={{ delay: 0.2 + i * 0.07, type: "spring", stiffness: 200, damping: 18 }}
          className="polaroid"
          title={img.description}
        >
          <img src={img.url} alt={img.description ?? ""} loading="lazy" onError={() => setBroken((b) => new Set(b).add(img.url))} />
        </motion.a>
      ))}
    </div>
  );
}

function Metrics({ answer }: { answer: Answer }) {
  const [open, setOpen] = useState(false);
  const total = answer.metrics.reduce((a, m) => Math.max(a, m.ms), 0);
  const sum = answer.metrics.reduce((a, m) => a + (m.tokens ?? 0), 0);
  return (
    <footer className="metrics">
      <button className="powered" onClick={() => setOpen(!open)}>
        <Icon name="gear" size={18} /> Under the hood: <b>NVIDIA Nemotron</b> on <b>Nebius Token Factory</b> · <b>Tavily</b>
        {sum ? ` · ${sum.toLocaleString()} tokens` : ""} <span className="caret">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="bars">
          {answer.metrics.map((m) => (
            <div key={m.step} className="bar-row">
              <span className="bar-name">{m.step}</span>
              <span className="bar">
                <motion.i initial={{ width: 0 }} animate={{ width: `${(m.ms / total) * 100}%` }} transition={{ duration: 0.8 }} />
              </span>
              <span className="bar-meta">
                {(m.ms / 1000).toFixed(1)}s{m.model && ` · ${shortModel(m.model)}`}
                {m.tokens ? ` · ${m.tokens} tok` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </footer>
  );
}

function Skeleton() {
  return (
    <div className="skeleton">
      {[92, 78, 85, 60].map((w, i) => (
        <i key={i} style={{ width: `${w}%`, animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  );
}

export function shortModel(id: string) {
  return id.split("/").pop()!.replace(/^nvidia-/i, "");
}

/** "[1]" / "[1, 3]" → markdown links the renderer turns into citation chips. */
export function linkCitations(md: string) {
  return md.replace(/\[(\d+(?:\s*[,;]\s*\d+)*)\](?!\()/g, (_, nums: string) =>
    nums
      .split(/[,;]/)
      .map((n) => `[${n.trim()}](#cite-${n.trim()})`)
      .join(""),
  );
}
