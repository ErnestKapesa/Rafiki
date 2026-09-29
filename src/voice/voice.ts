import { babble, sfx } from "../audio/sfx";
import { useRafiki } from "../lib/store";

/* ------------------------------------------------------------------------ */
/* Text-to-speech: Kokoro (open-source, in-browser) with Web Speech fallback */
/* ------------------------------------------------------------------------ */

let worker: Worker | null = null;
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
    else if (m.type === "ready") useRafiki.getState().set({ hdVoiceProgress: null });
    else if (m.type === "audio") pending.get(m.id)?.({ samples: m.samples, rate: m.rate });
    else if (m.type === "error") {
      pending.get(m.id)?.(null);
      console.warn("[kokoro]", m.message);
    }
  };
  return worker;
}

export function enableHdVoice() {
  useRafiki.getState().set({ voiceMode: "hd", hdVoiceProgress: 0 });
  getWorker().postMessage({ type: "load" });
}

export function stopSpeaking() {
  speakId++;
  currentSource?.stop();
  currentSource = null;
  speechSynthesis?.cancel();
  cancelAnimationFrame(rafId);
  useRafiki.getState().mouth.value = 0;
}

export async function speak(text: string) {
  const s = useRafiki.getState();
  if (s.voiceMode === "off" || !text) return;
  stopSpeaking();
  const id = speakId;
  const clean = text.replace(/\[(\d+)\]/g, "").replace(/[*_#`]/g, "");

  if (s.voiceMode === "babble") return speakBabble(clean, id);
  if (s.voiceMode === "hd" && s.hdVoiceProgress === null) {
    const result = await new Promise<{ samples: Float32Array; rate: number } | null>((resolve) => {
      pending.set(id, resolve);
      getWorker().postMessage({ type: "speak", id, text: clean, voice: "af_heart" });
    });
    pending.delete(id);
    if (id !== speakId) return;
    if (result) return playSamples(result.samples, result.rate, id);
  }
  return speakWebSpeech(clean, id);
}

function playSamples(samples: Float32Array, rate: number, id: number) {
  audioCtx ??= new AudioContext();
  const buffer = audioCtx.createBuffer(1, samples.length, rate);
  buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  src.connect(analyser).connect(audioCtx.destination);
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
      if (id === speakId) finish();
      resolve();
    };
    src.start();
  });
}

/** Animal-Crossing-style gibberish with a flapping mouth. */
async function speakBabble(text: string, id: number) {
  const { mouth, set } = useRafiki.getState();
  set({ pose: "speaking" });
  await babble(text.slice(0, 220), 1.15, () => {
    if (id === speakId) mouth.value = 0.7 + Math.random() * 0.3;
    setTimeout(() => {
      if (id === speakId) mouth.value = 0.1;
    }, 45);
  });
  if (id === speakId) finish();
}

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  const prefs = [/Samantha/, /Google UK English Female/, /Microsoft (Aria|Jenny)/, /Google US English/, /en-GB/, /en-US/];
  for (const p of prefs) {
    const v = voices.find((v) => p.test(v.name) || p.test(v.lang));
    if (v) return v;
  }
  return voices.find((v) => v.lang.startsWith("en"));
}

function speakWebSpeech(text: string, id: number) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = 1.04;
  u.pitch = 1.25; // a little higher — Rafiki is small
  const { mouth, set } = useRafiki.getState();
  let energy = 0;
  u.onboundary = () => (energy = 1); // each word gives the mouth a kick
  // Web Speech gives no audio stream, so we synthesise plausible jaw motion.
  const tick = (t: number) => {
    energy *= 0.9;
    const babble = 0.35 + 0.35 * Math.abs(Math.sin(t / 70)) * Math.abs(Math.sin(t / 43));
    mouth.value += (Math.max(babble, energy) - mouth.value) * 0.35;
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
