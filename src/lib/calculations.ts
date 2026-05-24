import type { Bet, BetType, Contestant, DraftBet, Player, Room } from "./types";

export const currency = new Intl.NumberFormat("ja-JP");
export const maxParticipantLimit = 8;
export const maxRating = 9;

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
  const powers = contestants.map((contestant) => {
    const rating = contestant.isCpu ? contestant.cpuLevel : contestant.strengthRating;
    return Math.pow(Math.max(1, Math.min(9, rating)), 1.45);
  });
  const totalPower = powers.reduce((sum, power) => sum + power, 0) || 1;

  return contestants.map((contestant, index) => {
    const fairOdds = totalPower / powers[index];
    const odds = Math.max(1.1, Math.min(9.9, Number((fairOdds * 0.58).toFixed(1))));
    return { ...contestant, odds };
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
  return Math.floor(draft.amount * placeMultiplier(draft.type, contestants));
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
  if (draft.amount > getAvailableBalance(room, draft.playerId)) {
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
    placedBy: draft.placedBy,
    createdAt: Date.now(),
  };
}

export function settleRoom(room: Room, resultIds: string[]) {
  const nextPlayers = room.players.map((player) => {
    const playerBets = room.currentRace.bets.filter((bet) => bet.playerId === player.id);
    const balance = playerBets.reduce((current, bet) => {
      const contestants = getBetPickIds(bet)
        .map((contestantId) => getContestant(room, contestantId))
        .filter((contestant): contestant is Contestant => Boolean(contestant));
      if (contestants.length !== requiredPickCount(bet.type)) return current;
      const afterStake = current - bet.amount;

      if (!isBetHit(bet.type, getBetPickIds(bet), resultIds)) {
        return Math.max(0, afterStake);
      }

      return Math.max(0, afterStake + Math.floor(bet.amount * placeMultiplier(bet.type, contestants)));
    }, player.balance);

    return { ...player, balance };
  });

  return {
    ...room,
    players: nextPlayers,
    currentRace: {
      ...room.currentRace,
      status: "settled" as const,
      resultIds,
      settledAt: Date.now(),
    },
    updatedAt: Date.now(),
  };
}

export function startNextRace(room: Room) {
  return {
    ...room,
    currentRace: {
      id: `race-${crypto.randomUUID()}`,
      title: `Round ${Number(room.currentRace.title.replace(/\D/g, "")) + 1 || 2}`,
      status: "betting" as const,
      endsAt: Date.now() + 1000 * 60 * 10,
      bets: [],
      resultIds: [],
    },
    updatedAt: Date.now(),
  };
}

export function rankedPlayers(players: Player[]) {
  return [...players].sort((a, b) => b.balance - a.balance);
}

export function clampCount(value: number) {
  return Math.max(1, Math.min(maxParticipantLimit, Math.floor(value)));
}

export function clampRating(value: number) {
  return Math.max(1, Math.min(maxRating, Math.floor(value)));
}
