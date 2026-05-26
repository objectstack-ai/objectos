#!/usr/bin/env node
// Sync the ObjectOS One release version to the @objectstack/cli version that
// the bundled server depends on.
//
// Source of truth, in order of preference:
//   1. node_modules/@objectstack/cli/package.json (resolved/installed version)
//   2. apps/objectos/package.json `dependencies["@objectstack/cli"]`
//      with any leading ^/~/= stripped
//
// Targets updated (skipped if already up to date):
//   - apps/objectos-one/package.json                         "version"
//   - apps/objectos-one/src-tauri/tauri.conf.json            "version"
//   - apps/objectos-one/src-tauri/Cargo.toml                 [package].version
//
// Flags:
//   --check   Exit non-zero if any file would change. Doesn't write.
//   --quiet   Suppress informational logs.
//
// Used by CI (.github/workflows/one.yml) and locally before tagging.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");

const argv = process.argv.slice(2);
const CHECK_ONLY = argv.includes("--check");
const QUIET = argv.includes("--quiet");

const log = (...a) => {
  if (!QUIET) console.log("[sync-version]", ...a);
};
const warn = (...a) => console.warn("[sync-version]", ...a);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function resolveCliVersion() {
  // Prefer the actually-resolved version from node_modules — what the bundle
  // will ship — but fall back to the declared dependency range if the
  // workspace hasn't been installed yet (e.g. fresh CI before pnpm install).
  const resolved = join(
    REPO_ROOT,
    "node_modules/@objectstack/cli/package.json"
  );
  if (existsSync(resolved)) {
    const v = readJson(resolved).version;
    log(`resolved @objectstack/cli@${v} from node_modules`);
    return v;
  }

  const serverPkgPath = join(REPO_ROOT, "apps/objectos/package.json");
  const serverPkg = readJson(serverPkgPath);
  const range =
    serverPkg.dependencies?.["@objectstack/cli"] ??
    serverPkg.devDependencies?.["@objectstack/cli"];
  if (!range) {
    throw new Error(
      `@objectstack/cli not found in ${serverPkgPath}; cannot derive version`
    );
  }
  const v = range.replace(/^[\^~=v]+/, "").trim();
  if (!/^\d+\.\d+\.\d+/.test(v)) {
    throw new Error(
      `cannot extract a concrete version from "${range}"; run pnpm install first`
    );
  }
  log(`derived @objectstack/cli@${v} from ${serverPkgPath} (not installed)`);
  return v;
}

function updateJson(path, mutate) {
  const before = readFileSync(path, "utf8");
  const data = JSON.parse(before);
  mutate(data);
  // Keep 2-space indent + trailing newline to match the rest of the repo
  // and avoid noisy diffs.
  const after = JSON.stringify(data, null, 2) + "\n";
  if (after === before) return false;
  if (!CHECK_ONLY) writeFileSync(path, after);
  return true;
}

function updateCargoTomlVersion(path, version) {
  const before = readFileSync(path, "utf8");
  // Only replace the version line inside the first `[package]` table.
  // We don't pull in a TOML parser to avoid an extra dep for this one field.
  const pkgIdx = before.indexOf("[package]");
  if (pkgIdx < 0) {
    throw new Error(`no [package] section in ${path}`);
  }
  const before_pkg = before.slice(0, pkgIdx);
  const rest = before.slice(pkgIdx);
  // Replace only the FIRST version = "..." after [package] (before the next [table]).
  const nextTableIdx = rest.indexOf("\n[", 1);
  const head = nextTableIdx < 0 ? rest : rest.slice(0, nextTableIdx);
  const tail = nextTableIdx < 0 ? "" : rest.slice(nextTableIdx);

  const versionRe = /^(version\s*=\s*)"([^"]*)"/m;
  const match = head.match(versionRe);
  if (!match) {
    throw new Error(`could not find version line under [package] in ${path}`);
  }
  if (match[2] === version) {
    return false;
  }
  const replaced = head.replace(versionRe, `$1"${version}"`);
  const after = before_pkg + replaced + tail;
  if (!CHECK_ONLY) writeFileSync(path, after);
  return true;
}

function main() {
  const version = resolveCliVersion();

  const targets = [
    {
      path: join(REPO_ROOT, "apps/objectos-one/package.json"),
      label: "apps/objectos-one/package.json",
      apply: (p) =>
        updateJson(p, (data) => {
          data.version = version;
        }),
    },
    {
      path: join(REPO_ROOT, "apps/objectos-one/src-tauri/tauri.conf.json"),
      label: "apps/objectos-one/src-tauri/tauri.conf.json",
      apply: (p) =>
        updateJson(p, (data) => {
          data.version = version;
        }),
    },
    {
      path: join(REPO_ROOT, "apps/objectos-one/src-tauri/Cargo.toml"),
      label: "apps/objectos-one/src-tauri/Cargo.toml",
      apply: (p) => updateCargoTomlVersion(p, version),
    },
  ];

  let changedAny = false;
  for (const t of targets) {
    if (!existsSync(t.path)) {
      warn(`skip: ${t.label} (not found)`);
      continue;
    }
    const changed = t.apply(t.path);
    if (changed) {
      changedAny = true;
      log(`${CHECK_ONLY ? "would update" : "updated"} ${t.label} → ${version}`);
    } else {
      log(`unchanged ${t.label} (already ${version})`);
    }
  }

  if (CHECK_ONLY && changedAny) {
    console.error(
      `[sync-version] FAIL: versions are out of sync with @objectstack/cli@${version}. ` +
        `Run \`pnpm --filter @objectos/one sync-version\` and commit the result.`
    );
    process.exit(1);
  }
}

main();
