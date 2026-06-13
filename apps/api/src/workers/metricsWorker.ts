import { Worker } from 'bullmq';
import { bullmqConnection } from '../config/redis.js';
import { pool } from '../config/db.js';
import { syncService } from '../services/syncService.js';

export const metricsWorker = new Worker(
  'metrics_compute',
  async (job) => {
    if (job.name !== 'webhook_process') return;

    const { eventType, action, data, workspaceSlug, projectId } = job.data as {
      eventType: string;
      action: string;
      data: Record<string, unknown>;
      workspaceSlug: string;
      projectId: string;
    };

    if (eventType !== 'issue' || action === 'deleted') return;

    // Find internal project
    const projResult = await pool.query(
      `SELECT pp.id, pp.workspace_connection_id
       FROM plane_projects pp
       JOIN workspace_connections wc ON wc.id = pp.workspace_connection_id
       WHERE pp.plane_project_id = $1 AND wc.plane_workspace_slug = $2`,
      [projectId, workspaceSlug]
    );
    if (!projResult.rows[0]) return;

    const { id: internalProjectId, workspace_connection_id: connectionId } = projResult.rows[0];

    const issueData = data as {
      id: string;
      sequence_id: number;
      name: string;
      priority: string;
      state: string;
      assignees: string[];
      label_ids: string[];
      cycle_id: string | null;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
    };

    const internalId = await syncService.upsertWorkItem(issueData, internalProjectId, connectionId);
    const { client } = await syncService.getClient(connectionId);
    await syncService.upsertTransitions(
      internalId,
      workspaceSlug,
      projectId,
      issueData.id,
      client
    );
  },
  { connection: bullmqConnection, concurrency: 10 }
);

metricsWorker.on('failed', (job, err) => {
  console.error(`[metrics] Job ${job?.id} failed:`, err.message);
});
