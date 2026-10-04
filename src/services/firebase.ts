import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  UserCredential,
} from 'firebase/auth';

/**
 * Universal Firebase Web Configuration for QueueLess.
 * All properties strictly belong to ONE production Firebase project: queue-69233.
 * Reads VITE_* variables in production (e.g. Vercel) during build/runtime.
 * No obsolete or invalid API keys are hardcoded in source.
 */
const rawApiKey = (import.meta.env.VITE_FIREBASE_API_KEY || '').trim();

export const firebaseConfig = {
  apiKey: rawApiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'queue-69233.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'queue-69233',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'queue-69233.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '6519985210',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:6519985210:web:c1589adf316a8ac8f45103',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-3M53ZYET9F',
};

// Safe diagnostics logger for browser and dev server
if (typeof window !== 'undefined') {
  const hasKey = Boolean(firebaseConfig.apiKey && firebaseConfig.apiKey.length > 5);
  const maskedKey = hasKey
    ? `${firebaseConfig.apiKey.slice(0, 6)}...${firebaseConfig.apiKey.slice(-4)}`
    : 'MISSING/EMPTY';

  console.log('[QueueLess Firebase Init]', {
    hasConfig: Boolean(firebaseConfig),
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    apiKeyConfigured: hasKey,
    apiKeyMasked: maskedKey,
    appId: firebaseConfig.appId,
  });

  if (!hasKey) {
    console.warn(
      '[QueueLess Firebase Warning] VITE_FIREBASE_API_KEY is missing or empty. ' +
      'To enable Firebase Authentication on Vercel, navigate to Vercel Project Settings > Environment Variables, ' +
      'add VITE_FIREBASE_API_KEY with your Firebase Web API key, and trigger a redeploy.'
    );
  }
}

// Single active Firebase initialization path
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported && firebaseConfig.measurementId) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {});
}

export interface GoogleAuthResult {
  idToken: string;
  email: string;
  name: string;
  photoUrl: string | null;
  googleId: string;
}

/**
 * Checks whether current client is running inside a mobile browser or viewport.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
}

/**
 * Maps a Firebase UserCredential into our normalized GoogleAuthResult.
 */
async function mapCredentialToResult(credential: UserCredential): Promise<GoogleAuthResult> {
  const idToken = await credential.user.getIdToken();
  const googleCredential = GoogleAuthProvider.credentialFromResult(credential);

  return {
    idToken: idToken || googleCredential?.idToken || '',
    email: (credential.user.email || '').toLowerCase().trim(),
    name: credential.user.displayName || credential.user.email?.split('@')[0] || 'QueueLess User',
    photoUrl: credential.user.photoURL,
    googleId: credential.user.uid,
  };
}

/**
 * Asserts that the Firebase API key is configured before initiating auth network requests.
 */
function assertFirebaseConfigured() {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.length < 5) {
    throw new Error(
      'Firebase API key is not configured. Please add VITE_FIREBASE_API_KEY to your Vercel Project Settings > Environment Variables and redeploy.'
    );
  }
}

/**
 * Triggers Google Sign-In via popup for both mobile and desktop.
 */
export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  assertFirebaseConfigured();

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(auth, provider);
    return await mapCredentialToResult(result);
  } catch (err: any) {
    console.error('Firebase authentication error:', err);
    if (err?.code === 'auth/popup-blocked') {
      throw new Error('Sign-in popup was blocked by your browser. Please allow popups for this site or use email & password sign-in.');
    }
    if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
      throw new Error('Google sign-in window was closed. Please tap "Continue with Google" to try again.');
    }
    throw new Error(mapFirebaseAuthError(err));
  }
}

/**
 * Safely checks if the user returned from a redirect flow, without throwing on mount.
 */
export async function checkRedirectAuthResult(): Promise<GoogleAuthResult | null> {
  if (typeof window === 'undefined') return null;

  const inProgress = sessionStorage.getItem('queueless_google_redirect_in_progress');
  if (inProgress !== '1') {
    return null;
  }

  try {
    sessionStorage.removeItem('queueless_google_redirect_in_progress');
    const result = await getRedirectResult(auth);
    if (!result || !result.user) {
      return null;
    }
    return await mapCredentialToResult(result);
  } catch (err) {
    sessionStorage.removeItem('queueless_google_redirect_in_progress');
    console.warn('[QueueLess Auth] Background redirect check warning:', err);
    return null;
  }
}

export async function signOutFromFirebase() {
  try {
    await firebaseSignOut(auth);
  } catch {
    // Non-fatal
  }
}

/**
 * Creates a new user in Firebase Authentication with Email & Password.
 */
export async function signUpWithFirebaseEmail(
  name: string,
  email: string,
  pass: string
): Promise<{ idToken: string; email: string; name: string; uid: string }> {
  assertFirebaseConfigured();

  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (name.trim()) {
      try {
        await updateProfile(cred.user, { displayName: name.trim() });
      } catch {
        // Non-fatal
      }
    }
    const idToken = await cred.user.getIdToken(true);
    return {
      idToken,
      email: cred.user.email || email,
      name: cred.user.displayName || name,
      uid: cred.user.uid,
    };
  } catch (err: any) {
    console.error('Firebase authentication error:', err);
    throw new Error(mapFirebaseAuthError(err));
  }
}

/**
 * Signs in an existing user with Firebase Authentication Email & Password.
 */
export async function signInWithFirebaseEmail(
  email: string,
  pass: string
): Promise<{ idToken: string; email: string; name: string; uid: string }> {
  assertFirebaseConfigured();

  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    const idToken = await cred.user.getIdToken(true);
    return {
      idToken,
      email: cred.user.email || email,
      name: cred.user.displayName || email.split('@')[0],
      uid: cred.user.uid,
    };
  } catch (err: any) {
    console.error('Firebase authentication error:', err);
    throw new Error(mapFirebaseAuthError(err));
  }
}

/**
 * Triggers official Firebase password reset email.
 */
export async function sendFirebasePasswordReset(email: string): Promise<void> {
  assertFirebaseConfigured();

  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err: any) {
    console.error('Firebase authentication error:', err);
    throw new Error(mapFirebaseAuthError(err));
  }
}

/**
 * Translates Firebase Auth error codes into clear, human-readable user messages.
 * GUARANTEED to NEVER produce "[object Object]" under any condition.
 */
export function mapFirebaseAuthError(err: any): string {
  if (!err) return 'Authentication failed. Please try again.';

  const code = (typeof err?.code === 'string' ? err.code : '').toLowerCase().trim();
  const rawMsg = (typeof err?.message === 'string' ? err.message : '').trim();

  // Handle known Firebase Auth error codes
  switch (code) {
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'The Firebase API key is invalid or not configured. Please ensure VITE_FIREBASE_API_KEY is properly set in your Vercel Project Settings > Environment Variables, and that Google Identity Toolkit API is enabled in your Google Cloud Console.';

    case 'auth/app-not-authorized':
      return 'This application is not authorized to use Firebase Authentication with the current API key. Please check your Google Cloud Console API credentials.';

    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for authentication in Firebase Console. Please add your current domain to Firebase Console > Authentication > Settings > Authorized Domains.';

    case 'auth/email-already-in-use':
      return 'This email address is already registered. Please sign in instead or reset your password.';

    case 'auth/invalid-email':
      return 'The email address format is not valid. Please enter a valid email address.';

    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';

    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-id-token':
      return 'Invalid email or password. Please verify your credentials and try again.';

    case 'auth/operation-not-allowed':
      return 'Email/Password provider is not enabled in Firebase Console. Please enable it in Firebase Console > Authentication > Sign-in method > Email/Password.';

    case 'auth/too-many-requests':
      return 'Too many consecutive attempts. Please wait a few moments or reset your password.';

    case 'auth/network-request-failed':
      return 'Unable to reach Firebase authentication servers. Please check your internet connection and try again.';

    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked by your browser. Please allow popups for this site or use email & password.';

    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in window was closed before completing. Please try again.';

    case 'auth/requires-recent-login':
      return 'This operation is sensitive and requires recent authentication. Please log in again before retrying.';

    case 'auth/user-disabled':
      return 'This user account has been disabled. Please contact system support.';

    default:
      break;
  }

  // If error message contains an auth/ code string
  if (rawMsg) {
    const match = rawMsg.match(/auth\/[a-z0-9-]+/i);
    if (match) {
      const mapped = mapFirebaseAuthError({ code: match[0] });
      if (mapped && !mapped.includes('Authentication failed')) {
        return mapped;
      }
    }

    // Clean standard Firebase wrapper if present
    const cleaned = rawMsg.replace(/^Firebase:\s*Error\s*\((.*?)\)\.?/i, '$1').trim();
    if (cleaned && !cleaned.toLowerCase().includes('[object') && !cleaned.toLowerCase().includes('object object')) {
      return cleaned;
    }
  }

  if (err instanceof Error && err.message && !err.message.includes('[object')) {
    return err.message;
  }

  return 'Authentication could not be completed. Please check your credentials and try again.';
}
