# Design QA

## Comparison Target

### Source visual truth

- Launch: `design-qa-assets/reference-01-launch.png`
- Join: `design-qa-assets/reference-02-join.png`
- Host home: `design-qa-assets/reference-03-host.png`
- Bet: `design-qa-assets/reference-04-bet.png`
- Participants: `design-qa-assets/reference-05-participants.png`
- Ranking: `design-qa-assets/reference-06-ranking.png`
- Payout: `design-qa-assets/reference-07-results.png`

### Browser-rendered implementation

- Local URL: `http://127.0.0.1:5180/party-bet-arena/`
- Launch: `design-qa-assets/2026-07-09-final-01-launch.png`
- Join final: `design-qa-assets/2026-07-09-final-02-join.png`
- Host home: `design-qa-assets/2026-07-09-final-03-host.png`
- Bet final: `design-qa-assets/2026-07-09-final-04-bet.png`
- Participants: `design-qa-assets/2026-07-09-final-05-participants.png`
- Contestants: `design-qa-assets/2026-07-09-final-06-contestants.png`
- Ranking final: `design-qa-assets/2026-07-09-final-07-ranking.png`
- Payout: `design-qa-assets/2026-07-09-final-08-payouts.png`

## Viewport And State

- Primary viewport: 393 x 852 CSS pixels, light theme, host room with four bettors and four racers.
- Responsive viewport: 768 x 1024 CSS pixels, centered 430 px app frame.
- Additional state: dark theme checked on the basic-settings screen, then restored to light.
- Dynamic names, balances, odds, race number, and row counts intentionally use real local room data rather than copying the mock values.

## Full-View Comparison Evidence

- Launch: `design-qa-assets/compare-01-launch.png`
- Join final: `design-qa-assets/compare-02-join.png`
- Host: `design-qa-assets/compare-03-host.png`
- Bet final: `design-qa-assets/compare-04-bet.png`
- Participants: `design-qa-assets/compare-05-participants.png`
- Ranking final: `design-qa-assets/compare-06-ranking.png`
- Payout: `design-qa-assets/compare-07-results.png`

## Focused Region Evidence

- Bet amount controls and primary CTA were checked in `compare-bet-final.png`; the CTA is visible without overlap at 393 x 852.
- Ranking header and 2-1-3 podium were checked in `compare-ranking-final.png`; the title and all podium labels remain visible.
- Join inputs, QR action, primary CTA, and saved-room affordance were checked in `compare-join-final.png`.
- Payout five-column rows were checked in `compare-payout.png`; positive and negative deltas are fully visible.

## Findings

- No actionable P0, P1, or P2 differences remain.
- Typography: system/SF-compatible stack, zero letter spacing, weight hierarchy, truncation, and compact UI labels match the source intent. No current title truncation was observed.
- Spacing and layout: seven screens use the source hierarchy, white/yellow surfaces, compact rows, and mobile-first rhythm. The 393 px and 768 px checks have no horizontal overflow.
- Colors and tokens: light mode is white/charcoal/yellow; dark mode is black/charcoal/yellow. Semantic red, green, silver, gold, and bronze remain reserved for status and rank.
- Image and icon fidelity: the supplied yellow app icon remains the product asset. Interface commands use Lucide icons. User-configurable emoji avatars are an intentional product requirement rather than copied portrait photography.
- Copy and content: the standalone Japanese labels are coherent; IDs and join codes appear in join/settings contexts instead of following every screen.
- Accessibility: semantic buttons, labels, visible focus rings, reduced-motion support, and minimum stable control dimensions are present. The QR control has an unsupported-browser fallback.
- Legacy cleanup: obsolete theme variants, `uiMode`, `strengthRating`, old UI selectors, and unreachable legacy components were physically removed. Old saved-room extras are discarded during normalization.

## Comparison History

### Iteration 1

- [P2] Bet CTA fell below the initial mobile viewport because the proxy bar, racer rows, and ticket spacing were too tall.
  - Fix: reduced header, proxy, row, tab, ticket, amount-control, and quick-amount heights while preserving tap areas.
  - Post-fix evidence: `compare-bet-final.png`.
- [P2] Ranking title truncated beside balance and notification controls.
  - Fix: tightened only the ranking header mark, title, balance pill, and gaps.
  - Post-fix evidence: `compare-ranking-final.png`.
- [P2] Settled payout delta could clip in the dense five-column result row.
  - Fix: assigned stable responsive grid tracks for player, ticket, result, payout, and delta.
  - Post-fix evidence: `compare-payout.png`.

### Iteration 2

- [P2] The 768 px check reported internal frame overflow caused by invisible toggle inputs inheriting `width: 100%`.
  - Fix: constrained hidden checkbox inputs to 1 x 1 px.
  - Post-fix evidence: frame client width and scroll width both measured 428 px.
- [P2] The join mock's QR action was absent.
  - Fix: added the QR image picker and native barcode-detector path with a clear unsupported-browser fallback.
  - Post-fix evidence: `compare-join-final.png`.

## Primary Interactions Tested

- Open saved room and return to the launcher.
- Navigate host home, bet, settings, participants, payout, and ranking.
- Select a proxy bettor, choose racers, change bet type, adjust stake, and place bets.
- Enter complete finish order, settle payouts, and start the next-round flow.
- Verify one winning and one losing ticket with payout and delta.
- Toggle light/dark theme and restore light.
- Confirm mobile navigation and ranking/payout switching.
- Expand saved rooms and use the dedicated join flow.

## Console And Build Checks

- No browser errors were generated during the final July 11 verification. The browser log retains three historical Vite HMR entries from July 10 before the obsolete component removal; none recurred after reload or interaction.
- `npm run lint`: passed.
- Strict unused TypeScript check: passed.
- Production Vite build: passed after the final UI and QR changes. The later schema-only legacy-field cleanup passed both TypeScript checks; a redundant build rerun was blocked by the local Codex execution quota rather than an application error.
- `git diff --check`: passed (line-ending conversion notices only).
- Sensitive-pattern scan of `src`, `public`, and `.github`: zero matching files.

## Follow-up Polish

- [P3] The source launch mock has a subtle dotted decorative wave. It remains omitted because it is non-functional and no supplied production asset exists; adding a fabricated CSS/SVG substitute would reduce asset fidelity.

final result: passed
