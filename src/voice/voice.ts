import { babble, sfx, unlockAudio } from "../audio/sfx";
import { useRafiki } from "../lib/store";

/* ------------------------------------------------------------------------ */
/* Text-to-speech                                                            */
/*  cute   → Kokoro-82M neural voice (open-source, in-browser), pitched up   */
/*           a touch for a small-character sound; babble while it loads      */
/*  babble → soft "Animalese" syllables, fully synthesised                    */
/*  system → the browser's built-in voice (natural voices preferred)          */
/* ------------------------------------------------------------------------ */

const KOKORO_VOICE = "af_sky"; // youthful, bright
const KOKORO_SPEED = 1.0;
const CUTE_PITCH = 1.12; // playback-rate lift → higher, bouncier, still natural

let worker: Worker | null = null;
let kokoro: "idle" | "loading" | "ready" | "failed" = "idle";
let audioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let speakId = 0;
let rafId = 0;
const pending = new Map<number, (v: { samples: Float32Array; rate: number } | null) => void>();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./kokoro.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === "progress") useRafiki.getState().set({ hdVoiceProgress: m.value });
    else if (m.type === "ready") {
      kokoro = "ready";
      useRafiki.getState().set({ hdVoiceProgress: null });
    } else if (m.type === "audio") pending.get(m.id)?.({ samples: m.samples, rate: m.rate });
    else if (m.type === "error") {
      if (m.id === -1) kokoro = "failed";
      pending.get(m.id)?.(null);
      useRafiki.getState().set({ hdVoiceProgress: null });
      console.warn("[kokoro]", m.message);
    }
  };
  worker.onerror = () => {
    kokoro = "failed";
    useRafiki.getState().set({ hdVoiceProgress: null });
  };
  return worker;
}

/** Start downloading the neural voice in the background (call after a user gesture). */
export function warmVoice() {
  if (kokoro !== "idle" || useRafiki.getState().voiceMode !== "cute") return;
  kokoro = "loading";
  useRafiki.getState().set({ hdVoiceProgress: 0 });
  getWorker().postMessage({ type: "load" });
}

export const voiceStatus = () => kokoro;

export function stopSpeaking() {
  speakId++;
  try {
    currentSource?.stop();
  } catch {
    /* already stopped */
  }
  currentSource = null;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  cancelAnimationFrame(rafId);
  useRafiki.getState().mouth.value = 0;
}

export async function speak(text: string) {
  const s = useRafiki.getState();
  if (s.voiceMode === "off" || !text) return;
  stopSpeaking();
  const id = speakId;
  const clean = text.replace(/\[(\d+)\]/g, "").replace(/[*_#`]/g, "").trim();

  if (s.voiceMode === "system") return speakWebSpeech(clean, id);
  if (s.voiceMode === "babble") return speakBabble(clean, id);

  // cute: neural voice when ready, otherwise charming babble (never a robot).
  warmVoice();
  if (kokoro !== "ready") return speakBabble(clean, id);
  // Sentence streaming: synthesise sentence n+1 while sentence n is playing.
  const parts = (clean.match(/[^.!?]+[.!?]*/g) ?? [clean]).map((p) => p.trim()).filter(Boolean).slice(0, 6);
  let next = synth(parts[0], id);
  for (let i = 0; i < parts.length; i++) {
    const audio = await next;
    if (id !== speakId) return;
    if (!audio) return speakBabble(parts.slice(i).join(" "), id);
    next = i + 1 < parts.length ? synth(parts[i + 1], id) : Promise.resolve(null);
    await playSamples(audio.samples, audio.rate, id, i === parts.length - 1);
  }
}

let synthSeq = 0;
function synth(text: string, owner: number) {
  const key = ++synthSeq * 1000 + (owner % 1000);
  return new Promise<{ samples: Float32Array; rate: number } | null>((resolve) => {
    pending.set(key, (v) => {
      pending.delete(key);
      resolve(v);
    });
    getWorker().postMessage({ type: "speak", id: key, text: text.slice(0, 300), voice: KOKORO_VOICE, speed: KOKORO_SPEED });
  });
}

function playSamples(samples: Float32Array, rate: number, id: number, last = true) {
  audioCtx ??= new AudioContext();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  const buffer = audioCtx.createBuffer(1, samples.length, rate);
  buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = CUTE_PITCH;
  // A little air on top keeps the brighter voice sparkly rather than tinny.
  const shelf = audioCtx.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 5000;
  shelf.gain.value = 3;
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  src.connect(shelf).connect(analyser).connect(audioCtx.destination);
  currentSource = src;
  const data = new Uint8Array(analyser.fftSize);
  const { mouth, set } = useRafiki.getState();
  set({ pose: "speaking" });

  // Real lip-sync: RMS loudness of the waveform drives the mouth each frame.
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += ((v - 128) / 128) ** 2;
    const rms = Math.sqrt(sum / data.length);
    mouth.value += (Math.min(1, rms * 5) - mouth.value) * 0.5;
    rafId = requestAnimationFrame(tick);
  };
  tick();
  return new Promise<void>((resolve) => {
    src.onended = () => {
      cancelAnimationFrame(rafId);
      if (id === speakId && last) finish();
      resolve();
    };
    src.start();
  });
}

/** Animalese-style babble with a flapping mouth. */
async function speakBabble(text: string, id: number) {
  unlockAudio();
  const { mouth, set } = useRafiki.getState();
  set({ pose: "speaking" });
  await babble(text.slice(0, 200), 1.2, () => {
    if (id === speakId) mouth.value = 0.65 + Math.random() * 0.35;
    setTimeout(() => {
      if (id === speakId) mouth.value = 0.08;
    }, 50);
  });
  if (id === speakId) finish();
}

function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  // Neural "Natural"/"Enhanced"/"Premium" voices sound far less robotic.
  const prefs = [/Ana Online \(Natural\)/, /(Aria|Jenny|Emma|Ava).*(Natural|Online)/, /(Enhanced|Premium)/, /Samantha/, /Google US English/, /Google UK English Female/];
  for (const p of prefs) {
    const v = voices.find((v) => p.test(v.name));
    if (v) return v;
  }
  return voices[0];
}

function speakWebSpeech(text: string, id: number) {
  if (!("speechSynthesis" in window)) return speakBabble(text, id);
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = 1.05;
  u.pitch = 1.35;
  const { mouth, set } = useRafiki.getState();
  let energy = 0;
  u.onboundary = () => (energy = 1);
  const tick = (t: number) => {
    energy *= 0.9;
    const b = 0.35 + 0.35 * Math.abs(Math.sin(t / 70)) * Math.abs(Math.sin(t / 43));
    mouth.value += (Math.max(b, energy) - mouth.value) * 0.35;
    rafId = requestAnimationFrame(tick);
  };
  return new Promise<void>((resolve) => {
    u.onstart = () => {
      set({ pose: "speaking" });
      rafId = requestAnimationFrame(tick);
    };
    u.onend = u.onerror = () => {
      if (id === speakId) finish();
      resolve();
    };
    speechSynthesis.speak(u);
  });
}

function finish() {
  cancelAnimationFrame(rafId);
  const s = useRafiki.getState();
  s.mouth.value = 0;
  if (s.pose === "speaking") s.set({ pose: "idle" });
}

/* ------------------------------------------------------------------------ */
/* Speech-to-text: Web Speech API (Chrome/Edge/Safari)                       */
/* ------------------------------------------------------------------------ */

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: (e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void;
  onend: () => void;
  onerror: (e: { error: string }) => void;
};

export const canListen = () =>
  typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

let rec: Recognition | null = null;

export function listen(onFinal: (text: string) => void) {
  const Ctor = (window as unknown as Record<string, new () => Recognition>).SpeechRecognition ??
    (window as unknown as Record<string, new () => Recognition>).webkitSpeechRecognition;
  if (!Ctor) return;
  stopSpeaking();
  rec?.stop();
  rec = new Ctor();
  rec.lang = navigator.language || "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  const { set } = useRafiki.getState();
  let finalText = "";
  sfx.micOn();
  set({ pose: "listening", interim: "" });
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    set({ interim: (finalText + interim).trim() });
  };
  rec.onerror = () => set({ pose: "idle", interim: "" });
  rec.onend = () => {
    rec = null;
    sfx.micOff();
    const text = finalText.trim() || useRafiki.getState().interim;
    set({ interim: "" });
    if (text) onFinal(text);
    else if (useRafiki.getState().pose === "listening") set({ pose: "idle" });
  };
  rec.start();
}

export function stopListening() {
  rec?.stop();
}

export const isListening = () => rec !== null;
