import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableMultiTabIndexedDbPersistence, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const requiredKeys = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_APP_ID",
] as const;

const missingKeys = requiredKeys.filter((key) => !import.meta.env[key]);

export const firebaseDbInitError =
    missingKeys.length > 0
        ? `Missing Firebase environment variables: ${missingKeys.join(", ")}`
        : null;

let firestoreInstance: Firestore | null = null;

if (!firebaseDbInitError) {
    try {
        const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        firestoreInstance = getFirestore(app);

        // Enable Multi-Tab Persistence for local dev syncing
        enableMultiTabIndexedDbPersistence(firestoreInstance).catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn("Firestore Persistence: Multiple tabs open, persistence can only be enabled in one tab at a time (unless multi-tab is supported).");
            } else if (err.code === 'unimplemented') {
                console.warn("Firestore Persistence: The current browser does not support all of the features required to enable persistence.");
            }
        });
    } catch (error) {
        console.error("Firestore initialization failed:", error);
    }
}

export const db = firestoreInstance;
