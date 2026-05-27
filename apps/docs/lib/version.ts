/**
 * Version utilities
 *
 * Reads the version of the ObjectOS runtime distribution
 * (apps/objectos), which is what users actually deploy —
 * not the docs site's own package.json.
 */

import pkg from '../../objectos/package.json';

export const OBJECTOS_VERSION = `v${pkg.version}`;

/** @deprecated Use OBJECTOS_VERSION instead. */
export const SPEC_VERSION = OBJECTOS_VERSION;
