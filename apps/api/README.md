# NestJS backend

`src/app.controller.ts` owns HTTP routes. `services/career.service.ts` validates commands and calls the server-only simulation. Repositories read and write D1. The domain receives a database-backed catalog; seed files are not runtime imports.

The root build first bundles `src/worker.ts` into ignored `.build/worker.mjs`, then includes it in the Vinext Worker. Nest's default Express HTTP adapter uses the Cloudflare Node HTTP bridge. Optional websocket/microservice packages are not part of this service.

Routes live under `/api`. The current deployment trusts identity headers only because Sites dispatch authenticates and sanitizes them. Connecting a standalone public Cloudflare deployment requires a verified identity provider or trusted authenticated gateway first.

Run the root `npm test` to exercise the complete production Worker against migrated Miniflare D1, including optimistic concurrency, relational persistence, accounting and seasonal state transitions.
