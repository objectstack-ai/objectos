#!/usr/bin/env node
/**
 * The positioning gate for objectos#171. Three rules:
 *
 * (a) Each copy of the positioning equals `apps/docs/lib/positioning.ts` (its
 *     literals, joined as its own `POSITIONING = [...].join(...)` says): the
 *     `content/docs/index.mdx` frontmatter `description` (MDX cannot import), the
 *     site-wide meta description on the built `_not-found.html` (that route sets
 *     only a title), and the built `/llms.txt` `> ` summary line.
 * (b) The brand is spelled ObjectOS in every built HTML page and both `llms`
 *     bodies. It reads the build, not the sources: `lib/i18n.ts` keeps
 *     "ObjectStack Documentation" in a comment that ships nowhere, as #171 allowed.
 * (c) The stale sentences #171 removed stay out of the English `content/docs/`
 *     sources, outside code fences and MDX comments.
 *
 * Run it after `pnpm turbo run build`; a missing build fails. `--self-test` runs the fixtures.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CONSTANT = 'apps/docs/lib/positioning.ts';
const INDEX = 'content/docs/index.mdx';
const GLOSSARY = 'content/docs/resources/glossary.mdx';
const BUILD = 'apps/docs/.next/server/app';
const LOCALE_SIBLING = /\.[a-z]{2}(?:-[A-Z][a-z]{3})?\.mdx$/;

const MISSPELT = /\b(?:ObjectStack Protocol|ObjectStack Documentation|Object OS|objectOS|ObjectOs)\b/;
const STALE = [
  /ObjectOS\s+is\s+a\s+self-hosted\s+runtime/,
  /[Nn]ever\s+phones\s+home/,
  /[Dd]oes\s+not\s+call\s+home/,
  /[Nn]ever\s+calls\s+home/,
  /No\s+licen[cs]e\s+server/, // capital N: "no seats, ..., no license server" is the open runtime and stays
  /[Ff]ully\s+self-contained/,
  /[Ii]nside\s+your\s+firewall/,
];
const OPEN_SOURCE = /Open[\s-]+source,\s+Apache-2\.0/i; // checked inside the glossary's ObjectOS entry only

/** POSITIONING as the constant's file composes it, or undefined when it cannot be read. */
function composed(ts) {
  const literal = {};
  for (const m of ts.matchAll(/export const (\w+) =\s*(['"])((?:\\.|(?!\2).)*)\2;/g)) {
    literal[m[1]] = m[3].replace(/\\(.)/g, '$1');
  }
  const join = /export const POSITIONING = \[([^\]]*)\]\.join\((['"])(.*?)\2\)/.exec(ts.replace(/\s*\n\s*/g, ' '));
  const parts = join?.[1].split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  if (!parts.length || parts.some((p) => literal[p] === undefined)) return undefined;
  return parts.map((p) => literal[p]).join(join[3]);
}

function frontmatterDescription(mdx) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(mdx)?.[1] ?? '';
  const v = /^description:[ \t]*(.*)$/m.exec(frontmatter)?.[1].trim();
  if (v?.startsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  try {
    return v?.startsWith('"') ? JSON.parse(v) : v;
  } catch {
    return v; // malformed quoting is returned raw, so it differs and is reported
  }
}

const ENTITY = { amp: '&', quot: '"', lt: '<', gt: '>', apos: "'" };
const decode = (s) =>
  s?.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(\w+));/gi, (m, hex, dec, name) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : dec ? String.fromCodePoint(+dec) : (ENTITY[name] ?? m),
  );
const metaDescription = (html) => decode(/<meta name="description" content="([^"]*)"/.exec(html)?.[1]);

/** (a) Each copy is byte-equal to the constant. A missing file reads as undefined, which differs. */
function ruleA({ ts, index, notFound, llms }) {
  const want = composed(ts ?? '');
  if (want === undefined) return [`(a) ${CONSTANT} composes no POSITIONING this gate can read`];
  const copies = {
    [`${INDEX} frontmatter description`]: index && frontmatterDescription(index),
    'site-wide meta description (built _not-found.html)': notFound && metaDescription(notFound),
    'built /llms.txt summary line': llms?.split('\n').find((l) => l.startsWith('> '))?.slice(2),
  };
  return Object.entries(copies)
    .filter(([, got]) => got !== want)
    .map(([what, got]) => `(a) ${what} is not POSITIONING\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`);
}

/** (b) No shipped file spells the brand another way. A missing file is a finding: it was not measured. */
const ruleB = (files) =>
  files.flatMap(([path, text]) => {
    if (text === undefined) return [`(b) ${path} does not exist, so it was not measured`];
    const m = MISSPELT.exec(text);
    return m ? [`(b) ${path} spells the brand ${JSON.stringify(m[0])}; it is ObjectOS`] : [];
  });

/** (c) No English source brings a stale sentence back. Fences and comments are blanked, lines kept. */
function ruleC(files) {
  const out = [];
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  for (const [path, text] of files) {
    const prose = text.replace(/\{\/\*[\s\S]*?\*\/\}|^ {0,3}(`{3,}|~{3,})[\s\S]*?^ {0,3}\1/gm, blank);
    for (const re of STALE) {
      const m = re.exec(prose);
      const line = m && prose.slice(0, m.index).split('\n').length;
      if (m) out.push(`(c) ${path}:${line} brings back ${JSON.stringify(m[0].replace(/\s+/g, ' '))}`);
    }
  }
  const glossary = files.find(([path]) => path === GLOSSARY)?.[1];
  const entry = glossary?.split(/\n(?=#)/).find((s) => s.startsWith('### ObjectOS\n'));
  if (entry === undefined) out.push(`(c) ${GLOSSARY} has no "### ObjectOS" entry; the open-source check measured nothing`);
  else if (OPEN_SOURCE.test(entry)) out.push(`(c) ${GLOSSARY} calls ObjectOS "Open source, Apache-2.0" again`);
  return out;
}

function gate() {
  const at = (p) => join(ROOT, p);
  const read = (p) => (existsSync(at(p)) ? readFileSync(at(p), 'utf8') : undefined);
  const list = (dir) => readdirSync(at(dir), { recursive: true }).map((f) => join(dir, f));
  if (!existsSync(at(BUILD))) {
    console.error(`✗ positioning: ${BUILD} does not exist. Run pnpm turbo run build first.`);
    return 1;
  }
  const pages = list(BUILD).filter((f) => f.endsWith('.html'));
  const shipped = [...pages, `${BUILD}/llms.txt.body`, `${BUILD}/llms-full.txt.body`];
  const sources = list('content/docs').filter((f) => f.endsWith('.mdx') && !LOCALE_SIBLING.test(f));
  const findings = [
    ...ruleA({ ts: read(CONSTANT), index: read(INDEX), notFound: read(`${BUILD}/_not-found.html`), llms: read(`${BUILD}/llms.txt.body`) }),
    ...ruleB(shipped.map((p) => [p, read(p)])),
    ...ruleC(sources.map((p) => [p, read(p)])),
  ];
  for (const f of findings) console.error(`  ${f}`);
  if (findings.length) {
    console.error(`\n✗ positioning: ${findings.length} finding(s). The rules are in this script's header.`);
    return 1;
  }
  console.log(`✓ positioning: 3 copies equal the constant; the brand is right in ${pages.length} pages and 2 llms bodies; no stale sentence in ${sources.length} English sources`);
  return 0;
}

/* Self-test: per rule, a good fixture that must give 0 findings and a bad one that must give exactly N. */
const A_OK = {
  ts: "export const A = 'One ontology.';\nexport const B =\n  \"It's yours.\";\nexport const POSITIONING = [\n  A,\n  B,\n].join(' ');\n",
  index: `---\ntitle: Introduction\ndescription: "One ontology. It's yours."\n---\n\nBody.\n`,
  notFound: '<title>404</title><meta name="description" content="One ontology. It&#x27;s yours."/>',
  llms: "# ObjectOS\n\n> One ontology. It's yours.\n",
};
const A_BAD = {
  index: '---\ndescription: One ontology, yours.\n---\n',
  notFound: '<meta name="description" content="A self-hosted runtime."/>',
  llms: "> One ontology.\nIt's yours.\n",
};
const B_BAD = ['ObjectStack Protocol', 'ObjectStack Documentation', 'Object OS', 'objectOS', 'ObjectOs'];
const C_OK = 'No seats, no license server. Does ObjectOS phone home?\n\n```\nObjectOS is a self-hosted runtime\n```\n\n{/* was: never phones home */}\n';
const C_BAD = 'ObjectOS is a self-hosted\nruntime. It never phones home, does not call home, never calls home.\n\nNo license server. Fully\nself-contained, inside your firewall.\n';
const glossary = (entry) => [GLOSSARY, `### ObjectOS\n\n${entry}\n\n### ObjectStack\n\nOpen source, Apache-2.0.\n`];
const CASES = [
  ['(a) the three copies equal the constant', () => ruleA(A_OK), 0],
  ['(a) index paraphrased, site meta stale, llms line split', () => ruleA({ ...A_OK, ...A_BAD }), 3],
  ['(b) ObjectOS, the host and the package scope', () => ruleB([['a.html', 'Intro | ObjectOS, docs.objectos.ai, @objectos/docs']]), 0],
  ['(b) the five wrong spellings, one file each', () => ruleB(B_BAD.map((s, i) => [`${i}.html`, `<p>${s} boots.</p>`])), 5],
  ['(c) list form, a question, a fenced quote, a comment', () => ruleC([glossary('Commercial. Not open source.'), ['a.mdx', C_OK]]), 0],
  ['(c) the eight stale sentences, three wrapped', () => ruleC([glossary('The runtime. Open\nsource, Apache-2.0.'), ['a.mdx', C_BAD]]), 8],
];

function selfTest() {
  const wrong = CASES.filter(([name, run, want]) => {
    const findings = run();
    console.log(`${findings.length === want ? '✓' : '✗'} ${name}: ${findings.length} finding(s), expected ${want}`);
    if (findings.length !== want) for (const f of findings) console.error(`    ${f}`);
    return findings.length !== want;
  });
  console.log(wrong.length ? `\n✗ self-test: ${wrong.length} case(s) wrong` : '\n✓ self-test: every rule fails its bad fixture and passes its good one');
  return wrong.length ? 1 : 0;
}

process.exitCode = process.argv.includes('--self-test') ? selfTest() : gate();
