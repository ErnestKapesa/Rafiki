import { paletteOf, type Character, type Species } from "../../shared/game";
import { INK } from "./icons";

/** Flat 2D portrait of the 3D friend — matches species, fur and eyes. */
export function Avatar({ c, size = 44, species }: { c: Pick<Character, "color" | "eyes"> & { species: Species }; size?: number; species?: Species }) {
  const p = paletteOf(c.color);
  const sp = species ?? c.species;
  const S = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className="avatar-svg">
      {/* ears / top — drawn behind the body */}
      {(sp === "bear" || sp === "unicorn") && (
        <>
          <circle cx={17} cy={17} r={7} fill={p.body} {...S} />
          <circle cx={47} cy={17} r={7} fill={p.body} {...S} />
          <circle cx={17} cy={17} r={3.4} fill={p.accent} />
          <circle cx={47} cy={17} r={3.4} fill={p.accent} />
        </>
      )}
      {sp === "cat" && (
        <>
          <path d="M12 26 14 7l12 11z" fill={p.body} {...S} />
          <path d="M52 26 50 7 38 18z" fill={p.body} {...S} />
          <path d="M15.5 20 16.3 12l5.2 4.8z" fill={p.accent} />
          <path d="M48.5 20l-.8-8-5.2 4.8z" fill={p.accent} />
        </>
      )}
      {sp === "bunny" && (
        <>
          <rect x={16} y={1.5} width={10} height={24} rx={5} fill={p.body} {...S} transform="rotate(-8 21 14)" />
          <rect x={38} y={1.5} width={10} height={24} rx={5} fill={p.body} {...S} transform="rotate(8 43 14)" />
          <rect x={19} y={5} width={4} height={15} rx={2} fill={p.accent} transform="rotate(-8 21 14)" />
          <rect x={41} y={5} width={4} height={15} rx={2} fill={p.accent} transform="rotate(8 43 14)" />
        </>
      )}
      {sp === "antenna" && (
        <>
          <path d="M25 16 21 6M39 16l4-10" fill="none" {...S} />
          <circle cx={21} cy={6} r={3.5} fill="#FFD36E" {...S} />
          <circle cx={43} cy={6} r={3.5} fill="#FFD36E" {...S} />
        </>
      )}
      {sp === "sprout" && (
        <>
          <path d="M32 14V7" fill="none" {...S} />
          <path d="M32 9c-2-5-7-6-11-4 1 5 6 7 11 4zM32 9c2-5 7-6 11-4-1 5-6 7-11 4z" fill="#7FDC9A" {...S} />
        </>
      )}
      {/* body */}
      <path d="M32 12c14.5 0 25 10 25 26 0 13.5-10.5 21-25 21S7 51.5 7 38c0-16 10.5-26 25-26z" fill={p.body} {...S} />
      {sp === "unicorn" && <path d="M32 2 36 16H28z" fill="#FFE7A8" {...S} />}
      <ellipse cx={32} cy={48} rx={11} ry={7.5} fill={p.belly} />
      {/* face */}
      {c.eyes === "sleepy" ? (
        <path d="M18 33a4 3 0 0 0 8 0M38 33a4 3 0 0 0 8 0" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      ) : (
        <>
          <ellipse cx={22} cy={32} rx={c.eyes === "sparkle" ? 4.2 : 3.6} ry={c.eyes === "sparkle" ? 5.2 : 4.6} fill={INK} />
          <ellipse cx={42} cy={32} rx={c.eyes === "sparkle" ? 4.2 : 3.6} ry={c.eyes === "sparkle" ? 5.2 : 4.6} fill={INK} />
          <circle cx={23.3} cy={30.2} r={1.5} fill="#fff" />
          <circle cx={43.3} cy={30.2} r={1.5} fill="#fff" />
        </>
      )}
      <ellipse cx={15} cy={39} rx={4} ry={2.5} fill={p.cheek} opacity={0.6} />
      <ellipse cx={49} cy={39} rx={4} ry={2.5} fill={p.cheek} opacity={0.6} />
      <path d="M28.5 38.5q3.5 3 7 0" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

/** Icon standing in for the model's topic emoji. */
export function topicIcon(a: { topic: string; mood: string }) {
  if (a.topic === "news") return "news";
  return ({ curious: "search", excited: "sparkle", serious: "book", playful: "party", calm: "moon" } as Record<string, string>)[a.mood] ?? "planet";
}
