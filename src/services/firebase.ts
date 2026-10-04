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
 * Triggers Google Sign-In with full cross-platform mobile compatibility.
 * On mobile devices where popups are blocked or restricted, seamlessly falls back
 * to redirect-based authentication.
 */
export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  // On touch / mobile devices, popups are frequently blocked or open off-screen.
  // We attempt signInWithPopup first; if blocked or rejected by mobile policy,
  // we initiate signInWithRedirect.
  try {
    const result = await signInWithPopup(auth, provider);
    return await mapCredentialToResult(result);
  } catch (err: any) {
    // If domain is not authorized in Firebase Console, redirect will also fail with unauthorized-domain
    if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
      throw err;
    }

    const isBlocked =
      err?.code === 'auth/popup-blocked' ||
      err?.code === 'auth/operation-not-supported-in-this-environment' ||
      err?.message?.toLowerCase().includes('popup') ||
      isMobileDevice();

    if (isBlocked && typeof window !== 'undefined') {
      try {
        // Remember redirect intent so user can be automatically onboarded upon return
        sessionStorage.setItem('queueless_google_redirect_in_progress', '1');
        await signInWithRedirect(auth, provider);
        // Return a pending promise while browser navigates
        return new Promise(() => {});
      } catch (redirectErr) {
        sessionStorage.removeItem('queueless_google_redirect_in_progress');
        throw redirectErr;
      }
    }

    throw err;
  }
}

/**
 * Checks if the user just returned from a Google OAuth redirect flow on mobile.
 */
export async function checkRedirectAuthResult(): Promise<GoogleAuthResult | null> {
  try {
    const result = await getRedirectResult(auth);
    sessionStorage.removeItem('queueless_google_redirect_in_progress');
    if (!result || !result.user) {
      return null;
    }
    return await mapCredentialToResult(result);
  } catch (err) {
    sessionStorage.removeItem('queueless_google_redirect_in_progress');
    throw err;
  }
}

export async function signOutFromFirebase() {
  try {
    await firebaseSignOut(auth);
  } catch {
    // ignore
  }
}
