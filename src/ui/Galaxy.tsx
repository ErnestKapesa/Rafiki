import { Line, OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { sfx } from "../audio/sfx";
import { useRafiki, type Answer } from "../lib/store";

/**
 * Your knowledge galaxy: every expedition is a star. Follow-up trails are
 * drawn as constellations; Deep Dives burn violet, quick trips gold; stars
 * grow with every world you discovered on that trip.
 */
export default function Galaxy({ onOpen }: { onOpen: (a: Answer) => void }) {
  const journal = useRafiki((s) => s.journal);
  const [hover, setHover] = useState<string | null>(null);

  const stars = useMemo(() => {
    const list = [...journal].reverse(); // oldest first → spiral outwards
    return list.map((a, i) => {
      const arm = hash(a.question) % 3;
      const r = 1.3 + i * 0.28;
      const angle = i * 0.55 + arm * ((Math.PI * 2) / 3);
      const jitter = (hash(a.id) % 100) / 100 - 0.5;
      return {
        a,
        pos: new THREE.Vector3(Math.cos(angle) * r, jitter * 0.8 + (a.topic === "news" ? 0.3 : 0), Math.sin(angle) * r),
        color: a.mode === "deep" ? "#b48cff" : a.topic === "news" ? "#7fd8ff" : "#ffd36e",
        size: 0.11 + Math.min(a.discovered.length, 6) * 0.025,
      };
    });
  }, [journal]);

  const links = useMemo(() => {
    const byId = new Map(stars.map((s) => [s.a.id, s.pos]));
    return stars.filter((s) => s.a.parentId && byId.has(s.a.parentId)).map((s) => [byId.get(s.a.parentId!)!, s.pos] as [THREE.Vector3, THREE.Vector3]);
  }, [stars]);

  if (!journal.length)
    return <p className="muted">Your galaxy is empty. Every question you ask lights up a new star. Go on your first expedition!</p>;

  const deep = journal.filter((j) => j.mode === "deep").length;
  const worlds = new Set(journal.flatMap((j) => j.discovered)).size;
  return (
    <div className="galaxy">
      <div className="galaxy-stats">
        <span><b>{journal.length}</b> stars</span>
        <span><b>{links.length}</b> trail links</span>
        <span><b>{deep}</b> deep dives</span>
        <span><b>{worlds}</b> worlds visited</span>
      </div>
      <Canvas camera={{ position: [0, 4, 7], fov: 45 }} dpr={[1, 2]}>
        <color attach="background" args={["#0c0a24"]} />
        <Stars radius={30} depth={30} count={2500} factor={3} fade speed={0.5} />
        <Core />
        {links.map(([a, b], i) => (
          <Line key={i} points={[a, b]} color="#9fb8ff" lineWidth={1.5} transparent opacity={0.55} />
        ))}
        {stars.map((s) => (
          <Star
            key={s.a.id}
            pos={s.pos}
            color={s.color}
            size={s.size}
            label={s.a.question}
            emoji={s.a.emoji}
            hovered={hover === s.a.id}
            onHover={(h) => setHover(h ? s.a.id : null)}
            onClick={() => {
              sfx.pop();
              onOpen(s.a);
            }}
          />
        ))}
        <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.4} minDistance={3} maxDistance={20} />
        <EffectComposer>
          <Bloom intensity={1.2} luminanceThreshold={0.2} mipmapBlur />
        </EffectComposer>
      </Canvas>
      {hover && <div className="star-tip">{stars.find((x) => x.a.id === hover)?.a.question}</div>}
      <div className="galaxy-legend">
        <span><i style={{ background: "#ffd36e" }} /> Quick</span>
        <span><i style={{ background: "#b48cff" }} /> Deep Dive</span>
        <span><i style={{ background: "#7fd8ff" }} /> News</span>
      </div>
    </div>
  );
}

function Core() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((s) => ref.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 2) * 0.06));
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[0.28, 32, 32]} />
        <meshBasicMaterial color="#ffb38a" toneMapped={false} />
      </mesh>
      <Sparkles count={60} scale={2} size={3} speed={0.4} color="#ffd9b3" />
    </group>
  );
}

function Star({
  pos,
  color,
  size,
  label,
  emoji,
  hovered,
  onHover,
  onClick,
}: {
  pos: THREE.Vector3;
  color: string;
  size: number;
  label: string;
  emoji: string;
  hovered: boolean;
  onHover: (h: boolean) => void;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const seed = useMemo(() => Math.random() * 10, []);
  useFrame((s, dt) => {
    const twinkle = 1 + Math.sin(s.clock.elapsedTime * 3 + seed) * 0.15;
    ref.current.scale.setScalar(THREE.MathUtils.damp(ref.current.scale.x, (hovered ? 1.8 : 1) * twinkle, 10, dt));
  });
  return (
    <group position={pos}>
      <mesh
        ref={ref}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(false);
          document.body.style.cursor = "";
        }}
        onClick={onClick}
      >
        <sphereGeometry args={[size, 20, 20]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return h;
}
