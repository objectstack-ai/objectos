#!/usr/bin/env node
/**
 * Translation freshness gate and worklist for `content/docs/`.
 *
 * English is the only authored language. Every `*.<locale>.mdx` file is a
 * derived artifact, and each one records which English revision it was
 * derived from:
 *
 *     ---
 *     title: ...
 *     translation:
 *       source_sha: <sha256 of the English sibling, raw bytes>
 *       guide_rev: <GUIDE_REV the translation was produced under>
 *       mode: auto | reviewed
 *     ---
 *
 * That stamp is what makes staleness DETECTABLE. Without it a translation
 * that no longer matches its English source is indistinguishable from one
 * that does — and a stale translation is worse than a missing one: a missing
 * translation renders correct English (Fumadocs falls back), while a stale
 * one renders content the English source no longer claims.
 *
 * ## Verdicts
 *
 *   unstamped   locale file with no `translation:` block — provenance unknown,
 *               so freshness cannot be judged at all. BLOCKING.
 *   orphan      locale file whose English sibling is gone. It can never be
 *               reached and can never be refreshed. BLOCKING.
 *   stale       recorded source_sha != current English sha. REPORTED on PRs,
 *               BLOCKING at release for `--require` locales.
 *   guide-stale recorded guide_rev < GUIDE_REV. Reported; work, not a defect.
 *   missing     English page with no sibling in a locale. Reported only —
 *               shipping translations incrementally is expected.
 *
 * `stale` is deliberately NOT blocking on pull requests. The whole point of
 * English-first is that an English edit lands on its own; forcing the author
 * to also produce six translations is the cost this design exists to remove.
 * Translations catch up in a separate pass — see `docs/TRANSLATION.md`.
 *
 * ## Derived locales are not translation work
 *
 * `zh-Hant` is generated from its `zh-Hans` sibling by
 * `apps/docs/scripts/gen-zh-hant.mjs` and committed — never translated from
 * English, never hand-written (`DERIVED_FROM` in `./lib/derived-locales.mjs`).
 *
 * Every verdict above except `unstamped` and `orphan` describes TRANSLATION
 * work: a page a pass should produce or refresh. None of them can describe a
 * derived locale, because no pass may write one. So `stale`, `missing` and
 * `guide-stale` are scoped to translated locales, and with them the
 * `--worklist` that is built from those three buckets — `docs/TRANSLATION.md`
 * calls the worklist "the entire input to a pass", and an item on it is an
 * instruction to translate. Emitting `en → zh-Hant` items asked the pass for a
 * second, divergent Chinese voice on a page that already has one: output the
 * generator overwrites and `gen-zh-hant.mjs --check` rejects in the meantime.
 *
 * `unstamped` and `orphan` deliberately stay in scope for derived locales.
 * They are not work items, they are defects in a file that exists: a Traditional
 * page whose English source was retired is unreachable and must be pruned, and
 * one with no `translation:` block has unknown provenance. Both are the
 * generator's failure to prune or stamp, and both still block. Scoping them out
 * along with the work verdicts would have been the quiet half of this bug.
 *
 * The freshness of the CONVERSION itself — that the Traditional bytes match
 * what the converter produces from the current Simplified page — is not this
 * script's question at all. `gen-zh-hant.mjs --check` owns it in CI and answers
 * it byte for byte, which is strictly stronger than anything a stamp can say.
 *
 * ## Usage
 *
 *   node .github/scripts/check-translations.mjs                  # PR gate + report
 *   node .github/scripts/check-translations.mjs --gate=release --require=zh-Hans
 *   node .github/scripts/check-translations.mjs --worklist       # JSON work items
 *   node .github/scripts/check-translations.mjs --stamp <file>   # stamp one translation
 *   node .github/scripts/check-translations.mjs --baseline       # one-time backfill
 *   node .github/scripts/check-translations.mjs --self-test      # prove the scoping can fail
 *
 * No dependencies, no network, no credentials — it must be runnable on a fork
 * PR and by anyone with a checkout.
 */
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DERIVED_FROM, isDerived } from './lib/derived-locales.mjs';

/**
 * Bump when a change to `docs/TRANSLATION.md` invalidates existing output
 * (a changed term in the glossary, a changed rule about what not to translate).
 * Deliberately a constant rather than a hash of the guide: a typo fix in the
 * guide should not mark 256 files for retranslation.
 */
const GUIDE_REV = 1;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const DOCS = join(ROOT, 'content/docs');
const I18N = join(ROOT, 'apps/docs/lib/i18n.ts');

/** Never-matching sentinel: a translation whose provenance git could not recover. */
const UNKNOWN_SHA = '0'.repeat(64);

/**
 * Locales come from `apps/docs/lib/i18n.ts`, which AGENTS.md names as the
 * authority. Reading it here means adding a locale there cannot leave this
 * gate silently blind to it.
 */
function locales() {
  const m = readFileSync(I18N, 'utf8').match(/languages:\s*\[([^\]]+)\]/);
  if (!m) throw new Error(`could not parse languages[] out of ${relative(ROOT, I18N)}`);
  const all = m[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
  const rest = all.filter((l) => l !== 'en');
  if (rest.length === 0) throw new Error('no non-default locales declared');
  return rest;
}

const LOCALES = locales();

/**
 * Locales a translation pass may write. Derived locales (`DERIVED_FROM`) are
 * generated from another locale, so they are excluded from every verdict that
 * describes work — see the header. `LOCALES` stays whole: `localeOf()` must
 * still RECOGNISE a derived file, or its orphan and unstamped defects become
 * invisible instead of merely unactionable.
 */
const TRANSLATED_LOCALES = LOCALES.filter((l) => !isDerived(l));

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.mdx')) out.push(p);
  }
  return out;
}

const localeOf = (f) => LOCALES.find((l) => f.endsWith(`.${l}.mdx`)) ?? null;
const englishOf = (f, l) => `${f.slice(0, -`.${l}.mdx`.length)}.mdx`;
const siblingOf = (en, l) => `${en.slice(0, -'.mdx'.length)}.${l}.mdx`;
const shaOf = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const rel = (p) => relative(ROOT, p);

/** Frontmatter is read as raw text — a YAML dependency would break the zero-dep rule. */
function readStamp(path) {
  const fm = readFileSync(path, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const block = fm[1];
  if (!/^translation:[ \t]*$/m.test(block)) return null;
  return {
    source_sha: block.match(/^[ \t]+source_sha:[ \t]*([0-9a-f]{64})[ \t]*$/m)?.[1] ?? null,
    guide_rev: Number(block.match(/^[ \t]+guide_rev:[ \t]*(\d+)[ \t]*$/m)?.[1] ?? NaN),
    mode: block.match(/^[ \t]+mode:[ \t]*(auto|reviewed)[ \t]*$/m)?.[1] ?? null,
  };
}

function writeStamp(path, { source_sha, guide_rev, mode }) {
  const text = readFileSync(path, 'utf8');
  const m = text.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!m) throw new Error(`${rel(path)}: no frontmatter block to stamp`);
  const body = m[2]
    .replace(/^translation:[ \t]*\r?\n(?:[ \t]+\S[^\n]*\r?\n?)*/m, '')
    .replace(/\s*$/, '');
  const stamp = `\ntranslation:\n  source_sha: ${source_sha}\n  guide_rev: ${guide_rev}\n  mode: ${mode}`;
  writeFileSync(path, m[1] + body + stamp + m[3] + text.slice(m[0].length));
}

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });

/**
 * Recover which English revision a translation was derived from, for files
 * that predate the stamp. If the English sibling has not changed since the
 * translation's last commit, the translation matches HEAD's English. Otherwise
 * it matches the English as of that commit — which makes it stale, truthfully.
 */
function provenanceFromGit(localeFile, enFile) {
  const lastT = git('log', '-1', '--format=%H', '--', rel(localeFile)).trim();
  if (!lastT) return UNKNOWN_SHA;
  const changedSince = git('log', '--oneline', `${lastT}..HEAD`, '--', rel(enFile)).trim();
  if (!changedSince) return shaOf(enFile);
  try {
    const blob = execFileSync('git', ['show', `${lastT}:${rel(enFile)}`], {
      cwd: ROOT,
      maxBuffer: 1 << 28,
    });
    return createHash('sha256').update(blob).digest('hex');
  } catch {
    return UNKNOWN_SHA;
  }
}

/**
 * `docs` and `derived` are injectable so the self-test can drive this against a
 * fixture tree, and — the point of the red fixture — against an EMPTY derived
 * map, which is what this script did before the scoping existed. A rule that
 * has never been seen to fail is not known to work.
 */
function survey({ docs = DOCS, derived = DERIVED_FROM } = {}) {
  /** Locales a pass may actually write. See `TRANSLATED_LOCALES`. */
  const workLocales = LOCALES.filter((l) => !isDerived(l, derived));
  const all = walk(docs);
  const english = all.filter((f) => !localeOf(f)).sort();
  const translated = all.filter((f) => localeOf(f)).sort();

  const unstamped = [];
  const orphan = [];
  const stale = [];
  const guideStale = [];
  const missing = [];

  for (const t of translated) {
    const l = localeOf(t);
    const en = englishOf(t, l);
    if (!existsSync(en)) {
      orphan.push({ file: rel(t), locale: l });
      continue;
    }
    const stamp = readStamp(t);
    if (!stamp?.source_sha) {
      unstamped.push({ file: rel(t), locale: l });
      continue;
    }
    /**
     * A derived locale stops here. `orphan` and `unstamped` above are defects
     * in a file that exists and still block; `stale` and `guide-stale` below
     * are work verdicts, and no pass may write this file — the generator does.
     * Whether the CONVERSION is current is `gen-zh-hant.mjs --check`'s
     * question, answered byte for byte rather than by a carried-over stamp.
     */
    if (isDerived(l, derived)) continue;
    const current = shaOf(en);
    if (stamp.source_sha !== current) {
      stale.push({ en: rel(en), out: rel(t), locale: l, mode: stamp.mode ?? 'auto' });
    } else if (!Number.isFinite(stamp.guide_rev) || stamp.guide_rev < GUIDE_REV) {
      guideStale.push({ en: rel(en), out: rel(t), locale: l, mode: stamp.mode ?? 'auto' });
    }
  }

  for (const en of english) {
    // `workLocales`, not `LOCALES`: a Traditional page is never missing in a
    // way anyone can act on. It appears when the generator is run over a
    // Simplified sibling that exists, so the actionable row is the zh-Hans one.
    for (const l of workLocales) {
      if (!existsSync(siblingOf(en, l))) {
        missing.push({ en: rel(en), out: rel(siblingOf(en, l)), locale: l, mode: 'auto' });
      }
    }
  }

  return { english, translated, unstamped, orphan, stale, guideStale, missing, workLocales };
}

/**
 * The entire input to a translation pass (`docs/TRANSLATION.md`). Built from
 * the three work buckets, which `survey()` has already scoped to translated
 * locales — one exclusion point, so the worklist and the report columns can
 * never disagree about what a pass is allowed to write.
 */
const worklistOf = (s) =>
  [...s.stale, ...s.missing, ...s.guideStale].filter((w) => w.mode !== 'reviewed');

/**
 * Why `--gate=release --require=zh-Hant` is an ERROR and not a no-op: a derived
 * locale carries no `stale` or `missing` rows by construction, so requiring one
 * would pass VACUOUSLY. A release gate that cannot go red is worse than no gate
 * at all, because someone is relying on it. Returns the message, or `null`.
 */
function derivedRequireError(required, derived = DERIVED_FROM) {
  const named = required.filter((l) => isDerived(l, derived));
  if (!named.length) return null;
  const sources = [...new Set(named.map((l) => derived[l]))];
  return (
    `--require names derived locale(s): ${named
      .map((l) => `${l} (generated from ${derived[l]})`)
      .join(', ')} — these carry no stale/missing rows, so requiring them would ` +
    `pass vacuously. Require ${sources.join(', ')} instead; the generated output ` +
    'is gated separately by `gen-zh-hant.mjs --check`.'
  );
}

function countByLocale(items) {
  const by = Object.fromEntries(LOCALES.map((l) => [l, 0]));
  for (const i of items) by[i.locale] = (by[i.locale] ?? 0) + 1;
  return by;
}

function report(s) {
  const lines = ['## Translation status', ''];
  lines.push(`English pages: **${s.english.length}** · translations: **${s.translated.length}** · guide rev **${GUIDE_REV}**`, '');
  lines.push('| Locale | Stale | Missing | Guide-stale |', '|:--|--:|--:|--:|');
  const st = countByLocale(s.stale);
  const mi = countByLocale(s.missing);
  const gs = countByLocale(s.guideStale);
  /**
   * Derived locales get dashes, not zeroes, and are not dropped from the table.
   * A zero would read as "nothing to do here", which is true by accident and
   * would become a lie the moment the generator stopped being run; an absent
   * row would hide that the locale ships at all. A dash says the question does
   * not apply, and the footnote says which gate does ask it.
   */
  for (const l of LOCALES) {
    lines.push(isDerived(l) ? `| ${l} | — | — | — |` : `| ${l} | ${st[l]} | ${mi[l]} | ${gs[l]} |`);
  }
  lines.push('');
  const derivedRows = LOCALES.filter((l) => isDerived(l));
  if (derivedRows.length) {
    lines.push(
      `— = generated, not translated: ${derivedRows
        .map((l) => `\`${l}\` from \`${DERIVED_FROM[l]}\``)
        .join(', ')}. No pass writes these; ` +
        '`apps/docs/scripts/gen-zh-hant.mjs --check` gates them byte for byte in CI.',
      '',
    );
  }
  if (s.unstamped.length) {
    lines.push(`### ⛔ Unstamped (${s.unstamped.length})`, '');
    lines.push('Provenance unknown — freshness cannot be judged. Run `--baseline`.', '');
    for (const u of s.unstamped.slice(0, 20)) lines.push(`- \`${u.file}\``);
    if (s.unstamped.length > 20) lines.push(`- …and ${s.unstamped.length - 20} more`);
    lines.push('');
  }
  if (s.orphan.length) {
    lines.push(`### ⛔ Orphaned (${s.orphan.length})`, '');
    lines.push('The English source is gone; delete these.', '');
    for (const o of s.orphan) lines.push(`- \`${o.file}\``);
    lines.push('');
  }
  if (s.stale.length) {
    lines.push('<details><summary>Stale translations</summary>', '');
    for (const x of s.stale) lines.push(`- \`${x.out}\`${x.mode === 'reviewed' ? ' _(reviewed — needs a human)_' : ''}`);
    lines.push('', '</details>', '');
  }
  return lines.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  const has = (name) => argv.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));

  // Before any corpus work: the self-test drives fixture trees, never `DOCS`.
  if (has('self-test')) return selfTest();

  if (has('stamp')) {
    const target = arg('stamp') ?? argv[argv.indexOf('--stamp') + 1];
    if (!target) throw new Error('--stamp needs a file');
    const path = resolve(ROOT, target);
    const l = localeOf(path);
    if (!l) throw new Error(`${target} is not a locale file`);
    const en = englishOf(path, l);
    if (!existsSync(en)) throw new Error(`${target}: English sibling ${rel(en)} does not exist`);
    const mode = readStamp(path)?.mode ?? 'auto';
    writeStamp(path, { source_sha: shaOf(en), guide_rev: GUIDE_REV, mode });
    console.log(`stamped ${rel(path)} → ${shaOf(en).slice(0, 12)} (mode: ${mode})`);
    return;
  }

  if (has('baseline')) {
    let stamped = 0;
    let carriedStale = 0;
    for (const t of walk(DOCS).filter((f) => localeOf(f)).sort()) {
      const l = localeOf(t);
      const en = englishOf(t, l);
      if (!existsSync(en)) continue;
      const existing = readStamp(t);
      if (existing?.source_sha) continue;
      const source_sha = provenanceFromGit(t, en);
      writeStamp(t, { source_sha, guide_rev: GUIDE_REV, mode: 'auto' });
      stamped += 1;
      if (source_sha !== shaOf(en)) carriedStale += 1;
    }
    console.log(`baseline: stamped ${stamped} files (${carriedStale} recorded as already stale)`);
    return;
  }

  const s = survey();

  if (has('worklist')) {
    console.log(JSON.stringify(worklistOf(s), null, 2));
    return;
  }

  console.log(report(s));

  const blocking = [];
  if (s.unstamped.length) blocking.push(`${s.unstamped.length} unstamped translation(s)`);
  if (s.orphan.length) blocking.push(`${s.orphan.length} orphaned translation(s)`);

  if (arg('gate') === 'release') {
    const required = (arg('require') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    const unknown = required.filter((l) => !LOCALES.includes(l));
    if (unknown.length) throw new Error(`--require names unknown locale(s): ${unknown.join(', ')}`);
    const derivedProblem = derivedRequireError(required);
    if (derivedProblem) throw new Error(derivedProblem);
    for (const l of required) {
      const st = s.stale.filter((x) => x.locale === l).length;
      const mi = s.missing.filter((x) => x.locale === l).length;
      if (st || mi) blocking.push(`${l}: ${st} stale, ${mi} missing (release-required)`);
    }
  }

  if (blocking.length) {
    console.error(`\n✗ translations gate failed:\n  - ${blocking.join('\n  - ')}`);
    process.exit(1);
  }
  console.error('\n✓ translations gate passed');
}

/* ------------------------------------------------------------- self-test --
 * 裁决: a validator observed only green is indistinguishable from one that
 * cannot go red.
 *
 * The rule under test is a NEGATIVE — "no derived-locale item reaches the
 * worklist" — and a negative is the easy kind to pass by accident: a fixture
 * with no derived files at all, a typo in `DERIVED_FROM` that disables nothing,
 * a `walk()` that never reached the tree, all read as success. So every case
 * below is asserted against the SAME fixture tree surveyed twice: once with
 * `DERIVED_FROM`, and once with an empty map, which is exactly what this script
 * did before the scoping existed.
 *
 * That second run is the red fixture. It must EMIT the items the first run must
 * not, and the self-test fails if it does not — so a fixture that lost its
 * derived pages, or a scoping that silently stopped applying, cannot pass here.
 */

/** A 64-hex sha that matches no real file: makes a stamp deliberately stale. */
const NEVER_SHA = '1'.repeat(64);

const fixtureEnglish = (title) => `---\ntitle: ${title}\n---\n\nEnglish prose for ${title}.\n`;

const fixtureStamped = (title, sha, mode = 'auto') =>
  `---\ntitle: ${title}\ntranslation:\n  source_sha: ${sha}\n  guide_rev: ${GUIDE_REV}\n  mode: ${mode}\n---\n\nTranslated prose for ${title}.\n`;

const fixtureUnstamped = (title) => `---\ntitle: ${title}\n---\n\nTranslated prose for ${title}.\n`;

/**
 * A tree exercising every verdict on both a translated and a derived locale.
 * Written with the real `zh-Hant`/`zh-Hans` pair rather than invented tags so
 * that a `DERIVED_FROM` typo cannot make this pass while the corpus stays wrong.
 */
function buildFixture(dir) {
  const derivedLocale = Object.keys(DERIVED_FROM)[0];
  const sourceLocale = DERIVED_FROM[derivedLocale];
  const w = (name, body) => writeFileSync(join(dir, name), body);

  // Stale in both the source locale and the derived one: the derived page
  // carries the same carried-over stamp, which is what makes it LOOK like work.
  w('stale.mdx', fixtureEnglish('stale'));
  w(`stale.${sourceLocale}.mdx`, fixtureStamped('stale', NEVER_SHA));
  w(`stale.${derivedLocale}.mdx`, fixtureStamped('stale', NEVER_SHA));

  // English with no siblings at all: `missing` in every locale.
  w('uncovered.mdx', fixtureEnglish('uncovered'));

  // Derived file whose English source is gone: `orphan`, and still blocking.
  w(`gone.${derivedLocale}.mdx`, fixtureStamped('gone', NEVER_SHA));

  // Derived file with no `translation:` block: `unstamped`, still blocking.
  w('bare.mdx', fixtureEnglish('bare'));
  w(`bare.${sourceLocale}.mdx`, fixtureStamped('bare', shaOf(join(dir, 'bare.mdx'))));
  w(`bare.${derivedLocale}.mdx`, fixtureUnstamped('bare'));

  return { derivedLocale, sourceLocale };
}

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'check-translations-'));
  let failed = 0;
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? '✓' : '✗'} ${name.padEnd(64)}${detail}`);
    if (!ok) failed += 1;
  };

  try {
    const { derivedLocale, sourceLocale } = buildFixture(dir);

    // The map itself. A `DERIVED_FROM` entry naming a locale `i18n.ts` does not
    // declare is a typo that disables the exclusion without any other symptom.
    for (const [derived, from] of Object.entries(DERIVED_FROM)) {
      check(
        `DERIVED_FROM: "${derived}" and its source "${from}" are declared in i18n.ts`,
        LOCALES.includes(derived) && LOCALES.includes(from),
      );
      check(
        `DERIVED_FROM: "${derived}" is excluded from TRANSLATED_LOCALES`,
        !TRANSLATED_LOCALES.includes(derived) && TRANSLATED_LOCALES.includes(from),
      );
    }

    const scoped = survey({ docs: dir });
    const unscoped = survey({ docs: dir, derived: {} });
    const workOf = (s, l) => worklistOf(s).filter((w) => w.locale === l);

    // ---- the red fixture: without the scoping, these items ARE emitted ----
    const wouldEmit = workOf(unscoped, derivedLocale);
    check(
      `red fixture: without DERIVED_FROM the tree emits ${derivedLocale} work`,
      wouldEmit.length > 0,
      `emitted ${wouldEmit.length}`,
    );
    check(
      `red fixture: and they are the stale and missing items, not noise`,
      wouldEmit.some((w) => w.out.endsWith(`stale.${derivedLocale}.mdx`)) &&
        wouldEmit.some((w) => w.out.endsWith(`uncovered.${derivedLocale}.mdx`)),
    );

    // ---- the rule ----
    const emitted = workOf(scoped, derivedLocale);
    check(
      `worklist emits no ${derivedLocale} items`,
      emitted.length === 0,
      emitted.length ? `emitted ${JSON.stringify(emitted.map((w) => w.out))}` : '',
    );
    check(
      `${derivedLocale} absent from stale, missing and guide-stale`,
      ![...scoped.stale, ...scoped.missing, ...scoped.guideStale].some(
        (x) => x.locale === derivedLocale,
      ),
    );

    // ---- the exclusion did not over-reach ----
    check(
      `translated locale ${sourceLocale} is unaffected by the scoping`,
      JSON.stringify(workOf(scoped, sourceLocale)) ===
        JSON.stringify(workOf(unscoped, sourceLocale)) &&
        workOf(scoped, sourceLocale).length > 0,
    );
    check(
      'every other translated locale is unaffected too',
      TRANSLATED_LOCALES.every(
        (l) => JSON.stringify(workOf(scoped, l)) === JSON.stringify(workOf(unscoped, l)),
      ),
    );
    check(
      `a ${derivedLocale} orphan still BLOCKS`,
      scoped.orphan.some((o) => o.locale === derivedLocale && o.file.endsWith(`gone.${derivedLocale}.mdx`)),
    );
    check(
      `an unstamped ${derivedLocale} file still BLOCKS`,
      scoped.unstamped.some(
        (u) => u.locale === derivedLocale && u.file.endsWith(`bare.${derivedLocale}.mdx`),
      ),
    );

    // ---- the release gate cannot pass vacuously on a derived locale ----
    check(
      `--require=${derivedLocale} is rejected rather than passing vacuously`,
      (derivedRequireError([derivedLocale]) ?? '').includes(derivedLocale),
    );
    check(
      `--require=${sourceLocale} is still accepted`,
      derivedRequireError([sourceLocale]) === null,
    );

    // ---- the report tells the reader why the row is blank ----
    const table = report(scoped);
    check(
      `report shows ${derivedLocale} as generated, not as zero work`,
      table.includes(`| ${derivedLocale} | — | — | — |`) &&
        table.includes('generated, not translated'),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log('');
  if (failed) {
    console.error(`✗ self-test: ${failed} case(s) did not behave as declared`);
    process.exit(1);
  }
  console.log(
    `✓ self-test: derived-locale scoping holds for ${Object.keys(DERIVED_FROM).length} derived ` +
      `locale(s) over ${TRANSLATED_LOCALES.length} translated locale(s) — proven able to fail by ` +
      'surveying the same fixture tree with the exclusion removed',
  );
}

main();
