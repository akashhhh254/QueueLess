import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyBuj0JQ-EPz-05gbq6VEi9dZu5Pwiq5UZ0",
  authDomain: "queueless-bc767.firebaseapp.com",
  projectId: "queueless-bc767",
  storageBucket: "queueless-bc767.firebasestorage.app",
  messagingSenderId: "88703838139",
  appId: "1:88703838139:web:bf073cceebbd085319869e",
  measurementId: "G-G3B9D2G8H1"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export async function signInWithGoogle(): Promise<{
  idToken: string;
  email: string;
  name: string;
  photoUrl: string | null;
  googleId: string;
}> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  const googleCredential = GoogleAuthProvider.credentialFromResult(result);

  return {
    idToken: googleCredential?.idToken || idToken,
    email: result.user.email || '',
    name: result.user.displayName || result.user.email?.split('@')[0] || 'User',
    photoUrl: result.user.photoURL,
    googleId: result.user.uid,
  };
}

export async function signOutFromFirebase() {
  await firebaseSignOut(auth);
}
