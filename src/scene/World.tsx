import { Sparkles, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Mood, Source } from "../../shared/types";
import { visitSource } from "../game/actions";
import { useRafiki, type Answer } from "../lib/store";
import { Rafiki } from "./Rafiki";

const damp = THREE.MathUtils.damp;
const GROUND = -0.72;
const PLANET_R = 2.5;

/** Sky gradients per mood (top, bottom). "cosmos" is the onboarding night. */
const SKIES: Record<Mood | "listening" | "cosmos", [string, string]> = {
  curious: ["#6c7bff", "#ffc4dd"],
  excited: ["#ff86b0", "#ffe3a3"],
  serious: ["#3a4596", "#a5b8ff"],
  playful: ["#4fd1bd", "#ffdcad"],
  calm: ["#7cb4ff", "#ead3ff"],
  listening: ["#8a6bff", "#a8f5e6"],
  cosmos: ["#0b0a22", "#3a2466"],
};

function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color(SKIES.cosmos[0]) },
          bottom: { value: new THREE.Color(SKIES.cosmos[1]) },
          time: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vPos;
          void main() { vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top; uniform vec3 bottom; uniform float time;
          varying vec3 vPos;
          void main() {
            float h = smoothstep(-0.3, 0.7, vPos.y + 0.04 * sin(vPos.x * 3.0 + time * 0.2));
            vec3 c = mix(bottom, top, h);
            float band = exp(-pow((vPos.y - 0.22 - 0.07 * sin(vPos.x * 4.0 + time * 0.25)) * 6.0, 2.0));
            c += band * 0.07;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  const tTop = useMemo(() => new THREE.Color(), []);
  const tBottom = useMemo(() => new THREE.Color(), []);
  useFrame((s, dt) => {
    const { pose, current, onboardStep } = useRafiki.getState();
    const key = onboardStep === "orb" ? "cosmos" : pose === "listening" ? "listening" : (current?.mood ?? "curious");
    tTop.set(SKIES[key][0]);
    tBottom.set(SKIES[key][1]);
    mat.uniforms.top.value.lerp(tTop, 1 - Math.exp(-dt * 1.4));
    mat.uniforms.bottom.value.lerp(tBottom, 1 - Math.exp(-dt * 1.4));
    mat.uniforms.time.value = s.clock.elapsedTime;
  });
  return (
    <mesh material={mat}>
      <sphereGeometry args={[60, 32, 32]} />
    </mesh>
  );
}

/* ------------------------------------------------------------------------ */
/* Home planet                                                              */
/* ------------------------------------------------------------------------ */

function surfacePoint(rng: () => number, minY = 0.2) {
  for (;;) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(1 - rng() * 1.4);
    const n = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    if (n.y < minY) continue;
    if (n.y > 0.94) continue; // keep Rafiki's spot clear
    return n;
  }
}

function Planet() {
  const spin = useRef<THREE.Group>(null!);
  const root = useRef<THREE.Group>(null!);
  const grassRef = useRef<THREE.InstancedMesh>(null!);
  const flowerRef = useRef<THREE.InstancedMesh>(null!);

  const { trees, rocks, grass, flowers } = useMemo(() => {
    const rng = mulberry(11);
    const up = new THREE.Vector3(0, 1, 0);
    const mk = (n: THREE.Vector3, s: number) => ({
      pos: n.clone().multiplyScalar(PLANET_R),
      quat: new THREE.Quaternion().setFromUnitVectors(up, n),
      s,
    });
    const trees = Array.from({ length: 9 }, (_, i) => ({ ...mk(surfacePoint(rng, 0.35), 0.8 + rng() * 0.5), hue: ["#7fdc9a", "#ffb3c7", "#9fd6ff", "#ffd88a"][i % 4] }));
    const rocks = Array.from({ length: 8 }, () => mk(surfacePoint(rng, 0.25), 0.5 + rng() * 0.7));
    const grass = Array.from({ length: 260 }, () => mk(surfacePoint(rng, 0.15), 0.6 + rng() * 0.8));
    const flowers = Array.from({ length: 70 }, () => ({ ...mk(surfacePoint(rng, 0.2), 0.7 + rng() * 0.6), color: ["#ffffff", "#ffd36e", "#ff9ec7", "#b9a6ff"][Math.floor(rng() * 4)] }));
    return { trees, rocks, grass, flowers };
  }, []);

  useEffect(() => {
    const m = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    grass.forEach((g, i) => {
      scale.set(g.s, g.s * 0.75, g.s);
      m.compose(g.pos, g.quat, scale);
      grassRef.current.setMatrixAt(i, m);
    });
    grassRef.current.instanceMatrix.needsUpdate = true;
    const c = new THREE.Color();
    flowers.forEach((f, i) => {
      scale.setScalar(f.s);
      m.compose(f.pos.clone().multiplyScalar(1.004), f.quat, scale);
      flowerRef.current.setMatrixAt(i, m);
      flowerRef.current.setColorAt(i, c.set(f.color));
    });
    flowerRef.current.instanceMatrix.needsUpdate = true;
    if (flowerRef.current.instanceColor) flowerRef.current.instanceColor.needsUpdate = true;
  }, [grass, flowers]);

  useFrame((_, dt) => {
    const { pose, onboardStep, hatched } = useRafiki.getState();
    spin.current.rotation.y += dt * (pose === "searching" ? 0.45 : 0.035);
    // In the dark before hatching there is only the star; the planet rises after.
    const hidden = onboardStep === "orb" && !hatched;
    root.current.position.y = damp(root.current.position.y, GROUND - PLANET_R - (hidden ? 4 : 0), hidden ? 8 : 2.2, dt);
  });

  return (
    <group ref={root} position={[0, GROUND - PLANET_R - (useRafiki.getState().hatched ? 0 : 4), 0]}>
      <mesh receiveShadow>
        <sphereGeometry args={[PLANET_R, 96, 96]} />
        <meshPhysicalMaterial color="#9ee6bf" roughness={0.95} sheen={1} sheenColor="#e9fff3" emissive="#9ee6bf" emissiveIntensity={0.08} />
      </mesh>
      <group ref={spin}>
        <instancedMesh ref={grassRef} args={[undefined, undefined, grass.length]} castShadow>
          <sphereGeometry args={[0.03, 8, 6]} />
          <meshStandardMaterial color="#8be2b4" roughness={0.9} />
        </instancedMesh>
        <instancedMesh ref={flowerRef} args={[undefined, undefined, flowers.length]}>
          <sphereGeometry args={[0.028, 8, 8]} />
          <meshStandardMaterial roughness={0.6} />
        </instancedMesh>
        {trees.map((t, i) => (
          <group key={i} position={t.pos} quaternion={t.quat} scale={t.s}>
            <mesh position={[0, 0.12, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.035, 0.24, 8]} />
              <meshStandardMaterial color="#c79a7a" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.3, 0]} castShadow>
              <sphereGeometry args={[0.15, 24, 18]} />
              <meshPhysicalMaterial color={t.hue} roughness={0.8} sheen={1} sheenColor="#ffffff" />
            </mesh>
            <mesh position={[0.08, 0.24, 0.05]} castShadow>
              <sphereGeometry args={[0.09, 20, 14]} />
              <meshPhysicalMaterial color={t.hue} roughness={0.8} sheen={1} sheenColor="#ffffff" />
            </mesh>
          </group>
        ))}
        {rocks.map((r, i) => (
          <mesh key={i} position={r.pos} quaternion={r.quat} scale={[r.s, r.s * 0.6, r.s]} castShadow>
            <dodecahedronGeometry args={[0.07, 1]} />
            <meshStandardMaterial color="#e8dcff" roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Clouds() {
  const ref = useRef<THREE.Group>(null!);
  const clouds = useMemo(() => {
    const rng = mulberry(5);
    return Array.from({ length: 7 }, (_, i) => ({
      x: -9 + i * 3 + rng(),
      y: 0.6 + rng() * 2.6,
      z: -6 - rng() * 5,
      s: 0.7 + rng() * 0.8,
      puffs: Array.from({ length: 4 }, (_, k) => [k * 0.45 - 0.7, (k % 2) * 0.18, 0, 0.35 + rng() * 0.2] as const),
    }));
  }, []);
  useFrame((s) => {
    ref.current.children.forEach((c, i) => {
      c.position.x = ((clouds[i].x + s.clock.elapsedTime * 0.12 + 12) % 24) - 12;
    });
    const night = useRafiki.getState().onboardStep === "orb";
    ref.current.visible = !night;
  });
  return (
    <group ref={ref}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {c.puffs.map(([x, y, z, r], k) => (
            <mesh key={k} position={[x, y, z]}>
              <sphereGeometry args={[r, 20, 16]} />
              <meshStandardMaterial color="#ffffff" roughness={1} emissive="#ffffff" emissiveIntensity={0.35} transparent opacity={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------------ */
/* Onboarding orb that hatches into Rafiki                                  */
/* ------------------------------------------------------------------------ */

function HatchOrb() {
  const orb = useRef<THREE.Group>(null!);
  const burst = useRef<THREE.Points>(null!);
  const hatchT = useRef<number | null>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 260;
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(1.5 + Math.random() * 3);
      vel.set([v.x, v.y, v.z], i * 3);
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("vel", new THREE.BufferAttribute(vel, 3));
    return g;
  }, []);

  useFrame((state, dt) => {
    const { onboardStep, hatched } = useRafiki.getState();
    const t = state.clock.elapsedTime;
    const showOrb = onboardStep === "orb" && !hatched;
    if (hatched && hatchT.current === null && onboardStep !== null) hatchT.current = t;
    const target = showOrb ? 1 + Math.sin(t * 2.2) * 0.05 : 0;
    orb.current.scale.setScalar(damp(orb.current.scale.x, target, showOrb ? 3 : 10, dt));
    orb.current.rotation.y += dt * 0.6;
    const m = burst.current.material as THREE.PointsMaterial;
    if (hatchT.current !== null) {
      const age = t - hatchT.current;
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const vel = geo.attributes.vel as THREE.BufferAttribute;
      const k = 1 - Math.exp(-age * 2.5);
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, vel.getX(i) * k, 0.6 + vel.getY(i) * k, vel.getZ(i) * k);
      pos.needsUpdate = true;
      m.opacity = Math.max(0, 1 - age / 1.8);
    } else m.opacity = 0;
  });

  return (
    <group position={[0, GROUND, 0]}>
      <group ref={orb} position={[0, 0.65, 0]} scale={0}>
        <mesh>
          <sphereGeometry args={[0.42, 48, 48]} />
          <meshBasicMaterial color={[2.4, 1.7, 1.0]} toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.6, 48, 48]} />
          <meshBasicMaterial color={[1.6, 0.8, 0.5]} transparent opacity={0.18} toneMapped={false} depthWrite={false} />
        </mesh>
        <Sparkles count={40} scale={1.8} size={4} speed={0.8} color="#ffe6b3" />
      </group>
      <points ref={burst} geometry={geo}>
        <pointsMaterial size={0.07} color="#ffe6b3" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </points>
    </group>
  );
}

/** Rafiki pops out of the orb with an elastic spring. */
function Hero() {
  const ref = useRef<THREE.Group>(null!);
  const v = useRef(0);
  useFrame((_, dt) => {
    const { hatched } = useRafiki.getState();
    const target = hatched ? 1 : 0;
    // critically-underdamped spring → bouncy entrance
    const x = ref.current.scale.x;
    v.current += ((target - x) * 120 - v.current * 9) * Math.min(dt, 1 / 30);
    const nx = Math.max(0, x + v.current * Math.min(dt, 1 / 30));
    ref.current.scale.setScalar(nx);
  });
  return (
    <group ref={ref} position={[0, GROUND, 0]} scale={useRafiki.getState().hatched ? 1 : 0}>
      <Rafiki />
    </group>
  );
}

/* ------------------------------------------------------------------------ */
/* Sources as mystery worlds orbiting the planet                            */
/* ------------------------------------------------------------------------ */

function SourceWorlds({ answer }: { answer: Answer }) {
  // Hidden in the wardrobe close-up so labels never cover Rafiki's face.
  const closeUp = useRafiki((s) => s.sheet === "wardrobe");
  return (
    <group position={[0, -0.1, 0]} visible={!closeUp}>
      {answer.sources.map((s, i) => (
        <World key={s.url} answer={answer} source={s} index={i} total={answer.sources.length} found={answer.discovered.includes(s.url)} />
      ))}
    </group>
  );
}

function World({ answer, source, index, total, found }: { answer: Answer; source: Source; index: number; total: number; found: boolean }) {
  const ref = useRef<THREE.Group>(null!);
  const mat = useRef<THREE.MeshPhysicalMaterial>(null!);
  const born = useRef<number | null>(null);
  const pop = useRef(0);
  const ring = index % 2;
  const radius = 1.85 + ring * 0.5 + (index % 3) * 0.08;
  const speed = 0.16 + (ring ? -0.09 : 0) + (index % 4) * 0.015;
  const phase = (index / total) * Math.PI * 2;
  const tilt = ring ? 0.3 : -0.2;
  const color = useMemo(() => new THREE.Color().setHSL((index * 0.13 + 0.55) % 1, 0.75, 0.7), [index]);
  const fog = useMemo(() => new THREE.Color("#c9c2ea"), []);

  useEffect(() => {
    if (found) pop.current = 1;
  }, [found]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    born.current ??= t + index * 0.09;
    const age = Math.max(0, t - born.current);
    const launch = 1 - Math.pow(1 - Math.min(1, age / 1.1), 3);
    const a = phase + t * speed;
    ref.current.position.set(
      Math.cos(a) * radius * launch,
      Math.sin(a) * tilt * radius * launch + 0.25 + Math.sin(t * 1.3 + index) * 0.07 + (1 - launch) * 0.5,
      Math.sin(a) * radius * launch,
    );
    pop.current = damp(pop.current, 0, 5, dt);
    const hovered = useRafiki.getState().hoveredSource === source.id;
    const target = ((hovered ? 1.7 : 1) + pop.current * 0.8) * Math.min(1, age * 3);
    ref.current.scale.setScalar(damp(ref.current.scale.x, target, 10, dt));
    const want = found ? color : fog;
    mat.current.color.lerp(want, 1 - Math.exp(-dt * 6));
    mat.current.emissive.copy(mat.current.color);
    mat.current.emissiveIntensity = found ? 0.55 : 0.15 + (hovered ? 0.4 : 0);
  });

  return (
    <group ref={ref} scale={0}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          visitSource(answer, source);
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <sphereGeometry args={[0.13, 32, 32]} />
        <meshPhysicalMaterial ref={mat} roughness={0.35} clearcoat={0.6} toneMapped={false} />
      </mesh>
      {found && (
        <mesh rotation-x={1.25}>
          <torusGeometry args={[0.2, 0.012, 8, 48]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} toneMapped={false} />
        </mesh>
      )}
      <WorldLabel text={found ? source.domain : `World ${source.id}`} badge={found ? "✓" : "?"} found={found} />
    </group>
  );
}

/**
 * Label as a canvas-texture sprite (no DOM, no nested React root): a white pill
 * with a round badge, drawn once per text change, always facing the camera.
 */
function WorldLabel({ text, badge, found }: { text: string; badge: string; found: boolean }) {
  const { tex, aspect } = useMemo(() => {
    const dpr = 2;
    const font = `900 ${26 * dpr}px "M PLUS Rounded 1c", ui-rounded, system-ui, sans-serif`;
    const probe = document.createElement("canvas").getContext("2d")!;
    probe.font = font;
    const label = text.length > 22 ? text.slice(0, 21) + "…" : text;
    const h = 44 * dpr;
    const w = Math.ceil(probe.measureText(label).width + 62 * dpr);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h + 6 * dpr;
    const g = c.getContext("2d")!;
    const pill = (y: number, fill: string) => {
      g.fillStyle = fill;
      g.beginPath();
      g.roundRect(0, y, w, h, h / 2);
      g.fill();
    };
    pill(5 * dpr, "rgba(58,46,92,0.22)"); // chunky under-shadow
    pill(0, "#ffffff");
    g.fillStyle = found ? "#2ECC8F" : "#C9C2EA";
    g.beginPath();
    g.arc(h / 2, h / 2, 15 * dpr, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `900 ${20 * dpr}px system-ui, sans-serif`;
    g.fillText(badge, h / 2, h / 2 + dpr);
    g.font = font;
    g.textAlign = "left";
    g.fillStyle = found ? "#3A2E5C" : "#6B6190";
    g.fillText(label, h - 2 * dpr, h / 2 + dpr);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { tex: t, aspect: c.width / c.height };
  }, [text, badge, found]);
  useEffect(() => () => tex.dispose(), [tex]);
  const hgt = 0.12;
  return (
    <sprite position={[0, 0.3, 0]} scale={[hgt * aspect, hgt, 1]} renderOrder={10}>
      <spriteMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

/** Orbiting "thought" motes while Rafiki is thinking or searching. */
function ThoughtSwirl() {
  const ref = useRef<THREE.Points>(null!);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 90;
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) seed[i] = Math.random();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, []);
  useFrame((state, dt) => {
    const { pose } = useRafiki.getState();
    const on = pose === "thinking" || pose === "searching";
    const m = ref.current.material as THREE.PointsMaterial;
    m.opacity = damp(m.opacity, on ? 0.95 : 0, 4, dt);
    if (m.opacity < 0.01) return;
    const t = state.clock.elapsedTime;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const seed = geo.attributes.seed as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const s = seed.getX(i);
      const a = t * (0.8 + s) + s * 40;
      const r = 0.95 + s * 0.6;
      pos.setXYZ(i, Math.cos(a) * r, 0.8 + Math.sin(a * 1.7 + s * 9) * 0.45 + s * 0.6, Math.sin(a) * r);
    }
    pos.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo} position={[0, GROUND, 0]}>
      <pointsMaterial size={0.05} color="#fff4c2" transparent opacity={0} depthWrite={false} toneMapped={false} />
    </points>
  );
}

/** Frames the stage for each UI state: centred, beside the answer, wardrobe close-up. */
function Director({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null!);
  const { size } = useThree();
  useFrame((state, dt) => {
    const { current, sheet, onboardStep } = useRafiki.getState();
    const wide = size.width > 900;
    const closeUp = sheet === "wardrobe" || onboardStep === "friend";
    let x = 0,
      y = 0,
      s = 1;
    if (closeUp) {
      x = wide ? -1.35 : 0;
      y = wide ? -0.25 : 1.4;
      s = wide ? 1.45 : 0.95;
    } else if (current) {
      x = wide ? -2.1 : 0;
      y = wide ? 0 : 1.55;
      s = wide ? 1 : 0.62;
    }
    ref.current.position.x = damp(ref.current.position.x, x, 3, dt);
    ref.current.position.y = damp(ref.current.position.y, y, 3, dt);
    ref.current.scale.setScalar(damp(ref.current.scale.x, s, 3, dt));
    const aspect = size.width / size.height;
    const dist = aspect < 1 ? 7.6 + (1 - aspect) * 7 : 7.6;
    state.camera.position.x = damp(state.camera.position.x, state.pointer.x * 0.4, 2, dt);
    state.camera.position.y = damp(state.camera.position.y, 0.6 + state.pointer.y * 0.25, 2, dt);
    state.camera.position.z = damp(state.camera.position.z, dist, 2, dt);
    state.camera.lookAt(0, -0.15, 0);
  });
  return <group ref={ref}>{children}</group>;
}

export function WorldScene() {
  const current = useRafiki((s) => s.current);
  return (
    <Canvas
      className="world"
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: [0, 0.6, 7.6], fov: 36 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <Sky />
      <Stars radius={40} depth={20} count={1800} factor={2.6} fade speed={0.6} />
      <hemisphereLight args={["#fff8fb", "#8a7ad8", 1.25]} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} />
      <directionalLight position={[-4, 2, -3]} intensity={0.9} color="#ffc4e1" />
      <Clouds />
      <Director>
        <Hero />
        <HatchOrb />
        <ThoughtSwirl />
        <Planet />
        {current && <SourceWorlds answer={current} />}
        <Sparkles count={50} scale={[7, 4, 4]} size={2.5} speed={0.35} color="#fff7d6" position={[0, 0.5, 0]} />
      </Director>
      <EffectComposer>
        <Bloom intensity={0.85} luminanceThreshold={0.8} luminanceSmoothing={0.2} mipmapBlur />
        <Vignette eskil={false} offset={0.25} darkness={0.45} />
      </EffectComposer>
    </Canvas>
  );
}

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
