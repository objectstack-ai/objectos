#!/usr/bin/env node
/**
 * Refuses to publish a docs Worker whose prerender cache is missing entries.
 *
 * ## The failure this exists to catch
 *
 * Every page on this site lives under `app/[lang]/`, so every page route is a
 * DYNAMIC route prerendered through `generateStaticParams()`. OpenNext runs
 * Next in minimal mode, where Next does not read prerendered HTML off a
 * filesystem — it asks the configured incremental cache. `apps/docs` uses
 * `staticAssetsIncrementalCache`, and `opennextjs-cloudflare deploy` copies
 * `.open-next/cache` into `.open-next/assets` just before uploading.
 *
 * If those entries are absent, the Worker deploys with the cache CONFIGURED and
 * EMPTY. Every lookup misses, `dynamicParams = false` refuses the on-demand
 * render, Next raises `NoFallbackError`, and the request is answered by the
 * prerendered `_not-found` route: the page 404s. Every page, every locale,
 * every request — and the deploy step still exits 0, because the upload
 * succeeded. That is exactly how 2026-09-04 went (#261), by a different route.
 *
 * A missing cache is not hypothetical. `.open-next/cache` is produced by a
 * separate build invocation from the one a pull request runs, travels to the
 * deploy job as a CI artifact, and is copied again by the deploy command. Three
 * places it can be lost, none of which make any step go red on their own.
 *
 * ## What it asserts, and against what
 *
 * The population it checks is Next's own `prerender-manifest.json` — every
 * route Next says it prerendered — not a number anyone wrote down. So a page
 * added to the corpus is covered the day it is added, and this cannot pass by
 * comparing a stale expectation to itself.
 *
 * Run it in the deploy job AFTER the artifact is downloaded and BEFORE the
 * deploy step. A check that reports a bad artifact once it is already serving
 * is a post-mortem, not a gate.
 *
 * ## Usage
 *
 *   node .github/scripts/check-prerender-cache.mjs                 # apps/docs
 *   node .github/scripts/check-prerender-cache.mjs --dir PATH      # elsewhere
 *   node .github/scripts/check-prerender-cache.mjs --self-test     # the rules
 *
 * Exit 0 only when every prerendered route has a cache entry.
 */

import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

/** Every rule this script enforces. The self-test asserts each one can fire. */
const RULES = [
  'no-open-next',
  'no-build-id',
  'no-prerender-manifest',
  'unreadable-prerender-manifest',
  'no-cache-dir',
  'no-routes',
  'missing-entries',
];

/** Where `.open-next` lives when nobody says otherwise. */
const DEFAULT_DIR = 'apps/docs/.open-next';

/**
 * The prerender manifest, as packaged inside the server function.
 *
 * Read from the bundle rather than from `apps/docs/.next/` on purpose: the
 * deploy job downloads an artifact and never runs a Next build, so `.next/` is
 * not there. Checking the copy that travels with the bundle is also the only
 * way to be sure the manifest and the cache describe the same build.
 */
const MANIFEST_IN_BUNDLE =
  'server-functions/default/apps/docs/.next/prerender-manifest.json';

/**
 * The cache file a route's entry is written to.
 *
 * `/` is stored as `index.cache`; every other route keeps its path. Mirrors
 * `staticAssetsIncrementalCache.getAssetUrl`, which builds
 * `CACHE_DIR/BUILD_ID/KEY.cache` from the same key.
 */
function entryPathFor(route, root) {
  const key = route === '/' ? '/index' : route;
  return join(root, `${key.slice(1)}.cache`);
}

/**
 * Judge one `.open-next` directory. Pure enough to drive from fixtures: it
 * touches only the filesystem under `dir`.
 */
export function evaluate(dir) {
  const findings = [];
  const add = (rule, detail) => findings.push({ rule, detail });
  const measured = { dir };

  if (!existsSync(dir)) {
    add('no-open-next', `${dir} does not exist`);
    return { findings, measured };
  }

  const buildIdPath = join(dir, 'assets/BUILD_ID');
  if (!existsSync(buildIdPath)) {
    add('no-build-id', `${buildIdPath} does not exist`);
    return { findings, measured };
  }
  const buildId = readFileSync(buildIdPath, 'utf8').trim();
  measured.buildId = buildId;

  const manifestPath = join(dir, MANIFEST_IN_BUNDLE);
  if (!existsSync(manifestPath)) {
    add('no-prerender-manifest', `${manifestPath} does not exist`);
    return { findings, measured };
  }

  let routes;
  try {
    routes = Object.keys(JSON.parse(readFileSync(manifestPath, 'utf8')).routes ?? {});
  } catch (error) {
    add('unreadable-prerender-manifest', `${manifestPath}: ${error?.message ?? error}`);
    return { findings, measured };
  }
  measured.routes = routes.length;

  if (routes.length === 0) {
    // A manifest with no prerendered routes would make every other rule below
    // vacuous: zero routes, zero missing, a green that proves nothing.
    add('no-routes', `${manifestPath} lists no prerendered routes`);
    return { findings, measured };
  }

  const cacheRoot = join(dir, 'cache', buildId);
  if (!existsSync(cacheRoot)) {
    add('no-cache-dir', `${cacheRoot} does not exist — the Worker would 404 every page`);
    measured.present = 0;
    measured.missing = routes.length;
    return { findings, measured };
  }

  const missing = routes.filter((route) => !existsSync(entryPathFor(route, cacheRoot)));
  measured.present = routes.length - missing.length;
  measured.missing = missing.length;

  if (missing.length > 0) {
    const shown = missing.slice(0, 10).join(', ');
    add(
      'missing-entries',
      `${missing.length} of ${routes.length} prerendered route(s) have no cache entry ` +
        `under ${cacheRoot} — they would 404 in production: ${shown}` +
        (missing.length > 10 ? `, and ${missing.length - 10} more` : ''),
    );
  }

  return { findings, measured };
}

/* ------------------------------------------------------------------ gate -- */

function gate(dir) {
  const { findings, measured } = evaluate(dir);

  console.log(`prerender cache: ${measured.dir}`);
  if (measured.buildId) console.log(`    build id : ${measured.buildId}`);
  if (measured.routes !== undefined) {
    console.log(
      `    routes   : ${measured.routes} prerendered, ` +
        `${measured.present ?? 0} servable, ${measured.missing ?? '?'} missing`,
    );
  }

  if (findings.length === 0) {
    console.log(
      `\n✓ every one of the ${measured.routes} prerendered route(s) has a cache entry, ` +
        'so the Worker about to be uploaded can serve them',
    );
    return 0;
  }

  for (const f of findings) console.error(`    [${f.rule}] ${f.detail}`);
  console.error(
    `\n✗ this bundle would publish a Worker that cannot serve its own pages — refusing to deploy`,
  );
  return 1;
}

/* ------------------------------------------------------------- self-test -- */

/**
 * Fixtures, one per rule. The runner asserts that the set of rules a fixture
 * trips is exactly the set declared here, AND that every rule in `RULES` has a
 * fixture able to trip it — so weakening a rule fails this, which is what keeps
 * a green from being decoration.
 */
const FIXTURES = [
  {
    name: 'a complete bundle passes',
    build: () => ({ routes: ['/', '/en/docs', '/zh-Hans/docs'], entries: ['/', '/en/docs', '/zh-Hans/docs'] }),
    expect: [],
  },
  {
    name: 'no .open-next at all',
    build: () => ({ absent: true }),
    expect: ['no-open-next'],
  },
  {
    name: 'no BUILD_ID',
    build: () => ({ routes: ['/en/docs'], entries: ['/en/docs'], noBuildId: true }),
    expect: ['no-build-id'],
  },
  {
    name: 'no prerender manifest in the bundle',
    build: () => ({ noManifest: true }),
    expect: ['no-prerender-manifest'],
  },
  {
    name: 'a manifest that is not JSON',
    build: () => ({ badManifest: true }),
    expect: ['unreadable-prerender-manifest'],
  },
  {
    name: 'a manifest with no prerendered routes',
    build: () => ({ routes: [], entries: [] }),
    expect: ['no-routes'],
  },
  {
    name: 'the cache directory is missing entirely',
    build: () => ({ routes: ['/en/docs'], entries: null }),
    expect: ['no-cache-dir'],
  },
  {
    name: 'one route lost its cache entry',
    build: () => ({ routes: ['/', '/en/docs', '/zh-Hans/docs'], entries: ['/', '/zh-Hans/docs'] }),
    expect: ['missing-entries'],
  },
];

function materialise(spec) {
  const dir = join(mkdtempSync(join(tmpdir(), 'os-prerender-cache-')), '.open-next');
  if (spec.absent) return dir;

  mkdirSync(join(dir, 'assets'), { recursive: true });
  const buildId = 'TESTBUILDID000000000';
  if (!spec.noBuildId) writeFileSync(join(dir, 'assets/BUILD_ID'), `${buildId}\n`);

  const manifestPath = join(dir, MANIFEST_IN_BUNDLE);
  mkdirSync(dirname(manifestPath), { recursive: true });
  if (spec.badManifest) {
    writeFileSync(manifestPath, 'not json {');
    return dir;
  }
  if (!spec.noManifest) {
    const routes = Object.fromEntries((spec.routes ?? []).map((r) => [r, {}]));
    writeFileSync(manifestPath, JSON.stringify({ routes }));
  } else {
    return dir;
  }

  if (spec.entries === null) return dir;
  const root = join(dir, 'cache', buildId);
  for (const route of spec.entries ?? []) {
    const p = entryPathFor(route, root);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, '{}');
  }
  return dir;
}

function selfTest() {
  let failed = 0;
  const fired = new Set();

  for (const fixture of FIXTURES) {
    const spec = fixture.build();
    const dir = materialise(spec);
    let rules;
    try {
      rules = [...new Set(evaluate(dir).findings.map((f) => f.rule))].sort();
    } finally {
      rmSync(resolve(dir, '..'), { recursive: true, force: true });
    }
    for (const r of rules) fired.add(r);

    const want = [...fixture.expect].sort();
    if (rules.join('|') === want.join('|')) {
      console.log(`✓ ${fixture.name.padEnd(42)} fired [${rules.join(' ') || 'nothing'}]`);
    } else {
      console.error(
        `✗ ${fixture.name}\n    expected [${want.join(' ') || 'nothing'}], got [${rules.join(' ') || 'nothing'}]`,
      );
      failed += 1;
    }
  }

  const undemonstrated = RULES.filter((r) => !fired.has(r));
  if (undemonstrated.length) {
    console.error(
      `\n✗ ${undemonstrated.length} rule(s) have no fixture able to make them fire: ${undemonstrated.join(', ')}`,
    );
    failed += 1;
  }

  console.log('');
  if (failed) {
    console.error(`✗ self-test: ${failed} failure(s)`);
    return 1;
  }
  console.log(
    `✓ self-test: ${FIXTURES.length} fixture(s) — all ${RULES.length} rules demonstrated able to fail`,
  );
  return 0;
}

/* -------------------------------------------------------------- dispatch -- */

const argv = process.argv.slice(2);
if (argv.includes('--self-test')) {
  process.exit(selfTest());
} else {
  const at = argv.indexOf('--dir');
  const dir = at === -1 ? DEFAULT_DIR : argv[at + 1];
  if (!dir) {
    console.error('--dir needs a path');
    process.exit(1);
  }
  process.exit(gate(resolve(dir)));
}
