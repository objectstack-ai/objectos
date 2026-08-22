# Contributing to ObjectOS

ObjectOS is a **commercial product**; its source is developed privately.
This public repository hosts the **documentation site and issue tracker**.
Read this before opening a PR.

## What belongs here

- **Documentation** for installing, configuring, upgrading, and operating
  ObjectOS (`content/docs/`), authored **English-first**. English is the only
  language we accept edits in — every `*.<locale>.mdx` file is generated and
  refreshed by an automated pass, and CI rejects PRs that hand-edit one. Spotted
  a bad translation? Open an issue, or fix the English source and the next pass
  carries it through. See [docs/TRANSLATION.md](docs/TRANSLATION.md).
- **Docs site** improvements (`apps/docs/` — Next.js + Fumadocs).
- **Issues**: bug reports and feature requests for ObjectOS Cloud and
  ObjectOS Enterprise.

## What does NOT belong here

- **Product source changes** — ObjectOS itself is developed privately. Report
  behavior as an issue instead.
- **Framework changes** — protocol schemas, kernel internals, drivers, and
  community plugins live in
  [`objectstack-ai/objectstack`](https://github.com/objectstack-ai/objectstack)
  (open source, Apache-2.0). Open PRs there.

## History

Until July 2026 this repository contained the free `@objectos/server`
reference distribution and the ObjectOS One desktop build. See the
[README](README.md#what-happened-to-the-code-that-used-to-live-here) for
where those capabilities went; historical source remains under Apache-2.0
in git history.
