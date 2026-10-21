import assert from "node:assert/strict";
import { test } from "node:test";
import { createBlankRoom } from "../src/lib/sample.ts";
import { createBet, getEffectiveMultiplier, settleRoom, validateBet } from "../src/lib/calculations.ts";
import { loadRoom, loadRoomSummaries, normalizeRoom, saveRoom } from "../src/lib/storage.ts";

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

test("empty live Firebase collections do not inherit demo players or bets", () => {
  const room = createBlankRoom("new live room", "host-uid");
  const databaseValue = structuredClone(room);
  delete databaseValue.players;
  delete databaseValue.currentRace.bets;
  const restored = normalizeRoom(databaseValue);
  assert.equal(restored.players.length, 0);
  assert.equal(restored.currentRace.bets.length, 0);
  assert.equal(restored.contestants.length, room.contestants.length);
});

test("legacy rooms are removed from local launch state", () => {
  const previousStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  try {
    const legacy = createBlankRoom("old room", "old-host");
    delete legacy.schemaVersion;
    localStorage.setItem("party-bet-arena:room", JSON.stringify(legacy));
    localStorage.setItem("party-bet-arena:room-summaries", JSON.stringify([
      { id: legacy.id, name: legacy.name, isDemo: false, updatedAt: Date.now() },
    ]));
    assert.equal(loadRoom().isDemo, true);
    assert.notEqual(localStorage.getItem("party-bet-arena:room"), null);
    assert.deepEqual(loadRoomSummaries(), []);
    assert.equal(localStorage.getItem("party-bet-arena:room-summaries"), "[]");
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});

test("synchronized rooms do not retain full records or invite codes in localStorage", () => {
  const previousStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  try {
    const liveRoom = createBlankRoom("privacy test", "host-uid");
    const fullRoomKey = "party-bet-arena:room";
    localStorage.setItem(fullRoomKey, JSON.stringify(liveRoom));
    assert.equal(loadRoom().id, liveRoom.id);
    assert.notEqual(localStorage.getItem(fullRoomKey), null);
    saveRoom(liveRoom, false);
    assert.equal(localStorage.getItem(fullRoomKey), null);
    assert.ok(!localStorage.getItem("party-bet-arena:room-summaries").includes(liveRoom.joinCode));
    localStorage.setItem(fullRoomKey, JSON.stringify({ ...liveRoom, updatedAt: liveRoom.updatedAt + 1 }));
    saveRoom(liveRoom, false);
    assert.notEqual(localStorage.getItem(fullRoomKey), null);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
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
