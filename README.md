# DUGOUT · 월드 베이스볼 매니저

실제 구단·선수 이름과 생성 선수를 함께 사용하는 한국어 야구 구단 운영 게임의 초기 구현입니다. 구단 선택부터 라인업, 경기 진행, 영입 협상, 코치 채용, 재정 관리, 다음 시즌까지 이어집니다.

## 기술 구성

| 영역 | 구현 |
| --- | --- |
| 프론트엔드 | React 19, TypeScript, Tailwind CSS, shadcn/ui |
| 서버 | Vinext의 Next.js 호환 API 라우트, Cloudflare Workers |
| 데이터베이스 | Cloudflare D1 / SQLite, Drizzle 스키마·마이그레이션 |
| 저장 | 사용자별 커리어, 서버에서 명령 검증·시뮬레이션, revision 기반 동시 저장 보호 |

Express나 NestJS 서버를 사용하지 않습니다. 현재 배포 구성은 ChatGPT Sites의 인증 헤더와 D1 바인딩을 사용합니다. 다른 호스팅 환경에서는 인증 및 런타임 바인딩을 별도로 연결해야 합니다.

## 현재 기능

- 13개 리그, 137개 구단 선택: KBO, MLB, NPB, CPBL, LMB, LMP, ABL, LIDOM, LVBP, LBPRC, 네덜란드, 이탈리아, 체코.
- MLB·NPB 공개 명단과 일부 KBO 선수를 포함한 실제 이름 데이터 1,812개, 국가별 생성 선수, 시즌별 신인 생성.
- 라운드 로빈 일정, 타석 기반 경기 계산, 이닝 결과·득점 기록, 순위, 포스트시즌, 다음 시즌 전환.
- 타순·선발 투수·공격 전술 설정, 선수 검색, 에이전트 협상과 재협상, 영입·매각·계약 만료.
- 5개 코치 역할, 훈련, 선수 성장·체력, 급여·경기 수입·영입 비용.
- 대시보드, 선수단, 전술, 일정, 세계 리그, 이적 시장, 스태프, 재정 화면.

## 데이터와 구현 범위

완성된 공식 야구 데이터베이스나 모든 프로리그 규정의 재현은 아닙니다. 일부 리그는 생성 선수 중심이며 KBO 명단도 부분 수록입니다. 실제 선수의 능력치, 잠재력, 연봉, 계약, 일부 수비 포지션은 게임용 설정입니다. 소속·나이 등 공개 명단도 갱신 시점에 따라 차이가 생길 수 있습니다. 겨울리그 구성에는 2025–26 시즌 정보가 포함됩니다.

현재 리그들은 공통 일정·포스트시즌·계약 규칙을 사용합니다. 국가별 외국인 한도, 포스팅, 보상 선수, 드래프트, 마이너리그 승강·로스터 규정, 실제 MLB 지구별 포스트시즌은 아직 구현하지 않았습니다. 투수 교체와 불펜 운용도 단순화되어 있으며 경기 재생은 이미 계산된 결과를 보여줍니다.

공개 명단 참고: [MLB 구단 명단](https://www.mlb.com/team), [NPB 등록 선수](https://npb.jp/announcement/roster/), [KBO 선수 기록](https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx). 개별 MLB·NPB 항목은 `lib/real-rosters.json`에 원문 주소를 보관합니다. 구단 로고·선수 사진은 포함하지 않습니다.

## 개발과 검증

Node.js 22.13 이상, Linux 환경을 기준으로 합니다. 프로젝트 스크립트는 `bash`, `flock`, GNU `timeout`을 사용합니다.

```bash
npm ci
npm run dev
npm run build
node --test tests/game-invariants.test.mjs
```

게임 테스트는 전체 구단의 유효한 선수단, 모든 리그의 홈·원정 일정, 시즌·포스트시즌·다음 시즌 흐름, 협상·영입·매각·코치 채용의 상태 및 예산 불변식을 검증합니다.

`GET /api/career`는 커리어를 불러오고 `POST /api/career`는 게임 명령을 처리합니다. API는 인증된 호스팅 환경의 `oai-authenticated-user-id`를 요구합니다. 일반 로컬 접속에서는 이 인증 연결 없이는 커리어 저장을 사용할 수 없습니다. 클라이언트가 보낸 사용자 ID나 임의 게임 상태를 그대로 저장하지 않습니다.

핵심 파일: `lib/catalog.ts`, `lib/real-rosters.json`, `lib/engine.ts`, `app/game.tsx`, `app/api/career/route.ts`, `db/schema.ts`.

## 작업 이력

구현 단위로 커밋을 나눕니다. 이후 세션에서도 변경 목적과 검증 결과를 기록하고 요청된 저장소에 커밋·푸시합니다. 현재 상태와 남은 범위는 [WORKLOG.md](WORKLOG.md)에 기록합니다.
