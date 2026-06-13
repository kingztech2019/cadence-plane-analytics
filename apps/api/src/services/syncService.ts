import { pool } from '../config/db.js';
import { redis } from '../config/redis.js';
import { backfillInitQueue, backfillHighQueue, backfillLowQueue, incrementalQueue } from '../workers/queues.js';
import { PlaneClient } from './planeClient.js';
import { decryptApiKey } from './crypto.js';
import type { PlaneActivity, PlaneStateGroup } from '@flow-analytics/shared';

// Default flow_category per Plane state group
const GROUP_TO_FLOW: Record<PlaneStateGroup, string> = {
  backlog: 'backlog',
  unstarted: 'todo',
  started: 'in_progress',
  completed: 'done',
  cancelled: 'cancelled',
};

export const syncService = {
  /** Build a PlaneClient for a given connection. */
  async getClient(connectionId: string): Promise<{ client: PlaneClient; workspaceSlug: string }> {
    const result = await pool.query(
      `SELECT base_url, auth_method, api_key_encrypted, oauth_access_token,
              plane_workspace_slug
       FROM workspace_connections WHERE id = $1`,
      [connectionId]
    );
    const conn = result.rows[0];
    if (!conn) throw new Error(`Connection ${connectionId} not found`);

    const apiKey =
      conn.auth_method === 'api_key'
        ? decryptApiKey(conn.api_key_encrypted)
        : undefined;

    const client = new PlaneClient({
      baseUrl: conn.base_url,
      apiKey,
      accessToken: conn.oauth_access_token ?? undefined,
      connectionId,
      redis,
    });

    return { client, workspaceSlug: conn.plane_workspace_slug };
  },

  /** Enqueue a full backfill for a newly connected workspace. */
  async kickoffBackfill(connectionId: string): Promise<void> {
    await pool.query(
      `UPDATE workspace_connections SET sync_status = 'running' WHERE id = $1`,
      [connectionId]
    );

    await backfillInitQueue.add(
      'backfill_init',
      { connectionId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
    );
  },

  /** Sync metadata: projects, states, cycles, members for a connection. */
  async syncMetadata(connectionId: string): Promise<void> {
    const { client, workspaceSlug } = await syncService.getClient(connectionId);

    // Projects
    const projects = await client.listProjects(workspaceSlug);
    for (const p of projects.results) {
      const projResult = await pool.query(
        `INSERT INTO plane_projects (workspace_connection_id, plane_project_id, name, identifier)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_connection_id, plane_project_id)
         DO UPDATE SET name = $3, identifier = $4, synced_at = NOW()
         RETURNING id`,
        [connectionId, p.id, p.name, p.identifier]
      );
      const internalProjectId = projResult.rows[0].id;

      // States — skip project if API key lacks access (403)
      try {
        const states = await client.listStates(workspaceSlug, p.id);
        for (const s of states.results) {
          await pool.query(
            `INSERT INTO plane_states
               (plane_project_id, plane_state_id, name, color, plane_group, flow_category, sequence_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (plane_project_id, plane_state_id)
             DO UPDATE SET name = $3, color = $4, plane_group = $5, sequence_order = $7`,
            [
              internalProjectId,
              s.id,
              s.name,
              s.color,
              s.group,
              GROUP_TO_FLOW[s.group as PlaneStateGroup] ?? 'todo',
              s.sequence,
            ]
          );
        }

        // Cycles
        const cycles = await client.listCycles(workspaceSlug, p.id);
        for (const c of cycles.results) {
          await pool.query(
            `INSERT INTO plane_cycles (plane_project_id, plane_cycle_id, name, status, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (plane_project_id, plane_cycle_id)
             DO UPDATE SET name = $3, status = $4, start_date = $5, end_date = $6`,
            [internalProjectId, c.id, c.name, c.status, c.start_date, c.end_date]
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('403')) {
          console.warn(`[sync] Skipping project ${p.identifier} (${p.id}) — API key lacks access`);
        } else {
          throw err;
        }
      }
    }

    // Workspace members — returns a flat array (no pagination wrapper)
    const members = await client.listMembers(workspaceSlug);
    for (const m of members) {
      await pool.query(
        `INSERT INTO workspace_members
           (workspace_connection_id, plane_member_id, display_name, email, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (workspace_connection_id, plane_member_id)
         DO UPDATE SET display_name = $3, email = $4`,
        [
          connectionId,
          m.id,
          m.display_name,
          m.email,
          m.role.toString(),
        ]
      );
    }
  },

  /** Upsert state transitions from raw activity records. */
  async upsertTransitions(
    internalWorkItemId: string,
    workspaceSlug: string,
    projectId: string,
    planeIssueId: string,
    client: PlaneClient
  ): Promise<void> {
    const activities = await client.listActivities(workspaceSlug, projectId, planeIssueId);
    const stateChanges = activities.results.filter(
      (a: PlaneActivity) => a.field === 'state' && a.new_identifier
    );

    // Look up internal state IDs
    const stateIdCache = new Map<string, string>();
    const getStateId = async (planeStateId: string): Promise<string | null> => {
      if (stateIdCache.has(planeStateId)) return stateIdCache.get(planeStateId)!;
      const r = await pool.query(
        `SELECT ps.id FROM plane_states ps
         JOIN plane_projects pp ON pp.id = ps.plane_project_id
         WHERE ps.plane_state_id = $1`,
        [planeStateId]
      );
      const id = r.rows[0]?.id ?? null;
      if (id) stateIdCache.set(planeStateId, id);
      return id;
    };

    // Get actor member ID
    const getMemberId = async (planeMemberId: string, connectionId: string): Promise<string | null> => {
      const r = await pool.query(
        `SELECT id FROM workspace_members WHERE plane_member_id = $1 AND workspace_connection_id = $2`,
        [planeMemberId, connectionId]
      );
      return r.rows[0]?.id ?? null;
    };

    // Get connection ID from work item
    const connResult = await pool.query(
      `SELECT pp.workspace_connection_id FROM work_items wi
       JOIN plane_projects pp ON pp.id = wi.plane_project_id
       WHERE wi.id = $1`,
      [internalWorkItemId]
    );
    const connectionId = connResult.rows[0]?.workspace_connection_id;

    for (let i = 0; i < stateChanges.length; i++) {
      const act = stateChanges[i]!;
      const toStateId = await getStateId(act.new_identifier!);
      if (!toStateId) continue;

      const fromStateId = act.old_identifier
        ? await getStateId(act.old_identifier)
        : null;

      const actorId = connectionId
        ? await getMemberId(act.actor, connectionId)
        : null;

      await pool.query(
        `INSERT INTO state_transitions
           (work_item_id, from_state_id, to_state_id, transitioned_at, actor_id, plane_activity_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (plane_activity_id) DO NOTHING`,
        [internalWorkItemId, fromStateId, toStateId, act.created_at, actorId, act.id]
      );
    }

    // Rebuild time_in_state for this work item
    await syncService.rebuildTimeInState(internalWorkItemId);
  },

  /** Recompute time_in_state rows from state_transitions. */
  async rebuildTimeInState(workItemId: string): Promise<void> {
    await pool.query('DELETE FROM time_in_state WHERE work_item_id = $1', [workItemId]);

    const transitions = await pool.query(
      `SELECT to_state_id, transitioned_at
       FROM state_transitions
       WHERE work_item_id = $1
       ORDER BY transitioned_at ASC`,
      [workItemId]
    );

    for (let i = 0; i < transitions.rows.length; i++) {
      const current = transitions.rows[i];
      const next = transitions.rows[i + 1] ?? null;
      await pool.query(
        `INSERT INTO time_in_state (work_item_id, state_id, entered_at, exited_at)
         VALUES ($1, $2, $3, $4)`,
        [workItemId, current.to_state_id, current.transitioned_at, next?.transitioned_at ?? null]
      );
    }

    // Update computed metrics on work_item
    await pool.query(
      `UPDATE work_items wi SET
         cycle_time_hours = sub.cycle_hours,
         lead_time_hours  = sub.lead_hours
       FROM (
         SELECT
           wi2.id,
           EXTRACT(EPOCH FROM (
             MIN(tis_done.entered_at) - MIN(tis_start.entered_at)
           )) / 3600.0  AS cycle_hours,
           EXTRACT(EPOCH FROM (
             wi2.completed_at_plane - wi2.created_at_plane
           )) / 3600.0  AS lead_hours
         FROM work_items wi2
         LEFT JOIN time_in_state tis_start ON tis_start.work_item_id = wi2.id
           JOIN plane_states ps_s ON ps_s.id = tis_start.state_id AND ps_s.flow_category = 'in_progress'
         LEFT JOIN time_in_state tis_done ON tis_done.work_item_id = wi2.id
           JOIN plane_states ps_d ON ps_d.id = tis_done.state_id AND ps_d.flow_category = 'done'
         WHERE wi2.id = $1
         GROUP BY wi2.id
       ) sub
       WHERE wi.id = sub.id`,
      [workItemId]
    );
  },

  /** Run an incremental sync for a connection (called by incrementalWorker). */
  async runIncrementalSync(connectionId: string): Promise<{ itemsUpdated: number }> {
    const connResult = await pool.query(
      `SELECT plane_workspace_slug, incremental_cursor
       FROM workspace_connections WHERE id = $1`,
      [connectionId]
    );
    const conn = connResult.rows[0];
    if (!conn) throw new Error('Connection not found');

    const { client, workspaceSlug } = await syncService.getClient(connectionId);
    const cursor = conn.incremental_cursor ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const projects = await pool.query(
      `SELECT id, plane_project_id FROM plane_projects WHERE workspace_connection_id = $1`,
      [connectionId]
    );

    let itemsUpdated = 0;
    const newCursor = new Date().toISOString();

    for (const project of projects.rows) {
      let pageCursor: string | undefined;

      do {
        const page = await client.listWorkItems(workspaceSlug, project.plane_project_id, {
          cursor: pageCursor,
          updatedAtGte: cursor,
        });

        for (const item of page.results) {
          await syncService.upsertWorkItem(item, project.id, connectionId);
          await syncService.upsertTransitions(
            item.id, workspaceSlug, project.plane_project_id, item.id, client
          );
          itemsUpdated++;
        }

        pageCursor = page.next_page_results ? (page.next_cursor ?? undefined) : undefined;
      } while (pageCursor);
    }

    await pool.query(
      `UPDATE workspace_connections
       SET incremental_cursor = $1, last_incremental_sync_at = NOW()
       WHERE id = $2`,
      [newCursor, connectionId]
    );

    return { itemsUpdated };
  },

  /** Upsert a single work item record. */
  async upsertWorkItem(
    item: { id: string; sequence_id: number; name: string; priority: string; state: string; assignees: string[]; label_ids: string[]; cycle_id: string | null; created_at: string; updated_at: string; completed_at: string | null },
    internalProjectId: string,
    connectionId: string
  ): Promise<string> {
    // Resolve state UUID
    const stateResult = await pool.query(
      `SELECT id FROM plane_states WHERE plane_state_id = $1`,
      [item.state]
    );
    const stateId = stateResult.rows[0]?.id ?? null;

    // Resolve assignee (first assignee)
    let assigneeId: string | null = null;
    if (item.assignees[0]) {
      const aResult = await pool.query(
        `SELECT id FROM workspace_members WHERE plane_member_id = $1 AND workspace_connection_id = $2`,
        [item.assignees[0], connectionId]
      );
      assigneeId = aResult.rows[0]?.id ?? null;
    }

    // Resolve cycle UUID
    let cycleId: string | null = null;
    if (item.cycle_id) {
      const cResult = await pool.query(
        `SELECT id FROM plane_cycles WHERE plane_cycle_id = $1`,
        [item.cycle_id]
      );
      cycleId = cResult.rows[0]?.id ?? null;
    }

    const result = await pool.query(
      `INSERT INTO work_items
         (plane_project_id, plane_work_item_id, sequence_id, title, priority,
          plane_state_id, assignee_id, label_ids, cycle_id,
          created_at_plane, updated_at_plane, completed_at_plane)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (plane_project_id, plane_work_item_id)
       DO UPDATE SET
         title = $4, priority = $5, plane_state_id = $6, assignee_id = $7,
         label_ids = $8, cycle_id = $9, updated_at_plane = $11,
         completed_at_plane = $12
       RETURNING id`,
      [
        internalProjectId,
        item.id,
        item.sequence_id,
        item.name,
        item.priority,
        stateId,
        assigneeId,
        item.label_ids,
        cycleId,
        item.created_at,
        item.updated_at,
        item.completed_at,
      ]
    );

    return result.rows[0].id;
  },
};
