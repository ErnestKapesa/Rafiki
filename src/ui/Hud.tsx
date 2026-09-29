import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { levelProgress, paletteOf, questsForDate, titleFor } from "../../shared/game";
import { sfx } from "../audio/sfx";
import { questProgress, utcDay } from "../game/engine";
import { useGame } from "../game/store";
import { useRafiki, type Sheet } from "../lib/store";
import { Icon } from "./Icon";

/** Counts up smoothly whenever the value changes (numbers feel earned). */
function Ticker({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 90, damping: 18 });
  const text = useTransform(spring, (v) => Math.round(v).toLocaleString());
  useEffect(() => spring.set(value), [spring, value]);
  return <motion.span>{text}</motion.span>;
}

const SPECIES_ICON: Record<string, string> = { bear: "bear", bunny: "bunny", cat: "cat", sprout: "sprout", antenna: "antenna", unicorn: "unicorn" };

export function Hud() {
  const profile = useGame((g) => g.s.profile);
  const s = useGame((g) => g.s);
  const bump = useGame((g) => g.bump);
  const online = useGame((g) => g.online);
  const setSheet = (sheet: Sheet) => {
    sfx.open();
    useRafiki.getState().set({ sheet });
  };
  const lp = levelProgress(profile.xp);
  const pal = paletteOf(profile.character.color);
  const today = utcDay(new Date());
  const prog = questProgress(s, today);
  const quests = questsForDate(today);
  const claimable = quests.filter((q) => prog[q.counter] >= q.goal && !s.questClaims.some((c) => c.questId === q.id && c.day === today)).length;

  return (
    <>
      <header className="hud">
        <motion.button className="me" onClick={() => setSheet("wardrobe")} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} title="Wardrobe">
          <span className="avatar" style={{ background: `radial-gradient(circle at 35% 30%, #fff8, ${pal.body})` }}>
            <Icon name={SPECIES_ICON[profile.character.species]} size={30} />
            <svg className="ring" viewBox="0 0 44 44" aria-hidden>
              <circle cx="22" cy="22" r="20" />
              <motion.circle cx="22" cy="22" r="20" className="fill" initial={false} animate={{ pathLength: lp.pct }} transition={{ type: "spring", stiffness: 60 }} />
            </svg>
            <span className="lvl">{lp.level}</span>
          </span>
          <span className="who">
            <b>{profile.friendName}</b>
            <small>
              {titleFor(lp.level)} · {lp.into}/{lp.span} XP
            </small>
          </span>
        </motion.button>

        <div className="counters">
          <motion.div className="counter" key={`x${bump}`} initial={{ scale: 1.25 }} animate={{ scale: 1 }} title="Experience">
            <Icon name="xp" size={26} />
            <Ticker value={profile.xp} />
          </motion.div>
          <motion.div className="counter" key={`g${bump}`} initial={{ scale: 1.25 }} animate={{ scale: 1 }} title="Stardust — spend it in the wardrobe">
            <Icon name="gem" size={26} />
            <Ticker value={profile.stardust} />
          </motion.div>
          <div className={`counter ${profile.streak ? "" : "dim"}`} title="Daily streak">
            <Icon name="streak" size={26} />
            <span>{profile.streak}</span>
          </div>
          {online && <span className="sync" title="Progress synced to the cloud" />}
        </div>
      </header>

      <nav className="rail" aria-label="Game menu">
        {(
          [
            ["quests", "quest", "Quests", claimable],
            ["wardrobe", "palette", "Wardrobe", 0],
            ["galaxy", "galaxy", "Galaxy", 0],
            ["badges", "trophy", "Badges", 0],
            ["leaders", "crown", "Leaders", 0],
            ["journal", "journal", "Journal", 0],
            ["settings", "gear", "Settings", 0],
          ] as const
        ).map(([sheet, icon, label, badge], i) => (
          <motion.button
            key={sheet}
            className="rail-btn"
            onClick={() => setSheet(sheet)}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            whileHover={{ scale: 1.08, rotate: -3 }}
            whileTap={{ scale: 0.92 }}
            aria-label={label}
          >
            <Icon name={icon} size={30} />
            <span className="rail-label">{label}</span>
            {badge > 0 && <span className="dot-badge">{badge}</span>}
          </motion.button>
        ))}
      </nav>
    </>
  );
}
