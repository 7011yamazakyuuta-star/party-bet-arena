import assert from "node:assert/strict";
import { test } from "node:test";
import { createBlankRoom } from "../src/lib/sample.ts";
import { createBet, getEffectiveMultiplier, settleRoom, validateBet } from "../src/lib/calculations.ts";

function bettingRoom() {
  const room = createBlankRoom("security test", "host-uid");
  room.currentRace.status = "betting";
  room.settings.allowDebt = false;
  room.players = [{
    id: "player-uid",
    uid: "player-uid",
    name: "Player",
    balance: 1000,
    isOffline: false,
    accent: "#3568ff",
    emoji: "x",
  }];
  return room;
}

test("new invitations do not reuse short predictable identifiers", () => {
  const first = createBlankRoom();
  const second = createBlankRoom();
  assert.match(first.id, /^[A-HJ-NP-Z2-9]{12}$/);
  assert.match(first.joinCode, /^[A-HJ-NP-Z2-9]{16}$/);
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.joinCode, second.joinCode);
});

test("self bets reject duplicate, invalid and unaffordable amounts", () => {
  const room = bettingRoom();
  const draft = {
    uid: "player-uid",
    playerId: "player-uid",
    contestantId: room.contestants[0].id,
    contestantIds: [room.contestants[0].id],
    type: "win",
    amount: 100,
    multiplier: 999999,
    placedBy: "self",
  };
  assert.equal(validateBet(room, draft), null);
  room.currentRace.bets = [createBet(draft)];
  assert.ok(validateBet(room, draft)?.includes("すでにBET済み"));
  room.currentRace.bets = [];
  assert.ok(validateBet(room, { ...draft, amount: 1001 }));
  assert.ok(validateBet(room, { ...draft, amount: 1.5 }));
  assert.ok(validateBet(room, { ...draft, contestantIds: ["missing"] }));
});

test("settlement ignores client supplied multiplier and malformed stakes", () => {
  const room = bettingRoom();
  const contestant = room.contestants[0];
  const bet = createBet({
    uid: "player-uid",
    playerId: "player-uid",
    contestantId: contestant.id,
    contestantIds: [contestant.id],
    type: "win",
    amount: 100,
    multiplier: 999999,
    placedBy: "self",
  });
  assert.equal(bet.multiplier, undefined);
  room.currentRace.bets = [{ ...bet, multiplier: 999999 }];
  const expected = Math.floor(100 * getEffectiveMultiplier(room, "win", [contestant]));
  const settled = settleRoom(room, room.contestants.map((item) => item.id));
  assert.equal(settled.players[0].balance, 900 + expected);
  assert.equal(settled.raceHistory.at(-1).bets[0].multiplier, getEffectiveMultiplier(room, "win", [contestant]));

  room.currentRace.bets = [{ ...bet, amount: -50, multiplier: 999999 }];
  assert.equal(settleRoom(room, room.contestants.map((item) => item.id)).players[0].balance, 1000);
});
