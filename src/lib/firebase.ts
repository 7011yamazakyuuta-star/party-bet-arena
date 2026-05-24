import type { Room } from "./types";

type SyncCallback = (room: Room) => void;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

export async function subscribeFirebaseRoom(roomId: string, callback: SyncCallback) {
  if (!isFirebaseConfigured) return () => undefined;

  const [{ initializeApp, getApps }, { getDatabase, onValue, ref }, { getAuth, signInAnonymously }] =
    await Promise.all([import("firebase/app"), import("firebase/database"), import("firebase/auth")]);

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  const db = getDatabase(app);
  return onValue(ref(db, `rooms/${roomId}`), (snapshot) => {
    const value = snapshot.val() as Room | null;
    if (value) callback(value);
  });
}

export async function saveFirebaseRoom(room: Room) {
  if (!isFirebaseConfigured) return;

  const [{ initializeApp, getApps }, { getDatabase, ref, set }] = await Promise.all([
    import("firebase/app"),
    import("firebase/database"),
  ]);

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const db = getDatabase(app);
  await set(ref(db, `rooms/${room.id}`), { ...room, updatedAt: Date.now() });
}
