import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PageDigest, PageRead } from "../../shared/types";
import { sfx } from "../audio/sfx";
import { askPage, pageTldr, readPage } from "../lib/api";
import { useRafiki, type ReaderTarget } from "../lib/store";
import { speak } from "../voice/voice";
import { Icon } from "./Icon";
import { useIsPhone } from "./useIsPhone";

type QA = { q: string; a: string | null };

/**
 * In-app browser. "Read" shows clean article text (works on every site via
 * Tavily Extract) with a Nemotron TL;DR and page Q&A; "Web" shows the live
 * page in an iframe when the site allows embedding.
 */
export function Reader() {
  const target = useRafiki((s) => s.reader);
  const close = () => {
    sfx.close();
    useRafiki.getState().set({ reader: null });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && useRafiki.getState().reader && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return <AnimatePresence>{target && <ReaderSheet key={target.url} t={target} onClose={close} />}</AnimatePresence>;
}

// `t` is captured at mount so the exit animation never reads a cleared store value.
function ReaderSheet({ t, onClose }: { t: ReaderTarget; onClose: () => void }) {
  const phone = useIsPhone();
  const drag = useDragControls();
  const [page, setPage] = useState<PageRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tldr, setTldr] = useState<PageDigest | null>(null);
  const [tab, setTab] = useState<"read" | "web">("read");
  const [qa, setQa] = useState<QA[]>([]);
  const [q, setQ] = useState("");
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    readPage(t.url, ac.signal)
      .then((p) => {
        setPage(p);
        if (p.markdown.trim()) pageTldr(p.markdown, ac.signal).then(setTldr).catch(() => {});
        else if (p.embeddable) setTab("web");
      })
      .catch((e) => !ac.signal.aborted && setError((e as Error).message));
    return () => ac.abort();
  }, [t.url]);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = q.trim();
    if (!question || !page) return;
    setQ("");
    sfx.pop();
    setQa((l) => [...l, { q: question, a: null }]);
    setTimeout(() => body.current?.scrollTo({ top: body.current.scrollHeight, behavior: "smooth" }), 50);
    const answer = await askPage(page.markdown, question)
      .then((r) => r.answer)
      .catch((err) => `Hmm, I couldn't read that: ${(err as Error).message}`);
    setQa((l) => l.map((x) => (x.q === question && x.a === null ? { ...x, a: answer } : x)));
    setTimeout(() => body.current?.scrollTo({ top: body.current.scrollHeight, behavior: "smooth" }), 50);
  };

  const openTab = () => window.open(t.url, "_blank", "noopener,noreferrer");

  return (
    <>
      {phone && <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />}
      <motion.aside
        className="reader"
        role="dialog"
        aria-label={`Reading ${t.domain}`}
        initial={phone ? { y: "100%" } : { x: 60, opacity: 0 }}
        animate={phone ? { y: 0 } : { x: 0, opacity: 1 }}
        exit={phone ? { y: "100%" } : { x: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        drag={phone ? "y" : false}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, i) => (i.offset.y > 120 || i.velocity.y > 600) && onClose()}
      >
        <div className="reader-top" onPointerDown={(e) => phone && drag.start(e)}>
          <div className="grabber" />
          <div className="reader-head">
            {t.favicon ? <img className="fav" src={t.favicon} alt="" onError={(e) => (e.currentTarget.style.display = "none")} /> : <Icon name="globe" size={28} />}
            <div className="reader-title">
              <b>{page?.title && page.title !== t.domain ? page.title : t.title}</b>
              <small>{t.domain}</small>
            </div>
            <button className="x" onClick={openTab} aria-label="Open in new tab" title="Open in new tab">
              <Icon name="external" size={22} />
            </button>
            <button className="x" onClick={onClose} aria-label="Close reader">
              ✕
            </button>
          </div>
          <div className="tabs">
            <button className={tab === "read" ? "on" : ""} onClick={() => (sfx.tap(), setTab("read"))}>
              Reader
            </button>
            <button className={tab === "web" ? "on" : ""} onClick={() => (sfx.tap(), setTab("web"))}>
              Web page
            </button>
          </div>
        </div>

        <div className="reader-body" ref={body}>
          {tab === "read" && (
            <>
              {error && (
                <div className="reader-empty">
                  <Icon name="map" size={56} />
                  <b>Couldn't fetch this page.</b>
                  <p className="muted">{error}</p>
                  <button className="btn primary" onClick={openTab}>
                    <Icon name="external" size={22} /> Open the website
                  </button>
                </div>
              )}
              {!page && !error && <ReaderSkeleton />}
              {page && (
                <>
                  <div className={`tldr ${tldr ? "" : "loading"}`}>
                    <div className="tldr-head">
                      <Icon name="sparkle" size={26} />
                      <b>TL;DR</b>
                      {tldr && <small>{tldr.minutes} min read</small>}
                      {tldr?.summary && (
                        <button className="btn small white" onClick={() => speak(`${tldr.summary} ${tldr.points.join(". ")}`)} aria-label="Read the summary aloud">
                          <Icon name="sound" size={18} /> Listen
                        </button>
                      )}
                    </div>
                    {tldr ? (
                      <>
                        <p>{tldr.summary}</p>
                        <ul>
                          {tldr.points.map((p, i) => (
                            <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                              {p}
                            </motion.li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="muted">Rafiki is skimming the page…</p>
                    )}
                  </div>
                  {page.markdown.trim() ? (
                    <article className="markdown reader-article">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noreferrer">
                              {children}
                            </a>
                          ),
                          img: ({ src, alt }) => (typeof src === "string" && /^https:\/\//.test(src) ? <img src={src} alt={alt ?? ""} loading="lazy" /> : null),
                        }}
                      >
                        {page.markdown}
                      </ReactMarkdown>
                    </article>
                  ) : (
                    <p className="muted">This page didn't share any readable text. Try the Web page tab.</p>
                  )}
                  {qa.map((x, i) => (
                    <div key={i} className="qa">
                      <div className="qa-q">{x.q}</div>
                      <div className="qa-a">
                        <span className="nametag small">Rafiki</span>
                        {x.a === null ? (
                          <span className="dots">
                            <i />
                            <i />
                            <i />
                          </span>
                        ) : (
                          <ReactMarkdown>{x.a}</ReactMarkdown>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
          {tab === "web" &&
            (page?.embeddable ? (
              <iframe
                className="reader-frame"
                src={t.url}
                title={t.title}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            ) : (
              <div className="reader-empty">
                <Icon name="lock" size={56} />
                <b>{page ? "This website doesn't allow previews inside other apps." : "Checking if this site can be previewed…"}</b>
                <p className="muted">The Reader tab still shows its text. You can also open the real page in a new tab.</p>
                <button className="btn primary" onClick={openTab}>
                  <Icon name="external" size={22} /> Open {t.domain}
                </button>
              </div>
            ))}
        </div>

        {tab === "read" && page?.markdown.trim() && (
          <form className="ask-page" onSubmit={ask}>
            <Icon name="chat" size={26} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask this page anything…" aria-label="Ask this page" />
            <button className="btn small primary" disabled={!q.trim()}>
              Ask
            </button>
          </form>
        )}
      </motion.aside>
    </>
  );
}

function ReaderSkeleton() {
  return (
    <div className="skeleton reader-skel">
      <i style={{ width: "40%", height: 22 }} />
      {[96, 88, 92, 70, 94, 80, 60].map((w, i) => (
        <i key={i} style={{ width: `${w}%`, animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  );
}
