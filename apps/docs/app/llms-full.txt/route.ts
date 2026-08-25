import { i18n } from '@/lib/i18n';
import { getLLMText, source } from '@/lib/source';

export const revalidate = false;

/**
 * English only, by `AGENTS.md` rule 1 — English is the single source of truth
 * and every `*.<locale>.mdx` is a derived artifact. This is the same pin
 * `llms.txt` carries, for the same reason: `source.getPages()` filters by
 * locale **only when a language is passed** — called bare it returns every
 * language's page set concatenated, so this route used to emit all 335 pages
 * across 7 locales (4.6 MB, the same page appearing up to seven times) instead
 * of the 79 English ones. The locale text stays reachable per page through the
 * `.mdx` rewrite and the locale URLs announced at the end of `llms.txt`.
 */
const LANG = i18n.defaultLanguage;

export async function GET() {
  const scan = source.getPages(LANG).map(getLLMText);
  const scanned = await Promise.all(scan);

  return new Response(scanned.join('\n\n'));
}
