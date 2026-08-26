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
  // Measured against its zh-Hans SOURCE, not against English — see
  // `DERIVED_FROM`. Traditional and Simplified are the same text in two
  // orthographies, so a correct conversion is 1:1 in characters and the band
  // this produces is tight on purpose: it is a check on the converter, not on
  // a translator.
  'zh-Hant': 1.00,
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

/**
 * Locales DERIVED FROM ANOTHER LOCALE rather than translated from English, and
 * the locale each one is derived from.
 *
 * Every rule below asks "is this file faithful to the thing it was produced
 * from?", and until `zh-Hant` shipped that thing was always the English
 * sibling. It is not, for a locale generated by
 * `apps/docs/scripts/gen-zh-hant.mjs`: Traditional Chinese is produced from the
 * SIMPLIFIED page by an orthographic conversion, so the English page is two
 * derivations away and comparing against it measures the wrong pair.
 *
 * That is not a nicety. Measured on the tree this landed on, comparing the 62
 * generated Traditional pages against English produced 31 blocking findings,
 * every one of them a verbatim re-report of a finding already open against the
 * Simplified page it was converted from — debt that is unfixable in the file
 * being accused, because the file is generated and the fix belongs upstream.
 * A gate that accuses a file nobody can edit for a defect it did not introduce
 * is a gate people learn to override.
 *
 * Compared against its real source the same rules become a genuine check on
 * the CONVERTER, and a strict one: the generator copies fenced code blocks
 * through byte for byte and rewrites only Han characters outside them, so
 * `fence`, `url`, `frontmatter` and `component` must all match the Simplified
 * source exactly. A converter that started rewriting a code sample, dropping a
 * link or losing a frontmatter key goes red here.
 *
 * `unsafe` is untouched by any of this — it needs no sibling, runs over the
 * whole corpus, and is the one rule that is never scoped.
 */
const DERIVED_FROM = { 'zh-Hant': 'zh-Hans' };

/**
 * The file a locale file must be faithful to: its source-locale sibling for a
 * derived locale, the English sibling for a translated one.
 */
function sourceOf(f, l) {
  const from = DERIVED_FROM[l];
  return from ? `${f.slice(0, -`.${l}.mdx`.length)}.${from}.mdx` : englishOf(f, l);
}

/** How a finding names the thing a file was compared against. */
const sourceLabel = (l) => (DERIVED_FROM[l] ? `${DERIVED_FROM[l]} source` : 'English source');

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
 * An MDX expression comment — `{/*` … `*\/}` — and the index just past its
 * closing brace, or -1 if the run starting at `from` is not one.
 *
 * Deliberately strict, because over-stripping is the dangerous direction: the
 * text this removes stops being scanned by `unsafe`, and a safety rule that
 * silently skips real prose is far worse than the false positive being fixed.
 * So only the exact construction MDX treats as an EMPTY EXPRESSION is removed:
 * the block comment must end at its first `*\/`, and the expression must close
 * on that same `*\/` (horizontal whitespace allowed). `{/* a *\/ b *\/}` holds an
 * expression that is not just a comment, `{/* x *\/\n}` closes on the next
 * line, and neither is stripped — they keep today's behaviour rather than
 * gamble prose on a guess. An UNTERMINATED `{/*` is likewise left in prose: it
 * is the one shape where a wrong answer swallows the rest of the page, and MDX
 * itself refuses to compile it, so nothing renders from a file that has one.
 */
function commentEnd(text, from) {
  if (!text.startsWith('{/*', from)) return -1;
  const star = text.indexOf('*/', from + 3);
  if (star === -1) return -1;
  let i = star + 2;
  while (text[i] === ' ' || text[i] === '\t') i += 1;
  return text[i] === '}' ? i + 1 : -1;
}

/**
 * The index just past the inline code span opening at `i`, or just past the
 * opening backtick run if nothing closes it on that line.
 *
 * Code spans are skipped whole, so a `{/*` inside one is never read as a
 * comment. That is not a technicality: a page documenting MDX comments writes
 * `` `{/* … *\/}` `` in a code span, and there the characters DO reach the
 * reader. Same single-line model as `scannable()` — a run of n backticks
 * closed by a run of exactly n.
 */
function codeSpanEnd(text, i) {
  let n = 1;
  while (text[i + n] === '`') n += 1;
  const nl = text.indexOf('\n', i + n);
  const limit = nl === -1 ? text.length : nl;
  let j = i + n;
  while (j < limit) {
    if (text[j] !== '`') {
      j += 1;
      continue;
    }
    let m = 1;
    while (text[j + m] === '`') m += 1;
    if (m === n) return j + m;
    j += m;
  }
  return i + n; // unclosed on this line: the backtick run is literal text
}

/**
 * Pull MDX expression comments out of prose, left to right, code spans first.
 *
 * Removed rather than blanked, because that is what the page renders: in
 * `foo{/* c *\/}bar` the expression yields nothing and the reader sees `foobar`,
 * so the scanned text should read `foobar` too.
 */
function separateComments(text) {
  const comments = [];
  let out = '';
  let last = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '`') {
      i = codeSpanEnd(text, i);
      continue;
    }
    if (c === '{') {
      const end = commentEnd(text, i);
      if (end === -1) {
        i += 1;
        continue;
      }
      out += text.slice(last, i);
      comments.push(text.slice(i, end));
      last = end;
      i = end;
      continue;
    }
    i += 1;
  }
  return { comments, prose: out + text.slice(last) };
}

/**
 * Split a document into fenced code blocks, MDX expression comments, and the
 * prose around them. The fence marker and info string are part of the compared
 * text: a translated ```bash is as much a defect as a translated comment inside
 * it.
 *
 * Comments are separated HERE, beside fences, and for the same reason: every
 * rule below reads `.prose`, so one seam decides what "the text of this page"
 * is. Teaching `proseLength()` and `checkUnsafe()` about comments one at a time
 * is how two rules end up disagreeing about what text is.
 *
 * Fences win over comments: the fence machine runs first, so a `{/*` inside a
 * code sample is code, never an opening marker. Nothing hides in the gap — a
 * comment that opens in prose and closes after a fence removes the prose around
 * that fence, while `fence` still pins the fence bytes to the English source.
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
  const { comments, prose: body } = separateComments(prose.join('\n'));
  return { fences, comments, prose: body };
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

/**
 * Fidelity rules. Compare a locale file against the file it was produced from —
 * the English sibling for a translated locale, the source-locale sibling for a
 * derived one (`DERIVED_FROM`).
 */
function checkFidelity(localePath, sourcePath, locale) {
  const t = readFileSync(localePath, 'utf8');
  const e = readFileSync(sourcePath, 'utf8');
  const source = sourceLabel(locale);
  const file = rel(localePath);
  const found = [];
  const add = (rule, detail) => found.push({ rule, file, detail });

  const ts = split(stripFrontmatter(t));
  const es = split(stripFrontmatter(e));

  // 1. fenced code blocks byte-identical to the source
  if (ts.fences.length !== es.fences.length) {
    add('fence', `${ts.fences.length} code fence(s), ${source} has ${es.fences.length}`);
  } else {
    for (let i = 0; i < es.fences.length; i += 1) {
      if (ts.fences[i] !== es.fences[i]) {
        add('fence', `code fence #${i + 1} differs from the ${source}`);
        break;
      }
    }
  }

  // 2. the page's URL set is a subset of its source page's
  const extra = [...urls(ts.prose)].filter((u) => !urls(es.prose).has(u));
  if (extra.length) add('url', `link(s) the ${source} does not have: ${extra.join(', ')}`);

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
        `prose is ${ratio.toFixed(2)}x the ${source}; ${locale} runs ${expected}x ` +
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
    const src = sourceOf(f, l);
    // A missing source is `check-translations.mjs`'s verdict: an orphan for a
    // translated locale, and for a derived one a file the generator no longer
    // produces (`gen:zh-hant --check` names it).
    if (!existsSync(src)) continue;
    findings.push(...checkFidelity(f, src, l));
  }
  return { files: all.length, findings };
}

/* ----------------------------------------------------------------- output -- */

/** Every rule this script enforces; the self-test asserts each one has a red fixture. */
const RULES = ['fence', 'url', 'frontmatter', 'component', 'unsafe', 'length'];

/**
 * The rules whose answer depends on what `split()` decided the text of the
 * page is. Each must also ship a fixture declaring it stays SILENT (`ignores`
 * in the case table): a rule that quietly stops firing is invisible to a suite
 * that only ever asserts rules can fire, and that is exactly how comment text
 * was measured as prose for as long as it was.
 */
const PROSE_RULES = ['url', 'component', 'unsafe', 'length'];

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
    // The same base the gate uses. Calibrating a derived locale against English
    // would print a number the `length` rule never compares anything to.
    const src = sourceOf(f, l);
    if (!existsSync(src)) continue;
    const srcLen = proseLength(readFileSync(src, 'utf8'));
    if (!srcLen) continue;
    (byLocale[l] ??= []).push(proseLength(readFileSync(f, 'utf8')) / srcLen);
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

/**
 * A maintenance note in the shape the corpus carries one, and long enough that
 * measuring it as prose moves the ratio out of band on its own — which is what
 * makes the English-comment fixture red without the fix.
 */
const NOTE_LINE = '  Naming decided under the ADR; do not rewrite it while translating this page.\n';
const NOTE = `{/*\n${NOTE_LINE.repeat(14)}*/}`;

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

  /* MDX expression comments. The cases above assert that every rule CAN fire;
   * by construction they say nothing about what a rule must stay silent on,
   * which is the blind spot that let comment text be measured as prose. The
   * `ignores` field below is that missing half, and `PROSE_RULES` makes it
   * mandatory rather than optional. The `expect`-carrying cases in this group
   * are the other direction: over-stripping blinds a blocking safety rule, so
   * each shape that must NOT be read as a comment gets prose a rule has to
   * still find.
   */
  {
    name: 'MDX comment in the English source (renders nothing)',
    expect: [],
    ignores: ['length'],
    en: (s) => s.replace('Positions describe', `${NOTE}\nPositions describe`),
  },
  {
    name: 'javascript: URL inside an MDX comment',
    expect: [],
    ignores: ['unsafe'],
    xx: (s) => `${s}\n{/* Nicht dokumentieren: javascript:alert(1) ist verboten. */}\n`,
  },
  {
    name: 'script tag inside a multi-line MDX comment',
    expect: [],
    ignores: ['unsafe'],
    xx: (s) =>
      `${s}\n{/*\n  Verbotenes Markup, nur als Notiz:\n  <script>fetch("https://x.invalid")</script>\n  Ende der Notiz.\n*/}\n`,
  },
  {
    name: 'two MDX comments on one prose line',
    expect: [],
    ignores: ['unsafe'],
    xx: (s) => `${s}\nEin {/* javascript:alert(1) */} Satz {/* <script>x</script> */} Ende.\n`,
  },
  {
    name: 'component and link inside an MDX comment',
    expect: [],
    ignores: ['component', 'url'],
    xx: (s) =>
      `${s}\n{/* Alt: <Callout type="note" title="Alt">siehe [X](https://example.invalid/de)</Callout> */}\n`,
  },
  {
    name: 'unterminated MDX comment does not swallow the page',
    expect: ['unsafe'],
    xx: (s) => `${s}\n{/* offene Notiz ohne Ende\nDer Wert javascript:alert(1) ist verboten.\n`,
  },
  {
    // The marker opens inside the fence and a closer sits in prose further
    // down, so an implementation that stripped comments BEFORE separating
    // fences would swallow the fence and the `javascript:` with it.
    name: 'a comment marker inside a code fence is code',
    expect: ['unsafe'],
    en: (s) => s.replace('os lint --rule', '# {/* siehe unten\nos lint --rule'),
    xx: (s) =>
      `${s.replace('os lint --rule', '# {/* siehe unten\nos lint --rule')}\n` +
      'Der Wert javascript:alert(1) ist verboten.\nEnde der Notiz */}\n',
  },
  {
    name: 'a comment inside an inline code span is prose',
    expect: ['url'],
    xx: (s) => `${s}\nBeispiel: \`{/* siehe https://example.invalid/de */}\`\n`,
  },
  {
    name: 'a comment closer in prose with nothing opened',
    expect: ['unsafe'],
    xx: (s) =>
      `${s}\nDer Marker */} und "a */ b" stehen als Text.\nDer Wert javascript:alert(1) ist verboten.\n`,
  },
];

/**
 * Direct assertions on the seam, independent of any rule. The fixtures above
 * prove the consequences; these pin the semantics — above all the shapes that
 * must NOT be treated as a comment, where a wrong answer deletes real prose
 * from a blocking safety scan.
 */
const SPLIT_CASES = [
  { name: 'comment mid-line, removed as rendered', doc: 'foo{/* c */}bar', comments: ['{/* c */}'], prose: 'foobar' },
  {
    name: 'two comments on one line',
    doc: 'a {/* x */} b {/* y */} c',
    comments: ['{/* x */}', '{/* y */}'],
    prose: 'a  b  c',
  },
  {
    name: 'comment spanning many lines',
    doc: 'a\n{/* one\ntwo\nthree */}\nb',
    comments: ['{/* one\ntwo\nthree */}'],
    prose: 'a\n\nb',
  },
  { name: 'unterminated comment stays prose', doc: 'a\n{/* open forever\nb', comments: [], prose: 'a\n{/* open forever\nb' },
  { name: 'comment inside a code fence is code', doc: '```js\n{/* c */}\n```\nb', comments: [], prose: '\n\nb' },
  {
    name: 'comment inside an inline code span is prose',
    doc: 'Write `{/* c */}` to hide text.',
    comments: [],
    prose: 'Write `{/* c */}` to hide text.',
  },
  {
    name: 'closer in prose with nothing opened',
    doc: 'The marker */} and "a */ b" are text.',
    comments: [],
    prose: 'The marker */} and "a */ b" are text.',
  },
  { name: 'expression that is not only a comment', doc: 'x {/* a */ b */} y', comments: [], prose: 'x {/* a */ b */} y' },
  { name: 'comment closing with a space before the brace', doc: 'a {/* c */ } b', comments: ['{/* c */ }'], prose: 'a  b' },
];

/**
 * Cases for a DERIVED locale (`DERIVED_FROM`), which the two-file harness above
 * cannot express: the whole point is which of THREE files the comparison picks.
 *
 * The fixture reproduces the shape that made this necessary. The source-locale
 * page carries a code fence that differs from the English one — the corpus has
 * 30 such pages — and the derived page is a faithful conversion of it. Case 1
 * asserts both halves of that: silent against its real source, and RED against
 * English. Without the second assertion the case would be green for a
 * validator that had simply stopped checking derived files at all.
 */
const DERIVED_CASES = [
  {
    name: 'faithful conversion of a source whose fence differs from English',
    expect: [],
    alsoRedAgainstEnglish: ['fence'],
  },
  {
    name: 'converter edited a code fence',
    expect: ['fence'],
    to: (s) => s.replace(SOURCE_FENCE_CMD, `${SOURCE_FENCE_CMD}-v2`),
  },
  {
    name: 'converter invented a link the source does not have',
    expect: ['url'],
    to: (s) => s.replace('](/docs/configure/permissions)', '](https://example.invalid/zh)'),
  },
  {
    name: 'converter dropped a frontmatter key',
    expect: ['frontmatter'],
    to: (s) => s.replace(/^description: .*\n/m, ''),
  },
  {
    name: 'converter truncated the page',
    expect: ['length'],
    to: (s) => s.slice(0, Math.floor(s.length / 2)),
  },
];

/** `@generated` marker the generator stamps, as a frontmatter YAML comment. */
const DERIVED_MARKER = '# @generated -- do not edit.';

/**
 * The command line inside the SOURCE fixture's fence. Named rather than spelled
 * twice: the source deliberately differs from English here, so a case that
 * mutated the English spelling would be a no-op replace — a fixture that
 * changes nothing and reports green. (It was, on the first run of this block.)
 */
const SOURCE_FENCE_CMD = 'os lint --rule sicherheit-rolle-wort';

/**
 * Run `DERIVED_CASES` for every entry in `DERIVED_FROM`, and assert the map
 * itself is consistent with `i18n.ts`. A `DERIVED_FROM` entry naming a locale
 * that is no longer declared would silently stop being exercised, which is the
 * shape of dead configuration this file's own header argues against.
 */
function derivedTest() {
  let failed = 0;
  for (const [derived, from] of Object.entries(DERIVED_FROM)) {
    for (const [what, l] of [['derived', derived], ['source', from]]) {
      if (!LOCALES.includes(l)) {
        console.error(`✗ DERIVED_FROM names a ${what} locale absent from i18n.ts: "${l}"`);
        failed += 1;
      }
    }
    if (LOCALE_EXPANSION[derived] === undefined) {
      console.error(`✗ derived locale "${derived}" has no LOCALE_EXPANSION entry — length is never judged`);
      failed += 1;
    }
    if (!LOCALES.includes(derived) || !LOCALES.includes(from)) continue;

    const dir = mkdtempSync(join(tmpdir(), 'translation-derived-'));
    const en = join(dir, 'page.mdx');
    const src = join(dir, `page.${from}.mdx`);
    const out = join(dir, `page.${derived}.mdx`);
    try {
      // The source page's fence deliberately differs from English: that is the
      // debt the derived page must not be accused of inheriting.
      const sourceText = fixtureXx(from).replace('os lint --rule security-role-word', SOURCE_FENCE_CMD);
      if (!sourceText.includes(SOURCE_FENCE_CMD)) {
        throw new Error('derived fixture: the source fence mutation matched nothing');
      }
      writeFileSync(en, fixtureEn());
      writeFileSync(src, sourceText);

      for (const c of DERIVED_CASES) {
        // A conversion changes characters, not structure, so the derived
        // fixture starts as a byte copy of its source plus the marker.
        const base = sourceText.replace(/^---\n/, `---\n${DERIVED_MARKER}\n`);
        writeFileSync(out, (c.to ?? ((s) => s))(base));

        const fired = [...new Set(checkFidelity(out, src, derived).map((f) => f.rule))].sort();
        const want = [...c.expect].sort();
        let ok = fired.join(',') === want.join(',');

        // The other half of case 1: prove the fixture would have been red the
        // old way, so its green is a measurement and not a vacuum.
        if (c.alsoRedAgainstEnglish) {
          const vsEn = [...new Set(checkFidelity(out, en, derived).map((f) => f.rule))]
            .filter((r) => c.alsoRedAgainstEnglish.includes(r))
            .sort();
          if (vsEn.join(',') !== [...c.alsoRedAgainstEnglish].sort().join(',')) {
            console.error(
              `  against English this fixture fired [${vsEn.join(' ') || '—'}], ` +
                `expected [${c.alsoRedAgainstEnglish.join(' ')}] — it proves nothing`,
            );
            ok = false;
          }
        }

        if (!ok) failed += 1;
        console.log(
          `${ok ? '✓' : '✗'} derived ${derived}: ${c.name.padEnd(56)} fired [${fired.join(' ') || '—'}]` +
            (ok ? '' : `  expected [${want.join(' ') || '—'}]`),
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  return failed;
}

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
      let ok = fired.join(',') === want.join(',');
      // A case cannot both expect and ignore a rule: `ignores` is a claim that
      // the rule stayed silent, and it only counts as coverage if it is one.
      const mislabelled = (c.ignores ?? []).filter((r) => want.includes(r));
      if (mislabelled.length) {
        ok = false;
        console.error(`  case declares ignores [${mislabelled.join(' ')}] that it also expects`);
      }
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
  for (const c of SPLIT_CASES) {
    const got = split(c.doc);
    const ok = JSON.stringify(got.comments) === JSON.stringify(c.comments) && got.prose === c.prose;
    if (!ok) failed += 1;
    console.log(`${ok ? '✓' : '✗'} split: ${c.name.padEnd(39)} ${JSON.stringify(got.comments)}`);
    if (!ok) {
      console.error(`    comments ${JSON.stringify(got.comments)} expected ${JSON.stringify(c.comments)}`);
      console.error(`    prose    ${JSON.stringify(got.prose)} expected ${JSON.stringify(c.prose)}`);
    }
  }

  console.log('');
  failed += derivedTest();

  console.log('');
  const covered = new Set(CASES.flatMap((c) => c.expect));
  for (const rule of RULES) {
    if (!covered.has(rule)) {
      console.error(`✗ rule "${rule}" has no fixture that trips it`);
      failed += 1;
    }
  }
  const silent = new Set(CASES.flatMap((c) => c.ignores ?? []));
  for (const rule of PROSE_RULES) {
    if (!silent.has(rule)) {
      console.error(`✗ rule "${rule}" has no fixture that proves it stays silent`);
      failed += 1;
    }
  }
  if (failed) {
    console.error(`\n✗ self-test: ${failed} case(s) did not behave as declared`);
    process.exit(1);
  }
  const derivedCount = Object.keys(DERIVED_FROM).length * DERIVED_CASES.length;
  console.log(
    `✓ self-test: ${CASES.length} rule case(s), ${SPLIT_CASES.length} split case(s) and ` +
      `${derivedCount} derived-locale case(s) on locale "${locale}" — every rule demonstrated able ` +
      `to fail, every prose rule demonstrated able to stay silent, and every derived locale ` +
      `demonstrated to be compared against its source rather than English`,
  );
}

main();
