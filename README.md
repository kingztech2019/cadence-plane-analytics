<div align="center">

<img src="docs/logo.png" alt="Cadence" width="72" />

# Cadence

**Delivery analytics for [Plane](https://plane.so) — understand how your team actually ships software**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-000000?logo=fastify)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Features](#features) · [Screenshots](#screenshots) · [Quick Start](#quick-start) · [Configuration](#configuration) · [Contributing](#contributing)

---

![Cadence — Cycle Time with Project Pulse strip](docs/screenshots/hero.png)

</div>

## What is Cadence?

Plane gives you project management. Cadence gives you the engineering metrics that answer *why* work is fast or slow.

It connects to any Plane workspace (cloud or self-hosted) via API key or OAuth, continuously syncs your issues and state-transition history, and surfaces actionable analytics that Plane's built-in dashboards don't provide:

- **How long does work actually take?** Cycle time and lead time, not just status counts.
- **Where do issues get stuck?** The bottleneck isn't always obvious from a board view.
- **Who is overloaded, and who is struggling?** Per-person health flags before burnout happens.
- **Will we hit our deadline?** Monte Carlo simulation over your real throughput history.

> **No write access required.** Cadence only reads from Plane. It never modifies issues, comments, or state.

---

## Features

### Metrics
| Feature | Description |
|---|---|
| **Cycle Time** | Scatter chart + P50/P85 stats + trend vs prior 30 days |
| **Lead Time** | Created → Done distribution with percentile benchmarks |
| **Bottleneck Tracker** | Which stage delays work most, with persistence across 30-day windows |
| **WIP / CFD** | Cumulative Flow Diagram showing work-in-progress balance over time |
| **Throughput** | Issues completed per person + team health flags (overloaded, slow, high reactivation) |
| **Sprint Comparison** | Sprint-over-sprint velocity, P50/P85, and scope creep |
| **Flow Efficiency** | Active vs waiting time ratio benchmarked against industry norms |
| **Scope Creep** | Per-sprint added work vs committed work |
| **Monte Carlo Forecast** | Probabilistic delivery date from real historical throughput |
| **At-Risk Radar** | Issues currently in-progress that have already exceeded their state P85 |

### Insights
| Feature | Description |
|---|---|
| **Project Pulse** | One-line signal strip above every page — surfaces critical issues, trend changes, and persistent bottlenecks |
| **Flow Health Score** | A/B/C/D/F composite score from cycle time trend, WIP balance, reactivation rate, and throughput trend |
| **Bottleneck Recommendations** | 3 targeted, category-aware action items per bottleneck, escalating to "Urgent" after 3+ consecutive periods |
| **AI Sprint Retrospective** | OpenRouter-powered narrative summary comparing sprint performance to the prior sprint |

### Platform
| Feature | Description |
|---|---|
| **Shareable dashboards** | One-click read-only link — no login required for recipients |
| **Issue journey drill-through** | Click any issue to see its full state timeline |
| **Cross-project contributors** | Workspace-level view of each member's output across all projects |
| **Filter bar** | Filter every metric by sprint, assignee, priority, label, and date range |
| **State mapping** | Override Plane's flow categories per project (e.g. mark "QA" as `review`) |

---

## Screenshots

### Dashboard
> Overview of all tracked projects with live sync status. Each card shows quick links to Delivery Speed, Bottlenecks, Work Flow, and Team Output for that project.

![Dashboard](docs/screenshots/dashboard.png)

---

### Project Pulse + Cycle Time
> The Pulse strip surfaces your top signals on every page — bottleneck alerts, at-risk count, and trend changes. Cycle Time shows a scatter distribution with P50/P85 reference lines and a trend comparison vs the prior 30 days.

![Cycle Time page](docs/screenshots/cycle-time.png)

---

### Lead Time
> How long from ticket created to ticket done — including all the waiting time, not just active development. Shows P50, P85, and a per-issue breakdown table.

![Lead Time page](docs/screenshots/lead-time.png)

---

### Bottleneck Tracker
> Identifies the stage where issues spend the most time. Tracks persistence across consecutive 30-day windows and escalates to "Critical" messaging when the same stage has been the bottleneck for 3+ periods — with targeted action recommendations.

![Bottleneck page](docs/screenshots/bottleneck.png)

---

### WIP / Cumulative Flow Diagram
> Watch work pile up (or flow smoothly) through each stage over time. A growing band in any one stage signals a bottleneck forming.

![CFD page](docs/screenshots/cfd.png)

---

### Team Health & Throughput
> Per-person completion counts and typical cycle time. The Team Health Flags section surfaces overloaded members (high WIP), slow outliers (P85 > 1.5× team average), and high reactivation rates before they become a problem.

![Throughput page](docs/screenshots/throughput.png)

---

### Team Contributions
> Workspace-level view of each member's output across all projects — total issues completed, P50/P85 speed, and which projects they're contributing to.

![Team contributions](docs/screenshots/team.png)

---

### Sprint Comparison
> Sprint-over-sprint velocity chart comparing completed issues, P50/P85 cycle time, and scope added per sprint. The AI Retrospective button generates a narrative summary powered by OpenRouter.

![Sprints page](docs/screenshots/sprints.png)

---

### Flow Efficiency
> Ratio of active working time to total lead time, benchmarked against the industry median of ~15%. Includes a distribution histogram and a per-issue breakdown sorted by efficiency.

![Flow Efficiency page](docs/screenshots/flow-efficiency.png)

---

### Scope Creep
> How much work gets added mid-sprint vs committed at the start. Sprints above the 30% danger threshold are highlighted — a leading indicator of missed goals.

![Scope Creep page](docs/screenshots/scope-creep.png)

---

### At-Risk Radar
> Issues currently in-progress that have already exceeded their state's P85. Sorted by overage percentage so you know exactly which issues need attention right now.

![At-Risk page](docs/screenshots/at-risk.png)

---

### Monte Carlo Forecast
> Probabilistic delivery estimation using 10,000 simulations over your team's real weekly throughput. Returns P50, P85, and P95 completion dates for a given backlog size.

![Forecast page](docs/screenshots/forecast.png)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Monorepo** | [Turborepo](https://turbo.build/) |
| **Frontend** | [Next.js 15](https://nextjs.org/) (App Router) · [Tailwind CSS v4](https://tailwindcss.com/) · [Recharts](https://recharts.org/) |
| **Backend** | [Fastify 5](https://fastify.dev/) · [Node.js 22](https://nodejs.org/) |
| **Database** | [PostgreSQL 16](https://www.postgresql.org/) — `PERCENTILE_CONT`, window functions, generated columns |
| **Queue** | [BullMQ](https://bullmq.io/) + [Redis 7](https://redis.io/) — rate-limited backfill workers |
| **Auth** | JWT (tool accounts) + OAuth 2.0 PKCE (Plane marketplace) |
| **AI** | [OpenRouter](https://openrouter.ai/) — sprint retrospective narratives (optional) |
| **Infra** | Docker Compose · designed for Vercel (web) + VPS (API/workers) |

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- A Plane workspace (cloud at [app.plane.so](https://app.plane.so) or self-hosted)
- A Plane API token: **Profile → API tokens → Create token**

### 1. Clone the repository

```bash
git clone https://github.com/kingztech2019/cadence-plane-analytics.git
cd cadence-plane-analytics
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```env
POSTGRES_PASSWORD=choose_a_strong_password
JWT_SECRET=choose_a_long_random_secret
ENCRYPTION_KEY=32_byte_hex_string_for_aes256
```

Generate the values quickly:

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# ENCRYPTION_KEY (exactly 32 bytes → 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, runs database migrations, starts the API on **port 4001**, and serves the web app on **port 3001**.

### 4. Create your account

Open [http://localhost:3001](http://localhost:3001) and sign up. Then go to **Connections** and paste your Plane workspace URL (e.g. `https://app.plane.so/my-workspace/`) along with your API token.

Cadence will begin syncing in the background. Recent data (last 90 days) is ready in ~5 minutes; full history in ~30–60 minutes depending on workspace size.

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `JWT_SECRET` | Yes | Secret for signing JWTs (min 32 chars) |
| `ENCRYPTION_KEY` | Yes | 32-byte hex key for encrypting API tokens at rest |
| `PLANE_CLIENT_ID` | OAuth only | App client ID from Plane workspace settings |
| `PLANE_CLIENT_SECRET` | OAuth only | App client secret |
| `PLANE_WEBHOOK_SECRET` | Optional | HMAC-SHA256 secret for real-time webhook updates |
| `OAUTH_REDIRECT_URI` | OAuth only | Callback URL (default: `http://localhost:4001/api/auth/plane/callback`) |
| `FRONTEND_URL` | Optional | Web app URL (default: `http://localhost:3000`) |
| `OPENROUTER_API_KEY` | Optional | Enables AI Sprint Retrospective (uses `claude-3.5-haiku`) |

### Connecting Plane

**API Key (recommended for self-hosted):**
1. In Plane: **Profile → API tokens → Create token**
2. In Cadence: **Connections → paste workspace URL + token → Connect**

**OAuth (for Plane marketplace listing):**
1. Register your app in Plane: **Workspace Settings → Integrations → New app**
2. Set `PLANE_CLIENT_ID`, `PLANE_CLIENT_SECRET`, and `OAUTH_REDIRECT_URI` in `.env`
3. In Cadence: **Connections → OAuth tab → Continue with Plane**

### State Mapping

Cadence groups Plane states into flow categories (`backlog`, `todo`, `in_progress`, `review`, `done`, `cancelled`) to compute metrics correctly. After connecting, go to **State Mapping** to review and adjust the automatic classification for each project.

---

## Development Setup

For local development without Docker:

### Prerequisites
- Node.js 22+
- PostgreSQL 16+
- Redis 7+

### Install dependencies

```bash
npm install
```

### Configure database

```bash
# Start Postgres and Redis locally, then:
cp .env.example .env
# Edit .env with your local connection strings
```

```env
DATABASE_URL=postgres://postgres:password@localhost:5432/flow_analytics
REDIS_URL=redis://localhost:6379
```

### Run migrations

```bash
npx tsx apps/api/src/db/migrate.ts
```

### Start development servers

```bash
npm run dev
```

This starts the API on `:4001` and the web app on `:3000` simultaneously via Turborepo.

### Build shared package

When modifying types in `packages/shared/src/types/`, rebuild it:

```bash
npx turbo run build --filter=@flow-analytics/shared
```

---

## Architecture

```
cadence/
├── apps/
│   ├── api/                   # Fastify REST API + BullMQ workers
│   │   ├── src/
│   │   │   ├── routes/        # HTTP endpoints (auth, analytics, workspaces, shares)
│   │   │   ├── services/
│   │   │   │   ├── metricsService.ts   # All SQL queries — cycle time, lead time, CFD, ...
│   │   │   │   ├── planeClient.ts      # Rate-limited Plane API client (60 req/min token bucket)
│   │   │   │   ├── syncService.ts      # Orchestrates backfill + incremental sync
│   │   │   │   └── aiService.ts        # OpenRouter wrapper for sprint retrospectives
│   │   │   ├── workers/       # BullMQ: backfill (high/low priority), incremental, metrics
│   │   │   └── db/            # Migrations + schema
│   │   └── Dockerfile
│   └── web/                   # Next.js 15 App Router
│       ├── src/app/
│       │   ├── (app)/         # Authenticated pages
│       │   │   ├── projects/[projectId]/   # All analytics tabs
│       │   │   └── dashboard/, connect/, setup/
│       │   └── share/[token]/ # Public read-only dashboard
│       └── Dockerfile
└── packages/
    └── shared/                # TypeScript types shared by API + web
```

### Data flow

```
Plane API  ──▶  BullMQ workers  ──▶  PostgreSQL
                  (rate-limited                │
                   60 req/min)                 │
                                               ▼
Webhook  ──────────────────────────▶  metricsService
(real-time)                                    │
                                               ▼
                                         Fastify API
                                               │
                                               ▼
                                         Next.js web
```

### Sync strategy

- **Backfill**: Two-priority queue — `high` (issues updated in last 90 days, ~5 min) before `low` (full history, ~30-60 min). The user sees charts while the deep history is still processing.
- **Incremental**: Polls Plane every 30 minutes for `updated_at > last_cursor` changes.
- **Webhooks**: Optional real-time updates via `X-Plane-Signature` HMAC-SHA256 verification.

---

## Roadmap

- [ ] **Multi-workspace view** — compare metrics across workspaces side by side
- [ ] **Custom dashboards** — pin and arrange any charts in a personal layout
- [ ] **Slack / Teams notifications** — alert on new at-risk issues or bottleneck escalations
- [ ] **CSV + PDF export** — for stakeholder reports
- [ ] **Label and epic analytics** — breakdown by work type, not just state
- [ ] **SLA tracking** — define time targets per issue type and track violations
- [ ] **Plane marketplace listing** — one-click install from the Plane integrations gallery

Have a feature in mind? [Open a discussion](https://github.com/kingztech2019/cadence-plane-analytics/discussions) or [submit a feature request](https://github.com/kingztech2019/cadence-plane-analytics/issues/new?template=feature_request.md).

---

## Contributing

Contributions are welcome and appreciated. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

**Quick version:**
1. Fork the repository
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes and add tests where relevant
4. Run `npm run typecheck` and `npm run lint` — both must pass
5. Open a pull request with a clear description

For significant changes, please open an issue first to discuss the approach.

---

## Self-Hosting in Production

The Docker Compose setup works well for small-to-medium teams. For larger deployments:

| Component | Recommended service |
|---|---|
| **Web** | [Vercel](https://vercel.com) (zero-config Next.js deploys) |
| **API + Workers** | Any VPS with Docker (Hetzner, DigitalOcean, Fly.io) |
| **PostgreSQL** | [Supabase](https://supabase.com), [Neon](https://neon.tech), or managed Postgres |
| **Redis** | [Upstash](https://upstash.com) (serverless) or self-hosted |

The API and worker processes share the same Docker image — the worker is started with `node apps/api/dist/workers/start.js` instead of the default API entrypoint.

---

## Security

- API tokens are encrypted at rest using AES-256-GCM before being stored in PostgreSQL.
- Webhook payloads are verified with `crypto.timingSafeEqual` against the HMAC-SHA256 signature.
- Shareable dashboard links use 16-byte random hex tokens — they cannot be enumerated.
- Cadence requests **read-only** Plane scopes only. It never writes to your workspace.

To report a security vulnerability, please email **security@kingztech2019** rather than opening a public issue.

---

## License

Cadence is released under the [GNU AGPL-3.0 License](LICENSE).

```
AGPL-3.0 — Copyright (c) 2025 Cadence Contributors
```

You are free to use, modify, and distribute this software for any purpose. See [LICENSE](LICENSE) for the full text.

---

<div align="center">

Built with care for engineering teams who want to understand — and improve — how they deliver software.

**[⭐ Star this repo](https://github.com/kingztech2019/cadence-plane-analytics)** if Cadence is useful to you.

</div>
