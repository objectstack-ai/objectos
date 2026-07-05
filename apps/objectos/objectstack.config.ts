/**
 * ObjectOS — Reference Runtime Distribution
 *
 * This is the single source of truth for the runtime image shipped to
 * end customers. It pulls every protocol implementation from the
 * `@objectstack/*` packages on npm; this repository deliberately
 * contains no protocol code of its own.
 *
 * As of @objectstack 8.0 the runtime ships a single-tenant *standalone*
 * stack (`createStandaloneStack`); the 7.x cloud-connected, hostname-routed
 * multi-tenant wrapper (`createObjectOSStack`) has been removed from the
 * public runtime API. A cloud deployment now points `OS_ARTIFACT_FILE` at a
 * published artifact URL — `artifactPath` accepts `http(s)://` sources and
 * is fetched lazily by the loader.
 *
 * Boot is governed by environment variables (all optional — sensible
 * defaults are applied by `createStandaloneStack`):
 *
 *   OS_ARTIFACT_FILE    — Path or URL to a compiled `dist/objectstack.json`
 *                         (default: <cwd>/dist/objectstack.json)
 *   OS_ENVIRONMENT_ID   — Environment/project to serve (legacy: OS_PROJECT_ID;
 *                         default: proj_local)
 *   OS_BUSINESS_DB_URL  — Per-project business database (legacy: OS_DATABASE_URL;
 *                         default: file-backed sqlite under the ObjectStack home)
 *
 * Artifact hot-reload follows `NODE_ENV` (on outside production).
 *
 * NOTE — marketplace + Console SPA are intentionally NOT wired here. The
 * `objectstack` CLI (dev / serve / start, which every entry point — Docker and
 * the ObjectOS One desktop via one.mjs — routes through) auto-provisions them
 * on top of this standalone stack: it injects marketplace browse/install +
 * cloud-connection + runtime-config from `@objectstack/cloud-connection`
 * (gated on `resolveCloudUrl()`; `OS_CLOUD_URL=off` → fully offline, nothing
 * mounts) and serves the `@objectstack/console` SPA at `/_console/`. Both
 * packages are declared as dependencies so this distribution pins their
 * versions. Re-adding them to `plugins` below would double-mount; only wire
 * them explicitly here if a future framework drops the CLI auto-injection
 * (ADR-0006 Phase 4).
 */

import { createStandaloneStack } from '@objectstack/runtime';

const artifactFile = process.env.OS_ARTIFACT_FILE;
const environmentId =
  process.env.OS_ENVIRONMENT_ID ?? process.env.OS_PROJECT_ID;
const databaseUrl =
  process.env.OS_BUSINESS_DB_URL ?? process.env.OS_DATABASE_URL;

const stack = await createStandaloneStack({
  artifactPath: artifactFile,
  environmentId,
  databaseUrl,
});

// @objectstack 12.1 workaround: createStandaloneStack hard-codes
// `api.projectResolution: 'none'` for the single-tenant standalone case, but the
// 12.1 protocol validator's `api.projectResolution` enum only accepts
// required|optional|auto (the field is optional). Since standalone runs with
// `enableProjectScoping: false`, drop the field so compile/validate passes.
const { projectResolution: _drop, ...api } = stack.api as {
  projectResolution?: string;
} & Record<string, unknown>;

export default { ...stack, api };
