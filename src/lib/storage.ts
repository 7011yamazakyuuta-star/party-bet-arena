import { createInitialRoom } from "./sample";
import type { AppRole, LanguageName, Player, Room, ThemeName } from "./types";

const roomKey = "party-bet-arena:room";
const sessionKey = "party-bet-arena:session";
const roomSummariesKey = "party-bet-arena:room-summaries";
const deletedRoomIdsKey = "party-bet-arena:deleted-room-ids";

export type LocalSession = {
  role: AppRole;
  playerId?: string;
  language: LanguageName;
};

export type LocalRoomSummary = {
  id: string;
  name: string;
  joinCode: string;
  isDemo: boolean;
  currentRaceNumber: number;
  maxRaces: number;
  status: Room["currentRace"]["status"];
  updatedAt: number;
};

const validThemes = new Set<ThemeName>(["party", "garden", "candy", "sky", "neon", "pop", "minimal"]);
const fallbackEmojis = ["🎮", "😎", "🌟", "🚗", "🎲", "🔥", "🍀", "🏆"];
const fallbackContestantIcons = ["👑", "🤖", "⚡", "🍀", "🚀", "🎯", "💎", "⭐"];
const legacyContestantIcons: Record<string, string> = {
  sparkle: "👑",
  wave: "🤖",
  bolt: "⚡",
  leaf: "🍀",
};
const validLanguages = new Set<LanguageName>(["ja", "en", "zh", "ko", "es", "fr", "de", "it", "uk"]);

function normalizeIcon(icon: string | undefined, index: number) {
  if (!icon) return fallbackContestantIcons[index % fallbackContestantIcons.length];
  return legacyContestantIcons[icon] ?? icon;
}

function normalizeList<T extends { id: string }>(value: unknown, fallback: T[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, Partial<T>>).map(([id, item]) => ({
      ...item,
      id: item.id ?? id,
    }) as T);
  }
  return fallback;
}

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
  const normalized = normalizeRoom(room);
  const next = { ...normalized, updatedAt: Date.now() };
  localStorage.setItem(roomKey, JSON.stringify(next));
  return rememberRoom(next);
}

export function loadRoomSummaries(): LocalRoomSummary[] {
  const stored = localStorage.getItem(roomSummariesKey);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored) as Partial<LocalRoomSummary>[];
    return parsed
      .filter((room): room is LocalRoomSummary => Boolean(room.id && room.name && room.joinCode))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function rememberRoom(room: Room) {
  if (room.isDemo) return loadRoomSummaries();
  if (loadDeletedRoomIds().includes(room.id)) {
    const next = loadRoomSummaries().filter((item) => item.id !== room.id);
    localStorage.setItem(roomSummariesKey, JSON.stringify(next));
    return next;
  }

  const currentRaceNumber = Number(room.currentRace.title.match(/\d+/)?.[0] ?? room.raceHistory.length + 1);
  const summary: LocalRoomSummary = {
    id: room.id,
    name: room.name.trim() || room.id,
    joinCode: room.joinCode,
    isDemo: room.isDemo,
    currentRaceNumber,
    maxRaces: room.settings.maxRaces,
    status: room.currentRace.status,
    updatedAt: room.updatedAt,
  };
  const next = [summary, ...loadRoomSummaries().filter((item) => item.id !== room.id)].slice(0, 12);
  localStorage.setItem(roomSummariesKey, JSON.stringify(next));
  return next;
}

export function forgetRoomSummary(roomId: string) {
  rememberDeletedRoom(roomId);
  const next = loadRoomSummaries().filter((item) => item.id !== roomId);
  localStorage.setItem(roomSummariesKey, JSON.stringify(next));
  return next;
}

export function restoreRoomSummary(roomId: string) {
  const next = loadDeletedRoomIds().filter((id) => id !== roomId);
  localStorage.setItem(deletedRoomIdsKey, JSON.stringify(next));
}

export function isRoomDeleted(roomId: string) {
  return loadDeletedRoomIds().includes(roomId);
}

function loadDeletedRoomIds() {
  const stored = localStorage.getItem(deletedRoomIdsKey);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored) as unknown[];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function rememberDeletedRoom(roomId: string) {
  const next = [roomId, ...loadDeletedRoomIds().filter((id) => id !== roomId)].slice(0, 40);
  localStorage.setItem(deletedRoomIdsKey, JSON.stringify(next));
}

export function loadSession(): LocalSession {
  const stored = localStorage.getItem(sessionKey);
  if (!stored) return { role: "host", language: "ja" };

  try {
    const session = JSON.parse(stored) as Partial<LocalSession>;
    return {
      role: session.role === "player" ? "player" : "host",
      playerId: session.playerId,
      language: validLanguages.has(session.language as LanguageName) ? (session.language as LanguageName) : "ja",
    };
  } catch {
    return { role: "host", language: "ja" };
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
    theme: validThemes.has(room.theme) ? room.theme : fallback.theme,
    settings: {
      ...fallback.settings,
      ...room.settings,
      maxPlayers: Math.min(8, Math.max(1, room.settings?.maxPlayers ?? fallback.settings.maxPlayers)),
      maxContestants: Math.min(8, Math.max(1, room.settings?.maxContestants ?? fallback.settings.maxContestants)),
      maxRaces: Math.min(15, Math.max(1, room.settings?.maxRaces ?? fallback.settings.maxRaces)),
      marketOdds: room.settings?.marketOdds ?? fallback.settings.marketOdds,
      allowDebt: room.settings?.allowDebt ?? fallback.settings.allowDebt,
      specialBonus: Math.max(0, Math.floor(room.settings?.specialBonus ?? fallback.settings.specialBonus)),
    },
    players: normalizeList<Player>((room as unknown as { players?: unknown }).players, fallback.players).map((player, index) => {
      const { skillRating: _legacySkillRating, ...cleanPlayer } = player as Player & { skillRating?: number };
      return {
        ...cleanPlayer,
        emoji: player.emoji || fallbackEmojis[index % fallbackEmojis.length],
      };
    }),
    contestants: normalizeList((room as unknown as { contestants?: unknown }).contestants, fallback.contestants).map((contestant, index) => ({
      ...contestant,
      icon: normalizeIcon(contestant.icon, index),
      strengthRating: contestant.strengthRating ?? Math.max(1, 9 - index),
      cpuLevel: contestant.cpuLevel ?? Math.max(1, 9 - index),
      isCpu: contestant.isCpu ?? index > 0,
    })),
    currentRace: {
      ...fallback.currentRace,
      ...room.currentRace,
      startedAt: room.currentRace?.startedAt ?? fallback.currentRace.startedAt,
      endsAt: room.currentRace?.endsAt ?? room.currentRace?.startedAt ?? fallback.currentRace.startedAt,
      bets: normalizeList((room.currentRace as unknown as { bets?: unknown } | undefined)?.bets, fallback.currentRace.bets).map((bet) => ({
        ...bet,
        contestantIds: bet.contestantIds?.length ? bet.contestantIds : [bet.contestantId],
      })),
      resultIds: room.currentRace?.resultIds ?? [],
    },
    raceHistory: (room.raceHistory ?? []).map((entry) => ({
      ...entry,
      resultIds: entry.resultIds ?? [],
      payouts: (entry.payouts ?? []).map((payout) => ({
        ...payout,
        stake: payout.stake ?? 0,
        payout: payout.payout ?? 0,
        delta: payout.delta ?? 0,
        balanceAfter: payout.balanceAfter ?? 0,
        hits: payout.hits ?? 0,
      })),
    })),
  };
}
