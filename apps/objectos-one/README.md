# `apps/objectos-one`

**ObjectOS  the all-in-one local distribution of ObjectOS. AOne** 
[Tauri](https://tauri.app) v2 shell that wraps the `@objectos/server` Node
runtime as a sidecar and exposes it through a native WebView. The goal
 ready to use" experience on macOS,
Windows and  no Node, no database, no extra dependencies toLinux 
install.

## Architecture

```

  Tauri shell (Rust)                      
 splash WebView (src/index.html)       
 system tray (open / restart / data    
   folder / quit)                        
 waits for sidecar port                
 navigates to http://localhost:N       
                                          
  Sidecar: bundled Node runs              
   apps/objectos/one.mjs                  
 objectstack serve --port N        
 SQLite + uploads under            
        $OBJECTOS_HOME                    

```

The Node tree is staged under `runtime/` by
`scripts/stage-runtime.mjs` (called automatically by `dev` / `build`)
and bundled by Tauri as resources. The staging step also slims the
tree (~50 MB of source maps, markdown, and test fixtures removed).

## Per-user data

| OS      | Path                                         |
|---------|----------------------------------------------|
| macOS / Linux / Windows | `~/.objectstack`                   |

(Override with `OBJECTOS_HOME=/some/path`.)

The sidecar receives `OBJECTOS_HOME`, `OS_DATABASE_URL`,
`OS_STORAGE_ROOT`, and `OS_CACHE_DIR` pointed inside that folder, so a
clean uninstall is just deleting that directory.

## Configuration

Open **tray → Settings…** to edit environment variables passed to the
ObjectOS server. Variables are stored in `<data-dir>/one.config.json` as
a flat map and forwarded verbatim when the runtime starts.

Commonly used keys:

| Key             | Default          | Notes                                                            |
|-----------------|------------------|------------------------------------------------------------------|
| `PORT`          | auto (8787+)     | Fixed port. If in use, falls back to auto with a log line.       |
| `HOST`          | `127.0.0.1`      | `0.0.0.0` exposes the server to the LAN. **Set up auth first.**  |
| `OBJECTOS_HOME` | `~/.objectstack` | Data directory. Absolute path.                                   |
| `LOG_LEVEL`     | —                | Forwarded to the Node server.                                    |
| _anything else_ | —                | Forwarded as-is to the sidecar process.                          |

The Settings window also reflects values inherited from the parent
shell — those win over the saved file, so a one-off override still
works:

```
PORT=4001 HOST=0.0.0.0 open -a ObjectOS
```

Save in the Settings window triggers an automatic runtime restart.

## Prerequisites

-  20 + pnpm 10Node 
- Rust ( `curl https://sh.rustup.rs -sSf | sh`stable) 
- macOS: Xcode Command Line Tools
- Windows: WebView2 (preinstalled on Win10+) + MSVC build tools
- Linux: `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`,
  `libayatana-appindicator3-dev`, `librsvg2-dev`

## Develop

```bash
pnpm install
pnpm one:dev              # = pnpm --filter @objectos/one dev
```

First run builds Rust dependencies (~4 min). Subsequent runs are2
fast. The window opens on a splash page; once the sidecar is ready it
navigates to the live Studio URL.

## Build distributables

```bash
pnpm one:build
```

Output lands in `src-tauri/target/release/bundle/`:

| Platform | Artifact                                |
|----------|-----------------------------------------|
| macOS    | `dmg/ObjectOS_<v>_<arch>.dmg` + `.app`  |
| Windows  | `nsis/ObjectOS_<v>_x64-setup.exe`       |
| Linux    | `deb/objectos_<v>_amd64.deb`, AppImage  |

## Versioning

ObjectOS One ships the bundled `@objectos/server` runtime, which in turn
depends on `@objectstack/cli`. We pin the app version to the cli version so
the installed app always advertises the underlying engine release.

`apps/objectos-one/scripts/sync-version.mjs` reads the cli version (from
`node_modules/@objectstack/cli` after install, falling back to the declared
range in `apps/objectos/package.json`) and writes it into:

- `apps/objectos-one/package.json`
- `apps/objectos-one/src-tauri/tauri.conf.json`
- `apps/objectos-one/src-tauri/Cargo.toml`

`pnpm dev` / `pnpm build` run it automatically. To release:

```bash
pnpm install                              # resolve the exact cli version
pnpm --filter @objectos/one sync-version  # writes the three files
git commit -am "chore(one): bump to $(node -p \
  "require('./apps/objectos-one/package.json').version")"
git tag "one-v$(node -p \
  "require('./apps/objectos-one/package.json').version")"
git push --follow-tags
```

CI rejects the build if the `one-v<X.Y.Z>` tag does not equal the cli
version sync-version computed, so a wrong tag fails fast instead of
shipping a broken updater manifest.

## CI

`.github/workflows/one.yml` builds all four platforms in parallel
(macOS arm64, macOS x64, Windows x64, Linux x64). Trigger:

 full build + draft GitHub release
 artifacts only

The workflow is wired for code  provide the secrets below tosigning 
enable. Without secrets the builds still succeed (unsigned binaries,
end users will see OS warnings on first launch).

## Code signing

### macOS (Developer ID + notarization)

Required repo secrets:

| Secret                       | Value                                              |
|------------------------------|----------------------------------------------------|
| `APPLE_CERTIFICATE`          | base64 of your `.p12` Developer ID Application cert |
| `APPLE_CERTIFICATE_PASSWORD` | the export password                                |
| `APPLE_SIGNING_IDENTITY`     | `Developer ID Application: Company (TEAMID)`       |
| `APPLE_ID`                   | Apple ID email used for notarization               |
 security) |
| `APPLE_TEAM_ID`              | 10-char team ID from Apple Developer portal        |

Tauri picks these up automatically and runs `codesign` + `notarytool`
during `tauri build`.

### Windows (Authenticode)

| Secret                          | Value                |
|---------------------------------|----------------------|
| `WINDOWS_CERTIFICATE`           | base64 of your `.pfx`|
| `WINDOWS_CERTIFICATE_PASSWORD`  | export password      |

Then in `tauri.conf.json` set `bundle.windows.certificateThumbprint`
to the SHA-1 thumbprint (or extend the workflow to import the .pfx
and sign post-build with `signtool`).

### Tauri updater key (optional)

To enable in-app auto-update:

```bash
pnpm tauri signer generate -w ~/.tauri/objectos.key
```

Set `TAURI_SIGNING_PRIVATE_KEY` (file contents) and
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in CI, paste the public key into
 plugins.updater.pubkey`, and flip
`plugins.updater.active` to `true`.

## Comparison with the portable zip

| | Portable zip | Tauri |
|---|---|---|
| Brand | none (terminal) | dock icon, menu, tray |
| Size | ~110 MB zip | ~140 MB installer (signed) |
| Auto-update | no | yes (Tauri updater) |
| Code signing | manual | first-class |
| Dev effort | tiny | moderate (Rust toolchain) |

Both share `one.mjs`, so the runtime behaviour is identical.
