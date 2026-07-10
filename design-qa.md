# Design QA

Source visual truth:

- `design-qa-assets/reference-01-launch.png`
- `design-qa-assets/reference-02-join.png`
- `design-qa-assets/reference-03-host.png`
- `design-qa-assets/reference-04-bet.png`
- `design-qa-assets/reference-05-participants.png`
- `design-qa-assets/reference-06-ranking.png`
- `design-qa-assets/reference-07-results.png`

Implementation screenshots:

- `design-qa-assets/2026-07-09-final-01-launch.png`
- `design-qa-assets/2026-07-09-final-02-join.png`
- `design-qa-assets/2026-07-09-final-03-host.png`
- `design-qa-assets/2026-07-09-final-04-bet.png`
- `design-qa-assets/2026-07-09-final-05-participants.png`
- `design-qa-assets/2026-07-09-final-06-contestants.png`
- `design-qa-assets/2026-07-09-final-07-ranking.png`
- `design-qa-assets/2026-07-09-final-08-payouts.png`

Prototype URL:

- `http://127.0.0.1:5176/party-bet-arena/`

Checked viewport:

- Mobile portrait, `393 x 852`

## Scope

- Replace the old presentation with the new white/yellow Rank Party interface.
- Keep the app functional for Firebase-backed rooms, local fallback rooms, host flow, player betting, participant setup, contestant setup, ranking, and payout review.
- Hide room ID/code from every ordinary room screen; keep sharing details in settings/join contexts.
- Keep dark black/yellow styling reserved for dark mode only.

## Visual Checks

- Launch screen: passed. The entry screen now follows the supplied white/yellow card system, with create/join as the two primary choices and no old demo-heavy room view on first load.
- Join screen: passed. The room join form follows the supplied white card layout, including display name, room ID, join code, QR affordance, yellow CTA, and saved-room row.
- Host home: passed. The host room now focuses on current race progress, completed bets, result status, settlement status, and primary next actions.
- Bet screen: passed. The betting view now uses the supplied race header, bet-type segmented control, ticket/table presentation, selected-ticket summary, amount controls, payout estimate, and yellow CTA.
- Participant management: passed. Bettor and contestant settings use the supplied white card hierarchy, `+ 追加` rows, red delete actions, level controls, odds inputs, and save/cancel footer.
- Ranking: passed. Ranking and payout tabs use the supplied white/yellow segmented control, podium/list structure, empty state, and restrained accent color.
- Result/payout review: passed. The payout table uses the supplied result-summary structure, odds row, hit/miss status, payout/profit columns, and bottom action bar.

## Interaction Checks

- Main navigation: passed. Bottom navigation uses the new white floating bar and keeps active state restrained to the focused item.
- Legacy mode removal: passed. The previous UI mode choices were removed from types, storage validation, and visible controls.
- Old visible copy removal: passed. Searches for old launch/demo copy and old section labels returned no visible UI matches.
- Join-screen entry: passed. Opening the join route scrolls the phone frame to the top, so the header/back button are visible.
- Mobile width: passed. The app and phone frame reported `393px` scroll width at the checked viewport, with no horizontal overflow.

## Residual Notes

- Generated mockup status bars and device frames are reference-only; the app uses the browser/PWA shell rather than rendering a fake iPhone status bar.
- The populated race-result table was visually matched against the implemented result component and current empty/local states; a live Firebase room with settled bets is still useful for one final friend-facing smoke test.
- Local production build was blocked by the Windows sandbox `spawn EPERM` condition, and the escalation retry was not available due the current approval limit. TypeScript lint passed, and GitHub Actions should perform the production build after push.

final result: passed
