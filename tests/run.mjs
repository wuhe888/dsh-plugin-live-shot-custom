import { mkdtemp, cp, rm, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';

const source = import.meta.dirname;
const harness = await realpath(process.argv[2] || '.');
const vitest = await realpath(join(harness, 'node_modules/vitest/vitest.mjs'));
const suite = await mkdtemp(join(harness, 'apps/desktop/tests/live-shot-'));
try {
  await cp(source, suite, { recursive: true });
  execFileSync(process.execPath, [vitest, 'run', relative(harness, suite)], {
    cwd: harness, stdio: 'inherit', env: { ...process.env, SCREENSHOT_PLUGIN_ROOT: dirname(source) },
  });
} finally { await rm(suite, { recursive: true, force: true }); }
