import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  UserCredential,
} from 'firebase/auth';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBuj0JQ-EPz-05gbq6VEi9dZu5Pwiq5UZ0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'queueless-bc767.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'queueless-bc767',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'queueless-bc767.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '88703838139',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:88703838139:web:bf073cceebbd085319869e',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-G3B9D2G8H1',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
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
 * Triggers Google Sign-In via popup for both mobile and desktop.
 * signInWithPopup opens a native Google account overlay on mobile without
 * page navigation or third-party cookie/storage-partitioning failure.
 */
export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(auth, provider);
    return await mapCredentialToResult(result);
  } catch (err: any) {
    // If popup was blocked by browser
    if (err?.code === 'auth/popup-blocked') {
      throw new Error('Sign-in popup was blocked by your browser. Please allow popups for this site or use email & password sign-in.');
    }
    if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
      throw new Error('Google sign-in window was closed. Please tap "Continue with Google" to try again.');
    }
    throw err;
  }
}

/**
 * Safely checks if the user returned from a redirect flow, without throwing on mount.
 */
export async function checkRedirectAuthResult(): Promise<GoogleAuthResult | null> {
  if (typeof window === 'undefined') return null;

  // Only attempt getRedirectResult if an actual redirect was flagged in this browser session
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
    // Never allow redirect check errors to crash page mount or show raw errors
    sessionStorage.removeItem('queueless_google_redirect_in_progress');
    console.warn('[QueueLess Auth] Background redirect check warning:', err);
    return null;
  }
}

export async function signOutFromFirebase() {
  try {
    await firebaseSignOut(auth);
  } catch {
    // ignore
  }
}
