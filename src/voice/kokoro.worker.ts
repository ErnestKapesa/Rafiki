/// <reference lib="webworker" />
// Kokoro-82M (Apache-2.0) running fully in the browser via ONNX/transformers.js.
// Lives in a worker so speech synthesis never drops a frame of the 3D scene.
import { KokoroTTS } from "kokoro-js";

let tts: KokoroTTS | null = null;
let loading: Promise<KokoroTTS> | null = null;

const progress = (p: { status: string; progress?: number }) => {
  if (p.status === "progress" && typeof p.progress === "number") postMessage({ type: "progress", value: p.progress / 100 });
};

function load() {
  // q8 WASM: ~90 MB, runs everywhere. (WebGPU needs the 320 MB fp32 weights — too heavy for a first visit.)
  loading ??= KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "wasm", progress_callback: progress }).then(
    (t) => (tts = t),
  );
  return loading;
}

self.onmessage = async (e: MessageEvent<{ type: "load" } | { type: "speak"; id: number; text: string; voice: string; speed: number }>) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      await load();
      postMessage({ type: "ready" });
    } else if (msg.type === "speak") {
      const engine = tts ?? (await load());
      const audio = await engine.generate(msg.text, { voice: msg.voice as never, speed: msg.speed });
      const samples = audio.audio as Float32Array;
      postMessage({ type: "audio", id: msg.id, samples, rate: audio.sampling_rate }, { transfer: [samples.buffer] });
    }
  } catch (err) {
    postMessage({ type: "error", id: "id" in msg ? msg.id : -1, message: (err as Error).message });
  }
};
