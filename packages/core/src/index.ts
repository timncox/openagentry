/**
 * @openagentry/core — public SDK entry point.
 *
 * Imported by every official scaffold and adapter. Zero vendor coupling.
 *
 * @module
 */

// Common types
export type {
  Env,
  ConfirmToken,
  IsoTimestamp,
  Region,
  AdapterId,
  Project,
  Deployment,
  LogLine,
} from './types.js';

// Adapters
export type {
  HostAdapter,
  HostProject,
  HostStateBundle,
  CreateProjectOpts,
  DeployOpts,
  LogOpts,
  DomainAttachment,
} from './adapters/host.js';

export type {
  DatabaseAdapter,
  DatabaseInstance,
  DatabaseStateBundle,
  CreateDatabaseOpts,
} from './adapters/db.js';

export type { AuthAdapter, AuthProvider, AuthSession } from './adapters/auth.js';
export type { EmailAdapter, EmailMessage, EmailSendResult } from './adapters/email.js';
export type {
  StorageAdapter,
  StorageObject,
  PutOpts,
} from './adapters/storage.js';
export type {
  LlmAdapter,
  LlmGenerateOpts,
  LlmGenerateResult,
  LlmStreamChunk,
  LlmModel,
} from './adapters/llm.js';
export type {
  DomainAdapter,
  Domain,
  DomainAvailability,
  DnsRecord,
  DomainTransfer,
} from './adapters/domain.js';
export type {
  RepoAdapter,
  Repository,
  RepoCreateOpts,
} from './adapters/repo.js';
export type {
  WikiAdapter,
  WikiPage,
  WikiHit,
  WikiScope,
  WikiWriteResult,
} from './adapters/wiki.js';

// Plugin protocol
export {
  pluginManifestSchema,
  validateManifest,
  pluginTypes,
  adapterCategories,
} from './plugin/manifest.js';
export type { PluginManifest, PluginType, AdapterCategory } from './plugin/manifest.js';

export {
  PROTOCOL_VERSION,
  CORE_SUPPORTS,
  isProtocolCompatible,
  parseProtocolRange,
} from './plugin/protocol.js';
export type { ProtocolVersion } from './plugin/protocol-types.js';

// Runtime helpers
export {
  AgentryError,
  isAgentryError,
} from './runtime/errors.js';
export type {
  AgentryErrorPhase,
  AgentryErrorInit,
  AgentryErrorJson,
} from './runtime/errors.js';

export {
  registerAdapter,
  unregisterAdapter,
  useAdapter,
} from './runtime/resolver.js';

export type { AdapterContext } from './runtime/context.js';
