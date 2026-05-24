import type { Contestant, Player, Room } from "./types";

const now = Date.now();

export const defaultPlayers: Player[] = [
  { id: "p-yuta", name: "ゆうた", balance: 1250, isOffline: false, accent: "#55f3ec" },
  { id: "p-takumi", name: "たくみ", balance: 980, isOffline: false, accent: "#9d7cff" },
  { id: "p-ayaka", name: "あやか", balance: 1540, isOffline: true, accent: "#ff9bc8" },
  { id: "p-kento", name: "けんと", balance: 760, isOffline: false, accent: "#ffcf5b" },
];

export const defaultContestants: Contestant[] = [
  { id: "c-velocity", name: "Velocity", odds: 1.8, accent: "#55f3ec", icon: "wave" },
  { id: "c-nightfall", name: "Nightfall", odds: 2.4, accent: "#a98cff", icon: "sparkle" },
  { id: "c-swiftwind", name: "Swiftwind", odds: 3.1, accent: "#89a7ff", icon: "bolt" },
  { id: "c-ironclad", name: "Ironclad", odds: 4.8, accent: "#64d6a4", icon: "leaf" },
];

export const createInitialRoom = (): Room => ({
  id: "DEMO42",
  name: "カラオケ対決",
  joinCode: "2468",
  hostPin: "0000",
  theme: "neon",
  startingBalance: 1000,
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
        contestantId: "c-velocity",
        type: "win",
        amount: 100,
        placedBy: "self",
        createdAt: now - 1000 * 60,
      },
      {
        id: "bet-demo-2",
        playerId: "p-ayaka",
        contestantId: "c-nightfall",
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

  return {
    ...createInitialRoom(),
    id: roomId,
    name,
    joinCode,
    currentRace: {
      ...createInitialRoom().currentRace,
      id: `race-${crypto.randomUUID()}`,
      bets: [],
      endsAt: Date.now() + 1000 * 60 * 10,
      resultIds: [],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};
