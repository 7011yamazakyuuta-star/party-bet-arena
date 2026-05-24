import type { Bet, BetType, Contestant, DraftBet, Player, Room } from "./types";

export const currency = new Intl.NumberFormat("ja-JP");

export function getContestant(room: Room, contestantId: string) {
  return room.contestants.find((contestant) => contestant.id === contestantId);
}

export function getPlayer(room: Room, playerId: string) {
  return room.players.find((player) => player.id === playerId);
}

export function placeMultiplier(type: BetType, contestant: Contestant) {
  if (type === "win") return contestant.odds;
  return Math.max(1.1, Number((contestant.odds * 0.52).toFixed(2)));
}

export function isBetHit(type: BetType, contestantId: string, resultIds: string[]) {
  const position = resultIds.indexOf(contestantId);
  if (position < 0) return false;
  if (type === "win") return position === 0;
  return position <= 2;
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
  const contestant = getContestant(room, draft.contestantId);
  if (!contestant) return 0;
  return Math.floor(draft.amount * placeMultiplier(draft.type, contestant));
}

export function validateBet(room: Room, draft: DraftBet) {
  if (room.currentRace.status !== "betting") return "BET受付中ではありません。";
  if (!draft.playerId) return "プレイヤーを選んでください。";
  if (!draft.contestantId) return "賭け先を選んでください。";
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
    contestantId: draft.contestantId,
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
      const contestant = getContestant(room, bet.contestantId);
      if (!contestant) return current;
      const afterStake = current - bet.amount;

      if (!isBetHit(bet.type, bet.contestantId, resultIds)) {
        return Math.max(0, afterStake);
      }

      return Math.max(0, afterStake + Math.floor(bet.amount * placeMultiplier(bet.type, contestant)));
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
