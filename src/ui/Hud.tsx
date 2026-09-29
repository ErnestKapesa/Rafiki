import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { levelProgress, questsForDate, titleFor } from "../../shared/game";
import { sfx } from "../audio/sfx";
import { questProgress, utcDay } from "../game/engine";
import { useGame } from "../game/store";
import { useRafiki, type Sheet } from "../lib/store";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { useIsPhone } from "./useIsPhone";

/** Counts up smoothly whenever the value changes (numbers feel earned). */
function Ticker({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 90, damping: 18 });
  const text = useTransform(spring, (v) => Math.round(v).toLocaleString());
  useEffect(() => spring.set(value), [spring, value]);
  return <motion.span>{text}</motion.span>;
}

const DOCK: { sheet: Exclude<Sheet, null>; icon: string; label: string; tint: string }[] = [
  { sheet: "news", icon: "news2", label: "News", tint: "#FFE6D6" },
  { sheet: "quests", icon: "target", label: "Quests", tint: "#FFE3E3" },
  { sheet: "wardrobe", icon: "hanger", label: "Closet", tint: "#FFE4F0" },
  { sheet: "galaxy", icon: "planet", label: "Galaxy", tint: "#EEE6FF" },
  { sheet: "badges", icon: "trophy", label: "Badges", tint: "#FFF2CC" },
  { sheet: "leaders", icon: "crown", label: "Ranks", tint: "#E3F8EC" },
  { sheet: "journal", icon: "book", label: "Journal", tint: "#FFEBD9" },
  { sheet: "settings", icon: "gear", label: "Settings", tint: "#EDEFF6" },
];

export function Hud() {
  const profile = useGame((g) => g.s.profile);
  const s = useGame((g) => g.s);
  const bump = useGame((g) => g.bump);
  const online = useGame((g) => g.online);
  const open = (sheet: Sheet) => {
    sfx.open();
    useRafiki.getState().set({ sheet });
  };
  const phone = useIsPhone();
  const sheet = useRafiki((st) => st.sheet);
  const hasAnswer = useRafiki((st) => !!st.current);
  const lp = levelProgress(profile.xp);
  const today = utcDay(new Date());
  const prog = questProgress(s, today);
  const claimable = questsForDate(today).filter((q) => prog[q.counter] >= q.goal && !s.questClaims.some((c) => c.questId === q.id && c.day === today)).length;

  return (
    <>
      <header className="hud">
        <motion.button className="player" onClick={() => open("wardrobe")} whileTap={{ scale: 0.95, y: 3 }} title="Closet">
          <span className="player-pic">
            <Avatar c={profile.character} size={46} />
            <span className="lvl-star">
              <Icon name="star" size={26} />
              <b>{lp.level}</b>
            </span>
          </span>
          <span className="player-info">
            <b>{profile.friendName}</b>
            <span className="xpbar" aria-label={`${lp.into} of ${lp.span} XP to next level`}>
              <motion.i initial={false} animate={{ width: `${Math.max(4, lp.pct * 100)}%` }} transition={{ type: "spring", stiffness: 70, damping: 14 }} />
            </span>
            <small>{titleFor(lp.level)}</small>
          </span>
        </motion.button>

        <div className="status">
          <motion.span className="stat" key={`x${bump}`} initial={{ scale: 1.3 }} animate={{ scale: 1 }} title="Experience">
            <Icon name="star" size={24} />
            <Ticker value={profile.xp} />
          </motion.span>
          <motion.span className="stat" key={`g${bump}`} initial={{ scale: 1.3 }} animate={{ scale: 1 }} title="Stardust — spend it in the Closet">
            <Icon name="gem" size={24} />
            <Ticker value={profile.stardust} />
          </motion.span>
          <span className={`stat ${profile.streak ? "" : "dim"}`} title="Daily streak">
            <Icon name="flame" size={24} />
            <span>{profile.streak}</span>
          </span>
          {online && <span className="sync" title="Saved to the cloud" />}
        </div>
      </header>

      {phone ? (
        <nav className="tabbar" aria-label="Menu">
          {(
            [
              ["home", "home", "Home"],
              ["news", "news2", "News"],
              ["quests", "target", "Quests"],
              ["wardrobe", "hanger", "Closet"],
              ["more", "grid", "More"],
            ] as const
          ).map(([id, icon, label]) => {
            const active = id === "home" ? !sheet && !hasAnswer : sheet === id || (id === "more" && ["galaxy", "badges", "leaders", "journal", "settings", "more"].includes(sheet ?? ""));
            return (
              <motion.button
                key={id}
                className={`tab ${active ? "on" : ""}`}
                whileTap={{ scale: 0.88 }}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  if (id === "home") {
                    sfx.tap();
                    useRafiki.getState().set({ sheet: null, current: null, reader: null, pose: "idle" });
                  } else open(id);
                }}
              >
                <span className="tab-icon">
                  <Icon name={icon} size={26} />
                  {id === "quests" && claimable > 0 && <span className="dot-badge">{claimable}</span>}
                </span>
                <span className="tab-label">{label}</span>
                {active && <motion.i layoutId="tab-dot" className="tab-dot" />}
              </motion.button>
            );
          })}
        </nav>
      ) : (
        <nav className="dock" aria-label="Menu">
          {DOCK.map((d, i) => (
            <motion.button
              key={d.sheet}
              className="dock-btn"
              style={{ ["--tint" as string]: d.tint }}
              onClick={() => open(d.sheet)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.04, type: "spring", stiffness: 400, damping: 22 }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.9, y: 2 }}
              aria-label={d.label}
            >
              <span className="dock-tile">
                <Icon name={d.icon} size={30} />
              </span>
              <span className="dock-label">{d.label}</span>
              {d.sheet === "quests" && claimable > 0 && <span className="dot-badge">{claimable}</span>}
            </motion.button>
          ))}
        </nav>
      )}
    </>
  );
}
