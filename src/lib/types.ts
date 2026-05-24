export type BetType = "win" | "place" | "exacta" | "trifecta";
export type RaceStatus = "setup" | "betting" | "closed" | "settled";
export type ThemeName = "neon" | "pop" | "minimal" | "party";
export type AppRole = "host" | "player";

export type RoomSettings = {
  maxPlayers: number;
  maxContestants: number;
  autoOdds: boolean;
};

export type Player = {
  id: string;
  name: string;
  balance: number;
  isOffline: boolean;
  accent: string;
  skillRating: number;
};

export type Contestant = {
  id: string;
  name: string;
  odds: number;
  accent: string;
  icon: string;
  strengthRating: number;
  cpuLevel: number;
  isCpu: boolean;
};

export type Bet = {
  id: string;
  playerId: string;
  contestantId: string;
  contestantIds: string[];
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
  isDemo: boolean;
  joinCode: string;
  hostPin: string;
  theme: ThemeName;
  startingBalance: number;
  settings: RoomSettings;
  players: Player[];
  contestants: Contestant[];
  currentRace: Race;
  createdAt: number;
  updatedAt: number;
};

export type DraftBet = {
  playerId: string;
  contestantId: string;
  contestantIds: string[];
  type: BetType;
  amount: number;
  placedBy: "self" | "host";
};
