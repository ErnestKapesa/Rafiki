import { PALETTES, type Species } from "../../shared/game";
import { Avatar } from "../ui/Avatar";
import { ALL_ICONS, Icon } from "../ui/icons";

/** Visual QA sheet for the sticker icons and avatars. Open /#icons. */
export default function IconSheet() {
  const species: Species[] = ["bear", "bunny", "cat", "sprout", "antenna", "unicorn"];
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "auto", background: "#fffaee", padding: 24, fontFamily: "var(--font)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 92px)", gap: 14 }}>
        {ALL_ICONS.map((n) => (
          <div key={n} style={{ display: "grid", justifyItems: "center", gap: 4, fontSize: 11 }}>
            <Icon name={n} size={52} />
            {n}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 24, flexWrap: "wrap" }}>
        {species.map((s, i) => (
          <Avatar key={s} c={{ species: s, color: PALETTES[i].id, eyes: (["round", "sparkle", "sleepy"] as const)[i % 3] }} size={84} />
        ))}
      </div>
    </div>
  );
}
