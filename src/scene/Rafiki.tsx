import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { paletteOf, type Character } from "../../shared/game";
import { useCharacter } from "../game/store";
import { useRafiki, type Pose } from "../lib/store";

const damp = THREE.MathUtils.damp;

/* ------------------------------------------------------------------------ */
/* Body shape: a lathed "mochi" gumdrop — soft, round, squishy.              */
/* ------------------------------------------------------------------------ */
const PROFILE = new THREE.SplineCurve(
  [
    [0, 0],
    [0.46, 0.015],
    [0.64, 0.14],
    [0.7, 0.38],
    [0.67, 0.66],
    [0.56, 0.93],
    [0.36, 1.12],
    [0.001, 1.19],
  ].map(([x, y]) => new THREE.Vector2(x, y)),
).getPoints(48);

const Z_SCALE = 0.9;
const BODY_H = 1.19;

/** Radius of the body at height y (linear interp over the lathe profile). */
function radiusAt(y: number) {
  for (let i = 1; i < PROFILE.length; i++) {
    const a = PROFILE[i - 1];
    const b = PROFILE[i];
    if (y >= a.y && y <= b.y) return a.x + ((y - a.y) / (b.y - a.y || 1)) * (b.x - a.x);
  }
  return 0;
}

/** Point on the front surface at (x, y), pushed out by `lift`, plus a facing quaternion. */
function onSurface(x: number, y: number, lift = 0) {
  const r = radiusAt(y);
  const z = Math.sqrt(Math.max(r * r - x * x, 0)) * Z_SCALE;
  const n = new THREE.Vector3(x, (y - 0.55) * 0.55, z / Z_SCALE).normalize();
  const pos = new THREE.Vector3(x, y, z).addScaledVector(n, lift);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  return { pos, quat };
}

/** Height of the top surface at horizontal offset x. */
function topAt(x: number) {
  for (let i = PROFILE.length - 1; i > 0; i--) {
    if (PROFILE[i].x >= Math.abs(x)) return PROFILE[i].y;
  }
  return 0.9;
}

const bodyGeo = (() => {
  const g = new THREE.LatheGeometry(PROFILE, 72);
  g.scale(1, 1, Z_SCALE);
  g.computeVertexNormals();
  return g;
})();

function plush(color: string, sheen = "#ffffff") {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.92,
    sheen: 1,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(sheen),
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.07,
  });
}

/* ------------------------------------------------------------------------ */

export function Rafiki({ override, scale = 1 }: { override?: Character; scale?: number }) {
  const stored = useCharacter();
  const c = override ?? stored;
  const pal = paletteOf(c.color);

  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const face = useRef<THREE.Group>(null!);
  const eyes = useRef<THREE.Group[]>([]);
  const happyEyes = useRef<THREE.Group>(null!);
  const normalEyes = useRef<THREE.Group>(null!);
  const mouthOpen = useRef<THREE.Group>(null!);
  const smile = useRef<THREE.Mesh>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const ears = useRef<THREE.Group[]>([]);
  const glowMats = useRef<THREE.MeshStandardMaterial[]>([]);

  // Materials live for the component lifetime; colours ease toward the palette.
  const mats = useMemo(
    () => ({
      body: plush(pal.body),
      belly: plush(pal.belly),
      accent: plush(pal.accent),
      cheek: new THREE.MeshBasicMaterial({ color: pal.cheek, transparent: true, opacity: 0.5, depthWrite: false }),
      eye: new THREE.MeshPhysicalMaterial({ color: "#2a2340", roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
      white: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      mouth: new THREE.MeshStandardMaterial({ color: "#4a2338", roughness: 0.7 }),
      tongue: new THREE.MeshStandardMaterial({ color: "#ff8fa8", roughness: 0.7 }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const target = useMemo(() => ({ body: new THREE.Color(), belly: new THREE.Color(), accent: new THREE.Color(), cheek: new THREE.Color() }), []);

  const sim = useMemo(
    () => ({ blink: 0, nextBlink: 2, jumpV: 0, jumpY: 0, squash: 1, lastPose: "idle" as Pose, earVel: [0, 0], earAng: [0, 0], prevRotY: 0, prevRotZ: 0, spin: 0 }),
    [],
  );

  // Pre-computed feature placements on the body surface.
  const place = useMemo(() => {
    const hasHat = !!c.hat && c.hat !== "flower";
    const earX = hasHat ? 0.42 : 0.3;
    return {
      eyeL: onSurface(-0.2, 0.8, 0.0),
      eyeR: onSurface(0.2, 0.8, 0.0),
      mouth: onSurface(0, 0.665, 0.004),
      cheekL: onSurface(-0.36, 0.69, 0.006),
      cheekR: onSurface(0.36, 0.69, 0.006),
      belly: onSurface(0, 0.27, -0.17),
      earX,
      earY: topAt(earX) - 0.04,
      spots: [
        onSurface(-0.5, 0.44, -0.01),
        onSurface(0.55, 0.52, -0.012),
        onSurface(0.42, 0.9, -0.01),
        onSurface(-0.3, 0.98, -0.01),
      ],
    };
  }, [c.hat]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 20);
    const t = state.clock.elapsedTime;
    const { pose, mouth } = useRafiki.getState();

    // Ease material colours (smooth recolour in the wardrobe).
    const k = 1 - Math.exp(-dt * 8);
    target.body.set(pal.body);
    target.belly.set(pal.belly);
    target.accent.set(pal.accent);
    target.cheek.set(pal.cheek);
    mats.body.color.lerp(target.body, k);
    mats.body.emissive.copy(mats.body.color);
    mats.belly.color.lerp(target.belly, k);
    mats.belly.emissive.copy(mats.belly.color);
    mats.accent.color.lerp(target.accent, k);
    mats.accent.emissive.copy(mats.accent.color);
    mats.cheek.color.lerp(target.cheek, k);

    if (pose !== sim.lastPose) {
      if (pose === "happy") sim.jumpV = 4.2;
      if (pose === "celebrate") {
        sim.jumpV = 5.5;
        sim.spin = Math.PI * 2;
      }
      if (pose === "listening") sim.jumpV = 1.6;
      sim.lastPose = pose;
    }

    // Jump physics in fixed 1/120s substeps → identical motion at any frame rate.
    for (let left = Math.min(dtRaw, 0.25); left > 0; left -= 1 / 120) {
      const h = Math.min(left, 1 / 120);
      sim.jumpV -= 14 * h;
      sim.jumpY += sim.jumpV * h;
      if (sim.jumpY < 0) {
        if (sim.jumpV < -2) sim.squash = 0.8;
        sim.jumpY = 0;
        sim.jumpV = 0;
      }
    }
    sim.squash = damp(sim.squash, sim.jumpV > 1 ? 1.1 : 1, 9, dt);
    const breathe = 1 + Math.sin(t * 2.2) * 0.02;
    const sy = sim.squash * breathe;
    const sxz = 1 / Math.sqrt(sy);
    body.current.scale.set(sxz, sy, sxz);
    body.current.position.y = sim.jumpY;

    // Whole-body turn: spin on celebrate, sway when searching, face the pointer.
    sim.spin = damp(sim.spin, 0, 3.5, dt);
    const sway = pose === "searching" ? Math.sin(t * 1.6) * 0.6 : 0;
    root.current.rotation.y = damp(root.current.rotation.y, sway + state.pointer.x * 0.25, 4, dt) ;
    body.current.rotation.y = sim.spin;
    const lean = pose === "listening" ? 0.14 : pose === "thinking" ? -0.06 : 0;
    root.current.rotation.x = damp(root.current.rotation.x, lean, 5, dt);

    // Face "looks" by sliding features across the surface a touch + head tilt.
    let tilt = Math.sin(t * 0.8) * 0.035;
    let lookX = state.pointer.x * 0.05;
    let lookY = state.pointer.y * 0.03;
    if (pose === "thinking") {
      tilt = 0.16;
      lookX = 0.06;
      lookY = 0.05;
    } else if (pose === "speaking") {
      tilt = Math.sin(t * 2.4) * 0.07;
    } else if (pose === "listening") {
      tilt = -0.12;
    }
    body.current.rotation.z = damp(body.current.rotation.z, tilt * 0.6, 4, dt);
    face.current.position.x = damp(face.current.position.x, lookX, 6, dt);
    face.current.position.y = damp(face.current.position.y, lookY, 6, dt);

    // Blinks & eye states.
    sim.nextBlink -= dt;
    if (sim.nextBlink <= 0) {
      sim.blink = 1;
      sim.nextBlink = Math.random() < 0.2 ? 0.25 : 2 + Math.random() * 3;
    }
    sim.blink = Math.max(0, sim.blink - dt * 7);
    const blinkScale = 1 - Math.sin(sim.blink * Math.PI) * 0.92;
    const wide = pose === "listening" ? 1.15 : pose === "thinking" ? 0.9 : 1;
    const happy = pose === "happy" || pose === "celebrate";
    happyEyes.current.visible = happy;
    normalEyes.current.visible = !happy;
    for (const e of eyes.current) {
      if (!e) continue;
      e.scale.y = damp(e.scale.y, wide * blinkScale * (c.eyes === "sleepy" ? 0.55 : 1), 30, dt);
      e.scale.x = damp(e.scale.x, wide, 10, dt);
    }

    // Mouth: smile ↔ talking (amplitude-driven lip-sync).
    const talking = pose === "speaking" || mouth.value > 0.05;
    mouthOpen.current.visible = talking;
    smile.current.visible = !talking;
    mouthOpen.current.scale.y = damp(mouthOpen.current.scale.y, 0.25 + mouth.value * 1.1, 25, dt);
    smile.current.scale.setScalar(damp(smile.current.scale.x, happy ? 1.4 : pose === "thinking" ? 0.7 : 1, 8, dt));

    // Arms.
    const wl = happy ? -2.4 + Math.sin(t * 14) * 0.35 : pose === "speaking" ? -0.6 + Math.sin(t * 3) * 0.3 : 0.15 + Math.sin(t * 2) * 0.05;
    const wr = happy ? 2.4 - Math.sin(t * 14 + 1) * 0.35 : pose === "thinking" ? 2.0 : pose === "speaking" ? 0.5 - Math.sin(t * 2.4) * 0.3 : -0.15 - Math.sin(t * 2) * 0.05;
    armL.current.rotation.z = damp(armL.current.rotation.z, wl, 7, dt);
    armR.current.rotation.z = damp(armR.current.rotation.z, wr, 7, dt);

    // Ears / antennae: damped springs kicked by body motion (secondary motion).
    const vz = (body.current.rotation.z - sim.prevRotZ) / dt;
    const vy = (root.current.rotation.y - sim.prevRotY) / dt;
    sim.prevRotZ = body.current.rotation.z;
    sim.prevRotY = root.current.rotation.y;
    const floppy = c.species === "bunny" ? 0.5 : 1;
    ears.current.forEach((g, i) => {
      if (!g) return;
      const side = i === 0 ? -1 : 1;
      const rest = side * (pose === "listening" ? 0.02 : c.species === "bunny" ? 0.18 : 0.08);
      const kick = -vz * 2.2 - vy * side * 0.7 - sim.jumpV * 0.8 * side;
      for (let left = Math.min(dtRaw, 0.25); left > 0; left -= 1 / 120) {
        const h = Math.min(left, 1 / 120);
        const f = -(sim.earAng[i] - rest) * 70 * floppy - sim.earVel[i] * 6 + kick;
        sim.earVel[i] += f * h;
        sim.earAng[i] += sim.earVel[i] * h;
      }
      g.rotation.z = sim.earAng[i];
    });
    const glow = pose === "thinking" || pose === "searching" ? 2.2 + Math.sin(t * 8) * 1.2 : pose === "listening" ? 2.6 : 1;
    for (const m of glowMats.current) if (m) m.emissiveIntensity = damp(m.emissiveIntensity, glow, 6, dt);
  });

  const Eye = ({ p, i }: { p: ReturnType<typeof onSurface>; i: number }) => {
    const big = c.eyes === "sparkle" ? 1.2 : 1;
    return (
      <group position={p.pos} quaternion={p.quat}>
        <group ref={(g) => void (eyes.current[i] = g!)}>
          <mesh scale={[0.078 * big, 0.098 * big, 0.04]} material={mats.eye}>
            <sphereGeometry args={[1, 32, 32]} />
          </mesh>
          <mesh position={[0.026 * big, 0.034 * big, 0.036]} material={mats.white}>
            <sphereGeometry args={[0.024 * big, 16, 16]} />
          </mesh>
          <mesh position={[-0.024 * big, -0.03 * big, 0.036]} material={mats.white}>
            <sphereGeometry args={[0.011 * big, 12, 12]} />
          </mesh>
          {c.eyes === "sparkle" && (
            <mesh position={[0.03, -0.012, 0.038]} material={mats.white}>
              <sphereGeometry args={[0.008, 8, 8]} />
            </mesh>
          )}
        </group>
      </group>
    );
  };

  return (
    <group ref={root} scale={scale}>
      <group ref={body}>
        {/* body */}
        <mesh geometry={bodyGeo} material={mats.body} castShadow receiveShadow />

        {/* belly / spots */}
        {c.pattern === "belly" && (
          <mesh position={place.belly.pos} quaternion={place.belly.quat} scale={[0.36, 0.26, 0.2]} material={mats.belly}>
            <sphereGeometry args={[1, 32, 24]} />
          </mesh>
        )}
        {c.pattern === "spots" &&
          place.spots.map((s, i) => (
            <mesh key={i} position={s.pos} quaternion={s.quat} scale={[0.1 + (i % 2) * 0.03, 0.09 + (i % 2) * 0.03, 0.03]} material={mats.accent}>
              <sphereGeometry args={[1, 20, 16]} />
            </mesh>
          ))}

        {/* feet */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.27, 0.05, 0.2]} scale={[0.15, 0.08, 0.18]} material={mats.body} castShadow>
            <sphereGeometry args={[1, 24, 16]} />
          </mesh>
        ))}

        {/* arms (pivot at shoulder) */}
        <group ref={armL} position={[-0.64, 0.4, 0.05]}>
          <mesh position={[-0.05, -0.1, 0]} scale={[0.1, 0.15, 0.1]} material={mats.body} castShadow>
            <sphereGeometry args={[1, 20, 16]} />
          </mesh>
        </group>
        <group ref={armR} position={[0.64, 0.4, 0.05]}>
          <mesh position={[0.05, -0.1, 0]} scale={[0.1, 0.15, 0.1]} material={mats.body} castShadow>
            <sphereGeometry args={[1, 20, 16]} />
          </mesh>
        </group>

        {/* face */}
        <group ref={face}>
          <group ref={normalEyes}>
            <Eye p={place.eyeL} i={0} />
            <Eye p={place.eyeR} i={1} />
            {c.eyes === "sleepy" &&
              [place.eyeL, place.eyeR].map((p, i) => (
                <mesh key={i} position={p.pos} quaternion={p.quat} material={mats.body}>
                  <sphereGeometry args={[0.1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
                </mesh>
              ))}
          </group>
          <group ref={happyEyes} visible={false}>
            {[place.eyeL, place.eyeR].map((p, i) => (
              <group key={i} position={p.pos} quaternion={p.quat}>
                <mesh position={[0, -0.02, 0.02]} material={mats.eye}>
                  <torusGeometry args={[0.055, 0.016, 10, 24, Math.PI]} />
                </mesh>
              </group>
            ))}
          </group>

          {[place.cheekL, place.cheekR].map((p, i) => (
            <mesh key={i} position={p.pos} quaternion={p.quat} material={mats.cheek}>
              <circleGeometry args={[0.07, 32]} />
            </mesh>
          ))}

          <Eyewear c={c} place={place} />

          <group position={place.mouth.pos} quaternion={place.mouth.quat}>
            <mesh ref={smile} rotation-z={Math.PI} position={[0, 0.012, 0.004]} material={mats.mouth}>
              <torusGeometry args={[0.04, 0.012, 10, 24, Math.PI]} />
            </mesh>
            <group ref={mouthOpen} scale={[1, 0.3, 1]}>
              <mesh scale={[0.05, 0.05, 0.02]} material={mats.mouth}>
                <sphereGeometry args={[1, 20, 16]} />
              </mesh>
              <mesh position={[0, -0.022, 0.01]} scale={[0.03, 0.018, 0.012]} material={mats.tongue}>
                <sphereGeometry args={[1, 16, 12]} />
              </mesh>
            </group>
          </group>
        </group>

        {/* species ears / top */}
        <Ears c={c} mats={mats} place={place} ears={ears} glowMats={glowMats} />

        {/* wardrobe */}
        <Accessories c={c} place={place} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------------ */

type Mats = { body: THREE.Material; accent: THREE.Material; belly: THREE.Material };

function Ears({
  c,
  mats,
  place,
  ears,
  glowMats,
}: {
  c: Character;
  mats: Mats;
  place: { earX: number; earY: number };
  ears: React.MutableRefObject<THREE.Group[]>;
  glowMats: React.MutableRefObject<THREE.MeshStandardMaterial[]>;
}) {
  const { earX, earY } = place;
  const set = (i: number) => (g: THREE.Group | null) => void (ears.current[i] = g!);

  if (c.species === "sprout") {
    return (
      <group position={[0, BODY_H - 0.02, 0]} ref={set(0)}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.018, 0.025, 0.18, 10]} />
          <meshStandardMaterial color="#58b87a" roughness={0.7} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.1, 0.18, 0]} rotation={[0, 0, s * -0.7]} scale={[0.13, 0.05, 0.08]}>
            <sphereGeometry args={[1, 20, 12]} />
            <meshPhysicalMaterial color="#7fdc9a" roughness={0.5} sheen={0.5} />
          </mesh>
        ))}
      </group>
    );
  }

  if (c.species === "antenna") {
    return (
      <>
        {[-1, 1].map((s, i) => (
          <group key={s} position={[s * 0.18, BODY_H - 0.08, -0.02]} ref={set(i)}>
            <mesh position={[0, 0.14, 0]} material={mats.body}>
              <cylinderGeometry args={[0.018, 0.028, 0.28, 10]} />
            </mesh>
            <mesh position={[0, 0.31, 0]}>
              <sphereGeometry args={[0.065, 20, 20]} />
              <meshStandardMaterial ref={(m) => void (glowMats.current[i] = m!)} color="#ffd36e" emissive="#ffd36e" emissiveIntensity={1} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </>
    );
  }

  return (
    <>
      {[-1, 1].map((s, i) => (
        <group key={s} position={[s * earX, earY, -0.02]} rotation-z={-s * 0.28} ref={set(i)}>
          {(c.species === "bear" || c.species === "unicorn") && (
            <>
              <mesh position={[0, 0.07, 0]} scale={[0.14, 0.13, 0.08]} material={mats.body}>
                <sphereGeometry args={[1, 24, 20]} />
              </mesh>
              <mesh position={[0, 0.07, 0.05]} scale={[0.08, 0.075, 0.04]} material={mats.accent}>
                <sphereGeometry args={[1, 20, 16]} />
              </mesh>
            </>
          )}
          {c.species === "cat" && (
            <>
              <mesh position={[0, 0.1, 0]} scale={[1, 1, 0.55]} material={mats.body}>
                <coneGeometry args={[0.14, 0.24, 24]} />
              </mesh>
              <mesh position={[0, 0.085, 0.045]} scale={[1, 1, 0.3]} material={mats.accent}>
                <coneGeometry args={[0.08, 0.15, 20]} />
              </mesh>
            </>
          )}
          {c.species === "bunny" && (
            <>
              <mesh position={[0, 0.24, 0]} scale={[1, 1, 0.6]} material={mats.body}>
                <capsuleGeometry args={[0.085, 0.34, 8, 20]} />
              </mesh>
              <mesh position={[0, 0.24, 0.045]} scale={[0.55, 0.85, 0.25]} material={mats.accent}>
                <capsuleGeometry args={[0.085, 0.34, 8, 16]} />
              </mesh>
            </>
          )}
        </group>
      ))}
      {c.species === "unicorn" && (
        <group position={[0, BODY_H - 0.03, 0.12]} rotation-x={0.25}>
          <mesh position={[0, 0.14, 0]}>
            <coneGeometry args={[0.07, 0.3, 24]} />
            <meshPhysicalMaterial color="#ffe7a8" roughness={0.3} clearcoat={1} emissive="#ffd36e" emissiveIntensity={0.25} />
          </mesh>
          {[0.05, 0.12, 0.19].map((y, i) => (
            <mesh key={i} position={[0, y, 0]} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.058 - y * 0.18, 0.009, 8, 24]} />
              <meshStandardMaterial color="#ffb3d9" />
            </mesh>
          ))}
        </group>
      )}
    </>
  );
}

/* ------------------------------------------------------------------------ */

function Accessories({ c, place }: { c: Character; place: { eyeL: { pos: THREE.Vector3 }; eyeR: { pos: THREE.Vector3 } } }) {
  const top = BODY_H;
  const scarfY = 0.5;
  const scarfR = radiusAt(scarfY) - 0.035; // tube sinks into the fur so it hugs the body
  return (
    <>
      {c.neck === "scarf" && (
        <group position={[0, scarfY, 0]}>
          <mesh rotation-x={Math.PI / 2} scale={[1, Z_SCALE, 1]} castShadow>
            <torusGeometry args={[scarfR, 0.085, 20, 72]} />
            <meshPhysicalMaterial color="#ffc83d" roughness={1} sheen={1} sheenColor="#fff3c4" />
          </mesh>
          <group position={[0.3, -0.03, radiusAt(scarfY - 0.12) * Z_SCALE * 0.93]} rotation={[0.2, -0.45, 0.12]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.16, 6, 16]} />
              <meshPhysicalMaterial color="#ffc83d" roughness={1} sheen={1} sheenColor="#fff3c4" />
            </mesh>
            {[-0.045, 0, 0.045].map((x) => (
              <mesh key={x} position={[x, -0.29, 0]}>
                <cylinderGeometry args={[0.012, 0.012, 0.07, 6]} />
                <meshStandardMaterial color="#ff9f1c" />
              </mesh>
            ))}
          </group>
        </group>
      )}
      {c.neck === "bow" && (
        <group position={[0, scarfY + 0.02, radiusAt(scarfY) * Z_SCALE + 0.02]}>
          <mesh>
            <sphereGeometry args={[0.045, 16, 16]} />
            <meshStandardMaterial color="#ff5d8f" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.09, 0, 0]} rotation-z={s * Math.PI / 2}>
              <coneGeometry args={[0.07, 0.14, 20]} />
              <meshStandardMaterial color="#ff5d8f" roughness={0.5} />
            </mesh>
          ))}
        </group>
      )}

      {c.hat === "beanie" && (
        <group position={[0, top - 0.2, 0]}>
          <mesh scale={[1, 0.85, Z_SCALE]} castShadow>
            <sphereGeometry args={[0.47, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshPhysicalMaterial color="#6fa8ff" roughness={1} sheen={1} />
          </mesh>
          <mesh rotation-x={Math.PI / 2} scale={[1, Z_SCALE, 1]}>
            <torusGeometry args={[0.46, 0.055, 12, 48]} />
            <meshPhysicalMaterial color="#e9f2ff" roughness={1} sheen={1} />
          </mesh>
          <mesh position={[0, 0.43, 0]}>
            <sphereGeometry args={[0.09, 20, 16]} />
            <meshPhysicalMaterial color="#e9f2ff" roughness={1} sheen={1} />
          </mesh>
        </group>
      )}
      {c.hat === "tophat" && (
        <group position={[0.06, top - 0.03, 0]} rotation-z={-0.18}>
          <mesh position={[0, 0.02, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.03, 40]} />
            <meshStandardMaterial color="#2d2a4a" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.2, 0.3, 40]} />
            <meshStandardMaterial color="#2d2a4a" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.205, 0.205, 0.06, 40]} />
            <meshStandardMaterial color="#ff5d8f" />
          </mesh>
        </group>
      )}
      {c.hat === "crown" && (
        <group position={[0, top - 0.07, 0]} scale={1.3}>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.2, 0.22, 0.12, 40, 1, true]} />
            <meshPhysicalMaterial color="#ffcc33" metalness={0.8} roughness={0.25} side={THREE.DoubleSide} emissive="#ffb300" emissiveIntensity={0.2} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return (
              <group key={i} position={[Math.sin(a) * 0.2, 0.16, Math.cos(a) * 0.2]}>
                <mesh>
                  <coneGeometry args={[0.04, 0.1, 12]} />
                  <meshPhysicalMaterial color="#ffcc33" metalness={0.8} roughness={0.25} />
                </mesh>
                <mesh position={[0, 0.06, 0]}>
                  <sphereGeometry args={[0.022, 12, 12]} />
                  <meshStandardMaterial color={["#ff5d8f", "#6fa8ff", "#7fdc9a"][i % 3]} emissive={["#ff5d8f", "#6fa8ff", "#7fdc9a"][i % 3]} emissiveIntensity={0.5} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}
      {c.hat === "grad" && (
        <group position={[0, top - 0.02, 0]} rotation-z={0.1}>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.2, 0.22, 0.1, 32]} />
            <meshStandardMaterial color="#2d2a4a" />
          </mesh>
          <mesh position={[0, 0.1, 0]} rotation-y={Math.PI / 4}>
            <boxGeometry args={[0.5, 0.03, 0.5]} />
            <meshStandardMaterial color="#2d2a4a" />
          </mesh>
          <mesh position={[0.22, 0.02, 0.1]}>
            <cylinderGeometry args={[0.012, 0.012, 0.16, 6]} />
            <meshStandardMaterial color="#ffcc33" />
          </mesh>
        </group>
      )}
      {c.hat === "headphones" && (
        <group position={[0, 0.72, 0]}>
          <mesh rotation-z={0} position={[0, 0.02, -0.02]}>
            <torusGeometry args={[0.66, 0.035, 12, 48, Math.PI]} />
            <meshStandardMaterial color="#7b5cff" roughness={0.4} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.66, 0, -0.02]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.12, 0.12, 0.09, 28]} />
              <meshStandardMaterial color="#ff7aa8" roughness={0.4} />
            </mesh>
          ))}
        </group>
      )}
      {c.hat === "flower" && (
        <group position={[0.3, topAt(0.3) - 0.06, 0.2]} rotation={[0.7, 0, -0.45]} scale={1.8}>
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.07, 0.02, Math.sin(a) * 0.07]} scale={[0.07, 0.025, 0.05]} rotation-y={-a}>
                <sphereGeometry args={[1, 16, 12]} />
                <meshPhysicalMaterial color="#ff6f9f" roughness={0.6} sheen={1} />
              </mesh>
            );
          })}
          <mesh position={[0, 0.04, 0]}>
            <sphereGeometry args={[0.035, 16, 12]} />
            <meshStandardMaterial color="#ffd36e" emissive="#ffb300" emissiveIntensity={0.3} />
          </mesh>
        </group>
      )}

    </>
  );
}

function Eyewear({ c, place }: { c: Character; place: { eyeL: { pos: THREE.Vector3 }; eyeR: { pos: THREE.Vector3 } } }) {
  if (c.face !== "glasses" && c.face !== "shades") return null;
  const shades = c.face === "shades";
  const frame = <meshStandardMaterial color="#3a2d5c" roughness={0.3} />;
  return (
    <>
      {[place.eyeL, place.eyeR].map((p, i) => (
        <mesh key={i} position={[p.pos.x, p.pos.y, p.pos.z + 0.05]} rotation-x={shades ? Math.PI / 2 : 0}>
          {shades ? <cylinderGeometry args={[0.105, 0.1, 0.02, 32]} /> : <torusGeometry args={[0.1, 0.014, 10, 32]} />}
          {shades ? <meshPhysicalMaterial color="#1a1530" roughness={0.1} clearcoat={1} /> : frame}
        </mesh>
      ))}
      <mesh position={[0, place.eyeL.pos.y + 0.02, place.eyeL.pos.z + 0.07]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.01, 0.01, 0.14, 8]} />
        {frame}
      </mesh>
    </>
  );
}
