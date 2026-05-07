import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { deleteOp } from '../src/delete.js';
import type { GithubRepoConfig } from '../src/config.js';
import type { ConfirmToken, Repository } from '@openagentry/core';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.github.com';

const cfg: GithubRepoConfig = {
  token: 'ghp_test_token',
  endpoint: API_BASE,
};

/** Cast a plain string to ConfirmToken for happy-path test purposes. */
function ct(s: string): ConfirmToken {
  return s as unknown as ConfirmToken;
}

const REPO_REF: Repository = {
  owner: 'octocat',
  name: 'hello-world',
  url: 'https://github.com/octocat/hello-world',
  defaultBranch: 'main',
  visibility: 'public',
};

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Happy path — successful deletion (GitHub returns 204)
// ---------------------------------------------------------------------------

describe('deleteOp — happy path', () => {
  it('resolves with undefined when GitHub returns 204', async () => {
    server.use(
      http.delete(`${API_BASE}/repos/octocat/hello-world`, () =>
        new HttpResponse(null, { status: 204 }),
      ),
    );
    const result = await deleteOp(cfg, REPO_REF, ct('confirm-delete'));
    expect(result).toBeUndefined();
  });

  it('sends DELETE to the correct URL', async () => {
    let capturedMethod: string | undefined;
    let capturedUrl: string | undefined;
    server.use(
      http.delete(`${API_BASE}/repos/octocat/hello-world`, ({ request }) => {
        capturedMethod = request.method;
        capturedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await deleteOp(cfg, REPO_REF, ct('any-non-empty-token'));
    expect(capturedMethod).toBe('DELETE');
    expect(capturedUrl).toBe(`${API_BASE}/repos/octocat/hello-world`);
  });

  it('accepts any non-empty ConfirmToken string', async () => {
    server.use(
      http.delete(`${API_BASE}/repos/octocat/hello-world`, () =>
        new HttpResponse(null, { status: 204 }),
      ),
    );
    await expect(deleteOp(cfg, REPO_REF, ct('yes'))).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ConfirmToken validation — missing/empty → E_GITHUB_INVALID
//
// The runtime guard casts `confirm as unknown as string` before checking,
// so we can pass any value here to exercise the guard path.
// ---------------------------------------------------------------------------

describe('deleteOp — ConfirmToken validation', () => {
  it('throws E_GITHUB_INVALID when confirm is undefined', async () => {
    await expect(
      deleteOp(cfg, REPO_REF, undefined as unknown as ConfirmToken),
    ).rejects.toMatchObject({ code: 'E_GITHUB_INVALID', phase: 'delete' });
  });

  it('throws E_GITHUB_INVALID when confirm is null', async () => {
    await expect(
      deleteOp(cfg, REPO_REF, null as unknown as ConfirmToken),
    ).rejects.toMatchObject({ code: 'E_GITHUB_INVALID', phase: 'delete' });
  });

  it('throws E_GITHUB_INVALID when confirm is an empty string', async () => {
    await expect(
      deleteOp(cfg, REPO_REF, '' as unknown as ConfirmToken),
    ).rejects.toMatchObject({ code: 'E_GITHUB_INVALID', phase: 'delete' });
  });

  it('throws E_GITHUB_INVALID when confirm is a number', async () => {
    await expect(
      deleteOp(cfg, REPO_REF, 42 as unknown as ConfirmToken),
    ).rejects.toMatchObject({ code: 'E_GITHUB_INVALID', phase: 'delete' });
  });

  it('throws E_GITHUB_INVALID when confirm is a boolean', async () => {
    await expect(
      deleteOp(cfg, REPO_REF, true as unknown as ConfirmToken),
    ).rejects.toMatchObject({ code: 'E_GITHUB_INVALID', phase: 'delete' });
  });

  it('does NOT make a network call when ConfirmToken is invalid', async () => {
    // No handler registered — MSW would throw on unhandled request if fetch fires.
    // The test passes if only E_GITHUB_INVALID is thrown (not an MSW error).
    await expect(
      deleteOp(cfg, REPO_REF, '' as unknown as ConfirmToken),
    ).rejects.toMatchObject({ code: 'E_GITHUB_INVALID' });
  });
});

// ---------------------------------------------------------------------------
// 404 → E_GITHUB_NOT_FOUND
// ---------------------------------------------------------------------------

describe('deleteOp — 404 → E_GITHUB_NOT_FOUND', () => {
  it('throws E_GITHUB_NOT_FOUND when GitHub returns 404', async () => {
    const missingRepo: Repository = {
      owner: 'no-such-owner',
      name: 'no-such-repo',
      url: 'https://github.com/no-such-owner/no-such-repo',
      defaultBranch: 'main',
      visibility: 'public',
    };
    server.use(
      http.delete(`${API_BASE}/repos/no-such-owner/no-such-repo`, () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
      ),
    );
    await expect(deleteOp(cfg, missingRepo, ct('confirm-delete'))).rejects.toMatchObject({
      code: 'E_GITHUB_NOT_FOUND',
      phase: 'delete',
    });
  });
});

// ---------------------------------------------------------------------------
// Auth + permission + network + upstream errors propagate
// ---------------------------------------------------------------------------

describe('deleteOp — auth errors propagate', () => {
  it('throws E_GITHUB_AUTH for 401', async () => {
    server.use(
      http.delete(`${API_BASE}/repos/octocat/hello-world`, () =>
        HttpResponse.json({ message: 'Bad credentials' }, { status: 401 }),
      ),
    );
    await expect(deleteOp(cfg, REPO_REF, ct('confirm-delete'))).rejects.toMatchObject({
      code: 'E_GITHUB_AUTH',
      phase: 'delete',
    });
  });
});

describe('deleteOp — permission errors propagate', () => {
  it('throws E_GITHUB_PERMISSION for plain 403', async () => {
    server.use(
      http.delete(`${API_BASE}/repos/octocat/hello-world`, () =>
        HttpResponse.json({ message: 'Must have admin rights.' }, { status: 403 }),
      ),
    );
    await expect(deleteOp(cfg, REPO_REF, ct('confirm-delete'))).rejects.toMatchObject({
      code: 'E_GITHUB_PERMISSION',
      phase: 'delete',
    });
  });
});

describe('deleteOp — network errors propagate', () => {
  it('throws E_GITHUB_NETWORK on fetch-level failure', async () => {
    server.use(
      http.delete(`${API_BASE}/repos/octocat/hello-world`, () => HttpResponse.error()),
    );
    await expect(deleteOp(cfg, REPO_REF, ct('confirm-delete'))).rejects.toMatchObject({
      code: 'E_GITHUB_NETWORK',
      phase: 'delete',
    });
  });
});

describe('deleteOp — upstream errors propagate', () => {
  it('throws E_GITHUB_UPSTREAM for 500', async () => {
    server.use(
      http.delete(`${API_BASE}/repos/octocat/hello-world`, () =>
        HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 }),
      ),
    );
    await expect(deleteOp(cfg, REPO_REF, ct('confirm-delete'))).rejects.toMatchObject({
      code: 'E_GITHUB_UPSTREAM',
      phase: 'delete',
    });
  });
});
