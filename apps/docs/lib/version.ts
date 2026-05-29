/**
 * Version utilities
 *
 * Single source of truth for the user-visible "current ObjectOS version".
 *
 * We pull from `apps/objectos-one/package.json` because:
 *   - `release-one` workflow keeps this in lockstep with the resolved
 *     `@objectstack/cli` version (via scripts/sync-version),
 *   - it's what actually gets shipped to GitHub Releases under
 *     `one-v<X.Y.Z>` and is what users download.
 *
 * The legacy `apps/objectos/package.json` version is stale and
 * intentionally not surfaced anywhere in the UI.
 */

import onePkg from '../../objectos-one/package.json';

/** Bare semver, e.g. "7.1.0". */
export const ONE_VERSION = onePkg.version;

/** Display form used in headers/badges, e.g. "v7.1.0". */
export const OBJECTOS_VERSION = `v${onePkg.version}`;

/** GitHub release tag matching one.yml output, e.g. "one-v7.1.0". */
export const ONE_RELEASE_TAG = `one-v${onePkg.version}`;

/** @deprecated Use OBJECTOS_VERSION instead. */
export const SPEC_VERSION = OBJECTOS_VERSION;
