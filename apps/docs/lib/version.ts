/**
 * Version utilities
 * 
 * Import the version number from @objectstack/spec package
 */

import pkg from '../package.json';

/**
 * Current version of the ObjectOS distribution.
 * Computed once at module initialization.
 */
export const OBJECTOS_VERSION = `v${pkg.version}`;

/** @deprecated Use OBJECTOS_VERSION instead. */
export const SPEC_VERSION = OBJECTOS_VERSION;
