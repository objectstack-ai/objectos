#!/usr/bin/env node
/**
 * Node floor gate — the repo's declared Node floor, checked against what its
 * own dependency tree actually demands.
 *
 * ## Why this exists
 *
 * Four files declare the Node floor:
 *
 *     package.json                  engines.node
 *     apps/docs/package.json        engines.node
 *     tools/ci-scripts/package.json engines.node
 *     .node-version                 a version-manager pin, not a range
 *
 * Nothing in the install path reads any of them. `.npmrc` does not set
 * `engine-strict=true` and pnpm does not enforce `engines` by default, so
 * `pnpm install --frozen-lockfile` completes with no engines-related output at
 * all. CI does not consult them either — all three workflows pin
 * `node-version: 22` explicitly in `actions/setup-node`. Their audience is a
 * human reading the file, plus version managers (fnm / nvm / asdf) for
 * `.node-version` only.
 *
 * So a floor that is WRONG is structurally silent. This repo's floor stayed
 * wrong across the whole Node 20 era and was caught by someone reading a file,
 * not by a red job. A declaration nothing reads is the declared-but-unenforced
 * shape this project retires on sight; this gate is what makes it read.
 *
 * The alternative routes were considered and rejected: `engine-strict=true`
 * turns every contributor's install into a hard failure to enforce a
 * declaration CI never consults, punishing deliberate local variance to buy
 * nothing CI does not already have; and treating the declarations as
 * documentation keeps exactly the failure mode above.
 *
 * ## The direction, which is the whole rule
 *
 * The defect is a declared floor BELOW what a dependency requires — the repo
 * claims to run on a Node that something in the tree does not support. A
 * dependency floor lower than the declaration is the normal case and must stay
 * green: almost every package in the lockfile asks for far less than 22.
 *
 * So: reduce every `engines.node` range in `pnpm-lock.yaml` to the lowest Node
 * version that satisfies it, take the maximum across the tree, and require
 * each declared floor to be at least that. `RANGE_CASES` in the self-test pins
 * that reduction on the exact range shapes this lockfile contains.
 *
 * ## The second rule: the declared floor must be a version that works
 *
 * Max-of-minimums is blind to a GAP inside a disjunctive range, and this repo
 * had one. `yargs@18.0.0` declares `^20.19.0 || ^22.12.0 || >=23`: its minimum
 * is 20.19.0, far below 22, so it never moves the maximum — yet Node 22.0.0
 * through 22.11.x satisfies none of its three branches, and the `>=22` this
 * repo used to declare claimed exactly that window was supported.
 *
 * So the floor is also checked the other way round: the lowest version each
 * declaration claims to support must ITSELF satisfy every `engines.node` range
 * in the tree. That asks "does version X satisfy range R", which the reduction
 * never asks, so the parser below computes a full interval per comparator
 * rather than only a lower bound.
 *
 * The two rules are not independent. `unsupported` is strictly stronger: a
 * floor below the max-of-minimums also fails to satisfy the range that
 * produced that minimum, so a `lockfile` finding always arrives with an
 * `unsupported` twin, and a fixture pins that. `lockfile` is kept because it
 * is the more actionable half — it names the version to bump TO, which
 * `unsupported` cannot, a gap having no single answer. The case that separates
 * them (a floor clearing every minimum and still landing in a hole) is pinned
 * as its own fixture, because that case is the whole reason this rule exists.
 *
 * Both rules judge the FLOOR and nothing above it. A dependency that excludes
 * some HIGHER version is deliberately not a finding here: `engines.node`
 * declares where support starts, and this gate checks that the start is real.
 *
 * ## Why there is no YAML dependency
 *
 * Zero-dependency `.mjs`, like its three siblings in this directory, so it
 * runs before `pnpm install` and cannot be broken by the install it checks.
 * The lockfile scan is line-based. That is safe only because it FAILS LOUD
 * when it stops understanding the file: every line carrying `engines:` must
 * parse into a flow map, and finding zero `engines.node` entries at all is a
 * `coverage` failure rather than a vacuous pass. A gate that silently matches
 * nothing is the same defect class as the declaration it is here to enforce.
 *
 * ## Usage
 *
 *   node .github/scripts/check-node-floor.mjs              # gate
 *   node .github/scripts/check-node-floor.mjs --self-test  # prove every rule can fail
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

/**
 * The `package.json` files whose `engines.node` this gate governs — every
 * workspace package that declares one.
 *
 * `.node-version` is deliberately absent. It is a version-manager pin rather
 * than a range, it is checked by the `node-version` rule below, and adding it
 * here would send a bare `22` through a range parser that would read it as the
 * floor 22.0.0 and call the repo's own `>=22.12.0` a disagreement.
 */
const DECLARATION_FILES = ['package.json', 'apps/docs/package.json', 'tools/ci-scripts/package.json'];

/** Every rule this script enforces; the self-test asserts each one has a red fixture. */
const RULES = ['lockfile', 'unsupported', 'declarations', 'node-version', 'range', 'coverage', 'ungoverned'];

/**
 * Reported, never blocking — the same split `check-translations.mjs` already
 * makes between blocking and reported findings.
 *
 * `ungoverned` names this gate's own blind spot. `DECLARATION_FILES` is an
 * explicit list, so a workspace package that declares `engines.node` outside
 * it is simply not checked, and a gate silently covering some of the
 * declarations is the same structurally-silent shape this one exists to end.
 *
 * Every workspace package that declares a floor today is governed, so this
 * fires on nothing — it is here for the NEXT package to declare one. That the
 * workspace holds a single floor rather than a floor per package is a decided
 * policy: one lockfile installs under one Node, so a per-package floor nothing
 * installs separately is a claim nobody can act on. `tools/ci-scripts` used to
 * declare `>=20.0.0` on the reasoning that it has no dependencies of its own;
 * it now carries the workspace floor like everything else.
 *
 * It stays advisory rather than blocking because "this file is not governed"
 * is not a claim that its value is WRONG, and a new package appearing with a
 * defensible floor of its own should surface a decision, not a red build.
 */
const ADVISORY = new Set(['ungoverned']);

/**
 * Rules that must ALSO ship a fixture proving they stay silent. A rule that
 * quietly stopped firing is invisible to a suite that only asserts rules can
 * fire, and for `lockfile` and `unsupported` the silent case is the
 * load-bearing one: they are the direction guard. A dependency asking for less
 * than the declaration is the overwhelmingly common case — 426 of the 428
 * ranges in this lockfile — and a rule that fired on it would be reverted
 * within a day.
 */
const SILENT_RULES = ['lockfile', 'unsupported', 'declarations', 'node-version', 'ungoverned'];

/* ------------------------------------------------------- semver, a subset --
 * Only what `engines.node` ranges actually use, and only what the two rules
 * above need: the lowest version satisfying a range, and whether one concrete
 * version satisfies it. Both are derived from ONE comparator parser, so there
 * is a single answer to "is this a shape we understand" — two parsers that
 * disagreed about that would put a range under one rule and out of the other.
 */

function cmp(a, b) {
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}

const fmt = (v) => v.join('.');
const show = (b) => fmt(b.v) + (b.exclusive ? ' (exclusive)' : '');

/** Everything, used for `*` and for a wildcard major. */
const ANY = { lo: [0, 0, 0], loExclusive: false, hi: null, hiExclusive: false };

/** Ceiling of `^v`, which is special-cased all the way down for 0.x. */
function caretCeiling(v, hasMinor, hasPatch) {
  if (v[0] > 0) return [v[0] + 1, 0, 0];
  if (!hasMinor) return [1, 0, 0];
  if (v[1] > 0 || !hasPatch) return [0, v[1] + 1, 0];
  return [0, 0, v[2] + 1];
}

/**
 * One comparator as a half-open-ish interval, or null if this parser does not
 * understand it. `hi === null` means unbounded above.
 */
function parseComparator(token) {
  const t = token.trim();
  if (t === '' || t === '*' || t === 'x' || t === 'X') return ANY;
  const m = /^(>=|<=|>|<|=|\^|~)?\s*v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:[-+][0-9A-Za-z.-]+)?$/.exec(t);
  if (!m) return null;
  const op = m[1] ?? '';
  const wild = (p) => p === undefined || p === 'x' || p === 'X' || p === '*';
  if (wild(m[2])) return ANY;
  const hasMinor = !wild(m[3]);
  const hasPatch = !wild(m[4]);
  const v = [Number(m[2]), hasMinor ? Number(m[3]) : 0, hasPatch ? Number(m[4]) : 0];
  // `<` and `<=` constrain only the top of the range; they leave the floor at zero.
  if (op === '<') return { lo: [0, 0, 0], loExclusive: false, hi: v, hiExclusive: true };
  if (op === '<=') return { lo: [0, 0, 0], loExclusive: false, hi: v, hiExclusive: false };
  if (op === '>') return { lo: v, loExclusive: true, hi: null, hiExclusive: false };
  if (op === '>=') return { lo: v, loExclusive: false, hi: null, hiExclusive: false };
  if (op === '^') return { lo: v, loExclusive: false, hi: caretCeiling(v, hasMinor, hasPatch), hiExclusive: true };
  if (op === '~') {
    return { lo: v, loExclusive: false, hi: hasMinor ? [v[0], v[1] + 1, 0] : [v[0] + 1, 0, 0], hiExclusive: true };
  }
  // `=X` and a bare `X`: a partial version is a range over the parts it omits,
  // so `20` is every 20.x and `6.*` is every 6.x — which is why the reduction
  // and the satisfies check disagree about `18 || 20 || >=22` at 19.0.0.
  if (!hasMinor) return { lo: v, loExclusive: false, hi: [v[0] + 1, 0, 0], hiExclusive: true };
  if (!hasPatch) return { lo: v, loExclusive: false, hi: [v[0], v[1] + 1, 0], hiExclusive: true };
  return { lo: v, loExclusive: false, hi: v, hiExclusive: false };
}

/** Comparator tokens of one disjunct (`14 >=14.17`, `1.0.0 - 2.0.0`). */
function tokenize(text) {
  // A comparator may be separated from its version by spaces — `>= 0.10` and
  // `>= 10.*` are both in this repo's lockfile today. Glue those back together
  // before splitting, or the operator becomes a token of its own and the whole
  // range reads as unparseable. (The self-test caught exactly that.) The
  // hyphen of a `A - B` range is deliberately not in this operator set.
  return text
    .replace(/(>=|<=|>|<|=|\^|~)\s+/g, '$1')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Lower bound of one comparator, or null if this parser does not understand it. */
function comparatorLowerBound(token) {
  const c = parseComparator(token);
  return c === null ? null : { v: c.lo, exclusive: c.loExclusive };
}

/** Lower bound of one space-separated conjunction (`14 >=14.17`, `1.0.0 - 2.0.0`). */
function disjunctLowerBound(text) {
  const tokens = tokenize(text);
  if (!tokens.length) return { v: [0, 0, 0], exclusive: false };
  // Hyphen range: "A - B" is inclusive of A, so A is the floor.
  if (tokens.length === 3 && tokens[1] === '-') return comparatorLowerBound(tokens[0]);
  let best = { v: [0, 0, 0], exclusive: false };
  for (const token of tokens) {
    const bound = comparatorLowerBound(token);
    if (!bound) return null;
    const c = cmp(bound.v, best.v);
    if (c > 0 || (c === 0 && bound.exclusive)) best = bound;
  }
  return best;
}

/** Lowest version satisfying a whole range, or null if any part is unparseable. */
function rangeLowerBound(range) {
  let best = null;
  for (const part of String(range).split('||')) {
    const bound = disjunctLowerBound(part);
    if (!bound) return null;
    const c = best === null ? -1 : cmp(bound.v, best.v);
    if (c < 0 || (c === 0 && best.exclusive && !bound.exclusive)) best = bound;
  }
  return best;
}

/** Does one concrete version fall inside one comparator's interval? */
function satisfiesComparator(v, c) {
  const low = cmp(v, c.lo);
  if (c.loExclusive ? low <= 0 : low < 0) return false;
  if (c.hi !== null) {
    const high = cmp(v, c.hi);
    if (c.hiExclusive ? high >= 0 : high > 0) return false;
  }
  return true;
}

/** Does one concrete version satisfy a conjunction? null if unparseable. */
function satisfiesDisjunct(v, text) {
  const tokens = tokenize(text);
  if (!tokens.length) return true;
  if (tokens.length === 3 && tokens[1] === '-') {
    const lower = parseComparator(tokens[0]);
    const upper = parseComparator(tokens[2]);
    if (lower === null || upper === null) return null;
    if (cmp(v, lower.lo) < 0) return false;
    // "A - B" runs to the END of a partial B, which is exactly the ceiling
    // `parseComparator` already computed for a bare version.
    if (upper.hi === null) return true;
    return upper.hiExclusive ? cmp(v, upper.hi) < 0 : cmp(v, upper.hi) <= 0;
  }
  for (const token of tokens) {
    const c = parseComparator(token);
    if (c === null) return null;
    if (!satisfiesComparator(v, c)) return false;
  }
  return true;
}

/** Does one concrete version satisfy a whole range? null if any part is unparseable. */
function satisfiesRange(v, range) {
  let satisfied = false;
  for (const part of String(range).split('||')) {
    const ok = satisfiesDisjunct(v, part);
    if (ok === null) return null;
    if (ok) satisfied = true;
  }
  return satisfied;
}

/** Does a declared floor version clear a required lower bound? */
function meets(declared, required) {
  const c = cmp(declared, required.v);
  return required.exclusive ? c > 0 : c >= 0;
}

/**
 * The lowest concrete version a declaration actually claims to support. For
 * `>22.0.0` that is 22.0.1, not 22.0.0 — testing the excluded version itself
 * would let a `>` declaration walk past the satisfies check on a technicality.
 */
function lowestClaimed(floor) {
  return floor.exclusive ? [floor.v[0], floor.v[1], floor.v[2] + 1] : floor.v;
}

/* ------------------------------------------------------------- lockfile -- */

/**
 * Pull every `engines.node` out of a pnpm lockfile without a YAML parser.
 *
 * `raw` counts the lines that mention `engines:` and `unreadable` collects the
 * ones that did not yield a flow map. Both exist so that a lockfile format
 * change surfaces as a red `coverage` finding instead of an empty scan that
 * exits 0.
 */
function scanLockfile(text) {
  const entries = [];
  const unreadable = [];
  let raw = 0;
  let pkg = null;
  for (const line of text.split('\n')) {
    const header = /^ {2}(\S.*):$/.exec(line);
    if (header) pkg = header[1].replace(/^'(.*)'$/, '$1');
    if (!/(^|\s)engines:/.test(line)) continue;
    raw += 1;
    const flow = /engines:\s*\{(.*)\}\s*$/.exec(line);
    if (!flow) {
      unreadable.push(line.trim());
      continue;
    }
    const node = /(?:^|[,{\s])node:\s*(?:'([^']*)'|"([^"]*)"|([^,}]+))/.exec(flow[1]);
    // An engines block with no `node` key (npm/pnpm only) is legal and not a finding.
    if (!node) continue;
    entries.push({ pkg: pkg ?? '(unknown)', range: (node[1] ?? node[2] ?? node[3]).trim() });
  }
  return { entries, unreadable, raw };
}

/* ------------------------------------------------- workspace discovery -- */

/** The `packages:` globs from `pnpm-workspace.yaml`. */
function workspaceGlobs(root) {
  const path = join(root, 'pnpm-workspace.yaml');
  if (!existsSync(path)) return [];
  const globs = [];
  let inPackages = false;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    const item = /^\s+-\s*['"]?([^'"#\s]+)['"]?\s*$/.exec(line);
    if (item) globs.push(item[1]);
    else if (/^\S/.test(line)) inPackages = false;
  }
  return globs;
}

/**
 * Every workspace `package.json`, plus the globs that could not be expanded.
 * Only the `dir/*` shape is expanded — anything else is reported rather than
 * silently skipped, so the blind spot stays visible.
 */
function workspacePackages(root) {
  const files = ['package.json'];
  const unexpanded = [];
  for (const glob of workspaceGlobs(root)) {
    const m = /^([^*!]+)\/\*$/.exec(glob);
    if (!m) {
      unexpanded.push(glob);
      continue;
    }
    const dir = join(root, m[1]);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const rel = `${m[1]}/${entry.name}/package.json`;
      if (existsSync(join(root, rel))) files.push(rel);
    }
  }
  return { files, unexpanded };
}

/* --------------------------------------------------------------- inputs -- */

/** Read the declared surface off disk. Missing inputs are findings, not throws. */
function collect(root) {
  const missing = [];
  const declarations = [];
  for (const file of DECLARATION_FILES) {
    const path = join(root, file);
    if (!existsSync(path)) {
      missing.push(file);
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      missing.push(`${file} (unparseable JSON: ${err.message})`);
      continue;
    }
    declarations.push({ source: file, value: parsed?.engines?.node ?? null });
  }
  // Declarations this gate does NOT govern, reported so the blind spot is visible.
  const ungoverned = [];
  const { files: wsFiles, unexpanded } = workspacePackages(root);
  for (const file of wsFiles) {
    if (DECLARATION_FILES.includes(file)) continue;
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(join(root, file), 'utf8'));
    } catch {
      continue;
    }
    const value = parsed?.engines?.node;
    if (value) ungoverned.push({ source: file, value });
  }

  const nvPath = join(root, '.node-version');
  const lockPath = join(root, 'pnpm-lock.yaml');
  if (!existsSync(nvPath)) missing.push('.node-version');
  if (!existsSync(lockPath)) missing.push('pnpm-lock.yaml');
  return {
    declarations,
    nodeVersion: existsSync(nvPath) ? readFileSync(nvPath, 'utf8') : null,
    lock: existsSync(lockPath) ? readFileSync(lockPath, 'utf8') : null,
    missing,
    ungoverned,
    unexpanded,
  };
}

/* ---------------------------------------------------------------- rules -- */

function evaluate({ declarations, nodeVersion, lock, missing = [], ungoverned = [], unexpanded = [] }) {
  const findings = [];
  const add = (rule, detail) => findings.push({ rule, detail });

  for (const file of missing) {
    add('coverage', `${file} is not where this gate looks for it — it checked nothing for that file`);
  }

  const scan = lock === null ? { entries: [], unreadable: [], raw: 0 } : scanLockfile(lock);
  for (const line of scan.unreadable) {
    add('coverage', `an engines line is not the flow-map form this parser reads, so its floor was not counted: ${line}`);
  }
  if (lock !== null && scan.entries.length === 0) {
    add(
      'coverage',
      'no engines.node entries were found in pnpm-lock.yaml. The scan matched nothing, ' +
        'so a green result here would prove nothing. Re-verify this parser against the lockfile format.',
    );
  }

  // Maximum floor the dependency tree demands.
  let required = null;
  let requiredBy = [];
  for (const entry of scan.entries) {
    const bound = rangeLowerBound(entry.range);
    if (!bound) {
      add('range', `${entry.pkg}: engines.node ${JSON.stringify(entry.range)} is not a range this parser understands`);
      continue;
    }
    const c = required === null ? 1 : cmp(bound.v, required.v);
    if (c > 0 || (c === 0 && bound.exclusive && !required.exclusive)) {
      required = bound;
      requiredBy = [entry.pkg];
    } else if (c === 0 && bound.exclusive === required.exclusive) {
      requiredBy.push(entry.pkg);
    }
  }

  // Declared floors.
  const floors = [];
  for (const decl of declarations) {
    if (decl.value === null || decl.value === undefined) {
      add('declarations', `${decl.source} declares no engines.node — this gate has nothing to check there`);
      continue;
    }
    const bound = rangeLowerBound(decl.value);
    if (!bound) {
      add('range', `${decl.source}: engines.node ${JSON.stringify(decl.value)} is not a range this parser understands`);
      continue;
    }
    floors.push({ source: decl.source, raw: decl.value, v: bound.v, exclusive: bound.exclusive });
  }

  // The declarations must agree with each other, semantically — ">=22" and
  // ">=22.0.0" are byte-different and mean the same floor, which is fine.
  for (let i = 1; i < floors.length; i += 1) {
    if (cmp(floors[i].v, floors[0].v) !== 0) {
      add(
        'declarations',
        `${floors[0].source} declares ${JSON.stringify(floors[0].raw)} (floor ${fmt(floors[0].v)}) but ` +
          `${floors[i].source} declares ${JSON.stringify(floors[i].raw)} (floor ${fmt(floors[i].v)})`,
      );
    }
  }

  // The rule this gate exists for.
  if (required !== null) {
    for (const floor of floors) {
      if (!meets(floor.v, required)) {
        add(
          'lockfile',
          `${floor.source} declares engines.node ${JSON.stringify(floor.raw)} (floor ${fmt(floor.v)}), below the ` +
            `${show(required)} the dependency tree requires — demanded by ${requiredBy.slice(0, 3).join(', ')}` +
            `${requiredBy.length > 3 ? ` and ${requiredBy.length - 3} more` : ''}`,
        );
      }
    }
  }

  // The strengthened rule: the floor is not just a number to compare against,
  // it is a version this repo says works. So every dependency must actually
  // support it. This sees INSIDE a disjunction, which the reduction above
  // cannot: a range whose minimum is far below the floor can still exclude the
  // floor itself. Findings are grouped by range, because one gap is normally
  // one range shared by several packages, and a per-package list would report
  // the same defect many times.
  //
  // An unparseable range yields null here and is skipped — `range` has already
  // reported it, and a second finding for the same unread text would double-
  // count one defect rather than name two.
  for (const floor of floors) {
    const claimed = lowestClaimed(floor);
    const offenders = new Map();
    for (const entry of scan.entries) {
      if (satisfiesRange(claimed, entry.range) !== false) continue;
      const packages = offenders.get(entry.range) ?? [];
      packages.push(entry.pkg);
      offenders.set(entry.range, packages);
    }
    for (const [range, packages] of offenders) {
      add(
        'unsupported',
        `${floor.source} declares engines.node ${JSON.stringify(floor.raw)}, so it claims Node ` +
          `${fmt(claimed)} is supported — but ${packages.slice(0, 3).join(', ')}` +
          `${packages.length > 3 ? ` and ${packages.length - 3} more` : ''} declare${packages.length === 1 ? 's' : ''} ` +
          `engines.node ${JSON.stringify(range)}, which ${fmt(claimed)} does not satisfy`,
      );
    }
  }

  // `.node-version` is a version-manager pin, not a range. A bare major is a
  // LINE pin ("latest 22.x"), so only its major is comparable; comparing it as
  // 22.0.0 against a floor of 22.12.0 would be a false red on a correct repo.
  // A pin that names a minor is a concrete version and must clear the floor.
  if (nodeVersion !== null) {
    const nvRaw = nodeVersion.trim();
    const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(nvRaw);
    if (!m) {
      add('node-version', `.node-version is ${JSON.stringify(nvRaw)}, which is not a version this gate can compare`);
    } else {
      const pin = [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
      const pinsMinor = m[2] !== undefined;
      for (const floor of floors) {
        if (pin[0] !== floor.v[0]) {
          add(
            'node-version',
            `.node-version pins ${nvRaw} (major ${pin[0]}) but ${floor.source} declares ` +
              `${JSON.stringify(floor.raw)} (major ${floor.v[0]})`,
          );
        } else if (pinsMinor && cmp(pin, floor.v) < 0) {
          add(
            'node-version',
            `.node-version pins ${nvRaw}, below the ${fmt(floor.v)} floor declared in ${floor.source}`,
          );
        }
      }
    }
  }

  for (const u of ungoverned) {
    add(
      'ungoverned',
      `${u.source} declares engines.node ${JSON.stringify(u.value)}, which this gate does not check — ` +
        `it governs ${DECLARATION_FILES.join(' and ')} only`,
    );
  }
  for (const g of unexpanded) {
    add(
      'ungoverned',
      `pnpm-workspace.yaml pattern ${JSON.stringify(g)} is not a shape this gate expands, so any ` +
        'package.json it matches was not inspected for an engines.node declaration',
    );
  }

  return { findings, required, requiredBy, floors, scan };
}

/* --------------------------------------------------------------- output -- */

/** Split findings into what fails the job and what is only reported. */
function classify(findings) {
  const blocking = [];
  const advisory = [];
  for (const f of findings) (ADVISORY.has(f.rule) ? advisory : blocking).push(f);
  return { blocking, advisory };
}

function gate() {
  const inputs = collect(ROOT);
  const { findings, required, requiredBy, floors, scan } = evaluate(inputs);
  const { blocking, advisory } = classify(findings);

  console.log('## Node floor');
  console.log('');
  console.log('| Declaration | Value | Floor |');
  console.log('| --- | --- | --- |');
  for (const floor of floors) console.log(`| \`${floor.source}\` | \`${floor.raw}\` | ${fmt(floor.v)} |`);
  if (inputs.nodeVersion !== null) console.log(`| \`.node-version\` | \`${inputs.nodeVersion.trim()}\` | pin |`);
  console.log('');
  console.log(
    `Scanned \`pnpm-lock.yaml\`: ${scan.raw} \`engines\` block(s), ${scan.entries.length} with a \`node\` range.`,
  );
  if (required !== null) {
    console.log(
      `Highest floor the tree requires: **${show(required)}** ` +
        `(${requiredBy.slice(0, 3).join(', ')}${requiredBy.length > 3 ? `, +${requiredBy.length - 3}` : ''}).`,
    );
  }
  console.log('');

  if (blocking.length) {
    console.log(`❌ ${blocking.length} finding(s).`);
    console.log('');
    for (const f of blocking) console.log(`- **${f.rule}** — ${f.detail}`);
    console.log('');
  } else {
    console.log('✅ Every declared floor clears what the dependency tree requires, and the declarations agree.');
    console.log('');
  }

  if (advisory.length) {
    console.log(`ℹ️ ${advisory.length} note(s), reported and not blocking:`);
    console.log('');
    for (const f of advisory) console.log(`- **${f.rule}** — ${f.detail}`);
  }

  if (blocking.length) {
    console.error(`\n✗ node floor: ${blocking.length} finding(s)`);
    for (const f of blocking) console.error(`    [${f.rule}] ${f.detail}`);
    process.exit(1);
  }
}

/* ------------------------------------------------------------ self-test --
 * 裁决 (PR #74): a validator observed only green is indistinguishable from one
 * that cannot go red. Every rule ships the fixture that trips it, and the
 * assertion is on the EXACT set of rules fired — a fixture that goes red for
 * the wrong reason proves nothing about the rule it was written for.
 *
 * Fixtures are written to a temp directory and read back through `collect()`,
 * so the reader is exercised too: a gate whose rules are all provably able to
 * fire, wired to a reader that silently returns nothing, is still a gate that
 * cannot go red.
 */

const CLEAN_LOCK = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

packages:

  left-pad@1.0.0:
    resolution: {integrity: sha512-aaa}
    engines: {node: '>=10'}

  wrangler@4.95.0:
    resolution: {integrity: sha512-bbb}
    engines: {node: '>=22.0.0'}

  yargs@18.0.0:
    resolution: {integrity: sha512-ccc}
    engines: {node: '^20.19.0 || ^22.12.0 || >=23'}

  only-npm@1.0.0:
    resolution: {integrity: sha512-ddd}
    engines: {npm: '>=8'}
`;

const LOW_LOCK = CLEAN_LOCK.replace("'>=22.0.0'", "'>=18.0.0'").replace(
  "'^20.19.0 || ^22.12.0 || >=23'",
  "'>=18'",
);

const CASES = [
  {
    name: 'clean baseline',
    expect: [],
    // ">=22.12.0" and ">=22.12" are byte-different and identical as floors, and
    // every workspace package.json that declares a floor is a governed one.
    // `unsupported` is silent here for the reason that matters: the floor sits
    // INSIDE the `^22.12.0` branch of the lockfile's disjunctive range, which
    // is the state this repo had to reach for the rule to be green at all.
    ignores: ['declarations', 'ungoverned', 'unsupported'],
  },
  {
    name: 'declared floor below what the tree requires',
    root: '>=20',
    docs: '>=20.0.0',
    ci: '>=20.0.0',
    nodeVersion: '20',
    // Both rules fire, and that is structural rather than sloppy: a floor
    // below the max-of-minimums necessarily fails to satisfy the range that
    // produced that minimum. Pinned as a pair so that a future change making
    // them independent has to say so here.
    expect: ['lockfile', 'unsupported'],
  },
  {
    name: 'dependency floors far below the declaration',
    lock: LOW_LOCK,
    expect: [],
    // The direction guard: this is the normal case and must never fire. It
    // covers both rules — a dependency asking for far less than the
    // declaration neither raises the required floor nor excludes it.
    ignores: ['lockfile', 'unsupported'],
  },
  {
    name: 'the two engines declarations disagree',
    // Both values clear the lockfile's disjunctive gap, so this case reports
    // the disagreement and nothing else — a fixture that also tripped
    // `unsupported` would not prove `declarations` fired for its own reason.
    root: '>=22.12.0',
    docs: '>=22.13.0',
    expect: ['declarations'],
  },
  {
    name: 'a declaration was removed',
    docs: null,
    expect: ['declarations'],
  },
  {
    name: 'node-version on a different major',
    nodeVersion: '20',
    expect: ['node-version'],
  },
  {
    name: 'node-version pinned below the declared floor',
    root: '>=22.12.0',
    docs: '>=22.12.0',
    nodeVersion: '22.5.0',
    expect: ['node-version'],
  },
  {
    name: 'node-version as a bare major line pin',
    root: '>=22.12.0',
    docs: '>=22.12.0',
    nodeVersion: '22',
    expect: [],
    // A bare major is "latest 22.x"; judging it as 22.0.0 would be a false red.
    ignores: ['node-version'],
  },
  {
    name: 'a lockfile range this parser cannot read',
    lock: CLEAN_LOCK.replace("'>=10'", "'latest'"),
    expect: ['range'],
  },
  {
    name: 'a declared range this parser cannot read',
    root: 'lts/*',
    expect: ['range'],
  },
  {
    name: 'a lockfile with no engines at all',
    lock: "lockfileVersion: '9.0'\n\npackages:\n\n  left-pad@1.0.0:\n    resolution: {integrity: sha512-aaa}\n",
    expect: ['coverage'],
  },
  {
    name: 'an engines block the parser cannot read',
    lock: CLEAN_LOCK.replace("    engines: {node: '>=10'}", "    engines:\n      node: '>=24'"),
    expect: ['coverage'],
  },
  {
    // The case the whole rule exists for, and the one `lockfile` structurally
    // cannot catch: 22.0.0 clears every minimum in the tree (the maximum is
    // 22.0.0, from wrangler) and still satisfies no branch of
    // `^20.19.0 || ^22.12.0 || >=23`. These were this repo's own declared
    // values until the rule landed, so this fixture is also the regression
    // test for them. `lockfile` staying silent here is the whole point.
    name: 'a floor inside a gap in a disjunctive range',
    root: '>=22',
    docs: '>=22.0.0',
    ci: '>=22.0.0',
    expect: ['unsupported'],
  },
  {
    // An exclusive floor claims support starting one patch up, so that is the
    // version tested. Judging 22.0.0 here would let `>22.0.0` past a check
    // that `>=22` fails, for a version it does not even claim.
    name: 'an exclusive floor lands in the same gap',
    root: '>22.0.0',
    docs: '>22.0.0',
    ci: '>22.0.0',
    expect: ['unsupported'],
  },
  {
    // The regression test for governing `tools/ci-scripts`: this disagreement
    // is invisible unless that third file is actually read as a declaration.
    // A minor-level difference keeps it isolated — the bare-major
    // `.node-version` pin compares majors only, and both values clear the
    // lockfile's gap, so `declarations` fires alone.
    name: 'the tools/ci-scripts declaration disagrees',
    ci: '>=22.13.0',
    expect: ['declarations'],
  },
  {
    name: 'a workspace package outside the governed set',
    extra: { 'tools/thing/package.json': { engines: { node: '>=20.0.0' } } },
    expect: ['ungoverned'],
  },
  {
    name: 'a workspace glob shape this gate cannot expand',
    workspace: 'packages:\n  - apps/*\n  - tools/**\n',
    expect: ['ungoverned'],
  },
];

/** The reduction, pinned on the exact range shapes this repo's lockfile contains. */
const RANGE_CASES = [
  ['>=22.0.0', '22.0.0'],
  ['>= 0.10', '0.10.0'],
  ['18 || 20 || >=22', '18.0.0'],
  ['20 || >=22', '20.0.0'],
  ['^20.19.0 || ^22.12.0 || >=23', '20.19.0'],
  ['>=16 || 14 >=14.17', '14.17.0'],
  ['6.* || 8.* || >= 10.*', '6.0.0'],
  ['4.x || >=6.0.0', '4.0.0'],
  ['^18.17.0 || ^20.3.0 || >=21.0.0', '18.17.0'],
  ['^12.17.0 || ^14.13 || >=16.0.0', '12.17.0'],
  ['^10 || ^12 || ^13.7 || ^14 || >=15.0.1', '10.0.0'],
  ['~18.2.0', '18.2.0'],
  ['*', '0.0.0'],
  ['18.0.0 - 20.0.0', '18.0.0'],
  ['<=18.0.0', '0.0.0'],
  ['>20.1.0', '20.1.0 (exclusive)'],
  ['lts/*', null],
  ['latest', null],
];

/**
 * The satisfies predicate, pinned where it DISAGREES with the reduction above —
 * that disagreement is the rule. Every left column here is a range shape this
 * repo's lockfile actually contains.
 */
const SATISFIES_CASES = [
  // The gap. Its lower bound is 20.19.0, so the reduction waves 22.0.0 through.
  ['^20.19.0 || ^22.12.0 || >=23', '22.0.0', false],
  ['^20.19.0 || ^22.12.0 || >=23', '22.11.99', false],
  ['^20.19.0 || ^22.12.0 || >=23', '22.12.0', true],
  ['^20.19.0 || ^22.12.0 || >=23', '23.4.1', true],
  ['^20.19.0 || ^22.12.0 || >=23', '20.19.0', true],
  ['^20.19.0 || ^22.12.0 || >=23', '20.18.0', false],
  // A bare major is a whole line, so this range has a hole at 19 and 21.
  ['18 || 20 || >=22', '19.0.0', false],
  ['18 || 20 || >=22', '20.9.9', true],
  ['18 || 20 || >=22', '22.12.0', true],
  // An upper bound the reduction discards entirely: lower bound 0.0.0, and
  // 22.12.0 nonetheless outside it.
  ['<=18.0.0', '22.12.0', false],
  ['18.0.0 - 20.0.0', '20.0.0', true],
  ['18.0.0 - 20.0.0', '20.0.1', false],
  ['~18.2.0', '18.2.9', true],
  ['~18.2.0', '18.3.0', false],
  ['>20.1.0', '20.1.0', false],
  ['>20.1.0', '20.1.1', true],
  // A conjunction inside a disjunct.
  ['>=16 || 14 >=14.17', '14.18.0', true],
  ['>=16 || 14 >=14.17', '14.16.0', false],
  // The ordinary shapes, which must simply be true at the repo's floor.
  ['>= 0.10', '22.12.0', true],
  ['6.* || 8.* || >= 10.*', '22.12.0', true],
  ['4.x || >=6.0.0', '22.12.0', true],
  ['^12.17.0 || ^14.13 || >=16.0.0', '22.12.0', true],
  ['*', '22.12.0', true],
  // Unparseable is neither true nor false: `range` reports it, this stays out.
  ['lts/*', '22.12.0', null],
];

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'node-floor-'));
  let failed = 0;
  try {
    for (const c of CASES) {
      const root = 'root' in c ? c.root : '>=22.12.0';
      const docs = 'docs' in c ? c.docs : '>=22.12';
      const ci = 'ci' in c ? c.ci : '>=22.12.0';
      // Cleared first, so a previous case's `extra` package cannot linger and
      // so the governed third declaration below survives into the fixture.
      rmSync(join(dir, 'tools'), { recursive: true, force: true });
      mkdirSync(join(dir, 'apps/docs'), { recursive: true });
      mkdirSync(join(dir, 'tools/ci-scripts'), { recursive: true });
      writeFileSync(join(dir, 'package.json'), JSON.stringify(root === null ? {} : { engines: { node: root } }));
      writeFileSync(
        join(dir, 'apps/docs/package.json'),
        JSON.stringify(docs === null ? {} : { engines: { node: docs } }),
      );
      writeFileSync(
        join(dir, 'tools/ci-scripts/package.json'),
        JSON.stringify(ci === null ? {} : { engines: { node: ci } }),
      );
      writeFileSync(join(dir, '.node-version'), `${c.nodeVersion ?? '22'}\n`);
      writeFileSync(join(dir, 'pnpm-lock.yaml'), c.lock ?? CLEAN_LOCK);
      // A real workspace file, so the baseline exercises the governed-file
      // exclusion rather than skipping discovery altogether.
      writeFileSync(join(dir, 'pnpm-workspace.yaml'), c.workspace ?? 'packages:\n  - apps/*\n  - tools/*\n');
      for (const [rel, body] of Object.entries(c.extra ?? {})) {
        mkdirSync(dirname(join(dir, rel)), { recursive: true });
        writeFileSync(join(dir, rel), JSON.stringify(body));
      }

      const { findings } = evaluate(collect(dir));
      const fired = [...new Set(findings.map((f) => f.rule))].sort();
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
      if (!ok) for (const f of findings) console.error(`      [${f.rule}] ${f.detail}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log('');
  for (const [range, version, expected] of SATISFIES_CASES) {
    const got = satisfiesRange(version.split('.').map(Number), range);
    const ok = got === expected;
    if (!ok) failed += 1;
    console.log(
      `${ok ? '✓' : '✗'} satisfies ${version.padEnd(9)} ${JSON.stringify(range).padEnd(34)} -> ${got}` +
        (ok ? '' : `  expected ${expected}`),
    );
  }

  console.log('');
  for (const [range, expected] of RANGE_CASES) {
    const bound = rangeLowerBound(range);
    const got = bound === null ? null : show(bound);
    const ok = got === expected;
    if (!ok) failed += 1;
    console.log(`${ok ? '✓' : '✗'} range ${JSON.stringify(range).padEnd(38)} -> ${got ?? 'unparseable'}` + (ok ? '' : `  expected ${expected ?? 'unparseable'}`));
  }

  console.log('');
  // An advisory rule that quietly became blocking would turn this gate red on
  // a repo it was never meant to judge, so the split is asserted, not assumed.
  for (const rule of RULES) {
    const { blocking, advisory } = classify([{ rule, detail: 'probe' }]);
    const wantAdvisory = ADVISORY.has(rule);
    const ok = wantAdvisory ? advisory.length === 1 && blocking.length === 0 : blocking.length === 1 && advisory.length === 0;
    if (!ok) failed += 1;
    console.log(`${ok ? '✓' : '✗'} classify ${rule.padEnd(14)} -> ${wantAdvisory ? 'advisory (reported)' : 'blocking'}`);
  }

  console.log('');
  const covered = new Set(CASES.flatMap((c) => c.expect));
  for (const rule of RULES) {
    if (!covered.has(rule)) {
      console.error(`✗ rule "${rule}" has no fixture that trips it`);
      failed += 1;
    }
  }
  const silent = new Set(CASES.flatMap((c) => c.ignores ?? []));
  for (const rule of SILENT_RULES) {
    if (!silent.has(rule)) {
      console.error(`✗ rule "${rule}" has no fixture that proves it stays silent`);
      failed += 1;
    }
  }

  if (failed) {
    console.error(`\n✗ self-test: ${failed} case(s) did not behave as declared`);
    process.exit(1);
  }
  console.log(
    `✓ self-test: ${CASES.length} rule case(s), ${SATISFIES_CASES.length} satisfies case(s) and ` +
      `${RANGE_CASES.length} range case(s) — every rule demonstrated able to fail, every ` +
      'silence-bearing rule demonstrated able to stay silent',
  );
}

function main() {
  if (process.argv.slice(2).some((a) => a === '--self-test')) return selfTest();
  return gate();
}

main();
