# Changelog

## Unreleased

- CI: install Tauri 2 Linux system dependencies (webkit2gtk-4.1, gtk-3, ayatana-appindicator3, rsvg2, soup-3.0, javascriptcoregtk-4.1, xdo, ssl) and add Rust toolchain + cargo cache so `pnpm build` can compile the `@objectos/one` Tauri app on `ubuntu-latest`.
- Repository re-initialized as the **ObjectOS reference runtime distribution**.
- Previous codebase preserved on branch `legacy/v1` and tag `v1-final`.
- Adopted pnpm + Turborepo monorepo layout: `apps/objectos`, `apps/docs`, `packages/*`.
- License remains AGPL-3.0.
