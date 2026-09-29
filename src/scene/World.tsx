import { Float, Html, Sparkles, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Mood, Source } from "../../shared/types";
import { useRafiki } from "../lib/store";
import { Rafiki } from "./Rafiki";

const damp = THREE.MathUtils.damp;

/** Sky gradients per mood (top, bottom). The sky melts between them. */
const SKIES: Record<Mood | "listening", [string, string]> = {
  curious: ["#5b63e8", "#ffb8dc"],
  excited: ["#ff7aa8", "#ffe19a"],
  serious: ["#27306e", "#8fa6ff"],
  playful: ["#39c3b0", "#ffd3a1"],
  calm: ["#6fa8ff", "#e6c8ff"],
  listening: ["#7a5cff", "#9ff3e4"],
};

function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color(SKIES.curious[0]) },
          bottom: { value: new THREE.Color(SKIES.curious[1]) },
          time: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vPos;
          void main() { vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top; uniform vec3 bottom; uniform float time;
          varying vec3 vPos;
          void main() {
            float h = smoothstep(-0.35, 0.75, vPos.y + 0.05 * sin(vPos.x * 3.0 + time * 0.2));
            vec3 c = mix(bottom, top, h);
            // soft aurora band
            float band = exp(-pow((vPos.y - 0.25 - 0.08 * sin(vPos.x * 4.0 + time * 0.3)) * 7.0, 2.0));
            c += band * 0.08;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  const tTop = useMemo(() => new THREE.Color(), []);
  const tBottom = useMemo(() => new THREE.Color(), []);
  useFrame((s, dt) => {
    const { pose, current } = useRafiki.getState();
    const key = pose === "listening" ? "listening" : (current?.mood ?? "curious");
    tTop.set(SKIES[key][0]);
    tBottom.set(SKIES[key][1]);
    mat.uniforms.top.value.lerp(tTop, 1 - Math.exp(-dt * 1.5));
    mat.uniforms.bottom.value.lerp(tBottom, 1 - Math.exp(-dt * 1.5));
    mat.uniforms.time.value = s.clock.elapsedTime;
  });
  return (
    <mesh material={mat}>
      <sphereGeometry args={[60, 32, 32]} />
    </mesh>
  );
}

/** Rafiki's tiny home planet, dotted with crystals and mushrooms. */
function Planet() {
  const ref = useRef<THREE.Group>(null!);
  const props = useMemo(() => {
    const out: { pos: THREE.Vector3; quat: THREE.Quaternion; kind: number; s: number; color: string }[] = [];
    const rng = mulberry(7);
    const colors = ["#ffb4a2", "#ffd6a5", "#a0c4ff", "#caffbf", "#ffc6ff", "#fdffb6"];
    for (let i = 0; i < 46; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(1 - rng() * 1.3); // cluster on the top hemisphere
      const n = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
      if (n.y > 0.93 && Math.abs(n.x) < 0.35) continue; // keep Rafiki's spot clear
      out.push({
        pos: n.clone().multiplyScalar(2.2),
        quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n),
        kind: Math.floor(rng() * 3),
        s: 0.6 + rng() * 0.8,
        color: colors[Math.floor(rng() * colors.length)],
      });
    }
    return out;
  }, []);

  useFrame((_, dt) => {
    const { pose } = useRafiki.getState();
    ref.current.rotation.y += dt * (pose === "searching" ? 0.5 : 0.04);
  });

  return (
    <group position={[0, -2.92, 0]}>
      <mesh receiveShadow>
        <sphereGeometry args={[2.2, 96, 96]} />
        <meshPhysicalMaterial color="#9fe8cf" roughness={0.85} sheen={1} sheenColor="#ffffff" />
      </mesh>
      <group ref={ref}>
        {props.map((p, i) => (
          <group key={i} position={p.pos} quaternion={p.quat} scale={p.s}>
            {p.kind === 0 && (
              <mesh position={[0, 0.12, 0]} castShadow>
                <octahedronGeometry args={[0.12, 0]} />
                <meshPhysicalMaterial color={p.color} roughness={0.1} transmission={0.4} thickness={0.5} emissive={p.color} emissiveIntensity={0.25} />
              </mesh>
            )}
            {p.kind === 1 && (
              <>
                <mesh position={[0, 0.07, 0]}>
                  <cylinderGeometry args={[0.025, 0.035, 0.14, 8]} />
                  <meshStandardMaterial color="#fff6e8" />
                </mesh>
                <mesh position={[0, 0.15, 0]} scale={[1, 0.6, 1]} castShadow>
                  <sphereGeometry args={[0.08, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshStandardMaterial color={p.color} />
                </mesh>
              </>
            )}
            {p.kind === 2 && (
              <mesh position={[0, 0.05, 0]} scale={[1, 0.7, 1]}>
                <sphereGeometry args={[0.07, 12, 12]} />
                <meshStandardMaterial color="#6fd3a8" />
              </mesh>
            )}
          </group>
        ))}
      </group>
    </group>
  );
}

/**
 * Every web source becomes a little moon orbiting Rafiki's planet. They launch
 * from Rafiki when results arrive, glow when their citation is hovered in the
 * answer, and open the page when clicked.
 */
function SourceMoons({ sources }: { sources: Source[] }) {
  return (
    <group position={[0, -0.2, 0]}>
      {sources.map((s, i) => (
        <Moon key={s.url} source={s} index={i} total={sources.length} />
      ))}
    </group>
  );
}

function Moon({ source, index, total }: { source: Source; index: number; total: number }) {
  const ref = useRef<THREE.Group>(null!);
  const born = useRef<number | null>(null);
  const ring = index % 2;
  const radius = 1.75 + ring * 0.45 + (index % 3) * 0.1;
  const speed = 0.18 + (ring ? -0.1 : 0) + (index % 4) * 0.02;
  const phase = (index / total) * Math.PI * 2;
  const tiltAxis = ring ? 0.35 : -0.22;
  const color = useMemo(() => new THREE.Color().setHSL((index * 0.13 + 0.55) % 1, 0.8, 0.72), [index]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    born.current ??= t + index * 0.09;
    const age = Math.max(0, t - born.current);
    const launch = 1 - Math.pow(1 - Math.min(1, age / 1.1), 3); // ease-out cubic from Rafiki
    const a = phase + t * speed;
    const x = Math.cos(a) * radius * launch;
    const z = Math.sin(a) * radius * launch;
    const y = Math.sin(a) * tiltAxis * radius * launch + 0.2 + Math.sin(t * 1.3 + index) * 0.08 + (1 - launch) * 0.4;
    ref.current.position.set(x, y, z);
    const hovered = useRafiki.getState().hoveredSource === source.id;
    const target = (hovered ? 1.8 : 1) * Math.min(1, age * 3);
    ref.current.scale.setScalar(damp(ref.current.scale.x, target, 10, dt));
  });

  return (
    <group ref={ref} scale={0}>
      <mesh onClick={() => window.open(source.url, "_blank", "noopener")}>
        <sphereGeometry args={[0.13, 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} roughness={0.3} toneMapped={false} />
      </mesh>
      <Html center distanceFactor={4} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="moon-label">
          {source.favicon ? <img src={source.favicon} alt="" /> : null}
          <span>{source.id}</span>
        </div>
      </Html>
    </group>
  );
}

/** Orbiting "thought" motes while Rafiki is thinking or searching. */
function ThoughtSwirl() {
  const ref = useRef<THREE.Points>(null!);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 90;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) seed[i] = Math.random();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, []);
  useFrame((state, dt) => {
    const { pose } = useRafiki.getState();
    const on = pose === "thinking" || pose === "searching";
    const m = ref.current.material as THREE.PointsMaterial;
    m.opacity = damp(m.opacity, on ? 0.9 : 0, 4, dt);
    const t = state.clock.elapsedTime;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const seed = geo.attributes.seed as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const s = seed.getX(i);
      const a = t * (0.8 + s) + s * 40;
      const r = 0.9 + s * 0.6;
      pos.setXYZ(i, Math.cos(a) * r, 0.9 + Math.sin(a * 1.7 + s * 9) * 0.5 + s * 0.6, Math.sin(a) * r);
    }
    pos.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo} position={[0, -0.72, 0]}>
      <pointsMaterial size={0.05} color="#fff4c2" transparent opacity={0} depthWrite={false} toneMapped={false} />
    </points>
  );
}

/** Slides the stage aside on wide screens when an answer panel is open. */
function Stage({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null!);
  const { size } = useThree();
  useFrame((state, dt) => {
    const open = !!useRafiki.getState().current;
    const wide = size.width > 900;
    const x = open && wide ? -2.1 : 0;
    const y = open && !wide ? 1.55 : 0;
    const s = open && !wide ? 0.62 : 1;
    ref.current.position.x = damp(ref.current.position.x, x, 3, dt);
    ref.current.position.y = damp(ref.current.position.y, y, 3, dt);
    ref.current.scale.setScalar(damp(ref.current.scale.x, s, 3, dt));
    // gentle parallax; back the camera off on portrait screens so Rafiki fits
    const aspect = size.width / size.height;
    const dist = aspect < 1 ? 7.6 + (1 - aspect) * 7 : 7.6;
    state.camera.position.x = damp(state.camera.position.x, state.pointer.x * 0.4, 2, dt);
    state.camera.position.y = damp(state.camera.position.y, 0.6 + state.pointer.y * 0.25, 2, dt);
    state.camera.position.z = damp(state.camera.position.z, dist, 2, dt);
    state.camera.lookAt(0, -0.15, 0);
  });
  return <group ref={ref}>{children}</group>;
}

export function World() {
  const sources = useRafiki((s) => s.current?.sources ?? EMPTY);
  return (
    <Canvas
      className="world"
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 0.6, 7.6], fov: 36 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <Sky />
      <Stars radius={40} depth={20} count={1500} factor={2.5} fade speed={0.6} />
      <hemisphereLight args={["#fff5fb", "#6a5acd", 1.1]} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-3, 1, -2]} intensity={12} color="#ff9ecf" />
      <Stage>
        <Float speed={1.2} rotationIntensity={0.05} floatIntensity={0.15}>
          <Rafiki />
        </Float>
        <ThoughtSwirl />
        <Planet />
        <SourceMoons sources={sources} />
        <Sparkles count={50} scale={[7, 4, 4]} size={2.5} speed={0.35} color="#fff7d6" position={[0, 0.5, 0]} />
      </Stage>
      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.75} luminanceSmoothing={0.2} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.55} />
      </EffectComposer>
    </Canvas>
  );
}

const EMPTY: Source[] = [];

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
