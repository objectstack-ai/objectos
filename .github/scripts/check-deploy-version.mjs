#!/usr/bin/env node
/**
 * Deploy verdict gate — did this deploy actually publish a new Worker version?
 *
 * ## Why the step's exit code is not the answer
 *
 * Between 2026-08-25 and 2026-09-04 this repository ran 36 deploys that
 * published nothing. Cloudflare refuses an oversized upload at version
 * creation, so no version is created and the previously accepted one keeps
 * serving — the site stays up, stale, and the difference between "deployed"
 * and "rejected" is not visible from outside the step. #269 asks for the one
 * reading that distinguishes them: a NEW version id, serving, afterwards.
 *
 * So this gate reads three things rather than one:
 *
 *   --before      `wrangler deployments status --json`, taken BEFORE the deploy
 *   --deploy-log  everything the deploy command printed
 *   --after       the same status reading, taken AFTER
 *
 * and requires all of: the command succeeded, it named exactly one new version
 * id, that id is well-formed, it is not the id that was already serving, and
 * the post-deploy reading agrees that it is what is serving now.
 *
 * ## Absent readings are failures, never silence
 *
 * Every "could not read that" path here is a finding, not a skip. That is the
 * whole point: a check that quietly passes when its input is missing is the
 * shape this lane has been bitten by three times in one day, and it is exactly
 * what an unreadable `--before` would produce — no previous id to compare
 * against, therefore nothing to disagree with, therefore green.
 *
 * `--allow-no-previous` exists for the one legitimate case, a Worker with no
 * deployments at all, and it has to be asked for explicitly.
 *
 * ## Usage
 *
 *   node .github/scripts/check-deploy-version.mjs \
 *     --before before.json --after after.json \
 *     --deploy-log deploy.log --deploy-exit 0
 *
 *   node .github/scripts/check-deploy-version.mjs --self-test
 *
 * When `GITHUB_OUTPUT` is set, `previous_version_id` and `new_version_id` are
 * written to it before any exit, so a rollback job downstream has the id to
 * roll back to even on the runs where this gate goes red.
 */

import { readFileSync, existsSync, appendFileSync } from 'node:fs';

/** Every rule this gate enforces; the self-test asserts each has a red fixture. */
const RULES = [
  'deploy-command-failed',
  'no-version-id',
  'multiple-version-ids',
  'malformed-version-id',
  'unreadable-previous',
  'unchanged-version',
  'unreadable-after',
  'not-serving',
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The line `wrangler deploy` prints on success, and the only place a version id
 * is taken from. Anchored to the line so a version id quoted inside an error
 * message cannot be read as a successful publish.
 */
const VERSION_LINE = /^[^\S\n]*Current Version ID:[^\S\n]*(\S+)[^\S\n]*$/gim;

/**
 * Pull the serving version id out of a `wrangler deployments status --json`
 * capture.
 *
 * Returns `{ id }`, `{ empty: true }` when the capture is blank (the command
 * produced no stdout — typically because it failed), or `{ error }` when there
 * is text that does not yield an id. Those three are deliberately different
 * answers: only the middle one can be waived.
 */
function servingVersion(text) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return { empty: true };

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Wrangler prints nothing but the document under `--json`, but a proxy
    // banner or a trailing notice would still leave one object in the stream.
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) return { error: 'not JSON and no object found' };
    try {
      parsed = JSON.parse(trimmed.slice(start, end + 1));
    } catch (e) {
      return { error: `unparseable JSON: ${e.message}` };
    }
  }

  const versions = Array.isArray(parsed?.versions) ? parsed.versions : null;
  if (!versions || versions.length === 0) return { error: 'JSON carries no versions[]' };

  const full = versions.find((v) => Number(v?.percentage) === 100);
  const chosen = full ?? versions[0];
  const id = chosen?.version_id;
  if (typeof id !== 'string' || !UUID.test(id)) {
    return { error: `versions[0].version_id is not a UUID: ${JSON.stringify(id)}` };
  }
  return { id, split: versions.length > 1 && !full };
}

/** Every distinct version id the deploy command claimed to have published. */
function publishedVersions(log) {
  return [...new Set([...(log ?? '').matchAll(VERSION_LINE)].map((m) => m[1]))];
}

/**
 * Judge one deploy. Pure — the self-test drives it with fixture strings.
 *
 * `inputs` is `{ before, after, deployLog, deployExit, allowNoPrevious }`,
 * where the three text fields are file CONTENTS, not paths.
 */
function evaluate(inputs) {
  const findings = [];
  const add = (rule, detail) => findings.push({ rule, detail });

  const previous = servingVersion(inputs.before);
  const after = inputs.after === null || inputs.after === undefined ? null : servingVersion(inputs.after);
  const published = publishedVersions(inputs.deployLog);

  const measured = {
    previousVersionId: previous.id ?? null,
    newVersionId: null,
    servingAfter: after?.id ?? null,
    deployExit: inputs.deployExit,
  };

  if (previous.error) {
    add('unreadable-previous', `pre-deploy status: ${previous.error}`);
  } else if (previous.empty && !inputs.allowNoPrevious) {
    add(
      'unreadable-previous',
      'pre-deploy status was empty — without it "a new version is serving" cannot be ' +
        'asserted at all (pass --allow-no-previous only for a Worker that has never deployed)',
    );
  }

  if (Number(inputs.deployExit) !== 0) {
    add('deploy-command-failed', `the deploy command exited ${inputs.deployExit}`);
  }

  if (published.length === 0) {
    add(
      'no-version-id',
      'the deploy printed no "Current Version ID:" line — nothing was published, ' +
        'whatever the command exited with',
    );
  } else if (published.length > 1) {
    add('multiple-version-ids', `the deploy named ${published.length} version ids: ${published.join(', ')}`);
  } else if (!UUID.test(published[0])) {
    add('malformed-version-id', `"Current Version ID: ${published[0]}" is not a UUID`);
  } else {
    measured.newVersionId = published[0];
  }

  if (measured.newVersionId && previous.id && measured.newVersionId === previous.id) {
    add(
      'unchanged-version',
      `${measured.newVersionId} was already serving before this deploy — the upload ` +
        'created no new version',
    );
  }

  if (after) {
    if (after.error || after.empty) {
      add('unreadable-after', `post-deploy status: ${after.error ?? 'empty capture'}`);
    } else if (measured.newVersionId && after.id !== measured.newVersionId) {
      add(
        'not-serving',
        `the deploy published ${measured.newVersionId} but ${after.id} is serving afterwards`,
      );
    }
  }

  return { findings, measured };
}

/* ------------------------------------------------------------------ main -- */

function readIfPresent(path) {
  if (!path) return null;
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function emitOutputs(measured) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  appendFileSync(
    out,
    `previous_version_id=${measured.previousVersionId ?? ''}\n` +
      `new_version_id=${measured.newVersionId ?? ''}\n`,
  );
}

function gate(opts) {
  const { findings, measured } = evaluate({
    before: readIfPresent(opts.before),
    after: opts.after ? readIfPresent(opts.after) : null,
    deployLog: readIfPresent(opts.deployLog),
    deployExit: opts.deployExit,
    allowNoPrevious: opts.allowNoPrevious,
  });

  // Written before any exit: the rollback job needs the previous id most
  // precisely on the runs where this gate is about to go red.
  emitOutputs(measured);

  console.log('deploy verdict');
  console.log(`    serving before : ${measured.previousVersionId ?? '(unreadable)'}`);
  console.log(`    published now  : ${measured.newVersionId ?? '(none)'}`);
  console.log(`    serving after  : ${measured.servingAfter ?? '(not read)'}`);
  console.log(`    command exit   : ${measured.deployExit}`);
  console.log('');

  if (findings.length) {
    for (const f of findings) console.error(`    [${f.rule}] ${f.detail}`);
    console.error(`\n✗ deploy: ${findings.length} finding(s) — this run published nothing verifiable`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ deploy: ${measured.newVersionId} is serving, replacing ${measured.previousVersionId}`);
}

/* ------------------------------------------------------------- self-test -- */

const A = '69c79ee3-1f2b-4c6d-8a90-0b1c2d3e4f50';
const B = '7ad81ff4-2039-4d7e-9ba1-1c2d3e4f5061';

const status = (id, extra = {}) =>
  JSON.stringify({
    created_on: '2026-08-25T15:38:00.000Z',
    author_email: 'ci@objectos.ai',
    versions: [{ version_id: id, percentage: 100 }],
    ...extra,
  });

const deployLog = (id) =>
  ['Total Upload: 58541.02 KiB / gzip: 12002.11 KiB', 'Uploaded docs-objectos (24.31 sec)', `Current Version ID: ${id}`, ''].join('\n');

const REJECTED_LOG = [
  'Total Upload: 66112.94 KiB / gzip: 13991.02 KiB',
  '',
  'X [ERROR] A request to the Cloudflare API (/accounts/…/workers/scripts/docs-objectos/versions) failed.',
  '',
  '  Script startup exceeded CPU time limit. [code: 10027]',
  '',
].join('\n');

const CASES = [
  {
    name: 'a real deploy trips nothing',
    inputs: { before: status(A), after: status(B), deployLog: deployLog(B), deployExit: 0 },
    expect: [],
  },
  {
    name: 'rejected upload, non-zero exit',
    inputs: { before: status(A), after: status(A), deployLog: REJECTED_LOG, deployExit: 1 },
    expect: ['deploy-command-failed', 'no-version-id'],
  },
  {
    name: 'rejected upload that exits 0 anyway',
    inputs: { before: status(A), after: status(A), deployLog: REJECTED_LOG, deployExit: 0 },
    expect: ['no-version-id'],
  },
  {
    name: 'two version ids in one log',
    inputs: {
      before: status(A),
      after: status(B),
      deployLog: `${deployLog(B)}\n${deployLog(A)}`,
      deployExit: 0,
    },
    expect: ['multiple-version-ids'],
  },
  {
    name: 'version id is not a uuid',
    inputs: { before: status(A), after: status(B), deployLog: 'Current Version ID: undefined\n', deployExit: 0 },
    expect: ['malformed-version-id'],
  },
  {
    name: 'pre-deploy status empty',
    inputs: { before: '', after: status(B), deployLog: deployLog(B), deployExit: 0 },
    expect: ['unreadable-previous'],
  },
  {
    name: 'pre-deploy status empty, waived',
    inputs: {
      before: '',
      after: status(B),
      deployLog: deployLog(B),
      deployExit: 0,
      allowNoPrevious: true,
    },
    expect: [],
  },
  {
    name: 'pre-deploy status is an error page',
    inputs: {
      before: 'Authentication error [code: 10000]',
      after: status(B),
      deployLog: deployLog(B),
      deployExit: 0,
    },
    expect: ['unreadable-previous'],
  },
  {
    name: 'the same version "published" twice',
    inputs: { before: status(A), after: status(A), deployLog: deployLog(A), deployExit: 0 },
    expect: ['unchanged-version'],
  },
  {
    name: 'post-deploy status unreadable',
    inputs: { before: status(A), after: '{"versions":[]}', deployLog: deployLog(B), deployExit: 0 },
    expect: ['unreadable-after'],
  },
  {
    name: 'published, but something else is serving',
    inputs: { before: status(A), after: status(A), deployLog: deployLog(B), deployExit: 0 },
    expect: ['not-serving'],
  },
];

/** Shapes `servingVersion` must read, or must refuse to read. */
const STATUS_CASES = [
  ['plain json', status(A), A],
  ['json behind a banner', `⛅️ wrangler 4.95.0\n${status(A)}`, A],
  ['gradual rollout takes the first entry', JSON.stringify({ versions: [{ version_id: A, percentage: 60 }, { version_id: B, percentage: 40 }] }), A],
  ['100% entry wins over order', JSON.stringify({ versions: [{ version_id: A, percentage: 0 }, { version_id: B, percentage: 100 }] }), B],
  ['no versions array', '{"created_on":"x"}', null],
  ['not json at all', 'The Worker docs-objectos has no deployments.', null],
  ['blank', '   \n', null],
];

function selfTest() {
  let failed = 0;

  for (const c of CASES) {
    const { findings } = evaluate({ after: null, ...c.inputs });
    const fired = [...new Set(findings.map((f) => f.rule))].sort();
    const want = [...c.expect].sort();
    const ok = fired.join(',') === want.join(',');
    if (!ok) failed += 1;
    console.log(
      `${ok ? '✓' : '✗'} ${c.name.padEnd(40)} fired [${fired.join(' ') || '—'}]` +
        (ok ? '' : `  expected [${want.join(' ') || '—'}]`),
    );
    if (!ok) for (const f of findings) console.error(`      [${f.rule}] ${f.detail}`);
  }

  console.log('');
  for (const [name, text, expected] of STATUS_CASES) {
    const got = servingVersion(text);
    const ok = (got.id ?? null) === expected;
    if (!ok) failed += 1;
    console.log(
      `${ok ? '✓' : '✗'} status ${name.padEnd(34)} -> ${got.id ?? (got.empty ? '(empty)' : `(refused: ${got.error})`)}`,
    );
  }

  console.log('');
  const covered = new Set(CASES.flatMap((c) => c.expect));
  for (const rule of RULES) {
    if (!covered.has(rule)) {
      console.error(`✗ rule "${rule}" has no fixture that trips it`);
      failed += 1;
    }
  }
  if (!CASES.some((c) => c.expect.length === 0)) {
    console.error('✗ no fixture asserts that a good deploy trips nothing');
    failed += 1;
  }

  if (failed) {
    console.error(`\n✗ self-test: ${failed} case(s) did not behave as declared`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `✓ self-test: ${CASES.length} deploy case(s) and ${STATUS_CASES.length} status-parse case(s) — ` +
      `all ${RULES.length} rules demonstrated able to fail`,
  );
}

function parseArgs(argv) {
  const opts = { before: null, after: null, deployLog: null, deployExit: '0', allowNoPrevious: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--before') opts.before = argv[++i];
    else if (a === '--after') opts.after = argv[++i];
    else if (a === '--deploy-log') opts.deployLog = argv[++i];
    else if (a === '--deploy-exit') opts.deployExit = argv[++i];
    else if (a === '--allow-no-previous') opts.allowNoPrevious = true;
    else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if (!opts.before || !opts.deployLog) {
    console.error('✗ --before and --deploy-log are required (an absent reading is a failure, not a skip)');
    process.exit(2);
  }
  return opts;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.some((a) => a === '--self-test')) return selfTest();
  return gate(parseArgs(argv));
}

main();
