#!/usr/bin/env bash
# 直接用 xcodebuild 构建未签名的 iOS 产物，并打包成 IPA。
#
# 作为 `tauri ios build --no-sign` 不可用时的兜底方案：
# 关掉代码签名后产出的 .app 可以自行用免费 Apple ID 侧载签名安装。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPLE_DIR="$ROOT/src-tauri/gen/apple"
BUILD_DIR="$ROOT/ios-build"

if [ ! -d "$APPLE_DIR" ]; then
  echo "找不到 $APPLE_DIR，请先执行 pnpm tauri ios init" >&2
  exit 1
fi

WORKSPACE="$(find "$APPLE_DIR" -maxdepth 1 -name '*.xcworkspace' | head -n 1)"
PROJECT="$(find "$APPLE_DIR" -maxdepth 1 -name '*.xcodeproj' | head -n 1)"

if [ -n "$WORKSPACE" ]; then
  CONTAINER=(-workspace "$WORKSPACE")
  echo "使用 workspace: $WORKSPACE"
elif [ -n "$PROJECT" ]; then
  CONTAINER=(-project "$PROJECT")
  echo "使用 project: $PROJECT"
else
  echo "找不到 Xcode 工程" >&2
  exit 1
fi

SCHEME="$(xcodebuild "${CONTAINER[@]}" -list 2>/dev/null \
  | awk '/Schemes:/{flag=1;next} flag && NF{print $1; exit}')"
if [ -z "$SCHEME" ]; then
  echo "无法确定 scheme" >&2
  exit 1
fi
echo "使用 scheme: $SCHEME"

xcodebuild "${CONTAINER[@]}" \
  -scheme "$SCHEME" \
  -configuration release \
  -sdk iphoneos \
  -derivedDataPath "$BUILD_DIR" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGN_ENTITLEMENTS="" \
  build

APP="$(find "$BUILD_DIR/Build/Products" -maxdepth 2 -name '*.app' | head -n 1)"
if [ -z "$APP" ]; then
  echo "构建结束但没找到 .app" >&2
  exit 1
fi
echo "构建产物: $APP"

IPA="$APPLE_DIR/unsigned.ipa"
PAYLOAD_DIR="$ROOT/ios-payload"
rm -rf "$PAYLOAD_DIR"
mkdir -p "$PAYLOAD_DIR/Payload"
cp -R "$APP" "$PAYLOAD_DIR/Payload/"
( cd "$PAYLOAD_DIR" && zip -qry "$IPA" Payload )
rm -rf "$PAYLOAD_DIR"

echo "已生成: $IPA"
