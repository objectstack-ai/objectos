#!/usr/bin/env node
/**
 * Translation output validator — the `docs/TRANSLATION.md` pre-PR checklist as
 * a machine rule.
 *
 * `check-translations.mjs` answers "was this derived from the current English?"
 * (provenance). This one answers the question a stamp cannot: "is what came
 * back actually a translation of that page?" A file can carry a perfectly
 * current `source_sha` and still have had its code samples repaired, its links
 * rewritten, or half its body dropped.
 *
 * The translation pass is a model with an editor, and its failure mode is not
 * malice but helpfulness — fixing a link it believes is broken, repairing a
 * code sample, restructuring a table while translating. That produces a diff
 * that reads like a translation and is not one. A prose checklist is the
 * weakest possible form of every rule below: it is checked by the same agent
 * that just decided the link was broken.
 *
 * ## Two weight classes
 *
 * `fence`, `url`, `frontmatter`, `component` and `length` are FIDELITY rules.
 * They catch a translation that stopped being one.
 *
 * `unsafe` is not in that class. The English MDX is authored by anyone who can
 * open a pull request, it is fed to a model, and the model's output is
 * committed to a public site. MDX compiles to JSX: a `<script` in prose is a
 * script tag on the rendered page, not a rendering of the characters. Text
 * inside a page is data to be translated, never an instruction to follow — but
 * a prompt saying so is a request, not a control. Refusing to commit output
 * that fails validation is the control. So `unsafe` is enforced over the whole
 * corpus, on English sources as well as translations, and it is never scoped
 * to a diff: a rule that only inspects changed files is defeated by ordering.
 *
 * ## When this runs, and why it is not scoped to translation PRs
 *
 * It runs on every pull request that touches `content/docs/**` — not only on
 * PRs from the translation account. Two measured reasons:
 *
 *   1. `check-translation-ownership.mjs` is inert until `TRANSLATION_BOT_LOGIN`
 *      is set, so a hand-edited locale file reaches `main` today. A validator
 *      that only ran on translation PRs would be blind to exactly the edits
 *      nothing else is currently catching.
 *   2. The whole corpus is 335 pages of text (79 English, 256 translations)
 *      with no dependencies to load. Scanning all of it costs milliseconds —
 *      `check-translations.mjs` already sha256s every one of them on every
 *      run. There is nothing to buy by scoping the scan.
 *
 * So the SCAN is always the whole corpus. What is scoped to the diff is which
 * findings BLOCK, mirroring the split `check-translations.mjs` already makes
 * between blocking (`unstamped`, `orphan`) and reported (`stale`, `missing`):
 *
 *   - `unsafe`   → blocking anywhere in the corpus, always.
 *   - fidelity   → blocking on the locale files this PR changed; reported
 *                  elsewhere.
 *
 * The reported half is not decoration. This corpus carries pre-existing
 * fidelity debt that predates the gate (see `--report`), and a gate born red
 * on files the PR did not touch is a gate someone switches off in a week.
 * Blocking the diff holds the line and shrinks the debt at translation-pass
 * speed instead of demanding one flag-day cleanup.
 *
 * ## Why fences are compared separately, and everything else excludes them
 *
 * `fence` compares fenced code blocks byte-for-byte. Every other rule then runs
 * on the prose OUTSIDE those fences. That decomposition is what keeps the
 * signals independent: one edited code sample produces one finding instead of
 * four, and a `<script` inside a fence is a code sample rendered as text, not a
 * script tag — flagging it would make the rule unusable on a site that
 * documents HTML. Nothing hides there: `fence` already pins fence content to
 * the English bytes, so a translation cannot introduce anything inside one
 * without failing `fence` first.
 *
 * ## Why `length` is calibrated per locale
 *
 * "Within ±40% of the English page" is not locale-neutral. Applied against 1.0
 * it fails 77 of the 256 translations on `main` today; calibrated it fails 12.
 * The 65 it stops accusing are not defects — a correct Simplified Chinese page
 * runs about 0.54x the character count of its English source and a correct
 * French one about 1.13x. Measured against the wrong band, the rule reports
 * that translating into Chinese is a defect, and everyone learns to ignore it.
 *
 * So the band is applied to the ratio NORMALIZED by each locale's measured
 * expansion factor (`LOCALE_EXPANSION`, recomputable with `--calibrate`). A
 * locale with no entry is reported as uncalibrated and skipped rather than
 * judged against 1.0: no band is better than a wrong one.
 *
 * ## Usage
 *
 *   node .github/scripts/check-translation-output.mjs               # gate whole corpus
 *   node .github/scripts/check-translation-output.mjs --files <l>   # block on changed files
 *   node .github/scripts/check-translation-output.mjs --report      # report only, never exit 1
 *   node .github/scripts/check-translation-output.mjs --self-test   # prove every rule can fail
 *   node .github/scripts/check-translation-output.mjs --calibrate   # recompute LOCALE_EXPANSION
 *
 * <l> is a file of changed paths, one per line (`git diff --name-only`).
 *
 * No dependencies, no network, no credentials — it has to run on a fork PR, and
 * a YAML or MDX parser here would make it unrunnable in the case it exists for.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const DOCS = join(ROOT, 'content/docs');
const I18N = join(ROOT, 'apps/docs/lib/i18n.ts');

/** Half-width of the length band, as a fraction of the locale's expected ratio. */
const LENGTH_TOLERANCE = 0.4;

/**
 * Measured character-count ratio (translated prose / English prose) that a
 * correct translation into each locale runs at. Produced by `--calibrate` as
 * the median over the corpus; recompute it when a locale's corpus grows enough
 * that the median moves. The locale LIST is never hardcoded — it comes from
 * `apps/docs/lib/i18n.ts` (AGENTS.md names it the authority) and a locale
 * missing from this table is reported uncalibrated, not judged.
 */
const LOCALE_EXPANSION = {
  'zh-Hans': 0.54,
  ja: 0.69,
  ko: 0.67,
  de: 1.10,
  es: 1.12,
  fr: 1.13,
};

function locales() {
  const m = readFileSync(I18N, 'utf8').match(/languages:\s*\[([^\]]+)\]/);
  if (!m) throw new Error(`could not parse languages[] out of ${relative(ROOT, I18N)}`);
  const rest = m[1]
    .split(',')
    .map((s) => s.trim().replace(/['"]/g, ''))
    .filter((l) => l && l !== 'en');
  if (rest.length === 0) throw new Error('no non-default locales declared');
  return rest;
}

const LOCALES = locales();
const rel = (p) => relative(ROOT, p);

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

/* ---------------------------------------------------------------- parsing --
 * All of it text-level and deliberately small. See the zero-dependency note in
 * the header: this has to run with nothing installed.
 */

/** Frontmatter block, raw, or null. */
const frontmatter = (text) => text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? null;

const stripFrontmatter = (text) => text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');

/** Top-level frontmatter keys, in file order. Indented lines are values. */
const topLevelKeys = (block) =>
  block
    .split('\n')
    .map((l) => l.match(/^([A-Za-z_][A-Za-z0-9_-]*)[ \t]*:/)?.[1])
    .filter(Boolean);

/**
 * Split a document into fenced code blocks and the prose around them. The
 * fence marker and info string are part of the compared text: a translated
 * ```bash is as much a defect as a translated comment inside it.
 */
function split(text) {
  const fences = [];
  const prose = [];
  let open = null;
  for (const line of text.split('\n')) {
    if (open) {
      const close = line.match(/^[ \t]{0,3}(`{3,}|~{3,})[ \t]*$/);
      if (close && close[1][0] === open.char && close[1].length >= open.len) {
        open.buf.push(close[1]);
        fences.push(open.buf.join('\n'));
        open = null;
        prose.push('');
        continue;
      }
      open.buf.push(line);
      continue;
    }
    const m = line.match(/^[ \t]{0,3}(`{3,}|~{3,})(.*)$/);
    if (m) {
      open = { char: m[1][0], len: m[1].length, buf: [m[1] + m[2]] };
      prose.push('');
      continue;
    }
    prose.push(line);
  }
  if (open) fences.push(open.buf.join('\n')); // unterminated: compare what there is
  return { fences, prose: prose.join('\n') };
}

const URL_PATTERNS = [
  /\]\(\s*([^)\s]+)/g, // markdown link / image destination
  /(?:href|src|url|action)\s*=\s*["']([^"']*)["']/gi, // JSX or HTML attribute
  /<((?:https?:)?\/\/[^>\s]+)>/g, // autolink
  // Bare URL in prose. The character class is ASCII-only on purpose: a URL at
  // the end of a Chinese sentence is followed by a full-width period with no
  // space, and a greedy class swallows it into the URL — which then reads as a
  // link the English page does not have. (It did, on the first run: it flagged
  // `http://localhost:3000。见`.)
  /(?<![\w("'])(https?:\/\/[A-Za-z0-9\-._~:/?#@!$&*+,;=%]+)/g,
  /^[ \t]*\[[^\]]+\]:[ \t]*(\S+)/gm, // reference-style definition
];

function urls(prose) {
  const found = new Set();
  for (const re of URL_PATTERNS) {
    for (const m of prose.matchAll(re)) {
      // Fragments are stripped, and this is not a loophole — it is what the
      // rule is actually about. A heading id is derived from the heading text
      // and the heading text is translated, so `#the-open-source-alternative`
      // becomes `#开源替代方案` and `permission-sets#delegated-administration`
      // becomes `permission-sets#委托管理delegated-administration`. Both are
      // CORRECT: on a translated page the English anchor lands nowhere.
      // Comparing fragments would demand every translation link to headings it
      // does not have. What must not change is which PAGE a translation sends
      // the reader to — inventing a cross-reference the English page never
      // made is the failure this rule exists for, and stripping the fragment
      // still catches it. The cost is that a wrong anchor on a correct page is
      // not caught here; that is a broken link, not a fabricated claim.
      const u = m[1].trim().replace(/[.,;:!?]+$/, '').replace(/#.*$/, '');
      if (!u) continue;
      found.add(u);
    }
  }
  return found;
}

/**
 * Signature of every MDX component tag, in document order: `Name(prop,prop)`.
 * Prop VALUES are not compared — `<Card title="Quickstart">` is translated
 * text and the corpus translates it. Values that must not change are URLs, and
 * the `url` rule owns those.
 */
function components(prose) {
  const TAG = /<([A-Z][A-Za-z0-9_.]*)((?:"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\}|[^>"'{])*?)\/?>/g;
  const sigs = [];
  for (const m of prose.matchAll(TAG)) {
    const bare = m[2]
      .replace(/=\s*"[^"]*"/g, '=')
      .replace(/=\s*'[^']*'/g, '=')
      .replace(/=\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, '=');
    const props = [...bare.matchAll(/([A-Za-z_][A-Za-z0-9_:.-]*)/g)].map((x) => x[1]).sort();
    sigs.push(`${m[1]}(${props.join(',')})`);
  }
  return sigs;
}

/**
 * Markup that must never reach the rendered site. Scanned on prose with inline
 * code spans removed as well as fences: in both, the token renders as text.
 */
const UNSAFE_PATTERNS = [
  { what: '<script', re: /<[ \t]*script\b/i },
  { what: 'javascript: URL', re: /javascript[ \t]*:/i },
  { what: 'on*= event handler', re: /(?:^|[\s{;"'])on[a-zA-Z][a-zA-Z0-9]*[ \t]*=/ },
];

const scannable = (prose) => prose.replace(/`[^`\n]*`/g, ' ');

/** Whitespace-normalized so rewrapped lines do not read as a length change. */
const proseLength = (text) => split(stripFrontmatter(text)).prose.replace(/\s+/g, ' ').trim().length;

/* ------------------------------------------------------------------ rules -- */

/** Safety rules. Run on ONE file — English or translation, no sibling needed. */
function checkUnsafe(path, text) {
  const found = [];
  const body = scannable(split(stripFrontmatter(text)).prose);
  for (const { what, re } of UNSAFE_PATTERNS) {
    const m = body.match(re);
    if (m) {
      found.push({
        rule: 'unsafe',
        file: rel(path),
        detail: `${what} — ${JSON.stringify(m[0].trim())}`,
      });
    }
  }
  return found;
}

/** Fidelity rules. Compare a translation against its English sibling. */
function checkFidelity(localePath, enPath, locale) {
  const t = readFileSync(localePath, 'utf8');
  const e = readFileSync(enPath, 'utf8');
  const file = rel(localePath);
  const found = [];
  const add = (rule, detail) => found.push({ rule, file, detail });

  const ts = split(stripFrontmatter(t));
  const es = split(stripFrontmatter(e));

  // 1. fenced code blocks byte-identical to the English source
  if (ts.fences.length !== es.fences.length) {
    add('fence', `${ts.fences.length} code fence(s), English has ${es.fences.length}`);
  } else {
    for (let i = 0; i < es.fences.length; i += 1) {
      if (ts.fences[i] !== es.fences[i]) {
        add('fence', `code fence #${i + 1} differs from the English source`);
        break;
      }
    }
  }

  // 2. the page's URL set is a subset of the English page's
  const extra = [...urls(ts.prose)].filter((u) => !urls(es.prose).has(u));
  if (extra.length) add('url', `link(s) the English page does not have: ${extra.join(', ')}`);

  // 3. frontmatter keys match exactly (values are translated, keys are not)
  const tf = frontmatter(t);
  const ef = frontmatter(e);
  if (tf === null || ef === null) {
    if (tf === null) add('frontmatter', 'no frontmatter block');
  } else {
    // `translation:` is written by `check-translations.mjs --stamp` and exists
    // only on the locale side by design.
    const tk = topLevelKeys(tf).filter((k) => k !== 'translation');
    const ek = topLevelKeys(ef).filter((k) => k !== 'translation');
    const missing = ek.filter((k) => !tk.includes(k));
    const added = tk.filter((k) => !ek.includes(k));
    if (missing.length || added.length) {
      add(
        'frontmatter',
        [missing.length ? `missing key(s): ${missing.join(', ')}` : '', added.length ? `added key(s): ${added.join(', ')}` : '']
          .filter(Boolean)
          .join('; '),
      );
    }
  }

  // 4. MDX component names and props unchanged
  const tc = components(ts.prose);
  const ec = components(es.prose);
  if (tc.join('|') !== ec.join('|')) {
    const tset = tc.join('|').length ? tc : ['(none)'];
    const eset = ec.join('|').length ? ec : ['(none)'];
    add('component', `components ${tset.join(' ')} vs English ${eset.join(' ')}`);
  }

  // 5. length within ±LENGTH_TOLERANCE of what this locale runs at
  const expected = LOCALE_EXPANSION[locale];
  const enLen = proseLength(e);
  if (expected === undefined) {
    add('uncalibrated', `no LOCALE_EXPANSION entry for "${locale}" — length not judged (run --calibrate)`);
  } else if (enLen > 0) {
    const ratio = proseLength(t) / enLen;
    const lo = expected * (1 - LENGTH_TOLERANCE);
    const hi = expected * (1 + LENGTH_TOLERANCE);
    if (ratio < lo || ratio > hi) {
      add(
        'length',
        `prose is ${ratio.toFixed(2)}x the English page; ${locale} translations run ${expected}x ` +
          `(band ${lo.toFixed(2)}–${hi.toFixed(2)})`,
      );
    }
  }

  return found;
}

/** Every finding in the corpus, unclassified. */
function survey() {
  const all = walk(DOCS).sort();
  const findings = [];
  for (const f of all) {
    findings.push(...checkUnsafe(f, readFileSync(f, 'utf8')));
    const l = localeOf(f);
    if (!l) continue;
    const en = englishOf(f, l);
    if (!existsSync(en)) continue; // orphans are check-translations.mjs's verdict
    findings.push(...checkFidelity(f, en, l));
  }
  return { files: all.length, findings };
}

/* ----------------------------------------------------------------- output -- */

/** Every rule this script enforces; the self-test asserts each one has a red fixture. */
const RULES = ['fence', 'url', 'frontmatter', 'component', 'unsafe', 'length'];

const SAFETY = new Set(['unsafe']);
const ADVISORY = new Set(['uncalibrated']);

function classify(findings, scope) {
  const blocking = [];
  const reported = [];
  for (const f of findings) {
    if (ADVISORY.has(f.rule)) reported.push(f);
    else if (SAFETY.has(f.rule) || scope === null || scope.has(f.file)) blocking.push(f);
    else reported.push(f);
  }
  return { blocking, reported };
}

function print(list) {
  for (const f of list) console.error(`    [${f.rule}] ${f.file}\n      ${f.detail}`);
}

function main() {
  const argv = process.argv.slice(2);
  const has = (n) => argv.some((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  const value = (n) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
  };

  if (has('self-test')) return selfTest();
  if (has('calibrate')) return calibrate();

  // `--report` never exits 1. It is for the push-to-main run, where there is no
  // pull-request diff to scope blocking to and the whole corpus would fail on
  // debt no one is currently touching.
  const reportOnly = has('report');
  let scope = null;
  if (has('files')) {
    const listFile = value('files');
    if (!listFile) throw new Error('--files needs a path');
    scope = new Set(
      readFileSync(resolve(ROOT, listFile), 'utf8')
        .split('\n')
        .map((s) => s.trim())
        .filter((p) => p.startsWith('content/docs/') && localeOf(p)),
    );
  }

  const s = survey();
  const { blocking, reported } = classify(s.findings, scope);

  console.log('## Translation output');
  console.log('');
  const how = reportOnly
    ? ' · reporting only'
    : scope
      ? ` · blocking on **${scope.size}** changed translation(s)`
      : ' · blocking on the whole corpus';
  console.log(`Scanned **${s.files}** page(s) against ${LOCALES.length} locale(s)${how}`);
  console.log('');
  if (!blocking.length && !reported.length) console.log('No findings.');
  if (reported.length) {
    console.log(`<details><summary>Pre-existing findings outside this change (${reported.length})</summary>`);
    console.log('');
    for (const f of reported) console.log(`- \`${f.file}\` — **${f.rule}**: ${f.detail}`);
    console.log('');
    console.log('</details>');
    console.log('');
  }

  if (blocking.length && reportOnly) {
    console.error(`\n${blocking.length} finding(s) (reporting only, not gating):\n`);
    print(blocking);
    return;
  }
  if (blocking.length) {
    console.error(`\n✗ translation output gate failed — ${blocking.length} finding(s):\n`);
    print(blocking);
    console.error(
      '\n  These are the rules in docs/TRANSLATION.md § Before opening the PR.\n' +
        '  A translation renders the same claims in another language; it does not\n' +
        '  fix links, repair code samples, or restructure pages.\n',
    );
    process.exit(1);
  }
  console.error(`\n✓ translation output gate passed (${reported.length} pre-existing finding(s) reported)`);
}

/* ------------------------------------------------------------- calibrate -- */

function calibrate() {
  const byLocale = {};
  for (const f of walk(DOCS).sort()) {
    const l = localeOf(f);
    if (!l) continue;
    const en = englishOf(f, l);
    if (!existsSync(en)) continue;
    const enLen = proseLength(readFileSync(en, 'utf8'));
    if (!enLen) continue;
    (byLocale[l] ??= []).push(proseLength(readFileSync(f, 'utf8')) / enLen);
  }
  console.log('Median prose-length ratio per locale (paste into LOCALE_EXPANSION):');
  console.log('');
  for (const l of LOCALES) {
    const a = (byLocale[l] ?? []).sort((x, y) => x - y);
    if (!a.length) {
      console.log(`  ${JSON.stringify(l)}: /* no pages yet */`);
      continue;
    }
    const med = a[Math.floor(a.length / 2)];
    const band = [med * (1 - LENGTH_TOLERANCE), med * (1 + LENGTH_TOLERANCE)];
    const out = a.filter((r) => r < band[0] || r > band[1]).length;
    console.log(
      `  ${JSON.stringify(l)}: ${med.toFixed(2)},  // n=${a.length} min=${a[0].toFixed(2)} ` +
        `max=${a[a.length - 1].toFixed(2)} outside=${out}`,
    );
  }
}

/* ------------------------------------------------------------- self-test --
 * 裁决: a validator observed only green is indistinguishable from one that
 * cannot go red. Every rule ships the fixture that trips it, and the assertion
 * is on the EXACT set of rules fired — a fixture that goes red for the wrong
 * reason proves nothing about the rule it was written for. (Written that way,
 * the first run of this self-test failed: the clean pair tripped `length`,
 * because the fixture was being judged against a different locale's band.)
 *
 * Fixtures are built here rather than checked in under `content/docs/` so the
 * site never has to render them, and the locale comes from i18n.ts so they
 * cannot drift from the locale list. None of these rules inspect the LANGUAGE
 * of the text — only its structure — so one fixture body exercises any locale,
 * scaled to that locale's expansion factor.
 */

const CORE_EN = `---
title: Positions
description: How positions model the org chart.
---

Positions describe reporting structure. See [permissions](/docs/configure/permissions).

<Callout type="warn" title="Legacy">
  Roles were renamed to positions.
</Callout>

\`\`\`bash
os lint --rule security-role-word
\`\`\`

A position is a node in the business-unit tree, and every user holds exactly one.
`;

const CORE_XX = `---
title: Positionen
description: Wie Positionen das Organigramm abbilden.
translation:
  source_sha: ${'0'.repeat(64)}
  guide_rev: 1
  mode: auto
---

Positionen beschreiben die Berichtsstruktur. Siehe [Berechtigungen](/docs/configure/permissions).

<Callout type="warn" title="Alt">
  Rollen wurden in Positionen umbenannt.
</Callout>

\`\`\`bash
os lint --rule security-role-word
\`\`\`

Eine Position ist ein Knoten im Baum der Geschäftseinheiten, und jeder Benutzer hat genau eine.
`;

const FILLER_EN = 'Positions are inherited down the tree unless a permission set overrides them. ';
const FILLER_XX = 'Positionen werden im Baum vererbt, sofern ein Berechtigungssatz sie nicht überschreibt. ';

/** English fixture, padded so every locale's target length is reachable. */
const fixtureEn = () => CORE_EN + FILLER_EN.repeat(14) + '\n';

/**
 * Translation fixture whose prose length is `scale` x what a correct
 * translation into `locale` runs at. scale 1 must pass the band; the length
 * cases move it outside on purpose.
 */
function fixtureXx(locale, scale = 1) {
  const target = LOCALE_EXPANSION[locale] * scale * proseLength(fixtureEn());
  const deficit = target - proseLength(CORE_XX);
  const n = Math.max(0, Math.round(deficit / FILLER_XX.length));
  return CORE_XX + FILLER_XX.repeat(n) + '\n';
}

const CASES = [
  { name: 'clean pair', expect: [] },
  {
    name: 'fewer links than English (subset is allowed)',
    expect: [],
    xx: (s) => s.replace('[Berechtigungen](/docs/configure/permissions)', 'die Berechtigungsseite'),
  },
  {
    name: 'code fence edited',
    expect: ['fence'],
    xx: (s) => s.replace('os lint --rule security-role-word', 'os lint --rule security-rolle-wort'),
  },
  {
    name: 'code fence info string translated',
    expect: ['fence'],
    xx: (s) => s.replace('```bash', '```bash-befehl'),
  },
  { name: 'code fence dropped', expect: ['fence'], xx: (s) => s.replace(/```bash\nos lint[^\n]*\n```\n/, '') },
  {
    name: 'link the English page does not have',
    expect: ['url'],
    xx: (s) => s.replace('](/docs/configure/permissions)', '](https://example.invalid/de)'),
  },
  {
    name: 'cross-page link with a translated fragment',
    expect: [],
    en: (s) => s.replace('](/docs/configure/permissions)', '](/docs/configure/permissions#inheritance)'),
    xx: (s) => s.replace('](/docs/configure/permissions)', '](/docs/configure/permissions#vererbung)'),
  },
  {
    name: 'link to a page the English page never references',
    expect: ['url'],
    xx: (s) => s.replace('](/docs/configure/permissions)', '](/docs/reference/security#data-residency)'),
  },
  {
    name: 'same-page anchor translated with its heading',
    expect: [],
    en: (s) => s.replace('See [permissions]', 'See [below](#a-position) and [permissions]'),
    xx: (s) => s.replace('Siehe [Berechtigungen]', 'Siehe [unten](#eine-position) und [Berechtigungen]'),
  },
  {
    name: 'URL closed by full-width punctuation (no space)',
    expect: [],
    en: (s) => s.replace('Positions describe', 'Open http://localhost:3000. Positions describe'),
    xx: (s) => s.replace('Positionen beschreiben', 'Öffnen Sie http://localhost:3000。见 Positionen beschreiben'),
  },
  {
    name: 'frontmatter key added',
    expect: ['frontmatter'],
    xx: (s) => s.replace('title: Positionen', 'title: Positionen\nsidebar_label: Positionen'),
  },
  { name: 'frontmatter key dropped', expect: ['frontmatter'], xx: (s) => s.replace(/^description: .*\n/m, '') },
  {
    name: 'MDX component renamed',
    expect: ['component'],
    xx: (s) => s.replace('<Callout type="warn" title="Alt">', '<Hinweis type="warn" title="Alt">'),
  },
  {
    name: 'MDX prop dropped',
    expect: ['component'],
    xx: (s) => s.replace('<Callout type="warn" title="Alt">', '<Callout title="Alt">'),
  },
  { name: 'script tag in the translation', expect: ['unsafe'], xx: (s) => `${s}\n<script>fetch("https://x.invalid")</script>\n` },
  { name: 'javascript: URL in the translation', expect: ['unsafe'], xx: (s) => `${s}\nDer Wert javascript:alert(1) ist verboten.\n` },
  { name: 'on*= handler in the translation', expect: ['unsafe'], xx: (s) => `${s}\n<div onclick="alert(1)">x</div>\n` },
  {
    name: 'script tag in the ENGLISH source',
    expect: ['unsafe'],
    en: (s) => `${s}\n<script>fetch("https://x.invalid")</script>\n`,
  },
  { name: 'body truncated to half', expect: ['length'], scale: 0.5 },
  { name: 'body padded with invented content', expect: ['length'], scale: 1.5 },
];

function selfTest() {
  const locale = LOCALES.find((l) => LOCALE_EXPANSION[l] !== undefined);
  if (!locale) throw new Error('no calibrated locale in i18n.ts — cannot self-test the length rule');
  const dir = mkdtempSync(join(tmpdir(), 'translation-output-'));
  const en = join(dir, 'page.mdx');
  const xx = join(dir, `page.${locale}.mdx`);
  let failed = 0;
  try {
    for (const c of CASES) {
      writeFileSync(en, (c.en ?? ((s) => s))(fixtureEn()));
      writeFileSync(xx, (c.xx ?? ((s) => s))(fixtureXx(locale, c.scale ?? 1)));
      const fired = [
        ...new Set([
          ...checkUnsafe(en, readFileSync(en, 'utf8')).map((f) => f.rule),
          ...checkUnsafe(xx, readFileSync(xx, 'utf8')).map((f) => f.rule),
          ...checkFidelity(xx, en, locale).map((f) => f.rule),
        ]),
      ].sort();
      const want = [...c.expect].sort();
      const ok = fired.join(',') === want.join(',');
      if (!ok) failed += 1;
      console.log(
        `${ok ? '✓' : '✗'} ${c.name.padEnd(46)} fired [${fired.join(' ') || '—'}]` +
          (ok ? '' : `  expected [${want.join(' ') || '—'}]`),
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
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
  console.log(`✓ self-test: ${CASES.length} case(s) on locale "${locale}", every rule demonstrated able to fail`);
}

main();
