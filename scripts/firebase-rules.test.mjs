import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { get, ref, remove, set } from "firebase/database";
import { createBlankRoom } from "../src/lib/sample.ts";

const roomId = "SECURITYROOM";
const hostUid = "host-user";
const playerUid = "player-user";
const joinCode = "ABCDEFGHJKLMNPQR";

test("Realtime Database rules enforce room and player boundaries", async () => {
  const environment = await initializeTestEnvironment({
    projectId: "demo-party-bet-security",
    database: { rules: readFileSync(new URL("../firebase.rules.json", import.meta.url), "utf8") },
  });

  try {
    await environment.clearDatabase();
    const room = createBlankRoom("Security test", hostUid);
    room.id = roomId;
    room.joinCode = joinCode;
    room.currentRace.status = "setup";
    room.settings.allowDebt = false;
    const payload = {
      ...room,
      players: {},
      contestants: Object.fromEntries(room.contestants.map((contestant) => [contestant.id, contestant])),
      currentRace: { ...room.currentRace, bets: {} },
    };
    await environment.withSecurityRulesDisabled(async (context) => {
      await set(ref(context.database(), `rooms/${roomId}`), payload);
      await set(ref(context.database(), `roomMembers/${roomId}/${hostUid}`), {
        role: "host",
        joinCode,
        joinedAt: room.createdAt,
      });
    });

    const anonymous = environment.unauthenticatedContext().database();
    const host = environment.authenticatedContext(hostUid, { firebase: { sign_in_provider: "anonymous" } }).database();
    const player = environment.authenticatedContext(playerUid, { firebase: { sign_in_provider: "anonymous" } }).database();
    const outsider = environment.authenticatedContext("outsider", { firebase: { sign_in_provider: "anonymous" } }).database();

    await assertFails(get(ref(anonymous, `rooms/${roomId}`)));
    await assertFails(get(ref(outsider, `rooms/${roomId}`)));
    await assertSucceeds(get(ref(host, `rooms/${roomId}`)));
    await assertFails(set(ref(player, `roomMembers/${roomId}/${playerUid}`), {
      role: "player", joinCode: "WRONG", joinedAt: Date.now(),
    }));
    const membership = { role: "player", joinCode, joinedAt: Date.now() };
    await assertSucceeds(set(ref(player, `roomMembers/${roomId}/${playerUid}`), membership));
    await assertSucceeds(get(ref(player, `rooms/${roomId}`)));
    await assertFails(set(ref(player, `roomMembers/${roomId}/${playerUid}`), { ...membership, role: "host" }));

    const playerRecord = {
      id: playerUid, uid: playerUid, name: "Player", balance: room.startingBalance,
      isOffline: false, accent: "#3568ff", emoji: "x",
    };
    await assertFails(set(ref(player, `rooms/${roomId}/players/${playerUid}`), {
      ...playerRecord, balance: room.startingBalance + 10000,
    }));
    await assertSucceeds(set(ref(player, `rooms/${roomId}/players/${playerUid}`), playerRecord));
    await assertFails(set(ref(player, `rooms/${roomId}/players/${playerUid}/balance`), 1000000));
    await assertFails(set(ref(player, `rooms/${roomId}/players/another-player`), { ...playerRecord, id: "another-player" }));
    await assertFails(set(ref(player, `rooms/${roomId}/hostUid`), playerUid));

    const contestantId = room.contestants[0].id;
    const bet = {
      id: playerUid, uid: playerUid, playerId: playerUid, contestantId,
      contestantIds: [contestantId], type: "win", amount: 10,
      placedBy: "self", createdAt: Date.now(),
    };
    await assertFails(set(ref(player, `rooms/${roomId}/currentRace/bets/${playerUid}`), bet));
    await assertSucceeds(set(ref(host, `rooms/${roomId}/currentRace/status`), "betting"));
    await assertFails(set(ref(player, `rooms/${roomId}/currentRace/bets/${playerUid}`), { ...bet, amount: 1000000 }));
    await assertFails(set(ref(player, `rooms/${roomId}/currentRace/bets/${playerUid}`), { ...bet, multiplier: 9999 }));
    await assertSucceeds(set(ref(player, `rooms/${roomId}/currentRace/bets/${playerUid}`), bet));
    await assertFails(set(ref(player, `rooms/${roomId}/currentRace/bets/${playerUid}`), { ...bet, amount: 1 }));
    await assertFails(remove(ref(player, `rooms/${roomId}/currentRace/bets/${playerUid}`)));
    await assertSucceeds(set(ref(host, `rooms/${roomId}/name`), "Updated by host"));
    await assertFails(set(ref(host, `rooms/${roomId}/hostUid`), "new-host"));
    assert.equal((await get(ref(host, `rooms/${roomId}/name`))).val(), "Updated by host");
    const fullRoom = (await get(ref(host, `rooms/${roomId}`))).val();
    fullRoom.currentRace.bets[playerUid].multiplier = 9999;
    await assertSucceeds(set(ref(host, `rooms/${roomId}`), { ...fullRoom, name: "Host full save" }));
    await assertSucceeds(remove(ref(host, `roomMembers/${roomId}`)));
    await assertSucceeds(remove(ref(host, `rooms/${roomId}`)));
  } finally {
    await environment.cleanup();
  }
});
