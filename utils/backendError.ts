/**
 * Dwello Backend & Supabase Centralized Error Normalization Utility
 * Phase 3 Architecture: Accurately classifies DNS, network, timeout,
 * auth, database (PostgreSQL/PostgREST), authorization (RLS), and configuration errors.
 */

export type ErrorCategory =
  | 'configuration'
  | 'network'
  | 'dns'
  | 'timeout'
  | 'authentication'
  | 'authorization'
  | 'database'
  | 'validation'
  | 'storage'
  | 'unknown';

export interface DwelloBackendError {
  category: ErrorCategory;
  message: string;
  userFacingMessage: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
  originalError?: any;
}

export function normalizeBackendError(error: any): DwelloBackendError {
  if (!error) {
    return {
      category: 'unknown',
      message: 'Unknown error occurred.',
      userFacingMessage: 'An unexpected error occurred. Please try again.',
    };
  }

  const rawMessage = (error.message || error.error_description || String(error)).trim();
  const lowerMsg = rawMessage.toLowerCase();
  const code = error.code || error.error || error.statusText;
  const status = typeof error.status === 'number' ? error.status : undefined;
  const details = error.details || error.hint;

  // 1. DNS Resolution Failure
  if (
    lowerMsg.includes('hostname could not be found') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('eai_again') ||
    lowerMsg.includes('cannot find host') ||
    lowerMsg.includes('knserror') ||
    error.name === 'AuthRetryableFetchError' && lowerMsg.includes('hostname')
  ) {
    return {
      category: 'dns',
      message: rawMessage,
      userFacingMessage: 'Unable to reach the Supabase server hostname. Please check your network DNS or connection.',
      code: code || 'DNS_LOOKUP_FAILED',
      status: status || 0,
      details,
      originalError: error,
    };
  }

  // 2. Request Timeout
  if (
    lowerMsg.includes('operation timed out') ||
    lowerMsg.includes('request timeout') ||
    lowerMsg.includes('aborterror') ||
    lowerMsg.includes('etimedout')
  ) {
    return {
      category: 'timeout',
      message: rawMessage,
      userFacingMessage: 'Request timed out. The server took too long to respond.',
      code: code || 'REQUEST_TIMEOUT',
      status: status || 408,
      details,
      originalError: error,
    };
  }

  // 3. Network / Transport Failures (distinct from DNS)
  if (
    lowerMsg.includes('network request failed') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('connection refused')
  ) {
    return {
      category: 'network',
      message: rawMessage,
      userFacingMessage: 'Network request failed. Please check your internet connection.',
      code: code || 'NETWORK_FAILURE',
      status: status || 0,
      details,
      originalError: error,
    };
  }

  // 4. Configuration Errors
  if (
    lowerMsg.includes('not configured') ||
    lowerMsg.includes('missing supabase') ||
    lowerMsg.includes('placeholder')
  ) {
    return {
      category: 'configuration',
      message: rawMessage,
      userFacingMessage: 'Backend configuration error: Supabase client is not configured correctly.',
      code: code || 'CONFIG_ERROR',
      status: status || 500,
      details,
      originalError: error,
    };
  }

  // 5. Authorization & RLS (Row Level Security) Errors
  if (
    lowerMsg.includes('row-level security') ||
    lowerMsg.includes('rls') ||
    lowerMsg.includes('violates row-level security policy') ||
    code === '42501' ||
    (status === 403 && !lowerMsg.includes('invalid login'))
  ) {
    return {
      category: 'authorization',
      message: rawMessage,
      userFacingMessage: 'Access denied: Permission policy restriction.',
      code: code || 'RLS_POLICY_VIOLATION',
      status: status || 403,
      details,
      originalError: error,
    };
  }

  // 6. Database (PostgreSQL & PostgREST) Errors
  if (
    code?.startsWith('PGRST') ||
    code === '42P01' || // undefined table
    code === '42703' || // undefined column
    code === '23505' || // unique violation
    code === '23503' || // foreign key violation
    code === '23502' || // not null violation
    lowerMsg.includes('could not find the table') ||
    lowerMsg.includes('schema cache')
  ) {
    let userMsg = `Database operation failed (${code || 'DB_ERROR'}).`;
    if (code === 'PGRST205' || code === '42P01' || lowerMsg.includes('could not find the table')) {
      userMsg = 'Database table not found. Schema migration required on Supabase.';
    } else if (code === '23505') {
      userMsg = 'A record with this information already exists.';
    }

    return {
      category: 'database',
      message: rawMessage,
      userFacingMessage: userMsg,
      code: code || 'DATABASE_ERROR',
      status: status || 500,
      details,
      hint: error.hint,
      originalError: error,
    };
  }

  // 7. Authentication Errors
  if (
    lowerMsg.includes('invalid login credentials') ||
    lowerMsg.includes('invalid_grant') ||
    code === 'invalid_credentials'
  ) {
    return {
      category: 'authentication',
      message: rawMessage,
      userFacingMessage: 'Incorrect email or password.',
      code: 'INVALID_CREDENTIALS',
      status: status || 400,
      details,
      originalError: error,
    };
  }

  if (
    lowerMsg.includes('email not confirmed') ||
    code === 'email_not_confirmed'
  ) {
    return {
      category: 'authentication',
      message: rawMessage,
      userFacingMessage: 'Please confirm your email address. Check your inbox for the confirmation link.',
      code: 'EMAIL_NOT_CONFIRMED',
      status: status || 400,
      details,
      originalError: error,
    };
  }

  if (
    lowerMsg.includes('user already registered') ||
    lowerMsg.includes('account with this email already exists') ||
    code === 'user_already_exists'
  ) {
    return {
      category: 'authentication',
      message: rawMessage,
      userFacingMessage: 'An account with this email already exists. Please log in instead.',
      code: 'USER_ALREADY_EXISTS',
      status: status || 400,
      details,
      originalError: error,
    };
  }

  if (
    lowerMsg.includes('password should be') ||
    lowerMsg.includes('weak password') ||
    code === 'weak_password'
  ) {
    return {
      category: 'authentication',
      message: rawMessage,
      userFacingMessage: 'Password must be at least 6 characters long.',
      code: 'WEAK_PASSWORD',
      status: status || 400,
      details,
      originalError: error,
    };
  }

  // 8. Storage Errors
  if (lowerMsg.includes('bucket') || lowerMsg.includes('storage')) {
    return {
      category: 'storage',
      message: rawMessage,
      userFacingMessage: 'Image storage operation failed.',
      code: code || 'STORAGE_ERROR',
      status: status || 500,
      details,
      originalError: error,
    };
  }

  // 9. Fallback Unknown Error
  return {
    category: 'unknown',
    message: rawMessage,
    userFacingMessage: rawMessage || 'An unexpected error occurred. Please try again.',
    code: code || 'UNKNOWN_ERROR',
    status,
    details,
    originalError: error,
  };
}

/**
 * Logs structured diagnostic information while respecting security rules
 * (no passwords, tokens, or secret keys logged).
 */
export function logBackendError(context: string, error: any): DwelloBackendError {
  const normalized = normalizeBackendError(error);
  const log = normalized.category === 'authentication' ? console.warn : console.error;
  log(`[Dwello-Supabase] [${context}]`, {
    category: normalized.category,
    message: normalized.message,
    userFacingMessage: normalized.userFacingMessage,
    code: normalized.code,
    status: normalized.status,
    details: normalized.details,
    hint: normalized.hint,
  });
  return normalized;
}
