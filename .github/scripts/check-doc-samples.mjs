#!/usr/bin/env node
/**
 * Docs code samples parse — every ts/js block on an English page, checked against the
 * `@objectstack/spec` this repository pins (#316).
 *
 * ## Why this exists
 *
 * A reader copies a sample and gets a schema error. #301, #307 and #316 each found a batch of
 * them by hand: flows written in a step shape the spec retired, views missing a key that became
 * required, an import of a type that left the package, a removed agent key. The spec closes a
 * shape or retires a key in most releases, so a sample that parsed the day it was written can be
 * refused by the next release — and nothing ran the samples. This gate does, on the pull request
 * that writes a sample and on the dependency bump that moves the spec under it.
 *
 * ## What it reads
 *
 * Every English page under `content/docs/` (a file with a locale suffix from
 * `apps/docs/lib/i18n.ts` is a translation of one, and is not read), and in it every fenced block
 * whose language is `ts`, `js` or a dialect of them. A `bash`, `json`, `yaml` or `text` block is
 * not a sample of the spec's TypeScript surface and is not read.
 *
 * ## How a block is judged — the first rule that matches decides
 *
 *   1. **Opted out** (SKIP): the marker below is the last line before its fence.
 *   2. **Not a spec sample** (N/A): it imports only from packages other than `@objectstack/spec`
 *      (a plugin's options, `node:crypto`), or it constructs only a class an earlier block on the
 *      page imported from one.
 *   3. **CEL strings**, one quoted string per line: only the slot shape is checked
 *      (`EvaluatedExpressionInputSchema`). The spec ships no CEL parser, so an expression's
 *      meaning is out of reach here.
 *   4. **A fragment** — an object literal, or `key: value` pairs: its first comment says what it
 *      is (the kinds below), and it is parsed inside the smallest whole it belongs to. Pairs whose
 *      every value is built by `Field.*` are fields of an object without saying so.
 *   5. **Statements**, evaluated as published, with only TypeScript syntax removed. Every call of a
 *      spec constructor is a parse: `define*()`, `ObjectSchema.create()`, `Action.create()`,
 *      `App.create()`, `Dashboard.create()`. A `Field.*` statement is parsed as a field of an
 *      object, `defineDataset()` (which does not parse) is followed by `DatasetSchema.parse`, and
 *      a declaration typed `const x: T` parses its value with `TSchema`. Imports are checked too:
 *      a value must be exported by the entry point it is imported from, and a type import is
 *      resolved by the TypeScript compiler against the spec's declarations.
 *
 * Every flow any rule produces is also parsed node by node against the executor contracts
 * (`getBuiltinNodeConfigContracts()`) — what each executor parses before it runs, which is
 * stricter than `defineFlow`. A stack that declares `requires` is judged again with every flow
 * its page declares, because that is where `requires` is decided. A block that matches no rule
 * fails; nothing is skipped quietly.
 *
 * A page is read in order: a later block sees the spec names an earlier one imported and the
 * values it declared. A block that imports from a relative path (`./src/objects`) is judged after
 * the rest of its page, with those declarations bound to its imports.
 *
 * ## Fragments say what they are
 *
 * The first comment of a fragment names its kind, and says what it omits. The gate supplies only
 * the smallest whole around it: a name, a label, a start and an end node — never a key the
 * fragment itself was meant to carry. The phrases it knows:
 *
 *   One list view · One form view                    a list or form view (three ways, as #307)
 *   One flow node · The `config` of an `X` node      in a minimal flow (a `start` config is the start)
 *   …config.timeRelative (variants)                 a start node's time-relative trigger
 *   Keys of a `T` flow on `O`. The nodes are omitted: `a` is an `http` node, …   (#307's wrap)
 *   One field · Keys of a `T` field · Fields of an object · Keys of an object
 *   … validation rule… `validations`                 an entry of an object's validations
 *   Keys of an app · One navigation item
 *   One dashboard · Keys of a dashboard · Keys of a dashboard widget
 *   One page · Keys of a page · One page component
 *   Keys of a form view · Keys of a view container · Keys of a permission set
 *
 * "Keys of a dashboard; each widget's dataset, values and title are omitted" supplies exactly the
 * widget keys it names. A new kind is a row in `KINDS` plus a fixture it passes and one it refuses;
 * the self-test fails a kind that lacks either.
 *
 * ## The opt-out marker
 *
 *     {/* doc-sample: skip — <why> *\/}
 *
 * on the last non-blank line before the fence. It is an MDX comment: it renders nothing, and
 * `apps/docs/lib/source.ts` strips it from the llms bodies (#299). Use it for a block that is
 * deliberately not a parseable sample — a counter-example showing a refused shape, or a type
 * signature written as an object — never to quiet a refusal. A marker without a reason, a marker
 * that is not directly before a fence, and a marker on a block this gate does not read all fail.
 *
 * ## The pinned spec, and how it moves
 *
 * `.github/scripts/doc-samples/package.json` pins `@objectstack/spec` to one exact version, with
 * its `package-lock.json`, and the gate refuses to run on any other installed version. CI installs
 * it with `npm ci --prefix .github/scripts/doc-samples`. It sits OUTSIDE the pnpm workspace on
 * purpose. Measured on `cf449fa`: declaring it in a workspace package (`tools/ci-scripts`) re-resolved
 * `fumadocs-core`'s optional `zod` peer from 4.4.3 to the spec's 4.6.5 while `fumadocs-mdx` kept
 * 4.4.3 — two copies of zod inside the shipped docs build, for a CI tool.
 *
 * Bumping it: Dependabot watches that directory (`.github/dependabot.yml`, the `objectstack`
 * group) and opens the bump as a pull request. This gate runs on that pull request, so a release
 * that newly refuses a sample turns its own bump red, and the fix lands with it. By hand:
 * `npm install --prefix .github/scripts/doc-samples --save-exact @objectstack/spec@<version>`.
 *
 * TypeScript is the repository root's devDependency. It only removes TypeScript syntax before a
 * block is evaluated, and resolves type imports.
 *
 * ## What it does not check
 *
 * CEL semantics (above); what a sample does at runtime; `bash`, `json` and other blocks; prose and
 * tables. A key or type named in a table can still be wrong, and still needs a reader.
 *
 * ## Usage
 *
 *   node .github/scripts/check-doc-samples.mjs                  # gate: every English page
 *   node .github/scripts/check-doc-samples.mjs <page.mdx> ...   # only these pages
 *   node .github/scripts/check-doc-samples.mjs --docs <dir>     # another content/docs tree
 *   node .github/scripts/check-doc-samples.mjs --self-test      # fixtures; add --verbose for every row
 *
 * Exits 1 on any refused or unchecked block, and on a missing or stale install (NOT MEASURED).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const DOCS = join(ROOT, 'content/docs');
const I18N = join(ROOT, 'apps/docs/lib/i18n.ts');
const SPEC_HOME = join(HERE, 'doc-samples');
const INSTALL = 'npm ci --prefix .github/scripts/doc-samples';

const rel = (p) => relative(ROOT, p);

/* ------------------------------------------------------------------ toolchain */

/** The pinned spec and the repository's TypeScript, or a loud reason why not. */
function loadToolchain() {
  const manifest = JSON.parse(readFileSync(join(SPEC_HOME, 'package.json'), 'utf8'));
  const pin = manifest.devDependencies?.['@objectstack/spec'];
  if (!pin) throw new Error(`${rel(join(SPEC_HOME, 'package.json'))} declares no @objectstack/spec devDependency`);
  const specRequire = createRequire(join(SPEC_HOME, 'package.json'));
  let pkgFile;
  try {
    pkgFile = specRequire.resolve('@objectstack/spec/package.json');
  } catch {
    throw new Error(`@objectstack/spec is not installed for this gate — run \`${INSTALL}\``);
  }
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
  if (pkg.version !== pin) {
    throw new Error(`installed @objectstack/spec is ${pkg.version} but ${rel(join(SPEC_HOME, 'package.json'))} pins ${pin} — run \`${INSTALL}\``);
  }
  const ts = createRequire(join(ROOT, 'package.json'))('typescript');
  const entries = Object.keys(pkg.exports ?? {})
    .filter((k) => k === '.' || (k.startsWith('./') && !/\.json$/.test(k)))
    .map((k) => (k === '.' ? '@objectstack/spec' : `@objectstack/spec/${k.slice(2)}`));
  const cache = new Map();
  const load = (specifier) => {
    if (!cache.has(specifier)) cache.set(specifier, entries.includes(specifier) ? specRequire(specifier) : null);
    return cache.get(specifier);
  };
  return { version: pkg.version, pin, ts, entries, load, specRequire };
}

/* ------------------------------------------------------------------ pages and blocks */

/** Non-default locales, read from `apps/docs/lib/i18n.ts` the way check-translations.mjs reads them. */
function locales() {
  const m = readFileSync(I18N, 'utf8').match(/languages:\s*\[([^\]]+)\]/);
  if (!m) throw new Error(`could not parse languages[] out of ${rel(I18N)}`);
  return m[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter((l) => l && l !== 'en');
}

function englishPages(dir = DOCS) {
  const suffixes = locales().map((l) => `.${l}.mdx`);
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  return walk(dir).filter((f) => f.endsWith('.mdx') && !suffixes.some((s) => f.endsWith(s))).sort();
}

const CHECKED_LANGS = new Set(['ts', 'tsx', 'typescript', 'js', 'jsx', 'javascript', 'mjs', 'cjs', 'mts', 'cts']);
const MARKER = /^\s*\{\/\*\s*doc-sample:\s*skip\b\s*(?:[—–-]+\s*)?(.*?)\s*\*\/\}\s*$/;
const MARKER_LOOSE = /\{\/\*\s*doc-sample\b/;

/**
 * Every fenced block of a page, as the site renders it: a fence of three or more backticks or
 * tildes, indented at most three spaces, closed by the same character at least as long. A block's
 * opt-out marker is the last non-blank line before its fence. A marker anywhere else is an error,
 * so a marker cannot drift away from the block it was written for and keep working.
 */
export function extractBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  const problems = [];
  const fenced = new Set();
  let open = null;
  let lastNonBlank = -1;
  lines.forEach((l, n) => {
    if (open) {
      fenced.add(n);
      if (new RegExp(`^ {0,3}${open.char === '`' ? '`' : '~'}{${open.len},}\\s*$`).test(l)) {
        blocks.push({ ...open, code: open.body.join('\n') });
        open = null;
        lastNonBlank = n;
      } else open.body.push(l);
      return;
    }
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(l);
    if (m) {
      fenced.add(n);
      const info = m[2].trim();
      const marker = lastNonBlank >= 0 ? MARKER.exec(lines[lastNonBlank]) : null;
      open = { line: n + 1, char: m[1][0], len: m[1].length, lang: (info.split(/\s+/)[0] || '').toLowerCase(), body: [], skip: marker ? { reason: marker[1], line: lastNonBlank + 1 } : null };
      return;
    }
    if (l.trim()) lastNonBlank = n;
  });
  if (open) problems.push({ line: open.line, why: 'a fence that is never closed' });
  const claimed = new Set(blocks.filter((b) => b.skip).map((b) => b.skip.line));
  lines.forEach((l, n) => {
    if (!fenced.has(n) && MARKER_LOOSE.test(l) && !claimed.has(n + 1)) problems.push({ line: n + 1, why: 'a doc-sample marker that is not the last line before a fenced block' });
  });
  return { blocks, problems };
}

/* ------------------------------------------------------------------ the evaluator */

const isSpecModule = (s) => s === '@objectstack/spec' || s.startsWith('@objectstack/spec/');
const isRelative = (s) => s.startsWith('.');

/**
 * Names a block may use without importing them. A page imports once and its later blocks continue
 * it, so a block also sees every spec name an earlier block on its page imported; these are the
 * names it sees even when no block did (every root `define*` is added to them).
 */
const AMBIENT = {
  '@objectstack/spec': ['P', 'F', 'cel', 'tmpl', 'cron'],
  '@objectstack/spec/data': ['ObjectSchema', 'Field'],
  '@objectstack/spec/ui': ['Action', 'App', 'Dashboard', 'defineDataset'],
};

const short = (e) => {
  const m = String(e?.message ?? e);
  try {
    const j = JSON.parse(m);
    if (Array.isArray(j)) return j.map((x) => `${(x.path ?? []).join('.') || '(root)'}: ${String(x.message).split('\n')[0]}`).join(' · ').slice(0, 600);
  } catch { /* not a zod issue list */ }
  return m.replace(/\s+/g, ' ').slice(0, 600);
};

/** Type-import answers, shared by every evaluator: each costs a TypeScript program. */
const typeCache = new Map();

export function makeEvaluator(tc) {
  const { ts } = tc;
  const root = tc.load('@objectstack/spec');
  const data = tc.load('@objectstack/spec/data');
  const ui = tc.load('@objectstack/spec/ui');
  const auto = tc.load('@objectstack/spec/automation');
  const shared = tc.load('@objectstack/spec/shared');
  const contracts = auto.getBuiltinNodeConfigContracts();

  /* -------- a type import names a type the entry point declares -------- */
  const typeError = (specifier, name) => {
    const key = `${tc.version}#${specifier}#${name}`;
    if (!typeCache.has(key)) {
      const file = join(SPEC_HOME, '__doc_sample_type_probe__.ts');
      const source = `import type { ${name} } from '${specifier}';\nexport type Probe = ${name};\n`;
      const host = ts.createCompilerHost({});
      const getSourceFile = host.getSourceFile.bind(host);
      const fileExists = host.fileExists.bind(host);
      host.getSourceFile = (f, ...more) => (f === file ? ts.createSourceFile(f, source, ts.ScriptTarget.ES2022, true) : getSourceFile(f, ...more));
      host.fileExists = (f) => f === file || fileExists(f);
      const program = ts.createProgram([file], { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022, noEmit: true, skipLibCheck: true, types: [] }, host);
      const diags = ts.getPreEmitDiagnostics(program, program.getSourceFile(file));
      typeCache.set(key, diags.length ? diags.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join(' ') : null);
    }
    return typeCache.get(key);
  };

  /* -------- every constructor call is a judged parse -------- */
  const builtFields = new WeakSet();
  const flows = [];
  const stacks = [];
  let legs = [];
  /** Record one judgement. A refusal is recorded, never thrown, so one bad block cannot hide the next. */
  const judge = (how, fn, fallback) => {
    try { const out = fn(); legs.push({ how, ok: true }); return out; } catch (e) { legs.push({ how, ok: false, why: short(e) }); return fallback; }
  };
  const contractCheck = (flow) => {
    const issues = [];
    for (const g of auto.collectFlowGraphs(flow)) {
      for (const n of g.nodes ?? []) {
        const c = contracts.get(n.type);
        if (c && (!c.parsedWhen || c.parsedWhen(n.config ?? {}))) {
          const r = c.schema.safeParse(n.config ?? {});
          if (!r.success) issues.push(`${n.id} (${n.type}): ` + r.error.issues.map((i) => `${i.path.join('.') || '(config)'}: ${String(i.message).split('\n')[0]}`).join('; '));
        }
      }
    }
    judge(`executor contracts of ${flow?.name ?? 'the flow'}'s nodes (getBuiltinNodeConfigContracts)`, () => { if (issues.length) throw new Error(issues.join(' · ')); });
  };
  const FAILED = Symbol('refused');
  /** True while a fragment kind builds its wrap: what it defines is a stand-in, not the page's own. */
  let standIn = false;
  const asStandIn = (fn) => { standIn = true; try { return fn(); } finally { standIn = false; } };
  const wrapDefine = (name, real) => (...args) => {
    const out = judge(`${name}()`, () => real(...args), FAILED);
    if (out === FAILED) return args[0];
    if (name === 'defineFlow') { if (!standIn) flows.push(out); contractCheck(out); }
    if (name === 'defineStack' && !standIn) stacks.push(args[0]);
    if (name === 'defineDataset') judge('DatasetSchema.parse — defineDataset itself does not parse', () => ui.DatasetSchema.parse(out));
    return out;
  };
  const wrapCreate = (owner, real) => new Proxy(real, {
    get(target, prop, recv) {
      const v = Reflect.get(target, prop, recv);
      if (prop !== 'create' || typeof v !== 'function') return v;
      return (...args) => { const out = judge(`${owner}.create()`, () => v.apply(target, args), FAILED); return out === FAILED ? args[0] : out; };
    },
  });
  const wrapField = (real) => new Proxy(real, {
    get(target, prop, recv) {
      const v = Reflect.get(target, prop, recv);
      if (typeof v !== 'function') return v;
      return (...args) => { const out = v.apply(target, args); if (out && typeof out === 'object') builtFields.add(out); return out; };
    },
  });
  const bindValue = (name, value) => {
    if (typeof value === 'function' && /^define[A-Z]/.test(name)) return wrapDefine(name, value);
    if (name === 'Field' && value) return wrapField(value);
    if (value && typeof value.create === 'function' && /^[A-Z]/.test(name)) return wrapCreate(name, value);
    return value;
  };
  /** Every `define*` of the root entry point, plus the names in AMBIENT. */
  const ambient = () => {
    const out = {};
    for (const n of Object.keys(root).filter((k) => /^define[A-Z]/.test(k))) out[n] = bindValue(n, root[n]);
    for (const [mod, names] of Object.entries(AMBIENT)) for (const n of names) out[n] = bindValue(n, tc.load(mod)[n]);
    return out;
  };

  /* -------- fragment kinds: what a partial block says, in its first comment, that it is -------- */
  const DATA = { provider: 'object', object: 'doc_sample' };
  const STAND_IN = {
    http: { url: 'https://example.com/hook', method: 'POST' },
    update_record: { objectName: 'doc_sample', filter: { id: '{record.id}' }, fields: { status: 'done' } },
    notify: { recipients: '{record.owner}', title: 'Doc sample' },
  };
  const node = (id, type, config) => ({ id, type, label: id, ...(config ? { config } : {}) });
  const flowAround = (inner, extra = {}) => ({
    name: 'doc_sample_flow', label: 'Doc sample', type: 'autolaunched', status: 'active',
    nodes: [{ id: 'start', type: 'start', label: 'Start' }, ...inner, { id: 'end', type: 'end', label: 'End' }],
    edges: [...inner.map((n, k) => ({ id: `w${k}`, source: k ? inner[k - 1].id : 'start', target: n.id ?? 'missing' })), { id: 'w_end', source: inner.at(-1)?.id ?? 'start', target: 'end' }],
    ...extra,
  });
  const obj = (keys) => ({ name: 'doc_sample', label: 'Doc sample', fields: { name: { type: 'text', label: 'Name' } }, ...keys });
  const KINDS = [
    { id: 'one list view', test: /\bone list view\b/i, judge: (v, _m, b) => {
      judge('ListViewSchema.parse(fragment)', () => ui.ListViewSchema.parse(v));
      judge('defineView({ list: fragment })', () => b.defineView({ list: v }));
      judge('…with the omitted data supplied, as a listViews entry', () => b.defineView({ listViews: { v: { ...v, data: DATA } } }));
    } },
    { id: 'one form view', test: /\bone form view\b/i, judge: (v, _m, b) => {
      judge('FormViewSchema.parse(fragment)', () => ui.FormViewSchema.parse(v));
      judge('defineView({ form: fragment })', () => b.defineView({ form: v }));
      judge('…with the omitted data supplied', () => b.defineView({ form: { ...v, data: DATA } }));
    } },
    { id: 'one flow node', test: /\bone flow node\b/i, judge: (v, _m, b) => b.defineFlow(flowAround([v])) },
    { id: 'the config of a node', test: /\bthe `?config`? of an? `([a-z_]+)` node\b/i, judge: (v, m, b) => {
      const config = v.config ?? v;
      if (m[1] !== 'start') return b.defineFlow(flowAround([node('fragment', m[1], config)]));
      // A start node's config decides the flow's type: a schedule, a record change, or neither.
      const type = config.schedule || config.timeRelative || config.triggerType === 'schedule' ? 'schedule' : config.objectName ? 'record_change' : 'autolaunched';
      return b.defineFlow({ ...flowAround([]), type, ...(type === 'schedule' ? { runAs: 'system' } : {}), nodes: [{ id: 'start', type: 'start', label: 'Start', config }, { id: 'end', type: 'end', label: 'End' }], edges: [{ id: 'w', source: 'start', target: 'end' }] });
    } },
    { id: "a start node's config.timeRelative", test: /\bconfig\.timeRelative\b/i, variants: true, judge: (v, _m, b) => {
      judge('TimeRelativeTriggerSchema.parse', () => auto.TimeRelativeTriggerSchema.parse(v.timeRelative));
      b.defineFlow({ ...flowAround([]), type: 'schedule', runAs: 'system', nodes: [{ id: 'start', type: 'start', label: 'Start', config: { timeRelative: v.timeRelative } }, { id: 'end', type: 'end', label: 'End' }], edges: [{ id: 'w', source: 'start', target: 'end' }] });
    } },
    { id: 'keys of a flow', test: /\bkeys of an? `?([a-z_]+)`? flow on `([a-z_]+)`\.\s*the nodes are omitted:\s*(.*)$/i, judge: (v, m, b) => {
      const named = [...m[3].matchAll(/`([a-z_]\w*)`\s+(?:is\s+)?an?\s+`([a-z_]+)`/gi)].map(([, id, type]) => ({ id, type }));
      const missing = named.filter((n) => !STAND_IN[n.type]).map((n) => `${n.id} (${n.type})`);
      if (!named.length || missing.length) { judge('stand in for the omitted nodes', () => { throw new Error(`no stand-in for ${missing.join(', ') || 'a node the comment names'}`); }); return; }
      const ids = named.map((n) => n.id);
      const edges = v.edges ?? [];
      b.defineFlow({
        name: 'doc_sample_flow', label: 'Doc sample', type: m[1], status: 'active',
        nodes: [{ id: 'start', type: 'start', label: 'Start', config: { objectName: m[2], triggerType: 'record-after-update' } }, ...named.map((n) => node(n.id, n.type, STAND_IN[n.type])), { id: 'end', type: 'end', label: 'End' }],
        edges: [{ id: 'w_start', source: 'start', target: edges[0]?.source ?? ids[0] }, ...edges, ...ids.filter((n) => !edges.some((e) => e.source === n)).map((n, k) => ({ id: `w_end_${k}`, source: n, target: 'end' }))],
        ...Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'edges')),
      });
    } },
    { id: 'one field', test: /\bone field\b/i, judge: (v, _m, b) => b.ObjectSchema.create(obj({ fields: { doc_sample_field: v } })) },
    { id: 'keys of a field', test: /\bkeys of an? `([a-z_]+)` field\b/i, judge: (v, m, b) => b.ObjectSchema.create(obj({ fields: { doc_sample_field: { type: m[1], label: 'Doc sample', ...v } } })) },
    { id: 'fields of an object', test: /\bfields of an object\b/i, judge: (v, _m, b) => b.ObjectSchema.create(obj({ fields: v.fields ?? v })) },
    { id: 'keys of an object', test: /\bkeys of an object\b/i, judge: (v, _m, b) => b.ObjectSchema.create(obj(v)) },
    { id: 'validation rules', test: /\bvalidation rules?\b.*\bvalidations\b/i, judge: (v, _m, b) => b.ObjectSchema.create(obj({ fields: {}, validations: [v] })) },
    { id: 'keys of an app', test: /\bkeys of an app\b/i, judge: (v, _m, b) => b.App.create({ name: 'doc_sample', label: 'Doc sample', ...v }) },
    { id: 'one navigation item', test: /\bone navigation item\b/i, judge: (v, _m, b) => b.App.create({ name: 'doc_sample', label: 'Doc sample', navigation: [v] }) },
    { id: 'one dashboard', test: /\bone dashboard\b/i, judge: (v, _m, b) => b.Dashboard.create(v) },
    { id: 'keys of a dashboard', test: /\bkeys of a dashboard\b(?! widget)/i, judge: (v, _m, b, lead) => {
      // "each widget's dataset, values and title are omitted": the omitted keys are supplied, nothing else.
      const omitted = /\beach widget's ([^.]*?) (?:is|are) omitted/i.exec(lead)?.[1] ?? '';
      const fill = { ...(/\bdataset\b/.test(omitted) ? { dataset: 'doc_sample' } : {}), ...(/\bvalues\b/.test(omitted) ? { values: ['doc_sample_measure'] } : {}), ...(/\btitle\b/.test(omitted) ? { title: 'Doc sample' } : {}) };
      const widgets = v.widgets?.map((w) => ({ ...fill, ...w }));
      return b.Dashboard.create({ name: 'doc_sample', label: 'Doc sample', widgets: [], ...v, ...(widgets ? { widgets } : {}) });
    } },
    { id: 'keys of a dashboard widget', test: /\bkeys of a dashboard widget\b/i, judge: (v, _m, b) => b.Dashboard.create({ name: 'doc_sample', label: 'Doc sample', widgets: [{ id: 'doc_sample_widget', title: 'Doc sample', type: 'metric', dataset: 'doc_sample', values: ['doc_sample_measure'], ...v }] }) },
    { id: 'one page', test: /\bone page\b(?! component)/i, judge: (v, _m, b) => b.definePage(v) },
    { id: 'keys of a page', test: /\bkeys of a page\b/i, judge: (v, _m, b) => b.definePage({ name: 'doc_sample', label: 'Doc sample', type: 'app', regions: [], ...v }) },
    { id: 'one page component', test: /\bone page component\b/i, judge: (v, _m, b) => b.definePage({ name: 'doc_sample', label: 'Doc sample', type: 'app', regions: [{ name: 'main', components: [v] }] }) },
    { id: 'keys of a form view', test: /\bkeys of a form view\b/i, judge: (v) => judge('FormViewSchema.parse', () => ui.FormViewSchema.parse({ type: 'simple', data: DATA, sections: [{ fields: ['name'] }], ...v })) },
    { id: 'keys of a view container', test: /\bkeys of a view container\b/i, judge: (v, _m, b) => b.defineView(v) },
    { id: 'keys of a permission set', test: /\bkeys of a permission set\b/i, judge: (v, _m, b) => b.definePermissionSet({ name: 'doc_sample', label: 'Doc sample', objects: {}, ...v }) },
  ];
  const kindOf = (lead) => { for (const k of KINDS) { const m = k.test.exec(lead); if (m) return { k, m }; } return null; };

  /* -------- reading a block -------- */
  function analyze(code) {
    const sf = ts.createSourceFile('block.ts', code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    const imports = [];
    let restStart = 0;
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st)) break;
      const clause = st.importClause;
      const typeOnly = !!clause?.isTypeOnly;
      const names = [];
      if (clause?.name) names.push({ local: clause.name.text, imported: 'default', type: typeOnly });
      const nb = clause?.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) names.push({ local: nb.name.text, imported: '*', type: typeOnly });
      if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) names.push({ local: el.name.text, imported: (el.propertyName ?? el.name).text, type: typeOnly || el.isTypeOnly });
      imports.push({ spec: st.moduleSpecifier.text, names });
      restStart = st.end;
    }
    return { imports, rest: code.slice(restStart) };
  }
  /** The comment lines a block opens with (before and after its imports): where a fragment says what it is. */
  const leadOf = (code) => {
    const out = [];
    for (const l of code.split('\n')) {
      const t = l.trim();
      if (!t) continue;
      if (t.startsWith('//')) { out.push(t.replace(/^\/\/+\s?/, '')); continue; }
      break;
    }
    return out.join(' ');
  };
  const stripLineComments = (code) => code.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const transpile = (src) => {
    const r = ts.transpileModule(src, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, isolatedModules: true } });
    const errors = (r.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
    if (errors.length) throw new Error('syntax: ' + errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; '));
    return r.outputText;
  };
  const run = (js, bindings, declared = []) => {
    const names = Object.keys(bindings);
    const body = `${js}\n;return { ${declared.map((d) => `${JSON.stringify(d)}: (typeof ${d} === 'undefined' ? undefined : ${d})`).join(', ')} };`;
    return new Function(...names, body)(...names.map((n) => bindings[n]));
  };
  /** Top-level items of a fragment: split where bracket depth returns to zero. */
  const topLevelItems = (src) => {
    const items = [];
    let depth = 0, start = -1, quote = null;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
      if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; continue; }
      if (c === '"' || c === "'" || c === '`') { quote = c; if (depth === 0 && start < 0) start = i; continue; }
      if ('{[('.includes(c)) { if (depth === 0 && start < 0) start = i; depth++; continue; }
      if ('}])'.includes(c)) { depth--; if (depth === 0) { items.push(src.slice(start, i + 1)); start = -1; } }
    }
    return items;
  };
  const noKind = (lead) => judge('the fragment says, in its first comment, what it is', () => {
    throw new Error(`no fragment kind this gate knows in its leading comment (${lead ? JSON.stringify(lead.slice(0, 90)) : 'there is none'})`);
  });

  /** Judge one block. Returns { verdict, how, why }. */
  function evaluateBlock(block, page) {
    legs = [];
    const { imports, rest } = analyze(block.code);
    const lead = [leadOf(block.code), imports.length ? leadOf(rest) : ''].filter(Boolean).join(' ');
    const first = stripLineComments(rest).split('\n').map((l) => l.trim()).find(Boolean) ?? '';
    const done = (how, extra = {}) => {
      const bad = legs.filter((l) => !l.ok);
      return { verdict: bad.length ? 'FAIL' : 'PASS', how, why: bad.map((l) => `${l.how}: ${l.why}`).join(' || '), legs: legs.length, ...extra };
    };

    // Not a spec sample: it imports only from other modules, or builds only what such an import gave.
    const foreign = imports.filter((i) => !isSpecModule(i.spec) && !isRelative(i.spec));
    if (imports.length && foreign.length === imports.length) {
      for (const i of foreign) for (const n of i.names) page.foreign.add(n.local);
      return { verdict: 'N/A', how: `not a spec sample: it imports only from ${[...new Set(foreign.map((i) => i.spec))].join(', ')}` };
    }
    if (!imports.length) {
      const built = [...rest.matchAll(/\bnew\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
      if (built.length && built.every((c) => page.foreign.has(c))) return { verdict: 'N/A', how: `not a spec sample: it constructs ${[...new Set(built)].join(', ')}, imported on this page from a module other than @objectstack/spec` };
    }

    const bindings = { ...ambient(), ...page.scope };
    for (const imp of imports) {
      if (isSpecModule(imp.spec)) {
        const mod = tc.load(imp.spec);
        for (const n of imp.names) {
          if (!mod) { judge(`import from '${imp.spec}'`, () => { throw new Error(`not an entry point of @objectstack/spec ${tc.version}`); }); break; }
          if (n.imported === '*') { bindings[n.local] = mod; continue; }
          if (n.type) {
            judge(`import type { ${n.imported} } from '${imp.spec}'`, () => { if (typeError(imp.spec, n.imported)) throw new Error(`'${imp.spec}' exports no type ${n.imported}`); });
            page.types.set(n.local, { spec: imp.spec, name: n.imported });
            continue;
          }
          if (n.imported in mod) {
            judge(`import { ${n.imported} } from '${imp.spec}'`, () => true);
            bindings[n.local] = page.scope[n.local] = bindValue(n.imported, mod[n.imported]);
            continue;
          }
          if (!typeError(imp.spec, n.imported)) { page.types.set(n.local, { spec: imp.spec, name: n.imported }); continue; }
          judge(`import { ${n.imported} } from '${imp.spec}'`, () => { throw new Error(`'${imp.spec}' exports no ${n.imported}`); });
        }
      } else if (isRelative(imp.spec)) {
        for (const n of imp.names) {
          if (n.imported === '*') {
            const seg = imp.spec.replace(/\/index(\.[cm]?[jt]s)?$/, '').replace(/\.[cm]?[jt]s$/, '').split('/').pop();
            const want = { objects: 'object', flows: 'flow', views: 'view', datasources: 'datasource' }[seg];
            bindings[n.local] = Object.fromEntries([...page.declared].filter(([, d]) => !want || d.kind === want).map(([k, d]) => [k, d.value]));
          } else if (page.declared.has(n.imported)) bindings[n.local] = page.declared.get(n.imported).value;
          else judge(`import { ${n.imported} } from '${imp.spec}'`, () => { throw new Error(`no block on this page declares ${n.imported}`); });
        }
      } else for (const n of imp.names) page.foreign.add(n.local);
    }

    if (!first) return imports.length ? done('imports only') : { verdict: 'FAIL', how: 'an empty block', why: 'nothing to check' };
    const evalExpr = (src) => run(transpile(`const __v = (${src});`), bindings, ['__v']).__v;

    try {
      // CEL strings, one per line. The spec ships no CEL parser, so only the slot shape is checked.
      const lines = stripLineComments(rest).split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.every((l) => /^'(?:[^'\\]|\\.)*'$|^"(?:[^"\\]|\\.)*"$/.test(l))) {
        lines.forEach((l, k) => judge(`CEL ${k + 1}: slot shape only (EvaluatedExpressionInputSchema; the spec ships no CEL parser)`, () => shared.EvaluatedExpressionInputSchema.parse(new Function(`return ${l};`)())));
        return done('CEL strings');
      }

      // One object literal, or several, each a value of the kind the comment names.
      if (first.startsWith('{')) {
        const kind = kindOf(lead);
        if (!kind) { noKind(lead); return done('an object-literal fragment'); }
        const items = topLevelItems(stripLineComments(rest));
        for (const it of items) { const v = judge('evaluate', () => evalExpr(it), FAILED); if (v !== FAILED) asStandIn(() => kind.k.judge(v, kind.m, bindings, lead)); }
        return done(`${kind.k.id}${items.length > 1 ? ` ×${items.length}` : ''}`);
      }

      // Keys of something: `key: value, …`.
      if (/^(?:[A-Za-z_$][\w$]*|'[^']*'|"[^"]*")\s*:(?!:)/.test(first)) {
        const kind = kindOf(lead);
        const body = stripLineComments(rest);
        const sfo = ts.createSourceFile('k.ts', `({\n${body}\n})`, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
        const lit = sfo.statements[0]?.expression?.expression;
        const props = lit && ts.isObjectLiteralExpression(lit) ? [...lit.properties] : [];
        const names = props.map((p) => p.name?.getText(sfo));
        const variants = kind?.k.variants || new Set(names).size !== names.length;
        const sources = variants ? props.map((p) => `{ ${p.getText(sfo)} }`) : [`{\n${body}\n}`];
        const values = sources.map((s) => judge('evaluate', () => evalExpr(s), FAILED)).filter((v) => v !== FAILED);
        if (kind) { for (const v of values) asStandIn(() => kind.k.judge(v, kind.m, bindings, lead)); return done(`${kind.k.id}${variants ? ` ×${values.length}` : ''}`); }
        if (values.length === 1 && Object.values(values[0]).length && Object.values(values[0]).every((x) => builtFields.has(x))) {
          judge('fields of an object (every value is built by Field.*): ObjectSchema.create({ fields })', () => data.ObjectSchema.create(obj({ fields: values[0] })));
          return done('fields of an object');
        }
        noKind(lead);
        return done('a fragment of keys');
      }

      // Statements, evaluated as published.
      const sf = ts.createSourceFile('m.ts', rest, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
      const edits = [];
      const declared = [];
      const wrap = (n, fn) => { edits.push({ at: n.getStart(sf), text: `${fn}(` }); edits.push({ at: n.end, text: ')' }); };
      for (const st of sf.statements) {
        const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) ?? [] : [];
        const exp = mods.find((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        if (exp) edits.push({ at: exp.getStart(sf), del: exp.end - exp.getStart(sf), text: '' });
        if (ts.isExportAssignment(st)) edits.push({ at: st.getStart(sf), del: st.expression.getStart(sf) - st.getStart(sf), text: '__default = ' });
        if (ts.isVariableStatement(st)) {
          for (const d of st.declarationList.declarations) {
            if (!ts.isIdentifier(d.name) || !d.initializer) continue;
            declared.push(d.name.text);
            const t = d.type && ts.isTypeReferenceNode(d.type) ? d.type.typeName.getText(sf) : null;
            if (t) { edits.push({ at: d.initializer.getStart(sf), text: `__typed(${JSON.stringify(t)}, ` }); edits.push({ at: d.initializer.end, text: ')' }); }
            else if (ts.isObjectLiteralExpression(d.initializer) || (ts.isAsExpression(d.initializer) && ts.isObjectLiteralExpression(d.initializer.expression))) wrap(d.initializer, '__plain');
          }
        }
        if (ts.isFunctionDeclaration(st) && st.name) declared.push(st.name.text);
        if (ts.isExpressionStatement(st) && ts.isCallExpression(st.expression) && /^Field\.\w+$/.test(st.expression.expression.getText(sf))) wrap(st.expression, '__field');
      }
      let src = rest;
      for (const e of edits.sort((a, b) => b.at - a.at)) src = src.slice(0, e.at) + e.text + src.slice(e.at + (e.del ?? 0));
      const js = transpile(src);
      const plains = [];
      const typed = (t, v) => {
        const imp = page.types.get(t);
        if (!imp) { judge(`typed ${t}`, () => { throw new Error(`${t} is not a type imported from @objectstack/spec on this page`); }); return v; }
        const schema = `${imp.name}Schema`;
        const owner = [imp.spec, ...tc.entries].map((s) => tc.load(s)).find((m) => m && schema in m);
        judge(`${schema}.parse — the value is typed ${imp.name}`, () => { if (!owner) throw new Error(`@objectstack/spec has no ${schema} to parse a ${imp.name} with`); owner[schema].parse(v); });
        return v;
      };
      const before = legs.filter((l) => !/^import/.test(l.how)).length;
      // A name this block declares itself shadows the page's earlier one of the same name.
      const own = Object.fromEntries(Object.entries(bindings).filter(([k]) => !declared.includes(k)));
      const out = judge('evaluate as published', () => run(`let __default;\n${js}\n;var __defaultOut = __default;`, {
        ...own, __typed: typed, __plain: (v) => { plains.push(v); return v; },
        __field: (v) => { judge('Field.* value, as a field of ObjectSchema.create({ fields })', () => data.ObjectSchema.create(obj({ fields: { doc_sample_field: v } }))); return v; },
      }, [...declared, '__defaultOut']), FAILED);
      if (out !== FAILED) for (const d of declared) if (out[d] !== undefined) page.declare(d, out[d], flows);
      const judgedHere = legs.filter((l) => !/^import|^evaluate as published/.test(l.how)).length - before;
      if (!judgedHere && plains.length) {
        const kind = kindOf(lead);
        if (!kind) { noKind(lead); return done('statements'); }
        for (const v of plains) asStandIn(() => kind.k.judge(v, kind.m, bindings, lead));
        return done(`${kind.k.id} (a declared value)`);
      } else if (!judgedHere && out !== FAILED) {
        judge('reaches a spec parse', () => { throw new Error('nothing in this block calls a spec constructor or holds a value typed with a spec type'); });
      }
      return done('statements');
    } catch (e) {
      legs.push({ how: 'evaluate', ok: false, why: short(e) });
      return done('evaluate');
    }
  }

  function newPage() {
    const page = { scope: {}, declared: new Map(), foreign: new Set(), types: new Map() };
    page.declare = (name, value, allFlows) => {
      const kind = allFlows.includes(value) ? 'flow' : value && typeof value === 'object' && value.fields && value.name ? 'object' : value?.driver ? 'datasource' : 'other';
      page.declared.set(name, { value, kind });
      page.scope[name] = value;
    };
    return page;
  }

  /** A stack that declares `requires`, judged again with every flow on its page: that is where `requires` is decided. */
  function stackWithPageFlows(stack, pageFlows) {
    legs = [];
    judge(`defineStack with this stack's requires and the ${pageFlows.length} flow(s) on the page`, () => root.defineStack({ requires: stack.requires, flows: pageFlows }));
    const bad = legs.filter((l) => !l.ok);
    return { verdict: bad.length ? 'FAIL' : 'PASS', how: legs[0].how, why: bad.map((l) => l.why).join(' || ') };
  }

  return { evaluateBlock, newPage, stackWithPageFlows, flows, stacks, KINDS };
}

/* ------------------------------------------------------------------ the gate */

const RELATIVE_IMPORT = /^\s*import\s[^;]*?from\s+['"]\./m;

export function checkPages(files, tc, read = (f) => readFileSync(f, 'utf8')) {
  const ev = makeEvaluator(tc);
  const rows = [];
  for (const file of files) {
    const { blocks, problems } = extractBlocks(read(file));
    const out = problems.map((p) => ({ file, line: p.line, verdict: 'FAIL', how: 'the page', why: p.why }));
    const page = ev.newPage();
    const flows0 = ev.flows.length;
    // A block that imports from a relative path is judged after the rest of its page: it assembles what they declare.
    const order = [...blocks.filter((b) => !RELATIVE_IMPORT.test(b.code)), ...blocks.filter((b) => RELATIVE_IMPORT.test(b.code))];
    for (const b of order) {
      if (!CHECKED_LANGS.has(b.lang)) {
        if (b.skip) out.push({ file, line: b.line, verdict: 'FAIL', how: `a ${b.lang || 'plain'} block`, why: 'a doc-sample marker on a block this gate does not read' });
        continue;
      }
      if (b.skip) { out.push({ file, line: b.line, verdict: b.skip.reason ? 'SKIP' : 'FAIL', how: 'opted out', why: b.skip.reason || 'a doc-sample: skip marker must say why' }); continue; }
      const stacksBefore = ev.stacks.length;
      const r = ev.evaluateBlock(b, page);
      out.push({ file, line: b.line, ...r, stacks: ev.stacks.slice(stacksBefore) });
    }
    const pageFlows = ev.flows.slice(flows0);
    for (const row of out) {
      for (const s of row.stacks ?? []) {
        if (!s?.requires || !pageFlows.length) continue;
        const r = ev.stackWithPageFlows(s, pageFlows);
        if (r.verdict === 'FAIL') { row.verdict = 'FAIL'; row.why = [row.why, `${r.how}: ${r.why}`].filter(Boolean).join(' || '); }
        row.how += `; ${r.how}`;
      }
      delete row.stacks;
    }
    rows.push(...out.sort((a, b) => a.line - b.line));
  }
  return rows;
}

function gate(argv) {
  let tc;
  try { tc = loadToolchain(); } catch (e) { console.error(`✗ doc samples: NOT MEASURED — ${e.message}`); return 1; }
  const at = argv.indexOf('--docs');
  const docs = at >= 0 ? resolve(process.cwd(), argv[at + 1] ?? '') : DOCS;
  const named = argv.filter((a, k) => !a.startsWith('--') && argv[k - 1] !== '--docs');
  const files = named.length ? named.map((a) => resolve(process.cwd(), a)) : englishPages(docs);
  // Paths print relative to the tree's root (`content/docs/…`), or absolute when outside it.
  const shown = (from, p) => { const r = relative(from, p); return r.startsWith('..') ? p : r || '.'; };
  const base = resolve(docs, '../..');
  const rows = checkPages(files, tc);
  console.log(`@objectstack/spec ${tc.version} (pinned in ${rel(join(SPEC_HOME, 'package.json'))}) · ${files.length} page(s) under ${shown(process.cwd(), docs)}`);
  for (const r of rows) console.log(`${r.verdict.padEnd(4)} ${shown(base, r.file)}${r.line ? `:${r.line}` : ''} — ${r.how}${r.why ? ` — ${r.why}` : ''}`);
  const count = (v) => rows.filter((r) => r.verdict === v).length;
  const failed = count('FAIL');
  const pages = new Set(rows.filter((r) => r.verdict === 'FAIL').map((r) => r.file)).size;
  const tally = `${count('PASS')} pass · ${count('N/A')} not a spec sample · ${count('SKIP')} opted out`;
  console.log(failed
    ? `\n✗ doc samples: ${failed} block(s) refused or unchecked on ${pages} page(s) · ${tally}`
    : `\n✓ doc samples: every ts/js block on ${files.length} English page(s) parses with @objectstack/spec ${tc.version} · ${tally}`);
  return failed ? 1 : 0;
}

/* ------------------------------------------------------------------ self-test */

/*
 * Each case is a page, written inline, and the verdict every row of it must get, in line order.
 * The cases run the gate's own entry point (`checkPages`) against the pinned spec — the fixtures
 * never read content/docs — so a rule that stopped being able to go red fails here, and so does
 * a spec bump that changes what a fixture means. On top of the table, every fragment kind must
 * appear in at least one PASS row and one FAIL row: a kind is a wrap, and a wrap that cannot fail
 * is a skip with a nicer name.
 */
const fence = (code, lang = 'ts') => `\`\`\`${lang}\n${code}\n\`\`\``;
const page = (...parts) => `# Fixture\n\n${parts.join('\n\n')}\n`;
const FLOW = (extra = '', node = `{ id: 'note', type: 'notify', label: 'Note', config: { recipients: '{record.owner}', title: 'Hi' } }`) => `defineFlow({
  name: 'f', label: 'F', type: 'record_change', status: 'active',${extra}
  nodes: [
    { id: 'start', type: 'start', label: 'S', config: { objectName: 'ticket', triggerType: 'record-after-create' } },
    ${node},
    { id: 'end', type: 'end', label: 'E' },
  ],
  edges: [{ id: 'e1', source: 'start', target: 'note' }, { id: 'e2', source: 'note', target: 'end' }],
});`;
const KANBAN = `{ type: 'kanban', columns: ['subject'], kanban: { groupByField: 'status', columns: ['subject'] } }`;
const CASES = [
  // The page: fences, markers.
  ['fences: tildes, a longer closing fence, a three-space indent', page(`~~~ts\nObjectSchema.create({ name: 'a', fields: {} });\n~~~`, '   ````ts\nObjectSchema.create({ name: \'b\', fields: {} });\n   `````'), ['PASS', 'PASS']],
  ['a fence that is never closed', page('```ts\nObjectSchema.create({ name: \'a\', fields: {} });'), ['FAIL']],
  ['a marker with a reason skips its block; the block it would hide is refused', page('{/* doc-sample: skip — a counter-example: the refused shape */}', fence(`defineView({ bogus: 1 });`)), ['SKIP']],
  ['…the same block without the marker', page(fence(`defineView({ bogus: 1 });`)), ['FAIL']],
  ['a marker without a reason', page('{/* doc-sample: skip */}', fence(`defineView({ bogus: 1 });`)), ['FAIL']],
  ['a marker that is not the last line before a fence', page('{/* doc-sample: skip — drifted */}', 'A paragraph.', fence(`ObjectSchema.create({ name: 'a', fields: {} });`)), ['FAIL', 'PASS']],
  ['a marker on a block this gate does not read', page('{/* doc-sample: skip — bash */}', fence('os dev', 'bash')), ['FAIL']],
  ['bash, json and text blocks are not read', page(fence('os dev', 'bash'), fence('{ "a": 1 }', 'json'), fence('Agent → Skill', 'text')), []],
  // Not a spec sample.
  ['a block that imports only from another package, and a later one that constructs what it imported', page(fence(`import { StoragePlugin } from '@objectstack/service-storage';\nnew StoragePlugin({ adapter: 'local' });`), fence(`new StoragePlugin({ adapter: 's3' });`)), ['N/A', 'N/A']],
  ['a construction nothing on the page imported is not waved through', page(fence(`new StoragePlugin({ adapter: 's3' });`)), ['FAIL']],
  // Imports.
  ['a name the entry point exports, and one it does not', page(fence(`import { defineView } from '@objectstack/spec/ui';\ndefineView({ list: { type: 'grid', columns: ['a'] } });`), fence(`import { Action } from '@objectstack/spec';\nAction.create({ name: 'go_now', label: 'Go', type: 'url', target: 'https://example.com' });`)), ['PASS', 'FAIL']],
  ['an entry point the spec does not have', page(fence(`import { Field } from '@objectstack/spec/fields';`)), ['FAIL']],
  ['a type import the entry point declares, its value parsed with the matching schema', page(fence(`import type { Datasource } from '@objectstack/spec/data';\nexport const Db: Datasource = { name: 'main_db', label: 'Main', driver: 'sqlite', config: { filename: ':memory:' } };`)), ['PASS']],
  ['…a type it does not declare', page(fence(`import type { StateMachineConfig } from '@objectstack/spec/automation';\nexport const m: StateMachineConfig = { id: 'm', initial: 'a', states: {} };`)), ['FAIL']],
  ['…a declared type whose value the schema refuses', page(fence(`import type { Datasource } from '@objectstack/spec/data';\nexport const Db: Datasource = { name: 'main_db', label: 'Main', driver: 'postgres', config: { connection: { host: 'h' } } };`)), ['FAIL']],
  // Statements.
  ['constructors are the parse: accepted, and an unknown key', page(fence(`defineView({ list: { type: 'grid', columns: ['a'] } });`), fence(`defineView({ list: { type: 'grid', columns: ['a'] }, actions: ['go'] });`)), ['PASS', 'FAIL']],
  ['defineDataset does not parse, so the gate parses what it returns', page(fence(`defineDataset({ name: 'sales', label: 'Sales', object: 'deal', dimensions: [{ name: 'stage', field: 'stage', type: 'string' }], measures: [{ name: 'deal_count', aggregate: 'count' }] });`), fence(`defineDataset({ name: 'sales', label: 'Sales', object: 'deal', dimensions: [{ name: 'stage', field: 'stage', type: 'string' }], measures: [{ name: 'deal_count', aggregate: 'count', certified: true }] });`)), ['PASS', 'FAIL']],
  ['a Field.* statement is judged as a field of an object', page(fence(`Field.text({ label: 'Code', maxLength: 8 })`), fence(`Field.text({ label: 'Code', pattern: '^[A-Z]+$' })`)), ['PASS', 'FAIL']],
  ['every builtin node is also parsed against its executor contract', page(fence(FLOW()), fence(FLOW('', `{ id: 'note', type: 'notify', label: 'Note', config: { recipients: '{record.owner}', title: 'Hi', subject: 's' } }`))), ['PASS', 'FAIL']],
  ['a stack with requires is judged again with the flows on its page', page(fence(FLOW()), fence(`export default defineStack({ requires: ['automation'] });`)), ['PASS', 'FAIL']],
  ['…and passes with what those flows need', page(fence(FLOW()), fence(`export default defineStack({ requires: ['automation', 'triggers'] });`)), ['PASS', 'PASS']],
  ['a relative import binds what an earlier or later block declares; an undeclared one is refused', page(fence(`import { defineStack } from '@objectstack/spec';\nimport * as objects from './src/objects';\nexport default defineStack({ manifest: { id: 'a.b', namespace: 'acme', version: '1.0.0', type: 'app', name: 'A' }, objects: Object.values(objects) });`), fence(`export const Task = ObjectSchema.create({ name: 'acme_task', fields: { subject: Field.text({ label: 'S' }) } });`), fence(`import { Missing } from './src/missing';`)), ['PASS', 'PASS', 'FAIL']],
  ['…and the stack refuses what it assembled when that is wrong', page(fence(`import * as objects from './src/objects';\nexport default defineStack({ manifest: { id: 'a.b', namespace: 'acme', version: '1.0.0', type: 'app', name: 'A' }, objects: Object.values(objects) });`), fence(`export const Task = ObjectSchema.create({ name: 'todo_task', fields: { subject: Field.text({ label: 'S' }) } });`)), ['FAIL', 'PASS']],
  ['a block that reaches no spec parse', page(fence(`const answer = 42;`)), ['FAIL']],
  ['a plain object needs a constructor, a spec type, or a comment saying what it is', page(fence(`const board = { name: 'b', label: 'B', widgets: [] };`)), ['FAIL']],
  ['a block that does not evaluate', page(fence(`defineView({ list: ListOptions });`)), ['FAIL']],
  // CEL strings: the slot shape only.
  ['CEL strings, one per line; a blank one is refused', page(fence(`'record.amount > 10'\n'!isBlank(record.notes)'`), fence(`'record.amount > 10'\n''`)), ['PASS', 'FAIL']],
  // Fragments.
  ['a fragment with no comment saying what it is', page(fence(KANBAN), fence(`config: { approvers: [] }`)), ['FAIL', 'FAIL']],
  ['keys whose every value is built by Field.* are fields of an object', page(fence(`a: Field.text({ label: 'A' }),\nb: Field.number({ label: 'B', min: 1 }),`), fence(`a: Field.text({ label: 'A', helpText: 'x' }),`)), ['PASS', 'FAIL']],
  ['one list view: #307 added the top-level columns the old kanban lacked', page(fence(`// One list view; the container and \`data\` are omitted.\n${KANBAN}`), fence(`// One list view; the container and \`data\` are omitted.\n{ type: 'kanban', kanban: { groupByField: 'status', columns: ['subject'] } }`)), ['PASS', 'FAIL']],
  ['one form view', page(fence(`// One form view; the container and \`data\` are omitted.\n{ type: 'simple', sections: [{ fields: ['a'] }] }`), fence(`// One form view; the container and \`data\` are omitted.\n{ type: 'simple', sections: [{ fields: ['a'] }], submitBehavior: { kind: 'confetti' } }`)), ['PASS', 'FAIL']],
  ['one flow node: the retired step shape is refused', page(fence(`// One flow node; the flow around it is omitted.\n{ id: 'approve', type: 'approval', label: 'Approve', config: { approvers: [{ type: 'manager' }] } }`), fence(`// One flow node; the flow around it is omitted.\n{ type: 'action', action: 'approve_invoice', inputs: {} }`)), ['PASS', 'FAIL']],
  ['the config of a node, including a start node', page(fence(`// The \`config\` of an \`approval\` node; the node around it is omitted.\nconfig: { approvers: [{ type: 'manager' }], behavior: 'unanimous' }`), fence(`// The \`config\` of a \`start\` node; the rest of the flow is omitted.\nconfig: { objectName: 'deal', triggerType: 'record-after-update', condition: 'record.amount > 1' }`), fence(`// The \`config\` of an \`approval\` node; the node around it is omitted.\nconfig: { approvers: [{ type: 'manager' }], resolveAs: 'department' }`)), ['PASS', 'PASS', 'FAIL']],
  ["a start node's config.timeRelative, in variants", page(fence(`// Two variants of the start node's config.timeRelative.\ntimeRelative: { object: 'doc', dateField: 'due', withinDays: 30 }\ntimeRelative: { object: 'doc', dateField: 'due', offsetDays: [7] }`), fence(`// Two variants of the start node's config.timeRelative.\ntimeRelative: { object: 'doc', dateField: 'due', withinDays: 30, offsetDays: [7] }`)), ['PASS', 'FAIL']],
  ['keys of a flow, with the nodes its comment names', page(fence("// Keys of a `record_change` flow on `invoice`. The nodes are omitted: `charge` is an `http` node, and `paid` an `update_record`.\nedges: [{ id: 'ok', source: 'charge', target: 'paid' }],\nerrorHandling: { strategy: 'retry', maxRetries: 3 },"), fence("// Keys of a `record_change` flow on `invoice`. The nodes are omitted: `charge` is an `http` node, and `paid` an `update_record`.\nedges: [{ id: 'ok', source: 'charge', target: 'paid' }],\nerrorHandling: { strategy: 'retry' },"), fence("// Keys of a `record_change` flow on `invoice`. The nodes are omitted: `ask` is a `screen` node.\nedges: [{ id: 'ok', source: 'ask', target: 'end' }],")), ['PASS', 'FAIL', 'FAIL']],
  ['one field', page(fence(`// One field.\n{ type: 'lookup', reference: 'account', deleteBehavior: 'set_null' }`), fence(`// One field.\n{ type: 'lookup', reference: 'account', deleteBehavior: 'orphan' }`)), ['PASS', 'FAIL']],
  ['keys of a typed field', page(fence("// Keys of a `select` field; its other keys are omitted.\noptions: [{ value: 'low', label: 'Low' }],"), fence("// Keys of a `select` field; its other keys are omitted.\noptions: [],")), ['PASS', 'FAIL']],
  ['fields of an object', page(fence(`// Fields of an object; the object around them is omitted.\nfields: { a: Field.text({ label: 'A' }) }`), fence(`// Fields of an object; the object around them is omitted.\nfields: { a: Field.decimal({ label: 'A' }) }`)), ['PASS', 'FAIL']],
  ['keys of an object', page(fence(`// Keys of an object; its name and fields are omitted.\nenable: { apiMethods: ['get', 'list'] }`), fence(`// Keys of an object; its name and fields are omitted.\nenable: { trash: true }`)), ['PASS', 'FAIL']],
  ['validation rules', page(fence("// One validation rule, an entry of the object's `validations`.\n{ type: 'script', name: 'positive', message: 'M', condition: 'record.amount <= 0' }"), fence("// One validation rule, an entry of the object's `validations`.\n{ name: 'positive', message: 'M', condition: 'record.amount <= 0' }")), ['PASS', 'FAIL']],
  ['keys of an app', page(fence(`// Keys of an app; its other keys are omitted.\nnavigation: [{ id: 'nav_a', type: 'object', label: 'A', objectName: 'a' }]`), fence(`// Keys of an app; its other keys are omitted.\nmobileNavigation: { mode: 'bottom_nav' }`)), ['PASS', 'FAIL']],
  ['one navigation item', page(fence(`// One navigation item of an app.\n{ id: 'nav_board', type: 'dashboard', label: 'Board', dashboardName: 'board' }`), fence(`// One navigation item of an app.\n{ id: 'nav_board', type: 'dashboard', label: 'Board', dashboard: 'board' }`)), ['PASS', 'FAIL']],
  ['one dashboard', page(fence(`// One dashboard.\nconst board = { name: 'board', label: 'Board', refreshIntervalSeconds: 60, widgets: [] };`), fence(`// One dashboard.\nconst board = { name: 'board', label: 'Board', refreshInterval: 60, widgets: [] };`)), ['PASS', 'FAIL']],
  ['keys of a dashboard; only the widget keys the comment says are omitted are supplied', page(fence("// Keys of a dashboard; each widget's dataset, values and title are omitted.\nwidgets: [{ id: 'total' }]"), fence("// Keys of a dashboard; each widget's dataset is omitted.\nwidgets: [{ id: 'total' }]")), ['PASS', 'FAIL']],
  ['keys of a dashboard widget', page(fence(`// Keys of a dashboard widget; its other keys are omitted.\nlayout: { x: 0, y: 0, w: 6, h: 4 }`), fence(`// Keys of a dashboard widget; its other keys are omitted.\ncategoryField: 'region'`)), ['PASS', 'FAIL']],
  ['one page', page(fence(`// One page.\nconst home = { name: 'home', label: 'Home', type: 'home', regions: [] };`), fence(`// One page.\nconst home = { name: 'home', label: 'Home', type: 'portal', regions: [] };`)), ['PASS', 'FAIL']],
  ['keys of a page', page(fence(`// Keys of a page; its other keys are omitted.\nvariables: [{ name: 'tab', type: 'string' }]`), fence(`// Keys of a page; its other keys are omitted.\nvariables: [{ name: 'tab', type: 'date' }]`)), ['PASS', 'FAIL']],
  ['one page component', page(fence(`// One page component; the page and region around it are omitted.\n{ type: 'chart', id: 'trend', properties: { dataset: 'sales', values: ['revenue'] } }`), fence(`// One page component; the page and region around it are omitted.\n{ type: 'chart', id: 'trend', object: 'deal', categoryField: 'stage' }`)), ['PASS', 'FAIL']],
  ['keys of a form view', page(fence(`// Keys of a form view; its other keys are omitted.\nsubmitBehavior: { kind: 'thank-you', title: 'Thanks' }`), fence(`// Keys of a form view; its other keys are omitted.\nsubmitBehavior: { kind: 'confetti' }`)), ['PASS', 'FAIL']],
  ['keys of a view container', page(fence(`// Keys of a view container; its other keys are omitted.\nform: { type: 'simple', sections: [{ fields: ['a'] }] }`), fence(`// Keys of a view container; its other keys are omitted.\nactions: ['approve']`)), ['PASS', 'FAIL']],
  ['keys of a permission set', page(fence(`// Keys of a permission set; its other keys are omitted.\nobjects: { deal: { allowRead: true, allowExport: true } }`), fence(`// Keys of a permission set; its other keys are omitted.\nobjects: { deal: { read: true } }`)), ['PASS', 'FAIL']],
];

function selfTest(verbose = false) {
  let tc;
  try { tc = loadToolchain(); } catch (e) { console.error(`✗ self-test: NOT MEASURED — ${e.message}`); return 1; }
  const wrong = [];
  const seen = new Map();
  const kinds = makeEvaluator(tc).KINDS.map((k) => k.id);
  for (const [name, text, want] of CASES) {
    const rows = checkPages(['fixture.mdx'], tc, () => text);
    const got = rows.map((r) => r.verdict);
    const ok = got.length === want.length && got.every((v, k) => v === want[k]);
    console.log(`${ok ? '✓' : '✗'} ${name}: ${got.join(' ') || '(no rows)'}${ok ? '' : `, expected ${want.join(' ') || '(no rows)'}`}`);
    if (!ok) wrong.push(name);
    if (!ok || verbose) for (const r of rows) console.error(`    ${r.verdict} :${r.line} ${r.how}${r.why ? ` — ${r.why}` : ''}`);
    for (const r of rows) for (const k of kinds) if (r.how?.startsWith(k)) seen.set(`${k}|${r.verdict}`, true);
  }
  const unproven = kinds.flatMap((k) => ['PASS', 'FAIL'].filter((v) => !seen.has(`${k}|${v}`)).map((v) => `${k} has no ${v} fixture`));
  for (const u of unproven) console.error(`✗ ${u}`);
  const bad = wrong.length + unproven.length;
  console.log(bad
    ? `\n✗ self-test: ${wrong.length} case(s) wrong, ${unproven.length} fragment kind verdict(s) unproven`
    : `\n✓ self-test: ${CASES.length} case(s) hold, and each of the ${kinds.length} fragment kinds has a fixture it passes and one it refuses (@objectstack/spec ${tc.version})`);
  return bad ? 1 : 0;
}

const argv = process.argv.slice(2);
process.exitCode = argv.includes('--self-test') ? selfTest(argv.includes('--verbose')) : gate(argv);
