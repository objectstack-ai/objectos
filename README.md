# ObjectOS

> **The business platform AI can actually use — running in your own environment.**
>
> ObjectOS is the AI-native runtime for [ObjectStack](https://github.com/objectstack-ai/framework)
> applications. Put your business systems — CRM, contracts, tickets,
> approvals, anything modeled in ObjectStack metadata — on ObjectOS, and
> AI agents can safely query, analyze, and act on that data under your
> permissions, on your servers, with every step audited.

**ObjectStack** is a metadata protocol for describing business
applications — objects, permissions, workflows, APIs, UI, and AI tools —
in one structured definition.
**ObjectOS** is where those applications run, and where AI plugs in.

```
ObjectStack   →   how a business application is described
ObjectOS      →   where it runs, and where AI plugs in
```

## Why ObjectOS

The promise of "AI inside the enterprise" usually breaks on two things:
AI can't actually use the business system, and security can't say yes
to letting it try. ObjectOS removes both blockers:

- **Every object is an AI tool, automatically.** Define a business
  object once in ObjectStack metadata; ObjectOS exposes it to AI agents
  as a governed, callable tool — no glue code, no separate integration
  layer to maintain.
- **AI acts as the signed-in user.** Whatever that person is allowed to
  see or do, the agent can — nothing more. The boundary is enforced in
  the runtime, not in the prompt.
- **One audit log for humans and agents.** Every read, write, and
  escalation — by a person or an AI — is recorded with who, what, when,
  and why. Compliance gets one log to look at, not two.
- **Permissions enforced at the runtime.** Role-based access,
  record-level rules, and field-level redaction run inside ObjectOS, so
  the same policy applies whether the call comes from the UI, an API
  client, or an agent.
- **Your data, your network.** Runs in your environment — private cloud,
  on-prem, or fully air-gapped. Business data and AI prompts stay
  inside your perimeter; no third party in the loop.
- **Plugs into the identity you already operate.** OAuth, OIDC, SAML,
  corporate SSO, or local accounts. AI sessions inherit the same
  identity, MFA, and offboarding — no separate "AI account" to govern.

## Positioning

| | ObjectStack framework | **ObjectOS** | Enterprise plugins |
|---|---|---|---|
| Role | The protocol — *how* an application is described | The runtime — *where* it runs and where AI plugs in | Add-ons for regulated / large-scale deployments |
| Repo | `objectstack-ai/framework` | `objectstack-ai/objectos` | `objectstack-ai/objectos-enterprise` (private) |
| What it ships | Protocol, kernel, `@objectstack/*` packages, Console, control plane | Runtime distribution + Docker/Helm + ops docs | SSO/SAML, SCIM, audit export, HA scheduler, … |
| Who consumes it | Framework contributors, plugin authors | **End customers** (self-host / private cloud) | Enterprise customers |
| License | Apache-2.0 | **Apache-2.0** | Commercial |
| Release cadence | Frequent (per `changeset`) | Distribution semver (e.g. `2026.05 LTS`) | Tracks ObjectOS |

## Boot modes

ObjectOS boots in one of two modes, selected by environment variables:

| Mode | Required env | Use case |
|---|---|---|
| **Cloud-connected** | `OS_CLOUD_URL`, `OS_PROJECT_ID` | Production with the ObjectStack control plane / Console |
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
