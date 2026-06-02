#!/usr/bin/env bash
#
# sim-capture.sh — walk a long iOS-simulator screen and capture it section-by-section.
#
# Uses idb (Meta's iOS Debug Bridge) to inject swipe gestures directly into the
# booted simulator (no macOS Accessibility permission needed) and `simctl` to grab
# PNGs between swipes. Built for the "Am I Broke?" UI-polish loop on the iPhone SE.
#
# Usage:
#   tools/sim-capture.sh <label> [frames] [outdir]
#     label   prefix for the screenshot files (e.g. "results")
#     frames  number of screenshots to take (default 5). Swipes happen between them,
#             so N frames => N-1 swipes.
#     outdir  where PNGs land (default /tmp/sim-shots)
#
# Each swipe scrolls ~half a screen so consecutive frames overlap for easy review.
# Output: <outdir>/<label>-01.png, -02.png, ...  (printed at the end)

set -euo pipefail

LABEL="${1:?usage: sim-capture.sh <label> [frames] [outdir]}"
FRAMES="${2:-5}"
OUTDIR="${3:-/tmp/sim-shots}"

IDB="$HOME/.idb-venv/bin/idb"
# Note: do NOT set IDB_COMPANION — idb auto-spawns/manages the companion via
# `idb connect <udid>`. Setting it makes idb treat the value as a socket path.

# iPhone SE (3rd gen) logical points: 375 x 667. Swipe up to scroll content down.
SWIPE_X=187
SWIPE_FROM_Y=520
SWIPE_TO_Y=190
SWIPE_DURATION=0.45   # slow-ish => minimal momentum => predictable, overlapping steps
SETTLE=0.6            # seconds to let the scroll settle before the screenshot

UDID="$(xcrun simctl list devices booted | grep -Eo '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}' | head -1)"
if [ -z "$UDID" ]; then echo "No booted simulator found." >&2; exit 1; fi

mkdir -p "$OUTDIR"
rm -f "$OUTDIR/${LABEL}-"*.png 2>/dev/null || true

"$IDB" connect "$UDID" >/dev/null 2>&1 || true

for i in $(seq 1 "$FRAMES"); do
  n=$(printf "%02d" "$i")
  out="$OUTDIR/${LABEL}-${n}.png"
  xcrun simctl io "$UDID" screenshot --type=png "$out" >/dev/null 2>&1
  echo "$out"
  if [ "$i" -lt "$FRAMES" ]; then
    "$IDB" ui swipe --udid "$UDID" --duration "$SWIPE_DURATION" \
      "$SWIPE_X" "$SWIPE_FROM_Y" "$SWIPE_X" "$SWIPE_TO_Y" >/dev/null 2>&1
    sleep "$SETTLE"
  fi
done
