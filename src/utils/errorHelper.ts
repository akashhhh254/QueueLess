/**
 * Universal error normalization utility for QueueLess.
 * Normalizes all error types (Error instances, Firebase Auth errors, API error envelopes,
 * HTTP status codes, nested JSON, and string errors) into a standard, safe contract:
 * {
 *   message: string,
 *   code?: string,
 *   status?: number
 * }
 * GUARANTEED to never produce "[object Object]".
 */

export interface NormalizedAppError {
  message: string;
  code?: string;
  status?: number;
}

export function mapAuthErrorCode(code: string): string | null {
  const normalized = code.toLowerCase().trim();
  switch (normalized) {
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup window. Please allow popups for this site, or tap "Continue with Google" again to redirect.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in window was closed before completing. Please tap "Continue with Google" to try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Console for Google authentication. Please whitelist this domain in Firebase settings.';
    case 'auth/network-request-failed':
      return 'A network error occurred while connecting to Google. Please check your internet connection and try again.';
    case 'auth/user-disabled':
      return 'This user account has been disabled. Please contact system support.';
    case 'auth/invalid-credential':
    case 'auth/invalid-id-token':
      return 'Your Google authentication credentials could not be verified. Please sign in again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email address. Please sign in using your existing password or preferred method.';
    case 'auth/operation-not-allowed':
      return 'Google Sign-In is not currently enabled for this project. Please enable Google provider in the Firebase Console.';
    case 'auth/too-many-requests':
      return 'Too many consecutive attempts. Please wait a moment and try again.';
    case 'auth/configuration-not-found':
      return 'Google authentication configuration was not found. Please verify Firebase project settings.';
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
    const trimmed = error.trim();
    if (!trimmed || trimmed === '[object Object]' || trimmed.toLowerCase() === 'object object') {
      return { message: fallback };
    }

    if (trimmed.includes('auth/')) {
      const match = trimmed.match(/auth\/[a-z0-9-]+/i);
      if (match) {
        const mapped = mapAuthErrorCode(match[0]);
        if (mapped) return { message: mapped, code: match[0] };
      }
    }

    const cleaned = trimmed.replace(/^Firebase:\s*Error\s*\((.*?)\)\.?/i, '$1').trim();
    return { message: cleaned || fallback };
  }

  // 2. Error object or API envelope
  if (typeof error === 'object') {
    const errObj = error as Record<string, any>;
    let code: string | undefined = typeof errObj.code === 'string' ? errObj.code : undefined;
    let status: number | undefined = typeof errObj.status === 'number' ? errObj.status : undefined;

    // Check code mapping
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
      if (subMsg && subMsg !== '[object Object]') {
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
      if (normalizedSub.message !== fallback) {
        return {
          ...normalizedSub,
          status: status || (typeof errObj.response.status === 'number' ? errObj.response.status : undefined),
        };
      }
    }

    if (errObj.data) {
      const normalizedSub = normalizeError(errObj.data, fallback);
      if (normalizedSub.message !== fallback) {
        return normalizedSub;
      }
    }

    // Check err.message
    if (errObj.message) {
      if (typeof errObj.message === 'string') {
        const trimmed = errObj.message.trim();
        if (trimmed && trimmed !== '[object Object]' && trimmed.toLowerCase() !== 'object object') {
          if (trimmed.includes('auth/')) {
            const match = trimmed.match(/auth\/[a-z0-9-]+/i);
            if (match) {
              const mapped = mapAuthErrorCode(match[0]);
              if (mapped) return { message: mapped, code: match[0], status };
            }
          }
          const cleaned = trimmed.replace(/^Firebase:\s*Error\s*\((.*?)\)\.?/i, '$1').trim();
          return { message: cleaned || fallback, code, status };
        }
      } else if (typeof errObj.message === 'object') {
        const normalizedSub = normalizeError(errObj.message, fallback);
        if (normalizedSub.message !== fallback) return normalizedSub;
      }
    }

    // Check err.error when it's a string
    if (typeof errObj.error === 'string') {
      const trimmed = errObj.error.trim();
      if (trimmed && trimmed !== '[object Object]' && trimmed.toLowerCase() !== 'object object') {
        return { message: trimmed, code, status };
      }
    }

    // Check err.statusText
    if (typeof errObj.statusText === 'string' && errObj.statusText.trim()) {
      return { message: errObj.statusText.trim(), code, status };
    }
  }

  return { message: fallback };
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Registration could not be completed. Please try again.'
): string {
  return normalizeError(error, fallback).message;
}
