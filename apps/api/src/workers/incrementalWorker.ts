import { Worker } from 'bullmq';
import { bullmqConnection } from '../config/redis.js';
import { pool } from '../config/db.js';
import { syncService } from '../services/syncService.js';
import { incrementalQueue } from './queues.js';

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export const incrementalWorker = new Worker(
  'incremental',
  async (job) => {
    const { connectionId } = job.data as { connectionId: string };
    const result = await syncService.runIncrementalSync(connectionId);
    console.log(`[incremental] ${connectionId}: ${result.itemsUpdated} items updated`);

    // Re-schedule next sync
    await incrementalQueue.add(
      'sync',
      { connectionId },
      {
        delay: SYNC_INTERVAL_MS,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );
  },
  { connection: bullmqConnection, concurrency: 5 }
);

/** Schedule incremental sync for all active connections (called on API startup). */
export async function scheduleAllIncrementalSyncs(): Promise<void> {
  const connections = await pool.query(
    `SELECT id FROM workspace_connections WHERE sync_status = 'completed'`
  );
  for (const conn of connections.rows) {
    await incrementalQueue.add(
      'sync',
      { connectionId: conn.id },
      { delay: SYNC_INTERVAL_MS }
    );
  }
  console.log(`[incremental] Scheduled ${connections.rows.length} syncs`);
}

incrementalWorker.on('failed', (job, err) => {
  console.error(`[incremental] Job ${job?.id} failed:`, err.message);
});
