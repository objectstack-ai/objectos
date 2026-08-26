#!/usr/bin/env node
/**
 * Locale-surface gate — the locale composition of the BUILT artifacts, checked
 * against an oracle computed from `content/docs/`.
 *
 * ## Why this exists
 *
 * The same missing-language-argument defect has been found and fixed in four
 * separate generated artifacts — `sitemap.ts` (#169), `llms.txt` (#170),
 * `llms-full.txt` (#177) and the OG card (#185) — and every one of them was
 * green on every gate for its entire lifetime. On the pre-#169 tree
 * `sitemap.xml` advertised 3892 entries over 574 distinct URLs, 3318 of them
 * exact duplicates, against 335 real MDX source files. Type-check passed,
 * build passed, test passed. On #177 the same shape meant 4.6 MB of
 * seven-locale text served under a `robots.txt` that had just been opened to
 * crawlers.
 *
 * The common root cause is an API that takes an optional language argument and
 * quietly returns EVERY locale's page set when you omit it. Nothing about that
 * is a type error and nothing about it is a build error. It is only visible as
 * a count.
 *
 * So this gate asserts the count — or rather the set, which is strictly
 * stronger and localises the failure. Both directions are defects:
 *
 *   - too many entries: untranslated URLs are being advertised again, which is
 *     the #169 / #177 defect returning;
 *   - too few entries: a shipped translation is invisible to crawlers, which
 *     is the same bug with the sign flipped and is otherwise indistinguishable
 *     from "nobody has translated that page yet".
 *
 * ## The oracle is the content tree, not a recorded snapshot
 *
 * A gate that pins 346 by hand needs hand-editing on every content PR and gets
 * deleted within a month; worse, the edit that updates the number is the same
 * edit that would hide a regression. So the expected surface is DERIVED, every
 * run, from two authorities the repo already has:
 *
 *   - `content/docs/**\/*.mdx` — the pages, and which locales each really has.
 *     A translation is a locale-suffixed sibling (`foo.ja.mdx`); its absence
 *     means the page falls back to English, and a fallback URL must not be
 *     advertised as a translation (AGENTS.md, "Locale conventions").
 *   - `apps/docs/lib/i18n.ts` — the locale list and the default locale.
 *     AGENTS.md names it the authority; `check-translation-output.mjs` already
 *     reads it the same way, and `turbo.json` already names it an input to the
 *     `test` task.
 *
 * Nothing here reads app code. The gate must be able to go red when app code
 * is wrong, which it cannot do if app code is where it gets its expectations.
 *
 * ## Why it reads the build output rather than importing `sitemap.ts`
 *
 * Importing `apps/docs/app/sitemap.ts` pulls in the whole MDX collection and
 * the `@/` alias, which is why every measurement on this backlog was taken off
 * the build artifact instead. That makes this a post-`build` step rather than
 * a standalone zero-dependency self-test like `check-node-floor.mjs`, and it
 * is why CI invokes it as its own step after `pnpm turbo run build` rather
 * than as a turbo task: turbo would hash it against this package's inputs,
 * which do not include another package's `.next/` output, and a locale gate
 * replaying a cached green is precisely the failure this card exists to end.
 *
 * The `--self-test` mode below needs no build: it drives the same
 * collect/evaluate pipeline over fixture trees in a temp directory.
 *
 * ## Adding an artifact
 *
 * `ARTIFACTS` is the whole extension point. Each entry says where the built
 * file is, how to read the advertised locale surface out of it, what the
 * content tree says that surface should be, and which VOCABULARY the two are
 * compared in. #184 added `llms.txt` and `llms-full.txt` alongside the sitemap.
 *
 * Two vocabularies exist because the three artifacts do not all identify a page
 * the same way. The sitemap advertises URLs, so `BY_URL` compares URL sets. The
 * `llms` bodies advertise page TITLES and never emit a page's own URL, so
 * `BY_LOCALE_EXCLUSIVE_TITLE` compares the titles that belong to exactly one
 * locale. Both are assertions on COMPOSITION — which pages, in which locales —
 * and neither says anything about ORDER. That is deliberate and load-bearing:
 * `llms-full.txt`'s page order was measured to differ between two builds of the
 * same commit, and #196 then changed the order on purpose to follow the
 * navigation tree. Any assertion on sequence, a golden file, or a diff against
 * a recorded body would have flaked before that change and broken after it.
 * `llms.txt` walks the page tree, whose order comes from `meta.json`, so it is
 * not exposed to the same non-determinism — it is written the same way anyway,
 * because a gate whose halves have different robustness properties is a gate
 * someone reads wrong later.
 *
 * ## Usage
 *
 *   node .github/scripts/check-locale-surface.mjs              # the gate (needs a build)
 *   node .github/scripts/check-locale-surface.mjs --self-test  # prove every rule can fail
 *
 * No dependencies, no network, no credentials.
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

/** Every rule this gate enforces; the self-test asserts each one has a red fixture. */
const RULES = [
  'artifact-missing',
  'artifact-empty',
  'nothing-expected',
  'unexpected-url',
  'missing-url',
  'duplicate-url',
  'unexpected-locale-title',
  'missing-locale-title',
  'translation-orphan',
];

/**
 * Canonical production host. Must match `SITE_URL` in `apps/docs/lib/seo.ts`.
 * Deliberately re-declared rather than imported: this file is the independent
 * check, and a check that shares a constant with the thing it checks cannot
 * catch that constant being wrong. A mismatch shows up as every URL landing in
 * both `unexpected-url` and `missing-url`, which is loud and unambiguous.
 */
const SITE_URL = 'https://docs.objectos.ai';

/**
 * Top-level pages that are NOT in `content/docs/`, with the locales they are
 * really written in.
 *
 * `privacy` and `terms` carry their copy in a `content` record inside their own
 * route component, which falls back to English for anything not listed there.
 * They are declared here rather than derived because they are not in the
 * content tree at all, and because the oracle deliberately does not read app
 * code (see the header). This list changing is a deliberate act — translating
 * the privacy policy — so a drift going red and naming the page is the correct
 * outcome, not a maintenance tax: unlike the docs counts, it does not move on
 * every content PR.
 *
 * The site root is separate: it exists in every locale because it is a
 * language dispatch page that redirects to that locale's `/docs`.
 */
const STATIC_PAGES = [
  { path: 'privacy', locales: ['en', 'zh-Hans'] },
  { path: 'terms', locales: ['en', 'zh-Hans'] },
];

const rel = (p) => relative(ROOT, p);

/* ------------------------------------------------------------- the oracle -- */

/**
 * Locale list and default locale, parsed as text out of `lib/i18n.ts`.
 * Same reader shape `check-translation-output.mjs` uses. Throws rather than
 * defaulting: a gate that guesses the locale list when it cannot read one is a
 * gate that reports a green it did not measure.
 */
function readI18n(root) {
  const path = join(root, 'apps/docs/lib/i18n.ts');
  const text = readFileSync(path, 'utf8');

  const list = text.match(/languages:\s*\[([^\]]+)\]/);
  if (!list) throw new Error(`could not parse languages[] out of ${rel(path)}`);
  const languages = list[1]
    .split(',')
    .map((s) => s.trim().replace(/['"]/g, ''))
    .filter(Boolean);
  if (languages.length === 0) throw new Error(`languages[] is empty in ${rel(path)}`);

  const def = text.match(/defaultLanguage:\s*['"]([^'"]+)['"]/);
  if (!def) throw new Error(`could not parse defaultLanguage out of ${rel(path)}`);
  const defaultLanguage = def[1];
  if (!languages.includes(defaultLanguage)) {
    throw new Error(`defaultLanguage "${defaultLanguage}" is not in languages[] in ${rel(path)}`);
  }

  return { languages, defaultLanguage };
}

/**
 * The frontmatter `title:` of an `.mdx` file, or `undefined`.
 *
 * A deliberately small YAML reader, for the same reason `readI18n` parses
 * `i18n.ts` as text: this gate takes no dependencies, and the surface it needs
 * is one scalar out of the leading `---` block. Every one of the 335 files in
 * the tree today has an unquoted single-line `title:`; matching quotes are
 * stripped anyway so that the first title needing them (one containing a colon)
 * does not silently read as `"Foo"` and stop matching the built body.
 *
 * A page with no title contributes nothing to the buckets below, which narrows
 * what can be asserted rather than breaking it. That is not a hole worth its
 * own rule: `title` is required by the fumadocs frontmatter schema, so a page
 * without one fails `build` long before this gate runs.
 */
function readTitle(text) {
  if (!text.startsWith('---')) return undefined;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return undefined;
  const match = text.slice(3, end).match(/^title:\s*(.+)$/m);
  if (!match) return undefined;

  const value = match[1].trim();
  const quoted = /^(['"])(.*)\1$/.exec(value);
  return (quoted ? quoted[2] : value).trim() || undefined;
}

function walkMdx(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walkMdx(p, out);
    else if (entry.name.endsWith('.mdx')) out.push(p);
  }
  return out;
}

/**
 * The logical docs pages and, for each, the locales that have a REAL source
 * file for it.
 *
 * A page is identified by its site path (`docs/build/data`), derived from the
 * file path the way fumadocs derives slugs: strip the locale suffix, strip
 * `.mdx`, and drop a trailing `index` segment. English is the authored source
 * for every page (AGENTS.md: "English is the single source of truth"), so a
 * locale file with no English sibling is reported rather than counted — it
 * would otherwise inflate the oracle to match an artifact that is also wrong.
 */
function readDocsPages(root, { languages, defaultLanguage }) {
  const docsDir = join(root, 'content/docs');
  const nonDefault = languages.filter((l) => l !== defaultLanguage);
  const pages = new Map();

  for (const file of existsSync(docsDir) ? walkMdx(docsDir) : []) {
    const relPath = relative(docsDir, file).split('\\').join('/');
    const locale = nonDefault.find((l) => relPath.endsWith(`.${l}.mdx`)) ?? defaultLanguage;
    const suffix = locale === defaultLanguage ? '.mdx' : `.${locale}.mdx`;
    const segments = relPath.slice(0, -suffix.length).split('/');
    if (segments[segments.length - 1] === 'index') segments.pop();
    const path = ['docs', ...segments].join('/');

    if (!pages.has(path)) pages.set(path, { locales: new Set(), files: new Map(), titles: new Map() });
    pages.get(path).locales.add(locale);
    pages.get(path).files.set(locale, rel(file));

    const title = readTitle(readFileSync(file, 'utf8'));
    if (title !== undefined) pages.get(path).titles.set(locale, title);
  }

  const orphans = [];
  for (const [path, page] of pages) {
    if (!page.locales.has(defaultLanguage)) {
      orphans.push({
        path,
        locales: [...page.locales],
        files: [...page.files.values()],
      });
    }
  }

  return { pages, orphans };
}

/**
 * Absolute URL for a logical path in a locale. Mirrors `localeUrl()` in
 * `apps/docs/lib/seo.ts`, including `hideLocale: 'default-locale'`.
 */
function localeUrl(lang, path, defaultLanguage) {
  const suffix = path ? `/${path}` : '';
  return lang === defaultLanguage ? `${SITE_URL}${suffix}` : `${SITE_URL}/${lang}${suffix}`;
}

/**
 * The full expected sitemap URL set: the root in every locale, the two legal
 * pages in the locales they are written in, and every docs page in the locales
 * that really have it.
 */
function expectedSitemapUrls(surface) {
  const { languages, defaultLanguage, pages } = surface;
  const urls = new Set();

  for (const lang of languages) urls.add(localeUrl(lang, '', defaultLanguage));

  for (const { path, locales } of STATIC_PAGES) {
    for (const lang of locales) {
      if (languages.includes(lang)) urls.add(localeUrl(lang, path, defaultLanguage));
    }
  }

  for (const [path, page] of pages) {
    if (!page.locales.has(defaultLanguage)) continue; // orphan; reported separately
    for (const lang of languages) {
      if (page.locales.has(lang)) urls.add(localeUrl(lang, path, defaultLanguage));
    }
  }

  return urls;
}

/**
 * Per locale, the page titles that belong to THAT LOCALE AND NO OTHER, each
 * mapped to one source file that carries it.
 *
 * ## Why titles, and why only the exclusive ones
 *
 * The `llms` bodies never emit a page's own URL — `llms-full.txt` is page texts
 * concatenated, each opening with the `# <title>` line `getLLMText` puts there
 * — so a URL set cannot be read out of them. The title can. But a plain "every
 * title in the artifact equals every English title" comparison is the wrong
 * assertion twice over: three pairs of English pages share a title today
 * (`Approvals`, `Dashboards`, `Notifications`), and any page that grows an `#`
 * heading in its own body would read as an extra page. Both would go red on a
 * content PR that broke nothing — and a gate that cries wolf on content growth
 * is a gate that gets deleted, which is the failure the "no hand-pinned counts"
 * rule at the top of this file is already about.
 *
 * Restricting the comparison to titles that are unique to one locale is what
 * makes it stable. A title held by exactly one locale is a fingerprint for that
 * locale's page set, so:
 *
 *   - every `en`-exclusive title must be in the body — if one goes missing,
 *     English pages stopped being served;
 *   - no other locale's exclusive title may be — if one appears, the language
 *     argument was dropped and every locale is being emitted again.
 *
 * Measured on the tree this shipped against: 60 / 52 / 31 / 25 / 32 / 28 / 31
 * exclusive titles for `en` / `zh-Hans` / `ja` / `de` / `es` / `fr` / `ko`, and
 * both built bodies read 60 / 0 / 0 / 0 / 0 / 0 / 0. Issue #184 recorded the
 * same shape one tree earlier as 63/53/31/25/32/28/31 collapsing to 63/0×6.
 * The numbers move with the content; nothing here pins them.
 *
 * Titles are bucketed from EVERY `.mdx` file, translation-only orphans
 * included. An orphan is already reported by `translation-orphan`, and letting
 * its title count for its own locale can only make the guard stricter.
 */
function localeExclusiveTitles({ languages, pages }) {
  const buckets = new Map(languages.map((lang) => [lang, new Map()]));

  for (const [, page] of pages) {
    for (const [locale, title] of page.titles) {
      const bucket = buckets.get(locale);
      if (bucket && !bucket.has(title)) bucket.set(title, page.files.get(locale));
    }
  }

  const exclusive = new Map();
  for (const lang of languages) {
    const others = languages.filter((l) => l !== lang);
    const own = new Map();
    for (const [title, file] of buckets.get(lang)) {
      if (!others.some((other) => buckets.get(other).has(title))) own.set(title, file);
    }
    exclusive.set(lang, own);
  }

  return exclusive;
}

/** The titles a correct `llms` body advertises: the default locale's exclusive ones. */
function expectedExclusiveTitles(surface) {
  return new Set(surface.exclusiveTitles.get(surface.defaultLanguage).keys());
}

/** Every locale-exclusive title, in any locale — the comparison's whole universe. */
function everyExclusiveTitle(surface) {
  const all = new Set();
  for (const [, titles] of surface.exclusiveTitles) for (const title of titles.keys()) all.add(title);
  return all;
}

/** The locale an exclusive title belongs to, and the file that carries it. */
function ownerOf(title, surface) {
  for (const [lang, titles] of surface.exclusiveTitles) {
    if (titles.has(title)) return { lang, file: titles.get(title) };
  }
  return { lang: '?', file: '?' };
}

/* ------------------------------------------------------- artifact readers -- */

const unescapeXml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/**
 * Every `loc` a sitemap advertises, in document order and WITH duplicates —
 * the pre-#169 tree's 3892 entries over 574 distinct URLs is only visible if
 * the reader does not de-duplicate on the way in.
 *
 * hreflang `alternate` links are deliberately not collected: they are the
 * reciprocal cluster for an entry, not separate advertised URLs, and every one
 * of them is some other entry's `loc`.
 */
function readSitemapUrls(text) {
  return [...text.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => unescapeXml(m[1].trim()));
}

/**
 * Every page title `llms.txt` advertises: the link text of each page bullet,
 * `- [Title](https://…): description`, at any indentation.
 *
 * Structured rather than "does the body contain this string". A substring
 * search over the same bodies produces four false hits on today's tree —
 * `Glossar` inside `Glossary`, and `Datasources`, `Roles` and `Licence` sitting
 * in English prose — each of which reads as "a German page is being served".
 * The link text is the page title and nothing else is.
 *
 * Section headings (`## Build`) and the bullets for folders that have no index
 * page (`- Data`) are deliberately not collected: their text comes from
 * `meta.json`, not from a page's frontmatter, so they are not evidence that a
 * page is in the artifact.
 */
function readLlmsIndexTitles(text) {
  return [...text.matchAll(/^[ \t]*-[ \t]+\[([^\]]+)\]\([^)\s]*\)/gm)].map((m) => m[1].trim());
}

/** Opening or closing line of a fenced code block — mirrors the `llms-full.txt` route. */
const FENCE = /^[ \t]{0,3}(`{3,}|~{3,})/;

/**
 * Every page title `llms-full.txt` advertises: the `# ` heading that
 * `getLLMText` puts at the top of each page's text.
 *
 * Fenced code blocks are skipped, matching what the route itself does when it
 * rewrites links. Not a nicety — 14 shell-comment lines in today's corpus start
 * with `# `, and a fence-blind reader takes all of them for page titles.
 *
 * Fence state is tracked across the whole joined body rather than per page,
 * because the page boundaries are exactly what this reader is trying to find.
 * A page that leaves a fence open therefore swallows the NEXT page's title —
 * which surfaces as `missing-locale-title` naming that page. That is the right
 * outcome and the safe direction: an unclosed fence is a real authoring defect
 * that mangles the served body too, and the failure is loud rather than a green
 * over an unread artifact.
 */
function readLlmsFullTitles(text) {
  const titles = [];
  let fence;

  for (const line of text.split('\n')) {
    const marker = FENCE.exec(line)?.[1];
    if (marker) {
      if (fence === undefined) fence = marker[0];
      else if (marker[0] === fence) fence = undefined;
      continue;
    }
    if (fence !== undefined) continue;

    const heading = /^#[ \t]+(\S.*)$/.exec(line);
    if (heading) titles.push(heading[1].trim());
  }

  return titles;
}

/* ------------------------------------------------- comparison vocabularies -- */

/**
 * How an artifact's advertised entries are compared with the oracle: what an
 * entry IS, which entries are in scope, whether a repeat is a defect, and the
 * rules and wording a mismatch is reported under.
 *
 * The wording is per-vocabulary rather than shared because a shared message is
 * a wrong message: telling a reader that `データモデル` "is advertised but the
 * content tree has no source file for it" is false twice — it is not a URL and
 * it has a source file. The whole point of the finding is to name what is
 * actually wrong.
 */
const BY_URL = {
  unit: 'URL',
  /** No restriction: every `loc` in a sitemap is an advertised URL. */
  universe: null,
  /**
   * A URL is an identity, so advertising one twice is a defect on its own —
   * the pre-#169 tree emitted 3318 exact duplicates, and de-duplicating on the
   * way in would have hidden every one of them behind a correct distinct count.
   */
  duplicate: {
    rule: 'duplicate-url',
    detail: (spec, url, count) => `${spec.id}: ${url} advertised ${count} times`,
  },
  unexpected: {
    rule: 'unexpected-url',
    detail: (spec, url) =>
      `${spec.id}: ${url} is advertised but the content tree has no source file for it — ` +
      'an untranslated page is being advertised as a translation',
  },
  missing: {
    rule: 'missing-url',
    detail: (spec, url) =>
      `${spec.id}: ${url} has a source file in the content tree but is not advertised — ` +
      'a shipped translation is invisible to crawlers',
  },
};

const BY_LOCALE_EXCLUSIVE_TITLE = {
  unit: 'locale-exclusive title',
  /**
   * Only titles that belong to exactly one locale are compared. Everything else
   * the reader picked up — a title several locales share, a heading inside a
   * page — carries no evidence about which locale's pages are in the body, and
   * including it would make the gate red on content growth. See
   * `localeExclusiveTitles`.
   */
  universe: everyExclusiveTitle,
  /**
   * A title is a label, not an identity: `Approvals`, `Dashboards` and
   * `Notifications` each name two different English pages today. A repeated
   * title is therefore not the defect a repeated URL is, and counting it as one
   * would put three permanent findings on a correct build.
   */
  duplicate: null,
  unexpected: {
    rule: 'unexpected-locale-title',
    detail: (spec, title, surface) => {
      const { lang, file } = ownerOf(title, surface);
      return (
        `${spec.id}: "${title}" is in the body, and that title exists only in ${lang} ` +
        `(${file}) — a non-${surface.defaultLanguage} page is being served here, which is ` +
        "the language argument having been dropped from this route's page lookup"
      );
    },
  },
  missing: {
    rule: 'missing-locale-title',
    detail: (spec, title, surface) => {
      const { file } = ownerOf(title, surface);
      return (
        `${spec.id}: "${title}" is a page title that exists only in ${surface.defaultLanguage} ` +
        `(${file}), and it is NOT in the body — ${surface.defaultLanguage} pages have stopped ` +
        'being served here'
      );
    },
  },
};

/**
 * The artifacts this gate asserts.
 *
 * `file` is relative to the repo root. The built output of a Next.js route
 * handler lands beside a `.meta` and the route module itself; the `.body` file
 * is the bytes actually served.
 *
 * All three are generated from the same `source` loader by the same call shape,
 * and all three have had the language argument dropped from it at some point —
 * `sitemap.ts` (#169), `llms.txt` (#170), `llms-full.txt` (#177) — which is why
 * they belong in one gate rather than three.
 */
const ARTIFACTS = [
  {
    id: 'sitemap.xml',
    file: 'apps/docs/.next/server/app/sitemap.xml.body',
    read: readSitemapUrls,
    expected: expectedSitemapUrls,
    compare: BY_URL,
  },
  {
    id: 'llms.txt',
    file: 'apps/docs/.next/server/app/llms.txt.body',
    read: readLlmsIndexTitles,
    expected: expectedExclusiveTitles,
    compare: BY_LOCALE_EXCLUSIVE_TITLE,
  },
  {
    id: 'llms-full.txt',
    file: 'apps/docs/.next/server/app/llms-full.txt.body',
    read: readLlmsFullTitles,
    expected: expectedExclusiveTitles,
    compare: BY_LOCALE_EXCLUSIVE_TITLE,
  },
];

/* ---------------------------------------------------------------- collect -- */

function collect(root) {
  const { languages, defaultLanguage } = readI18n(root);
  const { pages, orphans } = readDocsPages(root, { languages, defaultLanguage });
  const surface = { languages, defaultLanguage, pages, orphans };
  surface.exclusiveTitles = localeExclusiveTitles(surface);

  const artifacts = ARTIFACTS.map((spec) => {
    const path = join(root, spec.file);
    if (!existsSync(path)) return { spec, found: false, path, advertised: [] };
    return { spec, found: true, path, advertised: spec.read(readFileSync(path, 'utf8')) };
  });

  return { surface, artifacts };
}

/* --------------------------------------------------------------- evaluate -- */

function evaluate({ surface, artifacts }) {
  const findings = [];
  const { defaultLanguage, languages } = surface;

  for (const orphan of surface.orphans) {
    findings.push({
      rule: 'translation-orphan',
      detail:
        `${orphan.path} has ${orphan.locales.join(', ')} but no ${defaultLanguage} source ` +
        `(${orphan.files.join(', ')}) — English is the authored source for every page, so ` +
        'this page has no canonical URL to advertise',
    });
  }

  for (const artifact of artifacts) {
    const { spec } = artifact;

    if (!artifact.found) {
      findings.push({
        rule: 'artifact-missing',
        artifact: spec.id,
        detail:
          `${spec.id}: no built artifact at ${rel(artifact.path)} — run \`pnpm turbo run build\` ` +
          'first. This gate reads the build output on purpose; not finding it is a failure, ' +
          'never a skip.',
      });
      continue;
    }

    if (artifact.advertised.length === 0) {
      findings.push({
        rule: 'artifact-empty',
        artifact: spec.id,
        detail:
          `${spec.id}: ${rel(artifact.path)} exists but no entries could be read out of it — ` +
          'either the artifact is empty or its format changed and this reader is now silently ' +
          'returning nothing',
      });
      continue;
    }

    const { compare } = spec;
    const expected = spec.expected(surface);

    // An oracle that expects nothing cannot contradict anything, so a green
    // over it is a claim and not a measurement — the same reason `artifact-empty`
    // above is a failure rather than a skip. It is reachable only for a
    // vocabulary with a `universe`: the sitemap's expected set always holds at
    // least the site root in each of the locales `readI18n` guarantees.
    if (expected.size === 0) {
      findings.push({
        rule: 'nothing-expected',
        artifact: spec.id,
        detail:
          `${spec.id}: the oracle produced no ${defaultLanguage} ${compare.unit}(s), so nothing ` +
          'about this artifact was actually compared — the content tree can no longer ' +
          'distinguish this artifact being right from it being wrong',
      });
      continue;
    }

    // Entries outside the vocabulary's universe carry no evidence either way
    // and are dropped before the comparison — but AFTER `artifact-empty` above,
    // which stays a pure question about the format: did the reader read
    // anything at all.
    const universe = compare.universe?.(surface);
    const inScope = universe
      ? artifact.advertised.filter((entry) => universe.has(entry))
      : artifact.advertised;

    const seen = new Map();
    for (const entry of inScope) seen.set(entry, (seen.get(entry) ?? 0) + 1);

    if (compare.duplicate) {
      for (const [entry, count] of seen) {
        if (count > 1) {
          findings.push({
            rule: compare.duplicate.rule,
            artifact: spec.id,
            detail: compare.duplicate.detail(spec, entry, count),
          });
        }
      }
    }

    const unexpected = [...seen.keys()].filter((e) => !expected.has(e)).sort();
    const missing = [...expected].filter((e) => !seen.has(e)).sort();

    for (const entry of unexpected) {
      findings.push({
        rule: compare.unexpected.rule,
        artifact: spec.id,
        detail: compare.unexpected.detail(spec, entry, surface),
      });
    }
    for (const entry of missing) {
      findings.push({
        rule: compare.missing.rule,
        artifact: spec.id,
        detail: compare.missing.detail(spec, entry, surface),
      });
    }

    artifact.report = {
      read: artifact.advertised.length,
      total: inScope.length,
      distinct: seen.size,
      expected: expected.size,
      unexpected: unexpected.length,
      missing: missing.length,
      duplicates: compare.duplicate ? [...seen.values()].filter((c) => c > 1).length : null,
    };
  }

  // Per-locale docs composition, for the summary. Reported whether or not the
  // run is green: a green with the counts printed is a measurement, a bare
  // green is a claim.
  const perLocale = {};
  for (const lang of languages) perLocale[lang] = 0;
  for (const [, page] of surface.pages) {
    if (!page.locales.has(defaultLanguage)) continue;
    for (const lang of languages) if (page.locales.has(lang)) perLocale[lang] += 1;
  }

  return { findings, perLocale };
}

/* ------------------------------------------------------------------- gate -- */

function gate() {
  // One collect, one evaluate: `evaluate` hangs the per-artifact tallies off
  // the objects it was handed, so re-collecting would print a table of dashes
  // over a run that really did measure something.
  const collected = collect(ROOT);
  const { findings, perLocale } = evaluate(collected);
  const { surface, artifacts } = collected;

  const docsTotal = Object.values(perLocale).reduce((a, b) => a + b, 0);
  const logical = [...surface.pages.values()].filter((p) =>
    p.locales.has(surface.defaultLanguage),
  ).length;

  console.log('## Locale surface\n');
  console.log(
    `Oracle: **${logical}** logical docs page(s) over ${surface.languages.length} locale(s) ` +
      `= **${docsTotal}** docs entries, derived from \`content/docs/\` and ` +
      '`apps/docs/lib/i18n.ts`.\n',
  );
  console.log('| locale | docs entries |');
  console.log('|---|---:|');
  for (const [lang, n] of Object.entries(perLocale)) console.log(`| \`${lang}\` | ${n} |`);
  console.log('');

  // `read` and `in scope` differ only for a vocabulary that restricts the
  // comparison to a universe. Both are printed so that the restriction is
  // visible: a gate quietly ignoring most of what it read is the same failure
  // as a gate that read nothing.
  console.log('| artifact | compared as | read | in scope | distinct | expected | unexpected | missing | duplicated |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const a of artifacts) {
    const r = a.report;
    console.log(
      r
        ? `| \`${a.spec.id}\` | ${a.spec.compare.unit} | ${r.read} | ${r.total} | ${r.distinct} | ` +
            `${r.expected} | ${r.unexpected} | ${r.missing} | ${r.duplicates ?? 'n/a'} |`
        : `| \`${a.spec.id}\` | ${a.spec.compare.unit} | — | — | — | — | — | — | — |`,
    );
  }
  console.log('');

  if (findings.length === 0) {
    console.log(
      '✓ every advertised URL has a source file and every source file is advertised; both ' +
        `\`llms\` bodies carry every ${surface.defaultLanguage}-only page title and none from ` +
        'the other locales',
    );
    return;
  }

  const byRule = new Map();
  for (const f of findings) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, []);
    byRule.get(f.rule).push(f.detail);
  }

  console.log(`✗ **${findings.length}** locale-surface finding(s)\n`);
  for (const [rule, details] of byRule) {
    console.log(`**${rule}** — ${details.length}\n`);
    for (const d of details.slice(0, 15)) console.log(`  - ${d}`);
    if (details.length > 15) console.log(`  - …and ${details.length - 15} more`);
    console.log('');
  }

  console.error(`\n✗ locale surface: ${findings.length} finding(s)`);
  process.exit(1);
}

/* -------------------------------------------------------------- self-test --
 * 裁决 (PR #74): a validator observed only green is indistinguishable from one
 * that cannot go red. Every rule ships the fixture that trips it, and the
 * assertion is on the EXACT set of rules fired — a fixture that goes red for
 * the wrong reason proves nothing about the rule it was written for.
 *
 * Fixtures are whole repo-shaped trees written to a temp directory and read
 * back through `collect()`, so the readers are exercised too: a gate whose
 * rules are all provably able to fire, wired to a reader that silently returns
 * nothing, is still a gate that cannot go red.
 */

const I18N_FIXTURE = `import { defineI18n } from 'fumadocs-core/i18n';
export const i18n = defineI18n({
  defaultLanguage: 'en',
  languages: ['en', 'zh-Hans', 'ja'],
  hideLocale: 'default-locale',
});
`;

/** An `.mdx` fixture file: frontmatter title plus body, the shape the oracle reads. */
const mdx = (title, body = 'Body text.') => `---\ntitle: ${title}\n---\n\n${body}`;

/**
 * A page in every fixture tree: English plus a real Japanese translation.
 *
 * The titles matter as much as the paths now. `Home`, `Guide` and `Deep` are
 * `en`-exclusive; `ガイド` is `ja`-exclusive; between them they are the whole
 * universe the `llms` vocabulary compares in.
 */
const BASE_CONTENT = {
  'index.mdx': mdx('Home'),
  'guide.mdx': mdx('Guide'),
  'guide.ja.mdx': mdx('ガイド'),
  'deep/index.mdx': mdx('Deep'),
};

/** The `en`-exclusive titles of `BASE_CONTENT`, in the order a correct body lists them. */
const BASE_TITLES = ['Home', 'Guide', 'Deep'];

/**
 * The sitemap the base fixture SHOULD produce: root in all three locales, the
 * two legal pages in their two, `docs` and `docs/deep` in English only, and
 * `docs/guide` in English and Japanese.
 */
const BASE_URLS = [
  'https://docs.objectos.ai',
  'https://docs.objectos.ai/zh-Hans',
  'https://docs.objectos.ai/ja',
  'https://docs.objectos.ai/privacy',
  'https://docs.objectos.ai/zh-Hans/privacy',
  'https://docs.objectos.ai/terms',
  'https://docs.objectos.ai/zh-Hans/terms',
  'https://docs.objectos.ai/docs',
  'https://docs.objectos.ai/docs/guide',
  'https://docs.objectos.ai/ja/docs/guide',
  'https://docs.objectos.ai/docs/deep',
];

const sitemapXml = (urls) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `<url>\n<loc>${u}</loc>\n</url>`).join('\n') +
  '\n</urlset>\n';

/**
 * An `llms.txt` body: a header, then one bullet per page, the shape
 * `llms(source).indexNode` emits.
 */
const llmsIndex = (titles) =>
  `# ObjectOS\n\n> Summary line.\n\n## Overview\n\n` +
  titles
    .map((t) => `- [${t}](https://docs.objectos.ai/docs/${t.toLowerCase()}): Description of ${t}.`)
    .join('\n') +
  '\n';

/**
 * An `llms-full.txt` body: page texts joined, each opening with the `# <title>`
 * line `getLLMText` prepends.
 */
const llmsFull = (titles) => `${titles.map((t) => `# ${t}\n\nBody of ${t}.`).join('\n\n')}\n`;

/** Artifact paths by id — never by index, so adding an artifact cannot repoint one. */
const fileOf = (id) => ARTIFACTS.find((a) => a.id === id).file;
const SITEMAP_FILE = fileOf('sitemap.xml');
const LLMS_INDEX_FILE = fileOf('llms.txt');
const LLMS_FULL_FILE = fileOf('llms-full.txt');

const CASES = [
  {
    name: 'clean baseline',
    expect: [],
  },
  {
    // The #169 defect, in miniature: every page advertised in every locale.
    name: 'every page in every locale (the #169 shape)',
    urls: [
      ...BASE_URLS,
      'https://docs.objectos.ai/zh-Hans/docs',
      'https://docs.objectos.ai/ja/docs',
      'https://docs.objectos.ai/zh-Hans/docs/guide',
      'https://docs.objectos.ai/zh-Hans/docs/deep',
      'https://docs.objectos.ai/ja/docs/deep',
    ],
    expect: ['unexpected-url'],
  },
  {
    // A real translation exists on disk but the artifact does not list it.
    name: 'shipped translation not advertised',
    urls: BASE_URLS.filter((u) => u !== 'https://docs.objectos.ai/ja/docs/guide'),
    expect: ['missing-url'],
  },
  {
    // The pre-#169 tree emitted 3318 exact duplicates. De-duplicating on read
    // would have hidden all of them behind a correct distinct count.
    name: 'duplicated entries',
    urls: [...BASE_URLS, 'https://docs.objectos.ai/docs/guide'],
    expect: ['duplicate-url'],
  },
  {
    name: 'no built artifact',
    artifacts: null,
    expect: ['artifact-missing'],
  },
  {
    // A format change that leaves the reader matching nothing must be a
    // failure, not a green over zero measurements.
    name: 'sitemap present but unreadable',
    rawSitemap:
      '<?xml version="1.0"?>\n<urlset><url><location>https://docs.objectos.ai</location></url></urlset>\n',
    expect: ['artifact-empty'],
  },
  {
    // AGENTS.md forbids a translation-only file. Counting it would inflate the
    // oracle to agree with an artifact that is also wrong.
    name: 'translation with no English source',
    content: { ...BASE_CONTENT, 'orphan.ja.mdx': mdx('孤児') },
    expect: ['translation-orphan'],
  },

  /* ------------------------------------------- the two `llms` bodies (#184) -- */

  {
    // The #177 defect: `source.getPages()` called with no language returns
    // every locale's pages, so a Japanese page's text lands in the English
    // body. Measured on the real tree as 4.6 MB over seven locales.
    name: 'llms-full.txt carries another locale (the #177 shape)',
    fullBody: llmsFull([...BASE_TITLES, 'ガイド']),
    expect: ['unexpected-locale-title'],
  },
  {
    // The same defect one route over (#170): `source.getPageTree()` with no
    // language builds an index over every locale's pages.
    name: 'llms.txt carries another locale (the #170 shape)',
    indexBody: llmsIndex([...BASE_TITLES, 'ガイド']),
    expect: ['unexpected-locale-title'],
  },
  {
    // The sign-flipped defect, and the reason the card asserts both
    // directions: English pages silently stop being served and every check
    // that only looks for foreign pages stays green.
    name: 'llms-full.txt has dropped an English page',
    fullBody: llmsFull(['Home', 'Guide']),
    expect: ['missing-locale-title'],
  },
  {
    name: 'llms.txt has dropped an English page',
    indexBody: llmsIndex(['Home', 'Guide']),
    expect: ['missing-locale-title'],
  },
  {
    // `getLLMText` stops prepending `# <title>`, or `indexNode` stops emitting
    // bullets: the reader matches nothing and the artifact must fail rather
    // than pass over zero entries.
    name: 'llms-full.txt present but unreadable',
    fullBody: 'Home\n\nBody of Home.\n\nGuide\n\nBody of Guide.\n',
    expect: ['artifact-empty'],
  },
  {
    name: 'llms.txt present but unreadable',
    indexBody: '# ObjectOS\n\n> Summary line.\n\nHome, Guide and Deep are documented.\n',
    expect: ['artifact-empty'],
  },
  {
    // Green on purpose. 14 lines in the real corpus open with `# ` inside a
    // shell fence; a fence-blind reader calls each of them a page title. This
    // fixture puts a ja-exclusive title inside a fence, where a wrong reader
    // fires `unexpected-locale-title` and the right one stays silent.
    name: 'a `# ` line inside a code fence is not a page title',
    fullBody: `${llmsFull(BASE_TITLES)}\n\`\`\`sh\n# ガイド\n\`\`\`\n`,
    expect: [],
  },
  {
    // Green on purpose, the `llms.txt` half of the same property. Substring
    // matching over these bodies produces four false hits on the real tree
    // (`Glossar` in `Glossary`; `Datasources`, `Roles`, `Licence` in English
    // prose), each reading as a foreign page being served.
    name: 'a title named in prose is not an advertisement',
    indexBody: `${llmsIndex(BASE_TITLES)}\nThe ガイド page is the Japanese translation of Guide.\n`,
    expect: [],
  },
  {
    // The hole the universe restriction opens: if no English title is unique
    // to English, the comparison has nothing to compare and both `llms`
    // artifacts would pass without measuring anything.
    name: 'no title is exclusive to any locale',
    content: { 'index.mdx': mdx('Shared'), 'index.ja.mdx': mdx('Shared') },
    urls: [
      'https://docs.objectos.ai',
      'https://docs.objectos.ai/zh-Hans',
      'https://docs.objectos.ai/ja',
      'https://docs.objectos.ai/privacy',
      'https://docs.objectos.ai/zh-Hans/privacy',
      'https://docs.objectos.ai/terms',
      'https://docs.objectos.ai/zh-Hans/terms',
      'https://docs.objectos.ai/docs',
      'https://docs.objectos.ai/ja/docs',
    ],
    indexBody: llmsIndex(['Shared']),
    fullBody: llmsFull(['Shared']),
    expect: ['nothing-expected'],
  },
];

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'locale-surface-'));
  let failed = 0;
  /** Artifact ids that some fixture actually drove into a finding. */
  const exercised = new Set();

  try {
    for (const c of CASES) {
      rmSync(join(dir, 'content'), { recursive: true, force: true });
      rmSync(join(dir, 'apps'), { recursive: true, force: true });

      mkdirSync(join(dir, 'apps/docs/lib'), { recursive: true });
      writeFileSync(join(dir, 'apps/docs/lib/i18n.ts'), c.i18n ?? I18N_FIXTURE);

      for (const [name, body] of Object.entries(c.content ?? BASE_CONTENT)) {
        const p = join(dir, 'content/docs', name);
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, `${body}\n`);
      }

      // Every case writes ALL THREE artifacts, clean unless it overrides one.
      // A case that mutates the sitemap must leave the `llms` bodies correct,
      // or its assertion on the exact set of rules fired stops being about the
      // thing it was written for.
      const written =
        c.artifacts === null
          ? []
          : [
              [SITEMAP_FILE, c.rawSitemap ?? sitemapXml(c.urls ?? BASE_URLS)],
              [LLMS_INDEX_FILE, c.indexBody ?? llmsIndex(BASE_TITLES)],
              [LLMS_FULL_FILE, c.fullBody ?? llmsFull(BASE_TITLES)],
            ];

      for (const [file, bytes] of written) {
        const p = join(dir, file);
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, bytes);
      }

      const { findings } = evaluate(collect(dir));
      // `artifact-missing` deliberately does not count. The `no built artifact`
      // case omits every file at once, so any entry added to ARTIFACTS fires it
      // for free — counting it would let a new artifact satisfy the coverage
      // check below without one line of its reader ever having run.
      for (const f of findings) if (f.artifact && f.rule !== 'artifact-missing') exercised.add(f.artifact);
      const fired = [...new Set(findings.map((f) => f.rule))].sort();
      const want = [...c.expect].sort();
      const ok = fired.join(',') === want.join(',');
      if (!ok) failed += 1;
      console.log(
        `${ok ? '✓' : '✗'} ${c.name.padEnd(52)} fired [${fired.join(' ') || '—'}]` +
          (ok ? '' : `  expected [${want.join(' ') || '—'}]`),
      );
      if (!ok) for (const f of findings) console.error(`      [${f.rule}] ${f.detail}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log('');

  // The oracle's own arithmetic, asserted directly: the baseline fixture is
  // three locales over three logical pages with exactly one translation, and
  // the per-locale tally is what the gate prints and what a reviewer reads.
  const dir2 = mkdtempSync(join(tmpdir(), 'locale-surface-tally-'));
  try {
    mkdirSync(join(dir2, 'apps/docs/lib'), { recursive: true });
    writeFileSync(join(dir2, 'apps/docs/lib/i18n.ts'), I18N_FIXTURE);
    for (const [name, body] of Object.entries(BASE_CONTENT)) {
      const p = join(dir2, 'content/docs', name);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, `${body}\n`);
    }
    for (const [file, bytes] of [
      [SITEMAP_FILE, sitemapXml(BASE_URLS)],
      [LLMS_INDEX_FILE, llmsIndex(BASE_TITLES)],
      [LLMS_FULL_FILE, llmsFull(BASE_TITLES)],
    ]) {
      const p = join(dir2, file);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, bytes);
    }

    const collected = collect(dir2);
    const { perLocale } = evaluate(collected);
    const want = { en: 3, 'zh-Hans': 0, ja: 1 };
    const ok = JSON.stringify(perLocale) === JSON.stringify(want);
    if (!ok) failed += 1;
    console.log(
      `${ok ? '✓' : '✗'} per-locale tally ${JSON.stringify(perLocale)}` +
        (ok ? '' : `  expected ${JSON.stringify(want)}`),
    );

    // The other oracle's arithmetic, asserted the same way. `Home`, `Guide` and
    // `Deep` are English-only; `ガイド` is Japanese-only; `zh-Hans` has no page
    // and therefore no exclusive title. A bug that quietly emptied these sets
    // would leave every `llms` comparison trivially satisfiable.
    const exclusive = Object.fromEntries(
      [...collected.surface.exclusiveTitles].map(([lang, titles]) => [lang, [...titles.keys()].sort()]),
    );
    const wantExclusive = { en: ['Deep', 'Guide', 'Home'], 'zh-Hans': [], ja: ['ガイド'] };
    const exclusiveOk = JSON.stringify(exclusive) === JSON.stringify(wantExclusive);
    if (!exclusiveOk) failed += 1;
    console.log(
      `${exclusiveOk ? '✓' : '✗'} locale-exclusive titles ${JSON.stringify(exclusive)}` +
        (exclusiveOk ? '' : `  expected ${JSON.stringify(wantExclusive)}`),
    );
  } finally {
    rmSync(dir2, { recursive: true, force: true });
  }

  // A locale list this gate cannot read is a gate that cannot measure. It must
  // throw rather than fall back to a guess.
  for (const [name, body] of [
    ['no languages[]', "export const i18n = defineI18n({ defaultLanguage: 'en' });"],
    ['no defaultLanguage', "export const i18n = defineI18n({ languages: ['en', 'ja'] });"],
    ['default not in list', "export const i18n = defineI18n({ defaultLanguage: 'xx', languages: ['en'] });"],
  ]) {
    const d = mkdtempSync(join(tmpdir(), 'locale-surface-i18n-'));
    let threw = false;
    try {
      mkdirSync(join(d, 'apps/docs/lib'), { recursive: true });
      writeFileSync(join(d, 'apps/docs/lib/i18n.ts'), body);
      try {
        collect(d);
      } catch {
        threw = true;
      }
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
    if (!threw) failed += 1;
    console.log(`${threw ? '✓' : '✗'} unreadable i18n.ts rejected: ${name}`);
  }

  console.log('');
  const covered = new Set(CASES.flatMap((c) => c.expect));
  for (const rule of RULES) {
    if (!covered.has(rule)) {
      console.error(`✗ rule "${rule}" has no fixture that trips it`);
      failed += 1;
    }
  }

  // Rule coverage alone stopped being enough once one rule could fire for any
  // of three artifacts: `unexpected-locale-title` being covered says nothing
  // about whether `llms.txt`'s reader has ever produced a finding. This card
  // exists because an artifact nobody asserted looked exactly like an artifact
  // that was fine, so the per-artifact form of the same question is the one
  // worth asking — a new ARTIFACTS entry with no red fixture fails here.
  for (const { id } of ARTIFACTS) {
    if (!exercised.has(id)) {
      console.error(
        `✗ artifact "${id}" is in ARTIFACTS but no fixture ever drove it red on its own ` +
          'content — add a case that mutates its body, not just one that omits the file',
      );
      failed += 1;
    }
  }

  if (failed) {
    console.error(`\n✗ self-test: ${failed} case(s) did not behave as declared`);
    process.exit(1);
  }
  console.log(
    `✓ self-test: ${CASES.length} case(s) over ${RULES.length} rule(s) and ${ARTIFACTS.length} ` +
      'artifact(s) — every rule demonstrated able to fail and every artifact demonstrated ' +
      'able to fail it, on fixtures read through the real readers',
  );
}

function main() {
  if (process.argv.slice(2).some((a) => a === '--self-test')) return selfTest();
  return gate();
}

main();
