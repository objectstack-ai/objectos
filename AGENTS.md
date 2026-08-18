# AGENTS.md

Guidance for AI agents (Claude Code, Codex, Cursor, etc.) working in this repository.

## Repository

ObjectOS — the commercial runtime environment for ObjectStack applications (Cloud & Enterprise editions). This public repository is the product's front door: the marketing + docs site under `apps/docs` (content in `content/docs/`), the issue tracker, and the trademark policy. Product source is developed privately and does not live here.

## Critical rules

### 1. English is the single source of truth for all content

All marketing copy, UI strings, and documentation are authored in **English first**. Every other locale (`zh-Hans`, `ja`, `de`, `es`, `fr`, `ko`) is a **translation derived from English**.

- **Always edit the English source first.** Never patch a translation without updating the English original — translation passes will overwrite you.
- If a typo or wording change only appears in a translation, fix English too (it almost certainly has the same issue or will after the next sync).
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
| Docs MDX content | `content/docs/**/*.mdx` |
| Sidebar structure / grouping | `content/docs/**/meta.json` |

### Locale conventions

- Supported locales, as BCP 47 tags — `apps/docs/lib/i18n.ts` is the authority: `en` (default), `zh-Hans`, `ja`, `de`, `es`, `fr`, `ko`.
- ⛔ **There is no `cn` locale.** It is a legacy code that `middleware.ts` 308-redirects to `zh-Hans`. A file named `foo.cn.mdx` would never render **and would raise no error** — it is simply ignored, which is the worst possible failure mode for a translation. Simplified Chinese is `zh-Hans`.
- Default locale has no prefix (`/docs/...`); other locales are prefixed (`/zh-Hans/docs/...`). This is set by `hideLocale: 'default-locale'` in `lib/i18n.ts`.
- **MDX translations:** add a sibling file with the locale tag next to the English `.mdx` — `foo.zh-Hans.mdx`, `foo.ja.mdx`, and so on. Fumadocs auto-falls-back to English when a translation is missing — you can ship translations incrementally without breaking links.
- **Language display names:** `LANGUAGE_NAMES` in `apps/docs/app/[lang]/layout.tsx`. Adding a locale to `i18n.ts` without a name here shows the raw tag in the switcher.
- **Sidebar titles:** `meta.json` `title` fields render in all locales unless a per-locale sibling exists. To localize sidebar labels, add `meta.<locale>.json` (e.g. `meta.zh-Hans.json`, Fumadocs convention) — don't translate inside the English file.

### Sidebar grouping

Folder `meta.json` files declare a section's title, page order, and `defaultOpen: false` to make the group collapsible and collapsed by default. The root `content/docs/meta.json` references folders by name (`"deploy"`, `"build"`, …), not by the `"...deploy"` spread + `---Deploy---` separator pattern (the old pattern produced a flat ~50-item sidebar).

### Translation workflow

When the English source changes:
1. Edit the English `.mdx` first; verify it renders.
2. Update each existing locale sibling (`.zh-Hans.mdx`, `.ja.mdx`, …) to match.
3. If a locale sibling doesn't exist yet, that's fine — Fumadocs falls back to English. Create one when you're ready to translate, not as a stub.
4. Keep `frontmatter` (title, description) translated too.
5. **A rewrite that changes what a page asserts must delete the stale siblings it invalidates**, not leave them. A missing translation renders correct English; a stale one renders content the English source no longer claims.

### Don't

- Don't reintroduce the `---Section---` + `"...folder"` flat sidebar pattern.
- Don't set `alt="ObjectOS"` on the logo image when the adjacent text already says "ObjectOS" — screen readers read it twice. Use `alt=""` + `aria-hidden`.
- Don't add translation-only strings or files. If it doesn't have an English source, it shouldn't exist yet.
- Don't write a `.cn.mdx` sibling. That locale does not exist; the file is ignored silently. Use `.zh-Hans.mdx`.

## Commands

From `apps/docs/`:
- `npm run dev` — dev server on http://localhost:3001
- `npm run type-check` — `fumadocs-mdx && next typegen && tsc --noEmit`
- `npm run build` — production build
