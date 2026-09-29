/**
 * Rafiki's sticker icon set — hand-drawn SVG, no emoji, no third-party art.
 * Style: flat toy colours, a single chunky ink outline and a soft white
 * highlight, like the stickers on a Nintendo cartridge. 32×32 grid.
 */
import type { JSX } from "react";

export const INK = "#3A2E5C";
const S = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" } as const;
const T = { ...S, strokeWidth: 1.6 } as const;
const HL = { fill: "#fff", opacity: 0.8, stroke: "none" } as const;

function starPath(cx: number, cy: number, R: number, r: number, n = 5) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rad = i % 2 ? r : R;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

function gearPath(cx: number, cy: number, R: number, r: number, teeth = 8) {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const rad = i % 4 < 2 ? R : r;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

const sparkle = (cx: number, cy: number, s: number) =>
  `M${cx} ${cy - s}C${cx + s * 0.15} ${cy - s * 0.2} ${cx + s * 0.2} ${cy - s * 0.15} ${cx + s} ${cy}C${cx + s * 0.2} ${cy + s * 0.15} ${cx + s * 0.15} ${cy + s * 0.2} ${cx} ${cy + s}C${cx - s * 0.15} ${cy + s * 0.2} ${cx - s * 0.2} ${cy + s * 0.15} ${cx - s} ${cy}C${cx - s * 0.2} ${cy - s * 0.15} ${cx - s * 0.15} ${cy - s * 0.2} ${cx} ${cy - s}Z`;

const eye = (x: number, y: number) => (
  <>
    <ellipse cx={x} cy={y} rx={3.4} ry={4.4} fill={INK} />
    <circle cx={x + 1.1} cy={y - 1.5} r={1.3} fill="#fff" />
  </>
);

const ICONS: Record<string, () => JSX.Element> = {
  star: () => (
    <>
      <path d={starPath(16, 17, 13.5, 6.4)} fill="#FFD23F" {...S} />
      <ellipse cx={11.5} cy={12.5} rx={2.2} ry={1.3} transform="rotate(-35 11.5 12.5)" {...HL} />
    </>
  ),
  gem: () => (
    <>
      <path d="M8 12 12.5 5.5h7L24 12 16 27.5z" fill="#5CC8FF" {...S} />
      <path d="M8 12h16M12.5 5.5 16 12l3.5-6.5M16 12v15.5" fill="none" {...T} />
      <path d="M11 11l2-3" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),
  flame: () => (
    <>
      <path d="M16 29c-5.5 0-9-3.8-9-8.6 0-4.4 3-7.2 5-10.4.6 2.2 1.8 3.4 3 3.9C15 9.6 16.6 5.6 20 3c-.6 4 1.4 6.5 3.2 9 1.2 1.7 1.8 3.8 1.8 6.2 0 6.3-4 10.8-9 10.8z" fill="#FF7A45" {...S} />
      <path d="M16 27c-2.6 0-4.3-1.8-4.3-4.2 0-2.3 1.6-3.6 2.8-5.3.5 1.3 1.3 1.9 2.1 2.1.2-1.9 1-3.3 2.2-4.2-.2 2 .8 3.2 1.6 4.4.6.9.9 1.9.9 3.1 0 2.4-2 4.1-5.3 4.1z" fill="#FFD23F" />
    </>
  ),
  target: () => (
    <>
      <circle cx={16} cy={16} r={12.5} fill="#FF5A5F" {...S} />
      <circle cx={16} cy={16} r={8.3} fill="#fff" {...T} />
      <circle cx={16} cy={16} r={4.2} fill="#FF5A5F" {...T} />
      <ellipse cx={10} cy={9.5} rx={2} ry={1.2} transform="rotate(-40 10 9.5)" {...HL} />
    </>
  ),
  trophy: () => (
    <>
      <path d="M9.5 7H5.5a3.8 3.8 0 0 0 4.4 5.2M22.5 7h4a3.8 3.8 0 0 1-4.4 5.2" fill="none" {...S} />
      <path d="M9 4.5h14V11a7 7 0 0 1-14 0z" fill="#FFC83D" {...S} />
      <path d="M14 18h4v4.5h-4z" fill="#FFA928" {...S} />
      <rect x={9.5} y={22.5} width={13} height={5} rx={2} fill="#B97BFF" {...S} />
      <path d="M12 7.5v4" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" opacity={0.85} />
    </>
  ),
  crown: () => (
    <>
      <path d="M5 23 3.8 9.5l6.7 5.8L16 6l5.5 9.3 6.7-5.8L27 23z" fill="#FFC83D" {...S} />
      <rect x={4.8} y={22.5} width={22.4} height={4.5} rx={1.5} fill="#FFA928" {...S} />
      <circle cx={16} cy={18.5} r={1.8} fill="#FF5A7A" {...T} />
      <circle cx={3.8} cy={9.5} r={1.4} fill="#fff" {...T} />
      <circle cx={16} cy={6} r={1.4} fill="#fff" {...T} />
      <circle cx={28.2} cy={9.5} r={1.4} fill="#fff" {...T} />
    </>
  ),
  book: () => (
    <>
      <path d="M6 7a3 3 0 0 1 3-3h17v19H9a3 3 0 0 0-3 3z" fill="#FF9D4D" {...S} />
      <path d="M6 26a3 3 0 0 1 3-3h17v5H9a3 3 0 0 1-3-2z" fill="#FFF6E5" {...S} />
      <path d="M18 4v8l2.5-2 2.5 2V4" fill="#FF5A7A" {...T} />
      <path d="M9.5 8v10" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" opacity={0.7} />
    </>
  ),
  gear: () => (
    <>
      <path d={gearPath(16, 16, 13.5, 10.5, 8)} fill="#A7B1CC" {...S} />
      <circle cx={16} cy={16} r={4.3} fill="#fff" {...T} />
    </>
  ),
  mic: () => (
    <>
      <path d="M8 14a8 8 0 0 0 16 0M16 22v5M11 27.5h10" fill="none" {...S} />
      <rect x={11} y={3} width={10} height={16} rx={5} fill="#FF6FA5" {...S} />
      <path d="M14 7v5" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" opacity={0.8} />
    </>
  ),
  search: () => (
    <>
      <path d="M20 20l7 7" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <circle cx={13.5} cy={13.5} r={9} fill="#CFF3FF" {...S} />
      <path d="M9 11a5 5 0 0 1 4-3.5" stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" />
    </>
  ),
  rocket: () => (
    <>
      <path d="M12.5 22c0 3 1.7 5 3.5 7 1.8-2 3.5-4 3.5-7z" fill="#FFB23F" {...T} />
      <path d="M10.5 15.5 5.5 22l5-.5M21.5 15.5l5 6.5-5-.5" fill="#FF5A5F" {...S} />
      <path d="M16 2.5c5.2 3 7.2 8.5 6 19h-12c-1.2-10.5.8-16 6-19z" fill="#fff" {...S} />
      <circle cx={16} cy={11.5} r={2.8} fill="#5CC8FF" {...T} />
    </>
  ),
  compass: () => (
    <>
      <circle cx={16} cy={16} r={12.5} fill="#fff" {...S} />
      <path d="M16 5.5l3.4 10.5h-6.8z" fill="#FF5A5F" {...T} />
      <path d="M16 26.5 12.6 16h6.8z" fill="#A7B1CC" {...T} />
      <circle cx={16} cy={16} r={1.6} fill={INK} />
    </>
  ),
  check: () => (
    <>
      <circle cx={16} cy={16} r={12.5} fill="#3FD18A" {...S} />
      <path d="M10 16.5l4.2 4.2 8-9" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  cross: () => (
    <>
      <circle cx={16} cy={16} r={12.5} fill="#FF6B6B" {...S} />
      <path d="M11.5 11.5l9 9M20.5 11.5l-9 9" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" />
    </>
  ),
  gift: () => (
    <>
      <path d="M16 9c-3-4.5-7.5-4.5-7.5-1.5S13 9 16 9zM16 9c3-4.5 7.5-4.5 7.5-1.5S19 9 16 9z" fill="#FFD23F" {...T} />
      <rect x={6} y={13} width={20} height={14} rx={2} fill="#FF6FA5" {...S} />
      <rect x={4.5} y={9} width={23} height={5} rx={1.5} fill="#FF8FBA" {...S} />
      <path d="M16 9v18" stroke="#FFD23F" strokeWidth={3} />
      <path d="M16 9v18" fill="none" {...T} strokeWidth={0} />
    </>
  ),
  bulb: () => (
    <>
      <path d="M16 3.5a8.5 8.5 0 0 0-5 15.4V22h10v-3.1A8.5 8.5 0 0 0 16 3.5z" fill="#FFE066" {...S} />
      <path d="M11.5 22h9v2.5a2.5 2.5 0 0 1-2.5 2.5h-4a2.5 2.5 0 0 1-2.5-2.5z" fill="#B8B3D6" {...S} />
      <path d="M12 10a4.5 4.5 0 0 1 3-3.5" stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" />
    </>
  ),
  lock: () => (
    <>
      <path d="M11 14v-3.5a5 5 0 0 1 10 0V14" fill="none" {...S} />
      <rect x={7.5} y={13.5} width={17} height={13.5} rx={3} fill="#FFC83D" {...S} />
      <circle cx={16} cy={19.5} r={1.8} fill={INK} />
    </>
  ),
  sound: () => (
    <>
      <path d="M4.5 12h5l6-5v18l-6-5h-5z" fill="#fff" {...S} />
      <path d="M20 11a6.5 6.5 0 0 1 0 10M23.5 7.5a11.5 11.5 0 0 1 0 17" fill="none" {...S} />
    </>
  ),
  muted: () => (
    <>
      <path d="M4.5 12h5l6-5v18l-6-5h-5z" fill="#fff" {...S} />
      <path d="M20.5 12.5l7 7M27.5 12.5l-7 7" fill="none" {...S} />
    </>
  ),
  music: () => (
    <>
      <path d="M12 23V8.5L25 5v15" fill="none" {...S} />
      <path d="M12 8.5 25 5v4l-13 3.5z" fill={INK} />
      <circle cx={8.5} cy={23} r={3.8} fill="#B97BFF" {...S} />
      <circle cx={21.5} cy={20} r={3.8} fill="#FF6FA5" {...S} />
    </>
  ),
  chat: () => (
    <>
      <path d="M5 8.5a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-7.5l-6 5v-5H9a4 4 0 0 1-4-4z" fill="#fff" {...S} />
      <circle cx={11} cy={13} r={1.6} fill={INK} />
      <circle cx={16} cy={13} r={1.6} fill={INK} />
      <circle cx={21} cy={13} r={1.6} fill={INK} />
    </>
  ),
  egg: () => (
    <>
      <path d="M16 3.5c5.2 0 9.5 8.3 9.5 14.5a9.5 9.5 0 0 1-19 0C6.5 11.8 10.8 3.5 16 3.5z" fill="#FFF3D6" {...S} />
      <circle cx={12.5} cy={15} r={2} fill="#FFB86B" />
      <circle cx={19.5} cy={20} r={2.6} fill="#FFB86B" />
      <circle cx={17} cy={10} r={1.4} fill="#FFB86B" />
    </>
  ),
  radar: () => (
    <>
      <path d="M5.5 11a14 14 0 0 0 15.5 15.5z" fill="#fff" {...S} />
      <path d="M13 19l8-8" fill="none" {...S} />
      <circle cx={22.5} cy={9.5} r={2.6} fill="#FF5A5F" {...T} />
      <path d="M22 3.5a7 7 0 0 1 6.5 6.5" fill="none" {...T} />
    </>
  ),
  thought: () => (
    <>
      <circle cx={8} cy={25} r={2} fill="#fff" {...T} />
      <circle cx={4.5} cy={28.5} r={1.2} fill="#fff" {...T} />
      <path d="M10.5 21a5 5 0 0 1-1.3-9.8A6.5 6.5 0 0 1 21 8.2a5 5 0 0 1 2.8 9.5A4.5 4.5 0 0 1 19.5 21z" fill="#fff" {...S} />
      <path d={sparkle(16, 14.5, 3.3)} fill="#B97BFF" />
    </>
  ),
  clock: () => (
    <>
      <circle cx={16} cy={16} r={12.5} fill="#fff" {...S} />
      <path d="M16 9v7l5 3" fill="none" {...S} />
    </>
  ),
  map: () => (
    <>
      <path d="M4 8l7-3 10 3 7-3v19l-7 3-10-3-7 3z" fill="#7FE0B0" {...S} />
      <path d="M11 5v19M21 8v19" fill="none" {...T} />
      <path d="M14 14.5l2.5 2.5M16.5 14.5 14 17" stroke="#FF5A5F" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  news: () => (
    <>
      <path d="M21.5 11H26v13a3 3 0 0 1-3 3" fill="#E9E4FF" {...S} />
      <path d="M6 5.5h15.5V24a3 3 0 0 0 3 3H9a3 3 0 0 1-3-3z" fill="#fff" {...S} />
      <rect x={9.5} y={9} width={8.5} height={5.5} rx={1} fill="#FF9D4D" {...T} />
      <path d="M9.5 18h8.5M9.5 22h8.5" fill="none" {...T} />
    </>
  ),
  paw: () => (
    <>
      <ellipse cx={16} cy={20.5} rx={6.5} ry={5.5} fill="#FF9EC4" {...S} />
      <circle cx={8.3} cy={13.5} r={2.8} fill="#FF9EC4" {...S} />
      <circle cx={12.6} cy={8.5} r={2.8} fill="#FF9EC4" {...S} />
      <circle cx={19.4} cy={8.5} r={2.8} fill="#FF9EC4" {...S} />
      <circle cx={23.7} cy={13.5} r={2.8} fill="#FF9EC4" {...S} />
    </>
  ),
  moon: () => (
    <>
      <path d="M19.5 3.5a12.5 12.5 0 1 0 9 19.8A10.5 10.5 0 0 1 19.5 3.5z" fill="#FFE066" {...S} />
      <circle cx={12} cy={19} r={2} fill="#FFC83D" />
      <circle cx={16} cy={25} r={1.3} fill="#FFC83D" />
    </>
  ),
  globe: () => (
    <>
      <circle cx={16} cy={16} r={12.5} fill="#5CC8FF" {...S} />
      <path d="M8.5 10c3.2-1.2 5.5.8 5.5 3s-3 2.2-3 5-3.3 1.4-4.2-2c-.5-2.5.2-5.2 1.7-6z" fill="#7FE0B0" {...T} />
      <path d="M18.5 18c2.3-.2 4.5 1 4.3 3.2-.2 2.2-2.6 3-4.4 2.2-2.2-1-2.3-5.2.1-5.4z" fill="#7FE0B0" {...T} />
      <path d="M19 6.5c2 .3 3.5 1.5 3.2 2.7-.3 1-2.2 1.2-3.3.4-1.3-.9-1.3-3.3.1-3.1z" fill="#7FE0B0" {...T} />
    </>
  ),
  sprout: () => (
    <>
      <path d="M6 27.5h20" fill="none" {...S} />
      <path d="M16 27V15.5" fill="none" {...S} />
      <path d="M16 17c-1-5.2-5.2-7.4-10.3-6.3.1 5.3 4.4 8.2 10.3 6.3z" fill="#6FDB8F" {...S} />
      <path d="M16 14.5c1-5.4 5.4-8.3 10.5-7.3-.1 5.4-4.5 8.6-10.5 7.3z" fill="#9BEA7F" {...S} />
    </>
  ),
  party: () => (
    <>
      <path d="M4.5 27.5 10 12l10 10z" fill="#FFC83D" {...S} />
      <path d="M7.5 19l4.5 4.5M9.3 14.5l7.8 7.8" fill="none" stroke="#FF6FA5" strokeWidth={2} />
      <path d="M17 4.5l1 3M24 7.5l-2.5 2M27.5 15l-3 .5" fill="none" {...S} />
      <circle cx={21} cy={4} r={1.6} fill="#5CC8FF" />
      <circle cx={27} cy={11} r={1.6} fill="#FF5A7A" />
      <circle cx={15} cy={9.5} r={1.4} fill="#7FE0B0" />
    </>
  ),
  planet: () => (
    <>
      <circle cx={16} cy={16} r={9} fill="#B97BFF" {...S} />
      <ellipse cx={16} cy={16} rx={14} ry={4.6} transform="rotate(-18 16 16)" fill="none" stroke={INK} strokeWidth={2} />
      <path d="M4 20.5c3.5 1 9 .3 14.5-1.5" transform="rotate(-18 16 16)" fill="none" stroke="#FFD23F" strokeWidth={2.4} strokeLinecap="round" />
      <ellipse cx={12.5} cy={11.5} rx={2} ry={1.2} transform="rotate(-35 12.5 11.5)" {...HL} />
    </>
  ),
  sparkle: () => (
    <>
      <path d={sparkle(14, 15, 11.5)} fill="#FFD23F" {...S} />
      <path d={sparkle(25, 7, 4)} fill="#FF9EC4" {...T} />
    </>
  ),
  bolt: () => <path d="M18.5 3 7 18h7.5L12 29l13.5-16.5H18z" fill="#FFD23F" {...S} />,
  pencil: () => (
    <>
      <path d="M6 26l1.5-6L21 6.5a3 3 0 0 1 4.2 4.2L11.7 24.5z" fill="#FFD23F" {...S} />
      <path d="M18.5 9l4.2 4.2M7.5 20l4.2 4.5" fill="none" {...T} />
      <path d="M6 26l1.2-4.4 3.2 3.2z" fill={INK} />
    </>
  ),
  hanger: () => (
    <>
      <path d="M16 11.5V10a2.8 2.8 0 1 0-2.8-2.8" fill="none" {...S} />
      <path d="M16 11.5 4.5 20.5a1.6 1.6 0 0 0 1 2.9h21a1.6 1.6 0 0 0 1-2.9z" fill="#FF8FBA" {...S} />
      <path d="M8 21l5-4" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" opacity={0.8} />
    </>
  ),
  bag: () => (
    <>
      <path d="M12 11V9a4 4 0 0 1 8 0v2" fill="none" {...S} />
      <path d="M6.5 11h19l-1.6 15.5H8.1z" fill="#FF8FBA" {...S} />
      <path d="M10 14v8" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" opacity={0.8} />
    </>
  ),
  users: () => (
    <>
      <circle cx={21.5} cy={11} r={4} fill="#7FE0B0" {...S} />
      <path d="M14.5 26a7 7 0 0 1 14 0z" fill="#7FE0B0" {...S} />
      <circle cx={11} cy={12} r={4.5} fill="#5CC8FF" {...S} />
      <path d="M3 27a8 8 0 0 1 16 0z" fill="#5CC8FF" {...S} />
    </>
  ),
  home: () => (
    <>
      <path d="M4.5 15 16 5l11.5 10" fill="none" {...S} />
      <path d="M7.5 13v13.5h17V13" fill="#FFD23F" {...S} />
      <rect x={13} y={18} width={6} height={8.5} rx={1.5} fill="#FF9D4D" {...T} />
    </>
  ),

  external: () => (
    <>
      <rect x={4.5} y={8.5} width={19} height={19} rx={4} fill="#fff" {...S} />
      <path d="M15 17 27 5M19 4.5h8.5V13" fill="none" {...S} />
    </>
  ),
  news2: () => (
    <>
      <rect x={4} y={6} width={24} height={20} rx={4} fill="#FF7A45" {...S} />
      <rect x={8} y={10} width={9} height={7} rx={1.5} fill="#fff" {...T} />
      <path d="M20 11h4M20 15h4M8 21h16" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
    </>
  ),
  grid: () => (
    <>
      <rect x={4} y={4} width={10} height={10} rx={3} fill="#FF8FBA" {...S} />
      <rect x={18} y={4} width={10} height={10} rx={3} fill="#FFD23F" {...S} />
      <rect x={4} y={18} width={10} height={10} rx={3} fill="#5CC8FF" {...S} />
      <rect x={18} y={18} width={10} height={10} rx={3} fill="#7FE0B0" {...S} />
    </>
  ),
  play: () => (
    <>
      <circle cx={16} cy={16} r={12.5} fill="#FF6FA5" {...S} />
      <path d="M13 10.5v11l9-5.5z" fill="#fff" stroke="#fff" strokeWidth={1.5} strokeLinejoin="round" />
    </>
  ),
  pause: () => (
    <>
      <circle cx={16} cy={16} r={12.5} fill="#FF6FA5" {...S} />
      <path d="M13 11v10M19 11v10" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" />
    </>
  ),
  wand: () => (
    <>
      <path d="M5 27 19 13" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <path d="M5 27 19 13" stroke="#B97BFF" strokeWidth={2.4} strokeLinecap="round" />
      <path d={sparkle(22.5, 9.5, 6.5)} fill="#FFD23F" {...S} />
    </>
  ),

  /* wardrobe items */
  scarf: () => (
    <>
      <path d="M19 15l2.2 11.5h4.4L23.5 15z" fill="#FFC83D" {...S} />
      <path d="M5 9.5c3.5 2.5 18.5 2.5 22 0v5.5c-3.5 2.5-18.5 2.5-22 0z" fill="#FFC83D" {...S} />
      <path d="M10 12v4M15 12.5v4" stroke="#FF9F1C" strokeWidth={1.8} strokeLinecap="round" />
    </>
  ),
  bow: () => (
    <>
      <path d="M16 16 5 9.5v13zM16 16l11-6.5v13z" fill="#FF5A7A" {...S} />
      <rect x={13} y={12.5} width={6} height={7} rx={2.5} fill="#FF8FA8" {...S} />
    </>
  ),
  beanie: () => (
    <>
      <circle cx={16} cy={7} r={3.2} fill="#EAF2FF" {...S} />
      <path d="M6 21.5a10 10 0 0 1 20 0z" fill="#5CA8FF" {...S} />
      <rect x={4.5} y={20.5} width={23} height={6} rx={3} fill="#EAF2FF" {...S} />
    </>
  ),
  flower: () => (
    <>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        return <circle key={i} cx={16 + Math.cos(a) * 6.3} cy={16 + Math.sin(a) * 6.3} r={5.6} fill="#FF6FA5" {...S} />;
      })}
      <circle cx={16} cy={16} r={3.8} fill="#FFD23F" {...S} />
    </>
  ),
  headphones: () => (
    <>
      <path d="M6.5 19v-3.5a9.5 9.5 0 0 1 19 0V19" fill="none" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
      <path d="M6.5 19v-3.5a9.5 9.5 0 0 1 19 0V19" fill="none" stroke="#B97BFF" strokeWidth={2} strokeLinecap="round" />
      <rect x={3.5} y={16.5} width={6.5} height={11} rx={3} fill="#FF7AA8" {...S} />
      <rect x={22} y={16.5} width={6.5} height={11} rx={3} fill="#FF7AA8" {...S} />
    </>
  ),
  tophat: () => (
    <>
      <rect x={9} y={5} width={14} height={18} rx={1.5} fill="#4B3F72" {...S} />
      <rect x={9} y={17} width={14} height={3.5} fill="#FF5A7A" {...T} />
      <rect x={3.5} y={22.5} width={25} height={4} rx={2} fill="#4B3F72" {...S} />
      <path d="M12 8v6" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" opacity={0.5} />
    </>
  ),
  gradcap: () => (
    <>
      <path d="M9 14.5v6c0 2 3.2 3.8 7 3.8s7-1.8 7-3.8v-6" fill="#4B3F72" {...S} />
      <path d="M16 6.5 29 12l-13 5.5L3 12z" fill="#5B4E8C" {...S} />
      <path d="M26 13v7.5" fill="none" {...S} />
      <circle cx={26} cy={22} r={1.8} fill="#FFD23F" {...T} />
    </>
  ),
  glasses: () => (
    <>
      <path d="M15.5 16.5h1" fill="none" {...S} />
      <circle cx={9.5} cy={17} r={5.8} fill="#DDF5FF" {...S} />
      <circle cx={22.5} cy={17} r={5.8} fill="#DDF5FF" {...S} />
      <path d="M6.5 15a3.5 3.5 0 0 1 3-2.5M19.5 15a3.5 3.5 0 0 1 3-2.5" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" fill="none" />
    </>
  ),
  shades: () => (
    <>
      <path d="M15 15.5h2" fill="none" {...S} />
      <path d="M3.5 13h11v4a5.5 5.5 0 0 1-11 0zM17.5 13h11v4a5.5 5.5 0 0 1-11 0z" fill="#2B2350" {...S} />
      <path d="M6 15.5l3-1.5M20 15.5l3-1.5" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
    </>
  ),
  paint: () => (
    <>
      <path d="M16 3.5c4.3 6.3 8.5 10.5 8.5 15.5a8.5 8.5 0 0 1-17 0c0-5 4.2-9.2 8.5-15.5z" fill="#FF8A78" {...S} />
      <path d="M11.5 19a4.5 4.5 0 0 0 2.5 4" stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" />
    </>
  ),
  horn: () => (
    <>
      <path d="M16 3 21.5 27h-11z" fill="#FFE7A8" {...S} />
      <path d="M12 21.5l8.5-2.3M13.4 15.5l6-1.6M14.8 9.5l2.8-.8" fill="none" stroke="#FF9EC4" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  none: () => (
    <>
      <circle cx={16} cy={16} r={11.5} fill="#fff" {...S} />
      <path d="M8 24 24 8" fill="none" {...S} />
    </>
  ),

  /* eye styles */
  eyesRound: () => (
    <>
      <circle cx={16} cy={16} r={13.5} fill="#FFE3C9" {...S} />
      <ellipse cx={7.5} cy={21} rx={2.6} ry={1.6} fill="#FF9EC4" />
      <ellipse cx={24.5} cy={21} rx={2.6} ry={1.6} fill="#FF9EC4" />
      {eye(10.5, 16)}
      {eye(21.5, 16)}
    </>
  ),
  eyesSparkle: () => (
    <>
      <circle cx={16} cy={16} r={13.5} fill="#FFE3C9" {...S} />
      <ellipse cx={7.5} cy={21} rx={2.6} ry={1.6} fill="#FF9EC4" />
      <ellipse cx={24.5} cy={21} rx={2.6} ry={1.6} fill="#FF9EC4" />
      <ellipse cx={10.5} cy={16} rx={4.2} ry={5.4} fill={INK} />
      <ellipse cx={21.5} cy={16} rx={4.2} ry={5.4} fill={INK} />
      <path d={sparkle(12, 14, 2.2)} fill="#fff" />
      <path d={sparkle(23, 14, 2.2)} fill="#fff" />
      <circle cx={9} cy={18.5} r={0.9} fill="#fff" />
      <circle cx={20} cy={18.5} r={0.9} fill="#fff" />
    </>
  ),
  eyesSleepy: () => (
    <>
      <circle cx={16} cy={16} r={13.5} fill="#FFE3C9" {...S} />
      <ellipse cx={7.5} cy={21} rx={2.6} ry={1.6} fill="#FF9EC4" />
      <ellipse cx={24.5} cy={21} rx={2.6} ry={1.6} fill="#FF9EC4" />
      <path d="M6.5 16.5a4 3 0 0 0 8 0M17.5 16.5a4 3 0 0 0 8 0" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
    </>
  ),
};

export type IconName = keyof typeof ICONS;

/** Map the app's semantic names onto the sticker set. */
const ALIAS: Record<string, string> = {
  xp: "star",
  sparkles: "sparkle",
  streak: "flame",
  quest: "target",
  palette: "hanger",
  wardrobe: "hanger",
  galaxy: "planet",
  night: "moon",
  medal: "trophy",
  leaders: "crown",
  journal: "book",
  books: "book",
  scroll: "pencil",
  satellite: "radar",
  brain: "thought",
  hourglass: "clock",
  shop: "bag",
  quick: "bolt",
  studio: "mic",
  speak: "mic",
  speech: "chat",
  owl: "moon",
  cat: "paw",
  headphone: "headphones",
  cap: "beanie",
  grad: "gradcap",
  sunglasses: "shades",
  ribbon: "bow",
  crystal: "horn",
  eyes_round: "eyesRound",
  eyes_sparkle: "eyesSparkle",
  eyes_sleepy: "eyesSleepy",
  wave: "sparkle",
  hatch: "egg",
};

export function Icon({ name, size = 24, float, className = "", title }: { name: string; size?: number; float?: boolean; className?: string; title?: string; alt?: string }) {
  const key = ICONS[name] ? name : ALIAS[name];
  const draw = ICONS[key] ?? ICONS.sparkle;
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={`sticker ${float ? "float" : ""} ${className}`}
      style={float ? { animationDelay: `${(name.length % 7) * -0.37}s` } : undefined}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {draw()}
    </svg>
  );
}

export const ALL_ICONS = Object.keys(ICONS);
