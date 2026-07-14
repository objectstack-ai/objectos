# Changelog

## Unreleased

- Bumped `@objectstack/*` from 12.4.0 to **14.7.0** in `apps/objectos`, so the
  runtime image ships the 14.x train (Permission Model v2, enforced object
  capability flags, data-lifecycle contract, phone/SMS auth, MCP scope
  ceiling). Verified: `objectstack compile`, `tsc --noEmit`, and the runtime
  smoke test all pass on 14.7.0.
- Refreshed the docs site for the ObjectStack 13/14 releases: the
  Roles page became [Positions](content/docs/configure/permissions/positions.mdx)
  (roles/profiles converged per ADR-0090), permissions/record-access/security
  pages document private-by-default sharing, audience anchors, delegated
  administration and the explain engine, and the changelog page now covers the
  12.x–14.x release trains. English + Simplified Chinese updated; other
  locales pending the next translation sync.
- Repository re-initialized as the **ObjectOS reference runtime distribution**.
- Previous codebase preserved on branch `legacy/v1` and tag `v1-final`.
- Adopted pnpm + Turborepo monorepo layout: `apps/objectos`, `apps/docs`, `packages/*`.
- Relicensed from AGPL-3.0 to Apache License 2.0. Trademark policy
  for the "ObjectOS" name and logo documented in `TRADEMARK.md`.
