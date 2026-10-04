/**
 * Universal error normalization utility for QueueLess.
 * Normalizes all error types (Error instances, Firebase Auth errors, API error envelopes,
 * HTTP status codes, nested JSON, and string errors) into a standard, safe contract:
 * {
 *   message: string,
 *   code?: string,
 *   status?: number
 * }
 * GUARANTEED to NEVER produce "[object Object]" or any variant under any circumstances.
 */

export interface NormalizedAppError {
  message: string;
  code?: string;
  status?: number;
}

/**
 * Robust detection of any string that looks like a coerced JavaScript object
 * e.g. "[object Object]", "[object object]", "object object", "[object DOMException]", etc.
 */
export function isObjectLikeString(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const s = val.trim().toLowerCase();
  return (
    !s ||
    s === '[object object]' ||
    s === 'object object' ||
    s.includes('[object') ||
    s.includes('object]') ||
    s.includes('object object') ||
    /^\[object\s+.*\]$/i.test(val.trim())
  );
}

export function mapAuthErrorCode(code: string): string | null {
  const normalized = code.toLowerCase().trim();
  switch (normalized) {
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'The Firebase API key is invalid or not configured. Please ensure VITE_FIREBASE_API_KEY is properly configured in your Vercel Project Settings > Environment Variables.';
    case 'auth/app-not-authorized':
      return 'This application is not authorized to use Firebase Authentication with the provided API key. Please check your Firebase project credentials.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Console for authentication. Please whitelist this domain in Firebase Console > Authentication > Settings > Authorized Domains.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup window. Please allow popups for this site, or tap "Continue with Google" again to redirect.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in window was closed before completing. Please tap "Continue with Google" to try again.';
    case 'auth/network-request-failed':
      return 'A network error occurred while connecting to Google. Please check your internet connection and try again.';
    case 'auth/operation-not-supported-in-this-environment':
    case 'auth/web-storage-unsupported':
      return 'Third-party cookies or web storage are restricted by your browser. Please enable cookies or sign in using email and password.';
    case 'auth/user-disabled':
      return 'This user account has been disabled. Please contact system support.';
    case 'auth/invalid-credential':
    case 'auth/invalid-id-token':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address. Please sign in or reset your password.';
    case 'auth/invalid-email':
      return 'The email address format is not valid. Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email address. Please sign in using your existing password or preferred method.';
    case 'auth/operation-not-allowed':
      return 'Authentication provider is not enabled in Firebase Console. Please enable Email/Password or Google provider in Firebase Console > Authentication > Sign-in method.';
    case 'auth/too-many-requests':
      return 'Too many consecutive attempts. Please wait a moment and try again.';
    case 'auth/configuration-not-found':
      return 'Authentication configuration was not found. Please verify Firebase project settings.';
    case 'auth/internal-error':
      return 'An internal authentication error occurred. Please refresh the page and try again.';
    default:
      return null;
  }
}

export function normalizeError(
  error: unknown,
  fallback = 'Registration could not be completed. Please try again.'
): NormalizedAppError {
  if (error === null || error === undefined) {
    return { message: fallback };
  }

  // 1. Primitive string error
  if (typeof error === 'string') {
    if (isObjectLikeString(error)) {
      return { message: fallback };
    }

    const trimmed = error.trim();
    if (trimmed.includes('auth/')) {
      const match = trimmed.match(/auth\/[a-z0-9-]+/i);
      if (match) {
        const mapped = mapAuthErrorCode(match[0]);
        if (mapped) return { message: mapped, code: match[0] };
      }
    }

    const cleaned = trimmed.replace(/^Firebase:\s*Error\s*\((.*?)\)\.?/i, '$1').trim();
    return { message: isObjectLikeString(cleaned) ? fallback : (cleaned || fallback) };
  }

  // 2. Error object or API envelope
  if (typeof error === 'object') {
    const errObj = error as Record<string, any>;
    let code: string | undefined = typeof errObj.code === 'string' ? errObj.code : undefined;
    let status: number | undefined = typeof errObj.status === 'number' ? errObj.status : undefined;

    // Check Firebase / API error code first
    if (code) {
      const mapped = mapAuthErrorCode(code);
      if (mapped) {
        return { message: mapped, code, status };
      }
    }

    // Check standardized backend response format: { success: false, error: { code, message } }
    if (errObj.error && typeof errObj.error === 'object') {
      const subError = errObj.error;
      const subCode = typeof subError.code === 'string' ? subError.code : code;
      const subMsg = typeof subError.message === 'string' ? subError.message.trim() : '';
      if (subMsg && !isObjectLikeString(subMsg)) {
        return {
          message: subMsg,
          code: subCode,
          status,
        };
      }
    }

    // Check Axios/Fetch response wrappers (e.g. error.response.data)
    if (errObj.response?.data) {
      const normalizedSub = normalizeError(errObj.response.data, fallback);
      if (normalizedSub.message !== fallback && !isObjectLikeString(normalizedSub.message)) {
        return {
          ...normalizedSub,
          status: status || (typeof errObj.response.status === 'number' ? errObj.response.status : undefined),
        };
      }
    }

    if (errObj.data) {
      const normalizedSub = normalizeError(errObj.data, fallback);
      if (normalizedSub.message !== fallback && !isObjectLikeString(normalizedSub.message)) {
        return normalizedSub;
      }
    }

    // Check err.message
    if (errObj.message) {
      if (typeof errObj.message === 'string') {
        const trimmed = errObj.message.trim();
        if (trimmed && !isObjectLikeString(trimmed)) {
          if (trimmed.includes('auth/')) {
            const match = trimmed.match(/auth\/[a-z0-9-]+/i);
            if (match) {
              const mapped = mapAuthErrorCode(match[0]);
              if (mapped) return { message: mapped, code: match[0], status };
            }
          }
          const cleaned = trimmed.replace(/^Firebase:\s*Error\s*\((.*?)\)\.?/i, '$1').trim();
          if (!isObjectLikeString(cleaned)) {
            return { message: cleaned || fallback, code, status };
          }
        }
      } else if (typeof errObj.message === 'object') {
        const normalizedSub = normalizeError(errObj.message, fallback);
        if (normalizedSub.message !== fallback && !isObjectLikeString(normalizedSub.message)) {
          return normalizedSub;
        }
      }
    }

    // Check err.error when it's a string
    if (typeof errObj.error === 'string') {
      const trimmed = errObj.error.trim();
      if (trimmed && !isObjectLikeString(trimmed)) {
        return { message: trimmed, code, status };
      }
    }

    // Check err.statusText
    if (typeof errObj.statusText === 'string' && errObj.statusText.trim()) {
      const st = errObj.statusText.trim();
      if (!isObjectLikeString(st)) {
        return { message: st, code, status };
      }
    }
  }

  return { message: fallback };
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Authentication could not be completed. Please try again.'
): string {
  const result = normalizeError(error, fallback).message;
  return isObjectLikeString(result) ? fallback : result;
}

export function extractSafeAuthMessage(
  error: unknown,
  fallback = 'Authentication could not be completed. Please try again.'
): string {
  console.error('Firebase authentication error:', error);

  const errObj = typeof error === 'object' && error !== null ? (error as Record<string, any>) : null;
  const code = typeof errObj?.code === 'string' ? errObj.code : '';
  const rawMsg = typeof errObj?.message === 'string' ? errObj.message : '';

  if (code) {
    const mapped = mapAuthErrorCode(code);
    if (mapped) return mapped;
  }

  if (rawMsg && !isObjectLikeString(rawMsg)) {
    const match = rawMsg.match(/auth\/[a-z0-9-]+/i);
    if (match) {
      const mapped = mapAuthErrorCode(match[0]);
      if (mapped) return mapped;
    }
    const cleaned = rawMsg.replace(/^Firebase:\s*Error\s*\((.*?)\)\.?/i, '$1').trim();
    if (cleaned && !isObjectLikeString(cleaned)) {
      return cleaned;
    }
  }

  if (error instanceof Error && error.message && !isObjectLikeString(error.message)) {
    return error.message;
  }

  if (typeof error === 'string' && !isObjectLikeString(error)) {
    return error;
  }

  return fallback;
}

