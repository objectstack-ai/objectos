#!/usr/bin/env node
/**
 * One positioning, one brand spelling, no stale sentence — as a machine rule.
 *
 * ## Why this exists
 *
 * objectos#171 measured three defects that had accumulated because nothing
 * stopped them: the brand spelled three ways in shipped output (`ObjectOS`,
 * `ObjectStack Protocol`, `ObjectStack Documentation`); the index page pitching
 * ObjectOS as "a self-hosted runtime" against `README.md`'s "commercial runtime
 * environment"; the glossary calling it "Open source, Apache-2.0" against
 * "there is no open-source edition of ObjectOS". Hand-editing each occurrence
 * and stopping there reproduces the defect on a six-month delay — the
 * 2026-09-08 decision on that card says so, and makes "one constant, and a gate
 * that fails when a fourth spelling appears" a required part of the fix.
 *
 * The constant is `apps/docs/lib/positioning.ts`, quoting the objectstack
 * README verbatim (ruling Q4, 2026-10-05: that README is the single source,
 * this site and www.objectos.ai both quote it). Three surfaces carry it, and
 * the third — MDX frontmatter — cannot import, which is why a gate is needed
 * at all rather than a type.
 *
 * ## The rules
 *
 * (a) Every copy agrees with the constant.
 *   - `positioning-source`: the four literals the constant is composed of are
 *     parseable out of `lib/positioning.ts`, which imports nothing.
 *   - `index-description`: `content/docs/index.mdx` frontmatter `description`
 *     is byte-equal to `POSITIONING`.
 *   - `layout-description`: `app/layout.tsx` imports `POSITIONING` from
 *     `@/lib/positioning` and its metadata `description:` reads it.
 *   - `llms-summary-source`: `app/llms.txt/route.ts` imports `POSITIONING`
 *     from `@/lib/positioning`.
 *   - `llms-summary-built`: the BUILT `/llms.txt` summary line is
 *     `> POSITIONING`. This is also what pins the composition: the gate joins
 *     the four literals with single spaces, and the built line proves the
 *     module composed them the same way.
 *   - `index-meta-built`: the BUILT English index page's `description` and
 *     `og:description` are `POSITIONING`.
 *
 * (b) One brand spelling in shipped output.
 *   - `site-name`: `lib/source.ts` declares `SITE_NAME = 'ObjectOS'`.
 *   - `title-suffix`: every built docs page's `title` ends with `| ObjectOS`.
 *   - `og-site-name`: every built docs page's `og:site_name` is `ObjectOS`.
 *   - `llms-title`: the built `/llms.txt` opens with `# ObjectOS`.
 *   - `brand-spelling`: no built page and neither `llms` body carries a
 *     variant spelling (`Object OS`, `Object-OS`, `ObjectOs`, `Objectos`,
 *     `OBJECTOS`, `objectOS`) or either historical misname.
 *
 * (c) A stale sentence does not come back — over the English sources under
 *     `content/docs/`, outside code fences and MDX comments, paragraph by
 *     paragraph so a sentence wrapped across lines is still one sentence.
 *   - `stale-self-hosted`: "ObjectOS is a self-hosted runtime".
 *   - `stale-open-source`: a paragraph that calls ObjectOS "Open source,
 *     Apache-2.0" without naming ObjectStack — the glossary shape. A paragraph
 *     naming both is the licence page's correct contrast and stays silent.
 *   - `stale-phones-home`: "never phones home", "does not call home" and kin.
 *     A question ("Does ObjectOS phone home?") is not a claim and stays silent.
 *   - `stale-license-server`: "No license server.", "No license check.",
 *     "does not check a license server". The lowercase list form ("no seats,
 *     no usage tier, no license server") describes the open runtime and stays
 *     silent.
 *
 * ## Why (a) and (b) read the build and (c) reads the sources
 *
 * (a) and (b) are about what ships, and the mandate names shipped output. A
 * source scan would also be wrong in a measurable way: `lib/i18n.ts` still
 * says "ObjectStack Documentation" in a code comment, which the ruling on #171
 * re-measured and accepted because it ships nowhere. So the brand rules read
 * `apps/docs/.next/server/app/`, the same tree `check-locale-surface.mjs`
 * reads, and not finding it is `build-missing` — a failure, never a skip.
 * `ci.yml` runs this after `pnpm turbo run build`; locally, build first.
 *
 * (c) is about sentences an author writes, so it reports the `path:line` they
 * will open. It stops at `content/docs/` on purpose: `app/[lang]/privacy` and
 * `terms` carry prose of their own that PR 2 of #171 corrects under the
 * maintainer's eye, and a gate that is red on `main` until a held PR lands is
 * a gate someone disables. Widen `STALE_SOURCE_DIRS` when that PR lands.
 *
 * Usage:
 *   node .github/scripts/check-positioning.mjs              # gate: exit 1 on any finding
 *   node .github/scripts/check-positioning.mjs --self-test  # every rule can fail, and can stay silent
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

/**
 * The one spelling. Pinned here rather than read from `lib/source.ts`, because
 * that file is a subject of this gate: a check that takes its expectation from
 * the thing it checks cannot catch that thing being wrong.
 */
const BRAND = 'ObjectOS';

const POSITIONING_FILE = 'apps/docs/lib/positioning.ts';
/** The literals `POSITIONING` is composed of, in composition order. */
const PARTS = ['ONTOLOGY_HEADLINE', 'ONTOLOGY_PROMISE', 'OBJECTOS_DEFINITION', 'OBJECTOS_EDITIONS'];
const SOURCE_FILE = 'apps/docs/lib/source.ts';
const I18N_FILE = 'apps/docs/lib/i18n.ts';
const LAYOUT_FILE = 'apps/docs/app/layout.tsx';
const LLMS_ROUTE_FILE = 'apps/docs/app/llms.txt/route.ts';
const INDEX_FILE = 'content/docs/index.mdx';
const STALE_SOURCE_DIRS = ['content/docs'];
const BUILD_DIR = 'apps/docs/.next/server/app';
const LLMS_BODY = 'llms.txt.body';
const LLMS_FULL_BODY = 'llms-full.txt.body';

/** `import { …, POSITIONING, … } from '@/lib/positioning'`. */
const IMPORTS_POSITIONING = /import\s*\{[^}]*\bPOSITIONING\b[^}]*\}\s*from\s*['"]@\/lib\/positioning['"]/;

/**
 * Variant spellings of the brand, plus the two misnames #171 found shipping.
 * Case-sensitive on purpose: `objectos` is the host (`docs.objectos.ai`) and
 * the package scope (`@objectos/docs`), neither of which is prose.
 */
const MISSPELLINGS = [
  /\bObject OS\b/,
  /\bObject-OS\b/,
  /\bObjectOs\b/,
  /\bObjectos\b/,
  /\bOBJECTOS\b/,
  /\bobjectOS\b/,
  /\bObjectStack Protocol\b/,
  /\bObjectStack Documentation\b/,
];

/** The stale sentences, matched against one paragraph at a time. */
const STALE = [
  {
    rule: 'stale-self-hosted',
    re: /\bObjectOS\b(?:,| is| was| —| -)? (?:a|an|the) self-hosted runtime\b/,
  },
  {
    rule: 'stale-phones-home',
    re: /\b(?:never|does not|doesn't|do not|don't|won't|will not) (?:phon(?:e|es|ing)|call(?:s|ing)?) home\b/i,
  },
  {
    rule: 'stale-license-server',
    re: /\bNo licen[cs]e (?:server|check)\b|\b(?:does not|doesn't|never) checks? (?:a|the|any) licen[cs]e server\b/,
  },
];
const OPEN_SOURCE = /\bOpen[- ]source, Apache-2\.0\b/;

const RULES = [
  'positioning-source',
  'index-description',
  'layout-description',
  'llms-summary-source',
  'llms-summary-built',
  'index-meta-built',
  'site-name',
  'title-suffix',
  'og-site-name',
  'llms-title',
  'brand-spelling',
  'stale-self-hosted',
  'stale-open-source',
  'stale-phones-home',
  'stale-license-server',
  'build-missing',
];

/* ---------------------------------------------------------------- readers -- */

/** Unescape the body of a JS string literal — the escapes a prose constant can carry. */
function unescapeLiteral(body) {
  return body.replace(/\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|\r?\n|(.))/gs, (m, brace, u4, x2, ch) => {
    if (brace) return String.fromCodePoint(parseInt(brace, 16));
    if (u4) return String.fromCharCode(parseInt(u4, 16));
    if (x2) return String.fromCharCode(parseInt(x2, 16));
    if (ch === undefined) return ''; // line continuation
    return { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' }[ch] ?? ch;
  });
}

/**
 * The string an `export const NAME = '…';` declaration assigns, or undefined
 * when there is no such declaration or it is not a single quoted literal.
 */
function exportedLiteral(text, name) {
  const re = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(['"\`])((?:\\\\[\\s\\S]|(?!\\1)[^\\\\])*)\\1\\s*;`);
  const m = re.exec(text);
  return m ? unescapeLiteral(m[2]) : undefined;
}

/** `languages` and `defaultLanguage` out of `lib/i18n.ts`, the shape the sibling gates parse. */
function readI18n(text, path) {
  const list = /languages:\s*\[([^\]]+)\]/.exec(text);
  if (!list) throw new Error(`could not parse languages[] out of ${path}`);
  const languages = list[1]
    .split(',')
    .map((s) => s.trim().replace(/['"]/g, ''))
    .filter(Boolean);
  const def = /defaultLanguage:\s*['"]([^'"]+)['"]/.exec(text);
  if (!def) throw new Error(`could not parse defaultLanguage out of ${path}`);
  return { languages, defaultLanguage: def[1] };
}

/**
 * The frontmatter `description` of an MDX file, when it is a single-line
 * scalar: double-quoted (JSON-compatible), single-quoted (YAML `''` escape),
 * or plain. A block scalar or a missing key is `undefined`, which the caller
 * reports — the index description is written out on one line on purpose, so
 * that this reader and a human reader see the same bytes.
 */
function frontmatterDescription(text) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!fm) return undefined;
  const line = fm[1].split(/\r?\n/).find((l) => /^description:/.test(l));
  if (!line) return undefined;
  const value = line.slice('description:'.length).trim();
  if (value.startsWith('"')) {
    const end = value.lastIndexOf('"');
    if (end === 0) return undefined;
    try {
      return JSON.parse(value.slice(0, end + 1));
    } catch {
      return undefined;
    }
  }
  if (value.startsWith("'")) {
    const end = value.lastIndexOf("'");
    if (end === 0) return undefined;
    return value.slice(1, end).replace(/''/g, "'");
  }
  return value;
}

function decodeEntities(s) {
  return s.replace(/&(#x([0-9a-fA-F]+)|#(\d+)|quot|amp|lt|gt|apos);/g, (m, name, hex, dec) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    if (dec) return String.fromCodePoint(parseInt(dec, 10));
    return { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" }[name];
  });
}

/** The `content` of the first `meta` element whose `attr` equals `value`, decoded. */
function metaContent(html, attr, value) {
  const tags = html.match(/<meta\s[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const key = new RegExp(`\\s${attr}="([^"]*)"`, 'i').exec(tag);
    if (!key || key[1] !== value) continue;
    const content = /\scontent="([^"]*)"/i.exec(tag);
    return content ? decodeEntities(content[1]) : undefined;
  }
  return undefined;
}

function titleOf(html) {
  const m = /<title>([^<]*)<\/title>/i.exec(html);
  return m ? decodeEntities(m[1]) : undefined;
}

/** Every file under `dir`, recursively, as absolute paths. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.isFile()) out.push(p);
  }
  return out;
}

const posix = (p) => p.split('\\').join('/');

/**
 * The prose of an MDX file as paragraphs, each with the 1-based line it starts
 * on. Fenced code and MDX comments are blanked first, line count preserved, so
 * a sample that quotes an old sentence and a note that explains one are not
 * findings. Frontmatter stays in: a stale `description:` ships as the page's
 * meta description.
 */
function paragraphs(text) {
  const blanked = text.replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '));
  const lines = blanked.split('\n');
  let fence;
  for (let i = 0; i < lines.length; i += 1) {
    const marker = /^[ \t]{0,3}(`{3,}|~{3,})/.exec(lines[i])?.[1];
    if (marker) {
      if (fence === undefined) fence = marker[0];
      else if (marker[0] === fence) fence = undefined;
      lines[i] = '';
      continue;
    }
    if (fence !== undefined) lines[i] = '';
  }
  const out = [];
  let start = -1;
  let buf = [];
  const flush = () => {
    if (buf.length) out.push({ line: start + 1, text: buf.join(' ') });
    buf = [];
    start = -1;
  };
  lines.forEach((l, i) => {
    if (l.trim() === '') flush();
    else {
      if (start < 0) start = i;
      buf.push(l.trim());
    }
  });
  flush();
  return out;
}

/* ------------------------------------------------------------------ check -- */

/**
 * Every finding over the tree at `root`, plus what was scanned so the summary
 * can say how much a green covers.
 */
function check(root) {
  const findings = [];
  const add = (rule, detail) => findings.push({ rule, detail });
  const at = (p) => join(root, p);
  const has = (p) => existsSync(at(p));
  const read = (p) => readFileSync(at(p), 'utf8');

  if (!has(I18N_FILE)) throw new Error(`${I18N_FILE} does not exist under ${root}`);
  const { languages, defaultLanguage } = readI18n(read(I18N_FILE), I18N_FILE);

  // --- the constant
  let positioning;
  if (!has(POSITIONING_FILE)) {
    add('positioning-source', `${POSITIONING_FILE} does not exist — the constant this gate compares against is missing`);
  } else {
    const text = read(POSITIONING_FILE);
    const values = PARTS.map((name) => [name, exportedLiteral(text, name)]);
    const missing = values.filter(([, v]) => v === undefined).map(([n]) => n);
    if (missing.length) {
      add(
        'positioning-source',
        `${POSITIONING_FILE} declares no parseable string literal for ${missing.join(', ')} — ` +
          "each part is one `export const NAME = '…';`, which is the shape this gate reads",
      );
    } else {
      positioning = values.map(([, v]) => v).join(' ');
    }
    if (/^\s*import\s/m.test(text)) {
      add('positioning-source', `${POSITIONING_FILE} carries an import — it is a leaf module on purpose (see its header)`);
    }
  }

  // --- (a) the source copies
  if (!has(INDEX_FILE)) {
    add('index-description', `${INDEX_FILE} does not exist`);
  } else if (positioning !== undefined) {
    const description = frontmatterDescription(read(INDEX_FILE));
    if (description === undefined) {
      add(
        'index-description',
        `${INDEX_FILE} has no single-line \`description:\` in its frontmatter — the index description is ` +
          'POSITIONING written out, because frontmatter cannot import',
      );
    } else if (description !== positioning) {
      add(
        'index-description',
        `${INDEX_FILE} frontmatter description differs from POSITIONING in ${POSITIONING_FILE}\n` +
          `      index:    ${JSON.stringify(description)}\n` +
          `      constant: ${JSON.stringify(positioning)}`,
      );
    }
  }

  if (!has(LAYOUT_FILE)) {
    add('layout-description', `${LAYOUT_FILE} does not exist`);
  } else {
    const text = read(LAYOUT_FILE);
    if (!IMPORTS_POSITIONING.test(text)) {
      add('layout-description', `${LAYOUT_FILE} does not import POSITIONING from '@/lib/positioning'`);
    }
    if (!/\bdescription:\s*POSITIONING\b/.test(text)) {
      add(
        'layout-description',
        `${LAYOUT_FILE} metadata description is not the constant — it must read \`description: POSITIONING\`, ` +
          'never a literal of its own',
      );
    }
  }

  if (!has(LLMS_ROUTE_FILE)) {
    add('llms-summary-source', `${LLMS_ROUTE_FILE} does not exist`);
  } else if (!IMPORTS_POSITIONING.test(read(LLMS_ROUTE_FILE))) {
    add(
      'llms-summary-source',
      `${LLMS_ROUTE_FILE} does not import POSITIONING from '@/lib/positioning' — its summary line is the constant, ` +
        'not a literal of its own',
    );
  }

  // --- (b) the brand constant
  if (!has(SOURCE_FILE)) {
    add('site-name', `${SOURCE_FILE} does not exist`);
  } else {
    const siteName = exportedLiteral(read(SOURCE_FILE), 'SITE_NAME');
    if (siteName !== BRAND) {
      add(
        'site-name',
        `${SOURCE_FILE} SITE_NAME is ${siteName === undefined ? 'not a parseable string literal' : JSON.stringify(siteName)}, ` +
          `not ${JSON.stringify(BRAND)} — the one brand spelling (objectos#171, decided 2026-09-08)`,
      );
    }
  }

  // --- (c) stale sentences in the English sources
  const siblings = languages.filter((l) => l !== defaultLanguage);
  const sources = STALE_SOURCE_DIRS.filter(has)
    .flatMap((dir) => walk(at(dir)))
    .filter((f) => f.endsWith('.mdx') && !siblings.some((l) => f.endsWith(`.${l}.mdx`)))
    .map((f) => posix(relative(root, f)))
    .sort();
  for (const file of sources) {
    for (const para of paragraphs(read(file))) {
      for (const { rule, re } of STALE) {
        const m = re.exec(para.text);
        if (m) add(rule, `${file}:${para.line} ${JSON.stringify(m[0])}`);
      }
      if (/\bObjectOS\b/.test(para.text) && OPEN_SOURCE.test(para.text) && !/\bObjectStack\b/.test(para.text)) {
        add(
          'stale-open-source',
          `${file}:${para.line} calls ObjectOS ${JSON.stringify(OPEN_SOURCE.exec(para.text)[0])} without naming ` +
            'ObjectStack — there is no open-source edition of ObjectOS',
        );
      }
    }
  }

  // --- (a)(b) the build
  let pages = 0;
  const buildDir = at(BUILD_DIR);
  if (!existsSync(buildDir)) {
    add(
      'build-missing',
      `${BUILD_DIR} does not exist — build the docs site first (\`pnpm turbo run build\`). The rules over shipped ` +
        'output measured nothing, and an unmeasured gate is a failure, never a skip.',
    );
  } else {
    const scanBrand = (relPath, text) => {
      for (const re of MISSPELLINGS) {
        const m = re.exec(text);
        if (m) add('brand-spelling', `${BUILD_DIR}/${relPath} carries ${JSON.stringify(m[0])} — the brand is spelled ${BRAND}, once`);
      }
    };

    const llmsPath = join(buildDir, LLMS_BODY);
    if (!existsSync(llmsPath)) {
      add('build-missing', `${BUILD_DIR}/${LLMS_BODY} does not exist — the built /llms.txt was not measured`);
    } else {
      const body = readFileSync(llmsPath, 'utf8');
      const lines = body.split('\n');
      if (lines[0] !== `# ${BRAND}`) {
        add('llms-title', `built /llms.txt opens with ${JSON.stringify(lines[0])}, not \`# ${BRAND}\``);
      }
      if (positioning !== undefined) {
        const quote = lines.find((l) => l.startsWith('> '));
        if (quote === undefined) add('llms-summary-built', 'built /llms.txt carries no `> ` summary line');
        else if (quote.slice(2) !== positioning) {
          add(
            'llms-summary-built',
            `built /llms.txt summary differs from POSITIONING\n` +
              `      built:    ${JSON.stringify(quote.slice(2))}\n` +
              `      constant: ${JSON.stringify(positioning)}`,
          );
        }
      }
      scanBrand(LLMS_BODY, body);
    }

    const fullPath = join(buildDir, LLMS_FULL_BODY);
    if (!existsSync(fullPath)) {
      add('build-missing', `${BUILD_DIR}/${LLMS_FULL_BODY} does not exist — the built /llms-full.txt was not measured`);
    } else {
      scanBrand(LLMS_FULL_BODY, readFileSync(fullPath, 'utf8'));
    }

    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const docsPage = new RegExp(`^(?:${languages.map(escapeRe).join('|')})/docs(?:/.*)?\\.html$`);
    for (const file of walk(buildDir).filter((f) => f.endsWith('.html')).sort()) {
      const relPath = posix(relative(buildDir, file));
      const html = readFileSync(file, 'utf8');
      scanBrand(relPath, html);
      if (!docsPage.test(relPath)) continue;
      pages += 1;
      const title = titleOf(html);
      if (title === undefined || !title.endsWith(` | ${BRAND}`)) {
        add('title-suffix', `${BUILD_DIR}/${relPath} title is ${JSON.stringify(title)} — every docs page's title ends with \`| ${BRAND}\``);
      }
      const siteName = metaContent(html, 'property', 'og:site_name');
      if (siteName !== BRAND) {
        add('og-site-name', `${BUILD_DIR}/${relPath} og:site_name is ${JSON.stringify(siteName)}, not ${JSON.stringify(BRAND)}`);
      }
    }
    if (pages === 0) {
      add('build-missing', `no docs page under ${BUILD_DIR}/<locale>/docs — the brand rules over pages measured nothing`);
    }

    if (positioning !== undefined) {
      const indexPath = join(buildDir, defaultLanguage, 'docs.html');
      if (!existsSync(indexPath)) {
        add('index-meta-built', `no built index page at ${BUILD_DIR}/${defaultLanguage}/docs.html`);
      } else {
        const html = readFileSync(indexPath, 'utf8');
        for (const [attr, value] of [['name', 'description'], ['property', 'og:description']]) {
          const content = metaContent(html, attr, value);
          if (content !== positioning) {
            add(
              'index-meta-built',
              `built ${defaultLanguage}/docs.html ${value} is ${JSON.stringify(content)} — expected POSITIONING`,
            );
          }
        }
      }
    }
  }

  return { findings, scanned: { sources: sources.length, pages } };
}

/* ------------------------------------------------------------------- gate -- */

function gate() {
  const { findings, scanned } = check(ROOT);
  for (const f of findings) console.error(`  [${f.rule}] ${f.detail}`);
  if (findings.length) {
    console.error(
      `\n✗ positioning: ${findings.length} finding(s) — the constant is ${POSITIONING_FILE}; see the header of ` +
        `${posix(relative(ROOT, fileURLToPath(import.meta.url)))} for each rule`,
    );
    return 1;
  }
  console.log(
    `✓ positioning: the three copies agree with ${POSITIONING_FILE}, the brand is spelled ${BRAND} on ${scanned.pages} ` +
      `built docs page(s) and both llms bodies, and no stale sentence in ${scanned.sources} English source(s)`,
  );
  return 0;
}

/* -------------------------------------------------------------- self-test -- */

/**
 * A stub positioning, deliberately not the real one: the fixtures prove the
 * mechanism, and the real constant is what the gate mode reads.
 */
const STUB = {
  ONTOLOGY_HEADLINE: 'The fixture is the software.',
  ONTOLOGY_PROMISE: "One fixture. AI writes it, you own it, and it's quoted.",
  OBJECTOS_DEFINITION: "Want it hosted? That's ObjectOS, the fixture built on ObjectStack.",
  OBJECTOS_EDITIONS: 'ObjectOS runs hosted (ObjectOS Cloud) or self-managed (ObjectOS Enterprise).',
};
const STUB_POSITIONING = Object.values(STUB).join(' ');

/** `lib/positioning.ts` for a set of parts, double-quoted — the gate mode reads the real file's single quotes. */
const positioningTs = (parts = STUB) =>
  `${Object.entries(parts)
    .map(([k, v]) => `export const ${k} =\n  ${JSON.stringify(v)};`)
    .join('\n')}\nexport const POSITIONING = [${Object.keys(parts).join(', ')}].join(' ');\n`;

const mdx = (title, description, body) =>
  `---\ntitle: ${title}\ndescription: ${JSON.stringify(description)}\n---\n\n${body}\n`;

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

/** A prerendered page: the title, the two descriptions and the site name, as Next emits them. */
function page({ title = `Quickstart | ${BRAND}`, description = 'Run it.', siteName = BRAND, lang = 'en', body = 'Prose.' } = {}) {
  return (
    `<!DOCTYPE html><html lang="${lang}"><head><title>${attr(title)}</title>` +
    `<meta name="description" content="${attr(description)}"/>` +
    `<meta property="og:description" content="${attr(description)}"/>` +
    (siteName === undefined ? '' : `<meta property="og:site_name" content="${attr(siteName)}"/>`) +
    `</head><body><main>${body}</main></body></html>`
  );
}

const llms = ({ title = BRAND, summary = STUB_POSITIONING } = {}) =>
  `# ${title}\n\n> ${summary}\n\nThis is the documentation.\n\n## Overview\n\n- [Introduction](https://docs.objectos.ai/docs): Start here.\n`;

const BASE = {
  [POSITIONING_FILE]: positioningTs(),
  [SOURCE_FILE]: `export const SITE_NAME = '${BRAND}';\n`,
  [I18N_FILE]: "export const i18n = defineI18n({\n  defaultLanguage: 'en',\n  languages: ['en', 'zh-Hans', 'ja'],\n});\n",
  [LAYOUT_FILE]:
    "import { POSITIONING } from '@/lib/positioning';\n" +
    `export const metadata = { title: { template: '%s | ${BRAND}', default: '${BRAND}' }, description: POSITIONING };\n`,
  [LLMS_ROUTE_FILE]: "import { POSITIONING } from '@/lib/positioning';\nconst SUMMARY = POSITIONING;\n",
  [INDEX_FILE]: mdx('Introduction', STUB_POSITIONING, 'Welcome. See [License](/docs/license).'),
  'content/docs/quickstart.mdx': mdx('Quickstart', 'Run it.', 'Install the CLI. Does ObjectOS phone home? Only to validate a licence.'),
  'content/docs/license.mdx': mdx(
    'License',
    'Editions.',
    'ObjectOS is a commercial product. The open-source ObjectStack framework is Apache-2.0:\nno seats, no usage tier, no license server, no key, no telemetry.',
  ),
  'content/docs/quickstart.ja.mdx': mdx('クイックスタート', '実行する。', 'ObjectOS is a self-hosted runtime (stale, but a derived artifact).'),
  [`${BUILD_DIR}/${LLMS_BODY}`]: llms(),
  [`${BUILD_DIR}/${LLMS_FULL_BODY}`]: '# Introduction\n\nWelcome.\n\n# Quickstart\n\nInstall the CLI.\n',
  [`${BUILD_DIR}/en/docs.html`]: page({ title: `Introduction | ${BRAND}`, description: STUB_POSITIONING }),
  [`${BUILD_DIR}/en/docs/quickstart.html`]: page(),
  [`${BUILD_DIR}/ja/docs.html`]: page({ title: `はじめに | ${BRAND}`, description: STUB_POSITIONING, lang: 'ja' }),
  [`${BUILD_DIR}/en/privacy.html`]: page({ title: BRAND, description: STUB_POSITIONING, siteName: undefined }),
  [`${BUILD_DIR}/_not-found.html`]:
    '<!DOCTYPE html><html lang="en"><head><title>404: This page could not be found.</title></head><body>404</body></html>',
};

/**
 * Each case overlays `files` on `BASE` (`null` deletes) and expects exactly the
 * rule set `expect`. `noBuild` leaves the whole build tree out.
 */
const CASES = [
  { name: 'clean baseline', files: {}, expect: [] },

  /* (a) the copies */
  {
    name: 'index description paraphrases the constant',
    files: { [INDEX_FILE]: mdx('Introduction', 'ObjectOS is a fixture, hosted or self-managed.', 'Welcome.') },
    expect: ['index-description'],
  },
  {
    name: 'index frontmatter has no description',
    files: { [INDEX_FILE]: '---\ntitle: Introduction\n---\n\nWelcome.\n' },
    expect: ['index-description'],
  },
  {
    name: 'index description is a single-quoted scalar carrying the same bytes',
    files: {
      [INDEX_FILE]: `---\ntitle: Introduction\ndescription: '${STUB_POSITIONING.replace(/'/g, "''")}'\n---\n\nWelcome.\n`,
    },
    expect: [],
  },
  {
    name: 'layout carries a literal description of its own',
    files: {
      [LAYOUT_FILE]: "import { POSITIONING } from '@/lib/positioning';\nexport const metadata = { description: 'Customer-hosted runtime.' };\n",
    },
    expect: ['layout-description'],
  },
  {
    name: 'layout stopped importing the constant',
    files: { [LAYOUT_FILE]: "export const metadata = { description: 'Customer-hosted runtime.' };\n" },
    expect: ['layout-description'],
  },
  {
    name: 'llms route carries its own SUMMARY literal',
    files: { [LLMS_ROUTE_FILE]: "const SUMMARY = 'ObjectStack is the open target format; ObjectOS is the platform.';\n" },
    expect: ['llms-summary-source'],
  },
  {
    name: 'built llms.txt summary differs from the constant',
    files: { [`${BUILD_DIR}/${LLMS_BODY}`]: llms({ summary: 'ObjectOS is the commercial production platform.' }) },
    expect: ['llms-summary-built'],
  },
  {
    name: 'built llms.txt has no summary line',
    files: { [`${BUILD_DIR}/${LLMS_BODY}`]: `# ${BRAND}\n\nThis is the documentation.\n` },
    expect: ['llms-summary-built'],
  },
  {
    name: 'built index page description differs from the constant',
    files: { [`${BUILD_DIR}/en/docs.html`]: page({ title: `Introduction | ${BRAND}`, description: 'The runtime that stays in your network.' }) },
    expect: ['index-meta-built'],
  },
  {
    // The composition is pinned through the built line: a module that joined
    // its parts differently ships a different summary.
    name: 'the module composes the parts with a different separator',
    files: {
      [POSITIONING_FILE]: positioningTs().replace(".join(' ')", ".join('\\n')"),
      [`${BUILD_DIR}/${LLMS_BODY}`]: llms({ summary: Object.values(STUB).join('\n') }),
    },
    expect: ['llms-summary-built'],
  },
  {
    name: 'a part of the constant is not a parseable literal',
    files: { [POSITIONING_FILE]: positioningTs().replace(/export const OBJECTOS_EDITIONS =[\s\S]*?;\n/, 'export const OBJECTOS_EDITIONS = parts.join(" ");\n') },
    expect: ['positioning-source'],
  },
  {
    name: 'the constant module grew an import',
    files: { [POSITIONING_FILE]: `import { SITE_NAME } from '@/lib/source';\n${positioningTs()}` },
    expect: ['positioning-source'],
  },

  /* (b) the brand */
  {
    name: 'SITE_NAME spelled a fourth way',
    files: { [SOURCE_FILE]: "export const SITE_NAME = 'Objectos';\n" },
    expect: ['site-name'],
  },
  {
    name: 'a docs page title without the brand suffix',
    files: { [`${BUILD_DIR}/en/docs/quickstart.html`]: page({ title: 'Quickstart' }) },
    expect: ['title-suffix'],
  },
  {
    name: 'a docs page whose og:site_name is the old share-card misname',
    files: { [`${BUILD_DIR}/ja/docs.html`]: page({ title: `はじめに | ${BRAND}`, description: STUB_POSITIONING, lang: 'ja', siteName: 'ObjectStack Protocol' }) },
    expect: ['og-site-name', 'brand-spelling'],
  },
  {
    name: 'built llms.txt titled with the old docblock misname',
    files: { [`${BUILD_DIR}/${LLMS_BODY}`]: llms({ title: 'ObjectStack Documentation' }) },
    expect: ['llms-title', 'brand-spelling'],
  },
  {
    name: 'a page spells the brand with a space',
    files: { [`${BUILD_DIR}/en/docs/quickstart.html`]: page({ body: 'Object OS boots in seconds.' }) },
    expect: ['brand-spelling'],
  },
  {
    name: 'llms-full.txt spells the brand in lower camel',
    files: { [`${BUILD_DIR}/${LLMS_FULL_BODY}`]: '# Quickstart\n\nobjectOS boots in seconds.\n' },
    expect: ['brand-spelling'],
  },
  {
    // The accepted state from the ruling on #171: the misname survives in a
    // code comment that ships nowhere.
    name: 'the i18n docblock still says "ObjectStack Documentation" (source only)',
    files: {
      [I18N_FILE]:
        "/**\n * i18n Configuration for ObjectStack Documentation\n */\nexport const i18n = defineI18n({\n  defaultLanguage: 'en',\n  languages: ['en', 'zh-Hans', 'ja'],\n});\n",
    },
    expect: [],
  },
  {
    name: 'the host and the package scope are not misspellings',
    files: { [`${BUILD_DIR}/en/docs/quickstart.html`]: page({ body: 'See https://docs.objectos.ai and @objectos/docs.' }) },
    expect: [],
  },

  /* (c) the stale sentences */
  {
    name: 'the index pitches a self-hosted runtime again',
    files: { 'content/docs/intro.mdx': mdx('Intro', 'Pitch.', '**ObjectOS is a self-hosted runtime for building internal tools.**') },
    expect: ['stale-self-hosted'],
  },
  {
    name: 'the same sentence wrapped across two lines',
    files: { 'content/docs/intro.mdx': mdx('Intro', 'Pitch.', 'ObjectOS is a self-hosted\nruntime for internal tools.') },
    expect: ['stale-self-hosted'],
  },
  {
    name: 'the same sentence as a frontmatter description',
    files: { 'content/docs/intro.mdx': mdx('Intro', 'ObjectOS is a self-hosted runtime.', 'Body.') },
    expect: ['stale-self-hosted'],
  },
  {
    name: 'the stale sentence inside a code fence',
    files: { 'content/docs/intro.mdx': mdx('Intro', 'Pitch.', '```text\nObjectOS is a self-hosted runtime.\n```') },
    expect: [],
  },
  {
    name: 'the stale sentence inside an MDX comment',
    files: { 'content/docs/intro.mdx': mdx('Intro', 'Pitch.', '{/*\n  Was: ObjectOS is a self-hosted runtime. Rewritten under #171.\n*/}\n\nBody.') },
    expect: [],
  },
  {
    name: 'the glossary calls ObjectOS open source again',
    files: {
      'content/docs/glossary.mdx': mdx('Glossary', 'Terms.', '### ObjectOS\n\nThe runtime — a single Node.js process that serves your apps. Open\nsource, Apache-2.0. **This documentation site is for ObjectOS.**'),
    },
    expect: ['stale-open-source'],
  },
  {
    name: 'a paragraph contrasting ObjectOS with the open-source stack',
    files: {
      'content/docs/glossary.mdx': mdx('Glossary', 'Terms.', 'ObjectOS is commercial. The stack it runs on is ObjectStack. Open source, Apache-2.0, that one.'),
    },
    expect: [],
  },
  {
    name: '"never phones home" comes back',
    files: { 'content/docs/intro.mdx': mdx('Intro', 'Pitch.', 'ObjectOS never phones home. No telemetry.') },
    expect: ['stale-phones-home'],
  },
  {
    name: '"does not call home" comes back',
    files: { 'content/docs/arch.mdx': mdx('Arch', 'Shape.', 'ObjectOS does not call home. If you cut internet access it keeps running.') },
    expect: ['stale-phones-home'],
  },
  {
    name: '"No license server." comes back',
    files: { 'content/docs/intro.mdx': mdx('Intro', 'Pitch.', 'No telemetry. No license server. Air-gapped networks are first-class.') },
    expect: ['stale-license-server'],
  },
  {
    name: '"does not check a license server" comes back',
    files: { 'content/docs/sec.mdx': mdx('Security', 'Review.', 'It does not phone home, does not check a license\nserver, does not ping for updates.') },
    expect: ['stale-phones-home', 'stale-license-server'],
  },
  {
    name: '"No licence check." in the other spelling',
    files: { 'content/docs/arch.mdx': mdx('Arch', 'Shape.', 'No licence check. Ever.') },
    expect: ['stale-license-server'],
  },
  {
    // A derived artifact is the translation pass's problem, not an author's:
    // only English sources are scanned, and BASE carries this stale sibling.
    name: 'a stale sentence in a locale sibling only',
    files: { 'content/docs/arch.ja.mdx': mdx('アーキテクチャ', '形。', 'ObjectOS never phones home.') },
    expect: [],
  },
  {
    // Prose outside `content/docs/` is out of this gate's scan by design — see
    // the header: PR 2 of #171 owns the legal pages.
    name: 'a stale sentence in app code is outside the scan',
    files: { 'apps/docs/app/[lang]/privacy/page.tsx': "const text = 'The runtime does not phone home.';\n" },
    expect: [],
  },

  /* the prerequisite */
  {
    name: 'no build output',
    files: {},
    noBuild: true,
    expect: ['build-missing'],
  },
  {
    name: 'a build with no docs page',
    files: { [`${BUILD_DIR}/en/docs.html`]: null, [`${BUILD_DIR}/en/docs/quickstart.html`]: null, [`${BUILD_DIR}/ja/docs.html`]: null },
    expect: ['build-missing', 'index-meta-built'],
  },
];

function materialize(dir, c) {
  const files = { ...BASE, ...c.files };
  for (const [path, text] of Object.entries(files)) {
    if (text === null) continue;
    if (c.noBuild && path.startsWith(`${BUILD_DIR}/`)) continue;
    const p = join(dir, path);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
  }
}

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'os-positioning-'));
  let failed = 0;
  const seen = new Set();
  try {
    CASES.forEach((c, i) => {
      const caseDir = join(dir, `case-${i}`);
      materialize(caseDir, c);
      const { findings } = check(caseDir);
      const got = [...new Set(findings.map((f) => f.rule))].sort();
      const want = [...new Set(c.expect)].sort();
      for (const r of want) seen.add(r);
      const ok = got.length === want.length && got.every((r, k) => r === want[k]);
      console.log(`${ok ? '✓' : '✗'} ${c.name.padEnd(66)} [${got.join(' ') || '—'}]`);
      if (!ok) {
        failed += 1;
        console.error(`      expected [${want.join(' ') || '—'}]`);
        for (const f of findings) console.error(`      [${f.rule}] ${f.detail}`);
      }
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // Every rule has a fixture that makes it fire, and the baseline is silent:
  // a rule observed only green is indistinguishable from one that cannot fail.
  for (const rule of RULES) {
    if (!seen.has(rule)) {
      console.error(`✗ no case makes ${rule} fire`);
      failed += 1;
    }
  }
  for (const rule of seen) {
    if (!RULES.includes(rule)) {
      console.error(`✗ a case expects ${rule}, which RULES does not declare`);
      failed += 1;
    }
  }
  if (!CASES.some((c) => c.expect.length === 0 && Object.keys(c.files).length === 0 && !c.noBuild)) {
    console.error('✗ no clean baseline case');
    failed += 1;
  }

  console.log('');
  if (failed) {
    console.error(`✗ self-test: ${failed} check(s) did not behave as declared`);
    return 1;
  }
  console.log(
    `✓ self-test: ${CASES.length} case(s) — every one of ${RULES.length} rule(s) can fail, and stays silent on the ` +
      'shapes the rulings on #171 accepted',
  );
  return 0;
}

const code = process.argv.includes('--self-test') ? selfTest() : gate();
if (code !== 0) process.exit(code);
