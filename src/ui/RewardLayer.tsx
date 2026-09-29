import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { REWARDS, SHOP, titleFor } from "../../shared/game";
import { sfx } from "../audio/sfx";
import { badgeDef, useGame } from "../game/store";
import { useRafiki } from "../lib/store";
import { speak } from "../voice/voice";
import { Icon } from "./Icon";

/** Floating reward toasts + level-up / badge celebrations with confetti. */
export function RewardLayer() {
  const toasts = useGame((g) => g.toasts);
  const celebration = useGame((g) => g.celebrations[0]);

  useEffect(() => {
    if (!celebration) return;
    if (celebration.kind === "level") {
      sfx.levelUp();
      useRafiki.getState().set({ pose: "celebrate" });
      speak(`Woohoo! We reached level ${celebration.level}!`);
    } else {
      sfx.badge();
      useRafiki.getState().set({ pose: "happy" });
    }
    const t = setTimeout(() => useRafiki.getState().set({ pose: "idle" }), 1600);
    return () => clearTimeout(t);
  }, [celebration]);

  const unlocks = celebration?.kind === "level" ? SHOP.filter((s) => s.minLevel === celebration.level) : [];

  return (
    <>
      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`toast ${t.tone}`}
              layout
              initial={{ opacity: 0, y: 30, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
            >
              <Icon name={t.icon} size={26} />
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {celebration && (
          <motion.div className="celebrate" key={JSON.stringify(celebration)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => useGame.getState().popCelebration()}>
            <Confetti />
            <motion.div className="celebrate-card" initial={{ scale: 0.4, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} onClick={(e) => e.stopPropagation()}>
              {celebration.kind === "level" ? (
                <>
                  <div className="burst">
                    <Icon name="xp" size={96} float />
                    <span className="big-level">{celebration.level}</span>
                  </div>
                  <h2>Level up!</h2>
                  <p>
                    You're now a <b>{titleFor(celebration.level)}</b>
                  </p>
                  {unlocks.length > 0 && (
                    <div className="unlocks">
                      <small>New in the wardrobe</small>
                      <div>
                        {unlocks.map((u) => (
                          <span key={u.id} className="unlock">
                            <Icon name={u.icon} size={34} />
                            {u.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="burst">
                    <Icon name={badgeDef(celebration.badge).icon} size={96} float />
                  </div>
                  <small className="eyebrow">Badge unlocked</small>
                  <h2>{badgeDef(celebration.badge).name}</h2>
                  <p>{badgeDef(celebration.badge).desc}</p>
                </>
              )}
              <motion.button className="btn primary big" onClick={() => useGame.getState().popCelebration()} whileTap={{ scale: 0.95 }}>
                Yay! <Icon name="party" size={24} />
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Lightweight canvas confetti — no dependency. */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const dpr = Math.min(devicePixelRatio, 2);
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ["#ffd36e", "#ff7aa8", "#7b5cff", "#5fd3b3", "#6fa8ff", "#ffffff"];
    const bits = Array.from({ length: 160 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: innerHeight / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 16 - 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      c: colors[(Math.random() * colors.length) | 0],
      round: Math.random() < 0.3,
    }));
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const b of bits) {
        b.vy += 0.38;
        b.vx *= 0.99;
        b.x += b.vx;
        b.y += b.vy;
        b.r += b.vr;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.r);
        ctx.fillStyle = b.c;
        if (b.round) {
          ctx.beginPath();
          ctx.arc(0, 0, b.w / 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2)));
        ctx.restore();
      }
      if (bits.some((b) => b.y < innerHeight + 40)) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="confetti" aria-hidden />;
}

export const QUIZ_XP = REWARDS.quizCorrect.xp;
