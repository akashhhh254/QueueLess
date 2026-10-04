/**
 * Universal error message extraction utility for QueueLess.
 * Extracts clean, human-readable strings from errors, objects, Firebase Auth codes,
 * API responses, and Axios/Fetch error shapes.
 * Guaranteed to NEVER return "[object Object]".
 */

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

export function getErrorMessage(
  error: unknown,
  fallback = 'Registration could not be completed. Please try again.'
): string {
  if (error === null || error === undefined) {
    return fallback;
  }

  // 1. If it's a string
  if (typeof error === 'string') {
    const trimmed = error.trim();
    if (!trimmed || trimmed === '[object Object]' || trimmed.toLowerCase() === 'object object') {
      return fallback;
    }

    // Check for embedded Firebase auth codes (e.g. "Firebase: Error (auth/popup-blocked).")
    if (trimmed.includes('auth/')) {
      const match = trimmed.match(/auth\/[a-z0-9-]+/i);
      if (match) {
        const mapped = mapAuthErrorCode(match[0]);
        if (mapped) return mapped;
      }
    }

    // Clean up "Firebase: Error (...) " wrapper prefix if present
    const cleaned = trimmed.replace(/^Firebase:\s*Error\s*\((.*?)\)\.?/i, '$1').trim();
    return cleaned || fallback;
  }

  // 2. If it's an object / Error instance
  if (typeof error === 'object') {
    const errObj = error as Record<string, any>;

    // Priority 1: Direct error code mapping (FirebaseError)
    if (typeof errObj.code === 'string') {
      const mapped = mapAuthErrorCode(errObj.code);
      if (mapped) return mapped;
    }

    // Priority 2: Nested response data (API / Express / Fetch JSON responses)
    if (errObj.response?.data) {
      const msg = getErrorMessage(errObj.response.data, '');
      if (msg && msg !== fallback) return msg;
    }

    if (errObj.data) {
      const msg = getErrorMessage(errObj.data, '');
      if (msg && msg !== fallback) return msg;
    }

    // Priority 3: err.message
    if (errObj.message) {
      if (typeof errObj.message === 'string') {
        const trimmed = errObj.message.trim();
        if (trimmed && trimmed !== '[object Object]' && trimmed.toLowerCase() !== 'object object') {
          if (trimmed.includes('auth/')) {
            const match = trimmed.match(/auth\/[a-z0-9-]+/i);
            if (match) {
              const mapped = mapAuthErrorCode(match[0]);
              if (mapped) return mapped;
            }
          }
          return trimmed.replace(/^Firebase:\s*Error\s*\((.*?)\)\.?/i, '$1').trim();
        }
      } else if (typeof errObj.message === 'object') {
        const msg = getErrorMessage(errObj.message, '');
        if (msg && msg !== fallback) return msg;
      }
    }

    // Priority 4: err.error
    if (errObj.error) {
      if (typeof errObj.error === 'string') {
        const trimmed = errObj.error.trim();
        if (trimmed && trimmed !== '[object Object]' && trimmed.toLowerCase() !== 'object object') {
          return trimmed;
        }
      } else if (typeof errObj.error === 'object') {
        const msg = getErrorMessage(errObj.error, '');
        if (msg && msg !== fallback) return msg;
      }
    }

    // Priority 5: err.statusText
    if (typeof errObj.statusText === 'string' && errObj.statusText.trim()) {
      return errObj.statusText.trim();
    }
  }

  return fallback;
}
