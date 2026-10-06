#!/usr/bin/env node
/**
 * The search gate for objectos#296: the BUILT `/api/search` route answers in
 * every locale `apps/docs/lib/i18n.ts` declares.
 *
 * `createFromSource` builds one Orama index per locale and picks each one's
 * tokenizer from the locale code. Orama has no tokenizer for `zh-Hans`,
 * `zh-Hant`, `ja` or `ko`, so those four indexes threw `LANGUAGE_NOT_SUPPORTED`
 * and the route answered 500. Type-check, build and every other gate passed:
 * the route is dynamic, so the build output records nothing about it, and the
 * search dialog shows a 500 as an empty list. Only a request finds it.
 *
 * So this gate makes the requests. It loads the route handler out of
 * `apps/docs/.next/` and calls its `GET` in-process, in each locale:
 *
 *   - `threw`, `status`, `not-array`: the handler must resolve to a 200 with
 *     a JSON array. A handler that throws is what Next serves as a 500.
 *   - `no-results`: `permissions`, the query #296's audit used, must find
 *     something.
 *   - `own-title-missed`: every page that has a source file in the locale
 *     (`foo.ja.mdx`; for English, `foo.mdx`) must be found by its own title.
 *     That is what proves the locale's script is tokenized at all. English
 *     fallback pages make `permissions` match in every locale, and Orama's
 *     English tokenizer drops every CJK character, so a Chinese title would
 *     find nothing.
 *   - `own-title-buried`: and found among the first three pages, not just
 *     somewhere in the list (#301). Before the route weighted titles, a page's
 *     title and another page's heading reading the same word scored the same,
 *     and 49 of the 79 English pages did not come first for their own title.
 *     Three and not one, because a few pages share a title (Approvals,
 *     Dashboards and Notifications each appear twice) and only one of two
 *     can be first.
 *   - `negative-control-passed`: a query no page contains must find nothing.
 *     It runs against the same handler in the same run. If it finds
 *     something, `no-results` cannot fire, so the run fails.
 *
 * The locale list and the pages come from `i18n.ts` and `content/docs/`, read
 * as text, and not from app code: the gate must be able to go red when app
 * code is wrong. Run it after `pnpm turbo run build`, because a missing build
 * fails it. `--self-test` runs every rule against fake handlers and needs no
 * build.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ROUTE = 'apps/docs/.next/server/app/api/search/route.js';
const QUERY = 'permissions';
const NONCE = 'qzxvjwkq'; // in no page; prefix matching cannot reach a real word from it

const TOP = 3; // `own-title-buried`: how far down its own title may rank a page

const RULES = ['threw', 'status', 'not-array', 'no-results', 'own-title-missed', 'own-title-buried', 'negative-control-passed'];

/** `languages` and `defaultLanguage` out of `i18n.ts`. Throws rather than guessing. */
function readI18n(text) {
  const list = /languages:\s*\[([^\]]+)\]/.exec(text)?.[1];
  const languages = list?.split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean) ?? [];
  const defaultLanguage = /defaultLanguage:\s*['"]([^'"]+)['"]/.exec(text)?.[1];
  if (!languages.length || !languages.includes(defaultLanguage)) {
    throw new Error('could not read languages[] and defaultLanguage out of apps/docs/lib/i18n.ts');
  }
  return { languages, defaultLanguage };
}

/** locale → the pages with a source file in that locale, as `{ file, title, url }`. */
function readPages(root, { languages, defaultLanguage }) {
  const docs = join(root, 'content/docs');
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.mdx') ? [join(dir, e.name)] : [],
    );
  const pages = new Map(languages.map((l) => [l, []]));
  for (const path of walk(docs).sort()) {
    const file = relative(docs, path).split('\\').join('/');
    const locale = languages.find((l) => l !== defaultLanguage && file.endsWith(`.${l}.mdx`)) ?? defaultLanguage;
    const segments = file.slice(0, -(locale === defaultLanguage ? '.mdx' : `.${locale}.mdx`).length).split('/');
    if (segments.at(-1) === 'index') segments.pop();
    const head = readFileSync(path, 'utf8').split(/\r?\n---/)[0];
    const title = /^title:\s*(.+)$/m.exec(head)?.[1].trim().replace(/^(['"])(.*)\1$/, '$2');
    const prefix = locale === defaultLanguage ? '' : `/${locale}`;
    if (title) pages.get(locale).push({ file, title, url: [`${prefix}/docs`, ...segments].join('/') });
  }
  return pages;
}

/** One request. A rejection is recorded, because Next turns it into a 500. */
async function ask(GET, locale, query) {
  const url = `http://localhost/api/search?locale=${encodeURIComponent(locale)}&query=${encodeURIComponent(query)}`;
  try {
    const res = await GET(new Request(url));
    return { status: res.status, body: await res.json().catch(() => undefined) };
  } catch (err) {
    return { threw: err?.code ?? String(err?.message ?? err).split('\n')[0] };
  }
}

/** The rule a response breaks before its hits can be judged, or undefined. */
function shape(r) {
  if (r.threw) return ['threw', `the handler threw ${r.threw}, which Next serves as a 500`];
  if (r.status !== 200) return ['status', `HTTP ${r.status}`];
  if (!Array.isArray(r.body)) return ['not-array', 'the body is not a JSON array'];
}

async function evaluate(GET, languages, pages) {
  const findings = [];
  const lines = [];
  const add = (rule, locale, detail) => findings.push({ rule, locale, detail });
  for (const locale of languages) {
    const probe = await ask(GET, locale, QUERY);
    const bad = shape(probe);
    if (bad) {
      add(bad[0], locale, `?query=${QUERY}: ${bad[1]}`);
      continue;
    }
    if (probe.body.length === 0) add('no-results', locale, `?query=${QUERY} found nothing`);
    const own = pages.get(locale) ?? [];
    let found = 0;
    let first = 0;
    for (const page of own) {
      const r = await ask(GET, locale, page.title);
      const broke = shape(r);
      if (broke) {
        add(broke[0], locale, `?query=${JSON.stringify(page.title)}: ${broke[1]}`);
        continue;
      }
      const rank = r.body.filter((hit) => hit.type === 'page').findIndex((hit) => hit.url === page.url) + 1;
      if (rank === 0) add('own-title-missed', locale, `${page.file}: its title ${JSON.stringify(page.title)} does not find ${page.url} (${r.body.length} hits)`);
      else if (rank > TOP) add('own-title-buried', locale, `${page.file}: its title ${JSON.stringify(page.title)} ranks ${page.url} page ${rank}, below the first ${TOP}`);
      if (rank > 0) found += 1;
      if (rank === 1) first += 1;
    }
    const control = await ask(GET, locale, NONCE);
    if (!shape(control) && control.body.length > 0) {
      add('negative-control-passed', locale, `?query=${NONCE} matches no page yet found ${control.body.length} hits, so no-results cannot fire`);
    }
    lines.push(`  ${locale}: 200, ${probe.body.length} hits for "${QUERY}", ${found}/${own.length} own pages found by title, ${first} of them first`);
  }
  return { findings, lines };
}

async function gate() {
  const route = join(ROOT, ROUTE);
  if (!existsSync(route)) {
    console.error(`✗ search locales: ${ROUTE} does not exist. Run pnpm turbo run build first.`);
    return 1;
  }
  const { languages, defaultLanguage } = readI18n(readFileSync(join(ROOT, 'apps/docs/lib/i18n.ts'), 'utf8'));
  const pages = readPages(ROOT, { languages, defaultLanguage });
  const GET = (await createRequire(import.meta.url)(route))?.routeModule?.userland?.GET;
  if (typeof GET !== 'function') {
    console.error(`✗ search locales: ${ROUTE} exposes no routeModule.userland.GET, so nothing was measured.`);
    return 1;
  }
  const { findings, lines } = await evaluate(GET, languages, pages);
  for (const f of findings) console.error(`  (${f.rule}) ${f.locale} ${f.detail}`);
  if (findings.length) {
    console.error(`\n✗ search locales: ${findings.length} finding(s). The rules are in this script's header.`);
    return 1;
  }
  console.log(lines.join('\n'));
  console.log(`✓ search locales: all ${languages.length} locales answer 200, find "${QUERY}", find every own page by its title within the first ${TOP} pages, and find nothing for a nonce`);
  return 0;
}

/* Self-test: one clean fake handler, then one fake per rule that must break exactly that rule. */
const LANGS = ['en', 'ja'];
const PAGES = new Map([
  ['en', [{ file: 'a.mdx', title: 'Alpha', url: '/docs/a' }]],
  ['ja', [{ file: 'a.ja.mdx', title: '権限', url: '/ja/docs/a' }]],
]);
const others = (n) => Array.from({ length: n }, (_, i) => ({ type: 'page', url: `/docs/other-${i}` }));
const json = (body, status = 200) => Response.json(body, { status });
/** A handler that finds a page by its exact title, and finds `permissions` everywhere. */
const good = (override = () => undefined) => async (req) => {
  const p = new URL(req.url).searchParams;
  const [locale, q] = [p.get('locale'), p.get('query')];
  const changed = await override(locale, q);
  if (changed !== undefined) return changed;
  if (q === QUERY) return json([{ type: 'page', url: '/docs/anything' }]);
  const page = PAGES.get(locale)?.find((x) => x.title === q);
  return json(page ? [{ type: 'page', url: page.url }] : []);
};
const CASES = [
  ['clean', good(), []],
  ['ja throws, as an unsupported language does', good((l) => { if (l === 'ja') throw Object.assign(new Error('x'), { code: 'LANGUAGE_NOT_SUPPORTED' }); }), ['threw']],
  ['ja answers 500', good((l) => (l === 'ja' ? json({}, 500) : undefined)), ['status']],
  ['ja answers an object', good((l) => (l === 'ja' ? json({ hits: [] }) : undefined)), ['not-array']],
  ['nothing finds permissions', good((l, q) => (q === QUERY ? json([]) : undefined)), ['no-results', 'no-results']],
  ['ja titles find nothing, as an English tokenizer would', good((l, q) => (l === 'ja' && q !== QUERY ? json([]) : undefined)), ['own-title-missed']],
  ['a hit under a heading is not the page', good((l, q) => (l === 'en' && q === 'Alpha' ? json([{ type: 'heading', url: '/docs/a' }]) : undefined)), ['own-title-missed']],
  ['a page third for its own title is found', good((l, q) => (l === 'en' && q === 'Alpha' ? json([...others(TOP - 1), { type: 'page', url: '/docs/a' }]) : undefined)), []],
  ['a page fourth for its own title is buried', good((l, q) => (l === 'en' && q === 'Alpha' ? json([...others(TOP), { type: 'page', url: '/docs/a' }]) : undefined)), ['own-title-buried']],
  ['headings above it do not bury a page', good((l, q) => (l === 'en' && q === 'Alpha' ? json([{ type: 'heading', url: '/docs/x#a' }, { type: 'heading', url: '/docs/x#b' }, { type: 'text', url: '/docs/x' }, { type: 'page', url: '/docs/a' }]) : undefined)), []],
  ['every query matches', good(() => json([{ type: 'page', url: '/docs/a' }, { type: 'page', url: '/ja/docs/a' }])), ['negative-control-passed', 'negative-control-passed']],
];

async function selfTest() {
  let failed = 0;
  const fired = new Set();
  for (const [name, GET, want] of CASES) {
    const got = (await evaluate(GET, LANGS, PAGES)).findings.map((f) => f.rule).sort();
    got.forEach((r) => fired.add(r));
    const ok = JSON.stringify(got) === JSON.stringify([...want].sort());
    if (!ok) failed += 1;
    console.log(`${ok ? '✓' : '✗'} ${name}: ${got.length ? got.join(', ') : 'no findings'}`);
  }
  const silent = RULES.filter((r) => !fired.has(r));
  if (silent.length) {
    failed += 1;
    console.log(`✗ rules no fixture makes fire: ${silent.join(', ')}`);
  }
  const i18n = readI18n("defineI18n({ defaultLanguage: 'en', languages: ['en', 'zh-Hans'] })");
  const i18nOk = i18n.defaultLanguage === 'en' && i18n.languages.join() === 'en,zh-Hans';
  let unreadable = false;
  try {
    readI18n('defineI18n({})');
  } catch {
    unreadable = true;
  }
  if (!i18nOk || !unreadable) failed += 1;
  console.log(`${i18nOk ? '✓' : '✗'} i18n.ts is read; ${unreadable ? '✓' : '✗'} an unreadable one is rejected`);
  console.log(failed ? `\n✗ search locales self-test: ${failed} failure(s)` : `\n✓ search locales self-test: ${CASES.length} cases, all ${RULES.length} rules can fire`);
  return failed ? 1 : 0;
}

process.exitCode = process.argv.includes('--self-test') ? await selfTest() : await gate();
