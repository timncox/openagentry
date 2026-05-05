/**
 * Internal Cloudflare API response shapes. These match the documented
 * structure returned by the Cloudflare REST API v4 (api.cloudflare.com).
 * Only the fields this adapter consumes are typed.
 *
 * @module
 */

/** Standard envelope every Cloudflare v4 endpoint returns. */
export interface CfApiResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: Array<{ code: number; message: string }>;
  result: T | null;
  result_info?: {
    page?: number;
    per_page?: number;
    total_count?: number;
    count?: number;
  };
}

export interface CfPagesProject {
  id: string;
  name: string;
  subdomain: string;
  domains: string[];
  created_on: string;
  production_branch?: string;
  latest_deployment?: CfPagesDeployment | null;
  deployment_configs: {
    preview: CfPagesDeploymentConfig;
    production: CfPagesDeploymentConfig;
  };
}

export interface CfPagesDeploymentConfig {
  env_vars?: Record<string, CfPagesEnvVar | null> | null;
  compatibility_date?: string;
  compatibility_flags?: string[];
}

export type CfPagesEnvVar =
  | { type: 'plain_text'; value: string }
  | { type: 'secret_text'; value: string };

export interface CfPagesDeployment {
  id: string;
  short_id: string;
  project_id: string;
  project_name: string;
  environment: 'preview' | 'production';
  url: string;
  created_on: string;
  modified_on: string;
  latest_stage?: { name: string; status: 'idle' | 'active' | 'success' | 'failure' | 'canceled' } | null;
  deployment_trigger?: {
    type: string;
    metadata?: Record<string, unknown>;
  };
}

export interface CfPagesDomain {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'canceled' | 'error' | 'verifying';
  verification_data?: {
    status: 'pending' | 'active' | 'failed';
  };
  validation_data?: {
    status: 'pending' | 'active';
    method?: 'http' | 'txt';
  };
  certificate_authority?: string;
}

export interface CfPagesDeploymentLog {
  ts: string;
  line: string;
}

export interface CfPagesUploadToken {
  jwt: string;
}

export interface CfPagesUpsertResponse {
  successful_key_count: number;
  unsuccessful_keys: string[];
}
