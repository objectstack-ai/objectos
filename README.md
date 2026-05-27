# ObjectOS

> **Your data. Your network. Your rules.**
>
> ObjectOS is the customer-hosted runtime for [ObjectStack](https://github.com/objectstack-ai/framework)
> applications — built to run inside your own infrastructure: private cloud,
> customer data centers, or fully air-gapped networks.

ObjectOS is the **distribution** of the ObjectStack protocol. The framework
develops the kernel, drivers, and `@objectstack/*` packages on npm. This
repository packages a protocol version into something a customer can
`docker run`, sign an SLA on, and deploy into a network with no internet
egress.

```
ObjectStack framework  ≈  Linux kernel source tree
ObjectOS               ≈  the distribution you actually deploy
```

## Why ObjectOS

For teams that cannot — or will not — hand customer data to a third party:

- **Self-hosted runtime.** Runs in your environment, on your servers,
  against your database. The control plane is optional; the runtime never
  depends on a public service to keep the application alive.
- **Deploy anywhere.** Single-container Docker for evaluation, Kubernetes
  for production HA, or a long-running process on bare metal. Same
  artifact, same behavior in every environment.
- **Air-gapped ready.** Ship a release bundle into a network with no
  public connectivity. ObjectOS reads its application artifact from a
  local file and never calls home.
- **Identity you already operate.** Local accounts, OAuth, OIDC, SAML, or
  your corporate SSO — ObjectOS enforces the session.
- **Permissions at the runtime.** Role-based access, record-level rules,
  and field-level redaction are enforced by the runtime itself — not by
  the UI.
- **Audit, backup, observability on your terms.** Every state change is
  auditable. Backups write to your storage. Logs and metrics export to
  the observability stack you already use.

## Positioning

| | ObjectStack framework | **ObjectOS** | Enterprise plugins |
|---|---|---|---|
| Repo | `objectstack-ai/framework` | `objectstack-ai/objectos` | `objectstack-ai/objectos-enterprise` (private) |
| What it ships | Protocol, kernel, `@objectstack/*` packages, Studio, control plane | Runtime distribution + Docker/Helm + ops docs | SSO/SAML, SCIM, audit export, HA scheduler, … |
| Who consumes it | Framework contributors, plugin authors | **End customers** (self-host / private cloud) | Enterprise customers |
| License | Apache-2.0 | **Apache-2.0** | Commercial |
| Release cadence | Frequent (per `changeset`) | Distribution semver (e.g. `2026.05 LTS`) | Tracks ObjectOS |

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

# Boot the runtime against a local compiled artifact
cd apps/objectos
OS_ARTIFACT_FILE=dist/objectstack.json PORT=3200 pnpm start

# Or run the documentation site
pnpm docs:dev
```

### Docker

```bash
mkdir -p docker/artifacts
cp apps/objectos/dist/objectstack.json docker/artifacts/objectstack.json
docker compose -f docker/docker-compose.yml up --build
```

Docker Compose publishes ObjectOS on `http://localhost:3000` by default.
Use `OBJECTOS_PORT=3200` to change the host port.

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

## Documentation

- [Quickstart](content/docs/quickstart.mdx)
- [Architecture](content/docs/architecture.mdx)
- [Deployment](content/docs/deploy/index.mdx) — Docker, Kubernetes, air-gapped
- [Authentication](content/docs/configure/authentication.mdx)
- [Permissions](content/docs/configure/permissions.mdx)
- [Observability](content/docs/operate/observability.mdx)

## History

The current `main` is a deliberate restart aligned with the
[ObjectStack North Star](https://github.com/objectstack-ai/framework/blob/main/content/docs/concepts/north-star.mdx).

## License

ObjectOS is licensed under the [Apache License 2.0](LICENSE).

"ObjectOS" and the ObjectOS logo are trademarks of the ObjectOS project
and are not covered by the Apache 2.0 grant. See [TRADEMARK.md](TRADEMARK.md).
