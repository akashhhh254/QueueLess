import { initializeApp } from 'firebase/app';
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

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAR-kukfNbGB2ZiB8mO5jExcnwFShrBm3U',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'queue-69233.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'queue-69233',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'queue-69233.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '6519985210',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:6519985210:web:c1589adf316a8ac8f45103',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-3M53ZYET9F',
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

/**
 * Creates a new user in Firebase Authentication with Email & Password.
 */
export async function signUpWithFirebaseEmail(
  name: string,
  email: string,
  pass: string
): Promise<{ idToken: string; email: string; name: string; uid: string }> {
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
    throw new Error(mapFirebaseAuthError(err));
  }
}

/**
 * Triggers official Firebase password reset email.
 */
export async function sendFirebasePasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err: any) {
    throw new Error(mapFirebaseAuthError(err));
  }
}

/**
 * Translates Firebase Auth error codes into helpful user messages.
 */
export function mapFirebaseAuthError(err: any): string {
  const code = err?.code || '';
  const msg = err?.message || '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email address is already registered in Firebase. Please sign in instead.';
    case 'auth/invalid-email':
      return 'The email address format is not valid. Please enter a valid email.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please verify and try again.';
    case 'auth/operation-not-allowed':
      return 'Firebase Email/Password provider is not enabled yet. Please enable it in Firebase Console -> Authentication -> Sign-in method -> Email/Password.';
    case 'auth/too-many-requests':
      return 'Too many failed login attempts. Please wait a few moments or reset your password.';
    case 'auth/network-request-failed':
      return 'Unable to reach Firebase servers. Please check your network connection.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups or use email & password.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in window was closed before completing.';
    default:
      return msg && !msg.includes('[object') ? msg : 'Authentication failed. Please try again.';
  }
}
