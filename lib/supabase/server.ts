import { createClient } from "@supabase/supabase-js";

const fallbackSupabaseUrl = "https://wwfttjsuvkqbopzjrzei.supabase.co";
const fallbackSupabasePublishableKey =
  "sb_publishable_o7MqjD3ICsI30AX0eb-ctQ_WTByV2jo";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fallbackSupabaseUrl;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  fallbackSupabasePublishableKey;

export function createSupabaseServerClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing Supabase connection settings."
    );
  }

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
