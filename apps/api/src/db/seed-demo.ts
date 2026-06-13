/**
 * Demo seed script — creates a self-contained demo account with realistic
 * fake data so you can take README screenshots without exposing real company data.
 *
 * Usage (from repo root):
 *   DATABASE_URL=postgres://flow_user:YOUR_PASSWORD@localhost:5432/flow_analytics \
 *     npx tsx apps/api/src/db/seed-demo.ts
 *
 * Or, if your .env is already exported in the shell:
 *   export $(grep -v '^#' .env | xargs)
 *   DATABASE_URL=postgres://flow_user:${POSTGRES_PASSWORD}@localhost:5432/flow_analytics \
 *     npx tsx apps/api/src/db/seed-demo.ts
 *
 * Or inside Docker (after building):
 *   docker exec -e DATABASE_URL=postgres://flow_user:YOUR_PASSWORD@localhost:5432/flow_analytics \
 *     plane-project-api-1 node apps/api/dist/db/seed-demo.js
 *
 * Login after seeding:
 *   Email:    demo@cadence.dev
 *   Password: demo1234
 *
 * To wipe and re-seed: add --reset flag
 *   npx tsx apps/api/src/db/seed-demo.ts --reset
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://flow_user:changeme_strong_password@localhost:5432/flow_analytics';

const pool = new Pool({ connectionString: DATABASE_URL });
const RESET = process.argv.includes('--reset');

// ─── Deterministic helpers ────────────────────────────────────────────────────

/** Pseudo-random number generator seeded for reproducibility */
function mkRand(seed: number) {
  let s = seed;
  return (): number => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Deterministic UUID from a seed string so re-runs are idempotent */
function uid(seed: string): string {
  const h = crypto.createHash('sha256').update(seed).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(13, 16),
    ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + h.slice(18, 20),
    h.slice(20, 32),
  ].join('-');
}

/** Log-normal deviate — use when you want a median of `median` with spread `sigma` */
function logNormal(rand: () => number, median: number, sigma: number): number {
  const u1 = Math.max(rand(), 1e-10);
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0.25, Math.exp(Math.log(median) + sigma * z));
}

// ─── Fixed seed IDs ───────────────────────────────────────────────────────────

const DEMO_USER_ID = uid('demo-user-v1');
const WS_CONN_ID   = uid('ws-conn-v1');

// ─── Team members (8 people with realistic names) ─────────────────────────────

const MEMBERS = [
  { id: uid('m-lena'),   planeId: 'pm_001', name: 'Lena Park',     email: 'lena@acme-corp.dev'    },
  { id: uid('m-marcus'), planeId: 'pm_002', name: 'Marcus Webb',   email: 'marcus@acme-corp.dev'  },
  { id: uid('m-priya'),  planeId: 'pm_003', name: 'Priya Sharma',  email: 'priya@acme-corp.dev'   },
  { id: uid('m-jordan'), planeId: 'pm_004', name: 'Jordan Ellis',  email: 'jordan@acme-corp.dev'  },
  { id: uid('m-sam'),    planeId: 'pm_005', name: 'Sam Okafor',    email: 'sam@acme-corp.dev'     },
  { id: uid('m-dev'),    planeId: 'pm_006', name: 'Dev Chen',      email: 'dev@acme-corp.dev'     },
  { id: uid('m-aisha'),  planeId: 'pm_007', name: 'Aisha Torres',  email: 'aisha@acme-corp.dev'   },
  { id: uid('m-ryan'),   planeId: 'pm_008', name: 'Ryan Blake',    email: 'ryan@acme-corp.dev'    },
];

// ─── Projects ─────────────────────────────────────────────────────────────────

const PROJECTS = [
  { id: uid('proj-platform'), planeId: 'pp_001', name: 'Platform Core',  identifier: 'PLAT', seed: 1001 },
  { id: uid('proj-mobile'),   planeId: 'pp_002', name: 'Mobile App',     identifier: 'MOB',  seed: 2001 },
  { id: uid('proj-api'),      planeId: 'pp_003', name: 'API Gateway',    identifier: 'API',  seed: 3001 },
  { id: uid('proj-design'),   planeId: 'pp_004', name: 'Design System',  identifier: 'DS',   seed: 4001 },
];

// ─── Realistic issue titles (50 varied) ───────────────────────────────────────

const TITLES = [
  'Implement authentication middleware',
  'Fix memory leak in data processor',
  'Add pagination to list endpoints',
  'Refactor database connection pool',
  'Update API documentation',
  'Improve error handling in sync worker',
  'Add rate limiting to public endpoints',
  'Fix timezone handling in date fields',
  'Implement caching layer for metrics',
  'Add retry logic for failed requests',
  'Update dependency versions to latest stable',
  'Fix race condition in queue processor',
  'Improve logging format consistency',
  'Add health check endpoint',
  'Optimize slow database queries',
  'Implement webhook signature verification',
  'Add unit tests for analytics service',
  'Fix incorrect cycle time calculation',
  'Improve mobile responsiveness on dashboards',
  'Add dark mode support to settings page',
  'Implement CSV export feature',
  'Fix button alignment on small screens',
  'Add loading skeleton to all charts',
  'Improve chart tooltip accuracy',
  'Fix date picker range validation',
  'Add keyboard navigation shortcuts',
  'Implement drag-and-drop reordering',
  'Fix broken link in sidebar navigation',
  'Improve search debouncing performance',
  'Add empty state illustrations',
  'Fix data table overflow on narrow viewports',
  'Implement data export to PDF',
  'Add confirmation modal for destructive actions',
  'Improve form validation error messages',
  'Fix scroll restoration on route change',
  'Smooth animated page transitions',
  'Implement virtual scroll for large lists',
  'Fix filter state not persisting on refresh',
  'Add breadcrumb navigation component',
  'Improve accessibility for screen readers',
  'Fix OAuth redirect loop on token expiry',
  'Add session timeout warning dialog',
  'Fix password reset email template styling',
  'Add audit log for admin actions',
  'Improve new user onboarding flow',
  'Fix incorrect dashboard completion statistics',
  'Add workspace usage metrics overview',
  'Implement role-based permission checks',
  'Fix notification preferences not saving',
  'Refactor state management to use Zustand',
];

// ─── State metadata ────────────────────────────────────────────────────────────

const STATE_DEFS = [
  { key: 'backlog',   name: 'Backlog',     category: 'backlog',     group: 'backlog',    seq: 1, color: '#94a3b8' },
  { key: 'todo',      name: 'Todo',        category: 'todo',        group: 'unstarted',  seq: 2, color: '#60a5fa' },
  { key: 'progress',  name: 'In Progress', category: 'in_progress', group: 'started',    seq: 3, color: '#f59e0b' },
  { key: 'review',    name: 'In Review',   category: 'review',      group: 'started',    seq: 4, color: '#a78bfa' },
  { key: 'done',      name: 'Done',        category: 'done',        group: 'completed',  seq: 5, color: '#34d399' },
  { key: 'cancelled', name: 'Cancelled',   category: 'cancelled',   group: 'cancelled',  seq: 6, color: '#f87171' },
];

// ─── Main seed function ────────────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── Optionally wipe demo data ──
    if (RESET) {
      console.log('Resetting demo data…');
      await client.query(`DELETE FROM users WHERE email = 'demo@cadence.dev'`);
      console.log('  ✓ Cleared');
    }

    // ── Demo user ──
    console.log('Creating demo user…');
    const passwordHash = await bcrypt.hash('demo1234', 10);
    await client.query(
      `INSERT INTO users (id, email, password_hash, name)
       VALUES ($1, 'demo@cadence.dev', $2, 'Demo User')
       ON CONFLICT (email) DO NOTHING`,
      [DEMO_USER_ID, passwordHash]
    );

    // ── Workspace connection ──
    console.log('Creating workspace connection…');
    await client.query(
      `INSERT INTO workspace_connections
         (id, owner_user_id, plane_workspace_slug, plane_workspace_id,
          base_url, auth_method, api_key_encrypted, sync_status, last_full_sync_at)
       VALUES ($1, $2, 'acme-engineering', 'ws_acme_demo',
               'https://api.plane.so', 'api_key', 'demo_key_placeholder',
               'completed', NOW() - INTERVAL '1 hour')
       ON CONFLICT DO NOTHING`,
      [WS_CONN_ID, DEMO_USER_ID]
    );

    // ── Workspace members ──
    console.log('Creating team members…');
    for (const m of MEMBERS) {
      await client.query(
        `INSERT INTO workspace_members
           (id, workspace_connection_id, plane_member_id, display_name, email, role)
         VALUES ($1, $2, $3, $4, $5, 'member')
         ON CONFLICT DO NOTHING`,
        [m.id, WS_CONN_ID, m.planeId, m.name, m.email]
      );
    }

    // ── Projects ──
    for (const proj of PROJECTS) {
      console.log(`\nSeeding project: ${proj.name}…`);

      await client.query(
        `INSERT INTO plane_projects
           (id, workspace_connection_id, plane_project_id, name, identifier)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [proj.id, WS_CONN_ID, proj.planeId, proj.name, proj.identifier]
      );

      // ── States ──
      const states: Record<string, string> = {}; // key → DB UUID
      for (const sd of STATE_DEFS) {
        const stateId = uid(`${proj.id}-${sd.key}`);
        states[sd.key] = stateId;
        await client.query(
          `INSERT INTO plane_states
             (id, plane_project_id, plane_state_id, name, color, plane_group, flow_category, sequence_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT DO NOTHING`,
          [stateId, proj.id, `${proj.planeId}_s${sd.seq}`, sd.name, sd.color, sd.group, sd.category, sd.seq]
        );
      }

      // ── Sprints (6 × 2-week sprints ending ~3 months ago) ──
      const cycles: Array<{ id: string; start: Date; end: Date; name: string }> = [];
      for (let i = 0; i < 6; i++) {
        const cycleId  = uid(`${proj.id}-cycle-${i}`);
        const startMs  = Date.now() - (180 - i * 28) * 86400_000;
        const start    = new Date(startMs);
        const end      = new Date(startMs + 13 * 86400_000);
        const status   = i < 5 ? 'completed' : 'current';
        cycles.push({ id: cycleId, start, end, name: `Sprint ${i + 1}` });
        await client.query(
          `INSERT INTO plane_cycles
             (id, plane_project_id, plane_cycle_id, name, status, start_date, end_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [cycleId, proj.id, `${proj.planeId}_c${i}`,
           `Sprint ${i + 1}`, status,
           start.toISOString().slice(0, 10),
           end.toISOString().slice(0, 10)]
        );
      }

      // ── Work items ──
      const rand     = mkRand(proj.seed);
      const ITEMS    = 130;

      for (let i = 0; i < ITEMS; i++) {
        const itemId    = uid(`${proj.id}-item-${i}`);
        const title     = TITLES[i % TITLES.length]! + (i >= TITLES.length ? ` (${Math.floor(i / TITLES.length) + 1})` : '');
        const priority  = (['urgent', 'high', 'medium', 'low', 'none'] as const)[Math.floor(rand() * 5)]!;

        // Assign to a real person — Marcus (idx 1) gets extra WIP to trigger "overloaded" flag
        const assigneeIdx = i < 8 ? i % MEMBERS.length : Math.floor(rand() * MEMBERS.length);
        const assignee    = MEMBERS[assigneeIdx]!;

        // 83% completed, 12% active, 5% cancelled
        const roll        = rand();
        const isCompleted = roll < 0.83;
        const isCancelled = roll > 0.95;
        const isActive    = !isCompleted && !isCancelled;

        // Spread completions over last 6 months — bias toward recent
        const daysAgo     = isCompleted ? Math.floor(rand() * rand() * 180) + 1 : 0;
        const completedAt = isCompleted ? new Date(Date.now() - daysAgo * 86400_000) : null;

        // Cycle time trend: recent items are ~20% faster (improving signal)
        const trendFactor  = isCompleted ? 1 + (daysAgo / 180) * 0.25 : 1;
        // Review is the bottleneck: median 30h; In Progress: 18h — Review P85 > In Progress P85
        const reviewH      = logNormal(rand, 30 * trendFactor, 0.85);
        const progressH    = logNormal(rand, 18 * trendFactor, 0.70);
        const todoH        = logNormal(rand, 6,  0.60);
        const backlogH     = logNormal(rand, 80, 1.00);

        const cycleTimeHours  = isCompleted ? progressH + reviewH : null;
        const leadTimeHours   = isCompleted ? backlogH + todoH + progressH + reviewH : null;

        // Ryan (idx 7) has elevated reactivation (~28%) to trigger flag
        const reactivationRate = assignee.id === MEMBERS[7]!.id ? 0.28 : 0.13;
        const isReactivated    = isCompleted && rand() < reactivationRate;

        const createdAt   = isCompleted && leadTimeHours
          ? new Date(completedAt!.getTime() - leadTimeHours * 3600_000)
          : new Date(Date.now() - Math.floor(rand() * 90 + 5) * 86400_000);

        const currentStateId = isCompleted
          ? states['done']!
          : isActive
          ? (rand() < 0.55 ? states['progress']! : states['review']!)
          : states['cancelled']!;

        await client.query(
          `INSERT INTO work_items
             (id, plane_project_id, plane_work_item_id, sequence_id, title,
              priority, plane_state_id, assignee_id,
              created_at_plane, updated_at_plane, completed_at_plane,
              cycle_time_hours, lead_time_hours, is_reactivated)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT DO NOTHING`,
          [
            itemId, proj.id, `${proj.planeId}_wi${i}`, i + 1, title,
            priority, currentStateId, assignee.id,
            createdAt.toISOString(),
            (completedAt ?? createdAt).toISOString(),
            completedAt?.toISOString() ?? null,
            cycleTimeHours, leadTimeHours, isReactivated,
          ]
        );

        // ── time_in_state for completed items ──
        if (isCompleted && completedAt) {
          let cursor = completedAt.getTime();

          // Done (terminal — open-ended so CFD works)
          await tis(client, itemId, states['done']!, cursor, null);

          // In Review
          const reviewEnter = cursor - reviewH * 3600_000;
          await tis(client, itemId, states['review']!, reviewEnter, cursor);
          cursor = reviewEnter;

          // In Progress
          const progressEnter = cursor - progressH * 3600_000;
          await tis(client, itemId, states['progress']!, progressEnter, cursor);
          cursor = progressEnter;

          // Todo
          const todoEnter = cursor - todoH * 3600_000;
          await tis(client, itemId, states['todo']!, todoEnter, cursor);
          cursor = todoEnter;

          // Backlog
          const backlogEnter = cursor - backlogH * 3600_000;
          await tis(client, itemId, states['backlog']!, backlogEnter, cursor);
        }

        // ── time_in_state for active items (some at-risk) ──
        if (isActive) {
          // Marcus (idx 1) gets extra-long active time to push past P85 → at-risk
          const isOverloaded = assignee.id === MEMBERS[1]!.id;
          // Base active hours: mostly normal (8–40h), some already past P85
          const atRiskRoll   = rand();
          let hoursActive: number;
          if (isOverloaded || atRiskRoll < 0.30) {
            // Clearly past P85 — these show up in At-Risk radar
            hoursActive = 55 + rand() * 120;
          } else {
            hoursActive = 4 + rand() * rand() * 40;
          }
          const stateKey  = rand() < 0.55 ? 'progress' : 'review';
          const enteredAt = new Date(Date.now() - hoursActive * 3600_000);
          await tis(client, itemId, states[stateKey]!, enteredAt.getTime(), null);
        }
      }

      // ── Extra WIP for Marcus to trigger "overloaded" team health flag ──
      // The loop above already skews Marcus's assignments; ensure he has ≥5 open items
      for (let x = 0; x < 4; x++) {
        const extraId = uid(`${proj.id}-marcus-extra-${x}`);
        const createdAt = new Date(Date.now() - 14 * 86400_000);
        await client.query(
          `INSERT INTO work_items
             (id, plane_project_id, plane_work_item_id, sequence_id, title,
              priority, plane_state_id, assignee_id,
              created_at_plane, updated_at_plane,
              cycle_time_hours, lead_time_hours, is_reactivated)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,NULL,NULL,false)
           ON CONFLICT DO NOTHING`,
          [
            extraId, proj.id, `${proj.planeId}_mx${x}`, 200 + x,
            `Investigate performance regression (${x + 1})`,
            'high', states['progress']!, MEMBERS[1]!.id,
            createdAt.toISOString(),
          ]
        );
        const hoursActive = 60 + x * 15;
        const enteredAt   = new Date(Date.now() - hoursActive * 3600_000);
        await tis(client, extraId, states['progress']!, enteredAt.getTime(), null);
      }

      console.log(`  ✓ ${ITEMS} issues + time-in-state records`);
    }

    await client.query('COMMIT');

    console.log('\n─────────────────────────────────────────');
    console.log('✓  Demo seed complete!');
    console.log('');
    console.log('   URL:      http://localhost:3001');
    console.log('   Email:    demo@cadence.dev');
    console.log('   Password: demo1234');
    console.log('');
    console.log('   Workspace:  acme-engineering');
    console.log('   Projects:   Platform Core · Mobile App · API Gateway · Design System');
    console.log('   Team:       8 members');
    console.log('');
    console.log('   Features seeded:');
    console.log('     • Cycle time improving trend (last 30d < prior 30d)');
    console.log('     • "In Review" is the bottleneck (highest P85)');
    console.log('     • Persistent bottleneck across 3 windows');
    console.log('     • At-risk issues exceeding state P85');
    console.log('     • Marcus Webb: overloaded (high WIP)');
    console.log('     • Ryan Blake: high reactivation rate');
    console.log('     • 6 sprints of velocity data per project');
    console.log('─────────────────────────────────────────\n');

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tis(
  client: { query: (sql: string, values?: any[]) => Promise<any> },
  workItemId: string,
  stateId: string,
  enteredAtMs: number,
  exitedAtMs: number | null
) {
  const id = uid(`tis-${workItemId}-${stateId}-${enteredAtMs}`);
  await client.query(
    `INSERT INTO time_in_state (id, work_item_id, state_id, entered_at, exited_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [
      id, workItemId, stateId,
      new Date(enteredAtMs).toISOString(),
      exitedAtMs !== null ? new Date(exitedAtMs).toISOString() : null,
    ]
  );
}

seed().catch((err) => {
  console.error('\n✗ Seed failed:', err.message);
  process.exit(1);
});
