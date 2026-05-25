# `apps/objectos`

The reference **ObjectOS runtime distribution** — a thin wrapper that
boots an `@objectstack/runtime` kernel from either:

- a compiled artifact pulled from the Artifact API (cloud mode), or
- a local `dist/objectstack.json` file (offline / air-gapped mode).

This package intentionally contains **no protocol code**. All schemas,
the kernel, drivers and official plugins come from `@objectstack/*`
packages on npm. Enterprise plugins maintained in this monorepo live under `../../packages/`
and are composed into the runtime stack returned by
[`createObjectOSStack`](https://www.npmjs.com/package/@objectstack/runtime)
in [`objectstack.config.ts`](./objectstack.config.ts).

See the repository [README](../../README.md) for positioning and the
[ObjectStack North Star](https://docs.objectstack.ai/concepts/north-star)
for the architectural rationale.

## Desktop distribution

`desktop.mjs` is a thin launcher that turns this app into a "download &
double‑click" experience. It picks an OS‑appropriate per‑user data
directory, points the runtime at the bundled `dist/objectstack.json`,
finds a free port and opens the default browser.

Local dev:

```bash
pnpm --filter @objectos/app desktop
```

Build a portable bundle (Node runtime + production deps + launcher),
zipped per target platform:

```bash
# Defaults to the host platform.
scripts/build-desktop.sh

# Cross‑build the Node binary for another target (native modules still
# need to be rebuilt on that OS):
scripts/build-desktop.sh --target linux-x64
scripts/build-desktop.sh --target win-x64
```

Output lives in `dist/desktop/ObjectOS-<version>-<os>-<arch>.zip`.
End users unzip and run `ObjectOS.sh` (macOS / Linux) or
`ObjectOS.cmd` (Windows). Per‑user data lives in `~/.objectstack`
on all platforms (override with `OBJECTOS_HOME`).

Override with `OBJECTOS_HOME`, `PORT`, or any standard `OS_*` env
variable (e.g. `OS_CLOUD_URL` to leave offline mode).
