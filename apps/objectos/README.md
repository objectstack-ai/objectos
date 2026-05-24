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
