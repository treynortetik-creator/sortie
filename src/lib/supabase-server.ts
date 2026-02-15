import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Create a server-side Supabase client authenticated with the user's token.
 * Used in API routes where we need to respect RLS policies.
 */
export function createServerClient(token: string): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/**
 * Read a single app setting by key. Returns null if not found or not configured.
 * Requires a valid auth token (RLS enforced).
 */
export async function getAppSetting(key: string, token: string): Promise<string | null> {
  const client = createServerClient(token);
  if (!client) return null;

  const { data, error } = await client
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error || !data) return null;
  return data.value;
}
