# `apps/objectos-desktop`

**ObjectOS Desktop** — a [Tauri](https://tauri.app) v2 shell that wraps
the `@objectos/app` Node runtime as a sidecar and exposes it through a
native WebView. The goal is a "download → double‑click → ready to use"
experience for end users on macOS, Windows and Linux.

## Architecture

```
┌──────────────────────────────────────────┐
│  Tauri shell (Rust)                      │
│   ├── splash WebView (src/index.html)    │
│   ├── waits for sidecar port             │
│   └── navigates to http://localhost:N    │
│                                          │
│  Sidecar: bundled Node runs              │
│   apps/objectos/desktop.mjs              │
│      → objectstack serve --port N        │
└──────────────────────────────────────────┘
```

The Node tree is staged under `runtime/` by
`scripts/stage-runtime.mjs` (called automatically by `dev` / `build`)
and bundled by Tauri as resources.

## Prerequisites

- Node ≥ 20 + pnpm 10
- Rust (stable) — `curl https://sh.rustup.rs -sSf | sh`
- macOS: Xcode Command Line Tools
- Windows: WebView2 (preinstalled on Win10+) + MSVC build tools
- Linux: `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`

## Develop

```bash
pnpm install                                # repo root
pnpm --filter @objectos/desktop dev         # stages runtime + tauri dev
```

The first run builds Rust dependencies (~2–4 min). Subsequent runs are
fast.

## Build distributables

```bash
pnpm --filter @objectos/desktop build
```

Output lands in `src-tauri/target/release/bundle/`:

| Platform | Artifact                                |
|----------|-----------------------------------------|
| macOS    | `dmg/ObjectOS_<v>_<arch>.dmg` + `.app`  |
| Windows  | `nsis/ObjectOS_<v>_x64-setup.exe`       |
| Linux    | `deb/objectos_<v>_amd64.deb`, AppImage  |

Code signing / notarization is configured per platform in
`src-tauri/tauri.conf.json` (see Tauri docs).

## Comparison with the portable zip

| | Portable zip | Tauri |
|---|---|---|
| Brand | none (terminal) | dock icon, menu, tray |
| Size | ~110 MB | ~120 MB (Node sidecar dominates; shell adds ~10 MB) |
| Auto‑update | no | yes (Tauri updater) |
| Code signing | manual | first‑class |
| Dev effort | tiny | moderate (Rust toolchain) |

Both share `desktop.mjs`, so the runtime behaviour is identical.
