import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
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

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
