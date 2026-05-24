/**
 * ObjectOS — Reference Runtime Distribution
 *
 * This is the single source of truth for the runtime image shipped to
 * end customers. It pulls every protocol implementation from the
 * `@objectstack/*` packages on npm; this repository deliberately
 * contains no protocol code of its own.
 *
 * Boot mode is governed by environment variables:
 *
 *   OS_CLOUD_URL        — Artifact API base URL (cloud-connected mode)
 *   OS_PROJECT_ID       — Project to serve
 *   OS_ARTIFACT_FILE    — Path to a local dist/objectstack.json (offline mode)
 *   OS_BUSINESS_DB_URL  — Per-project business database
 *   OS_CACHE_DIR        — Local artifact cache (default: /var/cache/objectos)
 *
 * Enterprise plugins live in ../../packages/* and can be appended to the
 * default plugin manifest below.
 */

import { createBootStack } from '@objectstack/runtime';

const cloudUrl = process.env.OS_CLOUD_URL;
const artifactFile = process.env.OS_ARTIFACT_FILE;

if (!cloudUrl && !artifactFile) {
  throw new Error(
    'ObjectOS: must set OS_CLOUD_URL (cloud mode) or OS_ARTIFACT_FILE (offline mode).',
  );
}

export default createBootStack({
  runtime: {
    cloudUrl,
    artifactFile,
    projectId: process.env.OS_PROJECT_ID,
    cacheDir: process.env.OS_CACHE_DIR ?? '/var/cache/objectos',
  },
  // Default plugin manifest is provided by @objectstack/runtime.
  // To add enterprise plugins, import them from ../../packages/* and
  // pass `{ plugins: [...] }` here.
});
