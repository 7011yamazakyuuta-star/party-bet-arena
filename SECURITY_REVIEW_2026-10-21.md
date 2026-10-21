# Security review checkpoint — 2026-10-21

## State at pause

- Branch: `codex/security-hardening`; this branch contains the proposed code and Realtime Database rules. Production GitHub Pages and Firebase rules have not been changed.
- The currently published client uses legacy player and bet IDs. Deploying the new rules before the new client would reject its writes. Treat the client and rules as one coordinated release.
- No production room data was modified during this review. Do not copy real room IDs, invite codes, names, or UIDs into issues or test fixtures.

## Confirmed findings and changes

1. The repository's prior `firebase.rules.json` allowed any authenticated user to read and overwrite any room. The live Firebase Console had a stricter rule set, but still allowed participants to rewrite their own balances and bets. Proposed rules now limit room reads to hosts/members; only the host can change a whole room; participants can create one own player record and one own bet during betting.
2. Existing invitations used short, guessable IDs and four-digit codes. New rooms use Web Crypto for a 12-character ID and 16-character code. Invite credentials move to URL fragments and are removed from the address bar after import.
3. A participant-supplied multiplier could affect settlement. Settlement now recomputes it; invalid stakes and unknown selections are rejected. This remains a client-side game with a privileged host: it does not provide server-authoritative, tamper-proof settlement.
4. Added a Content Security Policy and no-referrer policy, input limits, Firebase emulator rule tests, and CI checks. No obvious direct HTML injection or code execution sink was found in the reviewed source, but this is not proof that a user's device cannot be compromised.
5. The old fixed host PIN was removed from new room data and normalized legacy rooms. Existing Firebase records may still contain it until those records are deleted or migrated.

## Verification performed

- `npm run build`: pass.
- `npm run test:security`: 3/3 pass.
- `npm run test:rules:emulator`: 1/1 pass, including denied unauthorized writes and allowed host updates/deletion.
- `npm audit --omit=dev --audit-level=high`: 0 known runtime dependency vulnerabilities at this check. A full dependency audit still reports 7 development dependency advisories (4 moderate, 3 high); review and update the tooling separately.
- GitHub Actions run `39564712421`: build job passed, including type check, security smoke, Realtime Database rules test, and build.
- Live browser end-to-end verification remains pending.

## Required before production release

1. Review the PR; test the built site with a fresh room in a browser, including create, join, own bet, host settlement, and logout/revisit behavior.
2. Decide whether to retire old rooms or migrate their player IDs, bet IDs, and short invite codes. Preserve needed data with a verified export/backup first. Do not paste production data into tests.
3. Publish the new client, verify it is serving, then publish the matching Firebase rules. Recheck all flows and roll back the release if any write is denied unexpectedly.
4. Configure an abuse strategy: Firebase App Check where supported, usage alerts/quotas, and a backup/restore plan. Anonymous Auth does not provide durable host identity or strong account recovery.
5. For meaningful money or adversarial play, move balance and result authority to a trusted server or Cloud Functions with authenticated host roles and an audit trail. Client-side rules cannot make a malicious host honest.

This checkpoint deliberately leaves production unchanged so the app remains usable during the pause.

## Continuation on 2026-10-21

- Browser E2E used only the local Firebase Authentication and Realtime Database emulators in separate browser contexts. Room creation, invalid-code rejection, valid join, own bet, host settlement, participant balance synchronization, and saved-room reopen worked.
- E2E exposed a data-integrity bug: empty live collections omitted by Realtime Database were replaced with demo players and demo bets. Normalization now keeps live collections empty; a fresh room showed `0 / 0`, then immediately showed the real member and bet as they arrived.
- Opening a saved room now binds the UI role to the current Firebase UID. A participant can no longer enter the host UI merely by choosing a saved room.
- Online full-room records are removed from `localStorage` after successful Firebase save or confirmed sync; invite codes are removed from saved-room summaries. Unconfirmed offline changes retain their local copy to avoid data loss. Anonymous Firebase Auth state still persists in the browser, so this reduces local residue but is not a sign-out feature.
- Rules now reject unknown fields and oversized member/player strings and bets; the emulator tests cover these cases.
- Replacing Firebase CLI 15.34.0 with the audit-suggested 14.23.0 increased advisories from 7 to 19 and introduced a Node 24 engine warning. The change was reverted. Runtime dependency audit remains at 0 known vulnerabilities; 7 dev dependency advisories remain.
- Production Pages, production Firebase rules, and production room data remain unchanged. Before release, perform the old-room migration/retirement and production browser verification described above.
