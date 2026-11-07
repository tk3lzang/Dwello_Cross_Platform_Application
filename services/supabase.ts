/**
 * Supabase Client Initialization Service
 
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

console.log('[Dwello-Auth Debug]: Initializing Supabase client with URL:', SUPABASE_URL);

/**
 * Checks if the configured Supabase client has a valid, reachable production URL.
 * Guard against demo placeholders like "your-project" or "dwello-bhutan"
 */
export const isSupabaseConfigured = (): boolean => {
  return (
    !!SUPABASE_URL &&
    !SUPABASE_URL.includes('your-project') &&
    !SUPABASE_URL.includes('dwello-bhutan.supabase.co') &&
    !!SUPABASE_ANON_KEY &&
    !SUPABASE_ANON_KEY.includes('your-anon-key') &&
    !SUPABASE_ANON_KEY.includes('dwello-demo')
  );
};

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

console.log('[Dwello-DB Debug]: Supabase client configured. Live remote database active:', isSupabaseConfigured());
