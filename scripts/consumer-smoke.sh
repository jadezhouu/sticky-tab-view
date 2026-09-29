#!/usr/bin/env bash
# 真实 consumer smoke（Reanimated 3 维护线，两套外部安装）。
#
# 两种安装来源：
#   默认            —— 从 `npm pack` 生成的 tarball 安装（发布前门禁，release:check 使用）
#   --from-registry —— 从 npm registry 安装一个 dist-tag / 版本（V3-8-05：验证真实分发路径）。
#                     默认 spec 为 `reanimated3-next`；可传自定义 spec，例如
#                     `--from-registry 1.0.0-beta.0`。
#
# 验证目标：
#   - 安装成功（tarball 或 registry 均可）
#   - peer dependency 安装**不使用 --legacy-peer-deps**，证明总体兼容边界本身无冲突
#   - 全部公共 value/type export 可通过 TypeScript import（bundler 解析）
#   - 同一包以 moduleResolution=nodenext 编译，证明 ESM 声明可被 NodeNext 消费者解析
#   - `./package.json` subpath 可通过 exports 解析
#   - 入口通过 exports map 正确解析为 ESM（import 条件）
#   - 两个已核实锚点（Expo SDK 53 / RN CLI 0.81）的外部安装都不依赖 workspace symlink
#
# 两套锚点（R3-001 总体兼容边界的已验证子集）：
#   ANCHOR_1 = Expo SDK 53 : react 19.0 / RN 0.79.6 / RNGH 2.24 / Reanimated 3.17
#   ANCHOR_2 = RN CLI 0.81 : react 19.1 / RN 0.81.5 / RNGH 2.28 / Reanimated 3.19
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
TARBALL=""

INSTALL_SOURCE="tarball"
REGISTRY_SPEC="reanimated3-next"
case "${1:-}" in
  --from-registry)
    INSTALL_SOURCE="registry"
    if [[ -n "${2:-}" ]]; then REGISTRY_SPEC="$2"; fi
    ;;
  "") ;;
  *) echo "unknown argument: $1" >&2; exit 2 ;;
esac

cleanup() {
  rm -rf "$TMP"
  if [[ -n "$TARBALL" && -f "$TARBALL" ]]; then rm -f "$TARBALL"; fi
}
trap cleanup EXIT

if [[ "$INSTALL_SOURCE" == "tarball" ]]; then
  echo "==> Building"
  cd "$ROOT"
  pnpm build

  echo "==> Packing tarball"
  TARBALL_NAME="$(npm pack --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].filename))')"
  TARBALL="$ROOT/$TARBALL_NAME"
  INSTALL_TARGET="$TARBALL"
else
  echo "==> Installing from registry: @jadezhou/sticky-tab-view@${REGISTRY_SPEC}"
  INSTALL_TARGET="@jadezhou/sticky-tab-view@${REGISTRY_SPEC}"
fi

compile_public_api() {
  local anchor="$1" consumer="$2"
  echo "==> [${anchor}] Compiling public API imports (TypeScript)"
  ./node_modules/.bin/tsc \
    --noEmit \
    --strict \
    --module esnext \
    --moduleResolution bundler \
    --target es2020 \
    --skipLibCheck \
    --jsx react-jsx \
    index.ts
  echo "    [${anchor}] bundler resolution: OK"

  echo "==> [${anchor}] Compiling public API imports (moduleResolution=nodenext)"
  ./node_modules/.bin/tsc \
    --noEmit \
    --strict \
    --module nodenext \
    --moduleResolution nodenext \
    --target es2020 \
    --skipLibCheck \
    --jsx react-jsx \
    index.ts
  echo "    [${anchor}] nodenext resolution: OK"

  echo "==> [${anchor}] Verifying exports resolution (import + package.json subpath)"
  node --input-type=module -e '
import assert from "node:assert";
const entry = import.meta.resolve("@jadezhou/sticky-tab-view");
const pkgjson = import.meta.resolve("@jadezhou/sticky-tab-view/package.json");
assert.match(entry, /dist\/index\.js$/);
assert.match(pkgjson, /package\.json$/);
console.log("    entry resolved:", entry);
console.log("    package.json resolved:", pkgjson);
'
  cd "$consumer"
}

run_anchor() {
  local anchor="$1"
  shift
  local consumer="$TMP/consumer-$anchor"
  echo "==> [${anchor}] Setting up consumer in $consumer"
  mkdir -p "$consumer"
  cd "$consumer"
  cat > package.json <<'EOF'
{
  "name": "consumer-smoke",
  "private": true,
  "type": "module"
}
EOF

  echo "==> [${anchor}] Installing ${INSTALL_SOURCE} + peer dependencies (no --legacy-peer-deps)"
  npm install \
    --ignore-scripts \
    --no-audit \
    --no-fund \
    "$INSTALL_TARGET" \
    "$@" \
    typescript@5.9.2

  # 外部安装必须落到真实目录（不能是 workspace symlink），并回显实际装到的版本。
  echo "==> [${anchor}] Verifying installed package is a real external install"
  node -e '
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const pkgDir = path.dirname(require.resolve("@jadezhou/sticky-tab-view/package.json"));
const st = fs.lstatSync(pkgDir);
assert.ok(!st.isSymbolicLink(), "installed package must not be a symlink: " + pkgDir);
const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
assert.strictEqual(pkg.name, "@jadezhou/sticky-tab-view");
console.log("    [%s] installed", "'"$anchor"'", pkg.name + "@" + pkg.version, "at", pkgDir);
'

  cat > index.ts <<'EOF'
import {
  StickyTabView,
  ElasticScrollView,
  ElasticPullRefreshHeader,
  MasonryList,
} from '@jadezhou/sticky-tab-view';
import type {
  TDirection,
  TElasticScrollViewProps,
  TFetchContext,
  TFetchRes,
  TItemBase,
  TMasonryErrorInfo,
  TMasonryListProps,
  TMasonryRequestPhase,
  TOnRefreshParam,
  TPanHandler,
  TSectionData,
  TStickyTabViewProps,
  StickyTabViewHandle,
  ElasticScrollViewHandle,
} from '@jadezhou/sticky-tab-view';

const stickyProps: TStickyTabViewProps = {
  tabCount: 1,
  renderHeader: () => null,
  renderTab: () => null,
};
const stickyHandle: StickyTabViewHandle = { setTab: () => {} };
const scrollHandle: ElasticScrollViewHandle = {
  scrollTo: async () => {},
  scroll: async () => {},
};
const refresh: TOnRefreshParam = { endRefresh: () => {}, canLoadMore: null as never };

void stickyProps; void stickyHandle; void scrollHandle; void refresh;
void StickyTabView; void ElasticScrollView; void ElasticPullRefreshHeader; void MasonryList;
void (null as unknown as TDirection);
void (null as unknown as TElasticScrollViewProps);
void (null as unknown as TFetchContext);
void (null as unknown as TFetchRes<unknown>);
void (null as unknown as TItemBase);
void (null as unknown as TMasonryErrorInfo);
void (null as unknown as TMasonryListProps<unknown>);
void (null as unknown as TMasonryRequestPhase);
void (null as unknown as TPanHandler);
void (null as unknown as TSectionData<unknown>);
EOF

  compile_public_api "$anchor" "$consumer"
}

# ANCHOR_1: Expo SDK 53
run_anchor "expo-sdk-53" \
  react@19.0.0 \
  react-native@0.79.6 \
  react-native-gesture-handler@2.24.0 \
  react-native-reanimated@3.17.4

# ANCHOR_2: RN CLI 0.81
run_anchor "rn-cli-081" \
  react@19.1.0 \
  react-native@0.81.5 \
  react-native-gesture-handler@2.28.0 \
  react-native-reanimated@3.19.5

echo "==> Consumer smoke passed (both anchors, source=${INSTALL_SOURCE}$([[ "$INSTALL_SOURCE" == registry ]] && echo ":${REGISTRY_SPEC}"))"