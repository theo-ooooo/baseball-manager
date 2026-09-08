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
