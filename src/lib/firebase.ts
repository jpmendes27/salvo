import { initializeApp, getApps } from "firebase/app";
import { getStorage } from "firebase/storage";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  getAuth,
  type Auth
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const e = (v: string | undefined, fallback: string) => (v || fallback).trim();

const firebaseConfig = {
  apiKey: e(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, "demo-api-key"),
  authDomain: e(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, "demo.firebaseapp.com"),
  projectId: e(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "demo"),
  storageBucket: e(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, "demo.appspot.com"),
  messagingSenderId: e(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, "000000000000"),
  appId: e(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, "1:000000000000:web:demo")
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// IndexedDB persistence avoids Chrome Privacy Sandbox storage partitioning
// that breaks signInWithPopup flows on mobile (sessionStorage is cleared
// during cross-site navigations in the OAuth popup).
// popupRedirectResolver is intentionally NOT set here — passing it globally
// causes Firebase to call resolver._initialize() on every auth init, which
// reads stale redirect state from IndexedDB and delays auth resolution.
// We pass it explicitly to signInWithPopup/getRedirectResult instead.
// getAuth() is used during Next.js SSR/build (Node.js, no indexedDB).
export const auth: Auth = typeof window !== "undefined"
  ? initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    })
  : getAuth(app);

export { app };
export const db = getFirestore(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
