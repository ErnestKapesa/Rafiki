import { motion } from "motion/react";
import { PALETTES, SHOP, levelFor, type Character, type EyeStyle, type Pattern, type Species } from "../../shared/game";
import { sfx } from "../audio/sfx";
import { useGame } from "../game/store";
import { Icon } from "./Icon";

export const SPECIES: { id: Species; name: string; icon: string }[] = [
  { id: "bear", name: "Bear", icon: "bear" },
  { id: "bunny", name: "Bunny", icon: "bunny" },
  { id: "cat", name: "Kitty", icon: "cat" },
  { id: "sprout", name: "Sprout", icon: "sprout" },
  { id: "antenna", name: "Alien", icon: "antenna" },
  { id: "unicorn", name: "Unicorn", icon: "unicorn" },
];
const EYES: { id: EyeStyle; name: string; icon: string }[] = [
  { id: "round", name: "Bright", icon: "eyes_round" },
  { id: "sparkle", name: "Sparkly", icon: "eyes_sparkle" },
  { id: "sleepy", name: "Dreamy", icon: "eyes_sleepy" },
];
const PATTERNS: { id: Pattern; name: string }[] = [
  { id: "belly", name: "Tummy" },
  { id: "spots", name: "Spots" },
  { id: "none", name: "Plain" },
];

export type Tab = "look" | "hat" | "neck" | "face";

/**
 * Character editor. In onboarding (`freeOnly`) only free options show; in the
 * wardrobe, premium items show price/level locks and can be bought in place.
 */
export function Customizer({ value, onChange, tab, freeOnly }: { value: Character; onChange: (c: Character) => void; tab: Tab; freeOnly?: boolean }) {
  const inventory = useGame((g) => g.s.inventory);
  const xp = useGame((g) => g.s.profile.xp);
  const stardust = useGame((g) => g.s.profile.stardust);
  const level = levelFor(xp);
  const shopItem = (id: string) => SHOP.find((s) => s.id === id);
  const owned = (id: string) => !shopItem(id) || inventory.includes(id);

  const pick = (patch: Partial<Character>) => {
    sfx.pop();
    onChange({ ...value, ...patch });
  };

  const Lock = ({ id }: { id: string }) => {
    const it = shopItem(id);
    if (!it || owned(id)) return null;
    if (level < it.minLevel) return <span className="lock">Lv {it.minLevel}</span>;
    return (
      <span className={`price ${stardust < it.price ? "short" : ""}`}>
        <Icon name="gem" size={14} />
        {it.price}
      </span>
    );
  };

  if (tab === "look") {
    return (
      <div className="customizer">
        <h4>Species</h4>
        <div className="opt-grid">
          {SPECIES.filter((s) => !freeOnly || owned(s.id)).map((s) => (
            <motion.button key={s.id} className={`opt ${value.species === s.id ? "on" : ""}`} onClick={() => pick({ species: s.id })} whileTap={{ scale: 0.9 }} whileHover={{ y: -3 }}>
              <Icon name={s.icon} size={40} />
              <span>{s.name}</span>
              <Lock id={s.id} />
            </motion.button>
          ))}
        </div>
        <h4>Fur</h4>
        <div className="swatches">
          {PALETTES.filter((p) => !freeOnly || owned(p.id)).map((p) => (
            <motion.button
              key={p.id}
              className={`swatch ${value.color === p.id ? "on" : ""}`}
              style={{ background: `radial-gradient(circle at 35% 30%, ${p.belly}, ${p.body} 60%, ${p.accent})` }}
              onClick={() => pick({ color: p.id })}
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.1 }}
              aria-label={p.name}
              title={p.name}
            >
              <Lock id={p.id} />
            </motion.button>
          ))}
        </div>
        <h4>Eyes</h4>
        <div className="opt-grid three">
          {EYES.map((e) => (
            <motion.button key={e.id} className={`opt ${value.eyes === e.id ? "on" : ""}`} onClick={() => pick({ eyes: e.id })} whileTap={{ scale: 0.9 }} whileHover={{ y: -3 }}>
              <Icon name={e.icon} size={36} />
              <span>{e.name}</span>
            </motion.button>
          ))}
        </div>
        <h4>Pattern</h4>
        <div className="seg">
          {PATTERNS.map((p) => (
            <button key={p.id} className={value.pattern === p.id ? "on" : ""} onClick={() => pick({ pattern: p.id })}>
              {p.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const items = SHOP.filter((s) => s.kind === tab);
  return (
    <div className="customizer">
      <div className="opt-grid">
        <motion.button className={`opt ${value[tab] === null ? "on" : ""}`} onClick={() => pick({ [tab]: null })} whileTap={{ scale: 0.9 }}>
          <Icon name="cross" size={34} />
          <span>None</span>
        </motion.button>
        {items.map((it) => (
          <motion.button key={it.id} className={`opt ${value[tab] === it.id ? "on" : ""} ${owned(it.id) ? "" : "locked"}`} onClick={() => pick({ [tab]: it.id })} whileTap={{ scale: 0.9 }} whileHover={{ y: -3 }}>
            <Icon name={it.icon} size={40} />
            <span>{it.name}</span>
            <Lock id={it.id} />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
