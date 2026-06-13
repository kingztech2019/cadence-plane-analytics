// Plane REST API entity shapes (Work Items API — /api/v1/workspaces/:slug/projects/:id/work-items/)
// Note: /issues/ endpoints are deprecated as of March 2026; all list/filter uses /work-items/

export type PlaneStateGroup = 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';

export interface PlaneWorkspace {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaneProject {
  id: string;
  identifier: string;
  name: string;
  description: string;
  network: number;
  workspace: string;
  created_at: string;
  updated_at: string;
}

export interface PlaneState {
  id: string;
  name: string;
  color: string;
  group: PlaneStateGroup;
  sequence: number;
  default: boolean;
  project: string;
}

export interface PlaneMember {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email: string;
  avatar: string | null;
  avatar_url: string | null;
  role: number;
}

export interface PlaneCycle {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'started' | 'completed';
  start_date: string | null;
  end_date: string | null;
  project: string;
  created_at: string;
  updated_at: string;
}

export interface PlaneWorkItem {
  id: string;
  sequence_id: number;
  name: string;
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  state: string;              // state UUID
  assignees: string[];        // member UUIDs
  label_ids: string[];
  cycle_id: string | null;
  estimate_point: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  project: string;
}

// Activity records from /issues/:id/activities/ — still active endpoint
export interface PlaneActivity {
  id: string;
  verb: string;               // 'created' | 'updated' | 'deleted'
  field: string | null;       // e.g. 'state', 'assignees', 'priority'
  old_value: string | null;
  new_value: string | null;
  old_identifier: string | null;
  new_identifier: string | null;
  actor: string;              // member UUID
  created_at: string;
  project: string;
  issue: string;
}

export interface PlaneWebhookEvent {
  event: 'issue' | 'project' | 'cycle' | 'module' | 'issue_comment';
  action: 'created' | 'updated' | 'deleted';
  workspace_slug: string;
  project_id: string;
  data: PlaneWorkItem | PlaneProject | PlaneCycle | Record<string, unknown>;
}

export interface PlanePaginatedResponse<T> {
  count: number;
  total_pages: number;
  total_results: number;
  next_cursor: string | null;
  prev_cursor: string | null;
  next_page_results: boolean;
  prev_page_results: boolean;
  results: T[];
}
