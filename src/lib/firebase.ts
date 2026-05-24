import type { Room } from "./types";
import { normalizeRoom } from "./storage";

type SyncCallback = (room: Room) => void;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

async function getFirebaseServices() {
  if (!isFirebaseConfigured) return null;

  const [{ initializeApp, getApps }, { getDatabase, ref, get, onValue, set }, { getAuth, signInAnonymously }] =
    await Promise.all([import("firebase/app"), import("firebase/database"), import("firebase/auth")]);

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  const db = getDatabase(app);
  return { db, ref, get, onValue, set };
}

export async function subscribeFirebaseRoom(roomId: string, callback: SyncCallback) {
  if (!isFirebaseConfigured) return () => undefined;

  const services = await getFirebaseServices();
  if (!services) return () => undefined;
  const { db, ref, onValue } = services;
  return onValue(ref(db, `rooms/${roomId}`), (snapshot) => {
    const value = snapshot.val() as Room | null;
    if (value) callback(normalizeRoom(value));
  });
}

export async function fetchFirebaseRoom(roomId: string) {
  if (!isFirebaseConfigured) return null;

  const services = await getFirebaseServices();
  if (!services) return null;
  const { db, ref, get } = services;
  const snapshot = await get(ref(db, `rooms/${roomId}`));
  const value = snapshot.val() as Room | null;
  return value ? normalizeRoom(value) : null;
}

export async function saveFirebaseRoom(room: Room) {
  if (!isFirebaseConfigured) return;

  const services = await getFirebaseServices();
  if (!services) return;
  const { db, ref, set } = services;
  await set(ref(db, `rooms/${room.id}`), { ...room, updatedAt: Date.now() });
}
