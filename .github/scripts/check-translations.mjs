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
 * ## Usage
 *
 *   node .github/scripts/check-translations.mjs                  # PR gate + report
 *   node .github/scripts/check-translations.mjs --gate=release --require=zh-Hans
 *   node .github/scripts/check-translations.mjs --worklist       # JSON work items
 *   node .github/scripts/check-translations.mjs --stamp <file>   # stamp one translation
 *   node .github/scripts/check-translations.mjs --baseline       # one-time backfill
 *
 * No dependencies, no network, no credentials — it must be runnable on a fork
 * PR and by anyone with a checkout.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

function survey() {
  const all = walk(DOCS);
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
    const current = shaOf(en);
    if (stamp.source_sha !== current) {
      stale.push({ en: rel(en), out: rel(t), locale: l, mode: stamp.mode ?? 'auto' });
    } else if (!Number.isFinite(stamp.guide_rev) || stamp.guide_rev < GUIDE_REV) {
      guideStale.push({ en: rel(en), out: rel(t), locale: l, mode: stamp.mode ?? 'auto' });
    }
  }

  for (const en of english) {
    for (const l of LOCALES) {
      if (!existsSync(siblingOf(en, l))) {
        missing.push({ en: rel(en), out: rel(siblingOf(en, l)), locale: l, mode: 'auto' });
      }
    }
  }

  return { english, translated, unstamped, orphan, stale, guideStale, missing };
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
  for (const l of LOCALES) lines.push(`| ${l} | ${st[l]} | ${mi[l]} | ${gs[l]} |`);
  lines.push('');
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
    const work = [...s.stale, ...s.missing, ...s.guideStale].filter((w) => w.mode !== 'reviewed');
    console.log(JSON.stringify(work, null, 2));
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

main();
