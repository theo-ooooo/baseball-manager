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

## 2026-09-08 — Football Manager interface revision

Replaced the large onboarding cards with a league/club database browser. Rebuilt the management shell with a fixed club sidebar, persistent game clock and continue control, compact section tabs, denser data tables, three-column club overview, selectable club reports and contract status. Applied graphite and muted violet styling throughout the roster, market, tactics, coaching and finance screens. Fixed archived match loading from the schedule and ensured compact standings include the managed club outside the leading positions.

Validation: production build, TypeScript check and actual Worker SSR/assets test passed. No browser visual verification has been performed.

Follow-up scope authorized during this session: four-week preseason with friendlies; optional first-season recruitment ban; saved custom tactics; position familiarity and draggable defensive assignments; a second-team system with promotions/demotions; missing real players including Lotte Jeon Min-jae; verified real coaches. These systems are not yet included in this interface checkpoint.

The user reports connecting Cloudflare. Discovery in this conversation still returns no callable Cloudflare account/deployment tools, and local Cloudflare authentication is absent. Continue implementation and prepare a safe direct-account deployment path; do not describe Sites deployment as personal-account deployment.

## 2026-09-08 — Preseason, squad development and catalog implementation

Implemented a 28-day preseason with four friendlies, separate official statistics and an opening-day stop. Added a server-enforced optional first-year external/FA recruitment ban that allows renewals, sales and coaches and expires in year two. Added first-team registration (28 players), reserve promotions/demotions, a separate three-day development schedule/statistics, generated academy depth, and coach-influenced development. Defensive slots are explicit, swappable and validated; position familiarity affects defensive strength and grows with training/appearances. Team instructions affect hitting, running and defense; named tactic books persist lineup, starter, defense and instructions. Existing career snapshots remain valid and can receive newly catalogued players without resetting their contracts or statistics.

KBO official first-team registration facts from https://www.koreabaseball.com/Player/RegisterAll.aspx (2026-09-07) cover 331 players and 96 coaches across ten teams. The merged catalog now contains 4,503 players (2,042 real-name, 2,461 generated) and 116 coach candidates (96 real, 20 generated). Lotte Jeon Min-jae is included. Same-name Samsung pitchers Lee Seung-hyun retain distinct jersey-based identities. Real coach names, registered clubs and coach status are factual; specialist assignments, skills and salaries are explicitly game settings. Players without verified age data carry an ageEstimated flag and use a clearly labelled game age. The source is not a complete first-/second-team ownership roster.

Two new generated Drizzle migrations add metadata columns and update catalog rows; previously applied migrations remain unchanged. Coach source metadata is also projected into career_staff; new player development fields are persisted in career_players JSON and complete tactics/reserve state in the atomic career snapshot.

Validation at this checkpoint: production build and typecheck passed; 11 engine tests and 5 actual Worker/D1 API tests passed, including preseason/official-stat separation, transfer restrictions, slot/bench swaps, reserve registration, named tactics and persisted real-coach metadata. Production SSR/assets test also passed. Interface controls are included in the following commit. No browser interaction or live persistence verification was performed. Personal Cloudflare account deployment remains unavailable in this conversation.

## 2026-09-08 — Management interface controls

Connected the FM-style workspace to the new server systems. Added preseason setup and countdown, first-year recruitment restriction notices, friendly schedules, reserve registration/development screens, individual position training, real-coach search and hiring, named tactic controls and four adjustable team instructions. The field now uses persisted defensive positions, supports desktop dragging and an equivalent two-click/keyboard interaction, bench replacements, selected-player feedback and familiarity labels. The dashboard reads the same defensive assignment. Existing careers receive an explicit catalog-update control. Removed the old automatic-only field and fictional-only staff screen.

The complete current source passed production build, TypeScript checking and all 20 tests: 11 engine regressions, 5 actual Worker/D1 API tests, production SSR/assets and 3 component-semantics tests. Browser visual/interaction QA was not performed. Current deployment target is the existing owner-private Sites test site on managed Cloudflare; personal-account migration has not been executed because account/deployment tools and local Cloudflare authentication are not exposed in this conversation.

## 2026-09-08 — Management release published

Owner-private Sites version 2 deployed successfully at https://dugout-world-manager.kkwondev.chatgpt.site, using application source `ecada565965c27044739bcdc97a9e8a1b2d3c614`. The package includes the two new D1 migrations. GitHub main was verified at the same application commit, and GitHub Actions completed successfully: https://github.com/theo-ooooo/baseball-manager/actions/runs/34179130029. This record changes documentation only.

Deployment remains in the existing Sites-managed Cloudflare environment. The user's personal Cloudflare account has not been used. Migration is possible after the destination account becomes accessible, with a D1 data export/import and verified replacement authentication; keep the existing database until the migrated career data and access controls have been checked. No browser interaction or production career mutation was performed as verification.

## 2026-09-08 — Stadium replay implementation

Replaced the score-table replay with a stadium-centered replay: overhead stadium artwork, animated pitch/ball path, runners and selected defensive players, a compact live scorebug, plate-appearance timeline, inning navigation, pause/play and playback speed. Older archives use the same stadium view but omit runner/defender identities that were never saved. New matches record every plate appearance with before/after outs, bases and score, actual lineups and defensive assignments. Ball trajectories and fielding motion illustrate the outcome rather than claim recorded tracking data. Match archives retain complete details; older hot-snapshot summaries strip replay rosters along with logs. No schema migration is needed for the JSON archive extension.

Validation: production build, typechecking and all 23 tests pass, including state continuity, old archives, caught stealing/home-run runner paths and actual Worker/D1 integration. Browser interaction was not requested and was not performed. Publication pending. Further requests queued: performance-based real-player ratings, calendar reports/morale/inbox decisions, selling-club consent and actual transfer offers, plus date-based real fixtures/series/rest days.

### KRW default and replay publication — 2026-09-08

- Replay commit `47713b7bb62ac032613ff719d193d5e0cea07580` was published successfully as Site version 3. Deployment `appgdep_6a9f7f52e318819196218ce681ce60f7` succeeded at the existing owner-private test URL.
- All money displays now use KRW (억 원 / 만 원); contract salary inputs and fee previews use 만 원. Legacy persisted currency units are retained and converted with the explicitly labelled fixed game rate USD 1 = KRW 1,400. This is not a current exchange-rate quote.
- TypeScript validation passed. Currency publication will accompany the next management update.

### Performance-derived real-player ratings — 2026-09-08

- Added 2025 official KBO, MLB and NPB counting-stat snapshots (3,398 batting/pitching records). The model is deterministic, removes real-player random attributes/name overrides, and regresses small samples toward the league's observed mean. Potential is an explicit age/performance estimate. Unobserved defense/speed use hidden neutral simulation values.
- 1,075 real players have at least 100 PA / 30 IP; 530 have provisional smaller samples; 437 remain visibly ungraded. Ambiguous identities are not assigned another player's stats. Example: Lotte Jeon Min-jae is linked to his own 369 PA, 95 hits, 5 HR 2025 season.
- D1 migrations add source/evaluation metadata and update catalog ratings. Read-time compatibility upgrades show corrected ratings immediately; the next mutation persists them with the existing revision gate. Contracts, ownership and game stats remain intact, and subsequent model refreshes retain recorded development deltas.
- Rating identity, missing-data handling and idempotent career upgrades passed targeted tests. TypeScript passed. Publication pending the management/date-calendar update.

### Calendar-based season progression — 2026-09-08

- D1 fixture catalog now contains 4,008 dated fixtures: MLB 2,430, NPB 858 and KBO 720. IDs are distinct and every club's scheduled count is verified (162 / 143 / 144). KBO deliberately uses the initial 675 planned fixtures, including originally scheduled rainout dates, plus one officially dated remaining matchup per pair; historical rain/weather cancellations are not reproduced. This limitation is visible in the calendar.
- One advance processes the scheduled games on the same date across leagues; rest dates advance recovery, training and wages without inventing a match. Doubleheaders have separate fixture IDs and the second game selects a recovered starter. Recent world results are kept in the career snapshot.
- Calendar UI defaults to all league games with month navigation, club filtering, home/away and dates. Generated leagues, short seasons and future years have series/travel/rest dates. Existing completed results are preserved, with remaining fixtures rescheduled.
- Calendar tests verify all official and generated club totals, legal identities, Monday rest and simultaneous KBO games; targeted engine tests also passed after updating the old expectation that every foreign league finishes on the home league's final date. Full production validation is scheduled after the remaining management update.

### Club decisions, inbox and automatic continue — 2026-09-08

- Added persistent read/unread inbox, date-driven opponent/weekly/contract reports, player morale and expected roles, playing-time concerns and manager responses. Two-week playing-time promises are tracked and fulfilled/broken promises affect morale; new concerns stop multi-day progression. These are explicitly fictional game-world emotions.
- Selling clubs now evaluate core/starter role, replacement depth, contract years, contention and season timing. Their refusal overrides an agent agreement and is rechecked at signing. In full 2026 careers the simplified game deadline is July 31 for KBO/NPB and August 3 for MLB; other/short careers close at 80% of the season. This is not full transfer/registration-rule parity.
- Outgoing sales require transfer listing, interested buyer and an unexpired seven-day offer. Forged/expired/reused offers cannot transfer a player or create money.
- Continue skips idle dates until the next match, phase transition, player concern or buyer offer, while processing each day's wages, recovery and world fixtures. The separate seven-day action remains available.
- TypeScript, production build, and all 32 tests passed, including the actual NestJS Worker with migrated D1, atomic accounting, archive retrieval and production HTML/assets. No browser interaction or visual QA was performed because it was not requested.
- Further user additions queued: official team logos (52 major-league assets verified so far), hidden potential with a new-career option, dedicated player pages, detailed attributes and role-aware lineup recommendations.

## 2026-09-08 — 사용자 요청으로 개발 중단, Codex 인계

- 운영 852348dc7939c9b2b3106eb0530e5086ffc8bdf3의 Sites 배포 성공 확인. 이후 미완성 변경은 미배포.
- 사용자가 남은 작업을 취소하고 Codex 이관을 요청했다. 추가 개발·수정·배포를 중단했다.
- `codex/handoff-2026-09-08`에 투수 보직, 타석 단위 경기 진행, 2D 구장, 잠재력 마스킹, 상세 능력/타순 추천의 WIP를 보존한다. 선수 페이지·DB v2 migration·팀 로고 통합은 미완료.
- 최신 WIP 타입 검사 통과. 초기 경기/투수 단위 테스트 5개 통과 후 추가 변경이 있었으며 최신 전체 테스트/빌드/브라우저 검증은 미실행.
- `CODEX_HANDOFF.md`에 배포 기준, 변경 파일, 미완료 부분, 알려진 위험, 실행·DB·배포·인증 이전 방법을 기록했다.
- 공식 구단 로고 52개와 추가 2025 성적 자료/수집 스크립트는 `handoff/research-assets.zip`에 보존. 개인정보/credential/운영 세이브/의존성/빌드 산출물은 포함하지 않는다.

## 2026-09-08 — Codex: forward performance migration

- Checked out the authorized `codex/handoff-2026-09-08` branch and resumed the six unfinished feature areas.
- Added `0009_performance_2025_v2`, updating only catalog ratings/evidence and catalog version. Migrations 0000–0008 remain byte-identical; career snapshots, contracts, ownership, match archives and finance are not migration targets.
- Replaced the old overwrite generator with append-only migration tooling that refuses an existing migration name. Added an offline, portable reconstruction of the archived official 2025 performance data.
- Validation: archived source reconstruction matches all committed evidence records; SQLite upgrade regression preserves preexisting career/contract/archive rows byte-for-byte; rating identity and career upgrade regressions pass. Full Worker validation follows the remaining implementation. No production database change or publication performed.

## 2026-09-08 — Codex: portable build and formatting tools

- The checked-out project now builds on macOS as well as Linux: the build timeout uses a bounded Node child process instead of GNU timeout. Project-local caches/logs remain isolated without repurposing the user's HOME.
- Added pinned Prettier tooling and format/check commands for authored application code, excluding historical migrations, seed snapshots and vendored components. A separate source-formatting commit will follow feature fixes, per the user's readability request.
- Validation: production NestJS/Vinext Worker build succeeds on Node 24/macOS; typecheck succeeds after API bundle generation. The baseline whole-suite run exposed a WIP pitcher home-run/stat invariant failure, being fixed in the pitching unit. Publication has not been requested in this continuation; production remains unchanged.

## 2026-09-08 — Codex: durable live games and pitching decisions

- Live PA commands now update only the career snapshot and revision/request log; they do not rewrite player, contract, staff, negotiation, standing or financial projections. Completion still commits results, archives and all accounting atomically.
- Frozen opponent inputs remain server-only, and catalog upgrades wait while a match is active. Potential is masked in roster, transferred-player, negotiation, catalog and conflict responses; hidden values remain intact in D1. New-career replacement is blocked during a live match.
- Manual/legacy starters survive reads and rest dates. Saved tactics include pitching plans; role changes and reserve moves repair the plan. Watched doubleheaders stop between games, rotate the starter and apply daily wages/recovery only after the second game.
- Separated pitcher home runs allowed from batting home runs. Wins, saves and holds use separate decisions, including the five-inning starter threshold and win/save exclusion. Short-start winner selection uses a documented game effectiveness heuristic; full official scorer discretion and earned-run rules remain simplified.
- Preserved the last PA scene across finalization so its completed animation is not restarted.
- Validation: seven actual production Worker/D1 API tests passed, including PA reload, concurrent revisions, duplicate requests, zero projection writes during PA steps, deferred accounting, archive ownership and potential masking. Live engine regressions cover preseason, saved plans, postseason and doubleheaders; dedicated pitching decision regressions pass. No production DB mutation, deployment, load test or browser interaction performed.

## 2026-09-08 — Codex: dedicated player profiles

- Replaced PlayerModal with `/players/[id]` routes and URL-addressed management sections. Player entry points, direct access, return links and missing-player states use the same persisted career. Contract offers stay on the page and link to final signing.
- Added separate profile, official/game-stat and contract sections, observed detailed attributes with missing-data labels, game morale, position familiarity, pitcher-role links and first/reserve registration. Potential visibility applies to the entire profile, including pitchers. Fixed market memo dependencies so catalog and ownership changes refresh listings.
- Validation: TypeScript and production build pass; real Worker SSR serves direct player/section routes; rendered React profile tests confirm the independent page, missing-attribute labels and hidden/revealed potential. These checks do not claim browser navigation or visual QA. No deployment performed.

## 2026-09-08 — Codex: readable modules and clean checks

- Split the monolithic game screen into setup, sidebar, overview, squad, player-table, world, market, agent, finance and help modules with shared display primitives. Split server PA simulation and live-match commands out of the season/management engine. No browser mutation logic was introduced.
- Expanded authored TypeScript, JSX, CSS and tests using the pinned formatter. Removed unused imports/state, replaced effect-driven tactic drafts with keyed drafts, and moved media preferences to an external-store hook. Animation callbacks update after commit; PA completion is derived from the completed log count.
- Lint now excludes generated bundles/caches. The handoff branch's GitHub workflow runs format, lint, production tests and typecheck.
- Validation: production build, all 43 tests, TypeScript, ESLint (zero warnings/errors) and format check pass. Earlier feature-level test results remain applicable; no browser interaction or production publication is claimed.

## 2026-09-08 — Codex: official club marks in D1 and the interface

- Added 134 verified original club marks with source pages, source URLs, SHA-256 hashes and rights notes. The 52 inherited KBO/MLB/NPB assets and 82 additional official assets retain their original bytes. Collecchio, Neptunus and Tucson sources could not be retrieved/verified; their badges use labelled club abbreviations.
- Added forward-only migrations 0010 (nullable club logo metadata) and 0011 (catalog assets/version v7). Runtime badge metadata comes from D1, and static image files are packaged with the Worker. A shared badge component covers setup, sidebar, club overview, standings, schedules, match scorebugs and player profiles, with an image-error fallback.
- Validation: production build, Worker responses and exact hashes/MIME types for all 134 packaged assets, migrated D1 catalog provenance, legacy career byte preservation, and rendered React profile/logo/fallback tests pass. The component harness now resolves the actual Vinext image shim used in production. All images were visually inspected as contact sheets; no browser interaction or production publication performed. Official sources establish provenance, not reuse permission.

## 2026-09-08 — Codex: retain setup holds after a later blown lead

- Final rule review found that a team's eventual loss/draw discarded eligible earlier setup holds. Compute holds independently of final win/save awards, following the [MLB hold definition](https://www.mlb.com/glossary/standard-stats/hold).
- Validation: all eight targeted pitching/live-game tests pass, including the new late blown-lead regression. Inning-boundary changes and simplified scorer discretion remain the documented simulation scope.

## 2026-09-08 — Codex: preserve fractional development during rating upgrades

- A new explicit v1-to-v2 regression exposed rounding of accumulated training growth during catalog refresh. Preserve fractional growth when applying the new base rating; initial catalog grades remain rounded.
- Validation: four rating tests pass, covering roster, pending offer and sold-player upgrades; preserved contracts, match statistics, budget and transfer ownership; repeated upgrade idempotence; missing measurements versus generated attributes; and distinct leadoff/cleanup strengths in legal lineups. Full-suite validation follows below.

## 2026-09-08 — Codex: enforce a clean client boundary and lint gate

- Final lint review caught the schedule module's client directive below a newly added import. Restored the directive to the first statement and made lint warnings fail the local/CI check.
- The prior full build and 47 tests passed, including GitHub Actions on `7312295`; validation of the final directive change follows below.

## 2026-09-08 — Codex: final continuation validation and handoff

- Completed the requested implementation on `codex/handoff-2026-09-08` in separate rating migration, build tooling, live match/pitching, player profile, readability, logo and regression-fix commits. Updated README and the handoff's current-status section while preserving the original checkpoint history.
- Final application source `04ef3c1`: production NestJS/Vinext Worker build, all 47 tests, TypeScript, ESLint with zero warnings allowed, and Prettier checks pass locally. Archived official evidence reconstructs all 3,398 committed records. Actual Worker tests cover D1 migration, identity, concurrency, accounting, live PA persistence/reload/completion, SSR and all 134 logo asset responses/hashes.
- GitHub Actions on `7312295` independently passed all checks: https://github.com/theo-ooooo/baseball-manager/actions/runs/34189810224. The final client-directive/strict-lint commit and this documentation update run the same workflow; check their exact head results before publication.
- Confirmed byte-identical historical migrations/snapshots 0000–0008 and unchanged `.openai/hosting.json`. Upgrade regressions preserve existing career JSON/relational rows, and read-time model refresh preserves contracts, ownership, season stats and fractional development. No operating career data was downloaded, replaced or committed.
- Remaining validation/publication scope: browser interaction, mobile visual/accessibility QA, production load and production persistence have not been tested. The three unavailable official logos use abbreviations; league/scorer/contract simplifications remain documented in README. No Site deployment, personal Cloudflare migration or production D1 migration was performed. GitHub push alone does not publish the existing Sites-managed Cloudflare application.

## 2026-09-08 — Git identity correction and deployment trigger check

- Set repository-local Git identity to `theo-ooooo <kkw.theo@gmail.com>` at the user's request. Rewrote the author and committer of the ten continuation commits after `90c631c`; preserved every commit's tree, message and timestamps. Earlier history remains unchanged. The previous final head `f817027` maps to `9309bce`; hashes in earlier validation entries describe their original checked heads.
- Validation: the rewritten application tree is identical to the previously tested source. No application tests rerun for this metadata-only correction. Remote replacement uses an explicit force-with-lease against the last verified branch head.
- Checked the live GitHub workflow inventory, repository webhooks, recent deployments and main checks. Only the validation workflow is configured; no deployment workflow, repository webhook or GitHub deployment record was returned. Merging to main runs validation and does not publish the existing Sites-managed Cloudflare site.

## 2026-09-08 — Single web workspace and application-owned directories

- Consolidated all frontend routes, features, UI primitives, hooks, styles, static assets and Vite configuration under `apps/web`; removed root frontend entrypoints. Added npm workspaces with application-owned runtime dependencies and `@dugout/shared/*` exports.
- Grouped web features by career, players, squad, clubs, matches, schedule, market and finance. Moved schema/migrations under `apps/api`, and Worker/Sites infrastructure under `infra`. The existing Sites identity remains intact; build staging still supplies root `dist` for Worker tests and Sites packaging.
- Validation: relocated production build, TypeScript, zero-warning lint and all 47 tests pass. Existing migration SQL/snapshots and official asset bytes are preserved; no career data was modified. Personal Cloudflare account access is now verified, and a separate empty target D1 was provisioned for the requested migration. Authentication, data transfer and automatic deployment follow in separate units.

## 2026-09-08 — Remove unused starter code

- Removed the unused D1 notes example, its unused Drizzle helper, unused Sites auth helper, 46 unreachable starter UI components, three placeholder SVGs and the replaced stadium raster. Removed the old starter-chart-only test alongside that unused component.
- Removed empty root directories left by the web/API/infrastructure moves. Kept the 15 UI primitives reached by the application and their dependencies. Typecheck and lint verify the remaining imports; the full build and gameplay tests continue with the authentication/deployment unit.

## 2026-09-08 — Keep only used dependencies and place vendor styles with the web app

- Moved third-party CSS and its license into `apps/web/styles/vendor`; preserved the original files and excluded them from authored-code formatting. Removed 13 unused frontend dependencies left behind by the deleted starter components.
- Kept `packages/shared` for real cross-application contracts and pure calculations, and `scripts` for active build/data/deployment tools. Cloudflare generated declarations are being moved under infrastructure with the following authentication/build unit.
- Validation: production build and 48 tests, TypeScript, format and zero-warning lint pass with the relocated CSS and reduced dependency manifest. No database change.

## 2026-09-08 — Preserve career rows during the Cloudflare transfer

- Added raw owner-scoped backup and schema-checked import for all ten career tables. Imports bind large values, change only `user_id`, refuse existing targets and conflicting historical IDs, and write one atomic D1 batch. Read-back comparisons verify every preserved value and row count.
- Validation: six isolated D1 tests pass for a 600 KB snapshot, all tables, original/other-user preservation, competing imports, duplicate historical IDs, failed-constraint rollback, unknown fields, mixed ownership and schema drift. No production career has been changed.

## 2026-09-08 — Guest saves and separate NestJS controllers

- Per user decision, the public Worker uses browser guest saves without Cloudflare Access. A random 256-bit HttpOnly/Secure host cookie identifies each guest by its hash; caller-supplied identity headers are discarded and cross-origin mutations are rejected. `/saves` provides the private recovery key and opens a saved career without replacing either career.
- Replaced AppController with health, catalog, career, career-transfer and session controllers. All API endpoints, including guest recovery, now live in NestJS. Worker code handles authentication and routing; game commands remain in backend services/domain.
- Added expiring, owner-fixed transfer credentials restricted to the export/import endpoints. Only authorized imports can exceed the normal 12 KB API request limit. Generated Worker declarations now live in ignored `infra/cloudflare/.build`; removed the root types directory. The pinned runtime and deployment use their verified supported compatibility date, 2026-05-22.
- Validation: production build, TypeScript and zero-warning lint pass. Three actual Worker authentication/transfer tests and six importer tests pass, including a 600 KB transfer through NestJS, cookie isolation/recovery, forged headers, cross-site changes, owner scoping and overwrite refusal. The subsequent UI unit will rerun the full suite. Browser smoke has created a separate local guest career successfully; no production data change yet.

## 2026-09-08 — Cloudflare automatic deployment workflow

- Added deployment after successful main validation, using the exact tested Worker artifact. Feature branch/PR runs only validate; production jobs serialize and skip an older main commit. The deployment records a D1 Time Travel bookmark, applies forward migrations, publishes the Worker and verifies the live catalog health response.
- Verified the personal Cloudflare account and target D1, and verified GitHub contains the scoped Cloudflare API secret and account variable. Worker upload dry-run passes with the guest provider, correct D1 binding, assets and Images binding. Actual deployment and career transfer follow final UI/browser validation; no Zero Trust plan was activated.

## 2026-09-08 — Restore automatic position training

- Browser play-through found that choosing an individual training position could never return to automatic training. Enabled the automatic option and added a backend command to clear the override while preserving familiarity and statistics.
- The actual Worker/D1 regression verifies persisted removal, unchanged accumulated training and season stats. All 55 tests pass, with production build, TypeScript, format and zero-warning lint.

## 2026-09-08 — Simpler setup, management overview and browser-tested controls

- Replaced the dense three-column setup with club selection then manager/season settings; removed the real-name default, retained every league/club and rule option, and kept the selected club and next action visible. The home view now shows three key metrics, the actual next schedule/action, items needing attention and three recent results. Detailed lineups, standings and inbox reading remain in their own screens.
- Removed duplicate navigation, grouped secondary sidebar menus, added mobile close/open labels, adopted navy/teal surfaces and clearer spacing, and added a summary/detail toggle for the squad table. Failed saves are now visible instead of reverting to a misleading saved label.
- Added manual one-PA progression and persisted playback speed. Reopening an active match shows its last saved scene immediately; the completed play button says the match has ended. The normal command/revision and backend rules remain unchanged.
- Browser checks on the real production Worker: new guest career, rest-day progression, full friendly, pause/reload/resume, exactly one manual PA, persisted 8x speed, player search/direct profile/reload, reserve move, and guest recovery after cookie removal. Desktop 1440px and mobile 390px setup/home/squad were inspected; home and squad have no page-wide horizontal overflow. Production load and exhaustive accessibility/league parity are not claimed.
- Validation: all 55 production/domain/D1/component tests, TypeScript, zero-warning lint and format checks pass. Final build repeats after the last accessibility labels/semantics. No production career changed yet.

## 2026-09-08 — Initialize a usable local guest environment

- `npm run dev` now applies append-only migrations to the Vite plugin's isolated local D1 before starting. It uses the same placeholder binding and persistence directory and never targets the remote database. Generated local configuration remains under ignored infrastructure build output.
- Verified local development serves the v7 D1 health response and browser setup. Large authorized imports retain a conflict response for duplicate historic IDs. The local Wrangler OAuth currently fails personal D1 authentication; the connected Cloudflare API still verifies the target database as empty, and GitHub's separate scoped deployment token is registered. Remote migrations will run through the main deployment workflow.

## 2026-09-08 — Limit unmasked backups to migration credentials

- Final public-route review restricted raw backup exports to the expiring migration credential. Ordinary guest API calls cannot use this route to reveal hidden potential or server-only simulation inputs. Recovery keys still reopen the saved career through the normal masked API.
- The original owner backup was already verified and retained outside Git; the original Site's temporary environment values were removed and revision 2 was deployed successfully. Its database is preserved.

## 2026-09-08 — Bullpen groups in the squad, player profile and actual matches

- Added setup (필승조) and chase (추격조) subsets to the existing bullpen plan, retaining rotation, closer, selected starter and saved bullpen order. Missing groups upgrade on read without a database write; explicitly empty groups stay empty. Role commands, reserve moves, manual starter selection and saved tactics keep the groups exclusive. No schema reset or SQL rewrite is needed.
- The simulator prioritizes setup pitchers from inning 6 in ties or leads of 1–3, chase pitchers when trailing, general relief for early changes/large leads, and the closer from inning 9 with a 1–3 lead. It skips used pitchers and prefers rested alternatives. Existing live matches retain the previous algorithm; a captured deterministic full-result hash verifies unchanged resumption across this update.
- New careers now choose their initial starter from the recommended rotation instead of forcing the highest-overall pitcher into it. Existing manager selections are preserved. Removed the remaining real-name manager fallback.
- Split the long tactics page into lineup/defense, pitcher management and saved-tactic tabs, with a direct pitcher-panel URL. Added five role groups and selectors, rotation controls, squad filters/counts, and visible role badges in desktop/mobile tables and player profiles. Browser changes to setup/chase persist after reload; the pitcher profile also displays the existing detailed abilities with missing measurements labelled.
- Validation: the current session tree passes all 63 tests, production build, TypeScript, zero-warning lint and format. Tests cover legacy D1 read preservation, persisted role changes, manual starters, saved tactics, reserve eligibility, fatigue/used-pitcher fallbacks, actual live-game substitutions and legacy replay identity. Browser checks cover role change/reload, profile change/reload, role filters/counts, 390px badges and the dedicated tactics tab at 390px/1440px without page overflow. No public career was advanced for testing.

## 2026-09-08 — Keep the local API working across module reloads

- Browser QA reproduced a duplicate-listen error after Vite re-evaluated the NestJS bundle. Bootstrap now obtains an isolated Workers HTTP routing key and its own bridge; Vite disposal closes the replaced Nest application.
- Rebuilt the API while the development server and a guest career remained open, then verified health, the same revision/manager/day and the tactics page without restarting the server. The combined production bundle passes the 63-test suite and TypeScript/lint/format checks above.

## 2026-09-08 — First public Cloudflare release and verified career transfer

- GitHub PR #1 was merged at main `1714297`. Its automatic test and production jobs both succeeded (Actions run `34196591204`), applying all 12 migrations and publishing `https://baseball-manager.kkwondev.workers.dev` on the verified personal Cloudflare account. Live health reports Vinext/NestJS/D1 and catalog v7.
- Downloaded a raw owner-scoped backup from the existing private Site, stored it and the new guest recovery key with private filesystem permissions outside Git, and imported into the separately provisioned D1. The importer compared every value in all ten tables after changing only the owner ID: 1 career, 42 players, 42 contracts, 5 staff, 137 standings, 5 archived matches, 18 finance entries and 28 action records; negotiations and transfers were empty.
- Independently opened the new guest career through the normal API and verified revision 42, budget, date, year, club, complete history, lineup, selected starter, player stats and contracts against the original backup. The source database remains intact. Temporary transfer values were removed from both environments; the public Worker's secret list is empty. Backup/recovery values are not in Git.
- The private Site's source `ac74a36` (version 6) deployed successfully with the raw-export restriction and environment revision 2. Pitcher-group and development follow-up changes use the same validated automatic main release workflow; the first successful main deployment above predates those follow-up changes.

## 2026-09-08 — 한글 작업 지침과 최종 배포 검증

- 사용자 요청에 따라 앞으로의 커밋 메시지와 PR 제목·설명은 한글로 작성하도록 AGENTS.md에 기록했다. 열려 있는 PR #2의 제목·설명도 한글로 바꿨다.
- 투수 보직 후속 소스 `ed56e16`의 GitHub 브랜치 검증(run `34198942712`)이 성공했다. 최종 운영 번들에서도 별도 테스트 게스트의 첫 선발은 박세웅, 마무리는 김원중으로 분리되고, 필승조 2명·추격조 4명이 표시되는 것을 확인했다. 기존 커리어의 선택은 그대로 보존한다.
- 후속 Sites 버전 7을 검증된 소스·아카이브로 저장하고 기존 소유자 전용 범위에 배포를 시작했다. 공개 Worker는 PR 검증 통과 후 main 병합으로 자동배포한다. 인증·D1 이전은 완료되어 추가적인 계정 설정이나 데이터 이전 차단 요인은 없다. 배포 결과는 각 배포 상태와 GitHub Actions 기록으로 확인한다.

## 2026-09-08 — 투수 보직 운영 배포 확인

- PR #2가 main `3104fc2`에 병합됐고 자동 검증·Cloudflare 배포(run `34199197135`)가 모두 성공했다. 공개 API에서 catalog v7과 기존 커리어 revision 42, 필승조·추격조 배열을 확인했다. 기존 선발·타순·예산·날짜·경기 기록은 보존됐다.
- 원본 소유자 전용 Sites 버전 7도 배포 `appgdep_6a9fb838406081918ce0c7f863b42d4e`가 성공했다. 기존 프로젝트 identity, 비공개 접근 범위와 환경 revision 2를 유지했다.

## 2026-09-08 — 밝은 테마와 화면별 글자 대비 개선

- 사용자 추천안 선택에 따라 회색 배경·흰색 카드·진한 남색 글자·파란 동작 버튼으로 전환했다. 겹쳐 있던 전역 팔레트를 `globals.css`의 공통 변수로 정리하고 관리 화면·입력·상태 배지·알림·경기 창에 연결했다. 메뉴와 구장 점수판에는 어두운 배경용 밝은 글자를 명시했다.
- 개발 브라우저에서 주요 14개 화면의 직접 텍스트 2,341개를 검사했고, 설정 2단계·선수 상세/성적·도움말·투수 운용·모바일 선수단과 실제 타석 진행 화면도 확인했다. 마지막 경기 점수판 수정 후 해당 화면의 텍스트 대비 위반이 검출되지 않았다. 이 검사는 SVG·이미지를 포함한 전체 접근성 인증이 아니며, 구장과 390px/1440px 화면은 별도로 눈으로 확인했다.
- 모바일 설정·선수단·선수 상세·투수 운용·경기 창에서 페이지 전체 가로 넘침이 없고, 별도 로컬 게스트로 타석 진행과 경기 창을 확인했다. 운영 커리어를 진행하거나 데이터를 초기화하지 않았다. 테마 변경에는 DB 마이그레이션이 필요하지 않다.
- 최종 운영 빌드와 63개 테스트, TypeScript, 경고 없는 lint, 포맷 검증이 통과했다. 배포는 검증된 소스를 한글 PR로 main에 연결하고 자동배포 결과를 확인하며, 기존 비공개 Site에도 별도 버전을 발행한다. 계정·이전 차단 요인은 없다.

## 2026-09-08 — 밝은 테마 배포와 기존 저장 최종 확인

- 한글 PR #3을 main `38b887e`에 병합했다. GitHub Actions run `34201720702`의 검증·자동배포 작업이 모두 성공했고, 공개 주소 `https://baseball-manager.kkwondev.workers.dev`에서 밝은 배경과 13개 리그, 브라우저 오류 없음, 설정 화면의 텍스트 대비 검사를 확인했다.
- 배포 후 기존 커리어의 revision 42, 선수 42명, 경기 기록 5개, 예산·날짜·구단·타순·선발·선수별 성적과 계약을 비공개 원본 백업과 다시 비교했다. 모두 유지됐으며 일반 게스트의 원본 export 요청은 401로 차단된다. 원본 DB, 비공개 백업과 복구 키는 계속 보존한다.
- 같은 구현 소스 `1ec3279`의 Sites 버전 8도 배포 `appgdep_6a9fbedd6e04819190fa630a1772efd9`가 성공했다. `https://dugout-world-manager.kkwondev.chatgpt.site`의 소유자 전용 범위와 환경 revision 2를 유지했다. 현재 발행 차단 요인은 없다.
- 이 기록 추가는 문서만 변경하며 위 운영 검증 대상 구현은 그대로다. 전체 접근성 인증·운영 부하와 모든 리그 규칙의 완전 재현은 검증 범위에 포함하지 않는다.

## 2026-09-08 — 배경 그라데이션 제거

- 사용자 피드백에 따라 설정·관리 화면 바탕, 다음 경기 카드, 이적 시장 안내 등 6곳의 그라데이션을 제거하고 기존 공통 단색으로 바꿨다. 그라데이션 없는 화면 선호를 인수인계에 기록했다.
- 운영 빌드와 변경 CSS 포맷 검증이 통과했다. 실제 로컬 브라우저의 설정·홈·시장 화면에서 계산된 배경에 그라데이션이 없음을 확인했고, 홈의 1440px/390px 화면을 직접 확인했다. 모바일 가로 넘침과 브라우저 오류는 없었다. CSS 변경으로 DB·경기 규칙은 바뀌지 않는다.
- 한글 PR과 기존 main 자동배포, 소유자 전용 Sites 발행 절차로 반영한다. 새 배포 차단 요인은 없다.

## 2026-09-08 — 단색 배경 운영 반영

- PR #4를 main `8350163`에 병합했고 자동배포 run `34202659872`가 성공했다. 공개 설정 화면에서 계산된 배경의 그라데이션이 0개임을 확인했다. 소유자 전용 Sites 버전 9도 배포 `appgdep_6a9fc1858e4481919fbf7120231cab14`가 성공했다.

## 2026-09-08 — 정원이 찬 1군과 2군의 동시 교체

- 기존 squad 명령에 반대 선수단의 교체 선수 ID를 추가했다. 두 선수를 함께 검증하고 한 revision/D1 저장으로 교체하므로 28명 정원이나 마지막 포수 등의 최소 인원 때문에 선수 두 명을 따로 이동할 필요가 없다. 잘못된 대상은 양쪽 선수 변경 없이 거부한다.
- 기존의 이동 후 전체 타순 자동 재편성을 제거했다. 교체하지 않은 타순·수비 위치·투수 보직을 유지하고, 같은 종류의 선수 교체는 기존 자리와 투수 보직을 이어받는다. 선수별 1군·2군 성적·계약·컨디션과 예산·경기 기록은 유지한다. DB 마이그레이션은 없다.
- 등록 화면을 독립 컴포넌트로 분리해 1군/2군 명단을 나란히 보여주고 검색·포지션 필터·바로 이동·교체 선택을 제공했다. 선수단 표와 상세 페이지에도 같은 교체 흐름을 연결했다. 2군 훈련·기록은 별도 탭에 유지했다.
- 운영 빌드, 67개 테스트, TypeScript, lint와 포맷이 통과했다. 정원 상태·타순/수비/보직 보존·마지막 포수 교체·잘못된 대상 거부·D1 양쪽 행/재요청 검증을 포함한다. 로컬 브라우저에서 28명 상태의 실제 교체와 새로고침 후 양쪽 소속을 확인했고 390px 페이지 가로 넘침이 없었다. 전체 화면 재설계는 같은 세션의 후속 단위로 진행한다.

## 2026-09-08 — 구단 화면 전체 구성 재설계

- 흰색 메뉴와 카드, 중립적인 단색 바탕으로 정리하고 메뉴를 내 구단·선수단·시즌 운영으로 나눠 바로 접근하도록 바꿨다. 타 화면에 반복되던 프리시즌 안내는 전술 화면에만 남기고 제목·표·입력·카드 간격을 통일했다. 어두운 구장 점수판은 별도 글자색을 유지한다.
- 홈을 독립 dashboard 컴포넌트와 CSS로 분리했다. 구단 현황은 작은 요약 줄로, 다가오는 실제 경기·예정 선발·진행 버튼은 중심 영역으로 배치한다. 처리할 일이 있는 항목만 보여주며 1군·2군 교체 바로가기, 리그 현황, 최근 경기와 다시보기를 함께 제공한다. 이전 홈 전용 CSS와 더 이상 쓰이지 않는 선택자를 제거했다.
- 모바일 등록 화면은 1군·2군 명단을 즉시 전환하고 같은 교체창을 사용한다. 데스크톱은 두 명단을 나란히 보여준다. 모바일에서 반대 방향 교체를 실행한 뒤 새로고침하여 정원 28명, 양쪽 소속과 revision 증가를 확인했다.
- 최종 운영 빌드, 67개 테스트, TypeScript, lint, 포맷 통과. 모바일 주요 14개 화면, 설정, 교체창, 진행 경기의 텍스트 대비 검사에서 위반이 검출되지 않았고 390px 가로 넘침이 없었다. 최종 운영 번들에서도 별도 로컬 게스트 생성·새 홈 로딩·글자 대비·브라우저 오류 없음을 확인했다. 전체 접근성 인증과 운영 부하 검증을 의미하지 않는다. 기존 커리어와 DB 스키마는 유지하며 운영 발행은 후속 배포 확인으로 마무리한다.

## 2026-09-08 — 교체창의 동시 변경 처리

- 교체창을 열었을 때의 승격·말소 방향을 유지한다. 다른 화면에서 같은 선수를 먼저 교체해 revision 충돌로 최신 상태가 들어와도, 열려 있던 교체창이 반대 방향의 교체로 바뀌지 않는다. 현재 상태를 확인하라는 이유를 표시하고 재선택 전 확정을 막는다.
- 실제 로컬 브라우저에서 교체창을 연 뒤 별도 요청으로 같은 교체를 먼저 저장하고, 이전 revision으로 확인 버튼을 눌렀다. 최신 revision 4와 선수 소속은 유지되고 반대 교체 없이 버튼이 비활성화됨을 확인했다. 후속 운영 빌드·TypeScript·lint·변경 파일 포맷이 통과했다. 경기·DB 변경은 없고 기존 67개 회귀 검증은 후속 GitHub 검증에서도 실행된다.

## 2026-09-08 — 새 화면과 등록 교체 운영 배포 완료

- 최종 구현 `af3aff9`의 브랜치·PR 검증이 통과했고, 한글 PR #5를 main `633d3ca`에 병합했다. GitHub Actions run `34206084155`에서 67개 테스트를 포함한 검증과 Cloudflare 자동배포가 모두 성공했다.
- 공개 주소 `https://baseball-manager.kkwondev.workers.dev`에서 새 단색 바탕, 13개 리그, 그라데이션 0개, 페이지 가로 넘침과 브라우저 오류 없음을 확인했다. 기존 커리어를 읽기 전용으로 원본 백업과 비교해 revision 42, 선수 42명, 경기 기록 5개, 예산·날짜·구단·타순·선발·선수별 성적과 계약이 보존됐음을 확인했다. 운영 커리어를 진행하거나 초기화하지 않았다.
- 동일한 최종 구현의 Sites 버전 11도 배포 `appgdep_6a9fcadd19588191884f76e1db4d6771`이 성공했다. 기존 프로젝트와 소유자 전용 접근 범위, 환경 revision 2를 유지했다. 현재 발행 차단 요인은 없다.
- 이 후속 커밋은 배포 확인 기록만 추가한다. 전체 접근성 인증, 운영 부하와 모든 리그 규칙의 완전 재현은 이번 검증 범위에 포함하지 않는다.

## 2026-09-08 — 하루씩 넘어가는 진행 달력과 리포트 정지

- 상단에 7일 가로 달력(모바일 3일)을 표시하고 실제 서버 저장 날짜에 맞춰 이동한다. 하루 단위 요청은 revision/requestId 검증 아래 저장되며, 경기·새 리포트·면담·시즌 변경에서 멈춘다. 수신함이 100개로 차도 새 리포트를 ID로 판별한다. 미답변 면담은 자동 진행으로 건너뛰지 않는다.
- 진행 중 다른 관리 조작을 막고 멈추기·모션 감소 설정·저장 실패 정지를 제공한다. 요청 사이에 최신 revision을 사용하도록 정리했다. 리포트가 오면 수신함으로 이동하고, 경기 전에는 자동 계산 없이 멈춘다. 별도 7일 자동 계산 옵션도 리포트에서 멈춘다.
- 운영 빌드, TypeScript, lint, 진행 규칙 6개 테스트와 실제 Worker/D1 API 10개 테스트가 통과했다. 로컬 브라우저에서 6일 뒤 연습경기 직전 정지(경기 기록 0), 하루 저장/revision, 모바일 자동 경기 후 보고 정지·수신함 이동을 확인했다. 기존 DB 스키마는 변경하지 않는다. 영입 답변과 개인 성장 보고는 같은 세션의 후속 구현이며 이번 변경의 운영 배포는 통합 검증 후 진행한다.

## 2026-09-08 — 코치·선수 영입의 제안과 답변 대기

- 계약 규칙을 독립 recruitment 도메인으로 분리했다. 소속 선수를 영입할 때 구단 이적료 제안·역제안 동의 후 개인 조건을 협상한다. FA·재계약은 개인 조건부터 시작한다. 답변은 실제 게임 날짜 1~2일 뒤 도착하며, 역제안 수락과 최종 서명을 구분한다. 조건 재제안·철회·7일 답변 유효기간과 협상 경과를 지원한다. 기존 합의된 저장 제안의 유효기간은 유지한다.
- 즉시 코치 교체를 없애고 보직·연봉·기간 제안, 검토, 역제안, 최종 계약을 추가했다. 서명 전 기존 스태프와 예산을 유지하며, 계약 중인 코치 교체 보상금을 미리 표시한다. 서명 시 교체 대상이 바뀌었으면 거부한다. 새로 계약한 코치의 기간 만료를 다음 시즌에 처리하고 기존 기간 미지정 코치는 유지한다.
- 코치 화면·협상창을 관리 패널에서 분리했다. 선수 협상 표와 수신함의 답변 바로가기를 연결하고 날짜 진행이 답변 도착에서 멈추는 것을 검증했다. 협상 상태는 기존 커리어 JSON 및 기존 선수 협상 projection에 저장하므로 DB 초기화·스키마 변경이 없다.
- 운영 빌드와 전체 75개 테스트, TypeScript, lint, 포맷 검증이 통과했다. 대기 중 서명 차단, 구단/개인 단계, 역제안, 만료·철회, 교체 충돌과 D1 저장·중복 지출 방지를 검증했다. 모바일 실제 코치 제안 → 날짜 진행 → 수신함 답변 → 역제안 수락 → 계약 → 새로고침 후 박한이 타격 코치/2028년 만료 유지, 가로 넘침·브라우저 오류 없음까지 확인했다. 운영 커리어는 검증용으로 변경하지 않았다. 개인 성장 곡선은 다음 구현 단위로 진행한다.

## 2026-09-08 — 선수별 성장기·전성기·하락기와 관찰 기록

- 선수별 조숙·균형·만성·장수 곡선을 추가했다. 실제 날짜의 훈련·출전·코치·컨디션과 잠재력에 따라 능력을 점진적으로 바꾸며 같은 날 중복 성장과 시뮬레이터 난수 변경을 막는다. 기존 연령 일괄 성장·하락은 대체했다. 기존 선수는 현재 능력·계약·성적을 유지한 상태에서 첫 관찰 기록을 생성한다. 새 계약 선수도 같은 경로로 초기화한다.
- 상세 페이지의 성장 기록 탭에 단계·환경·실제 관찰 그래프와 능력별 변화를 제공하고 선수단·2군 목록에 단계 배지를 표시한다. 4주마다 성장 보고가 도착하여 날짜 진행을 멈춘다. 미래 성장 파라미터는 잠재력 공개 설정과 무관하게 API에서 숨긴다. 실명 선수의 성장 유형은 게임 설정이며 실제 미래 예측이 아니다.
- 전체 79개 테스트, 최종 운영 빌드, TypeScript, lint, 포맷 검증이 통과했다. 기존 데이터 보존, 날짜별 중복 방지, 개인별 단계와 하락, 출전·훈련·코치 효과, 잠재력 상한, 저장 재개와 성장 보고·D1 projection을 검증했다. 구버전 경기 입력은 이전 소스에서 생성한 합성 fixture로 고정하고 기존 결과 해시를 그대로 유지했다. 사용자 저장 파일은 Git에 넣지 않았다.
- 로컬 브라우저에서 28일 진행 후 실제 이력 2개와 관찰 종합 능력 +0.84, 모바일 그래프·표·대비·가로 넘침 없음을 확인했다. 별도 선수 영입도 제안 → 답변 보고 → 최종 계약 → 새로고침 후 2군 소속·성장 정보 유지까지 확인했다. 최종 운영 번들에서 신규 게스트의 6일 연속 진행 후 경기 직전 정지와 브라우저 오류 없음을 재확인했다. 수치는 해당 테스트 선수의 관찰 결과다.
- SQL 스키마 변경이나 DB 초기화는 없다. 부상·성격·개인 능력 훈련 계획·멘토링·시설과 타 구단 전체 선수의 일일 성장은 아직 구현하지 않았다. 날짜 진행·협상과 함께 main 자동배포 및 기존 비공개 Sites 발행을 진행한다.

## 2026-09-08 — FM 기능 대조와 누락 항목 점검

- 사용자 요청으로 공통 상태·서버 명령·경기/시즌 처리·화면을 대조하고 `docs/fm-feature-audit.md`에 22개 영역의 구현·부분 구현·미구현, 코드 근거와 우선순위를 기록했다. FM 공식 영입·육성·업무 위임 자료를 비교 기준으로 사용하고 야구 드래프트·트레이드·리그 규정은 별도 요구로 구분했다.
- 날짜 진행과 영입·성장 기본 흐름은 있지만 스카우팅 파견·개인 능력 훈련/멘토링·부상/재활·경기 중 수동 교체·AI 구단 간 선수단 구성·구단주/감독 경력 등이 남아 있다. 이미 있는 개인 포지션 훈련·사기·투수 보직을 미구현으로 오인하지 않도록 범위를 구체화했다. 이번 점검은 모든 누락 기능의 추가 구현이나 FM 전체 완료 선언이 아니다.
