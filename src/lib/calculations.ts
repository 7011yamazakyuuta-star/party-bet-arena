import type { Bet, BetType, Contestant, DraftBet, Player, RacePayout, Room } from "./types";

export const currency = new Intl.NumberFormat("ja-JP");
export const maxParticipantLimit = 8;
export const maxRating = 9;
export const maxRaceLimit = 15;

export function getContestant(room: Room, contestantId: string) {
  return room.contestants.find((contestant) => contestant.id === contestantId);
}

export function getPlayer(room: Room, playerId: string) {
  return room.players.find((player) => player.id === playerId);
}

export function requiredPickCount(type: BetType) {
  if (type === "exacta") return 2;
  if (type === "trifecta") return 3;
  return 1;
}

export function getBetPickIds(bet: Pick<Bet, "contestantId"> & Partial<Pick<Bet, "contestantIds">>) {
  return bet.contestantIds?.length ? bet.contestantIds : [bet.contestantId];
}

export function calculateAutoOdds(contestants: Contestant[]) {
  const weights = contestants.map((contestant) => {
    const normalizedRating = Math.max(1, Math.min(9, contestant.cpuLevel || 5));
    return Math.exp((normalizedRating - 5) * 0.36);
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const maxOdds = Math.min(20, Math.max(8, contestants.length * 3.2));

  return contestants.map((contestant, index) => {
    const winProbability = weights[index] / totalWeight;
    const fairOdds = 1 / Math.max(0.001, winProbability);
    const playableOdds = 1 + (fairOdds - 1) * 0.72;
    const odds = Math.max(1.1, Math.min(maxOdds, Number(playableOdds.toFixed(1))));
    return { ...contestant, odds, strengthRating: Math.max(1, Math.min(9, contestant.cpuLevel || 5)) };
  });
}

export function placeMultiplier(type: BetType, contestants: Contestant[]) {
  if (!contestants.length) return 0;
  const oddsProduct = contestants.reduce((product, contestant) => product * contestant.odds, 1);

  if (type === "win") return contestants[0].odds;
  if (type === "place") return Math.max(1.1, Number((contestants[0].odds * 0.52).toFixed(2)));
  if (type === "exacta") return Math.max(1.3, Number((oddsProduct * 0.72).toFixed(2)));
  return Math.max(1.6, Number((oddsProduct * 0.88).toFixed(2)));
}

function getOutcomeKey(type: BetType, contestantIds: string[]) {
  if (type === "win" || type === "place") return contestantIds[0] ?? "";
  return contestantIds.slice(0, requiredPickCount(type)).join(">");
}

function clampMultiplier(type: BetType, multiplier: number) {
  const maxMultiplier = type === "trifecta" ? 80 : type === "exacta" ? 50 : type === "place" ? 20 : 30;
  return Math.max(1.05, Math.min(maxMultiplier, Number(multiplier.toFixed(2))));
}

export function getEffectiveMultiplier(room: Room, type: BetType, contestants: Contestant[]) {
  const baseMultiplier = placeMultiplier(type, contestants);
  if (!baseMultiplier || !room.settings.marketOdds) return baseMultiplier;

  const targetIds = contestants.map((contestant) => contestant.id);
  const targetKey = getOutcomeKey(type, targetIds);
  const typeBets = room.currentRace.bets.filter((bet) => bet.type === type);
  const pool = typeBets.reduce((sum, bet) => sum + bet.amount, 0);
  if (pool <= 0) return baseMultiplier;

  const outcomeStake = typeBets
    .filter((bet) => getOutcomeKey(type, getBetPickIds(bet)) === targetKey)
    .reduce((sum, bet) => sum + bet.amount, 0);
  const virtualPool = Math.max(240, room.contestants.length * 90);
  const payoutRate = 0.92;
  const virtualOutcomeStake = (virtualPool * payoutRate) / baseMultiplier;
  const marketMultiplier = ((pool + virtualPool) * payoutRate) / (outcomeStake + virtualOutcomeStake);

  return clampMultiplier(type, marketMultiplier);
}

export function isBetHit(type: BetType, contestantIds: string[], resultIds: string[]) {
  if (!contestantIds.length) return false;
  const firstPosition = resultIds.indexOf(contestantIds[0]);
  if (firstPosition < 0) return false;
  if (type === "win") return firstPosition === 0;
  if (type === "place") return firstPosition <= 2;
  if (type === "exacta") {
    return contestantIds.length >= 2 && resultIds[0] === contestantIds[0] && resultIds[1] === contestantIds[1];
  }
  return (
    contestantIds.length >= 3 &&
    resultIds[0] === contestantIds[0] &&
    resultIds[1] === contestantIds[1] &&
    resultIds[2] === contestantIds[2]
  );
}

export function getReservedAmount(room: Room, playerId: string) {
  if (room.currentRace.status === "settled") return 0;

  return room.currentRace.bets
    .filter((bet) => bet.playerId === playerId)
    .reduce((sum, bet) => sum + bet.amount, 0);
}

export function getAvailableBalance(room: Room, playerId: string) {
  const player = getPlayer(room, playerId);
  if (!player) return 0;
  return Math.max(0, player.balance - getReservedAmount(room, playerId));
}

export function getPotentialPayout(room: Room, draft: DraftBet) {
  const contestants = draft.contestantIds
    .map((contestantId) => getContestant(room, contestantId))
    .filter((contestant): contestant is Contestant => Boolean(contestant));
  if (contestants.length !== requiredPickCount(draft.type)) return 0;
  const multiplier = draft.multiplier || getEffectiveMultiplier(room, draft.type, contestants);
  return Math.floor(draft.amount * multiplier);
}

export function validateBet(room: Room, draft: DraftBet) {
  if (room.currentRace.status !== "betting") return "BET受付中ではありません。";
  if (!draft.playerId) return "プレイヤーを選んでください。";
  if (!draft.contestantIds.length) return "賭け先を選んでください。";
  if (draft.contestantIds.length !== requiredPickCount(draft.type)) {
    return `${requiredPickCount(draft.type)}つの順位を選んでください。`;
  }
  if (new Set(draft.contestantIds).size !== draft.contestantIds.length) {
    return "同じ対象を複数順位に選ぶことはできません。";
  }
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) return "BET額を入力してください。";
  if (!room.settings.allowDebt && draft.amount > getAvailableBalance(room, draft.playerId)) {
    return "利用可能コインを超えています。";
  }
  return null;
}

export function createBet(draft: DraftBet): Bet {
  return {
    id: crypto.randomUUID(),
    playerId: draft.playerId,
    contestantId: draft.contestantIds[0],
    contestantIds: draft.contestantIds,
    type: draft.type,
    amount: Math.floor(draft.amount),
    multiplier: Number(draft.multiplier.toFixed(2)),
    placedBy: draft.placedBy,
    createdAt: Date.now(),
  };
}

export function settleRoom(room: Room, resultIds: string[]) {
  const settledAt = Date.now();
  const payoutRows = new Map<string, RacePayout>();

  const nextPlayers = room.players.map((player) => {
    const summary: RacePayout = {
      playerId: player.id,
      stake: 0,
      payout: 0,
      delta: 0,
      balanceAfter: player.balance,
      hits: 0,
    };
    const playerBets = room.currentRace.bets.filter((bet) => bet.playerId === player.id);
    const balance = playerBets.reduce((current, bet) => {
      const contestants = getBetPickIds(bet)
        .map((contestantId) => getContestant(room, contestantId))
        .filter((contestant): contestant is Contestant => Boolean(contestant));
      if (contestants.length !== requiredPickCount(bet.type)) return current;
      const afterStake = current - bet.amount;
      summary.stake += bet.amount;

      if (!isBetHit(bet.type, getBetPickIds(bet), resultIds)) {
        return room.settings.allowDebt ? afterStake : Math.max(0, afterStake);
      }

      const multiplier = bet.multiplier ?? getEffectiveMultiplier(room, bet.type, contestants);
      const payout = Math.floor(bet.amount * multiplier);
      summary.payout += payout;
      summary.hits += 1;
      const afterPayout = afterStake + payout;
      return room.settings.allowDebt ? afterPayout : Math.max(0, afterPayout);
    }, player.balance);

    summary.delta = balance - player.balance;
    summary.balanceAfter = balance;
    payoutRows.set(player.id, summary);

    return { ...player, balance };
  });

  const historyEntry = {
    raceId: room.currentRace.id,
    raceTitle: room.currentRace.title,
    settledAt,
    resultIds,
    payouts: room.players.map((player) => payoutRows.get(player.id)).filter((row): row is RacePayout => Boolean(row)),
  };
  const raceHistory = [
    ...(room.raceHistory ?? []).filter((entry) => entry.raceId !== room.currentRace.id),
    historyEntry,
  ].slice(-maxRaceLimit);

  return {
    ...room,
    players: nextPlayers,
    raceHistory,
    currentRace: {
      ...room.currentRace,
      status: "settled" as const,
      resultIds,
      settledAt,
    },
    updatedAt: settledAt,
  };
}

export function startNextRace(room: Room) {
  const now = Date.now();
  const currentRaceNumber = Number(room.currentRace.title.match(/\d+/)?.[0] ?? room.raceHistory.length + 1);
  const nextRaceNumber = Math.min(room.settings.maxRaces, currentRaceNumber + 1);

  return {
    ...room,
    currentRace: {
      id: `race-${crypto.randomUUID()}`,
      title: `第${nextRaceNumber}レース`,
      status: "betting" as const,
      startedAt: now,
      endsAt: now,
      bets: [],
      resultIds: [],
    },
    updatedAt: now,
  };
}

export function rankedPlayers(players: Player[]) {
  return [...players].sort((a, b) => b.balance - a.balance);
}

export function clampCount(value: number) {
  return Math.max(1, Math.min(maxParticipantLimit, Math.floor(value)));
}

export function clampRaceCount(value: number) {
  return Math.max(1, Math.min(maxRaceLimit, Math.floor(value)));
}

export function clampRating(value: number) {
  return Math.max(1, Math.min(maxRating, Math.floor(value)));
}
