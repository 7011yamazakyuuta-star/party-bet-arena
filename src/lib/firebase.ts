import type { Bet, Player, Room } from "./types";
import { normalizeRoom } from "./storage";

type SyncCallback = (room: Room) => void;
type FirebaseRoomPayload = Omit<Room, "players" | "contestants" | "currentRace"> & {
  players: Record<string, Player>;
  contestants: Record<string, Room["contestants"][number]>;
  currentRace: Omit<Room["currentRace"], "bets"> & {
    bets: Record<string, Bet>;
  };
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

export type FirebaseIssueKind =
  | "anonymous-auth"
  | "permission"
  | "database-url"
  | "network"
  | "unknown";

export function getFirebaseIssueKind(error: unknown): FirebaseIssueKind {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  const detail = `${code} ${message}`.toLowerCase();

  if (detail.includes("auth/operation-not-allowed") || detail.includes("anonymous")) return "anonymous-auth";
  if (detail.includes("permission_denied") || detail.includes("permission-denied")) return "permission";
  if (detail.includes("database_url") || detail.includes("databaseurl") || detail.includes("invalid-url")) {
    return "database-url";
  }
  if (detail.includes("network") || detail.includes("failed to fetch") || detail.includes("offline")) return "network";
  return "unknown";
}

async function getFirebaseServices() {
  if (!isFirebaseConfigured) return null;

  const [{ initializeApp, getApps }, { getDatabase, ref, get, onValue, set, remove }, { getAuth, signInAnonymously }] =
    await Promise.all([import("firebase/app"), import("firebase/database"), import("firebase/auth")]);

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  const db = getDatabase(app);
  return { auth, db, ref, get, onValue, set, remove };
}

function listToRecord<T extends { id: string }>(items: T[]) {
  return Object.fromEntries(items.map((item) => [item.id, item])) as Record<string, T>;
}

function roomToFirebasePayload(room: Room, hostUid?: string): FirebaseRoomPayload {
  return {
    ...room,
    hostUid: room.hostUid ?? hostUid,
    players: listToRecord(room.players),
    contestants: listToRecord(room.contestants),
    currentRace: {
      ...room.currentRace,
      bets: listToRecord(room.currentRace.bets),
    },
  };
}

export async function getFirebaseUid() {
  const services = await getFirebaseServices();
  return services?.auth.currentUser?.uid;
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
  const { auth, db, ref, set } = services;
  const hostUid = room.hostUid ?? auth.currentUser?.uid;
  const updatedRoom = { ...room, hostUid, updatedAt: Date.now() };
  await set(ref(db, `rooms/${room.id}`), roomToFirebasePayload(updatedRoom, hostUid));
  if (hostUid) {
    await set(ref(db, `roomMembers/${room.id}/${hostUid}`), {
      role: "host",
      joinCode: room.joinCode,
      joinedAt: room.createdAt,
    });
  }
}

export async function joinFirebaseRoom(roomId: string, joinCode: string) {
  if (!isFirebaseConfigured) return;

  const services = await getFirebaseServices();
  if (!services?.auth.currentUser) return;
  const uid = services.auth.currentUser.uid;
  const { db, ref, set } = services;
  await set(ref(db, `roomMembers/${roomId}/${uid}`), {
    role: "player",
    joinCode,
    joinedAt: Date.now(),
  });
}

export async function saveFirebasePlayer(roomId: string, player: Player) {
  if (!isFirebaseConfigured) return;

  const services = await getFirebaseServices();
  if (!services) return;
  const { db, ref, set } = services;
  await set(ref(db, `rooms/${roomId}/players/${player.id}`), player);
}

export async function saveFirebaseBet(roomId: string, bet: Bet) {
  if (!isFirebaseConfigured) return;

  const services = await getFirebaseServices();
  if (!services) return;
  const { db, ref, set } = services;
  await set(ref(db, `rooms/${roomId}/currentRace/bets/${bet.id}`), bet);
}

export async function deleteFirebaseRoom(roomId: string) {
  if (!isFirebaseConfigured) return;

  const services = await getFirebaseServices();
  if (!services) return;
  const { db, ref, remove } = services;
  await remove(ref(db, `roomMembers/${roomId}`));
  await remove(ref(db, `rooms/${roomId}`));
}
