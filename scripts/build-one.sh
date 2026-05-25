#!/usr/bin/env bash
# ------------------------------------------------------------------
# Build a portable ObjectOS One distributable.
#
# Produces, under dist/one/:
#
#   ObjectOS-<version>-<os>-<arch>/
#     ├── node                 (bundled Node runtime)
#     ├── ObjectOS(.cmd|.sh)   (double-click launcher)
#     ├── app/
#     │     ├── one.mjs
#     │     ├── package.json
#     │     ├── dist/objectstack.json
#     │     └── node_modules/  (production deps, native bins built for target)
#     └── README.txt
#   ObjectOS-<version>-<os>-<arch>.zip
#
# Usage:
#   scripts/build-one.sh [--target <os>-<arch>] [--node <version>]
#
# Defaults to the current host platform. Cross-platform packaging works
# for the *Node binary* (downloaded from nodejs.org), but native npm
# modules (better-sqlite3) must be rebuilt on the target OS — so for
# production you should run this on each OS or in CI matrix.
# ------------------------------------------------------------------
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-20.18.1}"
TARGET=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; shift 2;;
    --node)   NODE_VERSION="$2"; shift 2;;
    -h|--help)
      sed -n '2,25p' "$0"; exit 0;;
    *) echo "unknown arg: $1" >&2; exit 1;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT/apps/objectos"
OUT_ROOT="$ROOT/dist/one"

# --- detect target -------------------------------------------------
host_os() {
  case "$(uname -s)" in
    Darwin) echo "darwin";;
    Linux)  echo "linux";;
    MINGW*|MSYS*|CYGWIN*) echo "win";;
    *) echo "unknown";;
  esac
}
host_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "x64";;
    arm64|aarch64) echo "arm64";;
    *) echo "unknown";;
  esac
}
TARGET="${TARGET:-$(host_os)-$(host_arch)}"
OS="${TARGET%-*}"
ARCH="${TARGET#*-}"

case "$OS" in darwin|linux|win) ;; *) echo "unsupported os: $OS" >&2; exit 1;; esac
case "$ARCH" in x64|arm64) ;; *) echo "unsupported arch: $ARCH" >&2; exit 1;; esac

VERSION="$(node -p "require('$APP_DIR/package.json').version")"
DIST_NAME="ObjectOS-${VERSION}-${OS}-${ARCH}"
STAGE="$OUT_ROOT/$DIST_NAME"

echo "==> Building $DIST_NAME (Node v$NODE_VERSION)"
rm -rf "$STAGE" "$OUT_ROOT/$DIST_NAME.zip"
mkdir -p "$STAGE/app"

# --- 1. ensure the app is built ------------------------------------
if [[ ! -f "$APP_DIR/dist/objectstack.json" ]]; then
  echo "==> Compiling artifact"
  (cd "$ROOT" && pnpm --filter @objectos/app build)
fi

# --- 2. install production deps into a clean tree ------------------
echo "==> Installing production deps"
STAGE_APP="$STAGE/app"
cp "$APP_DIR/package.json" "$STAGE_APP/package.json"
cp "$APP_DIR/one.mjs"  "$STAGE_APP/one.mjs"
mkdir -p "$STAGE_APP/dist"
cp "$APP_DIR/dist/objectstack.json" "$STAGE_APP/dist/objectstack.json"

# Use a flat node_modules layout (npm) so the launcher can `require.resolve`
# without pnpm's symlink tree. This bloats the bundle a bit but is the
# most portable form.
(
  cd "$STAGE_APP"
  npm install --omit=dev --no-audit --no-fund --loglevel=error \
    --legacy-peer-deps \
    better-sqlite3@^12.9.0
)

# --- 3. download Node binary --------------------------------------
echo "==> Fetching Node v$NODE_VERSION for $OS-$ARCH"
NODE_CACHE="$ROOT/.cache/node"
mkdir -p "$NODE_CACHE"

case "$OS" in
  darwin) NODE_PKG="node-v${NODE_VERSION}-darwin-${ARCH}.tar.gz"; NODE_BIN_REL="bin/node";;
  linux)  NODE_PKG="node-v${NODE_VERSION}-linux-${ARCH}.tar.xz";  NODE_BIN_REL="bin/node";;
  win)    NODE_PKG="node-v${NODE_VERSION}-win-${ARCH}.zip";       NODE_BIN_REL="node.exe";;
esac

NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_PKG}"
NODE_TARBALL="$NODE_CACHE/$NODE_PKG"
if [[ ! -f "$NODE_TARBALL" ]]; then
  curl -fSL --retry 3 -o "$NODE_TARBALL" "$NODE_URL"
fi

NODE_EXTRACT="$NODE_CACHE/${NODE_PKG%.tar.*}"
NODE_EXTRACT="${NODE_EXTRACT%.zip}"
if [[ ! -d "$NODE_EXTRACT" ]]; then
  case "$NODE_PKG" in
    *.tar.gz) tar -xzf "$NODE_TARBALL" -C "$NODE_CACHE";;
    *.tar.xz) tar -xJf "$NODE_TARBALL" -C "$NODE_CACHE";;
    *.zip)    (cd "$NODE_CACHE" && unzip -q "$NODE_TARBALL");;
  esac
fi

if [[ "$OS" == "win" ]]; then
  cp "$NODE_EXTRACT/$NODE_BIN_REL" "$STAGE/node.exe"
else
  cp "$NODE_EXTRACT/$NODE_BIN_REL" "$STAGE/node"
  chmod +x "$STAGE/node"
fi

# --- 4. launcher scripts ------------------------------------------
echo "==> Writing launcher"
if [[ "$OS" == "win" ]]; then
  cat > "$STAGE/ObjectOS.cmd" <<'EOF'
@echo off
setlocal
cd /d "%~dp0"
".\node.exe" "app\one.mjs"
EOF
else
  cat > "$STAGE/ObjectOS.sh" <<'EOF'
#!/usr/bin/env bash
set -e
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$HERE/node" "$HERE/app/one.mjs"
EOF
  chmod +x "$STAGE/ObjectOS.sh"
fi

# --- 5. README ----------------------------------------------------
cat > "$STAGE/README.txt" <<EOF
ObjectOS One ${VERSION} (${OS}-${ARCH})

Quick start:
  $( [[ "$OS" == "win" ]] && echo "  Double-click ObjectOS.cmd" || echo "  Run ./ObjectOS.sh from a terminal" )

Your data lives in:
  macOS : ~/Library/Application Support/ObjectOS
  Linux : ~/.local/share/objectos
  Win   : %APPDATA%\\ObjectOS

Override defaults with environment variables:
  OBJECTOS_HOME      override data directory
  PORT               preferred HTTP port (default 3000)
  OS_CLOUD_URL       point at a control plane to leave offline mode
EOF

# --- 6. zip -------------------------------------------------------
echo "==> Packaging"
(cd "$OUT_ROOT" && rm -f "$DIST_NAME.zip" && zip -qr "$DIST_NAME.zip" "$DIST_NAME")

SIZE=$(du -sh "$OUT_ROOT/$DIST_NAME.zip" | awk '{print $1}')
echo "==> Built $OUT_ROOT/$DIST_NAME.zip ($SIZE)"
echo "==> Stage dir: $STAGE"
