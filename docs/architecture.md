# Repository structure

```text
apps/
  web/                     @dugout/web: one complete frontend
    app/                   URL routes and root layout
    src/
      features/            career, players, squad, clubs, matches,
                           schedule, market, finance
      components/          shared game displays and shadcn/ui
      hooks/               React hooks
      lib/                 UI utilities
    styles/                application styles; vendor/ preserves external CSS licenses
    public/                static assets and verified club logos
    vite.config.ts         frontend build configuration
  api/                     @dugout/api: NestJS backend
    src/
      controllers/         health, catalog, career, transfer and session HTTP endpoints
      auth/                internal identity access and guest-cookie helpers
      services/            use-case coordination and presentation
      repositories/        D1 reads, projections and verified career transfer
      domain/              server-only game rules
    db/                    D1/Drizzle schema
    drizzle/               append-only SQL migrations and snapshots
    seed/                  migration inputs; never runtime imports
packages/
  shared/                  @dugout/shared: contracts and pure selectors
infra/
  cloudflare/              Worker entrypoint and deployment configuration
  sites/                   compatibility packaging for the original Site
scripts/                   repository build, migration and deployment tools
tests/                     domain and real Worker/D1 integration tests
```

The root npm workspace coordinates installation, checks and builds. Each application declares its own runtime dependencies. Shared TypeScript exports use `@dugout/shared/*`, and the web-only `@/*` alias resolves to `apps/web/src`.

A request enters the Cloudflare Worker: `/api/*` goes to NestJS; page requests go to Vinext; static assets use the Cloudflare assets binding. Both applications are deployed in one Worker, so browser API requests stay on the same origin. Frontend source does not import the server simulation or seed catalog.

The web workspace produces `apps/web/dist`; the staging script copies its deployable bundle to root `dist` for integration tests and publication. Both directories are generated and ignored. `.openai/hosting.json` retains the original Sites identity; personal Cloudflare configuration is separate under `infra/cloudflare`.

Existing migration names, SQL contents and journal timestamps are preserved when moving their directory. Future database changes append migrations. Career snapshots, contracts, ownership, statistics and archives must survive deployment and any database transfer.

The public Worker derives guest identity from a random host-only cookie and discards caller-supplied identity headers. Session and career APIs are NestJS controllers. Only the original managed Sites profile accepts its platform-injected identity. Expiring transfer credentials are scoped to one source or target and never enable general game commands.
