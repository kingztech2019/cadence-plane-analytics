import { Worker } from 'bullmq';
import { bullmqConnection } from '../config/redis.js';
import { pool } from '../config/db.js';
import { syncService } from '../services/syncService.js';
import { backfillInitQueue, backfillHighQueue, backfillLowQueue } from './queues.js';

const RECENT_CUTOFF_DAYS = 90;

/**
 * Backfill init worker — seeds high/low priority queues with per-work-item jobs.
 * High priority: items updated within 90 days → user sees charts in ~15 min.
 * Low priority: older items → completes in background.
 */
export const backfillInitWorker = new Worker(
  'backfill_init',
  async (job) => {
    if (job.name !== 'backfill_init') return;
    const { connectionId } = job.data as { connectionId: string };

    // Sync metadata first (projects, states, cycles, members)
    await syncService.syncMetadata(connectionId);

    const projects = await pool.query(
      `SELECT id, plane_project_id FROM plane_projects WHERE workspace_connection_id = $1`,
      [connectionId]
    );

    const cutoff = new Date(Date.now() - RECENT_CUTOFF_DAYS * 86400_000).toISOString();
    const { client, workspaceSlug } = await syncService.getClient(connectionId);

    for (const project of projects.rows) {
      try {
        let cursor: string | undefined;

        let hasMore = true;
        do {
          const page = await client.listWorkItems(workspaceSlug, project.plane_project_id, {
            cursor,
          });

          for (const item of page.results) {
            const isRecent = new Date(item.updated_at) >= new Date(cutoff);
            const queue = isRecent ? backfillHighQueue : backfillLowQueue;

            await queue.add(
              'backfill_item',
              {
                connectionId,
                internalProjectId: project.id,
                planeProjectId: project.plane_project_id,
                workspaceSlug,
                item,
              },
              {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
              }
            );
          }

          hasMore = page.next_page_results;
          cursor = page.next_cursor ?? undefined;
        } while (hasMore);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('403')) {
          console.warn(`[backfill] Skipping project ${project.plane_project_id} — API key lacks access`);
        } else {
          throw err;
        }
      }
    }
  },
  { connection: bullmqConnection, concurrency: 1 }
);

/**
 * High-priority item worker — processes recent work items first.
 */
export const backfillHighWorker = new Worker(
  'backfill_high',
  async (job) => {
    if (job.name !== 'backfill_item') return;
    await processBackfillItem(job.data);
  },
  { connection: bullmqConnection, concurrency: 8 }
);

/**
 * Low-priority item worker — processes historical items in the background.
 */
export const backfillLowWorker = new Worker(
  'backfill_low',
  async (job) => {
    await processBackfillItem(job.data);
  },
  { connection: bullmqConnection, concurrency: 4 }
);

async function processBackfillItem(data: {
  connectionId: string;
  internalProjectId: string;
  planeProjectId: string;
  workspaceSlug: string;
  item: Parameters<typeof syncService.upsertWorkItem>[0];
}): Promise<void> {
  const { connectionId, internalProjectId, planeProjectId, workspaceSlug, item } = data;

  // Skip activity fetch if item was never updated (no transitions)
  if (item.created_at === item.updated_at) return;

  const internalId = await syncService.upsertWorkItem(item, internalProjectId, connectionId);
  const { client } = await syncService.getClient(connectionId);
  await syncService.upsertTransitions(internalId, workspaceSlug, planeProjectId, item.id, client);

  await pool.query(
    `INSERT INTO sync_jobs (workspace_connection_id, job_type, status, items_synced)
     VALUES ($1, 'backfill', 'completed', 1)
     ON CONFLICT DO NOTHING`,
    [connectionId]
  );
}

backfillInitWorker.on('completed', (job) => {
  console.log(`[backfill_init] Job ${job.id} completed`);
});

backfillHighWorker.on('failed', (job, err) => {
  console.error(`[backfill_high] Job ${job?.id} failed:`, err.message);
});

backfillLowWorker.on('failed', (job, err) => {
  console.error(`[backfill_low] Job ${job?.id} failed:`, err.message);
});
