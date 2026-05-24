import { createInitialRoom } from "./sample";
import type { AppRole, Room } from "./types";

const roomKey = "party-bet-arena:room";
const sessionKey = "party-bet-arena:session";

export type LocalSession = {
  role: AppRole;
  playerId?: string;
};

export function loadRoom() {
  const stored = localStorage.getItem(roomKey);
  if (!stored) return createInitialRoom();

  try {
    return JSON.parse(stored) as Room;
  } catch {
    return createInitialRoom();
  }
}

export function saveRoom(room: Room) {
  localStorage.setItem(roomKey, JSON.stringify({ ...room, updatedAt: Date.now() }));
}

export function loadSession(): LocalSession {
  const stored = localStorage.getItem(sessionKey);
  if (!stored) return { role: "host" };

  try {
    return JSON.parse(stored) as LocalSession;
  } catch {
    return { role: "host" };
  }
}

export function saveSession(session: LocalSession) {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

export function resetLocalRoom() {
  const room = createInitialRoom();
  saveRoom(room);
  return room;
}
