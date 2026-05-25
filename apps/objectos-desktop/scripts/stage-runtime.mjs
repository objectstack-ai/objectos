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
import { existsSync, mkdirSync, copyFileSync, rmSync, chmodSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform, arch } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const REPO = resolve(PKG, '../..');
const APP = resolve(REPO, 'apps/objectos');
const RUNTIME = resolve(PKG, 'runtime');
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
