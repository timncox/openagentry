import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadTarget } from '../src/loader.js';
import { AgentryError } from '@openagentry/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const goodHost = join(__dirname, 'fixtures', 'good-host');

describe('loadTarget', () => {
  it('reads the manifest and dynamic-imports the entry', async () => {
    const lt = await loadTarget(goodHost);
    expect(lt.packageDir).toBe(goodHost);
    expect(lt.manifest.id).toBe('good-host');
    expect(lt.manifest.category).toBe('host');
    expect(lt.module).toBeDefined();
  });

  it('the loaded module has a default export with category + id', async () => {
    const lt = await loadTarget(goodHost);
    const mod = lt.module as { default: { category: string; id: string } };
    expect(mod.default.category).toBe('host');
    expect(mod.default.id).toBe('good-host');
  });

  it('throws AgentryError with E_TARGET_NOT_FOUND when target dir does not exist', async () => {
    await expect(loadTarget('/nonexistent/path/xyz')).rejects.toMatchObject({
      name: 'AgentryError',
      code: 'E_TARGET_NOT_FOUND',
    });
  });

  it('throws AgentryError with E_TARGET_NOT_DIR when target is a file, not a directory', async () => {
    const filePath = join(__dirname, '..', 'package.json');
    await expect(loadTarget(filePath)).rejects.toMatchObject({
      name: 'AgentryError',
      code: 'E_TARGET_NOT_DIR',
    });
  });

  it('throws AgentryError with E_TARGET_NO_MANIFEST when package.json has no openagentry block', async () => {
    // The cli package has no openagentry block — reuse it as a negative case.
    const cliPkg = join(__dirname, '..', '..', 'cli');
    await expect(loadTarget(cliPkg)).rejects.toMatchObject({
      name: 'AgentryError',
      code: 'E_TARGET_NO_MANIFEST',
    });
  });
});
