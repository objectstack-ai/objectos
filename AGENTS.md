# AGENTS.md

Guidance for AI agents (Claude Code, Codex, Cursor, etc.) working in this repository.

## Repository

ObjectOS — the commercial runtime environment for ObjectStack applications (Cloud & Enterprise editions). This public repository is the product's front door: the marketing + docs site under `apps/docs` (content in `content/docs/`), the issue tracker, and the trademark policy. Product source is developed privately and does not live here.

## Critical rules

### 1. English is the single source of truth for all content

All marketing copy, UI strings, and documentation are authored in **English first**. Every other locale (`zh-Hans`, `ja`, `de`, `es`, `fr`, `ko`) is a **translation derived from English**.

- **Edit English, and only English.** Translations are generated, not authored — a PR that hand-edits a locale file is rejected by CI (see [Translation workflow](#translation-workflow)).
- If a typo or wording change only appears in a translation, fix English. The translation is re-derived from it.
- Translations are derived artifacts; treat them like generated code that happens to be checked in — because they now are.

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

**You edit English. You do not edit translations.** Every `*.<locale>.mdx` file is a derived artifact, refreshed by a separate periodic pass under [`docs/TRANSLATION.md`](docs/TRANSLATION.md). `.github/scripts/check-translation-ownership.mjs` rejects any PR that mixes the two — hand-maintained siblings used to be **86% of the diff** in a typical docs PR, which is the cost this split removes.

When the English source changes:
1. Edit the English `.mdx`; verify it renders. That is the whole task.
2. Leave the locale siblings alone. They are stale now, the freshness gate says so on your PR, and the next pass fixes them. Stale is **reported, not blocking** — English landing on its own is the design, not an oversight.
3. **Retiring or renaming a page is the exception:** delete its locale siblings in the same PR. An orphaned translation blocks the gate, and a translation of a page that was rewritten to assert something different is worse than none — a missing translation renders correct English, a stale one renders content the English source no longer claims.
4. Never hand-write the `translation:` frontmatter block. Only `check-translations.mjs --stamp` writes it; a hand-typed sha is a lie the gate cannot catch.

Status at any time:

```bash
node .github/scripts/check-translations.mjs             # report + gate
node .github/scripts/check-translations.mjs --worklist  # what the next pass will do
```

### Don't

- Don't reintroduce the `---Section---` + `"...folder"` flat sidebar pattern.
- Don't set `alt="ObjectOS"` on the logo image when the adjacent text already says "ObjectOS" — screen readers read it twice. Use `alt=""` + `aria-hidden`.
- Don't add translation-only strings or files. If it doesn't have an English source, it shouldn't exist yet.
- Don't write a `.cn.mdx` sibling. That locale does not exist; the file is ignored silently. Use `.zh-Hans.mdx`.
- Don't hand-edit a `*.<locale>.mdx` file, and don't "just fix" one while you're in there. Fix the English source instead.

## Commands

From `apps/docs/`:
- `npm run dev` — dev server on http://localhost:3001
- `npm run type-check` — `fumadocs-mdx && next typegen && tsc --noEmit`
- `npm run build` — production build

## Turbo caching and content changes

`content/docs/` sits at the repo root, **outside** the `apps/docs` package, but both
`build` and `type-check` genuinely consume it (`source.config.ts` points fumadocs at
`../../content/docs`). Turbo's default hash only covers the package's own directory, so
those tasks used to replay a cached green for a content-only change — and because the
cache is shared across worktrees in a multi-agent container, the replayed logs could come
from a *sibling agent's* tree. `turbo.json` now names the dependency explicitly:

```json
"inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/content/docs/**"]
```

`$TURBO_ROOT$` is anchored to the repo root by turbo itself. Prefer it over a hand-counted
`../../` — both work today, but a relative glob encodes the package's depth, and if the
package ever moves the glob silently stops matching.

**Verify the hash, don't trust the config.** A wrong `inputs` glob is not an error: turbo
exits 0, matches nothing, and the task silently goes back to the stale hash. So when you
change these globs, confirm the hash actually moves — edit any file under `content/docs/`,
then revert it, and check the hash changes and comes back:

```bash
turbo run type-check --filter=@objectos/docs --dry=json | jq -r '.tasks[0].hash'
```

Belt and braces: `turbo run build --force` ignores the cache entirely. Reach for it if you
are verifying a content change on a turbo older than 2.4 (before `$TURBO_ROOT$` existed,
where the glob above matches nothing), or any time a `>>> FULL TURBO` on a content PR
looks wrong. `--force` is the escape hatch, not the routine path — the hash is supposed to
tell the truth on its own.
