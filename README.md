# DUGOUT · 월드 베이스볼 매니저

공개 Cloudflare Worker에서 브라우저별 게스트 커리어를 운영하도록 구성했습니다. 배포 주소는 [DUGOUT](https://baseball-manager.kkwondev.workers.dev)이며 실제 배포·이전 상태와 검증은 [WORKLOG.md](WORKLOG.md)에 기록합니다.

[기존 비공개 Sites 앱](https://dugout-world-manager.kkwondev.chatgpt.site)은 별도 원본 데이터로 보존합니다.

실명 선수와 생성 선수로 구단을 운영하는 한국어 야구 매니지먼트 게임입니다. 구단 선택 → 4주 프리시즌·선수단 정비 → 경기·시즌 진행 → 협상·이적 → 재계약·다음 시즌까지 플레이할 수 있습니다.

폴더별 책임과 빌드 경로는 [구조 문서](docs/architecture.md)에 정리했습니다.

## 기술 구성

| 영역 | 구현 | 소스 |
| --- | --- | --- |
| 프론트엔드 | Vinext, React 19, TypeScript, Tailwind CSS, shadcn/ui | `apps/web/app` 라우팅, `apps/web/src/features` 화면 |
| 백엔드 | NestJS Controller → Service → Repository | `apps/api/src` |
| 공통 타입·조회 함수 | 화면과 서버의 데이터 계약 | `packages/shared/src` |
| 런타임 | Cloudflare Workers, Node HTTP 호환 브리지 | `infra/cloudflare/worker/index.ts`, `apps/api/src/worker.ts` |
| 데이터베이스 | Cloudflare D1 / SQLite, Drizzle 스키마·마이그레이션 | `apps/api/db/schema.ts`, `apps/api/drizzle` |

NestJS의 기본 Express 어댑터를 Workers의 `httpServerHandler`에 연결합니다. Vinext와 NestJS는 소스·책임을 분리하고, 현재 배포에서는 같은 Worker의 `/api/*` 요청을 NestJS에 전달합니다. 별도의 상시 실행 Node 서버는 필요하지 않습니다.

개인 Cloudflare 계정의 Worker/D1과 기존 Sites 관리형 환경은 별도입니다. 공개 앱은 임의 사용자 헤더를 폐기하고 브라우저별 게스트 쿠키를 사용합니다. `/saves`에서 개인 복구 키를 보관하면 브라우저 데이터 삭제 후 또는 다른 기기에서 같은 커리어를 열 수 있습니다. 복구 키는 Git에 저장하지 않습니다.

`main` 검증 후 같은 빌드 산출물로 D1 마이그레이션과 Worker 자동배포를 진행합니다. 브랜치·PR은 검증만 수행합니다. [배포 문서](docs/deployment.md)를 참고하세요.

## 플레이할 수 있는 기능

- **13개 리그·137개 구단:** KBO, MLB, NPB, CPBL, LMB, LMP, ABL, LIDOM, LVBP, LBPRC, 네덜란드, 이탈리아, 체코.
- **선수 4,503명:** 실명 데이터 2,042명 + 생성 선수 2,461명. 부족한 2군 포지션은 커리어 시작 시 가상 아카데미 선수로 보충합니다. 시즌 전환 시 신인 생성·노쇠화·계약 만료 반영.
- **4주 프리시즌:** 주 1회 연습경기, 개막일 정지, 정규 성적과 분리. 새 커리어에서 첫 시즌 외부/FA 영입 금지 옵션을 선택할 수 있습니다. 재계약·매각·코치 선임은 허용합니다.
- **1군·2군:** 1군 28명 등록 한도, 승격·말소, 3일 간격의 별도 육성 경기·성적·성장.
- **전술 보관함:** 타순·선발·수비·팀 지시를 이름 붙여 5개까지 저장. 수비 배치는 드래그 또는 선수→위치 클릭으로 변경합니다. 개인 포지션 훈련과 숙련도가 수비력에 반영됩니다.
- **투수 보직:** 전술 화면의 투수 운용 탭에서 선발 로테이션·필승조·추격조·일반 불펜·마무리를 편성합니다. 선수단 보직 필터와 선수 상세에서도 확인·변경하며, 체력·이닝·점수 차에 따라 자동 교체에 반영합니다. 보직도 저장 전술에 포함됩니다. 기존 진행 경기는 시작 당시 교체 규칙으로 끝까지 재개합니다.
- **타석 단위 경기 진행:** 서버가 한 타석씩 계산하고 D1에 저장합니다. 2D 구장에서 재생·일시정지·속도를 선택하고 새로고침 후 이어갈 수 있습니다. 완료된 경기만 최종 성적·순위·회계에 반영하며 더블헤더는 한 경기씩 진행합니다.
- **독립 선수 페이지:** `/players/[id]`에 프로필·공식/게임 성적·계약·사기·포지션 숙련도·보직을 모았습니다. 출루·선구안·삼진 회피 등 세부 능력과 타순별 추천 이유를 표시합니다. 미측정 수비·송구·구종·구속은 미평가로 구분합니다.
- **잠재력 선택 공개:** 새 커리어에서만 공개 여부를 선택하며 기본값은 숨김입니다. 기존 커리어도 옵션이 없으면 숨기고, API 응답 전체에 적용합니다. 내부 성장 계산과 시장 가격은 유지됩니다.
- **공식 구단 로고 134개:** 구단 선택·순위·일정·경기·선수 페이지에 적용했습니다. 출처 미확인/접근 불가인 Collecchio·Neptunus·Tucson은 구단 약칭을 표시합니다.
- **실명 코치 96명 + 가상 코치 20명:** 등록 소속과 출처 제공, 게임 보직을 선택해 선임.
- 단축/정규 길이 시즌, 홈·원정 일정, 타석별 경기 계산, 이닝 기록, 순위, 포스트시즌, 다음 시즌.
- 타순·선발·공격 전술, 선수 검색·정렬, 에이전트 협상·역제안·영입·매각·재계약.
- 타격·투수·수비·체력·스카우트 코치, 훈련, 성장·컨디션, 급여·수입·영입 비용과 거래 장부.
- 커리어 자동 저장·불러오기, 오래된 경기 기록 재생, 사용자별 데이터 분리.

## 데이터베이스

실행 중 리그·구단·선수·에이전트·코치는 D1에서 읽습니다. JSON 명단을 프론트에 하드코딩하거나 서버의 임시 메모리를 저장소로 사용하지 않습니다. `apps/api/seed`의 원본 데이터는 SQL 마이그레이션 생성에만 사용합니다.

17개 테이블에 카탈로그, 일정, 선수, 계약, 코치, 협상, 순위, 경기 기록, 이적, 재정 장부, 명령 이력을 저장합니다. 커리어 스냅샷도 함께 유지해 시뮬레이션을 이어 갑니다. 관리 명령과 경기 완료는 같은 D1 트랜잭션에서 스냅샷과 관계형 데이터를 갱신합니다. 진행 중 타석은 스냅샷·revision·명령 이력만 저장해 전체 선수·계약·재정 행을 다시 쓰지 않습니다. revision 검사와 request ID로 충돌·중복 결제를 방지합니다. 오래된 타석별 기록은 경기 테이블에 보존합니다.

카탈로그를 수정할 때는 해당 행과 `catalog_meta`의 `version`을 함께 갱신해야 캐시가 새 데이터를 읽습니다. 기존 커리어의 계약과 시즌 성적은 보존됩니다. 화면의 새 명단 반영 버튼 또는 다음 관리 행동에서 누락된 소속 실명 선수를 추가하고 1군·2군을 편성합니다. 커리어 안에서 이루어진 이적은 되돌리지 않습니다. 전술·2군 경기 요약은 커리어 스냅샷, 개인 숙련도·2군 성적은 선수 JSON에 저장합니다.

Forward migrations 0009 (2025 ratings v2), 0010 (logo columns) and 0011 (catalog v7) preserve 0000-0008 and career rows. Runtime model refresh preserves fractional development and freezes player inputs during active games. See WORKLOG for production application status.

## 개발·검증

Node.js 22.13 이상과 macOS/Linux의 `bash`를 사용합니다. 빌드 제한 시간은 Node로 처리하므로 GNU `timeout`이 필요하지 않습니다. `npm ci`는 두 환경에서 사용할 수 있고, 선택적인 `npm run install:ci` 잠금 도우미만 Linux의 `flock`에 의존합니다.

```bash
npm ci
npm test                 # NestJS + Vinext 빌드 후 전체 테스트
npm run typecheck
npm run lint
npm run format:check
npm run test:engine      # 빠른 게임 규칙 테스트
npm run dev
```

Tests run the production Worker with isolated migrated D1, covering ownership, concurrent commands, accounting, PA persistence, archives, SSR, logos and guest transfer. Browser checks cover guest creation/recovery, match pause/reload/completion, player pages and desktop/mobile layouts. Production load and exhaustive accessibility or league-rule parity have not been verified.

Frontend composition is in `apps/web/src/features/career/game.tsx`; each feature has its own directory under `features`. Server game rules remain in `apps/api/src/domain`. Formatting excludes generated data, historical migrations and vendor sources.

`npm run dev`는 격리된 로컬 D1에 마이그레이션을 적용한 뒤 게스트 모드로 시작합니다. 로컬 저장은 `apps/web/.wrangler` 아래에 유지되며 Git에서 제외합니다. 통합 테스트는 매번 별도 D1을 사용합니다.

```bash
npm run db:generate      # 스키마 변경 시 마이그레이션 생성
python3 scripts/rebuild-performance.py # 보존한 공식 원본으로 2025 성적 스냅샷 검증
```

이미 적용된 SQL을 편집해도 운영 DB에 재적용되지 않습니다. 데이터 갱신은 `scripts/append-migration.mjs`를 사용해 새 파일과 스냅샷·journal을 추가하세요. 성적/로고 생성기는 같은 이름의 마이그레이션을 다시 만들면 중단합니다. 과거 seed/KBO 생성기는 초기 자료 재현용이며 운영 업데이트에 재실행하지 않습니다.

| API | 역할 |
| --- | --- |
| `GET /api/health` | NestJS·D1 연결 상태 |
| `GET /api/catalog` | D1 리그·구단·선수·에이전트·코치 |
| `GET /api/career` | 사용자 커리어·revision·재정 장부 |
| `POST /api/career` | 검증된 게임 명령, revision·requestId 포함 |
| `GET /api/career/matches/:id` | 해당 사용자에게 속한 경기 기록 |

## 실제 데이터와 구현 범위

MLB·NPB 명단과 KBO 등록 명단에 실명을 사용합니다. KBO는 2026-09-07 공식 1군 등록 331명과 기존 명단을 병합했습니다. 다른 리그는 생성 선수 중심이며, KBO도 전체 명단은 아닙니다. 능력치·잠재력·연봉·계약·일부 포지션은 게임용 설정입니다. 에이전트는 가상 인물입니다. KBO 실명 코치의 이름·등록 소속·코치 신분은 공식 자료이며, 전문 보직·능력·연봉은 게임 설정입니다. 생년 정보를 확인하지 못한 선수는 게임 나이로 표시합니다. 공개 명단의 소속·나이는 갱신 시점에 따라 달라질 수 있고, 겨울리그 구성에는 2025–26 정보가 포함됩니다.

2026 MLB·NPB·KBO 일정은 공식 날짜를 바탕으로 하며, KBO 우천 취소/재편성을 그대로 재현하지는 않습니다. 다른 리그·차기 시즌·단축 시즌은 생성 일정입니다. 공통 상위 4팀 포스트시즌과 단순화된 계약·이적 마감을 사용합니다. 국가별 외국인 한도, 포스팅, 보상 선수, 드래프트, 국가별 실제 2군·마이너리그 규정, 실제 MLB 지구별 포스트시즌, 부상·은퇴는 아직 구현하지 않았습니다.

투수 교체는 이닝 사이 자동 결정입니다. 승·세이브·홀드를 분리하지만 짧게 던진 선발 뒤 구원 승리 투수는 게임 효율 점수로 선정하며 공식 기록원의 재량·자책점 규칙을 완전히 재현하지 않습니다. 정규경기는 12회 제한, 포스트시즌은 최대 30회 후 게임 승부치기입니다. 진행 화면은 서버에서 요청한 타석까지만 계산하고, 보관된 경기 재생은 확정 결과를 보여줍니다. 애니메이션 궤적은 실제 트래킹 데이터가 아닙니다.

실명 선수 평가는 2025 KBO·MLB·NPB 공식 성적 3,398건을 바탕으로 표본 크기를 보정합니다. 전체 현재 로스터나 모든 세부 능력을 검증한 데이터베이스는 아닙니다. 미확인 성적과 미측정 능력은 미평가로 남깁니다.

공개 명단 참고: [MLB 구단 명단](https://www.mlb.com/team), [NPB 등록 선수](https://npb.jp/announcement/roster/), [KBO 전체 등록 현황](https://www.koreabaseball.com/Player/RegisterAll.aspx). MLB·NPB 항목의 원문 주소는 `apps/api/seed/real-rosters.json`, KBO 원본 사실은 `apps/api/seed/kbo-register-2026-09-07.json`에 보관합니다. 구단 로고 출처·해시·권리 안내와 누락 사유는 [로고 목록](apps/web/public/club-logos/manifest.json)에 있습니다. 공식 출처 확인은 재사용 허락을 의미하지 않습니다. 선수 사진은 포함하지 않습니다.

## 작업 이력

구현 단위로 커밋하고 `theo-ooooo/baseball-manager`에 푸시합니다. 세션별 변경·검증·제약은 [WORKLOG.md](WORKLOG.md)에 기록합니다. Sites 소스 저장소는 사용자 GitHub와 별개의 배포 목적지입니다.
