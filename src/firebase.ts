import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, enableMultiTabIndexedDbPersistence, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

const missingKeys = requiredKeys.filter((key) => !import.meta.env[key]);

export const firebaseInitError =
  missingKeys.length > 0
    ? `Missing Firebase environment variables: ${missingKeys.join(", ")}`
    : null;

let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

if (!firebaseInitError) {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);

    // Enable Multi-Tab Persistence for local dev syncing
    enableMultiTabIndexedDbPersistence(dbInstance).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn("Firestore Persistence: Multiple tabs open, persistence can only be enabled in one tab at a time.");
        } else if (err.code === 'unimplemented') {
            console.warn("Firestore Persistence: The current browser does not support all of the features required to enable persistence.");
        }
    });

    // Register simple notification Service Worker (Android compatible)
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('✅ Notification Service Worker registered with scope:', registration.scope);
          swRegistration = registration;
        })
        .catch((err) => {
          console.error('❌ Service Worker registration failed:', err);
        });
    }
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

export const auth = authInstance;
export const db = dbInstance;
export { swRegistration };
