# Contributing to Cadence

Thank you for taking the time to contribute! This guide covers everything you need to get your changes into the codebase smoothly.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Commit Style](#commit-style)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

Be respectful, constructive, and welcoming. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Harassment of any kind will not be tolerated.

---

## How to Contribute

There are many ways to contribute beyond writing code:

- **Bug reports** — clear reproduction steps make fixes much faster
- **Feature requests** — share your use case, not just the solution
- **Documentation** — typos, clarity improvements, missing examples
- **Code** — bug fixes, new features, performance improvements, tests

For significant new features or architectural changes, **please open an issue first** so we can discuss the approach before you invest time in an implementation.

---

## Development Setup

### Prerequisites

- Node.js 22+
- PostgreSQL 16+
- Redis 7+
- npm 10+

### 1. Fork and clone

```bash
git clone https://github.com/kingztech2019/cadence-plane-analytics.git
cd cadence
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, REDIS_URL, JWT_SECRET, ENCRYPTION_KEY
```

### 4. Run migrations

```bash
npx tsx apps/api/src/db/migrate.ts
```

### 5. Start development servers

```bash
npm run dev
```

- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:4001](http://localhost:4001)

### Useful commands

```bash
npm run typecheck          # Check TypeScript across all packages
npm run build              # Build all packages
npm run lint               # Lint all packages

# Build shared types (run after editing packages/shared/src/types/)
npx turbo run build --filter=@flow-analytics/shared
```

---

## Project Structure

```
cadence/
├── apps/
│   ├── api/src/
│   │   ├── config/        # env.ts (Zod-validated), db.ts (pg Pool)
│   │   ├── routes/        # Fastify route handlers
│   │   ├── services/      # Business logic + SQL queries
│   │   ├── workers/       # BullMQ background jobs
│   │   └── db/            # Migrations
│   └── web/src/
│       ├── app/           # Next.js App Router pages
│       ├── components/    # Reusable UI components
│       └── services/      # API client functions
└── packages/
    └── shared/src/
        └── types/         # TypeScript types shared by API + web
```

### Key conventions

- **Shared types first.** Any new data shape that crosses the API/web boundary lives in `packages/shared/src/types/analytics.ts`. Rebuild shared with `npx turbo run build --filter=@flow-analytics/shared` after changes.
- **`exactOptionalPropertyTypes: true`** is enabled. Never assign `undefined` to an optional property — omit the key entirely.
- **SQL in `metricsService.ts`.** All database queries live there. Use `PERCENTILE_CONT`, window functions, and CTEs freely — PostgreSQL is the query engine.
- **No ORM.** Raw `pg` queries only. Column aliases use camelCase (`AS "fieldName"`) so rows map directly to TypeScript interfaces.
- **`'use client'` pages.** All analytics pages are client-rendered and fetch their own data via `analyticsService`. There is no server-side data fetching in the analytics section.

---

## Making Changes

### Adding a new analytics metric

1. **Define the type** in `packages/shared/src/types/analytics.ts`
2. **Rebuild shared**: `npx turbo run build --filter=@flow-analytics/shared`
3. **Write the SQL query** as a new method in `apps/api/src/services/metricsService.ts`
4. **Add the API route** in `apps/api/src/routes/analytics.ts`
5. **Add the client method** in `apps/web/src/services/analyticsService.ts`
6. **Create the page** at `apps/web/src/app/(app)/projects/[projectId]/your-feature/page.tsx`
7. **Add the nav tab** in `apps/web/src/app/(app)/projects/[projectId]/layout.tsx`

### Adding a new database table

1. Create a new migration file: `apps/api/src/db/migrations/00N_description.sql`
2. Run it locally: `npx tsx apps/api/src/db/migrate.ts`
3. Never modify existing migration files — always add new ones.

### Modifying the Docker setup

When you change environment variables in the API:
- Add the variable to `apps/api/src/config/env.ts` (Zod schema)
- Add it to the `api` service `environment:` block in `docker-compose.yml`
- Add it to `.env.example` with a description

---

## Pull Request Guidelines

- **One PR per concern.** Don't bundle unrelated changes.
- **Describe the why.** The title and description should explain the motivation, not just list what changed.
- **Keep it reviewable.** If a PR is large, consider breaking it into smaller sequential PRs.
- **Pass CI.** `npm run typecheck` and `npm run lint` must pass. PRs that break the build will not be merged.
- **Screenshots for UI changes.** If you've changed how something looks, include before/after screenshots in the PR description.

### PR title format

```
feat: add scope creep tracking per sprint
fix: correct cycle time calculation for reactivated issues
docs: update environment variable reference
chore: upgrade Recharts to 2.x
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

---

## Commit Style

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body — explain the why, not the what]
```

Examples:
```
feat(metrics): add bottleneck persistence tracking across 30-day windows
fix(api): correctly forward OPENROUTER_API_KEY to Docker container
refactor(web): extract TrendPill into shared component
docs: add self-hosting production guide to README
```

---

## Reporting Bugs

Please use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- Steps to reproduce (as specific as possible)
- Expected behaviour
- Actual behaviour
- Cadence version / commit hash
- Browser and OS (for frontend issues)
- Relevant logs from `docker logs cadence-api-1`

---

## Requesting Features

Please use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md) and include:

- **The problem you're trying to solve.** Describe your workflow, not the solution.
- **What you'd expect Cadence to do.**
- **Who else would benefit from this?** (team size, how common the use case is)

---

## Questions?

Open a [GitHub Discussion](https://github.com/kingztech2019/cadence-plane-analytics/discussions) for questions that aren't bugs or feature requests. This keeps issues focused on actionable items.
