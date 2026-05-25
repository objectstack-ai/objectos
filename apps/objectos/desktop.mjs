#!/usr/bin/env node
/**
 * ObjectOS Desktop launcher.
 *
 * Boots `objectstack serve` with sensible defaults for a local,
 * single-user "double-click to run" experience:
 *
 *   - Uses an OS-appropriate per-user data directory for the SQLite
 *     business DB and the artifact cache.
 *   - Defaults to the bundled `dist/objectstack.json` artifact (offline
 *     mode) when no cloud URL is configured.
 *   - Picks a free port if the requested one is busy.
 *   - Opens the default browser once the server is ready.
 *
 * Designed to be the entry point for a portable distributable
 * (`scripts/build-desktop.sh`).
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_NAME = 'ObjectOS';

function userDataDir() {
  if (process.env.OBJECTOS_HOME) return process.env.OBJECTOS_HOME;
  const home = homedir();
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', APP_NAME);
    case 'win32':
      return join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), APP_NAME);
    default:
      return join(process.env.XDG_DATA_HOME ?? join(home, '.local', 'share'), 'objectos');
  }
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
  return p;
}

async function findFreePort(preferred) {
  const tryPort = (port) =>
    new Promise((resolveTry) => {
      const srv = createServer();
      srv.once('error', () => resolveTry(false));
      srv.once('listening', () => srv.close(() => resolveTry(true)));
      srv.listen(port, '127.0.0.1');
    });
  if (await tryPort(preferred)) return preferred;
  for (let p = preferred + 1; p < preferred + 50; p++) {
    if (await tryPort(p)) return p;
  }
  return 0;
}

function openBrowser(url) {
  const cmd =
    platform() === 'darwin' ? 'open'
    : platform() === 'win32' ? 'cmd'
    : 'xdg-open';
  const args = platform() === 'win32' ? ['/c', 'start', '""', url] : [url];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  } catch (err) {
    console.warn(`[desktop] could not open browser: ${err.message}`);
  }
}

async function main() {
  const dataDir = ensureDir(userDataDir());
  const cacheDir = ensureDir(join(dataDir, 'cache'));
  const dbPath = join(ensureDir(join(dataDir, 'data')), 'data.db');

  const bundledArtifact = resolve(__dirname, 'dist', 'objectstack.json');

  // Defaults — env wins so users can still override.
  process.env.OS_CACHE_DIR ??= cacheDir;
  process.env.OS_BUSINESS_DB_URL ??= `file:${dbPath}`;
  if (!process.env.OS_CLOUD_URL && !process.env.OS_ARTIFACT_FILE && existsSync(bundledArtifact)) {
    process.env.OS_ARTIFACT_FILE = bundledArtifact;
  }
  process.env.OS_PROJECT_ID ??= 'proj_local';

  const preferredPort = Number(process.env.PORT ?? 3000);
  const port = await findFreePort(preferredPort);
  if (!port) {
    console.error('[desktop] no free port available');
    process.exit(1);
  }
  if (port !== preferredPort) {
    console.log(`[desktop] port ${preferredPort} busy → using ${port}`);
  }
  process.env.PORT = String(port);

  const url = `http://localhost:${port}`;

  console.log(`[desktop] data dir : ${dataDir}`);
  console.log(`[desktop] artifact : ${process.env.OS_ARTIFACT_FILE ?? '(cloud)'}`);
  console.log(`[desktop] starting ObjectOS on ${url}`);

  // Resolve the objectstack CLI bin from this app's node_modules so the
  // portable bundle works regardless of cwd.
  const require = createRequire(import.meta.url);
  const cliPkgJson = require.resolve('@objectstack/cli/package.json');
  const cliRoot = dirname(cliPkgJson);
  const cliBin = join(cliRoot, 'bin', 'run.js');

  const child = spawn(process.execPath, [cliBin, 'serve', '--port', String(port)], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env,
  });

  let opened = false;
  const openOnce = () => {
    if (opened) return;
    opened = true;
    if (process.env.OBJECTOS_NO_OPEN === '1') return;
    setTimeout(() => openBrowser(url), 800);
  };

  // Best-effort: open after a short delay; the serve command prints
  // its own ready banner so we don't need to parse stdout.
  openOnce();

  const shutdown = (sig) => {
    if (!child.killed) child.kill(sig);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error('[desktop] fatal:', err);
  process.exit(1);
});
