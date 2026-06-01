#!/usr/bin/env node
/**
 * ObjectOS One launcher.
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
 * (`scripts/build-one.sh`).
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_NAME = 'ObjectOS';

// Default port to start from when PORT isn't pinned. Deliberately off 3000 —
// that range collides with Next.js/Vite/CRA and most local dev servers, so a
// quieter default means a stable, predictable URL across launches.
const DEFAULT_PORT = 8787;

function userDataDir() {
  if (process.env.OBJECTOS_HOME) return process.env.OBJECTOS_HOME;
  return join(homedir(), '.objectstack');
}

function legacyDataDir() {
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

function isPortFree(port) {
  return new Promise((resolveTry) => {
    const srv = createServer();
    srv.once('error', () => resolveTry(false));
    srv.once('listening', () => srv.close(() => resolveTry(true)));
    srv.listen(port, '127.0.0.1');
  });
}

async function findFreePort(preferred) {
  if (await isPortFree(preferred)) return preferred;
  for (let p = preferred + 1; p < preferred + 50; p++) {
    if (await isPortFree(p)) return p;
  }
  return 0;
}

/**
 * Resolve the port to serve on.
 *
 * Two modes:
 *   - Managed (OBJECTOS_MANAGED=1): the ObjectOS One shell already picked a
 *     free port, set PORT, and is probing/navigating to *that exact* port.
 *     We must honor it verbatim — re-selecting our own would strand the UI on
 *     a port nobody serves. If it was taken in the race window since the shell
 *     checked it, exit so the shell's supervisor respawns us with a fresh one.
 *   - Standalone (plain `node one.mjs`): pick a free port ourselves, falling
 *     forward from the preferred/default if it's busy.
 */
async function resolvePort() {
  const preferred = Number(process.env.PORT ?? DEFAULT_PORT);
  if (process.env.OBJECTOS_MANAGED === '1') {
    if (await isPortFree(preferred)) return preferred;
    console.error(
      `[one] managed port ${preferred} no longer free; exiting for supervisor restart`,
    );
    process.exit(75); // EX_TEMPFAIL — supervised restart will pick a new port
  }
  const port = await findFreePort(preferred);
  if (!port) {
    console.error('[one] no free port available');
    process.exit(1);
  }
  if (port !== preferred) {
    console.log(`[one] port ${preferred} busy → using ${port}`);
  }
  return port;
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
    console.warn(`[one] could not open browser: ${err.message}`);
  }
}

async function main() {
  const dataDir = ensureDir(userDataDir());

  const legacy = legacyDataDir();
  if (!process.env.OBJECTOS_HOME && legacy !== dataDir && existsSync(legacy) && !existsSync(join(dataDir, 'data'))) {
    console.warn(`[one] found legacy data at ${legacy}`);
    console.warn(`[one] not migrated automatically — set OBJECTOS_HOME='${legacy}' to keep using it,`);
    console.warn(`[one] or move it with: mv "${legacy}"/* "${dataDir}"/`);
  }

  const cacheDir = ensureDir(join(dataDir, 'cache'));
  const storageDir = ensureDir(join(dataDir, 'uploads'));
  const dbPath = join(ensureDir(join(dataDir, 'data')), 'standalone.db');

  const bundledArtifact = resolve(__dirname, 'dist', 'objectstack.json');

  // Defaults — env wins so users can still override.
  process.env.OS_CACHE_DIR ??= cacheDir;
  process.env.OS_DATABASE_URL ??= `file:${dbPath}`;
  process.env.OS_BUSINESS_DB_URL ??= `file:${dbPath}`;
  process.env.OS_STORAGE_ROOT ??= storageDir;
  if (!process.env.OS_CLOUD_URL && !process.env.OS_ARTIFACT_FILE && existsSync(bundledArtifact)) {
    process.env.OS_ARTIFACT_FILE = bundledArtifact;
  }
  process.env.OS_PROJECT_ID ??= 'proj_local';

  // Persist a per-install AUTH_SECRET so AuthPlugin is enabled (required
  // for /_account/register and /_account/login). 64 bytes hex = 512 bit.
  if (!process.env.AUTH_SECRET) {
    const secretFile = join(dataDir, 'auth.secret');
    if (existsSync(secretFile)) {
      process.env.AUTH_SECRET = readFileSync(secretFile, 'utf8').trim();
    } else {
      const secret = randomBytes(64).toString('hex');
      writeFileSync(secretFile, secret, { mode: 0o600 });
      process.env.AUTH_SECRET = secret;
      console.log(`[one] generated AUTH_SECRET → ${secretFile}`);
    }
  }

  const port = await resolvePort();
  process.env.PORT = String(port);

  const url = `http://localhost:${port}`;

  console.log(`[one] data dir : ${dataDir}`);
  console.log(`[one] artifact : ${process.env.OS_ARTIFACT_FILE ?? '(cloud)'}`);
  console.log(`[one] starting ObjectOS on ${url}`);

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
  console.error('[one] fatal:', err);
  process.exit(1);
});
