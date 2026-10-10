import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const env = import.meta.env;
const config = {
  apiKey: env["VITE_FIREBASE_API_KEY"] as string | undefined,
  authDomain: (env["VITE_FIREBASE_AUTH_DOMAIN"] as string | undefined) ?? "funtok-chat.firebaseapp.com",
  projectId: (env["VITE_FIREBASE_PROJECT_ID"] as string | undefined) ?? "funtok-chat",
  storageBucket: (env["VITE_FIREBASE_STORAGE_BUCKET"] as string | undefined) ?? "funtok-chat.appspot.com",
  messagingSenderId: (env["VITE_FIREBASE_MESSAGING_SENDER_ID"] as string | undefined) ?? "1076702802472",
  appId: (env["VITE_FIREBASE_APP_ID"] as string | undefined) ?? "1:1076702802472:web:6cdc7eb352070e4e28fb1d",
};

export const firebaseReady = Boolean(config.apiKey);

let app: FirebaseApp | undefined;
let firestore: Firestore | undefined;

export function db(): Firestore {
  if (!firebaseReady) throw new Error("Chat is not connected yet.");
  if (!firestore) {
    app = getApps()[0] ?? initializeApp({ ...config, apiKey: config.apiKey ?? "" });
    firestore = getFirestore(app);
  }
  return firestore;
}
