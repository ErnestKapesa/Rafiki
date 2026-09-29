import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Answer } from "../lib/store";
import { useRafiki } from "../lib/store";

const STAGES = [
  { key: "plan", label: "Plan", icon: "🧭" },
  { key: "search", label: "Search", icon: "🛰️" },
  { key: "read", label: "Read", icon: "📖" },
  { key: "write", label: "Write", icon: "✍️" },
] as const;

const order = { plan: 0, search: 1, read: 2, write: 3, done: 4 } as const;

export function AnswerPanel({ answer, onAsk }: { answer: Answer; onAsk: (q: string) => void }) {
  const md = useMemo(() => linkCitations(answer.markdown), [answer.markdown]);
  const streaming = answer.stage !== "done" && !answer.error;

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
        <h2>{answer.question}</h2>
        {answer.mode === "deep" && <span className="pill deep">Deep Dive</span>}
      </header>

      <Journey answer={answer} />

      {answer.queries.length > 0 && (
        <div className="queries">
          {answer.queries.map((q, i) => (
            <motion.span key={q} className="query" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
              🔎 {q}
            </motion.span>
          ))}
        </div>
      )}

      {answer.sources.length > 0 && <SourceStrip answer={answer} />}

      {answer.reasoning && <Reasoning text={answer.reasoning} live={streaming && !answer.markdown} />}

      {answer.error && (
        <div className="error">
          <strong>Rafiki tripped over a moon rock.</strong> {answer.error}
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
                return <Cite n={n} url={src?.url} title={src?.title} domain={src?.domain} />;
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

      <AnimatePresence>
        {answer.related.length > 0 && (
          <motion.div className="related" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3>Wander further</h3>
            {answer.related.map((q, i) => (
              <motion.button
                key={q}
                className="chip"
                onClick={() => onAsk(q)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                {q} →
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
      {stages.map((s) => {
        const state = order[s.key] < now ? "done" : order[s.key] === now ? "active" : "todo";
        return (
          <div key={s.key} className={`step ${state}`}>
            <motion.span className="dot" animate={state === "active" ? { scale: [1, 1.25, 1] } : { scale: 1 }} transition={{ repeat: Infinity, duration: 1.2 }}>
              {state === "done" ? "✓" : s.icon}
            </motion.span>
            <span>{s.label}</span>
          </div>
        );
      })}
      {answer.stage !== "done" && (
        <motion.div className="stage-label" key={answer.stageLabel} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
          {answer.stageLabel}…{answer.stageModel && <em> · {shortModel(answer.stageModel)}</em>}
        </motion.div>
      )}
    </div>
  );
}

function SourceStrip({ answer }: { answer: Answer }) {
  const setHover = (id: number | null) => useRafiki.getState().set({ hoveredSource: id });
  return (
    <div className="sources">
      {answer.sources.map((s, i) => (
        <motion.a
          key={s.url}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="source"
          initial={{ opacity: 0, y: 20, rotate: -3 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ delay: i * 0.06, type: "spring", stiffness: 260, damping: 20 }}
          whileHover={{ y: -4 }}
          onMouseEnter={() => setHover(s.id)}
          onMouseLeave={() => setHover(null)}
        >
          <div className="source-top">
            {s.favicon ? <img src={s.favicon} alt="" /> : <span className="fav-fallback">{s.domain[0]}</span>}
            <span className="domain">{s.domain}</span>
            <span className="num">{s.id}</span>
          </div>
          <div className="source-title">{s.title}</div>
        </motion.a>
      ))}
    </div>
  );
}

function Cite({ n, url, title, domain }: { n: number; url?: string; title?: string; domain?: string }) {
  const set = useRafiki((s) => s.set);
  return (
    <a
      className="cite"
      href={url}
      target="_blank"
      rel="noreferrer"
      title={title ? `${title} — ${domain}` : undefined}
      onMouseEnter={() => set({ hoveredSource: n })}
      onMouseLeave={() => set({ hoveredSource: null })}
    >
      {n}
    </a>
  );
}

function Reasoning({ text, live }: { text: string; live: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`reasoning ${open ? "open" : ""}`}>
      <button onClick={() => setOpen(!open)}>
        <span className={live ? "pulse" : ""}>🧠</span> {live ? "Nemotron is reasoning…" : "How Rafiki reasoned"} <span className="caret">{open ? "▴" : "▾"}</span>
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
  const total = answer.metrics.reduce((a, m) => Math.max(a, m.ms), 0);
  return (
    <footer className="metrics">
      <div className="powered">
        Powered by <b>NVIDIA Nemotron</b> on <b>Nebius Token Factory</b> · search by <b>Tavily</b>
      </div>
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
function linkCitations(md: string) {
  return md.replace(/\[(\d+(?:\s*[,;]\s*\d+)*)\](?!\()/g, (_, nums: string) =>
    nums
      .split(/[,;]/)
      .map((n) => `[${n.trim()}](#cite-${n.trim()})`)
      .join(""),
  );
}
