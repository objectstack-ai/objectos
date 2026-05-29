/**
 * Version utilities
 *
 * Reads the version of the ObjectOS runtime distribution
 * (apps/objectos), which is what users actually deploy —
 * not the docs site's own package.json.
 */

import pkg from '../../objectos/package.json';
import onePkg from '../../objectos-one/package.json';

export const OBJECTOS_VERSION = `v${pkg.version}`;

/**
 * Version of the ObjectOS One desktop bundle (Tauri shell + runtime).
 * This is what gets shipped to GitHub Releases under tag `one-v<X.Y.Z>`,
 * so all desktop download URLs need to embed this — not OBJECTOS_VERSION.
 */
export const ONE_VERSION = onePkg.version;
export const ONE_RELEASE_TAG = `one-v${onePkg.version}`;

/** @deprecated Use OBJECTOS_VERSION instead. */
export const SPEC_VERSION = OBJECTOS_VERSION;
