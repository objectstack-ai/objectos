# ObjectOS

> **The reference runtime distribution of the [ObjectStack framework](https://github.com/objectstack-ai/framework).**

ObjectOS is what you ship to end customers. It is a thin, opinionated
**distribution** of the ObjectStack protocol: one `objectstack.config.ts`,
a `Dockerfile`, a Helm chart, and operational documentation. All
protocol, kernel, drivers and official plugins come from the
`@objectstack/*` packages on npm — this repository contains **no
protocol implementation of its own**.

```
ObjectStack framework  ≈  Linux kernel source tree
ObjectOS               ≈  the distribution you actually deploy
```

## Positioning

| | ObjectStack framework | **ObjectOS** | Enterprise plugins |
|---|---|---|---|
| Repo | `objectstack-ai/framework` | `objectstack-ai/objectos` | `objectstack-ai/objectos-enterprise` (private) |
| What it ships | Protocol, Kernel, all `@objectstack/*` packages, Studio, Cloud control plane | Runtime distribution + Docker/Helm + ops docs | SSO/SAML, SCIM, audit export, HA scheduler, … |
| Who consumes it | Framework contributors, plugin authors | **End customers** (self-host / private cloud) | Enterprise customers |
| License | AGPL-3.0 | **AGPL-3.0** | Commercial |
| Release cadence | Frequent (per `changeset`) | Distribution semver (e.g. `2026.05 LTS`) | Tracks ObjectOS |

The framework develops the protocol; ObjectOS packages a protocol
version into something a customer can `docker run`, sign an SLA on,
and deploy into an air-gapped environment.

## Repository layout

```
objectos/
├── apps/
│   ├── objectos/            # Runtime entry — single objectstack.config.ts
│   └── docs/                # Product / operations site (Fumadocs + Next.js)
├── packages/                # Enterprise plugins (@objectos/plugin-*)
├── content/docs/            # MDX content powering apps/docs
├── docker/                  # Dockerfile + docker-compose
├── helm/                    # Helm chart (planned)
├── examples/                # Reference deployments
├── e2e/                     # Black-box smoke tests against the published image
└── scripts/
```

## Boot modes

ObjectOS boots in one of two modes, selected by environment variables:

| Mode | Required env | Use case |
|---|---|---|
| **Cloud-connected** | `OS_CLOUD_URL`, `OS_PROJECT_ID` | Production with the ObjectStack control plane / Studio |
| **Offline / air-gapped** | `OS_ARTIFACT_FILE` | Compile locally with the CLI, ship the JSON artifact, run anywhere |

See [`apps/objectos/objectstack.config.ts`](apps/objectos/objectstack.config.ts).

## Quick start

```bash
pnpm install

# Build the runtime distribution and docs
pnpm build

# Boot the runtime against a local compiled artifact produced by apps/objectos
cd apps/objectos
OS_ARTIFACT_FILE=dist/objectstack.json PORT=3200 pnpm start

# Or run the documentation site
pnpm docs:dev
```

Docker:

```bash
mkdir -p docker/artifacts
cp apps/objectos/dist/objectstack.json docker/artifacts/objectstack.json
docker compose -f docker/docker-compose.yml up --build
```

Docker Compose publishes ObjectOS on `http://localhost:3000` by default.
Use `OBJECTOS_PORT=3200` to change the host port.

## History

The pre-rewrite codebase (a much larger multi-package implementation
that predated the framework / distribution split) is preserved on the
[`legacy/v1`](https://github.com/objectstack-ai/objectos/tree/legacy/v1)
branch and tagged [`v1-final`](https://github.com/objectstack-ai/objectos/releases/tag/v1-final).
The current `main` is a deliberate restart aligned with the
[ObjectStack North Star](https://github.com/objectstack-ai/framework/blob/main/content/docs/concepts/north-star.mdx).

## License

[AGPL-3.0](LICENSE).
