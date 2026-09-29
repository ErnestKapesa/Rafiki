import OpenAI from "openai";

/**
 * Nebius Token Factory speaks the OpenAI Chat Completions protocol, so the
 * official `openai` SDK works as-is — we only swap the base URL and key.
 */
export const nebius = new OpenAI({
  baseURL: process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.us-central1.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY || "missing",
});

export type Tier = "fast" | "smart" | "deep";

const wanted: Record<Tier, { env: string; fallback: string; hint: RegExp }> = {
  fast: { env: "MODEL_FAST", fallback: "nvidia/nvidia-nemotron-3-nano-30b-a3b", hint: /nemotron.*(nano|lightning)/i },
  smart: { env: "MODEL_SMART", fallback: "nvidia/nemotron-3-super-120b-a12b", hint: /nemotron.*super/i },
  deep: { env: "MODEL_DEEP", fallback: "nvidia/Nemotron-3-Ultra-550b-a55b", hint: /nemotron.*ultra/i },
};

export const models: Record<Tier, string> = {
  fast: process.env.MODEL_FAST || wanted.fast.fallback,
  smart: process.env.MODEL_SMART || wanted.smart.fallback,
  deep: process.env.MODEL_DEEP || wanted.deep.fallback,
};

/**
 * Model ids on Token Factory occasionally change case or version suffix.
 * At boot we list the catalog and, if a configured id is missing, pick the
 * closest Nemotron of the same tier so the demo never dies on a typo.
 */
export async function resolveModels(log = console.log) {
  if (!process.env.NEBIUS_API_KEY) return models;
  try {
    const ids: string[] = [];
    for await (const m of nebius.models.list()) ids.push(m.id);
    const lower = new Map(ids.map((id) => [id.toLowerCase(), id]));
    for (const tier of Object.keys(wanted) as Tier[]) {
      const exact = lower.get(models[tier].toLowerCase());
      if (exact) {
        models[tier] = exact;
        continue;
      }
      const candidates = ids.filter((id) => wanted[tier].hint.test(id)).sort().reverse();
      const pick = candidates[0] ?? ids.find((id) => /nemotron/i.test(id));
      if (pick) {
        log(`[nebius] ${tier}: "${models[tier]}" not in catalog → using "${pick}"`);
        models[tier] = pick;
      }
    }
  } catch (err) {
    log(`[nebius] could not list models (${(err as Error).message}); using configured ids`);
  }
  return models;
}

/** Nemotron reasoning models may inline their chain of thought in <think> tags. */
export function splitThink(text: string) {
  const m = text.match(/<think>([\s\S]*?)(<\/think>|$)/);
  if (!m) return { think: "", body: text };
  return { think: m[1].trim(), body: text.replace(m[0], "").trim() };
}

/** Pull the first JSON object out of a model response (tolerates fences / prose). */
export function parseJson<T>(text: string): T | null {
  const { body } = splitThink(text);
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
