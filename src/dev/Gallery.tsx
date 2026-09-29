import { Canvas } from "@react-three/fiber";
import type { Character } from "../../shared/game";
import { Rafiki } from "../scene/Rafiki";

/** Visual QA sheet: every species / eye / accessory in one frame. Open /#gallery. */
const LOOKS: Character[] = [
  { species: "bear", color: "peach", eyes: "round", pattern: "belly", hat: null, neck: "scarf", face: null },
  { species: "bunny", color: "mint", eyes: "sparkle", pattern: "belly", hat: "flower", neck: null, face: null },
  { species: "cat", color: "lilac", eyes: "round", pattern: "spots", hat: "beanie", neck: "bow", face: null },
  { species: "sprout", color: "butter", eyes: "sleepy", pattern: "belly", hat: null, neck: "scarf", face: "glasses" },
  { species: "antenna", color: "sky", eyes: "round", pattern: "none", hat: "headphones", neck: null, face: "shades" },
  { species: "unicorn", color: "rose", eyes: "sparkle", pattern: "belly", hat: null, neck: "bow", face: null },
  { species: "bear", color: "midnight", eyes: "round", pattern: "belly", hat: "crown", neck: "scarf", face: null },
  { species: "cat", color: "coral", eyes: "sparkle", pattern: "none", hat: "tophat", neck: null, face: null },
  { species: "bunny", color: "lilac", eyes: "round", pattern: "spots", hat: "grad", neck: "scarf", face: "glasses" },
];

export default function Gallery() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "linear-gradient(#ffd9ec, #c9d4ff)" }}>
      <Canvas shadows camera={{ position: [0, 1.2, 9.5], fov: 40 }} dpr={[1, 2]}>
        <hemisphereLight args={["#fff8fb", "#8a7ad8", 1.25]} />
        <directionalLight position={[3, 5, 4]} intensity={1.5} castShadow />
        <directionalLight position={[-4, 2, -3]} intensity={0.9} color="#ffc4e1" />
        {LOOKS.map((c, i) => (
          <group key={i} position={[((i % 3) - 1) * 2.6, 1.6 - Math.floor(i / 3) * 2.1, 0]}>
            <Rafiki override={c} scale={0.95} />
          </group>
        ))}
      </Canvas>
    </div>
  );
}
