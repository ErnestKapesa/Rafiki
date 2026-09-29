import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useRafiki, type Pose } from "../lib/store";

const damp = THREE.MathUtils.damp;

const BODY = "#b7a4ff";
const BELLY = "#efe9ff";
const CHEEK = "#ff9ec7";
const GLOW = "#ffd36e";

/**
 * Rafiki — a fully procedural character (no model files to load). Every part
 * is driven by the current Pose with springy, damped motion so transitions
 * always feel alive: breathing, blinking, gaze-follow, squash & stretch,
 * lagging antennae, arm waves and amplitude-driven lip-sync.
 */
export function Rafiki() {
  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const eyes = useRef<THREE.Group[]>([]);
  const mouthOpen = useRef<THREE.Mesh>(null!);
  const smile = useRef<THREE.Mesh>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const antennae = useRef<THREE.Group[]>([]);
  const tips = useRef<THREE.MeshStandardMaterial[]>([]);
  const halo = useRef<THREE.Mesh>(null!);

  // Physics-ish state kept outside React for 60fps updates.
  const sim = useMemo(
    () => ({
      blink: 0,
      nextBlink: 2,
      jumpV: 0,
      jumpY: 0,
      squash: 1,
      lastPose: "idle" as Pose,
      antVel: [0, 0],
      antAng: [0, 0],
      prevHeadRotZ: 0,
      prevHeadRotY: 0,
    }),
    [],
  );

  const bodyMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: BODY, roughness: 0.55, sheen: 1, sheenColor: new THREE.Color("#ffffff"), sheenRoughness: 0.4, clearcoat: 0.3 }),
    [],
  );
  const bellyMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: BELLY, roughness: 0.7, sheen: 0.6 }), []);
  const eyeMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#1b1433", roughness: 0.15, clearcoat: 1 }), []);
  const white = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff" }), []);
  const mouthMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a1839", roughness: 0.8 }), []);
  const cheekMat = useMemo(() => new THREE.MeshBasicMaterial({ color: CHEEK, transparent: true, opacity: 0.55 }), []);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 20);
    const t = state.clock.elapsedTime;
    const { pose, mouth } = useRafiki.getState();

    // Pose entered → one-off reactions.
    if (pose !== sim.lastPose) {
      if (pose === "happy") sim.jumpV = 4.2; // hop of joy when results land
      if (pose === "listening") sim.jumpV = 1.6;
      sim.lastPose = pose;
    }

    // Jump + squash/stretch.
    sim.jumpV -= 14 * dt;
    sim.jumpY += sim.jumpV * dt;
    if (sim.jumpY < 0) {
      if (sim.jumpV < -2) sim.squash = 0.78; // landing squash
      sim.jumpY = 0;
      sim.jumpV = 0;
    }
    sim.squash = damp(sim.squash, sim.jumpV > 1 ? 1.12 : 1, 9, dt);
    const breathe = 1 + Math.sin(t * 2.1) * 0.018;
    body.current.position.y = sim.jumpY + Math.sin(t * 1.4) * (pose === "thinking" ? 0.06 : 0.025);
    body.current.scale.set(1 / Math.sqrt(sim.squash) * (2 - breathe), sim.squash * breathe, 1 / Math.sqrt(sim.squash) * (2 - breathe));

    // Whole-body lean.
    const leanX = pose === "listening" ? 0.18 : pose === "thinking" ? -0.08 : 0;
    root.current.rotation.x = damp(root.current.rotation.x, leanX, 5, dt);
    const spin = pose === "searching" ? Math.sin(t * 1.3) * 0.7 : 0;
    root.current.rotation.y = damp(root.current.rotation.y, spin, 3, dt);

    // Head: gaze follows the pointer, tilts when pondering.
    const px = state.pointer.x;
    const py = state.pointer.y;
    let lookY = px * 0.5;
    let lookX = -py * 0.25;
    let tilt = Math.sin(t * 0.7) * 0.04;
    if (pose === "thinking") {
      lookY = 0.35 + Math.sin(t * 0.8) * 0.15;
      lookX = -0.3;
      tilt = 0.22;
    } else if (pose === "speaking") {
      lookY = px * 0.2 + Math.sin(t * 1.7) * 0.1;
      tilt = Math.sin(t * 2.3) * 0.08;
      lookX = -py * 0.1 + Math.sin(t * 3.1) * 0.04; // nod while talking
    } else if (pose === "listening") {
      tilt = -0.14;
      lookX = -0.05;
    }
    const h = head.current;
    h.rotation.y = damp(h.rotation.y, lookY, 6, dt);
    h.rotation.x = damp(h.rotation.x, lookX, 6, dt);
    h.rotation.z = damp(h.rotation.z, tilt, 4, dt);

    // Blink (double-blink sometimes), eyes widen when listening / happy.
    sim.nextBlink -= dt;
    if (sim.nextBlink <= 0) {
      sim.blink = 1;
      sim.nextBlink = Math.random() < 0.2 ? 0.25 : 2 + Math.random() * 3;
    }
    sim.blink = Math.max(0, sim.blink - dt * 7);
    const blinkScale = 1 - Math.sin(sim.blink * Math.PI) * 0.92;
    const wide = pose === "listening" || pose === "happy" ? 1.18 : pose === "thinking" ? 0.85 : 1;
    for (const e of eyes.current) {
      if (!e) continue;
      e.scale.y = damp(e.scale.y, wide * blinkScale, 30, dt);
      e.scale.x = damp(e.scale.x, wide, 10, dt);
    }

    // Mouth: open ellipse while speaking (lip-sync), smile otherwise.
    const talking = pose === "speaking" || mouth.value > 0.05;
    const open = talking ? 0.2 + mouth.value * 1.1 : 0;
    mouthOpen.current.visible = talking;
    smile.current.visible = !talking;
    mouthOpen.current.scale.y = damp(mouthOpen.current.scale.y, Math.max(0.15, open), 25, dt);
    mouthOpen.current.scale.x = damp(mouthOpen.current.scale.x, 1 - mouth.value * 0.25, 25, dt);
    const smileSize = pose === "happy" ? 1.35 : pose === "thinking" ? 0.6 : 1;
    smile.current.scale.setScalar(damp(smile.current.scale.x, smileSize, 8, dt));

    // Arms: wave when happy, gesture while speaking, hug self when thinking.
    const waveL = pose === "happy" ? -2.3 + Math.sin(t * 14) * 0.35 : pose === "speaking" ? -0.5 + Math.sin(t * 3) * 0.35 : 0.25;
    const waveR = pose === "happy" ? 2.3 - Math.sin(t * 14 + 1) * 0.35 : pose === "thinking" ? 1.9 : pose === "speaking" ? 0.5 - Math.sin(t * 2.4) * 0.3 : -0.25;
    armL.current.rotation.z = damp(armL.current.rotation.z, waveL + Math.sin(t * 2) * 0.05, 7, dt);
    armR.current.rotation.z = damp(armR.current.rotation.z, waveR - Math.sin(t * 2) * 0.05, 7, dt);

    // Antennae: spring driven by head angular velocity → natural secondary motion.
    const headVelZ = (h.rotation.z - sim.prevHeadRotZ) / dt;
    const headVelY = (h.rotation.y - sim.prevHeadRotY) / dt;
    sim.prevHeadRotZ = h.rotation.z;
    sim.prevHeadRotY = h.rotation.y;
    antennae.current.forEach((a, i) => {
      if (!a) return;
      const side = i === 0 ? -1 : 1;
      const rest = side * (pose === "listening" ? 0.08 : 0.28) + (pose === "listening" ? 0 : 0);
      const force = -(sim.antAng[i] - rest) * 90 - sim.antVel[i] * 7 - headVelZ * 2.5 - headVelY * side * 0.8 - sim.jumpV * 0.9 * side;
      sim.antVel[i] += force * dt;
      sim.antAng[i] += sim.antVel[i] * dt;
      a.rotation.z = sim.antAng[i];
      a.rotation.x = pose === "listening" ? -0.25 : 0;
    });
    const glow = pose === "thinking" || pose === "searching" ? 2 + Math.sin(t * 8) * 1.2 : pose === "listening" ? 2.5 : 0.9;
    for (const m of tips.current) if (m) m.emissiveIntensity = damp(m.emissiveIntensity, glow, 6, dt);

    // Halo ring pulses while listening/searching.
    const ringOn = pose === "listening" || pose === "searching";
    const hm = halo.current.material as THREE.MeshBasicMaterial;
    hm.opacity = damp(hm.opacity, ringOn ? 0.55 + Math.sin(t * 6) * 0.2 : 0, 6, dt);
    halo.current.scale.setScalar(1 + ((t * 0.8) % 1) * (ringOn ? 0.6 : 0));
    halo.current.rotation.z = t;
  });

  return (
    <group ref={root} position={[0, -0.72, 0]}>
      {/* soft listening halo on the ground */}
      <mesh ref={halo} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.72, 0.8, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={body}>
        {/* feet */}
        <mesh position={[-0.24, 0.08, 0.1]} scale={[1, 0.6, 1.3]} material={bodyMat} castShadow>
          <sphereGeometry args={[0.15, 24, 24]} />
        </mesh>
        <mesh position={[0.24, 0.08, 0.1]} scale={[1, 0.6, 1.3]} material={bodyMat} castShadow>
          <sphereGeometry args={[0.15, 24, 24]} />
        </mesh>

        {/* torso */}
        <mesh position={[0, 0.5, 0]} scale={[1, 0.95, 0.92]} material={bodyMat} castShadow>
          <sphereGeometry args={[0.46, 48, 48]} />
        </mesh>
        <mesh position={[0, 0.44, 0.24]} scale={[0.72, 0.72, 0.5]} material={bellyMat}>
          <sphereGeometry args={[0.42, 32, 32]} />
        </mesh>

        {/* arms (pivot at shoulder) */}
        <group ref={armL} position={[-0.42, 0.62, 0]}>
          <mesh position={[-0.1, -0.2, 0]} rotation-z={-0.35} material={bodyMat} castShadow>
            <capsuleGeometry args={[0.08, 0.26, 8, 16]} />
          </mesh>
        </group>
        <group ref={armR} position={[0.42, 0.62, 0]}>
          <mesh position={[0.1, -0.2, 0]} rotation-z={0.35} material={bodyMat} castShadow>
            <capsuleGeometry args={[0.08, 0.26, 8, 16]} />
          </mesh>
        </group>

        {/* head */}
        <group ref={head} position={[0, 1.12, 0]}>
          <mesh scale={[1.12, 0.94, 1]} material={bodyMat} castShadow>
            <sphereGeometry args={[0.52, 64, 64]} />
          </mesh>

          {/* antennae */}
          {[-1, 1].map((side, i) => (
            <group key={side} position={[side * 0.2, 0.42, -0.05]} ref={(g) => void (antennae.current[i] = g!)}>
              <mesh position={[0, 0.18, 0]} material={bodyMat}>
                <cylinderGeometry args={[0.025, 0.04, 0.36, 12]} />
              </mesh>
              <mesh position={[0, 0.4, 0]}>
                <sphereGeometry args={[0.085, 24, 24]} />
                <meshStandardMaterial
                  ref={(m) => void (tips.current[i] = m!)}
                  color={GLOW}
                  emissive={GLOW}
                  emissiveIntensity={1}
                  toneMapped={false}
                />
              </mesh>
            </group>
          ))}

          {/* eyes */}
          {[-1, 1].map((side, i) => (
            <group key={side} position={[side * 0.2, 0.04, 0.44]} ref={(g) => void (eyes.current[i] = g!)}>
              <mesh scale={[0.9, 1.2, 0.5]} material={eyeMat}>
                <sphereGeometry args={[0.1, 32, 32]} />
              </mesh>
              <mesh position={[0.035, 0.05, 0.05]} material={white}>
                <sphereGeometry args={[0.03, 16, 16]} />
              </mesh>
              <mesh position={[-0.03, -0.045, 0.048]} material={white}>
                <sphereGeometry args={[0.013, 12, 12]} />
              </mesh>
            </group>
          ))}

          {/* cheeks */}
          <mesh position={[-0.34, -0.1, 0.36]} rotation-y={-0.6} material={cheekMat}>
            <circleGeometry args={[0.075, 32]} />
          </mesh>
          <mesh position={[0.34, -0.1, 0.36]} rotation-y={0.6} material={cheekMat}>
            <circleGeometry args={[0.075, 32]} />
          </mesh>

          {/* mouth: smile arc & talking ellipse */}
          <mesh ref={smile} position={[0, -0.13, 0.475]} rotation-z={Math.PI} material={mouthMat}>
            <torusGeometry args={[0.06, 0.016, 12, 32, Math.PI]} />
          </mesh>
          <mesh ref={mouthOpen} position={[0, -0.15, 0.47]} scale={[1, 0.2, 0.4]} material={mouthMat}>
            <sphereGeometry args={[0.07, 24, 24]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
