/**
 * Every sound in Rafiki is synthesised live with the Web Audio API — no audio
 * files, no licensing, ~0 bytes. Soft sine/triangle voices, short envelopes and
 * a shared "space" delay give it a cosy, toy-like feel.
 */

let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let space: DelayNode;

const PREFS_KEY = "rafiki.audio.v1";
type Prefs = { sfx: boolean; music: boolean };
let prefs: Prefs = (() => {
  try {
    return { sfx: true, music: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch {
    return { sfx: true, music: true };
  }
})();

export const audioPrefs = () => prefs;
export function setAudioPrefs(p: Partial<Prefs>) {
  prefs = { ...prefs, ...p };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  if (ctx) {
    sfxBus.gain.value = prefs.sfx ? 1 : 0;
    musicBus.gain.setTargetAtTime(prefs.music ? 0.9 : 0, ctx.currentTime, 0.4);
  }
  if (prefs.music) startMusic();
}

/** Must be called from a user gesture at least once (browser autoplay rules). */
export function unlockAudio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = prefs.sfx ? 1 : 0;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = prefs.music ? 0.9 : 0;
    musicBus.connect(master);
    // feedback delay = cheap, lovely "space"
    space = ctx.createDelay(1);
    space.delayTime.value = 0.23;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2600;
    space.connect(tone).connect(fb).connect(space);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    space.connect(wet).connect(master);
  }
  if (ctx.state === "suspended") void ctx.resume();
  if (prefs.music) startMusic();
  return ctx;
}

type Voice = { freq: number; at?: number; dur?: number; type?: OscillatorType; gain?: number; to?: number; wet?: boolean; bus?: "sfx" | "music" };

function note({ freq, at = 0, dur = 0.18, type = "sine", gain = 0.2, to, wet = true, bus = "sfx" }: Voice) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  const out = bus === "music" ? musicBus : sfxBus;
  g.connect(out);
  if (wet) g.connect(space);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(at: number, dur: number, from: number, to: number, gain = 0.12) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t);
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export const sfx = {
  tap: () => note({ freq: 720, to: 980, dur: 0.07, gain: 0.08, wet: false }),
  pop: () => note({ freq: 320, to: 900, dur: 0.11, gain: 0.16 }),
  open: () => {
    note({ freq: hz(79), dur: 0.12, gain: 0.08, type: "triangle" });
    note({ freq: hz(84), at: 0.06, dur: 0.16, gain: 0.07, type: "triangle" });
  },
  close: () => note({ freq: hz(81), to: hz(74), dur: 0.12, gain: 0.07, type: "triangle" }),
  whoosh: () => noise(0, 0.5, 300, 3000, 0.1),
  launch: () => {
    noise(0, 0.45, 400, 4000, 0.08);
    [72, 76, 79, 84].forEach((m, i) => note({ freq: hz(m), at: 0.05 + i * 0.05, dur: 0.2, gain: 0.05 }));
  },
  coin: () => {
    note({ freq: hz(83), dur: 0.08, gain: 0.1, type: "square", wet: false });
    note({ freq: hz(88), at: 0.07, dur: 0.28, gain: 0.09, type: "square" });
  },
  gem: () => [88, 91, 95].forEach((m, i) => note({ freq: hz(m), at: i * 0.045, dur: 0.22, gain: 0.07, type: "triangle" })),
  chime: () => [72, 76, 79, 84].forEach((m, i) => note({ freq: hz(m), at: i * 0.07, dur: 0.5, gain: 0.09 })),
  discover: () => {
    const scale = [84, 86, 88, 91, 93, 96];
    for (let i = 0; i < 6; i++) note({ freq: hz(scale[(Math.random() * scale.length) | 0]), at: i * 0.04, dur: 0.25, gain: 0.06 });
    note({ freq: 200, to: 1200, dur: 0.25, gain: 0.08 });
  },
  correct: () => {
    note({ freq: hz(76), dur: 0.14, gain: 0.14, type: "triangle" });
    note({ freq: hz(83), at: 0.1, dur: 0.35, gain: 0.14, type: "triangle" });
  },
  wrong: () => {
    note({ freq: hz(62), dur: 0.16, gain: 0.12, type: "triangle" });
    note({ freq: hz(57), at: 0.13, dur: 0.3, gain: 0.12, type: "triangle" });
  },
  levelUp: () => {
    [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => note({ freq: hz(m), at: i * 0.075, dur: 0.35, gain: 0.1, type: "triangle" }));
    [84, 88, 91].forEach((m) => note({ freq: hz(m), at: 0.6, dur: 1.1, gain: 0.06 }));
    noise(0.55, 0.8, 2000, 8000, 0.04);
  },
  badge: () => {
    [67, 71, 74, 79].forEach((m, i) => note({ freq: hz(m), at: i * 0.09, dur: 0.4, gain: 0.1 }));
    note({ freq: hz(91), at: 0.4, dur: 0.9, gain: 0.05 });
  },
  micOn: () => note({ freq: 520, to: 880, dur: 0.12, gain: 0.12 }),
  micOff: () => note({ freq: 880, to: 520, dur: 0.12, gain: 0.1 }),
  hatch: () => {
    note({ freq: 110, to: 880, dur: 1.2, gain: 0.12, type: "sine" });
    noise(0, 1.2, 200, 6000, 0.06);
    [72, 76, 79, 84, 88].forEach((m, i) => note({ freq: hz(m), at: 1.1 + i * 0.07, dur: 0.6, gain: 0.08 }));
  },
  purchase: () => {
    sfx.coin();
    setTimeout(sfx.chime, 120);
  },
  error: () => note({ freq: 220, to: 160, dur: 0.2, gain: 0.1, type: "triangle" }),
};

/**
 * "Animalese" babble: each syllable is a tiny sung vowel — a soft triangle +
 * sine voice through two vowel formant filters, riding a gentle melody that
 * lifts at the end of questions. Cute, never robotic.
 */
const FORMANTS: Record<string, [number, number]> = {
  a: [800, 1200],
  e: [500, 1900],
  i: [320, 2400],
  o: [500, 900],
  u: [350, 800],
  y: [320, 2200],
};

export function babble(text: string, pitch = 1.2, onSyllable?: (i: number) => void) {
  const c = unlockAudio();
  const syllables = text.replace(/[^a-z ?!.,]/gi, "").match(/[bcdfghjklmnpqrstvwxz]*[aeiouy]+|[?!.,]/gi) ?? [];
  const base = 290 * pitch;
  let t = 0;
  let i = 0;
  const step = 0.068;
  const question = /\?\s*$/.test(text);
  const voiced = syllables.filter((s) => /[aeiouy]/i.test(s)).slice(0, 55);
  const n = voiced.length;
  for (const syl of syllables) {
    if (i >= n) break;
    if (/[.,!?]/.test(syl)) {
      t += 0.12; // breathe at punctuation
      continue;
    }
    const vowel = (syl.match(/[aeiouy]/i)?.[0] ?? "a").toLowerCase();
    const [f1, f2] = FORMANTS[vowel];
    // Melody: soft wave + small random wobble, rising at the end of a question.
    const contour = 1 + 0.07 * Math.sin(i * 0.9) + (Math.random() - 0.5) * 0.05 + (question && i > n - 4 ? 0.12 * (i - (n - 4)) : 0);
    const f = base * contour;
    const at = c.currentTime + t;
    const dur = step * (syl.length > 3 ? 1.25 : 1);
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, at);
    out.gain.exponentialRampToValueAtTime(0.1, at + 0.012);
    out.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    const b1 = c.createBiquadFilter();
    b1.type = "bandpass";
    b1.frequency.value = f1;
    b1.Q.value = 4;
    const b2 = c.createBiquadFilter();
    b2.type = "bandpass";
    b2.frequency.value = f2;
    b2.Q.value = 5;
    for (const [type, mult, g] of [
      ["triangle", 1, 1],
      ["sine", 2, 0.5],
    ] as const) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f * mult * 0.97, at);
      o.frequency.exponentialRampToValueAtTime(f * mult * 1.04, at + dur);
      const og = c.createGain();
      og.gain.value = g;
      o.connect(og);
      og.connect(b1);
      og.connect(b2);
      og.connect(out); // a little raw body under the formants
      o.start(at);
      o.stop(at + dur + 0.03);
    }
    const f1g = c.createGain();
    f1g.gain.value = 2.2;
    const f2g = c.createGain();
    f2g.gain.value = 1.4;
    b1.connect(f1g).connect(out);
    b2.connect(f2g).connect(out);
    const trim = c.createGain();
    trim.gain.value = 0.55;
    out.connect(trim).connect(sfxBus);
    trim.connect(space);
    const idx = i;
    if (onSyllable) setTimeout(() => onSyllable(idx), t * 1000);
    t += dur;
    i++;
  }
  return new Promise<void>((r) => setTimeout(r, t * 1000 + 150));
}

/* ------------------------------------------------------------------------ */
/* Ambient music: a slow, generative pentatonic music box over a soft pad.   */
/* ------------------------------------------------------------------------ */
let musicTimer: number | null = null;
function startMusic() {
  if (!ctx || musicTimer !== null) return;
  const scale = [60, 62, 64, 67, 69, 72, 74, 76, 79];
  const chords = [
    [48, 55, 64],
    [45, 52, 60],
    [41, 48, 57],
    [43, 50, 59],
  ];
  let step = 0;
  const tick = () => {
    if (prefs.music) {
      if (step % 16 === 0) {
        const chord = chords[(step / 16) % chords.length];
        chord.forEach((m) => note({ freq: hz(m), dur: 5.5, gain: 0.018, type: "sine", bus: "music" }));
      }
      if (Math.random() < 0.42) {
        const m = scale[(Math.random() * scale.length) | 0] + 12;
        note({ freq: hz(m), dur: 1.4, gain: 0.022, type: "triangle", bus: "music" });
      }
    }
    step++;
  };
  tick();
  musicTimer = window.setInterval(tick, 360);
}
