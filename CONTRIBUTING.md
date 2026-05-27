# Contributing to ObjectOS

ObjectOS is the **distribution layer** of the ObjectStack ecosystem.
Read this before opening a PR.

## What belongs here

- Runtime distribution glue: `apps/objectos/objectstack.config.ts`,
  Dockerfile, Helm chart, deployment examples.
- Documentation for installing, configuring, upgrading and operating
  ObjectOS (`content/docs/`, `apps/docs/`).
- **Enterprise plugins** maintained by the ObjectStack team under
  `packages/plugin-*`.

## What does NOT belong here

- Protocol schemas, kernel internals, drivers or community plugins —
  those live in [`objectstack-ai/framework`](https://github.com/objectstack-ai/framework).
  If a change needs to modify a `@objectstack/*` package, open the PR
  there first; only after it ships to npm can ObjectOS consume it.
- Application metadata, business logic or sample apps — those belong
  to the application's own repository or to `framework/examples/`.

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

By contributing you agree your contributions are licensed under the
[Apache License 2.0](LICENSE), the same license that covers this
repository. Per Apache 2.0 § 5, contributions are submitted under the
terms of the License without any additional terms or conditions.
