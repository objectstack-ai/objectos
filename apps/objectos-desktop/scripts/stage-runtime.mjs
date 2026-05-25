#!/usr/bin/env node
/**
 * Stage the Node runtime + @objectos/app tree under
 * `apps/objectos-desktop/runtime/`, so Tauri's resource bundler can ship it.
 *
 * Reuses the same bits scripts/build-desktop.sh produces, but in-tree
 * (no zipping). Idempotent; re-run after changing @objectos/app.
 *
 *   runtime/
 *     node | node.exe
 *     app/
 *       desktop.mjs
 *       package.json
 *       dist/objectstack.json
 *       node_modules/
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, rmSync, chmodSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform, arch } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const REPO = resolve(PKG, '../..');
const APP = resolve(REPO, 'apps/objectos');
const RUNTIME = resolve(PKG, 'src-tauri/runtime');
const NODE_VERSION = process.env.NODE_VERSION ?? '20.18.1';

const osName = ({ darwin: 'darwin', linux: 'linux', win32: 'win' })[platform()];
const archName = ({ x64: 'x64', arm64: 'arm64' })[arch()];
if (!osName || !archName) {
  console.error(`unsupported platform: ${platform()}/${arch()}`);
  process.exit(1);
}

const sh = (cmd, opts = {}) => {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
};

/**
 * Strip files that are useless at runtime. Conservative — only deletes
 * patterns that are universally safe in npm packages:
 *   * .map (source maps)
 *   * .md / .markdown (docs)
 *   * directories named __tests__, .github, .nyc_output, coverage
 *   * cross-platform native prebuilds (we ship one platform per installer)
 *
 * NOTE: we deliberately do *not* touch directories called `doc`,
 * `docs`, `example`, `examples`, `test`, or `tests` — some packages
 * (e.g. `yaml`) ship real runtime code under those names.
 */
function slim(root) {
  if (!existsSync(root)) return;
  const dropFileExt = /\.(map|md|markdown)$/i;
  const dropDirName = /^(__tests__|\.github|\.nyc_output|coverage)$/i;
  const platformTag = `${platform() === 'win32' ? 'win32' : platform()}-${arch()}`;

  let removed = 0;
  let bytes = 0;
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (dropDirName.test(e.name)) {
          const sz = sizeOf(p);
          rmSync(p, { recursive: true, force: true });
          removed++; bytes += sz;
          continue;
        }
        // Drop other-platform prebuilds (e.g. @libsql/linux-x64 on darwin)
        if (dir.endsWith('prebuilds') && !e.name.startsWith(platformTag)) {
          const sz = sizeOf(p);
          rmSync(p, { recursive: true, force: true });
          removed++; bytes += sz;
          continue;
        }
        walk(p);
      } else if (e.isFile()) {
        if (dropFileExt.test(e.name)) {
          try {
            const sz = statSync(p).size;
            unlinkSync(p);
            removed++; bytes += sz;
          } catch {}
        }
      }
    }
  };

  function sizeOf(p) {
    try {
      let s = 0;
      for (const e of readdirSync(p, { withFileTypes: true })) {
        const c = join(p, e.name);
        if (e.isDirectory()) s += sizeOf(c);
        else { try { s += statSync(c).size; } catch {} }
      }
      return s;
    } catch { return 0; }
  }

  walk(root);
  console.log(`✓ slimmed ${removed} entries (~${(bytes / 1024 / 1024).toFixed(1)} MB)`);
}

if (!existsSync(join(APP, 'dist/objectstack.json'))) {
  sh('pnpm --filter @objectos/app build', { cwd: REPO });
}

rmSync(RUNTIME, { recursive: true, force: true });
mkdirSync(join(RUNTIME, 'app/dist'), { recursive: true });
copyFileSync(join(APP, 'package.json'), join(RUNTIME, 'app/package.json'));
copyFileSync(join(APP, 'desktop.mjs'), join(RUNTIME, 'app/desktop.mjs'));
copyFileSync(join(APP, 'dist/objectstack.json'), join(RUNTIME, 'app/dist/objectstack.json'));

sh(
  'npm install --omit=dev --no-audit --no-fund --loglevel=error --legacy-peer-deps better-sqlite3@^12.9.0',
  { cwd: join(RUNTIME, 'app') }
);

// 3b. slim node_modules: drop source maps, docs, tests, .d.ts — these
// are useless at runtime and bloat the installer by ~30%.
slim(join(RUNTIME, 'app', 'node_modules'));

const cache = resolve(REPO, '.cache/node');
mkdirSync(cache, { recursive: true });
const ext = osName === 'win' ? 'zip' : osName === 'linux' ? 'tar.xz' : 'tar.gz';
const pkgName = `node-v${NODE_VERSION}-${osName === 'win' ? 'win' : osName}-${archName}.${ext}`;
const tarball = join(cache, pkgName);
if (!existsSync(tarball)) {
  sh(`curl -fSL --retry 3 -o "${tarball}" https://nodejs.org/dist/v${NODE_VERSION}/${pkgName}`);
}
const extractDir = join(cache, pkgName.replace(/\.(tar\.(gz|xz)|zip)$/, ''));
if (!existsSync(extractDir)) {
  if (ext === 'tar.gz') sh(`tar -xzf "${tarball}" -C "${cache}"`);
  else if (ext === 'tar.xz') sh(`tar -xJf "${tarball}" -C "${cache}"`);
  else sh(`cd "${cache}" && unzip -q "${tarball}"`);
}
if (osName === 'win') {
  copyFileSync(join(extractDir, 'node.exe'), join(RUNTIME, 'node.exe'));
} else {
  const dst = join(RUNTIME, 'node');
  copyFileSync(join(extractDir, 'bin/node'), dst);
  chmodSync(dst, 0o755);
}

console.log(`✓ staged runtime → ${RUNTIME}`);
