import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import runtimePaths from './runtime_paths.cjs';

const require = createRequire(import.meta.url);
// Electron's virtual filesystem treats .asar files as directories. Copy the archive bytes.
const { access, cp, mkdir, mkdtemp, readFile, readdir, rename, rm } =
  require(process.versions.electron ? 'original-fs' : 'node:fs').promises;

async function exists(file) {
  try { await access(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

// A packaged Electron prefers its app.asar over a script argument. Give the helper
// an independent runtime containing the stock default_app.asar and OS resources.
export async function ensureRuntime() {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('截屏分析需要 Windows x64 桌面应用');
  if (process.env.DSH_SHOT_ELECTRON_PATH) {
    await access(process.env.DSH_SHOT_ELECTRON_PATH);
    return process.env.DSH_SHOT_ELECTRON_PATH;
  }
  const exe = process.execPath;
  const source = dirname(exe);
  const stock = join(source, 'resources', 'default_app.asar');
  if (!await exists(stock)) throw new Error('请在 Windows 桌面应用内启用截屏分析');
  if (!await exists(join(source, 'resources', 'app.asar'))) return exe;
  const root = join(runtimePaths().dataDir, 'engines');
  const digest = createHash('sha256').update(await readFile(exe)).digest('hex');
  const engine = join(root, digest);
  const target = join(engine, 'electron.exe');
  if (await exists(target)) return target;
  await mkdir(root, { recursive: true });
  const stage = await mkdtemp(join(root, 'prepare-'));
  try {
    await cp(exe, join(stage, 'electron.exe'));
    for (const file of await readdir(source, { withFileTypes: true })) {
      if (file.isFile() && (/\.(dll|pak|bin|dat)$/i.test(file.name) ||
        ['LICENSE.electron.txt', 'LICENSES.chromium.html', 'vk_swiftshader_icd.json'].includes(file.name))) {
        await cp(join(source, file.name), join(stage, file.name));
      }
    }
    await cp(join(source, 'locales'), join(stage, 'locales'), { recursive: true });
    await mkdir(join(stage, 'resources'));
    await cp(stock, join(stage, 'resources', 'default_app.asar'));
    try { await rename(stage, engine); }
    catch (error) { if (!await exists(target)) throw error; }
    return target;
  } finally { await rm(stage, { recursive: true, force: true }); }
}
