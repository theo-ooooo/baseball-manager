# Vinext frontend

`game.tsx` contains the management screens. `world-context.tsx` supplies read-only views of the catalog fetched from NestJS. `globals.css` owns the application styles. Root `app/page.tsx` and `app/layout.tsx` remain the thin Vinext routing and metadata entrypoints.

The frontend reads `/api/catalog` and `/api/career` together, then sends commands with the current revision and a unique request ID. It never decides transfer charges, match results, identity or saved state. Mutations and persistence belong to NestJS.

Reusable shadcn components remain in the root `components` directory; shared data contracts and selectors are in `packages/shared/src`.
