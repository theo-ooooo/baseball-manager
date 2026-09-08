# Web application

This npm workspace owns the complete Vinext/React frontend. `app/` defines routes and the root layout; `src/features/` contains the corresponding game screens. Reusable UI lives in `src/components`, hooks in `src/hooks`, styles in `styles`, and static files in `public`. There is no frontend entrypoint at the repository root.

Run `npm run dev` or `npm run build` from the repository root. The root build bundles NestJS first, builds this workspace, and stages the combined Cloudflare Worker in root `dist/`.

The frontend reads the D1-backed catalog and career from `/api/*`. It sends commands with a revision and request ID; identity, simulation, transfers, accounting and persistence belong to the backend. Shared contracts and read-only selectors are imported from `@dugout/shared/*`.
