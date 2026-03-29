# Repository Guidelines

## Project Structure & Module Organization
This repository is a Vinext + React 19 app backed by Drizzle and Cloudflare Workers. Route entrypoints live in `app/`, including localized pages under `app/[locale]/` and API routes under `app/api/`. Shared UI lives in `src/components/`, while data access, SEO helpers, crawler logic, and i18n utilities live in `src/lib/` and `src/i18n/`. Database schema is defined in `db/schema.ts`, generated SQL lives in `migrations/`, crawler and maintenance entrypoints live in `scripts/`, static assets live in `public/`, and worker-specific code lives in `worker/`.

## Build, Test, and Development Commands
Use `pnpm` throughout.

- `pnpm dev`: start the local app on port `3003`.
- `pnpm build`: produce the production build with Vinext.
- `pnpm start`: serve the built app locally.
- `pnpm lint`: run ESLint across the repo.
- `pnpm db:generate` / `pnpm db:migrate`: generate and apply Drizzle migrations.
- `pnpm db:studio`: inspect the database locally.
- `pnpm crawl:x:trending` or `pnpm crawl:youtube:live -- --dry-run`: run crawler jobs; prefer `--dry-run` while developing.

## Coding Style & Naming Conventions
TypeScript runs in `strict` mode; keep types explicit at module boundaries. Use 2-space indentation, ESM imports, and the `@/*` path alias for files under `src/`. Follow the existing naming pattern: PascalCase for React components (`YouTubeHotGridPage.tsx`), kebab-case for scripts (`crawl-x-trending-hourly.ts`), and concise utility filenames grouped by feature under `src/lib/<domain>/`. Linting is enforced by `eslint.config.mjs` with TypeScript, React, React Hooks, and Next core-web-vitals rules.

## Testing Guidelines
There is no dedicated unit test suite in the current repo. Treat `pnpm lint` and `pnpm build` as the required validation baseline, and run the relevant crawler in `--dry-run` mode when changing ingestion code. For database changes, validate both `pnpm db:generate` and the resulting migration files.

## Commit & Pull Request Guidelines
Recent history follows short imperative Conventional Commit subjects such as `feat: ...` and `feat(youtube-music): ...`. Keep that format, scope when useful, and separate unrelated changes. Pull requests should include a clear summary, impacted routes or scripts, required env or migration changes, and screenshots for UI-affecting pages. Ensure CI passes `pnpm lint` and `pnpm build` before requesting review.

## Security & Configuration Tips
Secrets belong in local env files or GitHub Actions secrets, never in source. Common required values include `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `NEXT_PUBLIC_SITE_URL`, and crawler-specific API keys. When editing crawler behavior, check the matching workflow in `.github/workflows/` so schedule and runtime assumptions stay aligned.
