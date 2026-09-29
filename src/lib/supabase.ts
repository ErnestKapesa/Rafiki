import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null when Supabase isn't configured — the game then runs fully local. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

/** Anonymous sign-in on first visit so progress syncs without a signup wall. */
export async function ensureSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: signed, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return signed.session;
}

/** Attach an email to the anonymous account (magic link) so progress survives devices. */
export async function saveProgressWithEmail(email: string) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
}
