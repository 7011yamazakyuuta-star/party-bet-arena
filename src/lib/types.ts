export type BetType = "win" | "place" | "exacta" | "trifecta";
export type RaceStatus = "setup" | "betting" | "closed" | "settled";
export type ThemeName = "neon" | "pop" | "minimal" | "party" | "garden" | "candy" | "sky";
export type LanguageName = "ja" | "en" | "zh" | "ko" | "es" | "fr" | "de" | "it" | "uk";
export type AppRole = "host" | "player";

export type RoomSettings = {
  maxPlayers: number;
  maxContestants: number;
  autoOdds: boolean;
  marketOdds: boolean;
  allowDebt: boolean;
  maxRaces: number;
  specialBonus: number;
};

export type Player = {
  id: string;
  uid?: string;
  name: string;
  balance: number;
  isOffline: boolean;
  accent: string;
  emoji: string;
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
  uid?: string;
  playerId: string;
  contestantId: string;
  contestantIds: string[];
  type: BetType;
  amount: number;
  multiplier?: number;
  placedBy: "self" | "host";
  createdAt: number;
};

export type Race = {
  id: string;
  title: string;
  status: RaceStatus;
  startedAt: number;
  endsAt: number;
  bets: Bet[];
  resultIds: string[];
  settledAt?: number;
};

export type RacePayout = {
  playerId: string;
  stake: number;
  payout: number;
  delta: number;
  balanceAfter: number;
  hits: number;
};

export type RaceHistoryEntry = {
  raceId: string;
  raceTitle: string;
  settledAt: number;
  resultIds: string[];
  payouts: RacePayout[];
};

export type Room = {
  id: string;
  hostUid?: string;
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
  raceHistory: RaceHistoryEntry[];
  createdAt: number;
  updatedAt: number;
};

export type DraftBet = {
  uid?: string;
  playerId: string;
  contestantId: string;
  contestantIds: string[];
  type: BetType;
  amount: number;
  multiplier: number;
  placedBy: "self" | "host";
};
