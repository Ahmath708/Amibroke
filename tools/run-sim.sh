#!/usr/bin/env bash
#
# run-sim.sh — Build & launch "Am I Broke?" on an iOS Simulator.
#
# Why this exists: under Xcode 26 + Expo SDK 55, `expo run:ios` (and the
# `ios`/`ios:se` scripts) mis-resolve the build destination to a physical/Mac
# target and fail with "No code signing certificates are available to use."
# This builds the *iphonesimulator* SDK directly — which needs no code signing —
# and installs/launches via simctl, sidestepping Expo's device picker entirely.
#
# Usage:
#   npm run ios:sim                       # iPhone SE (3rd generation)
#   bash tools/run-sim.sh "iPhone 17"     # any installed simulator, by name
#
# Metro: started in the background automatically if nothing is on :8081.
set -euo pipefail

SIM_NAME="${1:-iPhone SE (3rd generation)}"
WORKSPACE="ios/AmIBroke.xcworkspace"
SCHEME="AmIBroke"
BUNDLE_ID="com.aibroke.app"
APP_PATH="ios/build/Build/Products/Debug-iphonesimulator/AmIBroke.app"

# 1. Resolve the simulator UDID (the name itself contains parens, so match the
#    line and pull the 36-char UUID rather than splitting on '(').
UDID=$(xcrun simctl list devices available | grep -F "$SIM_NAME (" | grep -oE "[0-9A-F-]{36}" | head -1)
if [ -z "${UDID:-}" ]; then
  echo "❌ Simulator '$SIM_NAME' not found. Run: xcrun simctl list devices available"
  exit 1
fi

# 2. Boot it (and open Simulator.app) if it isn't already booted.
if ! xcrun simctl list devices | grep -F "$UDID" | grep -q "Booted"; then
  echo "Booting $SIM_NAME …"
  xcrun simctl boot "$UDID"
  open -a Simulator
fi

# 3. Ensure Metro is running (dev builds load JS from it).
if ! lsof -i :8081 >/dev/null 2>&1; then
  echo "Starting Metro in the background (logs: /tmp/amibroke-metro.log) …"
  npx expo start >/tmp/amibroke-metro.log 2>&1 &
  for _ in $(seq 1 40); do lsof -i :8081 >/dev/null 2>&1 && break; sleep 1; done
fi

# 4. Build the simulator SDK (no signing), then install + launch.
echo "Building $SCHEME for $SIM_NAME …"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "id=$UDID" \
  -derivedDataPath ios/build \
  build

echo "Installing & launching …"
xcrun simctl install "$UDID" "$APP_PATH"
xcrun simctl launch "$UDID" "$BUNDLE_ID"
echo "✅ Launched $BUNDLE_ID on $SIM_NAME"
