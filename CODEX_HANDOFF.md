# Codex 인수인계 — DUGOUT / baseball-manager

## 현재 후속 작업 — 2026-09-08 구조·게스트·배포

추가 지시로 폴더·컨트롤러 분리, 미사용 코드 삭제, 공개 Cloudflare 자동배포, 게스트 저장, UI 단순화와 직접 사용 검증을 구현했다. 실제 배포와 기존 커리어 이전 결과는 최신 WORKLOG를 따른다. 아래 “배포 요청 없음/브라우저 미검증” 문장은 이전 체크포인트 기록이다.

- 프론트는 `apps/web` 하나이며 API는 `apps/api`, 공유 계약은 `packages/shared`, 배포는 `infra`에 있다. `examples`, 루트 `app`, `types`, `vendor`, `worker` 및 미사용 starter UI·의존성을 정리했다.
- AppController를 health/catalog/career/career-transfer/session으로 분리했다. 게스트 복구는 `/saves`, 데이터는 사용자별 D1에 유지한다.
- 원본 Sites identity와 DB는 보존한다. 개인 Cloudflare 계정을 확인했고 신규 D1을 사용한다. Zero Trust는 사용자 결정으로 사용하지 않는다.
- GitHub 배포 자격증명을 등록했고 `main` 검증 후 같은 산출물로 자동배포한다. 로컬 Wrangler OAuth 오류가 있어 배포는 GitHub의 별도 토큰을 사용한다.
- 공개 Worker 주소는 `https://baseball-manager.kkwondev.workers.dev`다. 첫 `main` 자동배포(run `34196591204`)와 12개 마이그레이션 적용을 확인했고, 기존 커리어 revision 42와 선수·계약·성적·기록을 복사·검증했다. 원본 DB/비공개 백업은 보존했고 임시 이전 키는 제거했다. 이후 배포 버전은 최신 WORKLOG를 확인한다.
- 투수 운용은 전술 화면의 별도 탭이며 필승조·추격조·일반 불펜을 추가했다. 기존 진행 경기는 시작 당시 교체 규칙으로 재개한다. 상세 검증과 적용 범위는 최신 WORKLOG를 따른다.
- 사용자 피드백으로 화면 구조를 다시 설계했다. 메뉴와 카드는 흰색, 바탕은 그라데이션 없는 회색 단색이며 다음 경기·선수 관리·처리할 일을 중심으로 보여준다. 홈은 `features/career/dashboard.tsx`와 `styles/dashboard.css`에서 관리한다. 공통 색상은 `globals.css`의 `:root`, 어두운 구장 점수판 글자는 별도 `--stadium-fg`를 사용한다. 앞으로 커밋 메시지와 PR 제목·설명은 한글로 작성한다.
- 1군·2군 등록 화면은 `features/squad/reserve-panel.tsx`로 분리했다. 28명 정원이나 포지션 최소 인원 때문에 단순 이동이 막히면 같은 화면에서 교체 선수를 고른다. `squad` 명령의 선택적 `replaceId`로 한 번에 저장하고, 나머지 타순·수비·투수 보직을 유지한다. 상세 설명과 검증 결과는 최신 WORKLOG를 따른다.

> 폴더 재구성 후 현재 경로는 `docs/architecture.md`를 참고한다. 아래 과거 기록의 루트 `app/`, `db/`, `drizzle/`는 각각 `apps/web/app/`, `apps/api/db/`, `apps/api/drizzle/`로 이동했다.

## Codex 후속 작업 — 2026-09-08 현재

사용자가 이 브랜치에서 남은 개발·DB 마이그레이션·검증·기능별 커밋/푸시와 가독성 개선을 요청하여 작업을 재개했다. **아래 과거 WIP 기록에 앞서 이 절과 최신 WORKLOG를 적용한다.** GitHub 브랜치에 후속 구현을 완료했으며 운영 사이트/main은 변경하지 않았다.

| 인계 항목 | 후속 구현 |
| --- | --- |
| 선발·불펜·마무리 | 수동/기존 선발 보존, 저장 전술 보직, 더블헤더 선발, 승·세이브·홀드 분리. 뒤 투수의 역전 허용에도 앞 투수의 홀드 유지 |
| 타석 단위 경기·2D | D1 재개, 중복 요청/동시 revision, 완료 원자성, 더블헤더/포스트시즌 검증. 타석 저장은 전체 관계형 데이터를 다시 쓰지 않음. 최종 타석 장면 유지 |
| 잠재력 | 선수/시장/협상/이적/API 충돌 응답에 숨김 적용, 서버 원본·가격 보존, 기존 커리어 기본 숨김 |
| 능력·타순 | 세부 능력·미평가·타순 추천 이유 연결. v1→v2 소수점 성장분과 계약·소유권·성적 보존 |
| 선수 페이지 | `/players/[id]`, `/?view=...`, 복귀 링크, 누락 선수 처리, 프로필/성적/계약·에이전트 연결 |
| 로고 | 공식 원본 134/137개, 출처·해시 포함. Collecchio·Neptunus·Tucson은 약칭 대체 |
| D1 | 0009 성적 v2, 0010 로고 컬럼, 0011 로고·catalog v7. 0000–0008과 기존 커리어 행 보존 |
| 코드 정리 | 기능별 화면, 서버 시뮬레이션/진행 명령 분리, 소스 포맷·미사용 코드·React 상태 정리, lint/format CI 추가 |

검증은 생산용 Worker 번들의 격리된 Miniflare/D1 실행, SQL 업그레이드, 게임 규칙, SSR·자산 응답, React 정적 렌더링을 포함한다. 최종 테스트 수와 GitHub CI 결과는 최신 `WORKLOG.md`에 기록한다. 브라우저 조작/시각 QA·운영 부하·운영 DB 변경은 수행하지 않았다.

Cloudflare Workers + D1 구성을 유지하며 `.openai/hosting.json`의 기존 프로젝트 ID와 DB 바인딩도 보존했다. 이번 후속 지시는 코드 작업과 GitHub 푸시이며 배포를 요청하지 않았다. 운영 사이트는 기존 Sites 관리형 Cloudflare 배포 상태이고, 개인 계정 이전/운영 마이그레이션 적용은 미수행이다. 개인 계정 이전에는 D1 데이터 export/import와 인증 교체가 필요하며 기존 DB를 초기화하면 안 된다.

현재 실행 방법·모듈 위치는 `README.md`를 참고한다. 아래는 인계 당시의 배포/WIP 상황을 보존한 기록이다.

---

## 최초 인계 기록 — 2026-09-08

당시 사용자는 남은 개발을 중단하고 Codex로 이관하도록 요청했다. 아래 항목은 **후속 작업 이전**의 상태다.

## 먼저 확인할 위치

- GitHub: https://github.com/theo-ooooo/baseball-manager
- **인계 브랜치: `codex/handoff-2026-09-08`** — 개발 중인 코드·이 문서·확보한 자료. 미배포이며 병합 준비 완료 상태가 아니다.
- **운영 / main 기준 커밋: `852348dc7939c9b2b3106eb0530e5086ffc8bdf3`**
- 테스트 사이트: https://dugout-world-manager.kkwondev.chatgpt.site
- 사이트는 소유자 전용 ChatGPT Sites이며, 관리형 Cloudflare Workers + D1에 배포됨. 사용자의 개인 Cloudflare 계정 연결을 확인한 적은 없다.
- 기존 작업 체크아웃: `/workspace/sites/dugout-manager`. 새 Codex 환경에서는 이 절대 경로를 전제하지 말고 위 브랜치를 checkout한다.
- `AGENTS.md`, 이 문서, `WORKLOG.md` 순서로 읽는다. 기존 README 일부 설명은 이전 구현 기준이다. 최신 상태는 아래 표가 우선한다.

## 실제 배포된 상태

2026-09-08 Sites 배포 성공 응답을 확인했다. 이후 작업 중 변경은 **배포하지 않았다**.

| 요청 | 운영 사이트 / main의 상태 |
| --- | --- |
| FM 형태의 야구 구단 운영 | Vinext/React + NestJS, FM 형태의 사이드바·정보 패널 |
| 나라별 리그, 실제·가상 선수 | 13리그, 137구단. 실명 2,042명 + 가상 2,461명. 전체 실제 등록 명단은 아님 |
| 전민재 등 누락 선수 | KBO 2026-09-07 1군 명단을 기존 명단과 병합. 미확인 선수는 여전히 있을 수 있음 |
| 프리시즌 | 개막 4주 전 시작, 연습경기 4회, 첫 시즌 외부/FA 영입 금지 선택 가능 |
| 전술·포지션 숙련 | 타순·수비 배치·개인 포지션 훈련·전술 보관함·팀 지시 |
| 2군 | 1군 28명 등록 한도, 승격·말소, 별도 육성 경기·성적·성장 |
| 코치 | 실명 KBO 코치 96명 + 가상 20명. 실명 코치의 능력·게임 보직·연봉은 가상 설정 |
| 뉴스·기분 | 수신함, 날짜별 구단 보고, 출전 부족·결과에 따른 사기, 면담과 출전 약속 |
| 이적 | 상대 구단 핵심 선수·주전·대체 전력·잔여 계약·순위 경쟁 판단. 이적 명단 등록 후 도착한 유효 제안만 매각 가능 |
| 금액 | 기본 원화 표시, 계약 입력 만 원. 기존 저장 단위 유지, 게임 고정 환산 1달러=1,400원 |
| 오버롤 | 2025 KBO/MLB/NPB 공식 성적 3,398건 기반 v1. 표본 보정, 미확인 성적은 미평가, 미측정 수비는 중립값 |
| 경기 일정 | 공식 날짜를 반영한 일정, 다른 구단도 같은 날 진행. 쉬는 날은 다음 경기·중요 사건까지 자동 진행 |
| 경기 화면 | 구장 배경 위 저장된 타석 결과 재생. **실시간 진행·2D 교체 전 버전** |
| 잠재력·선수 상세·로고 | **운영에는 잠재력 숨김 옵션 없음, 선수 모달 유지, 팀 로고 미적용** |

### 일정·규정 제한

- 2026 MLB 2,430경기, NPB 858경기, KBO 720경기 데이터.
- KBO는 최초 편성 675경기 + 공식 잔여 대진에서 고른 45경기로 구단별 144경기·상대별 16경기를 맞춘 게임 일정. 실시간 우천 취소·재편성을 그대로 재현하지 않는다.
- 다른 리그·차기 시즌·단축 시즌은 연전/휴식일을 포함한 생성 일정.
- 공통 상위 4팀 플레이오프. 실제 지구별 진출, 포스팅, 외국인 한도, 보상선수, 국가별 실제 2군 규정, 드래프트, 부상·은퇴는 미구현.
- 구단 간 이적 마감은 게임에서 단순화했다. 전체 실제 규정과 같다고 설명하지 말 것.

## 인계 브랜치의 미완성 변경

다음 코드는 보존용 WIP다. **main에 바로 병합하거나 그대로 배포하지 말 것.**

### 1. 선발·불펜·마무리

- `packages/shared/src/pitching.ts`: `PitchingPlan`, 선발 로테이션, 불펜, 마무리, 다음 선발 선택.
- `apps/web/pitching-panel.tsx`: 전술 화면에 보직 선택, 선발 순서 조정.
- `game-engine.ts`: 경기 중 선발 이닝/실점, 구원 투수 사용 여부, 9회 이후 1~3점 리드에 따른 자동 교체.
- 초기 보직은 이닝/등판/세이브와 능력을 참고한 게임 추천. 실제 선수의 공식 고정 보직 데이터로 단정하면 안 된다.
- 남은 검토: 선발 수동 선택·저장 전술과 로테이션의 상호작용, 더블헤더, 체력, 구원 승/세이브/홀드 기록의 정확성. 현재 승리 투수 판정은 단순하며 공식 기록 규칙을 충족하지 않는다. 홀드 타입만 있고 완전한 계산은 없다.
- 초기 `preparePitching`이 기존 커리어의 선발을 바꾸는 동작도 검토할 것.

### 2. 결과를 미리 공개하지 않는 경기 진행 + 2D 구장

- `game-engine.ts` 기존 경기 계산을 `simulateMatch` generator로 바꿈.
- 명령: `startMatch` → `stepMatch`(타석 1개) → `completeMatch`.
- `GameState.liveMatch`에 seed/cursor/진행된 기록 저장. 다음 타석 결과는 아직 계산하지 않는다.
- 재개 시 동일 seed로 이전 타석까지 재생산한 뒤 한 타석 더 계산한다. generator 내부를 직렬화하는 대신 결정적 재계산 사용. 최대 경기 길이에서 CPU/DB 비용 검증 필요.
- 진행 중에는 날짜·순위·시즌 통계를 최종 확정하지 않고, 완료 시 기존 하루 진행 흐름으로 한 번 반영한다. 임의 관리 명령은 진행 중 차단한다.
- `apps/web/stadium-replay.tsx`: SVG 2D 탑뷰 구장, `LiveMatchScreen`, 재생/일시정지/속도, 타석 종료 후 기록 표시. 프리뷰에는 라인업만 표시.
- `game.tsx`: 경기 진행 버튼이 오늘 경기에서 `startMatch`, 쉬는 날은 기존 `continue`.
- 남은 검토: 실제 D1 저장/새로고침 재개, 중복 요청/동시 탭, 최종 완료 직전 애니메이션, 연장·끝내기·더블헤더·포스트시즌, 모바일 UI, 네트워크 오류, 접근성. 브라우저 테스트는 수행하지 않았다.
- 중요한 성능 점검: 매 타석마다 현재 CareerRepository가 전체 관계형 projection을 다시 쓰는지 확인하고 필요한 범위로 최적화할 것. 운영 부하 검증은 안 됐다.

### 3. 잠재력 숨김

- `rules.revealPotential` 추가, 새 커리어 체크박스 기본 false.
- `services/presentation.ts`에서 숨김 커리어/API catalog의 potential을 0으로 마스킹하고 rating.base.potential 제거. 서버 내부 원본과 성장에는 실제 값 유지.
- 가격이 마스킹 때문에 달라지지 않도록 서버 계산 `marketValue` 전달, `askPrice`에서 사용.
- 테이블/2군/시장 정렬 UI 조건 처리 일부 완료, 새 커리어 생성 후 catalog 재요청.
- **미완료:** 기존 PlayerModal에는 잠재력 항목이 남아 있어 0으로 보일 수 있음. 선수 페이지 교체와 모든 표시 경로 점검 필요. API 오류 응답·모든 중첩 Player·다른 커리어 생성 후 캐시 전환의 검증도 필요.
- 공개 여부는 커리어 생성 뒤 변경하는 API가 없다. 기존 커리어도 기본 숨김으로 처리하려는 설계.

### 4. 세부 능력·타순 추천

- `packages/shared/src/player-attributes.ts`: 출루·선구안·삼진 회피·장타 생산·주루·투수 탈삼진/볼넷/피홈런 억제 등 파생 평가, 추천 이유 함수.
- `lineupAuto`는 포지션을 충족하는 9명을 뽑은 뒤 1번 출루/주루, 4번 장타, 2·3·5번 득점 생산 등 역할 점수로 배치하도록 변경.
- 코치 추천 이유 일부 UI 연결. **선수 상세 페이지에 세부 능력 UI는 아직 연결하지 않았다.**
- `performance-2025.json`에 KBO BB/HBP/K/GDP/OBP/SLG/SB/CS, MLB·NPB 추가 기록을 병합했다. 유강남 2025: 350PA, 303AB, 83H, OBP .352, SLG .383, 26BB, 66SO, 11GDP, 0SB.
- `performance-ratings.ts` 버전 v2, seed world 버전 v6로 변경한 상태.
- **중요한 미완료:** D1의 새 forward migration이 아직 없다. 이대로 배포해도 DB는 v1 성적/카탈로그 v5를 반환한다. 이미 배포된 `0006_performance_2025.sql`을 수정하면 안 된다. 현재 `generate-performance-update.mjs`는 0006을 덮어쓰는 스크립트이므로 새 migration을 만드는 방식으로 먼저 바꿔야 한다.
- 수비·송구·구종·구속 자료가 없으면 미평가 표시 유지. 사실 없는 실명 선수 능력을 임의로 채우지 말 것.
- 현재 overall은 기존 주요 능력 가중 평균이며, 모든 세부 능력을 다시 가중한 모델은 아니다. 실명 선수/가상 선수, 표본 크기, 지원하지 않는 세부 항목, 실제 롯데 추천 타순을 검증해야 한다.
- 자료 수집 스크립트는 scratch 기반이므로 이관 후 경로 정리와 재현 가능한 수집/변환 과정이 필요하다.

### 5. 선수 전용 페이지

**미구현.** 사용자는 모달 대신 독립 페이지를 요청했다.

- `Game`/`GameScreen`에 `initialPlayerId`, `initialView` prop만 추가된 상태. 이 prop으로 선수 페이지가 실제로 열리지는 않는다.
- `app/players/[id]/page.tsx`는 아직 없음. 기존 `PlayerModal`과 `setPlayer`가 남아 있다.
- 요구: 실제 경로, 뒤로가기/직접 접근, 프로필·공식 성적·세부 능력·계약·에이전트·사기·숙련도·투수 보직. 잠재력 설정을 모든 항목에 적용.

### 6. 팀 로고

**사이트 미적용.** 확보한 원본은 `handoff/research-assets.zip`의 `logos/`에 보존했다.

- KBO 10 PNG, MLB 30 SVG, NPB 12 GIF: 총 52개. 공식 출처·해시·이용권리 안내는 `logos/manifest.json`.
- 로고를 새로 생성한 것이 아니며, 공식 이미지의 재사용 허락을 받은 것은 아니다. NPB 원본의 흰 바탕 유지.
- 다른 85개 구단 로고는 확보/검증 완료되지 않았다. 당시 자료 수집은 사용자의 취소 요청으로 중단했다.
- 구현 계획: `ClubBadge` 공통 컴포넌트, 구단 선택·순위·일정·경기·선수 화면 반영. DB 카탈로그에 이미지 경로/출처가 필요하면 새 스키마·마이그레이션 추가.
- 누락 구단을 가짜 공식 로고로 채우지 말 것.

## 검증 상태 — 서로 혼동하지 말 것

- **운영/main 852348d:** 타입 검사, NestJS/Vinext 빌드, 전체 32개 테스트 통과. 실제 Worker + D1를 이용한 API 테스트 포함. 배포 성공 확인.
- **WIP 초기 경기/투수 수정:** `tests/live-match.test.mjs` + `tests/replay.test.mjs` 총 5개 테스트 통과. 타석 단위 진행, JSON 재개 결정성, 중복 완료 차단, 보직 분리 등. 이후 능력/표시 변경이 추가됐다.
- **인계 직전 최신 WIP:** `npm run typecheck` 통과. 최신 전체 빌드/전체 테스트는 미실행. 새 D1 마이그레이션 없음. 운영·브라우저 검증 없음.
- 마지막 성공한 `dist`는 운영 852348d의 산출물이다. WIP 소스 검증 없이 이를 재사용하지 말 것.

## 구조 / 로컬 실행

```bash
git fetch origin
git switch codex/handoff-2026-09-08
npm ci
npm run typecheck
npm test
npm run dev
```

Node >=22.13, bash 사용. 후속 작업에서 빌드의 GNU timeout 의존성을 제거했으며 macOS/Linux에서 `npm ci`로 설치한다. 선택적인 `install:ci` 도우미만 Linux/flock 전용이다. npm lockfile 유지. `npm test`는 빌드 후 실제 Worker + 격리된 Miniflare D1 테스트를 실행한다. 처음 체크아웃했다면 API 번들이 필요한 타입 검사 전에 `npm test` 또는 `npm run build`를 실행한다. 테스트용 헤더 허용을 공개 운영 코드에 넣지 말 것.

| 영역 | 위치 |
| --- | --- |
| Vinext 페이지/레이아웃 | `app/` |
| 프론트 | `apps/web/game.tsx` 조립/요청, 기능별 `*-panel.tsx`, `player-profile.tsx`, `game-sidebar.tsx`, `stadium-replay.tsx` |
| NestJS API | `apps/api/src/app.controller.ts`, `services/`, `repositories/` |
| 게임 규칙 | `apps/api/src/domain/` |
| 공통 계약·조회·계산 | `packages/shared/src/` |
| D1 Drizzle 스키마 | `db/schema.ts` |
| 순차 SQL 마이그레이션 | `drizzle/`와 `drizzle/meta/_journal.json` |
| seed 입력 | `apps/api/seed/` — 실행 중 직접 import 금지 |
| Worker 통합 | `worker/index.ts`, `apps/api/src/worker.ts` |
| 빌드/자료변환 스크립트 | `scripts/` |
| 테스트 | `tests/`, `tests/helpers/worker.mjs` |

프론트와 백엔드는 책임/소스가 분리되지만 같은 Cloudflare Worker에 배포된다. NestJS는 Express adapter + Workers HTTP bridge를 사용한다. 사용자가 NextJS/NestJS를 요청한 뒤 Cloudflare를 위해 Vinext를 선택했다. 임의로 Vercel이나 별도 Express 앱으로 교체하지 말 것.

## DB / 이전 / 배포

- 카탈로그·커리어 모두 D1. 커리어 JSON과 선수·계약·순위·거래 등 관계형 projection을 revision/requestId 검증 아래 함께 저장한다.
- 배포 버전의 migration은 0000~0008. 새 변경은 forward migration만 추가. 카탈로그 변경 시 `catalog_meta.version` 갱신.
- 기존 커리어의 계약·성적·이적 소유권을 유지하며 평가/명단만 업그레이드하는 경로는 `prepareSquad`와 `refreshRatings`.
- `.openai/hosting.json`의 프로젝트 ID/논리 DB 바인딩 유지. 실제 개인 Cloudflare DB ID나 계정 인증은 이 레포에 없다.
- 현재 Sites project: `appgprj_6a9ec5fc450081919ce49eb029d8f319`.
- 운영 version: `appgprj_6a9ec5fc450081919ce49eb029d8f319~appgver_6a8b4496ea9c81919afa2a206a6877ba`.
- 운영 deployment: `appgdep_6a9f8ab417ac81919cbd9fab1f1e0d15` (succeeded).
- GitHub와 Sites 소스 저장소는 별개. GitHub push만으로 현재 사이트가 자동 배포되는 구성은 아니다.
- Sites 기능이 있는 Codex에서는 해당 Sites skill을 읽고 정확한 source push → build/package → version save/deploy 순서를 따른다. 로컬 절대 plugin 경로나 일회성 credential을 이관 가능하다고 전제하지 말 것.
- Sites 없는 Codex에서는 GitHub 코드 작업은 가능하지만 기존 관리형 사이트 배포 권한은 별도 문제다. 개인 Cloudflare로 이전 시 DB export/import·바인딩·인증·도메인 이전을 준비해야 한다.
- `oai-authenticated-user-id`는 Sites가 검증/주입한 헤더일 때만 신뢰한다. 개인 Worker로 옮길 때 반드시 인증을 교체한다.
- 운영 DB export는 아직 하지 않았다. GitHub에는 seed/마이그레이션만 있고 사용자의 현재 세이브가 포함되지 않는다. DB를 삭제하거나 seed로 덮어쓰지 말 것.
- 코드, 자료와 DB는 이전 가능하나 현 환경의 credential은 저장하거나 옮기지 않는다.

## 사용자와 일하는 방식

한국어로 간결하게 진행 상태를 알리고, 이미 허용한 통상 작업을 반복 확인하지 않는다. 세션마다 의미 단위 커밋과 GitHub push를 요청했다. 완료·미완료·실제 배포 여부를 구분한다. 최초 인계 시에는 개발을 중단했지만 이후 사용자 지시로 이 브랜치에서 후속 개발을 재개했다. 현재 상태는 문서 첫 절과 최신 WORKLOG가 우선한다.
