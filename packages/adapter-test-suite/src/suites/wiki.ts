/**
 * Wiki functional conformance suite. Self-registers with the runner.
 *
 * Six checks: list-returns-array, write-then-read, append-extends,
 * search-finds-content, scope-isolation, structured-errors.
 *
 * Verifies a WikiAdapter against a real (or temp-dir-backed) vault.
 *
 * @module
 */

import type { WikiAdapter } from '@openagentry/core';
import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';
import { registerFunctionalSuite } from '../runner.js';
import { isAgentryError } from '../internal/is-agentry-error.js';
import { fail, getAdapterDefault, pass, timed } from '../internal/suite-helpers.js';

/**
 * Phases a wiki adapter is allowed to use.
 * `'init'`   — adapter-construction failures (missing env vars).
 * `'list'`   — list pages.
 * `'read'`   — read a page.
 * `'write'`  — write a page.
 * `'append'` — append to a page.
 * `'search'` — search pages.
 */
export const WIKI_PHASES = new Set(['init', 'list', 'read', 'write', 'append', 'search']);

export const CONFORMANCE_TOKEN = 'agentryconformancetoken';
export const ROUNDTRIP_PATH = 'workspace/conformance-roundtrip.md';
export const APPEND_PATH = 'workspace/conformance-append.md';
export const SEARCH_PATH = 'workspace/conformance-search.md';
export const ISOLATION_PATH = 'workspace/conformance-isolation.md';
/** Used by the structured-errors check: read() on a nonexistent path must throw AgentryError. */
export const MISSING_PATH = 'workspace/conformance-does-not-exist.md';

export const wikiSuite = async (
  target: LoadedTarget,
  ctx: SuiteCtx,
): Promise<CheckResult[]> => {
  const checks: CheckResult[] = [];
  const adapter = getAdapterDefault<WikiAdapter>(target, 'wiki');
  if (adapter === undefined) {
    return [
      fail(
        'wiki/list-returns-array',
        'Adapter default export missing or has wrong category (expected "wiki").',
        0,
      ),
    ];
  }

  // wiki/list-returns-array — list() returns an array, even if empty.
  const listWrap = await timed(ctx, () => adapter.list());
  if (!listWrap.ok) {
    checks.push(
      fail(
        'wiki/list-returns-array',
        `list threw: ${(listWrap.err as Error)?.message ?? 'unknown'}`,
        listWrap.durationMs,
      ),
    );
  } else if (!Array.isArray(listWrap.result)) {
    checks.push(
      fail(
        'wiki/list-returns-array',
        `list must return an array; got ${typeof listWrap.result}.`,
        listWrap.durationMs,
      ),
    );
  } else {
    checks.push(
      pass('wiki/list-returns-array', listWrap.durationMs, {
        pageCount: listWrap.result.length,
      }),
    );
  }

  // wiki/write-then-read — write content, read it back, content matches.
  const ROUNDTRIP_BODY = `# Roundtrip\n\nbody-${CONFORMANCE_TOKEN}\n`;
  const writeWrap = await timed(ctx, () =>
    adapter.write(ROUNDTRIP_PATH, ROUNDTRIP_BODY),
  );
  if (!writeWrap.ok) {
    checks.push(
      fail(
        'wiki/write-then-read',
        `write threw: ${(writeWrap.err as Error)?.message ?? 'unknown'}`,
        writeWrap.durationMs,
      ),
    );
  } else {
    const readWrap = await timed(ctx, () => adapter.read(ROUNDTRIP_PATH));
    if (!readWrap.ok) {
      checks.push(
        fail(
          'wiki/write-then-read',
          `read threw: ${(readWrap.err as Error)?.message ?? 'unknown'}`,
          readWrap.durationMs,
        ),
      );
    } else if (readWrap.result === undefined) {
      checks.push(
        fail(
          'wiki/write-then-read',
          `read returned undefined; expected a string.`,
          readWrap.durationMs,
        ),
      );
    } else if (!readWrap.result.includes(`body-${CONFORMANCE_TOKEN}`)) {
      checks.push(
        fail(
          'wiki/write-then-read',
          `read returned content missing the written body. Got: "${readWrap.result.slice(0, 200)}".`,
          readWrap.durationMs,
        ),
      );
    } else {
      checks.push(pass('wiki/write-then-read', readWrap.durationMs));
    }
  }

  // wiki/append-extends — write base, append more, read shows both.
  const appendWriteWrap = await timed(ctx, () =>
    adapter.write(APPEND_PATH, 'one\n'),
  );
  if (!appendWriteWrap.ok) {
    checks.push(
      fail(
        'wiki/append-extends',
        `initial write threw: ${(appendWriteWrap.err as Error)?.message ?? 'unknown'}`,
        appendWriteWrap.durationMs,
      ),
    );
  } else {
    const appendWrap = await timed(ctx, () =>
      adapter.append(APPEND_PATH, 'two\n'),
    );
    if (!appendWrap.ok) {
      checks.push(
        fail(
          'wiki/append-extends',
          `append threw: ${(appendWrap.err as Error)?.message ?? 'unknown'}`,
          appendWrap.durationMs,
        ),
      );
    } else {
      const aReadWrap = await timed(ctx, () => adapter.read(APPEND_PATH));
      if (!aReadWrap.ok) {
        checks.push(
          fail(
            'wiki/append-extends',
            `read after append threw: ${(aReadWrap.err as Error)?.message ?? 'unknown'}`,
            aReadWrap.durationMs,
          ),
        );
      } else if (aReadWrap.result === undefined) {
        checks.push(
          fail(
            'wiki/append-extends',
            `read after append returned undefined; expected a string.`,
            aReadWrap.durationMs,
          ),
        );
      } else if (
        !aReadWrap.result.includes('one') ||
        !aReadWrap.result.includes('two')
      ) {
        checks.push(
          fail(
            'wiki/append-extends',
            `read after append must contain both 'one' and 'two'. Got: "${aReadWrap.result.slice(0, 200)}".`,
            aReadWrap.durationMs,
          ),
        );
      } else {
        checks.push(pass('wiki/append-extends', aReadWrap.durationMs));
      }
    }
  }

  // wiki/search-finds-content — write file with unique token, search returns hit.
  const SEARCH_BODY = `# Searchable\n\nUnique marker: ${CONFORMANCE_TOKEN}-search\n`;
  const sWriteWrap = await timed(ctx, () => adapter.write(SEARCH_PATH, SEARCH_BODY));
  if (!sWriteWrap.ok) {
    checks.push(
      fail(
        'wiki/search-finds-content',
        `write before search threw: ${(sWriteWrap.err as Error)?.message ?? 'unknown'}`,
        sWriteWrap.durationMs,
      ),
    );
  } else {
    const searchWrap = await timed(ctx, () =>
      adapter.search(`${CONFORMANCE_TOKEN}-search`),
    );
    if (!searchWrap.ok || searchWrap.result === undefined) {
      checks.push(
        fail(
          'wiki/search-finds-content',
          `search threw: ${(searchWrap.err as Error)?.message ?? 'unknown'}`,
          searchWrap.durationMs,
        ),
      );
    } else if (!Array.isArray(searchWrap.result) || searchWrap.result.length === 0) {
      checks.push(
        fail(
          'wiki/search-finds-content',
          `search returned empty for token "${CONFORMANCE_TOKEN}-search". Result: ${JSON.stringify(searchWrap.result)}.`,
          searchWrap.durationMs,
        ),
      );
    } else {
      checks.push(
        pass('wiki/search-finds-content', searchWrap.durationMs, {
          hitCount: searchWrap.result.length,
        }),
      );
    }
  }

  // wiki/scope-isolation — workspace write should not appear in project list.
  const isoWriteWrap = await timed(ctx, () =>
    adapter.write(ISOLATION_PATH, '# Isolation test\n'),
  );
  if (!isoWriteWrap.ok) {
    checks.push(
      fail(
        'wiki/scope-isolation',
        `isolation write threw: ${(isoWriteWrap.err as Error)?.message ?? 'unknown'}`,
        isoWriteWrap.durationMs,
      ),
    );
  } else {
    const projectListWrap = await timed(ctx, () => adapter.list('project'));
    if (!projectListWrap.ok) {
      checks.push(
        fail(
          'wiki/scope-isolation',
          `list({scope:'project'}) threw: ${(projectListWrap.err as Error)?.message ?? 'unknown'}`,
          projectListWrap.durationMs,
        ),
      );
    } else if (!Array.isArray(projectListWrap.result)) {
      checks.push(
        fail(
          'wiki/scope-isolation',
          `list('project') must return an array; got ${typeof projectListWrap.result}.`,
          projectListWrap.durationMs,
        ),
      );
    } else if (projectListWrap.result.some((p) => p.path === ISOLATION_PATH)) {
      checks.push(
        fail(
          'wiki/scope-isolation',
          `workspace-scoped write leaked into project scope (found ${ISOLATION_PATH} in project list).`,
          projectListWrap.durationMs,
        ),
      );
    } else {
      checks.push(pass('wiki/scope-isolation', projectListWrap.durationMs));
    }
  }

  // wiki/structured-errors — read of nonexistent path must throw AgentryError
  // with an E_WIKI_-prefixed code and a phase in WIKI_PHASES.
  const errWrap = await timed(ctx, () => adapter.read(MISSING_PATH));
  if (errWrap.ok) {
    checks.push(
      fail(
        'wiki/structured-errors',
        `read('${MISSING_PATH}') succeeded; expected throw.`,
        errWrap.durationMs,
      ),
    );
  } else if (!isAgentryError(errWrap.err)) {
    checks.push(
      fail(
        'wiki/structured-errors',
        `read threw non-AgentryError (${(errWrap.err as Error)?.constructor?.name ?? typeof errWrap.err}). All adapter-side failures must be AgentryError.`,
        errWrap.durationMs,
      ),
    );
  } else if (typeof errWrap.err.code !== 'string' || !/^E_WIKI_/.test(errWrap.err.code)) {
    checks.push(
      fail(
        'wiki/structured-errors',
        `read threw AgentryError with non-conformant code "${String(errWrap.err.code)}". Wiki adapter codes must start with "E_WIKI_".`,
        errWrap.durationMs,
      ),
    );
  } else if (!WIKI_PHASES.has(errWrap.err.phase)) {
    checks.push(
      fail(
        'wiki/structured-errors',
        `read threw AgentryError with phase "${errWrap.err.phase}", not one of ${[...WIKI_PHASES].join('/')}. Wiki adapters classify failures using these phases.`,
        errWrap.durationMs,
      ),
    );
  } else {
    checks.push(
      pass('wiki/structured-errors', errWrap.durationMs, {
        code: errWrap.err.code,
      }),
    );
  }

  return checks;
};

registerFunctionalSuite('wiki', wikiSuite);
