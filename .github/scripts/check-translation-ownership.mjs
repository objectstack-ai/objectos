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
 * The discriminator is the PR author's login, not a label — a label can be
 * forgotten or edited, an author cannot be forged. Set the repo variable
 * `TRANSLATION_BOT_LOGIN` to the dedicated account. Until it is set the check
 * reports and passes, so this can land before the account exists.
 *
 * Usage:
 *   node .github/scripts/check-translation-ownership.mjs --actor <login> --files <list>
 *
 * <list> is a file containing one changed path per line (`git diff --name-only`).
 */
import { readFileSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
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

function main() {
  const argv = process.argv.slice(2);
  const value = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  };

  const actor = (value('actor') ?? '').trim();
  const listFile = value('files');
  if (!listFile) throw new Error('--files <path> is required');

  const changed = readFileSync(resolve(ROOT, listFile), 'utf8')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const botLogin = (process.env.TRANSLATION_BOT_LOGIN ?? '').trim();
  const isBot = botLogin !== '' && actor.toLowerCase() === botLogin.toLowerCase();

  const artifacts = changed.filter(isTranslationArtifact);
  const others = changed.filter((p) => !isTranslationArtifact(p));

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

  if (artifacts.length) {
    console.error(
      `✗ translations are generated, not hand-written.\n` +
        `  This PR edits ${artifacts.length} translation artifact(s):\n` +
        artifacts.map((p) => `    ${p}`).join('\n') +
        `\n\n  Edit the English source instead — the translation pass will follow.\n` +
        `  See docs/TRANSLATION.md. To retire a page, delete its English source and\n` +
        `  the siblings go with it (the freshness gate reports them as orphaned).`,
    );
    process.exit(1);
  }

  console.log(`✓ ${changed.length} file(s) changed, no translation artifacts touched.`);
}

main();
