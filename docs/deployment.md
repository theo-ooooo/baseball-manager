# Cloudflare publication and career preservation

The public application is one Worker, `baseball-manager`, with D1 binding `DB`. Its configuration is `infra/cloudflare/wrangler.jsonc`. The account and database IDs are non-secret; the GitHub `CLOUDFLARE_API_TOKEN` secret and `CLOUDFLARE_ACCOUNT_ID` variable supply deployment authentication.

A push to `main` runs format, lint, production build, 55 tests and typecheck. The deployment job downloads that exact artifact, skips superseded commits, records a Time Travel bookmark, applies forward migrations, deploys, and checks `/api/health`. Production jobs are serialized. Feature branches and pull requests do not deploy. Merge only after the checks pass. Existing migrations must never be rewritten.

Guest careers use a cryptographically random HttpOnly, Secure, SameSite cookie; D1 keys use its SHA-256 hash. `/saves` reveals the private recovery key on request and restores access to an existing career. Possessing the key grants access; clearing cookies without retaining it loses browser access. Restoration switches browser identity and never overwrites a career.

The original managed Sites application retains `.openai/hosting.json` and a separate database. To transfer its owner career, configure expiring `MIGRATION_EXPORT_TOKEN`, `MIGRATION_OWNER_ID`, and `MIGRATION_TRANSFER_EXPIRES` runtime values on that private Site and publish the validated build there. Its scoped credential permits only `GET /api/career/export`. Store the complete raw backup outside Git with private filesystem permissions.

For the personal Worker, temporarily set `MIGRATION_IMPORT_TOKEN`, `MIGRATION_TARGET_ID` (the hash-derived guest ID), and `MIGRATION_TRANSFER_EXPIRES`. `POST /api/career/import` accepts that credential only until its deadline. Import validates every table, column and source owner, refuses existing target data or duplicate history IDs, writes one D1 batch, and compares all rows after reading them back. Every value except `user_id` is retained, including raw state, statistics, contracts, revisions and history. Remove the temporary runtime credentials immediately after verification; keep the original database and private backup.

No credentials, recovery keys, local saves, dependency folders or build output belong in Git. `npm run dev` initializes only the Vite plugin's local D1. `npm run deploy:cloudflare -- --dry-run` checks the upload without applying remote migrations or deploying.
