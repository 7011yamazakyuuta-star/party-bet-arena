import { createInitialRoom } from "./sample";
import type { AppRole, LanguageName, Room, ThemeName } from "./types";

const roomKey = "party-bet-arena:room";
const sessionKey = "party-bet-arena:session";

export type LocalSession = {
  role: AppRole;
  playerId?: string;
  language: LanguageName;
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

function normalizeIcon(icon: string | undefined, index: number) {
  if (!icon) return fallbackContestantIcons[index % fallbackContestantIcons.length];
  return legacyContestantIcons[icon] ?? icon;
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
  localStorage.setItem(roomKey, JSON.stringify({ ...normalizeRoom(room), updatedAt: Date.now() }));
}

export function loadSession(): LocalSession {
  const stored = localStorage.getItem(sessionKey);
  if (!stored) return { role: "host", language: "ja" };

  try {
    const session = JSON.parse(stored) as Partial<LocalSession>;
    return {
      role: session.role === "player" ? "player" : "host",
      playerId: session.playerId,
      language: session.language === "en" ? "en" : "ja",
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
    players: (room.players ?? fallback.players).map((player, index) => ({
      ...player,
      skillRating: player.skillRating ?? Math.max(1, Math.min(9, 5 + index)),
      emoji: player.emoji || fallbackEmojis[index % fallbackEmojis.length],
    })),
    contestants: (room.contestants ?? fallback.contestants).map((contestant, index) => ({
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
      bets: (room.currentRace?.bets ?? []).map((bet) => ({
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
