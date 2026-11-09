/**
 * Shared Supabase client with persistent auth sessions and connectivity diagnostics.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logBackendError, DwelloBackendError } from '@/utils/backendError';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseConfigured = (): boolean => {
  return (
    !!SUPABASE_URL &&
    !SUPABASE_URL.includes('your-project') &&
    !!SUPABASE_PUBLISHABLE_KEY &&
    !SUPABASE_PUBLISHABLE_KEY.includes('your-anon-key')
  );
};

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_PUBLISHABLE_KEY || 'not-configured',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

console.log('[Dwello-Supabase]: Initialized single client for DWELLO-BHUTAN at:', SUPABASE_URL);

/**
 * Diagnostic helper to independently verify Supabase Auth & PostgREST endpoints
 */
export async function testSupabaseConnectivity(): Promise<{
  ok: boolean;
  dnsOk: boolean;
  authOk: boolean;
  dataApiOk: boolean;
  error?: DwelloBackendError;
}> {
  let dnsOk = false;
  let authOk = false;
  let dataApiOk = false;

  try {
    const healthUrl = `${SUPABASE_URL}/auth/v1/health`;
    const response = await fetch(healthUrl, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    });
    dnsOk = true;
    if (response.ok) {
      authOk = true;
    }
  } catch (err: any) {
    const logged = logBackendError('testSupabaseConnectivity:Auth', err);
    return { ok: false, dnsOk, authOk, dataApiOk, error: logged };
  }

  try {
    const restRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
    });
    if (restRes.status === 200 || restRes.status === 404) {
      dataApiOk = true;
    }
  } catch (restErr: any) {
    logBackendError('testSupabaseConnectivity:Rest', restErr);
  }

  const ok = dnsOk && authOk;
  console.log('[Dwello-Supabase]: Connectivity probe results:', { ok, dnsOk, authOk, dataApiOk });
  return { ok, dnsOk, authOk, dataApiOk };
}
