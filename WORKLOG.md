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

## 2026-09-08 — 날짜 진행·협상·성장 운영 배포와 보존 확인

- 한글 PR #6을 main `e2a135a3f51abb7b6fe98aafbea9e0f581f43be2`에 병합했다. GitHub Actions run `34211421024`에서 전체 79개 테스트와 검증, 검증 산출물을 사용하는 Cloudflare 자동배포가 모두 성공했다. D1 Time Travel bookmark를 확보했고 적용할 추가 마이그레이션은 없었다. 공개 health에서 catalog v7을 확인했다.
- 공개 주소 `https://baseball-manager.kkwondev.workers.dev`에서 새 달력 스타일, 구단 선택의 13개 리그, 가로 넘침·브라우저 오류 없음을 확인했다. 실제 계약·성장·날짜 진행 조작 검증은 앞 절의 격리된 로컬 게스트에서 수행했다.
- 기존 커리어를 읽기 전용으로 비교해 revision 42, 선수 42명, 경기 기록 5개, 예산·날짜·구단·타순·선발·계약·성적·컨디션이 원본 백업과 일치함을 확인했다. 일반 게스트 원본 export는 401이다. 능력까지 비교를 확장하자 오래된 원본과 차이가 있어 조사했으며, 이전 공개 배포 소스 `633d3ca5cefe12a1aafe40dc34bf940de52c36b5`의 엔진으로 동일 catalog v7을 불러온 결과와 현재 6개 능력이 모든 선수에서 일치했다. 원본 16명의 차이는 기존 성적 기반 catalog 갱신에서 이미 발생하는 값이며 이번 성장 초기화로 능력이 달라진 것은 아니다. 운영 커리어를 진행·수정하거나 원본 백업을 덮어쓰지 않았다.
- 검증된 소스 `52dae69f7d27e72a77018d22be68274457b46df1`의 Sites 버전 12도 배포 `appgdep_6a9fd7e85ec08191b9b750d771c68c81`이 성공했다. 기존 프로젝트, 소유자 1명·그룹/외부 방문자 0명의 접근 범위와 환경 revision 2를 유지했다. 공개 Worker와 기존 Sites는 별도 배포 대상이다.
- 이 후속 커밋은 배포 기록과 점검 문서의 수신함 코드 경로만 수정한다. 현재 발행 차단 요인은 없다. 장기 밸런스·모든 리그 규칙·FM 전체 기능 구현은 완료로 주장하지 않는다.

## 2026-09-08 — Worker CPU 경로 조사와 경기 타임라인 저장

- `stepMatch`가 매 타석 1회부터 다시 계산하고 `completeMatch`에서도 재계산하는 구조를 확인했다. 한 경기 결과·타석 이벤트·성적 반영분을 먼저 생성해 저장하고 재생 위치 이동에는 시뮬레이터를 호출하지 않도록 분리했다. 완료 시 저장된 반영분을 한 번 적용한다. 기존 미완료 경기는 명시적인 준비 명령으로 한 번 변환하며 이전 투수 교체 규칙과 결과 해시를 유지한다.
- 프리뷰/경기 중 변경은 별도 `reviseMatch` 명령이다. 선택한 타순·투수·팀 지시로 이후 타임라인을 다시 생성하고 소비한 이벤트의 동일성을 검사한다. 경기 중 타순 재배열·재출전·잘못된 1군 선수·지난 재생 위치·오래된 타임라인 버전·종료 후 변경을 거부한다. 변경은 최대 40회, 시뮬레이션 이벤트는 최대 1,200개로 제한하며 실패 시 기존 D1 상태를 유지한다.
- SSR에 경기 시뮬레이터 호출은 없었으나 API 모듈의 NestJS 초기화가 같은 진입점에 있었다. API를 요청 시 로드하고 NestJS도 지연 초기화한다. 카탈로그는 잠재력 설정 하나만 SQL로 읽도록 변경해 커리어 전체 파싱·보정·엔진 생성을 제거했다. 불변 카탈로그 인덱스와 숨김 출력을 재사용하고 실제 사용 구단의 선수 복사만 생성한다. 사용자별 경기/일정 상태는 전역 캐시에 넣지 않는다.
- 동일 seed 407·99이벤트 로컬 Node 비교: 엔진 생성 평균 1.84ms→0.004ms, 기존 타석 명령 전체 처리 139.76ms→0.075ms, 완료 5.24ms→1.79ms. 전체 경기를 먼저 준비하므로 시작은 2.01ms→3.98ms이며 점수 7:20과 이벤트 수는 같았다. 이 값은 로컬 비교이며 Cloudflare CPU 측정값이나 Free 요금제 한도 보증이 아니다.
- 전체 85개 테스트와 추가 D1 타임라인 회귀 테스트가 통과했다. 운영 빌드·TypeScript·lint를 확인했고, 기존 경기 해시·더블헤더·포스트시즌·저장 재개·비공개 입력 제거·중복 반영 방지를 검증했다. SQL 스키마 변경/DB 초기화는 없다. 확인 가능한 기존 Sites 최근 오류 로그에서는 인증 401만 관찰됐으며 사용자가 본 1102의 해당 요청 로그는 아직 확보하지 못했다. 공개 배포와 최종 UI 확인은 후속 단위에서 마무리한다.

## 2026-09-08 — 저장 이벤트 재생과 프리뷰·경기 중 선수/전술 편집

- 2D 경기 화면을 `live-match-screen.tsx`와 기존 장면/다시보기 컴포넌트로 분리했다. 일반 재생·다음 타석은 저장된 이벤트만 읽고 재생 위치는 이 기기에 보관한다. 속도 설정도 유지한다. 프리뷰와 일시정지 편집은 선수/팀 전술 탭으로 나누고, 미적용 변경이 있으면 적용·취소 전 진행을 막는다.
- 로컬 운영 번들의 브라우저에서 프리뷰의 김동혁 1번/나균안 선발 변경 후 타임라인 버전 증가와 새 결과를 확인했다. 다른 최종 테스트 게스트에서는 모바일 프리뷰 전술 변경, 10타석 재생 중 POST 0건, 벤치 선수와 전술 변경 시 POST 1건·버전 증가·과거 10타석 완전 일치·미래 변경, 새로고침 후 같은 위치 재개를 확인했다. 모바일 페이지 가로 넘침과 브라우저 오류가 없었다. 최초 편집창에서 전술이 아래로 밀리는 불편을 발견해 탭으로 개선했다.
- 오류 조사와 재현 명령은 `docs/worker-performance.md`와 `scripts/profile-match.mjs`에 기록하고 FM 기능 점검/인수인계를 갱신했다. 실제 오류 당시 요청 로그 미확보, 기기별 재생 위치, 타구 궤적의 화면 연출, 상세 리그 교체 규정 미재현을 구분한다. 운영 데이터는 이번 QA에 사용하지 않았다.

## 2026-09-08 — Worker 최적화와 경기 편집 배포 완료

- 최종 로컬 86개 테스트, 운영 빌드·TypeScript·lint·포맷이 통과했다. 로컬 브라우저에서 변경 후 76개 이벤트를 끝까지 재생하고 결과 확인을 눌러 날짜 -22→-21, 경기 1개 반영, 저장 아카이브와 이벤트 일치, 브라우저 오류 없음을 확인했다.
- PR #7을 main `9a6cd02e698479b11ebe1d71e768ad18b3cc1729`에 병합했다. GitHub Actions run `34220871973`에서 86개 테스트와 검증·Cloudflare 자동배포가 모두 성공했다. 추가 SQL 마이그레이션은 없으며 공개 Worker 버전은 `e6a47c81-62b9-4967-a42f-979c7e1b16ff`다.
- 공개 배포 직전 기존 커리어 응답을 Git 밖의 비공개 파일로 보관하고 배포 직후 응답 전체를 깊은 비교했다. revision 42, 선수 42명, 경기 기록 5개를 포함해 응답 전체가 동일했다. 원본 백업·복구 키와 D1 데이터를 유지하며 기존 커리어를 진행하거나 수정하지 않았다.
- 별도 공개 검증용 게스트에서 신규 시작, 6일 날짜 진행, 경기 타임라인 생성, 프리뷰 전술 변경, 완료까지 10개 POST가 모두 201로 성공했다. 변경된 80개 이벤트가 한 경기로 반영되고 새로고침 후 유지됐으며 브라우저 오류나 1102는 관찰되지 않았다. 각 요청의 브라우저 왕복 시간 약 1.4~1.8초는 네트워크/D1 대기를 포함하며 CPU 시간이 아니다. 오류 당시 요청 로그 미확보와 모든 상황의 CPU 한도 보증이 아님은 조사 문서에 유지한다.
- 같은 구현 소스 `625b20a7899f40d81948d5d37471b04758a60f8b`의 소유자 전용 Sites 버전 13도 배포 `appgdep_6a9ff0e63360819181fb9f32681146d8`이 성공했다. 기존 프로젝트·접근 범위·환경 revision 2를 유지했다. 공개 Worker와 비공개 Sites 모두 발행을 완료했으며 현재 발행 차단 요인은 없다.
- 이 후속 커밋은 배포/검증 기록만 추가한다.

## 2026-09-08 — 경기 준비의 교체·타순 변경과 수비 배치 보존

- 새 구장 보드를 직접 조작하면서 벤치 교체와 타순 재배열을 한 번에 적용하면 기존 위치 상속 로직이 같은 선수를 두 수비 위치에 배치할 수 있음을 발견했다. `reviseMatch`에서 선택적 수비 배치를 검증·저장하고, 기존 클라이언트의 생략 요청도 남은 야수를 중복 없이 배치하도록 수정했다.
- 투수 일치, 타순 야수 9명, 10개 위치의 중복·누락·잘못된 ID를 검증한다. 기존 경기 중 재출전·타순 변경 제한, 지난 이벤트 보존과 revision 검증은 유지한다. DB 스키마 변경·초기화는 없다.
- 교체 후 타순 재배열과 기존 요청의 수비 유일성, 잘못된 배치 거절을 회귀 테스트에 추가했다. 실제 D1 API에서도 잘못된 수비 요청 전후 커리어 응답 전체가 같음을 확인했다. 최종 운영 빌드와 전체 87개 테스트, TypeScript·lint·포맷이 통과했다.

## 2026-09-08 — 구장 보드·선수 카드 중심의 경기 준비 화면

- 좁은 사이드 패널의 선수 셀렉트박스를 구장 배치판·타순표·벤치/불펜 카드로 대체했다. 선발과 벤치를 차례로 누르거나 마우스로 끌어 교체하며 경기 전 타순은 드래그와 올리기/내리기 버튼을 지원한다. 컨디션·종합 능력·수비 적합성 경고와 선발/필승조/추격조/마무리 보직을 표시한다.
- 균형·장타·기동력·출루 전술 카드, 단계별 팀 지시와 세부 조정, 구장의 수비 깊이 표시를 추가했다. 변경 요약·되돌리기·취소·준비 완료 후 플레이볼을 제공한다. 모바일에서는 타순표를 접고 전술을 먼저 표시하며 손가락 선택과 키보드 조작을 지원한다. 배경은 단색이고 경기 계산을 브라우저에 추가하지 않았다.
- 편집 상태를 `use-match-plan.ts`, 구장/벤치/타순을 `match-lineup-board.tsx`, 전술을 `match-tactics-board.tsx`로 분리했다. 교체 때 수비 위치를 인계하고 타순 이동은 수비 배치를 유지한다. 클릭/드래그 중에는 서버 저장 없이 초안만 바꾸며 적용 시 한 번 요청한다. 일반 재생의 서버 요청 없음도 유지한다.
- 최종 운영 번들의 실제 브라우저에서 김동혁 교체 → 3번 타순 이동 → 나균안 선발 → 장타 카드 선택을 한 번 적용하고, 새 타임라인 버전·정확한 타순/수비 10명·POST 1건을 확인했다. 마우스 좌표 이동으로 나승엽을 1루에 끌어 놓기, 되돌리기, 모바일 포수 카드/키보드 Enter 교체, 취소, 전술 카드 적용을 확인했다. 드래그 CLI 한 방식은 대상 좌표를 놓쳐 실제 마우스 down/move/up으로 검증했다.
- 별도 로컬 게스트에서 5타석 일반 재생 중 POST 0건, 포수 유강남·출루 전술 동시 적용 POST 1건, 버전 증가·과거 5타석 완전 일치·미래 변경을 확인했다. 390px 화면의 대화창이 화면 안에 들어오고 가로 넘침·브라우저 오류가 없었다. 전체 87개 테스트와 운영 빌드·TypeScript·lint·포맷이 통과했다. 구장 위 현재 선수끼리의 수비 위치 교환은 이번 범위가 아니며, 구장 카드는 벤치 교체에 사용한다. 공개/비공개 배포는 후속 기록에 남긴다.

## 2026-09-08 — 구장 보드 운영 배포와 기존 커리어 보존 확인

- 한글 PR #8을 main `07b204081695da1ad45e8872805f1464c201dd4e`에 병합했다. GitHub Actions run `34225969652`에서 전체 87개 테스트·빌드·TypeScript·lint·포맷 검증과 Cloudflare 자동배포가 성공했다. 추가 SQL 마이그레이션이나 DB 초기화는 없다.
- 공개 `https://baseball-manager.kkwondev.workers.dev`의 별도 신규 게스트에서 경기 준비, 김동혁 좌익수 교체와 장타 전술 적용, 저장 완료와 새로고침을 확인했다. 구장 카드 10개·선수 셀렉트 0개, 타임라인 버전 2, 중복 없는 수비 10명, power 85가 실제 D1 응답과 화면에 유지됐고 브라우저 오류가 없었다. 운영 응답은 저장 완료 UI를 기다린 뒤 검증했다.
- 원래 사용자의 커리어를 배포 전후 읽기 전용으로 조회해 응답 전체가 같음을 깊은 비교로 확인했다. revision 42·선수 42명·경기 기록 5개를 유지했으며 날짜 진행·수정은 하지 않았다. 백업과 복구 키는 Git 밖의 비공개 파일에 보존한다.
- 동일 구현 소스 `732a752e64e3d5eb391fc820095f5cc013a540d1`의 Sites 버전 14도 배포 `appgdep_6a9ffe515afc819183402e918249e82e`이 성공했다. 기존 프로젝트·환경 revision 2·소유자 1명/그룹·외부 방문자 0명의 접근 범위를 유지했다. 전용 `open_in_codex` 도구가 없어 Orca의 단일 사이트 탭 `71cdd977-0fd6-4acc-8392-efe6138eaf90`으로 배포 주소를 열었으며, 비로그인 브라우저에서 로그인 필요 화면은 예상된 접근 제어다.
- 현재 발행 차단 요인은 없다. 이 커밋은 배포·보존 확인 기록만 추가한다.

## 2026-09-08 — D1 쓰기 한도 긴급 절감

- Cloudflare 계정의 실제 GraphQL 지표에서 2026-09-08 해당 DB 읽기 716,265행·쓰기 89,735행(읽기 쿼리 1,297건·쓰기 쿼리 5,504건)을 확인했다. 조회 시점 누적값이며 이후 사용량과 다를 수 있다. 공식 문서 기준 무료 쓰기 100,000행/일의 약 89.7%다.
- 원인은 일반 명령마다 선수·계약·스태프·협상·전 리그 순위 projection을 DELETE/INSERT로 전부 교체하는 저장 경로였다. persisted snapshot과 다음 상태의 실제 컬럼 차이를 비교해 변경 행만 UPSERT하고 삭제된 ID만 제거한다. 스냅샷·requestId·revision·새 경기 아카이브·재무 기록은 같은 D1 트랜잭션에서 저장한다. 전체 삭제는 사용자가 확인한 새 커리어 교체에만 남긴다.
- 명령 처리에서 읽기용 보정을 원본 snapshot에 먼저 적용하지 않아 구버전 보정도 delta에 포함되도록 했다. 재무가 변하지 않으면 이미 읽은 원장을 재사용하고 변하면 확정된 항목을 응답에 추가하여 저장 직후 같은 원장을 재조회하지 않는다. 사용자별 상태를 전역 캐시에 넣지 않는다. SQL 스키마/마이그레이션 변경은 없다.
- `scripts/profile-d1.mjs 5f407eb3cf5228bdb769d2ee2d6069c78f3943e7`로 동일 seed의 로컬 Miniflare D1 `meta.rows_read/rows_written`을 비교했다. 수신함 읽기·전술·경기 시작·프리뷰 수정 저장은 쓰기 688→4행, 읽기 696~697→3행. 하루 진행 쓰기 691→50행, 경기 완료 693→52행이다. 새 커리어 생성은 464행으로 같으며 카탈로그 cold 조회 17,567행은 별도 후속 최적화 대상이다. HTTP/인증 조회와 마이그레이션을 제외한 저장 경로 비교이며 일일 총 사용량 보증은 아니다.
- 전체 88개 테스트·운영 빌드·TypeScript·lint·포맷이 통과했다. 실제 D1 트리거로 수신함/전술 저장의 projection 변경 0건, 포지션 훈련 변경의 해당 선수 UPDATE 1건과 계약/스태프/순위 무변경을 확인했다. 기존 동시성·중복 명령·계약/영입·시즌 전환·아카이브·데이터 이전 회귀를 유지한다. 수신함·계약/서명·모바일 경기 화면은 사용자 추가 요청에 따라 후속 구현한다.

### 2026-09-08 · D1 읽기 절감과 쓰기 수정 배포

- 쓰기 절감 PR #9를 main에 병합했고 Actions 34229962985가 공개 Cloudflare 배포를 완료했다. 소유자 전용 Sites v15도 배포 성공. 배포 전후 원래 커리어 API 응답 전체 동일: revision 42, 선수 42명, 경기 기록 5건.
- 기존 D1 카탈로그에서 200개씩 JSON 페이지를 생성하는 순방향 마이그레이션 0012를 추가했다. 첫 조회 실제 읽기 17,567 → 51행, 후속 3행. 버전 불일치 시 정규 테이블로 복귀하고 요청 사이에는 완료된 객체만 캐시한다.
- 로컬 D1 검증: 페이지와 정규 조회의 전체 월드 동일, 새 버전 갱신, 페이지 크기, 마이그레이션 전후 커리어 원문/revision 보존 통과. 타입 검사 통과. 읽기 개선은 다음 기능 배포에 포함할 예정.

### 2026-09-08 · 깨끗한 CI 환경의 카탈로그 테스트 수정

- Actions 34230811911에서 89개 중 새 카탈로그 테스트 1개가 `work/` 부모 폴더 부재로 ENOENT 실패했다. 테스트와 측정 스크립트가 자체적으로 폴더를 생성하도록 수정했다.
- 로컬 기존 폴더에 의존하지 않는 별도 detached 체크아웃에서 해당 테스트를 실행해 통과했다. CI 재실행 결과를 확인한다.

### 2026-09-09 · FM형 수신함과 계약실

- CI 폴더 수정 8838c456의 Actions 34231687223은 성공했다. 실패했던 89개 테스트와 타입 검사 재실행을 확인했다.
- 수신함을 주제·안 읽음·처리 필요·검색·날짜별 목록과 발신자/보고 본문/핵심 수치/후속 행동으로 분리했다. 계약 만료 보고는 선수별 현재 상태와 재계약 버튼을 제공하며 과거 보고의 연봉·기간은 그대로 보존한다. 새 감독에게도 최초 계약/훈련 점검 보고가 온다. 주간 선수단·협상 답변·시리즈·경기 후 보고 내용을 보강했다.
- 선수 협상실은 우리 제안, 상대 답변, 조건 조정, 역제안 수락, 합의 후 최종 서명을 구분한다. 연봉 증감·기간 버튼·이적료 합의 유지·예산과 지출을 보여준다. 선수/코치의 최종 계약서는 사무실 이미지 위에서 감독 서명을 거쳐 서버 명령으로 체결한다. 비용 계산과 영입/중복/만료 검증은 기존 서버에서 수행한다.
- 브라우저에서 만료 보고 → 전준우 재계약 제안 → 날짜 진행 → 역제안 → 수락 → 서명 흐름을 모바일로 확인했다. 서명 revision +1, 연봉/기간 일치, 지출 14.1(게임 금액 단위) 한 번 반영, 기존 성적 유지, 협상 제거. PC에서 박세웅의 역제안 조건 수정/재제안/합의와 계약서 표시도 확인했다.
- 탐색 중 홈의 만료 안내가 일반 선수단으로 가던 것을 만료 대상 목록으로 연결했다. 새 보고 도착 시 선택을 갱신하고, 읽음 처리 후에도 선택 보고가 유지되게 했다. 경기/계약 모달 뒤의 수신함은 자동 읽음 저장을 하지 않는다. 보고 읽기 실패 시 자동 반복 요청하지 않는다.
- 기능별 화면/입력/서명/보고 모델로 파일을 나눴다. 기존 저장 상태에는 선택적 보고 필드만 추가해 구버전 호환을 유지한다. 이미지 출처와 생성 방식은 docs/contract-office-asset.md에 기록했다. 계약 옵션·성과급·경쟁 구단 협상은 이번 범위에 포함되지 않으며 FM 전체 재현을 주장하지 않는다.

### 2026-09-09 · 모바일 홈/원정 명단과 경기 재생

- 모바일 프리뷰의 기본 화면을 홈·원정 두 열 명단으로 바꿨다. 현재 타자 강조, 선수별 최근 안타/삼진/범타 등의 결과, 마운드 투수, 주자·아웃·점수판을 표시한다. 명단만 별도 스크롤하고 현재 타자를 따라가며 점수와 재생 버튼을 유지한다. PC는 기존 구장과 타자/투수/결과 요약을 함께 표시한다.
- 모바일에서는 구장 SVG나 프레임별 애니메이션을 렌더링하지 않고 저장된 타석마다 타이머 1개로 재생한다. 읽기 모델은 소비한 타석까지만 확인하며 타임라인 변경은 서버에 제출한다. 모바일 준비 화면의 선수·전술 버튼으로 기존 구장/벤치 편집을 열 수 있다.
- 로컬 브라우저에서 재생/다음 타석 전후 서버 revision 13 유지, 대타 전준우→손호영 및 장타 전술 적용 시 revision +1, timeline 1→2, 소비한 두 타석 동일, 바뀐 명단 표시를 확인했다. 8배속 완주 후 경기 기록 1건이 저장되고 live 상태가 종료됐다.
- 390×844에서 두 팀 열/현재 타자 1명/가로 넘침 없음/점수판·현재 결과·재생 버튼 노출을 확인했다. 경기 중 뒤에 열린 수신함의 읽음 요청을 막아 불필요한 실패/저장을 방지했다. 1440×1000 PC 구장과 계약실/수신함도 확인했다.
- 전체 91개 자동 테스트, 운영 빌드, TypeScript, lint, 포맷 통과. 카탈로그 페이지/기존 저장 보존, 보고의 과거 조건 보존, 재계약 후 성적 보존, 아직 재생하지 않은 기록 비노출과 교체 시점 적용 회귀를 포함한다. 최종 UI 높이 조정 후 운영 번들과 화면을 다시 확인해 배포한다.

### 2026-09-09 · 최종 배포와 보존 확인

- 기능 커밋 2505ff5(수신함/계약), c49fd7b(모바일 경기)를 GitHub에 푸시하고 PR #10을 main에 병합했다. main 4c978c93f41f7d8fdb28622cfd3933b50325629f의 Actions 34247250077이 91개 테스트·타입·lint·포맷·D1 마이그레이션·Cloudflare 자동 배포까지 성공했다.
- 공개 주소 https://baseball-manager.kkwondev.workers.dev 에서 health 200, 계약실 이미지 파일 해시 일치, 기존 커리어 전체 API 응답의 배포 전후 동일을 확인했다(revision 42, 선수 42명, 경기 기록 5건). 복구 키/백업 원문은 Git 바깥에 보관했다.
- 운영 D1 읽기 전용 조회로 6개 섹션 48페이지 생성과 가장 큰 페이지 188,532바이트를 확인했다. 조회 자체 쓰기 0행. 카탈로그 원본 및 커리어 테이블을 보존했다.
- 동일 기능 소스 c49fd7bfe2460062a431a77597063ba6e655a8fb를 Sites 소스 저장소에도 푸시했고, 소유자 전용 Sites v16 배포 appgdep_6aa02e5f4f408191a949480cbe14220e가 성공했다. 주소 https://dugout-world-manager.kkwondev.chatgpt.site, 기존 사용자 1명/그룹 0/외부 방문자 0 접근 유지. GitHub와 Sites 소스 저장소는 별개다.
- 최종 390×844 경기 화면에서 제목·점수·현재 타석·재생 버튼 모두 화면 안에 있고, 일반 재생 이후에도 서버 revision 3이 유지됨을 확인했다. 개발 도구 콘솔 오류 없음. Orca 런타임이 꺼져 있어 앱 내부 기존 탭 재로딩은 수행하지 못했다. 배포 차단 요인은 없다.

### 2026-09-09 · 계약서에서 연봉 조율과 재합의

- 선수·코치 계약서의 연봉을 직접 입력하거나 ±5%로 조절할 수 있다. 합의한 연봉과 수정안의 계약금·수수료·잔여 예산을 함께 표시하고 합의 연봉으로 되돌리기를 제공한다. 조건을 수정하면 기존 감독 서명을 지우고 재제안 버튼으로 전환한다.
- 서버의 `reviseContractSalary` 명령은 유효한 합의 계약만 다시 제안한다. 기존 기간·보직·구단 이적료를 유지하고 1~2일 답변 대기로 돌아간다. 상대의 재합의 전 체결, 지난 계약서로 서명, 만료·미합의·잘못된 금액을 차단한다. 편집 중 요청은 없고 재제안 시 한 번 저장한다. DB 스키마와 기존 커리어 데이터 변경은 없다.
- 운영 빌드·타입·lint·포맷과 전체 93개 테스트 통과. D1에서 재제안 저장/재조회/중복 요청, 선수단·예산·원장 보존, 재합의 후 최종 지출을 검증했다. 선수 구단 합의 보존과 코치 보직·기간 유지도 회귀 테스트로 확인했다.
- 390×844 로컬 브라우저에서 전준우 계약서의 연봉 268,800→255,000만 원 수정, 이전 서명 제거, 재제안→날짜 진행→상대 수락→재서명→최종 저장을 확인했다. 연봉·기간·성적 보존과 revision +1, 계약 비용 한 번 반영, 가로 넘침/콘솔 오류 없음. 검증용 로컬 커리어를 사용했다. GitHub/운영 배포 결과는 후속 기록에 남긴다.
- 추가 요청의 FM 기반 기능 전체 확장은 별도 구현 단위로 이어간다. 이 커밋은 계약서 연봉 조율만 완료하며 미구현 시스템을 완료로 표시하지 않는다.

### 2026-09-09 · 계약서 연봉 조율 배포 확인

- 계약서 연봉 조율 커밋 5ce377a를 지정 브랜치에 푸시하고 원격 SHA 일치를 확인했다. PR #11을 main 7deb8b5d29ee3c27bfce0eb6eb09e4dd2250aad1에 병합했으며 Actions 34296866294가 93개 테스트·전체 검사·Cloudflare 자동배포에 성공했다.
- 공개 Worker의 기존 커리어를 읽기 전용으로 배포 전후 비교하여 전체 응답 동일을 확인했다(revision 42, 선수 42명, 경기 기록 5건). 기존 계약/성적과 진행 상태를 변경하지 않았다.
- 동일 구현 소스의 소유자 전용 Sites v17 배포 appgdep_6aa0ad429d588191be40dedce62a4e47도 성공했다. 기존 사용자 1명/그룹·외부 방문자 0명, 환경 revision 2를 유지한다. 추가 SQL 마이그레이션은 없다.

### 2026-09-09 · 스카우트 파견·관찰 보고·관심 명단·비교

- 리그/포지션/최대 나이를 지정하는 파견과 특정 선수 7·14·28일 관찰을 추가했다. 서버에서 담당 스카우트·예산·중복 대상·최대 동시 3개를 확인하고 비용을 한 번 반영한다. 취소 시 보고를 생성하지 않으며 선지급한 비용은 반환하지 않는다.
- 기간이 끝나면 최대 3명의 능력 범위·신뢰도·강점·우려·영입 추천을 기록하고 수신함으로 보고하여 날짜 진행을 멈춘다. 후보 선정은 파견 시작, 평가 생성은 완료일에만 수행하며 매일 전체 선수 계산을 추가하지 않는다. 내부 후보 ID와 미래 성장/잠재력 값은 API에 노출하지 않는다.
- 관심 명단 100명, 임무 이력 30건, 선수별 최신 보고 100건으로 저장량을 제한한다. 보고에서 후보 최대 3명과 소속 선수를 비교하고 선수 상세/계약 제안으로 이동한다. 외부 선수 상세의 관찰 탭에서도 관심 등록/관찰을 의뢰한다. 수신함 관찰 보고도 선수별 상세/계약 제안으로 직접 연결한다.
- 전체 97개 테스트·운영 빌드·타입·lint·포맷 통과. D1 재조회/중복 비용 방지/기존 선수단 보존/후보 비공개와 관찰 완료, 기간별 신뢰도, 취소/잘못된 대상/예산 부족/동시 임무 제한을 검증했다.
- 실제 로컬 브라우저에서 KBO 25세 이하 투수 7일 파견 → 날짜 진행 → 정우주·조병현·라일리 보고 → 수신함 계약실 → 후보 2명/박세웅 비교 → 관심 명단 저장을 확인했다. PC·390px 모바일 가로 넘침/콘솔 오류 없음. 평가와 금액은 게임 모델이며 현실 스카우트 평가로 주장하지 않는다. 테스트 입단과 다른 FM 장기 운영 시스템은 후속 범위다. 기존 커리어 초기화와 SQL 스키마 변경은 없다.

### 2026-09-09 · D1 80% 알림 현재 사용량 재확인

- 한국 시간 10:05~10:06에 연결된 공개 Cloudflare 계정 전체 D1의 GraphQL 일별 지표를 조회했다. 9월 8일(UTC) 읽기 813,165행/쓰기 89,788행, 9월 9일(UTC) 읽기 367행/쓰기 47행이었다. 이 조회에서 활동한 DB는 공개 게임 DB 하나였다.
- 공식 문서에서 무료 읽기 5백만 행/일, 쓰기 10만 행/일, UTC 00:00(한국 오전 9시) 초기화를 재확인했다. 따라서 조회 당시 오늘 쓰기는 0.047%이며, 사용자가 본 80% 알림은 이전 누적 또는 최근 24시간 집계로 보인다고 설명했다. 알림 원문/발송 시각은 보지 못했으므로 원인을 확정하지 않는다. 오늘 지표는 이후 사용량에 따라 달라질 수 있다.
- 개발 테스트와 브라우저 플레이는 격리된 로컬 D1에서 수행한다. 이 확인은 운영 DB를 수정하지 않았다.

### 2026-09-09 · 선수 능력 상승·하락 표시와 성장 보고

- 선수단과 1군·2군 명단의 OVR 옆에 상승/하락 화살표와 소수점 변화량을 표시한다. 최근 상승·하락 필터와 성장량 정렬을 추가했다. 선수 상세에서는 실제 변한 능력의 색상/화살표/변화량과 비교 기준 관찰 날짜를 함께 보여준다.
- 기존 관찰 기록을 재사용하고 실제 이력이 없거나 미평가인 값에는 변화를 만들지 않는다. 0.005 미만 변화는 표시하지 않고 0.01 단위로 표시하여 정수 OVR이 그대로여도 작은 성장을 볼 수 있다. 잠재력이나 미래 성장 곡선을 드러내지 않으며 확인을 위한 새 저장 요청은 없다.
- 4주 성장 보고에 상승·하락·평가 보류 인원과 선수별 OVR/주요 능력 변화량을 보존한다. 수신함에서 선수 이름을 눌러 상세 확인이 가능하고 과거 보고의 변화량은 이후 능력이 바뀌어도 그대로 남는다.
- 전체 98개 테스트·운영 빌드·타입·lint·포맷 통과. 실제 로컬 28일 진행에서 김진욱의 OVR/구위/제구 +0.18, 선수단 상승 27명·하락 3명 필터 일치, 수신함 선수별 변화량·상세 버튼을 확인했다. 1440px PC와 390px 모바일에서 능력 카드/화살표 겹침·가로 넘침·콘솔 오류가 없다. 미평가 항목 비표시, 과거 보고 보존, 소수점 반올림, 관찰 기록 없는 선수 비표시 회귀를 포함한다.
- 기존 선수 성장 계산식과 SQL 스키마는 변경하지 않았다. 스카우팅과 함께 운영 배포를 진행하며 나머지 FM 시스템은 미완료 상태로 추적한다.

### 2026-09-09 · 스카우팅·성장 표시 배포 확인

- 스카우팅 221897e와 성장 표시 848881f를 GitHub 인계 브랜치에 푸시해 원격 SHA를 확인했다. PR #12를 main b14280729b2629620aaa6269a8c00b41f6f5e3a2에 병합했고, Actions 34298551692의 98개 테스트·전체 검사·Cloudflare 자동배포가 성공했다.
- 공개 Worker의 기존 커리어 전체 API 응답이 배포 전 백업과 동일했다(revision 42, 선수 42명, 경기 기록 5건). 읽기 전용으로 검증했으며 원본 커리어를 진행하지 않았다.
- 동일 소스 848881f의 Sites v18 배포 appgdep_6aa0b36c4df08191b4328bfff5f06361도 성공했다. 소유자 전용 접근과 환경 revision 2를 유지한다. GitHub와 Sites 저장소는 각각 업데이트했으며 SQL 마이그레이션은 없다.

### 2026-09-09 · 개인 육성 계획·주간 휴식·멘토링

- 소속 선수의 성장 기록에서 집중 능력·훈련 강도·주간 휴식 요일·멘토·선택적 목표 수치를 저장한다. 서버는 현재 평가된 능력보다 높은 목표, 투타별 집중 능력, 휴식 요일, 같은 투타의 26세 이상/세 살 이상 연상 멘토와 최대 세 명의 지도 인원을 검증한다. 계획 저장만으로 능력이나 계약·성적·재정을 바꾸지 않는다.
- 날짜 진행의 기존 성장 계산에 집중·강도·멘토 강점/사기를 반영하고 지정한 훈련일의 휴식과 강도를 회복량에 적용한다. 컨디션이 낮으면 강한 훈련 효과를 줄이고, 떠난 멘토의 보너스는 적용하지 않는다. 계획 없는 선수의 기존 성장 동작은 유지하며 팀 훈련으로 복귀할 수 있다.
- 목표 도달 시 날짜/관찰 수치를 저장하고 수신함 보고를 한 번 생성해 진행을 멈춘다. 보고에서 선수 상세로 이동해 다음 목표를 지정할 수 있다. 목표 달성 후에도 기존 훈련을 유지한다. 선택적 선수 JSON 필드를 사용하고 SQL 스키마/기존 커리어 초기화는 없다.
- 전체 104개 테스트·최종 운영 빌드·타입·lint·포맷 통과. 집중/휴식/멘토 효과, 부적격 멘토·인원 제한·미평가 목표 거부, 재접속 후 결정적 성장/한 번만 목표 보고, D1 중복 요청/저장과 계약·성적·재정 보존을 확인했다.
- 실제 로컬 브라우저에서 김진욱 구위 56.01 목표·강한 훈련·월요일 휴식·박세웅 멘토를 저장(revision 1→2), 계속 진행 한 번으로 달성 보고에서 정지, 구위 56.0131558과 달성일 저장, 선수 상세 복귀를 확인했다. PC/390px 모바일 가로 넘침·콘솔 오류 없음. 성장 기록표에서 미평가 수비의 숫자를 보이던 문제도 발견해 수정하고 최종 번들에서 구위/제구만 표시됨을 확인했다.
- 훈련 세션별 시간표·담당 코치 배정·부상/재활·시설과 나머지 FM 시스템은 미완료다. 공개/소유자 전용 사이트 배포 결과는 후속 기록을 따른다. 검증은 운영 DB를 진행하지 않는 로컬 D1에서 수행했다.

### 2026-09-09 · 개인 육성 배포 확인

- 개인 육성 커밋 18f3d92fb08ee615fc3a2055cd31746548a6c4cc를 GitHub 인계 브랜치에 푸시해 원격 SHA를 확인했다. PR #13 병합 main 1226e16f51353a600ac8e4a55f1a35f349e54194의 Actions 34299974351이 104개 테스트·전체 검사·Cloudflare 자동배포에 성공했다.
- 동일 소스를 Sites 소스 저장소에도 푸시했고 소유자 전용 v19 배포 appgdep_6aa0b82040688191b385e0b773065551이 성공했다. 기존 사용자 1명/그룹 0/외부 방문자 0과 환경 revision 2를 유지했다.
- 공개 Worker의 기존 커리어 전체 API 응답을 배포 전 백업과 비교해 동일함을 확인했다(revision 42, 선수 42명, 경기 기록 5건). SQL 변경·운영 커리어 진행은 없다.

### 2026-09-09 · 수신함부터 경기 후 보고까지 감독 진행 흐름

- 진행 버튼이 필수 답변 → 안 읽은 보고 → 경기 전 브리핑 → 선수단 제출/경기장 → 날짜 진행 순서를 안내한다. 계약 만료를 읽은 뒤 재계약하지 않았다는 이유로 무한히 멈추지 않는다. 보고 열람/준비 화면 이동은 날짜나 경기 계산을 실행하지 않는다. 새로운 커리어는 취임 보고로 연결하며 루트 기본 화면은 수신함이다.
- 경기 준비 화면에서 양 팀·날짜·선발·타순·피로와 상대 최근 결과를 확인하고 전술/등록을 점검한 뒤 돌아올 수 있다. 날짜 진행이 경기일에 도착하면 준비 화면을 연다. Space로 진행하되 입력창·버튼·대화상자에서는 기존 키 동작을 보존한다. 7일 자동 진행은 별도로 기존 보고를 건너뛰며 새 보고/필수 결정에서 멈춘다고 설명한다.
- 경기 완료 후 신규 경기 보고의 정확한 ID로 이동하며 보고에 최종 점수·경기 기록/다시보기를 연결한다. 서버가 새 보고에 matchId를 저장한다. 미답변 면담이 있을 때 API로 직접 경기를 시작하는 우회도 차단한다. 재생 단계 표시는 저장/시뮬레이션을 추가하지 않는다.
- 전체 106개 테스트·최종 운영 빌드·타입·lint·포맷 통과. 실제 로컬 UI에서 보고 4건 열람 중 날짜 -28 유지, 입력창 Space가 진행하지 않음, 본문 Space로 6일 진행 후 -22 경기 준비/기록 0/미시작, 선수단 제출·모바일 8배속 완주·최종 저장 후 경기 보고로 이동을 확인했다. 경기 기록 1건과 보고 matchId 일치, 다시보기 성공. PC/390px 가로 넘침·콘솔 오류 없음. 안내 글자의 대비도 최종 번들에서 수정/재확인했다.
- FM 공식 인터페이스·상호작용·언론/팬·영입 회의·업무 위임 문서를 다시 대조해 추가 미완성 항목을 기능 점검표에 반영했다. 경기 중 직접 작전, 경기 전후 인터뷰/팀 대화는 다음 구현 단위이며 이 커밋에서 완료로 표시하지 않는다. 피로/전술/능력의 기존 경기 계수와 경기 중 누적 피로의 부재도 기록했다. SQL 마이그레이션·운영 커리어 진행은 없다.

### 2026-09-09 · 감독 진행 흐름 배포 확인

- e3a6842를 GitHub 인계 브랜치에 푸시하고 PR #14를 main bdb83bee8c85cec09463a3c3ec9467e06ebbd8c0에 병합했다. Actions 34302112644가 106개 테스트·전체 검사·Cloudflare 자동배포에 성공했다.
- 같은 소스의 소유자 전용 Sites v20 배포 appgdep_6aa0bda0c92c8191969f6f2a600d7cff도 성공했다. 환경 revision 2를 유지한다. 공개 Worker의 기존 커리어 전체 응답은 배포 전 읽기 전용 백업과 동일했다(revision 42, 선수 42명, 경기 기록 5건).

### 2026-09-09 · 타석별 도루·번트·히트앤드런 지시

- 경기 일시정지 시 벤치 작전 카드에서 2루/3루 도루, 희생번트, 히트앤드런을 선택한다. 이미 본 주자·아웃 상황과 공격 팀만으로 가능 여부를 표시하고 서버도 같은 조건을 검증한다. 작전 하나를 대기/변경/취소할 수 있으며, 재생하면 해당 플레이에만 적용한다.
- 서버가 한 경기의 미래 타임라인을 갱신하고 소비한 이벤트의 완전 일치를 확인한다. 도루는 타순/타수를 소비하지 않는 별도 주루 이벤트다. 희생번트 성공은 희생타로 기록하고 타수를 올리지 않는다. 히트앤드런은 컨택·장타·병살·주루를 조정한다. 주자 스피드/컨디션, 타자 컨택, 투수 제구와 수비가 성공률에 영향을 준다. 확률은 게임 모델이며 현실 통계 보정을 완료한 것은 아니다.
- 도루 성공·실패/희생번트 추가 집계를 저장하고 선수 상세에 표시한다. 기능 추가 전 기록을 임의로 복원하지 않으며 시범경기는 기존처럼 정규 시즌 성적에 합산하지 않는다. 2D와 모바일은 저장된 주루/번트 장면을 재생하며 작전 재생 자체의 API 쓰기는 없다. 경기당 선수·전술·작전 변경 합계 40회와 이벤트 상한을 유지한다.
- 최종 운영 빌드·전체 113개 테스트·타입·lint·포맷 통과. 과거 이벤트 보존, 변경/취소/재접속의 결정적 미래, 잘못된 상황·지난 버전·지난 커서·변경 한도 거부, 도루 양쪽 결과/타순·타수 불변, 희생번트 기록, 정규 경기 최종 성적과 D1 중복 저장 방지/시범경기 성적 분리를 검증했다.
- 로컬 모바일 UI에서 번트 지시/취소 → 도루 지시 → 실제 주루 결과 재생을 확인했다. 재생 후 서버 revision이 증가하지 않았다. 작전 카드의 주자별 비활성 조건을 확인했고, 대기 안내로 재생 버튼이 아래로 밀리던 문제를 수정했다. 최종 모바일/PC 화면 확인과 배포 결과는 후속 기록을 따른다. 기존 커리어 초기화·SQL 마이그레이션은 없다.
- 최종 390×844 화면에서 작전 대기 중 재생 버튼 하단이 819.4px로 화면 안에 있고 가로 넘침이 없음을 확인했다. 1440px PC에서도 작전 카드를 열고 비활성 조건/현재 주자를 확인했으며 콘솔 오류가 없다. 후속 사용자 요청의 공통 로딩 표시와 전술·타순 저장 지연 개선은 별도 구현 단위로 진행한다.

### 2026-09-09 · 경기 중 작전 지시 배포 확인

- ee5005657beab3dabcd95ecf9ff187df00fb248a를 GitHub 지정 브랜치에 푸시해 원격 SHA 일치를 확인하고 PR #15를 main 7381f4b148ddb2086b6b893d7e0a26c5f3619e5a에 병합했다. Actions 34303297934의 113개 테스트·전체 검사·Cloudflare 자동배포가 성공했다.
- 동일 소스의 소유자 전용 Sites v21 배포 appgdep_6aa0c2a01e6c8191a7ac962b799cce99도 성공했고 환경 revision 2를 유지한다. 공개 Worker의 기존 커리어 전체 응답은 배포 전 백업과 동일했다(revision 42, 선수 42명, 경기 기록 5건).

### 2026-09-09 · 로딩 가시성·타순 및 전술 저장 대기 개선·Space 경기 제어

- 모든 게임 저장 요청에 화면 최상단 로딩바와 작업별 상태 문구를 표시한다. 경기/계약 대화상자 위에서도 보이며 오래 기다리면 응답 대기 문구를 바꾼다. 완료율을 임의의 숫자로 표시하지 않고 성공/실패 시 종료한다. 기존 중복 클릭 잠금과 오류 안내를 유지한다.
- 전술 화면의 타순 이동/선수 선택/코치 추천은 로컬 초안으로 즉시 표시하고 한 번에 적용한다. 전술 프리셋 선택과 슬라이더도 초안으로 조정한 뒤 한 요청에 저장한다. 프리셋·수치를 서버에서 함께 검증하며 잘못된 제안은 일부만 저장하지 않는다. 적용/되돌리기와 미저장 안내를 제공하고 미저장 상태에서 진행/Space/자동 날짜 진행을 막는다. 선수 능력·성적·날짜의 실제 변경은 서버에 남겨 둔다.
- 요청 시 중복 ID/커리어/원장의 인덱스 조회 3개를 D1 batch 한 번으로 묶고 카탈로그 조회와 병행한다. 대량 병렬 작업을 추가하지 않았다. 변경 응답은 기존 경기의 점수/보고를 유지하되 지난 중계 기록을 빼고 다시보기 때 조회한다. 기존 GET/저장 스냅샷/경기 아카이브 및 진행 경기 타임라인은 보존한다.
- 일반 화면 Space는 상단 진행과 같은 동작을 하며 경기 창 Space는 준비 완료/변경 적용, 재생·일시정지, 종료 결과 저장으로 연결한다. 입력/선택/편집 중인 요소·버튼의 고유 키 동작과 조합 입력/수정키/길게 누르기를 보존한다. 경기 창의 첫 포커스를 내용에 두어 Space로 바로 시작할 수 있다.
- 최종 운영 빌드·전체 114개 테스트·타입·lint·포맷 통과. D1의 간소 응답/기존 아카이브 원문/중복 요청/원본 선수단·재정 보존과 잘못된 전술 거부를 검증했다. 기존 동시 저장 충돌/마이그레이션 회귀도 유지한다.
- 실제 로컬 UI에서 타순 세 번 이동의 POST 0회, 적용 시 1회, 프리셋 두 번 선택의 POST 0회, 팀 지시 적용 시 1회를 확인했다. 응답을 1.8초 지연시키는 검증에서 로딩바/작업 문구/버튼 잠금 표시와 완료 후 해제를 확인했다. 입력창 Space는 공백만 추가하며 day -28/revision 4를 유지했고, 본문 Space 진행·경기 준비·Space 플레이볼/일시정지·종료 위치에서 Space 저장 후 정확한 경기 보고 이동을 확인했다. 마지막 종료 위치는 저장된 타임라인 끝으로 이동해 검증했으며 전체 경기 재생을 재검증했다고 주장하지 않는다.
- 동일한 경기 14건 로컬 커리어의 응답 크기는 전체 389,565바이트 → 간소 응답 260,982바이트로 약 33% 줄었다(비압축 JSON). 로컬 타순 요청은 21ms였으며 이 수치를 운영 네트워크의 응답 시간으로 설명하지 않는다. 초기 측정한 다른 커리어의 전체 응답은 약 388KB였다. SQL 스키마 변경·운영 커리어 진행은 없다. 모바일 최종 확인과 공개 배포 결과는 후속 기록을 따른다.
- 최종 390px 모바일의 경기 프리뷰에서 팀 전술 변경/적용을 눌러 경기 창 위에 로딩바와 ‘변경한 선수·전술로 이후 경기를 준비하고 있습니다’ 문구가 보이는 것을 확인했다. 상태 안내의 aria-hidden=false, 안내 폭 약 353px/화면 390px, 적용 후 timelineVersion 2·revision 4, 로딩 제거·가로 넘침/콘솔 오류 없음. 지연은 가시성 검증을 위한 로컬 응답 지연이며 운영 지연 수치가 아니다.

### 2026-09-09 · 로딩·전술 편집·Space 제어 배포 확인

- 03cc21f36f482727947d9b65a948ec9b7809f213을 GitHub 인계 브랜치에 푸시해 원격 SHA 일치를 확인했다. PR #16을 main 30b9440811f4fd733033fb37ee7b0cf30087feb4에 병합했고, Actions 34304461706의 114개 테스트·전체 검사·Cloudflare 자동배포가 성공했다.
- 같은 소스의 소유자 전용 Sites v22 배포 appgdep_6aa0c62de894819197c985c8b53e2f4c도 성공했다. 환경 revision 2를 유지했다. 공개 Worker의 기존 커리어 전체 GET 응답이 배포 전 백업과 동일했다(revision 42, 선수 42명, 경기 기록 5건).

### 2026-09-09 · 경기 전후 인터뷰·라커룸 대화·코치 위임

- 경기 준비 → 기자 질문 두 개 → 라커룸 메시지 → 선수단 반응 → 경기장, 경기 종료 → 해당 결과 보고 → 경기 후 인터뷰/라커룸 → 다음 일정으로 연결했다. 미리 계산한 경기 결과를 질문에 쓰지 않으며 경기 전에는 상대·최근 패배·선발과 컨디션, 경기 후에는 실제 점수·실책·MVP로 내용을 구성한다. 답변 카드마다 말투를 표시하고 이전 질문으로 돌아가 수정할 수 있다.
- 서버가 현재 일정 키/질문/선택지를 검증하고 세 답변을 한 번에 저장한다. 임의의 인용문·일부 질문·다른 일정·완료한 대화를 거부한다. 선수 사기/컨디션/나이에 따라 격려 또는 부담 반응을 계산하고 한 대화의 사기 변화는 ±2 이내(코치 위임 ±1)로 제한한다. 선수 능력·성적·계약·예산과 날짜는 바꾸지 않는다. 실제 바뀐 사기는 기존 경기 계산에 들어간다. 이는 게임의 반응 모델이며 실제 인물 성격 평가가 아니다.
- 코치에게 기자회견과 팀 대화를 맡길 수 있고 담당자와 확정된 답변/선수별 전후 사기를 기록한다. 최근 20회 대화 기록과 수신함의 질문·답변 기록을 제공한다. 더블헤더는 경기별 키를 구분한다. 기존 클라이언트/자동 진행이 미처리 경기 후 대화를 넘기면 중립 응대를 기록하고 추가 사기 효과를 만들지 않는다. 새 경기 후 대기 일정은 직접 진행한 경기의 결과 저장에서 생성하며 모든 AI 구단/자동 경기의 언론 세계를 구현한 것은 아니다.
- 운영 빌드·전체 120개 테스트·타입·lint·포맷 통과. 경기 전/후 문맥, 사기 변화/기존 선수 기록 보존, 입력 위조 거부/중복 효과 방지, 저장 후 이어가기, D1 중복 요청/기록 원문 보존, 코치 위임·더블헤더·20회 이력 상한을 검증했다. 기존 진행 경기와 경기 변경의 결정성 회귀도 유지한다. SQL 변경·운영 커리어 진행은 없다.
- 로컬 실제 UI에서 경기 준비로부터 기자 답변 격려/차분·라커룸 격려를 고르고 revision 3→4 한 번 저장, 사기 긍정 반응 10명과 day -22 유지를 확인했다. 경기장으로 이동해 Space로 시작하고 모바일 8배속으로 74개 이벤트를 끝까지 재생했다. 결과 저장 후 day -21/기록 1건/정확한 경기 보고로 이동, 4:2 승리 질문·기자 답변 두 개·라커룸 격려를 제출해 revision 7→8, 대기 해제·기록 2건·긍정 반응 12명을 확인했다. PC·390px 가로 넘침/콘솔 오류 없음. 문답을 넘길 때 질문으로 포커스를 옮기도록 개선했다.
- 팬 신뢰·구단주 평가·언론 성향/관계·선수 성격·약속의 장기 영향, 부상/재활과 FM 점검표의 다른 장기 시스템은 미완성이다. 최종 화면/배포 결과는 후속 기록을 따른다.
- 최종 번들 390px 모바일에서 다음 질문의 제목에 포커스가 이동하고 제목이 화면 146.5~204.3px에 보이는 것을 확인했다. 코치 위임을 누르면 실제 소속 조재영 코치와 차분한 답변 3개를 저장하고 revision 3→4, 완료 제목 포커스를 확인했다. 가로 넘침·콘솔 오류 없음.

### 2026-09-09 · 인터뷰 완료 화면의 모바일 복귀 동선 보완

- 긴 선수 반응 목록을 내리기 전에 경기장/다음 일정으로 이동할 수 있도록 복귀 버튼을 요약 바로 아래로 옮겼다. 질문/완료 제목은 상단 고정 바에 가리지 않도록 화면 중앙으로 가져오고, 경기 전 인터뷰가 끝난 뒤 상단 버튼도 ‘선수단 제출 · 경기장으로’로 맞췄다.
- 최종 운영 빌드·120개 테스트·타입·lint·포맷 통과. 최종 모바일 브라우저에서 위임 완료 후 제목과 복귀 버튼이 화면 안에 보이고 가로 넘침/콘솔 오류가 없음을 확인했다. 인터뷰 데이터나 반응 계산은 바꾸지 않았다.

### 2026-09-09 · 인터뷰 최종 배포와 기능 점검표 갱신

- 인터뷰 c5967eb25bf3f893b2e345d3133ea321030ed8c2와 화면 보완 73693b831175071eb18b05a874f2ffff8a4d7b22를 GitHub 인계 브랜치에 푸시해 원격 SHA 일치를 확인했다. PR #17을 main fabae71d33455aef3221895c946cefea0889f279에 병합했고, Actions 34305761700의 120개 테스트(실패 0)·빌드·타입·lint·포맷 및 Cloudflare 자동배포가 성공했다.
- 같은 소스 73693b8의 소유자 전용 Sites v23 배포 appgdep_6aa0cbd51880819192e1781d98cb6f1e도 성공했다. 환경 revision 2와 기존 프로젝트를 유지한다. 공개 주소는 https://baseball-manager.kkwondev.workers.dev, 소유자 전용 주소는 https://dugout-world-manager.kkwondev.chatgpt.site 이다. GitHub와 Sites 소스 저장소는 각각 업데이트했다.
- 공개 배포 후 기존 커리어 전체 GET 응답이 배포 전 읽기 전용 백업과 동일했다(revision 42, 선수 42명, 경기 기록 5건). SQL 변경·원본 커리어 진행은 없다. 이번 구현의 남은 배포 차단 사항은 없다.
- FM 점검표의 후속 구현·검증 수와 다음 우선순위를 실제 상태로 갱신했다. 이미 구현한 관찰/개인 육성/직접 교체를 앞으로 구현할 기능처럼 남겨 두던 표현을 고쳤다. 투구 누적 피로·불펜 준비·부상/재활·계약 경쟁·구단주와 감독 경력 등은 여전히 미완성으로 명시했다. 문서 포맷과 변경 공백 검사를 통과했다.

### 2026-09-09 · 중단된 경기 화면·투구 지시·누적 피로 작업 마무리

- 세션 시작 때 남아 있던 경기 전용 `/match` 화면, 타순·투수 운용 분리, 투구 방침과 타자별 승부/유인/땅볼/고의4구, 경기 체력 표시 변경을 이어서 정리했다. 서버가 누적 피로를 기록하고 관찰한 타석까지만 체력을 표시한다. 일반 재생은 기존처럼 저장/시뮬레이션을 추가 실행하지 않는다.
- Claude를 실제 Orca 작업으로 실행해 읽기 전용 검토를 받았다. 구원 투수의 첫 등판 피로를 추가하고, 저컨디션 선발의 첫 타자 전 자동 교체와 고의4구의 타자 피로를 수정했다. 이전 진행 경기에는 기존 볼넷 확률 범위와 피로 규칙을 유지한다.
- 경기 체력과 최종 적용 컨디션 일치, 미래 타석 비노출, 수비 지시 네 종류의 과거 타석 보존·취소·재현, 고의4구 진루, 구원 진입 비용 한 번 적용을 자동 테스트로 확인했다. 통합 소스의 운영 빌드와 133개 테스트가 통과했고 이후 추가한 화면 렌더링 검증은 별도 기능 기록에 남긴다. 이번 세션에서 실제 브라우저 조작은 수행하지 않았다.
- 불펜 워밍업과 부상·재활은 아직 미구현이다. 운영 배포는 새 경력 기능 통합 검토 후 결정하며, 현재 GitHub/사이트 발행 결과는 아직 확인하지 않았다.

### 2026-09-09 · 리그 친숙도와 관찰에 따른 능력치 공개

- 근무 리그는 친숙한 리그로 관리하고 외부 리그 선수의 OVR·세부 능력·잠재력은 서버 응답에서 숨긴다. 시장·프로필에서 `?`를 표시하고 스카우트 보고가 도착하면 보고 날짜와 평가 범위만 보여준다. 상세 성장 이력·훈련 목표·평가 원본 수치 등 우회 노출도 제거했다. 실제 서버 경기 계산은 원본 능력을 계속 사용한다.
- 카탈로그 조회는 인덱스가 있는 단일 커리어 행에서 필요한 지식·스카우팅 필드만 읽는다. 월드/친숙 리그별 공통 표시 캐시와 개인 보고를 분리해 사용자별 보고가 다른 계정에 섞이지 않게 했다. 같은 리그 여부, 보고 전후 원본 수치 비노출, 범위 공개, 원본 카탈로그 불변, 타 계정의 친숙도 분리를 자동 검증했다.
- 원본을 모르는 FA는 관찰이 필요하다. 국가별 상세 스카우트 조직·친숙도 수치의 점진적 축적은 아직 단순화돼 있다. 기존 저장에는 선택적 지식 필드를 보정하며 SQL 변경·커리어 초기화는 없다. 전체 배포 결과는 이후 통합 기록을 따른다.

### 2026-09-09 · 감독 채용 목록과 이어지는 감독 경력·코치 보고·재정

- 별도 감독 채용 현황에서 세계 리그/구단 검색, 현 감독, 구단주 신임도, 공석/입지 불안, 순위와 정규시즌 종료 여부를 확인한다. 무직 감독은 공석 또는 신임도 35% 미만인 구단에 지원한다. 3일 심사 후 평판과 채용 상태를 검사하며 최대 세 구단 지원·14일 재지원 간격·제안 만료를 서버에서 강제한다. 제안 확인에서 계약 서명으로 이어진다. 신임도는 실명 감독의 실제 관계를 나타내지 않는 게임 평가다.
- 사퇴·해고 후 무직 상태로 날짜와 리그 경기를 진행하고 새 구단을 맡아 같은 세이브의 날짜·전 리그 순위·선수단을 이어받는다. 이전 구단의 선수 계약·전술·재정을 저장하고 돌아오면 복원한다. 중도 부임한 구단의 경과 일수와 실제 발생한 월드 경기 수입, 소속 실명 코치진을 반영한다. 감독 개인 누적 급여와 구단 운영비를 구분하며 무직 기간 감독 급여는 없다.
- 구단주와 정규시즌 순위 목표·연봉을 합의한다. 목표 달성 시 연봉 15% 인상과 연장, 미달 시 해고, 10경기 이상 뒤 신임도 15% 미만이면 중도 해임한다. 1~28일 휴가·조기 복귀와 코치의 경기/면담 대행을 제공한다. 시즌 종료 후 취임한 감독은 이전 성적으로 즉시 평가하지 않는다. 구직 답변을 기다리는 오프시즌 날짜 진행과 다음 시즌 전환을 분리했다.
- 주간 코치 보고가 2군 성적 우수 선수의 승격과 1군 부진/피로 선수의 재정비를 추천한다. 수신함/등록 화면에서 추천 이유와 대체 선수를 확인하고 수락·보류한다. 수락 시 현재 로스터와 등록 규칙을 재검사해 한 번에 교체하며 계약/성적을 바꾸지 않는다.
- 시즌 시작 시 확정한 스폰서·중계 지원금과 선수/코치/감독 급여를 하루씩 정산하고 시즌 일수 상한을 적용한다. 신규 고액 계약이 지원금을 자동 증액하지 않는다. 재정 화면에 감독 연봉과 일일 수입/급여를 표시한다. 기존 세이브의 이미 지난 모든 AI 경기 수입을 소급 재구성하지는 않는다.
- Claude의 읽기 전용 최종 검토를 반영해 누락 리그/구단 순위 보정, 휴가 아닌 상태에서 복귀 명령 거부, 오프시즌 제안 만료와 취임 직후 평가를 수정했다. 이전 소속 선수가 FA가 되어도 알고 있는 능력을 유지하며 개인 지식을 공통 카탈로그 캐시에 섞지 않는다. 새 선수 등록 후 저장 응답과 재접속 지식도 동일하게 정규화한다.
- 전체 139개 자동 테스트·운영 빌드·타입·lint·포맷을 통과했다. D1에서 사퇴/재취업/동일 요청 재시도/재접속·이전 구단 스냅샷과 서버 비노출을 검증하며, 기존 경기 결정성·작전·성장 회귀를 유지한다. 이번 세션은 실제 브라우저 조작 검증을 수행하지 않았고 로컬 미리보기의 HTTP 200 응답을 확인했다. SQL 스키마 변경·운영 커리어 진행은 없다.
- 경쟁 지원자·면접·재직 중 타 구단 지원, AI 감독의 자율 재선임, 타 구단 전체 선수의 일일 성장/성적, 리그별 독립 포스트시즌과 수십 년 재정 밸런스는 미완성이다. GitHub 인계와 Sites 버전 저장 결과는 후속 기록에 남긴다. 현재 운영 사이트에 이번 변경을 발행하지 않았으며 기존 배포를 유지한다.

### 2026-09-09 · 감독 경력 변경 인계와 발행 준비

- 경기 a72114c, 관찰 08aa5bd, 감독 경력 4b9f9ac98162620c2c995ba0a0c65642c275d0f8을 지정 GitHub 인계 브랜치에 푸시하고 원격 SHA가 일치함을 확인했다. 한국어 설명의 초안 PR #18을 열었다: https://github.com/theo-ooooo/baseball-manager/pull/18.
- 같은 구현 소스를 별도의 Sites 소스 저장소에 푸시하고 검증한 Worker/정적 파일/기존 마이그레이션 묶음을 Sites v24로 저장했다. 저장 버전 ID는 appgprj_6a9ec5fc450081919ce49eb029d8f319~appgver_fbaf8aa0588c8191b4027489d02b8867이다. 버전 저장은 운영 발행이 아니다.
- 이번 요청은 기능 구현·이전 작업 재개이며 기존 사이트 배포 요청은 명시되지 않았다. Sites 도구의 기존 사이트 배포 범위를 따라 배포 호출과 공개 Worker를 자동 발행하는 main 병합은 실행하지 않았다. 현재 변경의 기술 검사 차단 사항은 없으며 운영 반영 단계가 남아 있다. 기존 공개 Worker와 소유자 전용 Sites v23 배포를 유지한다.

### 2026-09-09 · 감독 경력 기능의 기존 공개 사이트 배포 완료

- 사용자가 기존 공개 사이트만 배포하도록 요청했다. PR #18의 모든 검사가 성공한 상태에서 검증한 인계 브랜치 HEAD를 확인하고 main 32c2a2094c03945ed752375a89b9ddabd459a843에 병합했다. Actions 34314810250의 전체 검사·139개 테스트·검증 산출물 업로드·공개 Cloudflare Worker 배포가 성공했다.
- 공개 주소 https://baseball-manager.kkwondev.workers.dev 의 홈과 API 응답 200, D1 상태 정상, 실제 제공되는 게임 번들의 감독 채용 화면/경력 명령을 확인했다. 기존 커리어에 감독 계약·137개 구단 채용 현황이 표시되고 외부 리그 능력치는 서버 카탈로그 응답에서 숨겨짐을 확인했다.
- 배포 직전 읽기 전용으로 보관한 커리어와 배포 후 응답을 대조했다. revision 42, 선수 42명, 경기 기록 5건과 날짜·연도·구단·예산·수입/지출·전체 선수단/성적·순위·타순·코치진·달력이 동일하다. 검증은 GET만 사용했고 운영 경기 진행·계약 변경·커리어 초기화는 없다. 이번 배포 확인은 HTTP/API/제공 번들 기준이며 실제 브라우저 조작 검증은 포함하지 않는다.
- 요청에 따라 소유자 전용 Sites 배포는 실행하지 않았다. 전용 사이트는 기존 v23을 유지하며 이전에 저장한 v24는 미발행 상태다. 공개 사이트 반영의 남은 차단 사항은 없다.

### 2026-09-10 · 중단 작업 재개 — 감독 면접·계약과 장기 구단 운영

- 무직 시작, 무직 홈·개인 메뉴, 재직 중 공개/비공개 지원, 구단의 선제 연락을 연결했다. 감독 제안은 개인 제안 페이지에서 확인하고 전용 페이지의 6개 문답·운영 제안서·최종 후보 심사로 이어진다. 계약은 연봉/기간/순위 조건 제안 → 날짜별 답변 → 조건 합의 → 계약서 검토 → 서명/최종 확정으로 구분한다. 만료된 제안의 부활을 막고 답변 기한 임박 알림을 추가했다.
- 감독 계약서를 기존 선수 계약서의 협상실·조항·서명 디자인과 맞췄다. 연봉 입력의 내부 단위/백만원 표기 불일치를 고쳐 화면에 표시한 만원 금액과 서버 제안이 일치한다. 계약 단계별 버튼을 구분하고 무직 상태의 협상/서명 허용, 무직 홈 접근·가짜 소속 엠블럼, 탭 간격·체크박스·모바일 배치를 수정했다. 구단명은 선수단/일정/스태프/뉴스를 확인하는 구단 상세로 연결한다.
- 감독 이름은 D1 메타데이터의 확인된 KBO 10·MLB 30·NPB 12명으로 초기화한다. 무직 신임 감독은 기존 구단 감독 이름을 가져오지 않는다. 이외 리그의 생성 감독은 가상 인물이다. 감독 신임도/불화·성격·평가는 게임 상태이며 실제 인물에 대한 사실이 아니다.
- FM24 공식 [감독 홈/프로필](https://community.sports-interactive.com/sigames-manual/football-manager-2024/football-manager%E2%84%A2-2024-managerial-home-and-profile-r4955/)과 [구단 정보/이사회 평가](https://community.sports-interactive.com/sigames-manual/football-manager-2024/club-details-and-board-performance-r4963/)를 기준으로 개인 경력과 구단 비전을 정리했다. 면접 문맥은 [FM2017 실제 플레이 사례](https://www.fmshot.com/find-new-club-job-interview/)도 참고했으며 특정 FM 버전의 화면/문항 전체를 재현했다는 뜻이 아니다.
- AI 구단의 간소 경기 성적·주간 성장·포지션 수요에 따른 제한된 거래·감독 재선임과 은퇴 후 유망주 보충을 추가했다. 선수의 시즌/이적 구간 성적·수상·은퇴 기록은 D1 별도 테이블로 보관하고 은퇴 선수의 서버 검증된 코치 후보를 영입할 수 있다. 기록은 현재 커리어 계정에 격리하며 백업/복원에도 포함한다. AI 타수보다 안타가 많아지는 분배 오류와 이적 구간 중복 합산을 수정했다.
- 3명 대 3명+현금 트레이드, 날짜별 심사/역제안/확정, 한 시즌 3라운드 신인 선발을 추가했다. 계약·현금·보유권·포지션 정원을 서버에서 함께 검사한다. 드래프트 도중 사퇴/이직 시 남은 지명은 AI가 이어간다. 지명 순서·라운드·등록 규칙은 게임용 단순화이며 실제 각 리그 규정과 동일하지 않다.
- 부상 진단·회복 예정일·재활·조기 복귀/재발을 추가하고 수신함 진단에서 직접 선택하게 했다. 1군 주전의 단순 피로에는 1군 휴식을 권하며 2군 강등 추천과 분리했다. 불펜 몸풀기/준비/지침을 실제 교체 계산에 반영하고 경기당 몸풀기·작전·교체의 합산 40회 상한과 기존 타석 결정성을 보존했다.
- 구단 비전에 순위 외 유망주 출전·급여·흑자 목표와 달성 보상을 추가했다. 유망주 출전 목표는 경기 때 누적해 선수 이동으로 기록이 사라지거나 부풀려지지 않는다. 기존 다년 감독 계약은 연말 평가에서 단축하지 않는다.
- 경기 프리뷰/지휘 화면은 관리 사이드바와 상단 메뉴 없이 화면 전체 폭을 사용한다. 선수 상세도 왼쪽 메뉴를 숨긴다. 개발 서버는 API 코드를 함께 감시해 새 명령을 적용하려고 수동으로 번들을 다시 만들던 문제를 줄였다.
- 검증: 운영 빌드·타입 통과. 전체 150개 테스트 중 149개 통과 후, 기존 D1 경기 테스트가 준비 과정의 경기 수를 0으로 가정한 부분을 기존 기록+1/기존 원문 보존/재시도 동일성으로 수정했다. 해당 D1 19개 재검증은 전부 통과했다. 최종 통합 검사와 공개 발행 결과는 후속 기록에 남긴다.
- 실제 로컬 브라우저에서 무직 시작→삼성 연락→6개 문답/제안→조건 합의→계약서 서명→같은 날짜의 삼성 취임을 확인했다. 390px 경기 프리뷰는 가로 넘침 없이 관리 메뉴가 숨겨졌다. 모든 신기능을 브라우저에서 전수 검증한 것은 아니다.
- 한계: AI 성적/거래/신인 공급은 경량 게임 모델이다. 독립 리그 포스트시즌, 리그별 연도 전환과 남은 일정 보존, AI의 장기 급여·부채 정산, 수십 년 재정/성장 밸런스, 실제 전체 선수 최신성은 검증/구현이 더 필요하다. 특히 명시적 다음 시즌 명령은 세계 전체 연도를 함께 전환한다. 선수 사진과 3D 화면은 별도 작업으로 진행 중이며 이 기록의 완료 범위에 포함하지 않는다.
- 아직 이번 변경을 공개 사이트에 발행하지 않았다. 사용자 요청에 따라 기존 공개 Worker만 배포하며 소유자 전용 Sites 및 프로젝트 식별자는 유지한다.

### 2026-09-10 · 감독·장기 운영 기능 공개 배포 확인

- 서버/공통 e30c0f1, 감독·구단 UI 0b60515, 개발 API 감시 87d09546f5b4d244a24e0952ea766bbf8e0dfe4a를 구분해 커밋하고 지정 GitHub 인계 브랜치의 원격 SHA 일치를 확인했다. PR #19의 검사 통과 후 main 09f40b2f349088a7e3f28b2306d063a60a398ea0에 병합했다.
- Actions 34422510917의 포맷·lint·150개 테스트·타입·공개 Worker 배포가 성공했다. `/api/health`의 D1 상태와 카탈로그 v8을 확인했다. 소유자 전용 Sites는 배포하지 않았다.
- 공개 커리어를 읽기만 하여 이번 배포 직전의 별도 로컬 백업과 비교했다. revision 42, 선수 42명, 날짜/연도/구단/감독/예산/수입/지출/난수/시즌/타순/선발/경기 기록/전체 선수단/순위/소유권/코치/달력이 모두 동일했다. 운영 저장을 진행하거나 초기화하지 않았다.
- 재개한 로컬 QA에서도 무직 면접의 6문답·제안 심사 후 실제 UI의 조건 동의→계약서 검토→서명→최종 체결이 작동했다. 합의와 체결은 별도 상태이며 같은 날짜에 삼성으로 취임했다. 선수 사진/3D는 이 배포에 아직 포함하지 않았다.

### 2026-09-10 · 3D 경기장과 전체 화면 중계

- 실제 Claude 작업 결과를 통합해 잔디/흙/베이스/펜스/관중석/전광판/조명과 단순 인체 모델을 Three.js로 렌더링한다. 타구·주루·수비 이동은 기존 저장된 경기 장면에서 읽고 경기 결과를 다시 계산하지 않는다. 중계/전체 구장 카메라, 3D/2D 선택을 제공하고 모바일에서도 3D를 표시한다.
- 3D 코드는 경기장 진입 때 지연 로딩한다. 타석 전환마다 WebGL을 만들던 React key를 제거하고 재생 위치만 초기화한다. 픽셀 비율은 최대 1.5, 관중과 선수는 인스턴스 렌더링, 프레임 요청은 합쳐 실행한다. 장면 종료 시 텍스처/기하/재질과 프레임/리스너를 해제한다.
- 실제 브라우저 검토에서 재마운트한 canvas의 잃어버린 context를 재사용하는 문제를 찾아 각 마운트가 canvas를 생성/폐기하도록 수정했다. context 복원 시 캔버스가 다시 보이도록 하고 Three r186의 제거된 그림자 상수를 교체했다. 그늘진 관중석의 조명/관중과 전체 구장 카메라를 보완했다.
- 1440px PC와 390px 모바일 WebGL 장면, 카메라 변경과 다음 타석에서 동일 canvas 유지를 확인했다. context loss를 강제로 발생시킨 검증에서 2D로 전환되고 커리어 revision 16이 유지됨을 확인했다. 390px 화면의 scrollWidth도 390px이다. 타입·lint·포맷 검사 통과. 최종 빌드/회귀 검사는 사진 통합 후 후속 기록을 따른다.
- 이는 초기 절차 생성 3D 장면이며 FM/상용 야구 게임의 모델·모션·실제 구장 재현과 같은 수준을 주장하지 않는다. 장면의 연출 궤적은 저장된 타석 결과를 보여주기 위한 시각화다. 공개 배포는 아직 사진 통합을 기다린다.

### 2026-09-10 · KBO·MLB 선수 사진과 기존 저장 호환

- 회색 인물 기본 이미지를 등번호가 들어간 유니폼으로 교체하고 큰 이미지에는 ‘사진 없음’을 표시했다. 선수 명단과 전체 폭 상세 화면에 공식 사진을 연결하며 로딩 실패 시 기본 이미지로 돌아간다.
- KBO 공식 선수 검색의 구단·이름·등번호/포지션과 식별자를 대조한 362개 카탈로그 항목(고유 공식 선수 359명)을 D1 `catalog_meta.player_portraits`에 저장한다. 0015 마이그레이션은 선수 ID별 공식 ID·사진 URL·출처·확인일과 카탈로그 v9를 반영한다. 이미지 바이너리는 저장하지 않으며 브라우저가 공식 CDN을 불러온다. 런타임은 seed 파일을 읽지 않는다.
- MLB Stats API 공식 ID가 있는 698개 항목(MLB 소속 670개, MLB 기록이 있는 NPB 소속 28개)은 해당 ID의 공식 사진을 사용한다. NPB 전용 사진은 아직 연결하지 않았고 이적 전 유니폼이 보일 수 있다. 확인 근거가 부족한 KBO 6개 항목은 임의로 연결하지 않았다.
- 기존 커리어의 로스터·이적/협상 사본에는 응답 시 선수 ID로 최신 사진 메타데이터를 병합한다. 진행 중 경기의 GET만 이 경로를 빠지는 문제를 실제 브라우저에서 발견해 수정했다. 경기 준비·재계산과 저장 쓰기 없이 사진만 응답에 추가한다.
- 로컬 실제 브라우저에서 김지찬(진행 중 삼성 경기), 김도영, 오타니의 공식 이미지 로딩과 기본 이미지 전환을 확인했다. 삼성 기존 저장의 revision 16과 경기 진행 상태를 유지하며 로스터 37개에 사진이 연결됐다. 모바일 390px과 PC에서 가로 넘침 없이 표시된다.
- 사진 통합 시 운영 빌드와 전체 157개 테스트가 통과했다. 이후 추가한 D1 검증과 진행 경기 회귀를 포함해 사진 관련 10개 테스트가 통과했다. 기존 진행 경기의 저장 원문/revision 불변, 숨겨진 능력·서버 경기 입력 비노출, 공식 ID 매핑을 검사했다. 최종 CI와 공개 반영 결과는 후속 기록을 따른다.
- 카탈로그에 최형우·오스틴·강백호가 각각 두 항목으로 존재함을 공식 ID 대조로 확인했다. 같은 공식 ID를 공유하도록 사진을 연결했으며 이번 사진 변경에서 선수 항목이나 기존 성적을 임의 삭제/합산하지 않았다. 중복 선수 정리는 별도의 기존 저장/기록 이관이 필요하다. 전체 최신 로스터·사진 보유를 주장하지 않는다.

### 2026-09-10 · 공식 사진과 초기 3D 공개 반영 확인

- 3D 구현 16e9f609ddc7e4a1635541911cd8c502a93a4338과 공식 사진 8ad33dc106bcc35f838190bf148a527932da465a를 지정 GitHub 인계 브랜치에 푸시하고 SHA 일치를 확인했다. PR #20의 전체 160개 테스트/타입/lint/포맷 성공 후 main 96ab8fde09f08792f2a1a6730ff2714640913b7f에 병합했다. Actions 34424277345의 D1 0015 적용과 기존 공개 Worker 배포가 성공했다.
- 공개 `/api/health` 정상, 카탈로그 v9와 KBO 사진 메타데이터 362항목, 기존 롯데 로스터의 사진 34개를 확인했다. 별도 공개 브라우저에서 김지찬 공식 사진의 이미지 로딩/가로 넘침 없음과 기본 이미지 파일 200 응답을 확인했다. 외부 리그 능력치 마스킹도 유지된다.
- 배포 전 백업과 읽기 전용 비교에서 날짜/연도/구단/감독/예산/수입/지출/난수/시즌/타순/선발/경기 기록/선수단(사진 제외)/순위/소유권/스태프/달력은 동일했다. 검증 구간에 revision 42→43, 뉴스·catalogVersion·simulation 변화가 관찰돼 전체 저장 원문 동일이라고 주장하지 않는다. 검증 호출은 GET/화면 조회만 사용했다. 사진 GET 자체의 저장 원문 불변은 별도 D1 회귀 테스트에서 검증했다.
- 사용자가 초기 3D·2D 그래픽의 품질 부족과 선택 불가능한 프리시즌을 지적했다. 사진 배포와 별개로 장면·카메라·선수 가독성 보완과 프리시즌 선택을 후속 구현 중이다. 현재 초기 3D를 FM 수준의 모델/연출로 설명하지 않는다.

### 2026-09-10 · 2D 구장·선수 표시와 경기 화면 재정리

- 평면 마름모 구장을 둥근 내야 흙 경계, 잔디 패턴, 관중석/펜스/더그아웃과 홈플레이트가 있는 SVG 구장으로 교체했다. 기존 경기 좌표를 그대로 사용하며 정적인 구장 부분은 memo로 분리했다. 구장과 선수 레이어는 같은 viewBox를 사용한다.
- 선수 등번호/이름·포지션을 읽기 쉬운 표시로 바꾸고 1/3루수와 주자 이름의 겹침을 줄였다. 2D 전체 구장/선수 중심 확대를 제공하고 모바일은 확대를 기본으로 한다. 타구 궤적은 이미 지나온 짧은 구간만 표시하며 도착점을 미리 긋지 않는다.
- 경기 중 상단 제목과 복귀/전체화면 버튼을 한 줄로 줄여 구장에 더 많은 높이를 배정한다. 모바일과 전술 편집은 각각 맞는 배치를 유지한다. 타석 결과 배지·기록 목록과 모바일 타순 기록은 해당 플레이 연출이 끝난 뒤 표시한다.
- 1440px/390px 실제 브라우저에서 레이아웃·2D 확대·선수 표시를 확인했다. UI/리플레이 12개 테스트와 타입·편집 TSX lint 검사가 통과했다. 신규 UI 회귀는 플레이 중 결과를 숨기고 완료 뒤 보여주는 동작을 검사한다. 전체 통합 검사와 개선된 3D/프리시즌 발행 결과는 후속 기록을 따른다.

### 2026-09-10 · 2D 개선 공개 반영과 프리시즌 선택

- 2D 개선 7feb7c1ba622a0cb7805fadad24470d320ee3e9a는 PR #21로 main 2baab67eeeaac7e88187d41e62f7cc3a4ded328f에 병합했다. Actions 34425644658의 검사·기존 공개 Worker 배포 성공을 확인했다. 공개 D1 health와 사진 카탈로그 v9 정상, 기존 백업과 비교한 주요 커리어 필드 동일, revision 43을 읽기 전용으로 확인했다.
- 새 커리어에서 ‘프리시즌 4주부터’와 ‘정규시즌 개막부터’를 선택한다. 무직 시작에도 적용하며 해당 리그 개막일과 감독 계약/무직 시작 날짜가 함께 맞춰진다. 이전 요청에서 옵션이 생략된 경우에는 기존 프리시즌 시작을 유지한다.
- 기존 프리시즌은 홈·경기 준비·일정·전술과 진행 메뉴에서 코치에게 맡길 수 있다. 서버가 개막일까지 날짜별 연습경기·급여·부상 회복·세계 경기를 처리하며 기존 커리어를 초기화하지 않는다. 다음 시즌부터 개막일에 바로 시작하는 설정도 제공한다.
- 면접/감독 계약, 선수·코치 계약, 매각, 트레이드, 신인 선발의 답변이 대기 중이면 위임을 막는다. 새 제안이 도착하면 해당 날짜에서 멈추며 감독 결정을 대신 수락하지 않는다. 잘못된 날짜나 날짜 진행 실패도 거부한다. 무직·휴가·진행 경기의 구단 운영 제한을 유지한다.
- 위임 완료 후 오래된 의무팀 메일이 열리던 UI 오류를 검토 과정에서 수정했다. 390px 실제 브라우저에서 위임 대화상자→다음 시즌 설정→실행→‘프리시즌 위임 완료 · 개막 준비’ 메일을 확인했다. 개막일 day 0, regular, 연습경기 4회, 이후 프리시즌 false와 가로 넘침 없음을 확인했다. 별도 새 게임 UI에서 개막일 직접 시작과 계약 날짜도 확인했다.
- 프리시즌 엔진 7개 테스트와 D1 API 테스트를 추가했다. 옵션 검증·재시도 멱등성·오래된 revision 충돌·일별 처리·제안 중단/재개·이후 시즌 설정을 포함해 운영 빌드와 전체 169개 테스트가 통과했다. 최종 타입·lint·포맷 검사도 통과했다. 프리시즌 선택의 공개 반영은 후속 배포 기록을 따른다.

### 2026-09-10 · 3D 구장·관절 동작·중계 시점 보완

- 실제 Claude 작업의 구장/선수 개선을 이어받아 통합했다. 인체를 팔꿈치·무릎과 몸통 회전이 있는 부위로 나누고 배트·글러브와 투구 준비/다리 들기/스윙/달리기/포구/송구 자세를 추가했다. 홈 밝은 유니폼과 원정 팀색 유니폼, 모자·장비로 양 팀을 구분한다.
- 내야 흙과 잔디, 워닝트랙·파울라인·홈플레이트·타석, 주 관중석/지붕/더그아웃/벤치, 외야 관중석·광고·전광판·구장 주변을 보완했다. 투구는 투수 뒤의 중계 시점에서 보여주고 타격 후 타구/수비를 따라간다. 전체 구장 시점은 구장이 더 크게 보이게 조절했다.
- 브라우저 검토에서 내야 경계가 반대로 감기던 문제, 구장 밖까지 잔디 무늬가 덮이던 문제, 홈 뒤 광고의 좌우 반전을 수정했다. 제거된 Three 그림자 상수와 불가능한 수비 포지션 비교를 정리하고 교체한 관중/광고 텍스처를 즉시 해제한다. DPR 1.5 상한, 인스턴스 렌더링, 지연 로딩과 캔버스 재사용을 유지한다.
- 1440px/390px 실제 WebGL 화면에서 전체 구장·투구·타구 수비 시점과 다음 플레이의 동일 canvas 유지, 가로 넘침 없음, 수집된 브라우저 오류 없음을 확인했다. 최종 타입·lint·포맷 통과. 169개 전체 테스트가 통합 상태에서 통과했으며 이후 지면/유니폼의 시각 보정은 최종 CI에서도 검사한다.
- 협업 Claude 세션이 사용량 한도로 종료되어 남은 수정·검증을 직접 수행했다. 두 워커는 failed/exited를 확인했고 release가 identity_unproven으로 터미널 보존을 결정한 상태를 존중했다. 관련 없는 터미널을 강제 종료하지 않았다.
- 현재 모델은 코드로 만든 단순 인체이며 FM 수준의 에셋/모션 캡처 품질을 주장하지 않는다. 사용자에게 본격적인 모델·관절 애니메이션 에셋, 접촉 타이밍/발 접지, 구장 재질·조명과 모바일 최적화가 필요함을 설명했다. FM 공식 경기장 개선 설명과 Three.js 애니메이션 문서를 확인했다. 다음 품질 검증 단위는 구장 한 곳의 투구→타격→포구→송구 장면이다. FM 자산이나 라이선스가 불명확한 외부 모델을 가져오지 않았다.

### 2026-09-10 · 프리시즌·3D 공개 반영 확인

- 프리시즌 bbf2ea6과 3D 개선 5be740d4d52430d8dd7bc5738ba5a1aba119441e를 지정 GitHub 브랜치로 푸시하고 원격 SHA를 확인했다. PR #22의 전체 169개 테스트·타입·lint·포맷 통과 후 main 2e62cc04e7ee27d72dc5398f919af5a63c4c4577에 병합했다. Actions 34427013072의 기존 공개 Worker 배포 성공을 확인했다.
- 공개 새 게임 설정에서 프리시즌/개막일 시작 라디오를 실제 브라우저로 확인했다. 배포 직전의 별도 로컬 백업과 공개 커리어 GET을 비교해 revision 43과 전체 state가 동일함을 확인했다. 공개 세이브를 시작/진행/초기화하지 않았다.
- 사용자는 이후 작업을 단독으로 진행하고, 프론트엔드에 커스텀 훅을 활용하며 버전을 표시하도록 요청했다. 후속 변경으로 분리해 구현한다.

### 2026-09-10 · 프론트엔드 커스텀 훅 분리

- `usePreseasonDelegation`이 위임 대화상자의 상태, 중복 진행 제한, 요청/응답과 완료·중단 메일 이동을 담당하도록 분리했다. `GameScreen`은 화면 구성과 훅 연결에 집중하며 날짜 진행·계약 판단은 기존 서버 로직을 사용한다.
- `useStadium3D`가 지연 로딩, canvas 생성, 리사이즈 관찰, 최신 리플레이 반영, WebGL context 복구와 해제를 담당한다. 경기장 컴포넌트는 접근성 설명과 컨테이너만 렌더링한다.
- 실제 로컬 브라우저에서 훅을 통한 프리시즌 28일 위임→개막일→완료 메일과 다음 시즌 설정을 확인했다. 3D 다음 타석의 동일 canvas 유지, 2D 전환 시 canvas 제거, 3D 복귀 시 새 canvas 생성, 강제 context loss 후 2D 전환과 커리어 revision 16 유지를 확인했다. 390px 가로 넘침이 없다.
- 운영 빌드와 전체 169개 테스트, 타입·lint·포맷 검사가 통과했다. 게임 상태 변경 책임과 기존 동작을 유지하는 리팩터링이다. 공개 반영은 버전 표시와 함께 후속 기록을 따른다.

### 2026-09-10 · 프론트엔드 릴리스 버전 표시

- 루트 package.json/lock의 공개 릴리스 버전을 0.2.0으로 올리고 이를 단일 버전 값으로 사용한다. 공통 `AppVersion`으로 새 게임·사이드바·게임 하단에 DUGOUT v0.2.0을 표시하고, 도움말에는 빌드 식별자를 함께 표시한다.
- Vite 빌드 시 GitHub SHA 또는 로컬 Git SHA의 앞 7자리를 서버/브라우저 번들에 주입한다. 개발 서버는 -dev 접미사를 붙이고 Git 정보가 없으면 local로 표시한다. 환경 전체를 브라우저에 전달하지 않는다. 운영 번들에서 버전 0.2.0과 빌드 SHA가 실제 문자열로 치환됨을 확인했다.
- 390px 실제 브라우저에서 새 게임 하단·게임 하단·도움말 버전/빌드 표시와 가로 넘침 없음을 확인했다. 전체 169개 테스트와 운영 빌드가 통과했고, 게임 하단 표기 추가 후 타입·lint·포맷 검사를 다시 통과했다. 최종 공개 빌드 표시는 배포 후 실제 main SHA와 비교한다.
- 사용자의 커스텀 훅과 버전 표시 선호를 AGENTS.md에 기록했다. 버전은 프로그램 릴리스 정보이며 세이브 포맷이나 카탈로그 버전을 변경하지 않는다. 공개 반영은 후속 배포 기록을 따른다.

### 2026-09-10 · 모바일 상단 경로 줄바꿈 수정

- 버전 표시를 모바일에서 확인하던 중 좁은 상단 탐색 경로의 ‘수신함’이 한 글자씩 줄바꿈되어 높이 48px을 차지함을 발견했다. 경로를 한 줄로 유지하고 넘치는 내용을 잘라 상단 높이를 보존한다.
- 390px 브라우저에서 해당 경로 높이 16px, scrollWidth 390px을 확인했다. 스타일 포맷 검사와 diff 검사를 통과했다. 0.2.0 공개 전 점검에 포함한다.

### 2026-09-10 · v0.2.0 커스텀 훅·버전 표시 공개 배포 확인

- 훅 분리 f46af16, 버전 표시 5a5bb53, 모바일 경로 수정 6e20a9c223239394c30f0ea5fefbd19f6c80b445를 구분해 커밋하고 지정 GitHub 브랜치의 원격 SHA 일치를 확인했다. PR #23의 최종 전체 169개 테스트·타입·lint·포맷 통과 후 main 320d8bf8b317c8972f5e1af723fbb43432d7bd2c에 병합했다.
- Actions 34428206319의 검사와 기존 공개 Worker 배포가 성공했다. 공개 브라우저에서 DUGOUT v0.2.0과 빌드 320d8bf가 실제 배포 SHA에 일치함을 확인했다. 390px 새 게임과 도움말의 버전/빌드 표시, 가로 넘침 없음, 수집된 브라우저 오류 없음도 확인했다.
- 공개 `/api/health` 정상. 별도 배포 전 백업과 읽기 전용 비교에서 revision 43과 전체 state가 동일했다. 검증을 위해 공개 커리어를 시작·진행·초기화하지 않았다. 비공개 Sites는 배포하지 않았고 기존 호스팅 프로젝트 식별자를 유지했다.
- 이번 릴리스는 프리시즌 선택/위임, 2D·3D 개선, 사진, 커스텀 훅과 버전 표시를 포함한다. 상용 FM 수준의 3D 모델·모션 에셋 제작은 완료한 것으로 기록하지 않는다. 본격적인 모델/애니메이션 작업에도 현재 TypeScript/Three.js 구조를 활용할 수 있음을 사용자에게 설명했다.

### 2026-09-10 · 공개 Worker 1102 CPU 초과 긴급 진단·API 경량화

- 사용자 제공 Ray `a38b0abe8f02c12a`를 실제 Workers Observability에서 대조했다. 02:35:54 UTC `GET /`가 CPU 18ms, `exceededCpu`로 실패했고, 직전 `/api/career` POST 5건도 CPU 10~15ms에서 실패했다. 해당 시간대 삼성 면접 화면 이동과 정상 저장 요청 CPU 77ms가 관찰됐다. 메모리 초과나 프리뷰/사운드 미배포 변경의 장애로 분류하지 않는다.
- NestJS DI·컨트롤러·서비스·D1 저장을 유지하고 Node HTTP 서버/Express 브리지를 Worker의 Request/Response로 교체했다. JSON을 한 번만 파싱하며 스트림을 읽는 도중 기존 12KB/백업 이전 8MB 바이트 제한을 적용한다. 라우트·POST 201/복구 200·예외 상태·HEAD·세션 쿠키·요청 출처 검사를 유지한다. 사용하지 않는 Nest Express transport를 Worker 번들에서 제외한다.
- 저장 동작 이름만 로그에 기록하여 다음 장애에서 Ray와 동작을 대조할 수 있게 했다. 복구 키, 면접 답변, 저장 원문이나 사용자 식별자는 기록하지 않는다. 프로그램 버전은 0.2.1이다.
- 운영 빌드와 전체 170개 테스트가 통과했다. 새 Worker transport 회귀는 잘못된 경로/식별자/JSON, 배열 입력, 멀티바이트 크기 제한, 콘텐츠 형식, 출처와 HEAD를 검사한다. 실제 공개 CPU 개선과 배포 결과는 후속 기록을 따른다.
- 현재 실행 제한은 Workers Free 10ms와 일치하며, 일시적인 초과 허용이 끝나면 정상 요청도 중단되는 공식 동작과 일치한다. API 경량화만으로 날짜 진행·시즌 시뮬레이션을 포함한 모든 요청의 10ms 준수를 보장하지 않는다. Workers Paid 전환 또는 서버 연산 구조의 추가 변경이 남은 안정성 조건이다. 구독을 임의 변경하지 않았다.

### 2026-09-10 — 무료 플랜 유지, 면접·계약 대화의 D1 부분 저장

- 사용자 지시로 Cloudflare 무료 플랜을 유지한다. 유료 전환과 CPU 한도 증액을 적용하지 않았다. 1차 Native Nest 전송 계층 경량화는 PR #24 / Actions 34431307041로 공개 배포되었다.
- 면접 답변, 초청 수락, 운영 제안서 제출, 철회, 계약 수정 제안과 조건 동의는 대화에 필요한 필드만 D1에서 추출한다. 전체 세계 카탈로그, 선수단, 경기 기록의 파싱·복제·재계산·관계형 투영을 생략한다.
- 기존 도메인 대화 처리를 추출해 전체 저장과 부분 저장이 동일한 질문·검증·협상 규칙을 사용한다. D1의 저장 버전 비교와 요청 ID 기록은 원자적으로 커밋하며, 이미 처리한 응답 재시도와 뒤늦은 요청 충돌을 구분한다.
- 프론트의 저장·불러오기·진행 상태를 `useCareerSession`으로 분리했다. 같은 실패 작업을 다시 누르면 같은 요청 ID를 사용하며, 부분 응답은 정확히 일치하는 저장 버전에만 합친다. Cloudflare HTML 오류를 JSON 문법 오류 대신 복구 안내로 표시한다. Redux/useReducer를 도입하지 않았다.
- 검증: 기존 170개 테스트와 신규 응답 병합 테스트 통과. 신규 D1 흐름 검증에서 다른 사용자의 오래된 버전 요청은 409라는 기존 계약에 맞춰 테스트 기대값을 바로잡았으며, 최종 검증 결과는 아래에 기록한다.
- 한계: 날짜 진행·새 시즌·최종 취임·전체 커리어 조회는 여전히 전체 저장 경로다. 무료 CPU 제한 내 모든 작업의 안정성을 보장하지 않으며, 경량 경로의 공개 CPU 수치는 배포 후 별도로 확인한다.
- 최종 로컬 검증: 프로덕션 빌드 완료, 기존·응답 병합 172개 통과 및 기대값 수정 후 D1 대화 흐름 1개 재검증 통과(총 173개). ESLint 통과. D1 대화 테스트는 6문항, 초청/제안서/조건 동의, 재전송, 낡은 버전, 다른 사용자, 동시 요청, 무직 유지, 나머지 저장 필드와 관계형 테이블 보존을 확인했다. 공개의 사전에 보관한 검증 대상 저장은 GET만 사용해 revision 43과 전체 상태 일치를 확인했다.

### 2026-09-10 — 리그별 선수 기록 순위

- `리그 · 세계`에 팀 순위 / 선수 기록 순위 / 구단 선수단을 나란히 배치했다. 현재 선택한 리그의 타율·홈런·타점·안타·도루 및 평균자책점·승리·탈삼진·세이브·홀드 순위를 제공한다.
- 이미 받은 시즌 기록으로 정렬하며 항목·페이지·리그 전환은 추가 API 호출을 하지 않는다. 선수와 구단을 눌러 상세 화면으로 이동할 수 있다. 상태와 정렬은 커스텀 훅으로 분리했다.
- 공동 순위, 미출전 제외, 20명 단위 페이지 이동, 규정 타석·이닝 필터와 미달 표시를 추가했다. 무직 감독에게 팀 순위의 기준 구단을 MY로 표시하던 부분도 수정했다.
- 검증: 기록 계산 테스트 2개(작은 표본 제외, 누적 기록 순위, 동률, 무아웃 ERA 제외, 아웃 수 기반 이닝) 및 타입·린트 통과. 로컬 독립 저장을 진행해 모바일 390×844에서 20개 행과 가로 넘침 없음(문서 폭 390 / 표 368)을 확인했고 타자·투수 전환 및 선수 상세 링크를 확인했다.
- 집계 한계: 현재 소속 구단별 시즌 기록이며 이적 전 타 리그 성적을 분리하지 않는다. 타 구단 일반 경기는 기존 간이 기록을 사용한다. 규정은 게임의 팀 경기당 3.1타석(반올림)·1이닝 기준이다. 타석은 현재 저장되는 AB+BB+SH 합계이며 각 리그의 수위 타자 예외까지 구현한 것은 아니다. MLB 공식 기록 안내를 확인했다: https://www.mlb.com/glossary/standard-stats/rate-stats-qualifiers
- 이전 최적화의 로컬 브라우저 검증: 실제 면접 답변 버튼이 responseMode=patch 요청을 보내고 2,290자 응답(revision 6)으로 다음 질문을 표시했으며 오류 토스트가 없었다. PR #25는 CI 173개 테스트 통과 후 main에 병합되었다.
- 최종 검증: v0.2.3 프로덕션 빌드 및 전체 175개 테스트 통과. 모바일 선수 이름 클릭 후 `/players/real-3100049847?from=world`의 나균안 상세 화면으로 이동했고 브라우저 오류가 없었다.

### 2026-09-10 — 공개 무료 면접 CPU 실측

- v0.2.2 배포 후 별도의 공개 QA 게스트 커리어(`무료성능검증`)를 만들고 정상 지원 → 면접 6문항을 진행했다. 기존 사용자의 저장은 변경하지 않았다.
- 03:17:52~03:17:55 UTC 면접 6건을 각각의 Cloudflare Ray와 대조했다. CPU는 3, 2, 2, 2, 2, 2ms, outcome은 모두 ok였다. 응답은 3,230~4,902바이트로 확인했다. 무료 요청당 10ms 한도 아래인 것은 이 여섯 면접 요청의 실측이며 전체 기능에 대한 보장은 아니다.
- 공개 QA 기준 Ray: a38b48368bb07515, a38b483a7c327515, a38b483e6cde7515, a38b48427d4b7515, a38b48466dd47515, a38b484a9e557515. 초기 생성·날짜 진행은 기존 전체 저장 경로로 구분했다.

### 2026-09-10 — 화면 이동 시 반복 조회 감소

- 선수·구단·면접 화면 이동마다 `/api/catalog`와 `/api/career`를 다시 읽던 초기 로딩을 `useGameResources`로 분리했다. 같은 탭에서 30초 안의 이동은 메모리에 있는 서버 응답을 재사용하고, 동시에 시작한 초기 조회는 한 번만 실행한다.
- 저장에 성공하면 메모리의 커리어 버전도 함께 갱신한다. 스카우트 관찰 범위·리그 지식·소속 등이 바뀌면 재조회하며, 먼저 시작한 낡은 조회가 새 저장을 덮어쓰지 못하게 처리한다. 새로고침과 복구 키를 통한 세션 변경은 새 문서에서 다시 조회한다. 메모리에는 인증 키를 보관하지 않으며 로컬 저장 파일도 생성하지 않는다.
- 검증: 조회 공유·30초 만료·저장 버전 갱신·관찰 범위 변경·낡은 조회 경합 테스트 2개 통과. 타입·린트 검사 통과. 공개 면접 경량화 PR #25 배포는 Actions 34432264432 성공을 확인했다.
- 최종 검증: 프로덕션 빌드 및 전체 177개 테스트 통과. 독립 로컬 브라우저에서 리그 선수 순위 → 선수 상세로 실제 이동한 뒤 초기 API 재조회 0회를 확인했다(정상 상세 화면 표시). 이 메모리는 실시간 동기화를 대신하지 않으며 다른 탭의 변경은 재조회 또는 revision 충돌 시 반영된다.

### 2026-09-10 — 전체 화면 경기 센터·모바일 타순·현장 사운드

- 경기 진입은 전체 화면 프리뷰로 열고, 양 팀 선발 명단과 감독·구단 정보, 선수·전술 확인, 플레이볼을 제공한다. 중계·전술·전황·문자 중계·타순을 경기 센터 안에서 전환한다. 모바일 타순 전용 화면은 구장을 접어 양 팀 9명씩과 투수를 한 화면에 표시한다.
- 재생 상태·속도·일시정지·장면 시계·스태디움 설정·음성/효과음·보관 경기 재생·선수 현황을 각각 커스텀 훅으로 분리했다. Redux/useReducer를 사용하지 않는다. 사용하지 않던 모바일 별도 재생 타이머와 내부 강제 스크롤을 제거했다.
- 일시정지와 숨김 상태에서 장면 진행을 멈추며, 로컬 재생 위치에는 완료한 플레이만 기록한다. 텍스트 중계와 효과음은 장면 진행에 맞춰 공개하고 볼넷·삼진에는 타격음을 내지 않는다. 2D 투구 이동을 릴리스 시점에 맞췄고 3D는 타격 뒤 장거리 카메라 비행 대신 고정 중계 위치로 컷한다.
- Web Audio로 관중·투구·타격·포구·득점 소리를 합성한다. 기본은 꺼짐이며 사용자 클릭 뒤에만 시작하고 화면 이탈 때 정리한다. 기기의 한국어 TTS를 선택해 1×/2×에서 결과를 읽을 수 있으며 4×/8×에서는 밀린 음성을 중단한다. 외부 음성 API, 유료 플랜, 외부 녹음 파일을 추가하지 않았다.
- 검증: v0.3.0 프로덕션 빌드와 전체 179개 테스트·타입·린트·포맷 통과. 새 중계 테스트는 최종 결과·환호 공개 경계, 볼넷/삼진의 타격음 배제, 도루와 타석 구분을 확인한다.
- 로컬 브라우저: 390×844 프리뷰에서 양 팀 18명 표시, 타순 18개 행의 위치 185~500px 및 내부 세로 스크롤 없음, 문서 폭 390px을 확인했다. 공 좌표가 일시정지 600ms 동안 동일했고 완료 전 저장 위치 0 → 재개 후 결과 공개와 위치 1을 확인했다. 다음 플레이는 위치 2와 희생타 결과, 한국어 유나 음성/텍스트 중계를 확인했다.
- 사운드 켜기 전 AudioContext 생성 0개, 켠 후 suspended → 재생 중 running → 전술 화면에서 suspended와 음성 중단을 확인했다. 오프라인 렌더로 48,000 프레임, peak 0.079 / RMS 0.0056의 유효한 합성 음향 출력을 확인했다. FM급 녹음 해설이나 상용 캐릭터·모션 캡처 그래픽 품질을 주장하지 않는다.

### 2026-09-10 — v0.3.0 공개 배포 및 무료 최적화 검증 완료

- PR #24, #25, #26, #27을 구분해 무료 API/대화 저장 최적화, 선수 기록 순위, 화면 이동 중복 조회 감소를 공개 반영했다. 이어 PR #28의 두 CI 검사 모두 전체 179개 테스트·타입·린트·포맷을 통과한 뒤 main `152107b542510c006d2b77b396820b8647eb49ce`에 병합했다. Actions `34433869249`의 검사 및 기존 공개 Worker 배포 성공을 확인했다.
- 공개 독립 QA 커리어로 무직 시작 → 비공개 지원 → 면접 6문항 → 제안서 제출 → 최종 제안 → 조건 동의 → 계약서 서명/최종 체결 → 삼성 취임 → 다음 날/경기 시작(revision 18)을 확인했다. 조건 동의는 부분 저장, 무직 유지, CPU 3ms / ok(Ray a38b638bffbfdd1c)였다. 최종 서명은 정상 취임·홈으로 이동했고 오류 알림이 없었다. 기존 사용자의 저장을 QA로 사용하지 않았다.
- 공개 v0.2.4에서 선수 기록 순위 20개 행을 확인했고, 최종 v0.3.0에서 메뉴 없는 전체 화면 프리뷰와 삼성/SSG 선발 명단을 확인했다. 390×844 프리뷰에 양 팀 18명이 모두 보이며, 중계 타순 화면도 18개 행의 마지막 위치 약 500px, 문서 폭 390px, 사이드바 없음, 수집된 브라우저 오류 없음이다. 중계 하단에 DUGOUT v0.3.0을 확인했다.
- 배포 후 공개 health는 정상이며, 사전 보관한 사용자 검증 대상은 읽기 전용 비교에서 revision 43 및 전체 상태 일치를 유지했다. 검증을 위해 생성/진행한 공개 데이터는 별도 `무료성능검증` QA 게스트 커리어뿐이다. 호스팅 프로젝트 식별자 및 무료 플랜을 유지했다.
- 남은 범위: 날짜 진행·시즌 전환·최종 취임 등의 전체 저장 경로와 최초 SSR/전체 카탈로그 조회는 요청별 무료 CPU 한도 충족을 모두 검증한 것이 아니다. 구단 변경 후 홈의 최근 경기에는 이전 감독 커리어 경기가 섞일 수 있어 현재 구단 필터를 별도 보완할 필요가 있다. 상용 FM 모델/모션·녹음 해설 및 완전한 최신 실명 로스터를 구현했다고 주장하지 않는다.

### 2026-09-10 — v0.4.0 경기 지휘·모바일·선수 운영 통합 개선

- 완료한 타석만 기준으로 다음 타자·아웃·주자를 계산한다. 2사 1·2루에서 전준우 대타를 지시해도 이미 본 기록을 유지하고 다음 타자부터 재계산하는 회귀를 추가했다. 일시정지 직후 예약된 재생을 즉시 취소하고 최종 결과는 장면 완료 시점에 공개한다.
- 3D 화면·Three.js를 제거하고 2D 중계로 통일했다. 득점 기회/실점 위기 자동 정지를 각각 체크하며 두 항목을 끄면 연속 진행한다. 사인 확정·이전 사인 재사용은 서버 반영 후 자동 재개하고, 재사용 가능 여부는 현재 주자·아웃으로 다시 검증한다. 타자 컨택/장타/공 오래 보기, 불펜 2타석 준비·직접 교체·긴급 투입 설명을 추가했다.
- 하단 중복 다음 플레이·선수·전술·사인 버튼을 정리하고 재생/일시정지와 중계 설정으로 줄였다. 준비 화면은 앱 메뉴 없이 열고 모바일 타순은 9명 모두 표시한다. 사인 카드의 밝은 배경 위 글자 대비를 수정했다.
- 선수 검색은 이름으로 찾는 팝업으로 제공한다. 모바일 하단에 날짜 진행과 핵심 바로가기를 두고, 스카우트 명칭을 통일하고 상세 메뉴를 선수단/영입/구단 운영으로 통합했다. 모바일 모달은 VisualViewport의 키보드 높이·이동을 반영하며 이중 위치 보정을 제거했다.
- 경기 전후 인터뷰의 질문·태도별 답변 카드·전달 전 미리보기·지난 기록을 정리하고 상태/제출/포커스를 커스텀 훅으로 분리했다. Redux/useReducer를 추가하지 않았다.
- 방출은 보장 급여 정산액을 확인한 뒤 서버에서 1회 처리한다. 기존 기록/선수 ID를 유지하고 FA로 이동하며 재영입 금지는 두지 않았다. 타 구단 계약 선수와 직접 연봉 협상을 차단하고 동일 리그 트레이드 또는 FA 계약으로 연결했다. 과거 방식의 진행 중 계약도 서명 우회를 차단한다. 이전 제안과 상대 현재 조건을 비교하며 부대 비용은 접어 표시한다.
- 코치 보고서는 성적 기준·실제 기록·체력·교체 이유를 분리한다. 통상적인 선발 피로만으로 2군행을 권하지 않는다. 기존 보고서의 당시 기록을 새로 지어내지는 않는다.
- 계약금은 선수 연봉의 15%→5%, 코치 50%→10%로 조정했다. 기본 시즌 지원 기준은 급여의 85%→95%로 완화하며 기존 저장은 앞으로의 지원분만 1회 조정한다. 승인 급여 예산/추가 지출/현금 부족에 따른 이사회 감점을 서버 평가와 재정 화면에 연결했다. 같은 날 반복 감점·메일 중복을 방지하며 지출 개선 시 감점이 줄어든다. 실제 리그의 계약법·회계 규정이 아닌 게임 균형 규칙이다.
- 롯데 손성빈(포수, 28번, 2002-01-14)과 공식 사진 ID 51528을 D1 순방향 마이그레이션 0016으로 추가했다. 증거: https://www.koreabaseball.com/Record/Player/HitterDetail/Total.aspx?playerId=51528 . 기존 커리어는 진행 중 경기의 명단을 고정하고 다음 명단 동기화에서 2군으로 추가하며, 이적/방출 소유권은 보존한다. 전체 최신 등록 명단의 완전성을 주장하지 않는다.
- 검증: 프로덕션 빌드와 전체 187개 테스트 통과. D1 카탈로그/계약/시즌 저장, 방출 중복·낡은 조건·진행 경기 차단, 대타/사인 과거 기록 보존, 재정 감점·회복, 기존 지원금 1회 전환을 포함한다. 타입·린트 통과. 로컬 D1 0016 적용 성공.
- 독립 QA 브라우저: 모바일 검색 결과 30개에서 모달 x=12..378, y=12..832 (390×844), 문서 폭 390 확인. 타자 사인 확정 시 서버 revision 3 / timelineVersion 2, 소비 위치 15 유지, 팝업 닫힘과 연속 재생 위치 17을 확인했다. 사용자 커리어를 QA로 변경하지 않았다. 최종 공개 배포 결과는 후속 기록에 남긴다.
- 무료 플랜과 기존 호스팅 프로젝트 식별자를 유지한다. 날짜 진행·경기 재계산 등 전체 저장 경로의 모든 요청이 무료 CPU 한도 아래임을 보장하지 않는다. 공개 배포 대기 상태이며 이번 변경의 추가 배포 승인은 사용자가 명시했다.

### 2026-09-10 — 제한 오류 안내 및 마지막 모바일 검증

- 연속 기회에서 ‘공 오래 보기’ 재사용을 눌러 서버 revision 4 / timelineVersion 3에 두 번째 명령(cursor 24)이 저장되고 팝업 없이 재생이 이어지는 것을 확인했다. 안내문 색상은 rgb(32,51,77), 배경 rgb(237,243,255)로 대비를 확인했다.
- 모바일 중계 설정을 화면 가장자리 안에 고정했다(x=12..378, y=609..776, 390×844). 득점 기회만 해제한 저장값 `{opportunity:false,threat:true}`를 확인했다. 하단에는 감독 결정 대기/재생과 중계 설정만 남는다.
- 1102/5xx/429·연결 실패에는 ‘일시적으로 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.’로 안내한다. 확인된 1027 일일 요청 제한은 한국 시간 오전 9시 초기화를 별도로 안내한다. 실패 요청의 기존 재시도 ID·버전 검사는 유지한다. 관련 응답 테스트 3개 통과, 전체 기준은 188개다.
- 공식 문서 https://developers.cloudflare.com/workers/platform/limits/ 에서 1102는 요청당 CPU 제한으로 고정 대기 시간이 없고, Free 일일 요청 100,000건은 00:00 UTC에 초기화됨을 확인했다. 안내는 로딩된 앱의 API/네트워크 오류에 적용되며, 최초 문서 자체가 Cloudflare 오류 페이지로 대체되는 상황까지 앱이 제어한다고 주장하지 않는다.

### 2026-09-10 — v0.4.0 공개 배포 및 초기 자동 정지 표시 수정

- PR #29의 전체 188개 테스트·타입·린트·포맷 통과 후 main `8ad714878c4d4fd26b1ff6197115b54287d4cedd`에 병합했다. Actions `34438545412` 검사 및 기존 공개 Worker 배포 성공, 공개 `/api/health` 정상 및 D1 카탈로그 v10을 확인했다. 유료 전환과 별도 사이트 배포는 하지 않았다.
- 독립 로컬 QA에서 두 자동 정지 항목을 끄고 연속 진행했으며 기회·위기 cursor 52→63을 통과했다. 하지만 득점 기회 cursor 52에서 새로고침하면 체크 두 개는 false인데 초기 재생 대기를 ‘자동 일시정지’라고 표시하는 사용자 증상을 재현했다.
- 초기 재생 대기·직접 정지·화면 이탈·자동 정지의 이유를 구분한다. 체크 표시와 판정은 같은 저장 소스를 사용하며 같은 프레임의 변경·다른 탭의 저장 변경도 반영한다. 현재 자동 정지 항목을 해제하면 사용자 클릭으로 재생을 이어가며 직접 정지/초기 대기는 임의 재개하지 않는다. 현재 설정을 문장으로 표시한다.
- 브라우저에서 수정 후 cursor 52 재접속은 ‘재생 대기’, 두 항목 해제 시 위기를 넘어 cursor 63까지 연속 진행, 실점 위기만 켜면 cursor 32 정지, 해당 체크 해제 시 cursor 34까지 자동 재개, 득점 기회만 켜면 cursor 51 정지를 확인했다. 검증은 별도 QA 커리어에서만 수행했다. 프론트 버전 0.4.1이며 공개 반영 결과는 후속 기록을 따른다.

### 2026-09-10 — v0.4.1 공개 반영 및 주간 훈련 개편

- PR #30의 전체 188개 검사 통과 후 main `b34e4a3e5d4cb02b9084163b1cfc5c9b24cb43cf`에 병합했다. Actions `34439762686` 공개 배포 성공 및 기존 공개 health 정상을 확인했다.
- FM 공식 훈련 매뉴얼(https://community.sports-interactive.com/sigames-manual/football-manager-2024/training-r4961/)의 주간 세션·위임·개인 강도·코치 담당·회복 구조를 참고했다. 야구의 연전과 2군 연습경기에 맞춰 1군/2군 별도 주간 일정, 오전/오후/추가 세션, 6개 프로그램, 4주 이내 편집을 구현했다. 실제 경기 시간은 세션 변경으로 제거할 수 없다.
- 코치 위임은 경기 전 준비와 경기 후 회복을 배치한다. 감독 수동 계획은 위임 중 보관한다. 컨디션별 자동 휴식·절반 강도, 기존 개인 목표·휴식 요일·멘토, 전문 코치 배정과 중복 담당 부담, 훈련 시설을 연결했다. 상태·편집·제출은 커스텀 훅으로 분리하고 개인 훈련 폼의 훅도 추출했다.
- 날짜 진행 때 소속 선수의 훈련 부담을 한 번 계산해 성장·회복·부상 위험·전술/포지션 숙련도·휴식 사기에 사용한다. 단순히 계획을 저장해 능력이 오르지 않으며 휴식은 훈련 성장을 중단한다. 경기 출전 경험과 나이에 따른 하락은 별도 반영한다. 7일의 실제 결과를 한 번만 집계해 주간 보고와 수신함에 남기고 이력 크기를 제한한다.
- 과거 저장은 기존 팀 훈련 방향을 기본 프로그램으로 이어받는다. 구단 이동 시 훈련 계획은 해당 구단에 남기고 새 구단에서 섞이지 않으며, 시즌 전환은 지난 수동 날짜와 미완성 집계를 정리한다. 새 D1 조회·주기적 폴링·외부 서비스·유료 구독을 추가하지 않았다.
- 훈련은 선수단 하위 탭으로 제공하고 코치 화면의 즉시 적용 5개 버튼은 훈련 센터 연결로 통합했다. 모바일은 날짜별 3개 세션을 가로 넘침 없이 보여주고 변경 중에만 저장 바를 고정한다.
- 검증: 프로덕션 빌드와 전체 193개 테스트 통과(새 훈련 5개 포함). 잘못된 날짜·세션·외부 코치·경기 중 편집, 구단별 계획, 위임 복원, 경기 시간 확보, 실제 성장/회복, 낮은 컨디션에서 강한 개인 훈련 무시, 중복 성장/보고 차단, 저장 복원 결정성을 검사했다. 이전 개인 훈련 테스트의 저체력 강훈련 기대값은 자동 휴식 우선 규칙에 맞췄다. 시즌 전환 정리는 후속 전체 검사에 포함한다.
- 독립 로컬 QA: 주간 세션 클릭→타격·선구안 선택→저장 후 revision 9, 2026-03-30 계획과 날짜 유지 확인. 모바일 390px 문서 가로 넘침 없음, 훈련 선택 모달은 390×420에서 x=16..374/y=12..408로 표시된다. 개인 훈련과 코치 전문도는 게임 모델이며 FM의 모든 세부 종목·멘토링 규칙과 동일하다고 주장하지 않는다. 버전 0.5.0, 공개 배포는 후속 변경과 최종 검사 뒤 진행한다.

### 프리뷰 스타일을 구단 화면 전체로 확장 · 0.5.1

- 경기 프리뷰의 짙은 청록 배경, 구분되는 카드 표면, 연두색 강조를 공통 디자인 토큰으로 적용했다. 홈은 구단 헤더와 현황 카드를 재구성하고 선수단, 수신함, 스카우트, 훈련, 감독 채용, 인터뷰, 계약 협상의 고정 밝은 색상을 공통 토큰에 연결했다.
- 모바일 하단 진행 버튼, 검색 모달, 알림, 경기 준비와 선수 교체 화면의 대비를 정리했다. 최종 서명용 계약서와 제안서는 독립적인 종이색/글자색을 유지한다. 경기장 그림과 재생 동작은 변경하지 않았다.
- 검증: 프로덕션 빌드, typecheck, lint 통과. 격리된 로컬 QA 커리어에서 PC 1440px 홈/수신함, 모바일 390px 선수단/스카우트/인터뷰/선수 검색 모달을 확인했다. 문서 너비 390px, 검색 모달 x=12px/너비366px로 화면 안에 표시되고 브라우저 오류가 없었다. 최종 배포는 PR 검증 후 진행한다.
- 이전 훈련 개편 PR #31은 main d03a36285f735b4f5f3aa102d8cd6bdf60c86b4f로 병합되었다. Actions 34441225716의 테스트와 기존 공개 Worker 배포가 성공했고 공개 /api/health 정상 응답을 확인했다. 무료 플랜 설정은 유지했다.

### 화면 배치와 작업 동선 재구성 · 0.5.1 추가

- 사용자가 색상 변경이 아닌 구조 변경을 요청한 점을 반영했다. 큰 페이지 제목, 별도 전역 검색 행, 여러 줄 부메뉴를 제거하고 상단 검색 + 단일 화면 전환 바를 도입했다. 모바일은 해당 그룹의 화면 선택 메뉴 하나로 이동한다.
- 선수단: 목록과 오른쪽 업무 패널을 분리했다. 전체/1군/2군 범위, 이름 검색, 포지션만 전면에 두고 성장·정렬·컨디션·상세 열은 필터 메뉴로 옮겼다. 상태/정렬 로직을 useSquadBrowser에 분리했다.
- 홈: 다음 경기와 최근 결과를 중앙에, 처리할 일·재정·선수단 현황·리그 순위를 오른쪽 업무 영역에 배치했다. 수신함은 분류/목록/본문의 3열 작업 화면으로 바꾸고 모바일은 목록과 본문을 전환한다. 선택/읽음 처리 로직을 useInboxWorkspace로 옮겼다.
- 스카우트: 진행 중인 임무·보고·관심 명단을 중심에 놓고 새 파견 양식을 별도 작성 모달로 분리했다. 파견 성공 시 임무 목록으로 돌아온다.
- 브라우저 검증: 격리 QA의 PC 홈/수신함과 모바일 선수단/스카우트를 확인했다. 390px에서 선수 목록 시작점은 기존 약 680px에서 279px로 올라왔고, 새 파견 모달은 y=200~644px 안에 표시된다. 이후 선수 표 열 폭과 성장 표시를 추가로 압축했다. 데이터 처리와 경기 진행은 서버 명령을 유지한다.
- 최종 검증: 프로덕션 빌드 및 전체 193개 테스트, typecheck, lint 통과. 모바일 이름 검색으로 김원중 1명만 표시되는 것과 등록 버튼 오른쪽 끝 369px(390px 화면 내)을 확인했다. 브라우저 오류가 없었다. PR #32를 화면 구조 개편 내용으로 갱신하고 배포한다.

### 일반 화면 밝게, 사이드바·경기 화면 어둡게

- 사용자가 구조 개편은 유지하되 일반 화면은 밝은 배경을 선택했다. 옅은 회색 바탕/흰색 패널/짙은 녹색 동작 버튼으로 조정하고 왼쪽 탐색 메뉴와 경기 프리뷰는 어두운 팔레트로 분리했다. 경기 전용 색상은 해당 영역에 한정해 일반 화면 토큰에 영향을 받지 않도록 했다.
- PC 홈/수신함과 모바일 선수단을 다시 확인했다. 모바일 문서 폭 390px, 첫 선수 y=279px, 초기 화면에 선수 6명이 표시되고 브라우저 오류가 없다. 색상 변경 후 프로덕션 빌드도 통과했다.

### 2026-09-10 — v0.5.1 공개 반영 확인

- PR #32의 밝은 일반 화면·어두운 사이드바/경기 화면과 구조 개편을 main `e9506e63e0d75f42171262533edb96ef1586d863`에 반영했다. Actions `34443149266`의 검증 및 기존 공개 Worker 배포 성공, 공개 `/api/health` 정상 응답을 확인했다.

### 2026-09-10 — 선수 등록 공시와 경기 전 코치 제안

- 선수단/리그에서 오늘·어제·최근 7일 등록 공시를 구단과 이름으로 조회한다. 실제 1군 말소/2군 등록 및 1군 등록/2군 말소를 하나의 이동으로 기록하며, 이유·결정 주체·재등록 가능일을 표시한다. 기존 저장에는 과거 공시나 말소 날짜를 만들어 넣지 않는다.
- KBO 정규시즌 말소 후 10일, NPB 10일, MLB 야수 10일/투수 15일의 재등록 제한을 서버와 화면에 적용했다. 직접 등록, 맞교체, 코치 추천, 새 구단 화면 초기화에서 제한을 우회하지 않는다. 3월 30일 말소→4월 9일 가능처럼 달력 날짜로 계산한다. KBO 2026 등록 정원은 29명으로 반영했다.
- 타 구단은 경기 일정에 맞춰 최대 3일에 한 번 선수단을 점검한다. 성적 표본을 충족한 부진·치료 필요·기존 2군 활약에 따른 같은 포지션 교체와 등록 공석 보충을 실제 경기 명단에 반영한다. 일반적인 등판 피로만으로 말소하지 않는다. 공시는 최근 30일/최대 600건으로 제한하고 경기에서 이미 읽은 명단을 재사용한다.
- 경기 당일 코치가 다음 상대의 공개 최근 득점, 선수 컨디션·기량·시즌 성적을 근거로 추천 선발 9명·타순·선발 투수를 수신함에 제안한다. 피로에 따른 선발 휴식과 성적/기량 비교를 구분하며, 메일에서 일괄 적용·기존 명단 유지·직접 수정 화면 이동을 제공한다. 부상/등록/경기 일정이 바뀐 보고는 재검증하고 다시 추천받을 수 있다. 같은 경기 메일은 중복 발송하지 않으며 이미 진행한 경기에는 적용할 수 없다.
- 권고만 새로 도착한 경기 날짜는 기존 경기 준비 중단 흐름을 유지한다. 무직 감독에게 소속 구단 추천을 보내지 않는다. 다음 시즌의 오래된 부상과 이적/은퇴 선수 등록 ID를 정리해 유효한 개막 명단을 만든다.
- 검증: 등록 5개·코치 명단 4개 회귀를 추가하고 기존 날짜 진행/정원 검사를 보완했다. 전체 202개 테스트 및 프로덕션 빌드, 타입·린트·포맷을 통과했다. 격리된 로컬 QA에서 김진욱 말소 저장(revision 11), 즉시 재등록 400 및 4월 9일 안내, 모바일 공시 표시, 수신함 추천 적용(revision 13)의 타순 일치와 수비 10개 위치를 확인했다.
- 규칙 근거: [KBO 2026 규약 제27조](https://6ptotvmi5753.edge.naverncp.com/KBO_FILE/ebook/pdf/2026_%EC%95%BC%EA%B5%AC%EA%B7%9C%EC%95%BD.pdf), [KBO 2026 등록 인원 안내](https://koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=11814), [NPB 등록 공시](https://www.npb.or.jp/announcement/roster/), [MLB 옵션 규칙](https://www.mlb.com/glossary/transactions/minor-league-options).
- 범위: 부상 대체/더블헤더의 특별 재등록 예외와 MLB 옵션 연차는 아직 모델링하지 않는다. 확인하지 않은 리그에는 대기기간을 임의로 적용하지 않으며 전체 리그의 정원·규칙 일치를 주장하지 않는다. 타 구단의 새로운 2군 리그 전체 경기 시뮬레이션을 추가한 것은 아니다. 추천은 보유한 기록과 기량에 기반하며 좌우 상대전적 등 없는 데이터를 만들어내지 않는다. 무료 플랜과 기존 호스팅 식별자를 유지한다.

### 2026-09-10 — v0.5.2 타순·수비 작업 화면과 경기 사인 대비

- 타순·수비 탭을 PC의 압축 타순표/선발 투수·수비·벤치 보드로 재구성하고 팀 지시를 아래에 배치했다. 모바일은 타순/수비 전환 버튼으로 바로 이동하며 390×844에서 9명의 타순을 표시한다. 타순 변경/수비 선택은 커스텀 훅으로 분리했다.
- 타순 편집 중에는 모바일의 하단 경기 진행 버튼을 접어 적용 버튼을 가리지 않게 한다. 기존 투수 운용과 전술 보관함 기능은 유지한다.
- 경기의 이전 사인 안내 카드에 고정된 밝은 색을 제거하고 경기 전용 색상을 따른다. 재사용 버튼은 연두 바탕/짙은 글자, 안내문은 어두운 바탕/밝은 글자로 수정했다.
- 브라우저: 격리 QA에서 모바일 타순 변경 후 저장(revision 14, 윤동희/황성빈 순서 교환), 두 번 클릭으로 좌익수/중견수 교환(revision 15), 390px 문서 폭 및 오류 없음 확인. 경기 사인 DOM 색상 검증은 안내문 #eef4f5/#142027, 버튼 #15221a/#bcf16b를 확인했다. 실제 경기 재진행 없이 같은 클래스의 별도 시각 검증으로 확인했다.
- 최종 빌드/전체 202개 테스트/타입·린트·포맷 통과. UI와 선수단 기능을 각각 커밋하며 공개 v0.5.2 반영을 준비한다.
- 추가 확인: 사용자가 다시 장애를 보고하여 v0.5.1 공개 `/` 요청의 HTTP 503/1102를 재현했다. `/api/health`는 200이다. 새 기능은 아직 공개 배포하지 않았으며, 현재 공개 버전의 초기 화면 처리 비용을 우선 점검 중이다.

### 2026-09-10 — 초기 화면 1102 재발 대응

- 공개 v0.5.1의 `/` 요청에서 HTTP 503 / `error code: 1102`를 재현했고 health API는 200이었다. 후속 공개 요청은 200으로 회복했으나 Worker tail에서 초기 화면 처리 CPU 48ms를 확인했다. 다른 두 요청은 응답 대기 중 취소됐다. 이를 일일 전체 요청 한도 소진으로 단정하지 않는다.
- 모든 게임 진입 페이지가 작은 클라이언트 진입 컴포넌트를 사용하도록 분리했다. 실제 게임 UI는 `next/dynamic`의 `ssr: false`로 브라우저에서 불러오며, Worker는 로딩 안내만 렌더한다. 기존에도 커리어/카탈로그 조회는 브라우저에서 인증된 API로 수행했으며 이 경로와 서버 계산·저장 방식은 유지한다.
- 새 프로덕션 Worker 검사는 최초 HTML, 전술 쿼리/선수/면접/경기 경로 및 연결된 JS·CSS 자산의 200 응답을 확인한다. 전체 203개 테스트 및 빌드·타입·린트 통과. 무료 CPU 상향이나 유료 전환은 하지 않았다. 공개 재배포 후 실제 진입과 CPU를 다시 확인한다.
