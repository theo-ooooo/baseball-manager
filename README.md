# DUGOUT · 월드 베이스볼 매니저

[테스트 사이트 열기](https://dugout-world-manager.kkwondev.chatgpt.site) · 본인 ChatGPT 계정으로 로그인 · 비공개

실명 선수와 생성 선수로 구단을 운영하는 한국어 야구 매니지먼트 게임입니다. 구단 선택 → 라인업·훈련 → 경기·시즌 진행 → 협상·이적 → 재계약·다음 시즌까지 플레이할 수 있습니다.

## 기술 구성

| 영역 | 구현 | 소스 |
| --- | --- | --- |
| 프론트엔드 | Vinext, React 19, TypeScript, Tailwind CSS, shadcn/ui | `apps/web`; `app`은 라우팅·메타데이터 진입점 |
| 백엔드 | NestJS Controller → Service → Repository | `apps/api/src` |
| 공통 타입·조회 함수 | 화면과 서버의 데이터 계약 | `packages/shared/src` |
| 런타임 | Cloudflare Workers, Node HTTP 호환 브리지 | `worker/index.ts`, `apps/api/src/worker.ts` |
| 데이터베이스 | Cloudflare D1 / SQLite, Drizzle 스키마·마이그레이션 | `db/schema.ts`, `drizzle` |

NestJS의 기본 Express 어댑터를 Workers의 `httpServerHandler`에 연결합니다. Vinext와 NestJS는 소스·책임을 분리하고, 현재 배포에서는 같은 Worker의 `/api/*` 요청을 NestJS에 전달합니다. 별도의 상시 실행 Node 서버는 필요하지 않습니다.

현재 테스트 사이트는 **ChatGPT Sites가 관리하는 Cloudflare 환경**을 사용합니다. 사용자의 개인 Cloudflare 계정에 배포됐다는 뜻은 아닙니다. 개인 계정으로 옮길 때는 D1·배포 인증뿐 아니라 사용자 인증도 연결해야 합니다. Sites 밖의 공개 Worker에서 임의의 `oai-authenticated-user-id` 헤더를 신뢰하면 안 됩니다.

## 플레이할 수 있는 기능

- **13개 리그·137개 구단:** KBO, MLB, NPB, CPBL, LMB, LMP, ABL, LIDOM, LVBP, LBPRC, 네덜란드, 이탈리아, 체코.
- **선수 4,362명:** 실명 데이터 1,812명 + 생성 선수 2,550명. 시즌 전환 시 신인 생성·노쇠화·계약 만료 반영.
- 단축/정규 길이 시즌, 홈·원정 일정, 타석별 경기 계산, 이닝 기록, 순위, 포스트시즌, 다음 시즌.
- 타순·선발·공격 전술, 선수 검색·정렬, 에이전트 협상·역제안·영입·매각·재계약.
- 타격·투수·수비·체력·스카우트 코치, 훈련, 성장·컨디션, 급여·수입·영입 비용과 거래 장부.
- 커리어 자동 저장·불러오기, 오래된 경기 기록 재생, 사용자별 데이터 분리.

## 데이터베이스

실행 중 리그·구단·선수·에이전트·코치는 D1에서 읽습니다. JSON 명단을 프론트에 하드코딩하거나 서버의 임시 메모리를 저장소로 사용하지 않습니다. `apps/api/seed`의 원본 데이터는 SQL 마이그레이션 생성에만 사용합니다.

16개 테이블에 카탈로그, 선수, 계약, 코치, 협상, 순위, 경기 기록, 이적, 재정 장부, 명령 이력을 저장합니다. 커리어 스냅샷도 함께 유지해 시뮬레이션을 이어 갑니다. 모든 변경은 같은 D1 트랜잭션으로 스냅샷과 관계형 데이터를 갱신하며, revision 검사와 request ID로 충돌·중복 결제를 방지합니다. 오래된 타석별 기록은 경기 테이블에 보존해 저장 스냅샷이 계속 커지지 않게 합니다.

카탈로그를 수정할 때는 해당 행과 `catalog_meta`의 `version`을 함께 갱신해야 캐시가 새 데이터를 읽습니다. 기존 커리어 소속 선수의 진행 상태는 그대로 보존됩니다.

## 개발·검증

Node.js 22.13 이상과 Linux 환경을 기준으로 합니다. 스크립트는 `bash`, `flock`, GNU `timeout`을 사용합니다.

```bash
npm ci
npm test                 # NestJS + Vinext 빌드 후 전체 테스트
npm run typecheck
npm run test:engine      # 빠른 게임 규칙 테스트
npm run dev
```

전체 테스트는 실제 배포 Worker 번들을 Miniflare에 올리고 D1 마이그레이션을 적용합니다. NestJS HTTP 라우팅, 사용자별 저장, 동시 영입 충돌, 중복 명령, 계약·코치·이적·회계 행, 전체 시즌과 다음 시즌, 경기 기록 보존, DB 변경 반영, 한국어 SSR과 정적 자산 응답을 확인합니다. 실제 브라우저 클릭 테스트나 운영 부하 테스트와는 구분됩니다.

일반 로컬 브라우저에는 Sites 로그인 정보가 없으므로, 커리어 저장은 인증된 테스트 사이트에서 사용합니다. 통합 테스트에서만 격리된 런타임에 테스트용 인증 헤더를 주입합니다.

```bash
npm run db:generate      # 스키마 변경 시 마이그레이션 생성
npm run db:seed:generate # 원본 명단에서 기존 초기 시드 SQL 재생성
```

이미 적용된 마이그레이션은 운영 DB를 수정하지 않습니다. 배포 후 데이터 갱신은 새 마이그레이션으로 추가하세요.

| API | 역할 |
| --- | --- |
| `GET /api/health` | NestJS·D1 연결 상태 |
| `GET /api/catalog` | D1 리그·구단·선수·에이전트·코치 |
| `GET /api/career` | 사용자 커리어·revision·재정 장부 |
| `POST /api/career` | 검증된 게임 명령, revision·requestId 포함 |
| `GET /api/career/matches/:id` | 해당 사용자에게 속한 경기 기록 |

## 실제 데이터와 구현 범위

MLB·NPB 명단과 일부 KBO 선수는 실명입니다. 다른 리그는 생성 선수 중심이며, KBO도 전체 명단은 아닙니다. 능력치·잠재력·연봉·계약·일부 포지션은 게임용 설정입니다. 에이전트와 코치는 가상 인물입니다. 공개 명단의 소속·나이는 갱신 시점에 따라 달라질 수 있고, 겨울리그 구성에는 2025–26 정보가 포함됩니다.

현재 리그들은 공통 일정·포스트시즌·계약 규칙을 사용합니다. 국가별 외국인 한도, 포스팅, 보상 선수, 드래프트, 마이너리그, 실제 MLB 지구별 포스트시즌, 부상·은퇴는 아직 구현하지 않았습니다. 투수 교체·불펜 운용은 단순화되어 있고, 경기 재생은 이미 계산된 결과를 보여줍니다. 모든 공식 리그 규정을 구현한 상용 FM 수준의 완성본은 아닙니다.

공개 명단 참고: [MLB 구단 명단](https://www.mlb.com/team), [NPB 등록 선수](https://npb.jp/announcement/roster/), [KBO 선수 기록](https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx). MLB·NPB 항목의 원문 주소는 `apps/api/seed/real-rosters.json`에 보관합니다. 구단 로고·선수 사진은 포함하지 않습니다.

## 작업 이력

구현 단위로 커밋하고 `theo-ooooo/baseball-manager`에 푸시합니다. 세션별 변경·검증·제약은 [WORKLOG.md](WORKLOG.md)에 기록합니다. Sites 소스 저장소는 사용자 GitHub와 별개의 배포 목적지입니다.
