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
 * Artifact hot-reload follows `NODE_ENV` (on outside production). Enterprise
 * plugins live in ../../packages/* and can be appended to the returned
 * plugin manifest below.
 */

import { createStandaloneStack } from '@objectstack/runtime';

const artifactFile = process.env.OS_ARTIFACT_FILE;
const environmentId =
  process.env.OS_ENVIRONMENT_ID ?? process.env.OS_PROJECT_ID;
const databaseUrl =
  process.env.OS_BUSINESS_DB_URL ?? process.env.OS_DATABASE_URL;

export default await createStandaloneStack({
  artifactPath: artifactFile,
  environmentId,
  databaseUrl,
});
