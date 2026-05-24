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
    return normalizeRoom(JSON.parse(stored) as Room);
  } catch {
    return createInitialRoom();
  }
}

export function saveRoom(room: Room) {
  localStorage.setItem(roomKey, JSON.stringify({ ...normalizeRoom(room), updatedAt: Date.now() }));
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

export function normalizeRoom(room: Room): Room {
  const fallback = createInitialRoom();

  return {
    ...fallback,
    ...room,
    isDemo: room.isDemo ?? room.id === "DEMO42",
    theme: room.theme ?? fallback.theme,
    settings: {
      ...fallback.settings,
      ...room.settings,
      maxPlayers: Math.min(8, Math.max(1, room.settings?.maxPlayers ?? fallback.settings.maxPlayers)),
      maxContestants: Math.min(8, Math.max(1, room.settings?.maxContestants ?? fallback.settings.maxContestants)),
    },
    players: (room.players ?? fallback.players).map((player, index) => ({
      ...player,
      skillRating: player.skillRating ?? Math.max(1, Math.min(9, 5 + index)),
    })),
    contestants: (room.contestants ?? fallback.contestants).map((contestant, index) => ({
      ...contestant,
      strengthRating: contestant.strengthRating ?? Math.max(1, 9 - index),
      cpuLevel: contestant.cpuLevel ?? Math.max(1, 9 - index),
      isCpu: contestant.isCpu ?? index > 0,
    })),
    currentRace: {
      ...fallback.currentRace,
      ...room.currentRace,
      bets: (room.currentRace?.bets ?? []).map((bet) => ({
        ...bet,
        contestantIds: bet.contestantIds?.length ? bet.contestantIds : [bet.contestantId],
      })),
      resultIds: room.currentRace?.resultIds ?? [],
    },
  };
}
