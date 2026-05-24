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
 *   OS_ENVIRONMENT_ID   — Environment/project to serve (legacy: OS_PROJECT_ID)
 *   OS_ARTIFACT_FILE    — Path to a local dist/objectstack.json (offline mode)
 *   OS_BUSINESS_DB_URL  — Per-project business database
 *   OS_CACHE_DIR        — Local artifact cache (default: /var/cache/objectos)
 *
 * If OS_CLOUD_URL is absent, ObjectOS defaults to local file-backed mode.
 * Enterprise plugins live in ../../packages/* and can be appended to the
 * default plugin manifest below.
 */

import { createObjectOSStack } from '@objectstack/runtime';

const cloudUrl = process.env.OS_CLOUD_URL;
const artifactFile = process.env.OS_ARTIFACT_FILE;
const environmentId =
  process.env.OS_ENVIRONMENT_ID ?? process.env.OS_PROJECT_ID;

export default await createObjectOSStack({
  controlPlaneUrl: cloudUrl ?? 'file',
  controlPlaneApiKey: process.env.OS_CLOUD_API_KEY,
  fileConfig: artifactFile
    ? {
        artifactPath: artifactFile,
        environmentId,
        watch: process.env.OS_WATCH_ARTIFACT === '1',
      }
    : undefined,
});
