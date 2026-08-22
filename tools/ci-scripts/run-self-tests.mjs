#!/usr/bin/env node
/**
 * Runs every self-test the repository's CI scripts declare.
 *
 * This exists because `pnpm turbo run test` — the last of the three steps in
 * the required `build` job — executed zero tasks. No package declared a `test`
 * script, so the step passed by having nothing to do. A green that cannot go
 * red is indistinguishable in CI from a green that is protecting something,
 * and it is read as the latter.
 *
 * What it runs is a real test, not a placeholder that asserts `true`.
 * `check-translation-output.mjs` carries a table of fixtures with the rules
 * each one must trip, and its `--self-test` mode asserts both that every case
 * fires exactly the rules it declares and that every rule the script enforces
 * has a fixture able to make it fail. Weaken a rule and the self-test exits 1;
 * this runner propagates that, and so does the CI step.
 *
 * ## Why the runner lives here and the scripts do not
 *
 * The scripts stay at `.github/scripts/` — the workflows invoke them by that
 * path. Turbo only discovers tasks in workspace packages, so the runner needs
 * a package of its own: a `test` script on `apps/docs` would claim to test the
 * docs site, which is the same species of misleading signal this card is
 * about. Hence this package, reaching across to the scripts it runs.
 *
 * That reach has one consequence worth naming. Turbo hashes a package's own
 * directory by default, so an edit under `.github/scripts/` would replay a
 * cached green from before the edit. `turbo.json` names the dependency
 * explicitly on the `test` task: `$TURBO_ROOT$/.github/scripts/**`, plus
 * `$TURBO_ROOT$/apps/docs/lib/i18n.ts`, which the translation-output self-test
 * reads for the locale list.
 *
 * ## Keeping the step from going inert again
 *
 * Two guards, both of which fail loudly rather than skip quietly:
 *
 *   - `SELF_TESTED` empty → failure. Removing the last entry cannot silently
 *     restore the zero-task pass this runner exists to end.
 *   - a script under `.github/scripts/` that dispatches `--self-test` but is
 *     not listed → failure, naming the file. A new self-test joins the CI step
 *     by being written, not by someone remembering this list.
 *
 * Deliberately NOT run here: `check-translations.mjs` and
 * `check-translation-ownership.mjs`. Neither declares a self-test mode, and
 * running them for real would make the required `build` job fail on the
 * corpus's translation debt — which is the `Translations` workflow's job, and
 * reported-not-blocking there by design.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SCRIPTS = join(ROOT, '.github/scripts');

/** Scripts whose `--self-test` mode this step runs. Never let this go empty. */
const SELF_TESTED = ['check-translation-output.mjs', 'check-node-floor.mjs'];

/**
 * The argv dispatch, in the two shapes the scripts here use: a quoted
 * `'self-test'` or `'--self-test'` literal — as in `has('self-test')` or
 * `argv.includes('--self-test')`. Not the words "self-test" in a comment or
 * inside a longer error message, which is why the quotes must sit against the
 * flag.
 *
 * Best-effort by construction: a script that spells its flag some third way
 * goes unnoticed here. This check narrows the gap, it does not close it — the
 * guarantee that this step never silently executes nothing is the empty-list
 * check above, not this one.
 */
const DISPATCH = /(['"`])(?:--)?self-test\1/;

const rel = (p) => relative(ROOT, p);
const problems = [];

if (SELF_TESTED.length === 0) {
  problems.push(
    'SELF_TESTED is empty — this step would execute nothing, which is the failure it exists to prevent',
  );
}

for (const name of SELF_TESTED) {
  const path = join(SCRIPTS, name);
  if (!existsSync(path)) {
    problems.push(`listed in SELF_TESTED but does not exist: ${rel(path)}`);
  } else if (!DISPATCH.test(readFileSync(path, 'utf8'))) {
    problems.push(`listed in SELF_TESTED but declares no --self-test dispatch: ${rel(path)}`);
  }
}

const listed = new Set(SELF_TESTED);
for (const entry of readdirSync(SCRIPTS, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.mjs') || listed.has(entry.name)) continue;
  const path = join(SCRIPTS, entry.name);
  if (DISPATCH.test(readFileSync(path, 'utf8'))) {
    problems.push(`declares --self-test but is not listed in SELF_TESTED: ${rel(path)}`);
  }
}

if (problems.length) {
  console.error('✗ self-test runner: the list of self-tested scripts does not match the scripts\n');
  for (const p of problems) console.error(`    ${p}`);
  console.error(`\n  fix the list in ${rel(join(HERE, 'run-self-tests.mjs'))}`);
  process.exit(1);
}

let failed = 0;
for (const name of SELF_TESTED) {
  const path = join(SCRIPTS, name);
  console.log(`\n── ${rel(path)} --self-test`);
  const run = spawnSync(process.execPath, [path, '--self-test'], { stdio: 'inherit' });
  if (run.error) {
    console.error(`✗ ${rel(path)} could not be run: ${run.error.message}`);
    failed += 1;
  } else if (run.status !== 0) {
    console.error(`✗ ${rel(path)} --self-test exited ${run.status ?? `on signal ${run.signal}`}`);
    failed += 1;
  }
}

console.log('');
if (failed) {
  console.error(`✗ ${failed} of ${SELF_TESTED.length} self-test(s) failed`);
  process.exit(1);
}
console.log(`✓ ${SELF_TESTED.length} self-test(s) passed`);
