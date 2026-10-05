#!/usr/bin/env node
/**
 * "Humans write English, the bot writes translations" — as a machine rule.
 *
 * English is the only authored language (AGENTS.md). Translations are produced
 * in a separate periodic pass by a dedicated account. Both halves of that split
 * have to be enforced or neither holds:
 *
 *   - A content PR that also hand-edits six locale siblings is the cost this
 *     design removes — 86% of the diff in a typical docs PR used to be
 *     translation churn. Left as a convention it comes back on the first
 *     rushed PR.
 *   - A translation PR that also edits English (or anything outside
 *     `content/docs/`) is a generated-content PR carrying an unreviewed
 *     behavioural change. An agent with an editor will "helpfully" fix a typo,
 *     repair a link, or restructure a table while translating.
 *
 * So: the translation account may ONLY touch locale artifacts, and everyone
 * else may only touch everything else.
 *
 * One exception, on the human side: a PR may DELETE a locale artifact. Retiring
 * or renaming a page deletes its siblings in the same PR (AGENTS.md, Translation
 * workflow step 3), and a stale translation is worse than a missing one
 * (docs/TRANSLATION.md rule 3). A deletion is the one change to a translation
 * that cannot put words in a reader's language that the English source does
 * not say: the page falls back to English. Adding or modifying one stays the
 * translation account's alone. The translation account's side is unchanged; a
 * deletion of an English file is still a file it may not touch.
 *
 * That exception is why the list carries each path's status. `git diff
 * --name-only` names a deleted path exactly like an edited one, and that is
 * how this check came to reject the very deletion step 3 requires (#291).
 *
 * A rename is read as what it does to the tree: the old path deleted, the new
 * path added. So a renamed locale file still fails a human PR, because its new
 * path is a translation added by hand. The workflow passes `--no-renames` so
 * the list is written that way to begin with. An `R` line from a list made
 * without it is read the same way, and so is a `C` line (the new path added,
 * the source untouched), so the verdict never depends on git's similarity
 * guess. That also closes a blind spot: `--name-only` with rename detection
 * prints only a rename's NEW path, so the translation account could rename an
 * English page into a locale path and the English deletion never reached this
 * check.
 *
 * The discriminator is the PR author's login, not a label — a label can be
 * forgotten or edited, an author cannot be forged. Set the repo variable
 * `TRANSLATION_BOT_LOGIN` to the dedicated account. Until it is set the check
 * reports and passes, so this can land before the account exists.
 *
 * Usage:
 *   node .github/scripts/check-translation-ownership.mjs --actor <login> --files <list>
 *   node .github/scripts/check-translation-ownership.mjs --self-test
 *
 * <list> is a file with one change per line, exactly as `git diff --name-status
 * --no-renames` prints it: a status letter, a tab, then the path. A line with
 * no status (a `--name-only` list) is refused as a misinvocation rather than
 * guessed at. Both arguments are required; see `main()` for why the actor is
 * not optional.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const SELF = fileURLToPath(import.meta.url);
const HERE = dirname(SELF);
const ROOT = resolve(HERE, '../..');
const I18N = join(ROOT, 'apps/docs/lib/i18n.ts');

function locales() {
  const m = readFileSync(I18N, 'utf8').match(/languages:\s*\[([^\]]+)\]/);
  if (!m) throw new Error(`could not parse languages[] out of ${relative(ROOT, I18N)}`);
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/['"]/g, ''))
    .filter((l) => l && l !== 'en');
}

const LOCALES = locales();

/** `content/docs/**\/*.<locale>.mdx` and `content/docs/**\/meta.<locale>.json`. */
function isTranslationArtifact(path) {
  if (!path.startsWith('content/docs/')) return false;
  return LOCALES.some((l) => path.endsWith(`.${l}.mdx`) || path.endsWith(`meta.${l}.json`));
}

/**
 * A misinvocation, not a fault in the check.
 *
 * A missing required argument used to surface as an uncaught throw: Node prints
 * the source frame and a seven-line stack, and the reader's first conclusion is
 * "this script is broken" rather than "I called it wrong". That is not
 * hypothetical — a dispatch prompt listed the bare command as a check to run,
 * and the stack read as a regression until it was diffed against main.
 *
 * So argument validation throws this class and the entry point below prints the
 * message plus the usage line, no stack, exit 1. Everything else — an
 * unparseable i18n.ts, a list file that exists but cannot be read, a bug in
 * here — is a genuine internal failure and keeps its stack, which is what a
 * real fault needs. The exit status is unchanged in both cases: a
 * misinvocation is still a failure, never a silent pass.
 */
class UsageError extends Error {}

const USAGE = [
  'usage: node .github/scripts/check-translation-ownership.mjs --actor <login> --files <path>',
  '       node .github/scripts/check-translation-ownership.mjs --self-test',
  '',
  '  --actor <login>  PR author login (workflows pass github.event.pull_request.user.login)',
  '  --files <path>   file listing one change per line (git diff --name-status --no-renames)',
].join('\n');

/**
 * The changed-path list, with a path that is simply not there answered as the
 * misinvocation it is. Naming a file that does not exist is the same class of
 * mistake as omitting `--files` altogether, and it used to surface as a raw
 * seven-line ENOENT stack — which reads as "this script is broken". Every
 * other way the read can fail (a directory, a permission error, a bad mount)
 * is a real fault and keeps its stack.
 */
function readChangedList(listFile) {
  const path = resolve(ROOT, listFile);
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    const where = path === listFile ? '' : ` (resolved to ${path})`;
    throw new UsageError(`--files ${listFile} does not exist${where}`);
  }
}

/** A `--name-status` status field: git's letter, then a score for R, C and a broken M. */
const STATUS = /^([ACDMRT])\d{0,3}$/;

/**
 * The list, as `{ status, path }` pairs with every status one of A, D, M or T.
 *
 * An `R` line becomes the old path deleted plus the new path added, and a `C`
 * line becomes the new path added. That is exactly what `--no-renames` would
 * have written, so a list made with or without rename detection gets the same
 * verdict. Anything else, including a bare `--name-only` path, is refused: a
 * line this cannot read is a list it was not given, and judging the paths it
 * can read would be a verdict on part of the PR.
 */
function parseChanges(text, listFile) {
  const changes = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = line.split('\t');
    const status = STATUS.exec(fields[0])?.[1];
    const arity = status === 'R' || status === 'C' ? 3 : 2;
    if (!status || fields.length !== arity || fields.slice(1).some((f) => !f)) {
      throw new UsageError(
        `${listFile}:${i + 1} is not a \`git diff --name-status\` line: ${JSON.stringify(line)}\n` +
          '  Each line is a status letter, a tab, then the path. Build the list with\n' +
          '  `git diff --name-status --no-renames`, not --name-only: a deletion is only\n' +
          '  allowed when the list says it is one.',
      );
    }
    if (status === 'R') changes.push({ status: 'D', path: fields[1] }, { status: 'A', path: fields[2] });
    else if (status === 'C') changes.push({ status: 'A', path: fields[2] });
    else changes.push({ status, path: fields[1] });
  }
  return changes;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) return selfTest();
  const value = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  };

  const actor = (value('actor') ?? '').trim();
  const listFile = value('files');
  if (!listFile) throw new UsageError('--files <path> is required');

  // The actor is the discriminator this whole check is built on, and the
  // header documents it as part of the invocation — so it is enforced the way
  // `--files` is. The implementation used to default it to '' and judge the PR
  // anyway: an empty actor can never equal a non-empty bot login, so `isBot`
  // was false and a translation-account PR invoked without the flag came back
  // rejected as hand-written — a confident verdict reached with the
  // discriminator absent, and nothing saying so. Declared, therefore enforced.
  //
  // This answers a malformed invocation, not the question of what the check
  // means once it is well formed: a call that passes both arguments with
  // `TRANSLATION_BOT_LOGIN` unset still reports and passes, untouched.
  if (!actor) throw new UsageError('--actor <login> is required');

  // Parsed before the variable is consulted, so a workflow that went back to a
  // status-less list fails on its next PR rather than on the day enforcement
  // is switched on.
  const changes = parseChanges(readChangedList(listFile), listFile);

  const botLogin = (process.env.TRANSLATION_BOT_LOGIN ?? '').trim();
  const isBot = botLogin !== '' && actor.toLowerCase() === botLogin.toLowerCase();

  const artifacts = changes.filter((c) => isTranslationArtifact(c.path)).map((c) => c.path);
  const others = changes.filter((c) => !isTranslationArtifact(c.path)).map((c) => c.path);

  if (!botLogin) {
    console.log(
      '⚠ TRANSLATION_BOT_LOGIN is not set — ownership is not enforced yet.\n' +
        '  Set it to the dedicated translation account (Settings → Variables) to turn this on.',
    );
    console.log(`  This PR touches ${artifacts.length} translation artifact(s) and ${others.length} other file(s).`);
    return;
  }

  if (isBot) {
    if (others.length) {
      console.error(
        `✗ translation PRs may only touch translation artifacts.\n` +
          `  @${actor} is the translation account, but this PR also changes:\n` +
          others.map((p) => `    ${p}`).join('\n') +
          `\n\n  English sources and site code are authored by humans. Split them out.`,
      );
      process.exit(1);
    }
    console.log(`✓ translation PR by @${actor}: ${artifacts.length} artifact(s), nothing else touched.`);
    return;
  }

  // A human PR may delete translations, and never add or modify one (see the header).
  const deleted = changes.filter((c) => c.status === 'D' && isTranslationArtifact(c.path));
  const written = changes.filter((c) => c.status !== 'D' && isTranslationArtifact(c.path));

  if (written.length) {
    console.error(
      `✗ translations are generated, not hand-written.\n` +
        `  This PR adds or modifies ${written.length} translation artifact(s):\n` +
        written.map((c) => `    ${c.status} ${c.path}`).join('\n') +
        `\n\n  Edit the English source instead — the translation pass will follow.\n` +
        `  See docs/TRANSLATION.md. Deleting a translation is the one change a PR\n` +
        `  like this may make to one: to retire or rename a page, delete its English\n` +
        `  source and its locale siblings in the same PR (AGENTS.md, step 3).` +
        (deleted.length ? `\n  The ${deleted.length} deletion(s) in this PR are allowed.` : ''),
    );
    process.exit(1);
  }

  if (deleted.length) {
    console.log(
      `✓ ${changes.length} file(s) changed: ${deleted.length} translation artifact(s) deleted, ` +
        'none added or modified.',
    );
    return;
  }

  console.log(`✓ ${changes.length} file(s) changed, no translation artifacts touched.`);
}

/* ------------------------------------------------------------- self-test -- */

const BOT = 'placeholder-translator';
const HUMAN = 'objectstack-fleet[bot]';

/**
 * PR #290, merged as 9c11af4: the 14 locale siblings retired under ruling
 * 5989567068 on #256, and nothing else. Enforced, this exact diff exited 1 here
 * ("This PR edits 14 translation artifact(s)"), which is what #291 reports.
 */
const PR_290 = [
  'configure/data-sources.de.mdx',
  'configure/data-sources.es.mdx',
  'configure/data-sources.fr.mdx',
  'configure/data-sources.ja.mdx',
  'configure/data-sources.ko.mdx',
  'configure/data-sources.zh-Hans.mdx',
  'configure/data-sources.zh-Hant.mdx',
  'extend-existing-systems.de.mdx',
  'extend-existing-systems.es.mdx',
  'extend-existing-systems.fr.mdx',
  'extend-existing-systems.ja.mdx',
  'extend-existing-systems.ko.mdx',
  'extend-existing-systems.zh-Hans.mdx',
  'extend-existing-systems.zh-Hant.mdx',
].map((p) => `D\tcontent/docs/${p}`);

/**
 * Each case runs the real entry point with the workflow's argv. `exit` is the
 * enforced verdict (TRANSLATION_BOT_LOGIN set). `named` must appear in the
 * output and `unnamed` must not: a failure names what it rejects, and only
 * that. Every well-formed case is also run with the variable unset, where it
 * must warn and exit 0 whatever it contains. That is the dormant behaviour
 * #68's completion condition reads.
 */
const CASES = [
  { name: 'human deletes PR #290\'s 14 siblings', actor: HUMAN, lines: PR_290, exit: 0 },
  {
    name: 'human retires a page: English + siblings',
    actor: HUMAN,
    lines: ['D\tcontent/docs/old.mdx', 'D\tcontent/docs/old.ja.mdx', 'D\tcontent/docs/meta.zh-Hans.json'],
    exit: 0,
  },
  {
    name: 'human renames a page, deletes siblings (R)',
    actor: HUMAN,
    lines: ['R100\tcontent/docs/old.mdx\tcontent/docs/new.mdx', 'D\tcontent/docs/old.ko.mdx'],
    exit: 0,
  },
  { name: 'human edits English only', actor: HUMAN, lines: ['M\tcontent/docs/quickstart.mdx'], exit: 0 },
  { name: 'empty list', actor: HUMAN, lines: [], exit: 0 },
  {
    name: 'human adds a translation',
    actor: HUMAN,
    lines: ['M\tcontent/docs/quickstart.mdx', 'A\tcontent/docs/quickstart.ja.mdx'],
    exit: 1,
    named: ['content/docs/quickstart.ja.mdx'],
  },
  {
    name: 'human modifies a translation',
    actor: HUMAN,
    lines: ['M\tcontent/docs/quickstart.fr.mdx'],
    exit: 1,
    named: ['content/docs/quickstart.fr.mdx'],
  },
  {
    name: 'human modifies a locale meta file',
    actor: HUMAN,
    lines: ['M\tcontent/docs/meta.ja.json'],
    exit: 1,
    named: ['content/docs/meta.ja.json'],
  },
  {
    name: 'human type-changes a translation (T)',
    actor: HUMAN,
    lines: ['T\tcontent/docs/quickstart.de.mdx'],
    exit: 1,
    named: ['content/docs/quickstart.de.mdx'],
  },
  {
    name: 'human deletes one, modifies another',
    actor: HUMAN,
    lines: ['D\tcontent/docs/configure/data-sources.ja.mdx', 'M\tcontent/docs/quickstart.ja.mdx'],
    exit: 1,
    named: ['content/docs/quickstart.ja.mdx'],
    unnamed: ['content/docs/configure/data-sources.ja.mdx'],
  },
  {
    name: 'human renames a translation (--no-renames)',
    actor: HUMAN,
    lines: ['D\tcontent/docs/old.ja.mdx', 'A\tcontent/docs/new.ja.mdx'],
    exit: 1,
    named: ['content/docs/new.ja.mdx'],
    unnamed: ['content/docs/old.ja.mdx'],
  },
  {
    name: 'human renames a translation (R line)',
    actor: HUMAN,
    lines: ['R100\tcontent/docs/old.ja.mdx\tcontent/docs/new.ja.mdx'],
    exit: 1,
    named: ['content/docs/new.ja.mdx'],
    unnamed: ['content/docs/old.ja.mdx'],
  },
  {
    name: 'human copies a translation (C line)',
    actor: HUMAN,
    lines: ['C100\tcontent/docs/old.es.mdx\tcontent/docs/new.es.mdx'],
    exit: 1,
    named: ['content/docs/new.es.mdx'],
    unnamed: ['content/docs/old.es.mdx'],
  },
  {
    name: 'translation account: artifacts only',
    actor: BOT,
    lines: ['M\tcontent/docs/quickstart.ja.mdx', 'A\tcontent/docs/x.ko.mdx', 'D\tcontent/docs/y.fr.mdx'],
    exit: 0,
  },
  {
    name: 'translation account edits English',
    actor: BOT,
    lines: ['M\tcontent/docs/quickstart.ja.mdx', 'M\tcontent/docs/quickstart.mdx'],
    exit: 1,
    named: ['content/docs/quickstart.mdx'],
  },
  {
    name: 'translation account deletes English',
    actor: BOT,
    lines: ['D\tcontent/docs/quickstart.mdx'],
    exit: 1,
    named: ['content/docs/quickstart.mdx'],
  },
  {
    name: 'translation account renames English to a locale',
    actor: BOT,
    lines: ['R100\tcontent/docs/c.mdx\tcontent/docs/c2.ja.mdx'],
    exit: 1,
    named: ['content/docs/c.mdx'],
  },
  {
    name: 'translation account touches site code',
    actor: BOT,
    lines: ['M\tcontent/docs/quickstart.ja.mdx', 'M\tapps/docs/lib/i18n.ts'],
    exit: 1,
    named: ['apps/docs/lib/i18n.ts'],
  },
  // Misinvocations: refused whether or not the variable is set.
  {
    name: 'a --name-only list is refused',
    actor: HUMAN,
    lines: ['content/docs/configure/data-sources.ja.mdx'],
    exit: 1,
    malformed: true,
    named: ['content/docs/configure/data-sources.ja.mdx'],
  },
  {
    name: 'an unknown status is refused',
    actor: HUMAN,
    lines: ['U\tcontent/docs/quickstart.ja.mdx'],
    exit: 1,
    malformed: true,
    named: ['content/docs/quickstart.ja.mdx'],
  },
  {
    name: 'an R line with one path is refused',
    actor: HUMAN,
    lines: ['R100\tcontent/docs/old.ja.mdx'],
    exit: 1,
    malformed: true,
    named: ['content/docs/old.ja.mdx'],
  },
];

/** Run this file's gate mode the way the workflow does, with the variable set or unset. */
function runGate(dir, i, c, botLogin) {
  const list = join(dir, `case-${i}.txt`);
  writeFileSync(list, c.lines.map((l) => `${l}\n`).join(''));
  const env = { ...process.env };
  if (botLogin === null) delete env.TRANSLATION_BOT_LOGIN;
  else env.TRANSLATION_BOT_LOGIN = botLogin;
  const run = spawnSync(process.execPath, [SELF, '--actor', c.actor, '--files', list], { env, encoding: 'utf8' });
  if (run.error) throw run.error;
  return { exit: run.status, out: `${run.stdout}${run.stderr}` };
}

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'os-translation-ownership-'));
  let failed = 0;
  const check = (label, problems) => {
    if (problems.length) failed += 1;
    console.log(`${problems.length ? '✗' : '✓'} ${label}`);
    for (const p of problems) console.error(`      ${p}`);
  };

  try {
    CASES.forEach((c, i) => {
      const enforced = runGate(dir, i, c, BOT);
      const problems = [];
      if (enforced.exit !== c.exit) problems.push(`exit ${enforced.exit}, expected ${c.exit}`);
      for (const p of c.named ?? []) if (!enforced.out.includes(p)) problems.push(`does not name ${p}`);
      for (const p of c.unnamed ?? []) if (enforced.out.includes(p)) problems.push(`names ${p}, which it allows`);
      if (problems.length) problems.push(`output:\n${enforced.out.replace(/^/gm, '        ')}`);
      check(`enforced  ${c.name.padEnd(50)} exit ${enforced.exit}`, problems);

      // The dormant path. The warning text is pinned on purpose: #68's
      // completion condition is that this exact line stops being printed.
      const dormant = runGate(dir, i, c, null);
      const want = c.malformed ? 1 : 0;
      const drift = [];
      if (dormant.exit !== want) drift.push(`exit ${dormant.exit}, expected ${want}`);
      if (!c.malformed && !dormant.out.includes('TRANSLATION_BOT_LOGIN is not set')) drift.push('no unset warning');
      if (drift.length) drift.push(`output:\n${dormant.out.replace(/^/gm, '        ')}`);
      check(`unset     ${c.name.padEnd(50)} exit ${dormant.exit}`, drift);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // Both directions have to be able to go red, or a green proves nothing.
  const sides = [
    ['a human PR rejected', (c) => c.actor === HUMAN && c.exit === 1 && !c.malformed],
    ['a human deletion allowed', (c) => c.actor === HUMAN && c.exit === 0 && c.lines.some((l) => l.startsWith('D\t'))],
    ['a translation-account PR rejected', (c) => c.actor === BOT && c.exit === 1],
    ['a translation-account PR allowed', (c) => c.actor === BOT && c.exit === 0],
    ['a malformed list refused', (c) => c.malformed],
  ];
  for (const [what, has] of sides) {
    if (!CASES.some(has)) {
      console.error(`✗ no case demonstrates ${what}`);
      failed += 1;
    }
  }

  console.log('');
  if (failed) {
    console.error(`✗ self-test: ${failed} check(s) did not behave as declared`);
    return 1;
  }
  console.log(
    `✓ self-test: ${CASES.length} case(s), each run enforced and unset — deletion allowed, ` +
      'addition and modification rejected, the translation account confined, the unset path dormant',
  );
  return 0;
}

try {
  const code = main();
  if (typeof code === 'number' && code !== 0) process.exit(code);
} catch (error) {
  if (!(error instanceof UsageError)) throw error;
  console.error(`✗ ${error.message}\n\n${USAGE}`);
  process.exit(1);
}
