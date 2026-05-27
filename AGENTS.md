# AGENTS.md

Guidance for AI agents (Claude Code, Codex, Cursor, etc.) working in this repository.

## Repository

ObjectOS — customer-hosted runtime for ObjectStack applications. Monorepo with the marketing + docs site under `apps/docs`.

## Critical rules

### 1. English is the single source of truth for all content

All marketing copy, UI strings, and documentation are authored in **English first**. Chinese (`cn`) and any future locales are **translations derived from English**.

- **Always edit the English source first.** Never patch a translation without updating the English original — translation passes will overwrite you.
- If a typo or wording change only appears in Chinese, fix English too (it almost certainly has the same issue or will after the next sync).
- New content must be added to English before translations are touched.
- Translations are derived artifacts; treat them like generated code that happens to be checked in.

### 2. Test in a real browser before claiming UI work is done

Type-checks and unit tests verify code correctness, not feature correctness. For any UI change in `apps/docs`, run the dev server and exercise the change in a browser before reporting done. If a tool can't drive a browser, say so explicitly rather than guessing.

## apps/docs (Fumadocs site)

Stack: Next.js 16 App Router + Fumadocs UI 16 + Fumadocs MDX. Many UI affordances (theme toggle, search modal, language switcher, sidebar, link rendering) come from Fumadocs components, not custom code. Check `node_modules/fumadocs-ui` before assuming something is broken in app code.

### Where things live

| Concern | File |
|---|---|
| Locale list & default | `apps/docs/lib/i18n.ts` |
| Language display names | `apps/docs/app/[lang]/layout.tsx` (`LANGUAGE_NAMES`) |
| Locale detection / URL rewrite | `apps/docs/middleware.ts` |
| Header + logo | `apps/docs/lib/layout.shared.tsx` |
| Homepage copy (en + cn) | `apps/docs/lib/homepage-i18n.ts` |
| Docs MDX content | `content/docs/**/*.mdx` |
| Sidebar structure / grouping | `content/docs/**/meta.json` |

### Locale conventions

- Supported locales: `en` (default), `cn`.
- Default locale has no prefix (`/docs/...`); other locales are prefixed (`/cn/docs/...`). This is set by `hideLocale: 'default-locale'` in `lib/i18n.ts`.
- **MDX translations:** add a sibling file with `.cn.mdx` next to the English `.mdx`. Fumadocs auto-falls-back to English when a translation is missing — you can ship translations incrementally without breaking links.
- **Homepage strings:** must exist in both `en` and `cn` objects in `lib/homepage-i18n.ts` (they implement the `HomepageTranslations` interface; missing keys are a type error).
- **Sidebar titles:** `meta.json` `title` fields currently render in all locales. If you localize sidebar labels, add per-locale `meta.cn.json` (Fumadocs convention) — don't translate inside the English file.

### Sidebar grouping

Folder `meta.json` files declare a section's title, page order, and `defaultOpen: false` to make the group collapsible and collapsed by default. The root `content/docs/meta.json` references folders by name (`"deploy"`, `"build"`, …), not by the `"...deploy"` spread + `---Deploy---` separator pattern (the old pattern produced a flat ~50-item sidebar).

### Translation workflow

When the English source changes:
1. Edit the English `.mdx` / `en` object first; verify it renders.
2. Update the `.cn.mdx` / `cn` object to match.
3. If a `.cn.mdx` doesn't exist yet, that's fine — Fumadocs falls back to English. Create one when you're ready to translate, not as a stub.
4. Keep `frontmatter` (title, description) translated too.

### Don't

- Don't reintroduce the `---Section---` + `"...folder"` flat sidebar pattern.
- Don't set `alt="ObjectOS"` on the logo image when the adjacent text already says "ObjectOS" — screen readers read it twice. Use `alt=""` + `aria-hidden`.
- Don't add Chinese-only strings or files. If it doesn't have an English source, it shouldn't exist yet.

## Commands

From `apps/docs/`:
- `npm run dev` — dev server on http://localhost:3001
- `npm run type-check` — `fumadocs-mdx && next typegen && tsc --noEmit`
- `npm run build` — production build
