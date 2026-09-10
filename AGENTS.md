# Project instructions

- The user requests a baseball management game with country-based leagues, real and generated players, recruitment/transfers, agents, and coaches. Keep these requirements across sessions.
- Preserve the existing `.openai/hosting.json` project identity. Follow the applicable Sites skills for this runtime.
- The selected stack is Vinext / React in `apps/web`, NestJS in `apps/api`, shared contracts in `packages/shared`, and Cloudflare Workers with D1. Keep backend mutation logic out of the browser. Runtime catalog data must come from D1; `apps/api/seed` is migration input only.
- This Site uses managed Cloudflare infrastructure. Do not describe it as deployed to the user's personal Cloudflare account without verifying that account connection.
- Commit completed work during each session, separated into coherent implementation units. Do not invent earlier session dates or collapse unrelated work into one commit.
- Write new commit messages, pull request titles and pull request descriptions in Korean, per the user's preference.
- Push completed session commits to the user's designated GitHub repository when it exists and access is available. Confirm the remote branch update before reporting a successful push. The Sites source repository is a separate destination and must not be described as the user's GitHub repository.
- Update `WORKLOG.md` with meaningful changes, validation, known limitations, and any remaining publication blocker.
- Avoid claiming full league-rule parity, complete current rosters, realistic contracts, or completed browser/API verification without evidence.
- Never store credentials, dependency directories, build output, or local save data in Git.
- 프론트엔드의 상태·비동기 흐름·외부 리소스 생명주기는 적절한 커스텀 훅으로 분리한다. 컴포넌트는 화면 구성에 집중하며 게임 변경 로직은 서버에 유지한다.
- 프론트엔드에 공개 릴리스 버전을 표시하고 빌드 식별자를 확인할 수 있게 유지한다.
- Cloudflare 무료 플랜을 유지한다. 유료 전환·유료 제한 상향 대신 요청별 CPU·D1 읽기와 쓰기·응답 크기를 줄인다.
- 프론트엔드에 Redux와 useReducer를 새로 도입하지 않는다. 상태 흐름은 커스텀 훅으로 분리한다.
