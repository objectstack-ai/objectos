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
 * file is, how to read the advertised locale surface out of it, and what the
 * content tree says that surface should be. #184 adds `llms.txt` and
 * `llms-full.txt` here; this card deliberately ships only the sitemap.
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
  'unexpected-url',
  'missing-url',
  'duplicate-url',
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

    if (!pages.has(path)) pages.set(path, { locales: new Set(), files: new Map() });
    pages.get(path).locales.add(locale);
    pages.get(path).files.set(locale, rel(file));
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
 * The artifacts this gate asserts.
 *
 * `file` is relative to the repo root. The built output of a Next.js route
 * handler lands beside a `.meta` and the route module itself; the `.body` file
 * is the bytes actually served.
 *
 * #184 adds `apps/docs/.next/server/app/llms.txt.body` and `llms-full.txt.body`
 * here with their own `read` and `expected`; the harness needs no other change.
 */
const ARTIFACTS = [
  {
    id: 'sitemap.xml',
    file: 'apps/docs/.next/server/app/sitemap.xml.body',
    read: readSitemapUrls,
    expected: expectedSitemapUrls,
  },
];

/* ---------------------------------------------------------------- collect -- */

function collect(root) {
  const { languages, defaultLanguage } = readI18n(root);
  const { pages, orphans } = readDocsPages(root, { languages, defaultLanguage });
  const surface = { languages, defaultLanguage, pages, orphans };

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
        detail:
          `${spec.id}: ${rel(artifact.path)} exists but no entries could be read out of it — ` +
          'either the artifact is empty or its format changed and this reader is now silently ' +
          'returning nothing',
      });
      continue;
    }

    const expected = spec.expected(surface);
    const seen = new Map();
    for (const url of artifact.advertised) seen.set(url, (seen.get(url) ?? 0) + 1);

    for (const [url, count] of seen) {
      if (count > 1) {
        findings.push({
          rule: 'duplicate-url',
          detail: `${spec.id}: ${url} advertised ${count} times`,
        });
      }
    }

    const unexpected = [...seen.keys()].filter((u) => !expected.has(u)).sort();
    const missing = [...expected].filter((u) => !seen.has(u)).sort();

    for (const url of unexpected) {
      findings.push({
        rule: 'unexpected-url',
        detail:
          `${spec.id}: ${url} is advertised but the content tree has no source file for it — ` +
          'an untranslated page is being advertised as a translation',
      });
    }
    for (const url of missing) {
      findings.push({
        rule: 'missing-url',
        detail:
          `${spec.id}: ${url} has a source file in the content tree but is not advertised — ` +
          'a shipped translation is invisible to crawlers',
      });
    }

    artifact.report = {
      total: artifact.advertised.length,
      distinct: seen.size,
      expected: expected.size,
      unexpected: unexpected.length,
      missing: missing.length,
      duplicates: [...seen.values()].filter((c) => c > 1).length,
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

  console.log('| artifact | advertised | distinct | expected | unexpected | missing | duplicated |');
  console.log('|---|---:|---:|---:|---:|---:|---:|');
  for (const a of artifacts) {
    const r = a.report;
    console.log(
      r
        ? `| \`${a.spec.id}\` | ${r.total} | ${r.distinct} | ${r.expected} | ${r.unexpected} | ${r.missing} | ${r.duplicates} |`
        : `| \`${a.spec.id}\` | — | — | — | — | — | — |`,
    );
  }
  console.log('');

  if (findings.length === 0) {
    console.log('✓ every advertised URL has a source file, and every source file is advertised');
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

/** A page in every fixture tree: English plus a real Japanese translation. */
const BASE_CONTENT = {
  'index.mdx': '# Home',
  'guide.mdx': '# Guide',
  'guide.ja.mdx': '# ガイド',
  'deep/index.mdx': '# Deep',
};

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

const SITEMAP_FILE = ARTIFACTS[0].file;

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
    artifact: null,
    expect: ['artifact-missing'],
  },
  {
    // A format change that leaves the reader matching nothing must be a
    // failure, not a green over zero measurements.
    name: 'artifact present but unreadable',
    raw: '<?xml version="1.0"?>\n<urlset><url><location>https://docs.objectos.ai</location></url></urlset>\n',
    expect: ['artifact-empty'],
  },
  {
    // AGENTS.md forbids a translation-only file. Counting it would inflate the
    // oracle to agree with an artifact that is also wrong.
    name: 'translation with no English source',
    content: { ...BASE_CONTENT, 'orphan.ja.mdx': '# 孤児' },
    expect: ['translation-orphan'],
  },
];

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'locale-surface-'));
  let failed = 0;

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

      const artifact = 'artifact' in c ? c.artifact : (c.raw ?? sitemapXml(c.urls ?? BASE_URLS));
      if (artifact !== null) {
        const p = join(dir, SITEMAP_FILE);
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, artifact);
      }

      const { findings } = evaluate(collect(dir));
      const fired = [...new Set(findings.map((f) => f.rule))].sort();
      const want = [...c.expect].sort();
      const ok = fired.join(',') === want.join(',');
      if (!ok) failed += 1;
      console.log(
        `${ok ? '✓' : '✗'} ${c.name.padEnd(44)} fired [${fired.join(' ') || '—'}]` +
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
    const p = join(dir2, SITEMAP_FILE);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, sitemapXml(BASE_URLS));

    const { perLocale } = evaluate(collect(dir2));
    const want = { en: 3, 'zh-Hans': 0, ja: 1 };
    const ok = JSON.stringify(perLocale) === JSON.stringify(want);
    if (!ok) failed += 1;
    console.log(
      `${ok ? '✓' : '✗'} per-locale tally ${JSON.stringify(perLocale)}` +
        (ok ? '' : `  expected ${JSON.stringify(want)}`),
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

  if (failed) {
    console.error(`\n✗ self-test: ${failed} case(s) did not behave as declared`);
    process.exit(1);
  }
  console.log(
    `✓ self-test: ${CASES.length} case(s) over ${RULES.length} rule(s) — every rule ` +
      'demonstrated able to fail, on fixtures read through the real readers',
  );
}

function main() {
  if (process.argv.slice(2).some((a) => a === '--self-test')) return selfTest();
  return gate();
}

main();
