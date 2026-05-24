export type BetType = "win" | "place";
export type RaceStatus = "setup" | "betting" | "closed" | "settled";
export type ThemeName = "neon" | "pop" | "minimal";
export type AppRole = "host" | "player";

export type Player = {
  id: string;
  name: string;
  balance: number;
  isOffline: boolean;
  accent: string;
};

export type Contestant = {
  id: string;
  name: string;
  odds: number;
  accent: string;
  icon: string;
};

export type Bet = {
  id: string;
  playerId: string;
  contestantId: string;
  type: BetType;
  amount: number;
  placedBy: "self" | "host";
  createdAt: number;
};

export type Race = {
  id: string;
  title: string;
  status: RaceStatus;
  endsAt: number;
  bets: Bet[];
  resultIds: string[];
  settledAt?: number;
};

export type Room = {
  id: string;
  name: string;
  joinCode: string;
  hostPin: string;
  theme: ThemeName;
  startingBalance: number;
  players: Player[];
  contestants: Contestant[];
  currentRace: Race;
  createdAt: number;
  updatedAt: number;
};

export type DraftBet = {
  playerId: string;
  contestantId: string;
  type: BetType;
  amount: number;
  placedBy: "self" | "host";
};
