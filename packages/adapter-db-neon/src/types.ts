/**
 * Internal Neon Console API response shapes. Only the fields this adapter
 * consumes are typed.
 *
 * @module
 */

/** Neon error envelope. */
export interface NeonErrorBody {
  code?: string;
  message: string;
}

export interface NeonProject {
  id: string;
  name: string;
  region_id: string;
  pg_version?: number;
  created_at: string;
  updated_at?: string;
  branch_logical_size_limit?: number;
  default_endpoint_settings?: Record<string, unknown>;
}

export interface NeonBranch {
  id: string;
  project_id: string;
  name: string;
  parent_id?: string | null;
  default: boolean;
  created_at: string;
}

export interface NeonOperation {
  id: string;
  project_id: string;
  branch_id?: string;
  endpoint_id?: string;
  action: string;
  status: 'scheduling' | 'running' | 'finished' | 'failed' | 'error' | 'cancelled' | 'skipped';
  failures_count?: number;
  error?: string;
  created_at: string;
  updated_at?: string;
}

export interface NeonProjectCreateResponse {
  project: NeonProject;
  branch: NeonBranch;
  endpoints?: Array<{ id: string; branch_id: string; project_id: string; type: string }>;
  databases?: Array<{ id: number; branch_id: string; name: string; owner_name: string }>;
  roles?: Array<{ branch_id: string; name: string; password?: string }>;
  operations?: NeonOperation[];
  connection_uris?: Array<{ connection_uri: string }>;
}

export interface NeonProjectsListResponse {
  projects: NeonProject[];
}

export interface NeonBranchListResponse {
  branches: NeonBranch[];
}

export interface NeonConnectionUriResponse {
  uri: string;
}
