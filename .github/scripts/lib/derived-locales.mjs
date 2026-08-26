/**
 * Which locales are GENERATED FROM ANOTHER LOCALE rather than translated from
 * English, and the locale each one is generated from.
 *
 * `zh-Hant` is produced from the `zh-Hans` page by
 * `apps/docs/scripts/gen-zh-hant.mjs` (OpenCC `s2twp`) and committed. It is
 * never translated from English and never hand-written, and CI gates it with
 * `gen-zh-hant.mjs --check` on every PR.
 *
 * ## Why this one fact is SHARED, when the readers around it are duplicated
 *
 * `check-translations.mjs` and `check-translation-output.mjs` deliberately
 * carry their own copies of the small things they read — `locales()`, `walk()`,
 * `localeOf()`, frontmatter parsing. That duplication is not laziness and it is
 * not this module's business to undo. It is the same principle
 * `check-locale-surface.mjs` states over its `SITE_URL` re-declaration: a check
 * that shares a constant with the thing it checks cannot catch that constant
 * being wrong. Two independent PARSERS of one tree genuinely cross-check each
 * other, and that convention holds because a mismatch between them is LOUD —
 * `SITE_URL` drifting lands every URL in both `unexpected-url` and
 * `missing-url` at once.
 *
 * Neither property holds for this map, which is why it lives here instead:
 *
 *   1. It is not a reader, it is a FACT about the content pipeline — that
 *      Traditional is generated from Simplified. Neither script audits the
 *      other, so two copies of that fact cross-check nothing. There is no
 *      oracle, only two places to be wrong independently.
 *   2. A drift between two copies would be SILENT, which is the exact inverse
 *      of the property that makes re-declaring `SITE_URL` safe. One script
 *      skipping Traditional in its worklist while the other still compares it
 *      against English produces no finding anywhere: the failure surfaces as a
 *      wasted translation pass, days later, in a place that does not point
 *      back here.
 *
 * So: one definition, imported by both. A locale added here changes the
 * worklist and the fidelity comparison in the same commit, or neither.
 *
 * Both consumers assert this map against `apps/docs/lib/i18n.ts` in their
 * `--self-test`: an entry naming a locale that is not declared there is a typo
 * that would otherwise silently disable the exclusion it was meant to add.
 */
export const DERIVED_FROM = { 'zh-Hant': 'zh-Hans' };

/** Is this locale generated from another locale rather than translated? */
export const isDerived = (locale, map = DERIVED_FROM) => Object.hasOwn(map, locale);

/** The locale this one is generated from, or `null` if it is translated. */
export const derivedFrom = (locale, map = DERIVED_FROM) => map[locale] ?? null;
