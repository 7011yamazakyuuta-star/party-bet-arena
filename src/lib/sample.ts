import type { Contestant, Player, Room } from "./types";

const now = Date.now();

export const defaultPlayers: Player[] = [
  { id: "p-yuta", name: "ゆうた", balance: 1250, isOffline: false, accent: "#55f3ec", skillRating: 7 },
  { id: "p-takumi", name: "たくみ", balance: 980, isOffline: false, accent: "#9d7cff", skillRating: 6 },
  { id: "p-ayaka", name: "あやか", balance: 1540, isOffline: true, accent: "#ff9bc8", skillRating: 8 },
  { id: "p-kento", name: "けんと", balance: 760, isOffline: false, accent: "#ffcf5b", skillRating: 5 },
];

export const defaultContestants: Contestant[] = [
  { id: "c-player", name: "Player", odds: 1.4, accent: "#ff4c69", icon: "sparkle", strengthRating: 9, cpuLevel: 9, isCpu: false },
  { id: "c-cpu1", name: "CPU1", odds: 1.8, accent: "#3568ff", icon: "wave", strengthRating: 8, cpuLevel: 9, isCpu: true },
  { id: "c-cpu2", name: "CPU2", odds: 2.3, accent: "#f2c114", icon: "bolt", strengthRating: 7, cpuLevel: 8, isCpu: true },
  { id: "c-cpu3", name: "CPU3", odds: 3.1, accent: "#25bf45", icon: "leaf", strengthRating: 6, cpuLevel: 7, isCpu: true },
];

export const createInitialRoom = (): Room => ({
  id: "DEMO42",
  name: "カラオケ対決",
  isDemo: true,
  joinCode: "2468",
  hostPin: "0000",
  theme: "party",
  startingBalance: 1000,
  settings: {
    maxPlayers: 8,
    maxContestants: 8,
    autoOdds: true,
  },
  players: defaultPlayers,
  contestants: defaultContestants,
  currentRace: {
    id: "race-1",
    title: "Round 1",
    status: "betting",
    endsAt: now + 1000 * 60 * 12,
    bets: [
      {
        id: "bet-demo-1",
        playerId: "p-yuta",
        contestantId: "c-player",
        contestantIds: ["c-player"],
        type: "win",
        amount: 100,
        placedBy: "self",
        createdAt: now - 1000 * 60,
      },
      {
        id: "bet-demo-2",
        playerId: "p-ayaka",
        contestantId: "c-cpu1",
        contestantIds: ["c-cpu1"],
        type: "place",
        amount: 80,
        placedBy: "host",
        createdAt: now - 1000 * 40,
      },
    ],
    resultIds: [],
  },
  createdAt: now,
  updatedAt: now,
});

export const createBlankRoom = (name = "みんなBET Arena"): Room => {
  const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
  const joinCode = Math.floor(1000 + Math.random() * 9000).toString();
  const base = createInitialRoom();

  return {
    ...base,
    id: roomId,
    name,
    isDemo: false,
    joinCode,
    players: [],
    contestants: base.contestants.map((contestant) => ({ ...contestant })),
    currentRace: {
      ...base.currentRace,
      id: `race-${crypto.randomUUID()}`,
      bets: [],
      endsAt: Date.now() + 1000 * 60 * 10,
      resultIds: [],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};
