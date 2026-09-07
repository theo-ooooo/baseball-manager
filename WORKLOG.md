# Work log

## 2026-09-07 — Initial implementation session

Implemented React/TypeScript management screens, 13 leagues and 137 clubs, 1,812 real-name player records plus generated players, season simulation, tactics, negotiations and transfers, coaching and training, finances, and versioned D1 career persistence.

Initial history is grouped by implementation area: application foundation; league/player data; game engine; API/database; interface; verification/documentation. These groups belong to this session and do not represent invented earlier sessions.

Validation completed before the repository handoff:

- Production build succeeded.
- Four game invariant tests passed, covering every club, league scheduling, a complete season transition, and management transactions.
- All eight Node tests passed, including the SSR smoke test and UI primitive semantics. The SSR smoke test stubs only the Cloudflare module import; it does not verify D1 persistence.
- No browser verification or deployed persistence verification performed.
- Standalone TypeScript checking still requires generated Cloudflare runtime declarations for `cloudflare:workers`, `Fetcher`, and `D1Database`.

Known scope: common league rules; partial real rosters outside MLB/NPB; game-generated ratings/contracts; simplified pitching and postseason formats. See README for details.

GitHub owner verified as `theo-ooooo`. The user created the private repository `theo-ooooo/baseball-manager`; it is the authorized GitHub destination for this session and future session commits. Preserve coherent commits and verify the remote branch after each upload.

## 2026-09-07 — Vinext / NestJS / D1 implementation

User-selected architecture: Vinext frontend, NestJS backend, Cloudflare Workers and D1. Frontend screens moved to `apps/web`; NestJS controllers, services, repositories, domain simulation and seed tooling live under `apps/api`; shared contracts and read-only selectors live under `packages/shared`. Vinext forwards `/api/*` to the actual NestJS HTTP application through Cloudflare's Node HTTP bridge.

The original runtime JSON catalog and direct Vinext career API were removed. D1 now holds 13 leagues, 137 clubs, 4,362 players (1,812 real-name and 2,550 generated), 5 fictional agents and 20 coach candidates. Sixteen tables cover catalog data, career snapshots, players, contracts, staff, negotiations, standings, match archives, transfers, finance entries and command history. Seed files are migration input only. SQL writes commit together with optimistic concurrency guards; request IDs prevent successful commands from being charged twice.

Fixed renewal offers restoring stale player statistics after matches, and incomplete world-league schedules for odd club counts. Kept only five recent play-by-play logs in the hot snapshot while retaining full older logs in D1. The frontend can retrieve archived replays and displays the persisted finance ledger.

Validation completed:

- Production Vinext + NestJS Worker build succeeded.
- TypeScript `--noEmit` passed.
- All 14 tests passed together: 6 game invariant/regression tests, 4 actual Worker/D1 HTTP integration tests, 1 production SSR/assets test and 3 existing component-semantics tests.
- Integration tests load the complete production Worker, apply all three D1 migrations, and verify identity isolation, signing races, duplicate requests, contracts, transfers, coaches, ledger balances, a complete season, next-season contracts, archived replays and database catalog edits.
- Miniflare is isolated from external networking (`cf: false`, explicit outbound rejection). No Cloudflare API credentials or browser sessions are used by these tests.
- GitHub Actions now runs build/tests and typechecking on pushes and pull requests. A local passing run is not a claim that the remote workflow has run.
- No browser interaction, production load test or live persistence verification has been performed.

Hosting distinction: the current session has no verified connection to the user's personal Cloudflare account. The existing owner-private Sites project uses managed Cloudflare infrastructure. Publication is pending at this checkpoint; use the actual deployment response for the final site URL.

Known product limits from the initial session remain: partial real rosters outside MLB/NPB, shared simplified league rules, fictional player ratings/contracts and staff, simplified pitching, and no draft/posting/injury systems. See README for the precise supported scope.

## 2026-09-07 — Private test publication confirmed

The native Sites deployment completed successfully at https://dugout-world-manager.kkwondev.chatgpt.site. Access remains owner-private on managed Cloudflare infrastructure. Published application source: `016e04949ef6b8c5c7d1275171a98963ca291fe8`.

GitHub Actions independently completed build, all 14 tests and typechecking successfully: https://github.com/theo-ooooo/baseball-manager/actions/runs/34142177139. The publication record adds documentation only; it does not change the deployed application. No browser or live persistence verification is claimed.
