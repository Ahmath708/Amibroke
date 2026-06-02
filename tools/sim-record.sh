#!/usr/bin/env bash
#
# sim-record.sh — record the booted iOS Simulator to video, then extract PNG
# frames so transient UI can be reviewed frame-by-frame: splash handoffs,
# screen transitions, animations — things discrete screenshots skip over.
#
# Pairs with tools/sim-capture.sh (which does scroll+screenshot). This one is
# for *motion* over a short window, e.g. "app open → landing".
#
# Usage:
#   tools/sim-record.sh <label> <seconds> [bundle-id-to-cold-launch] [fps]
#
# Examples:
#   tools/sim-record.sh splash 9 com.aibroke.app 10   # cold-launch + record 9s @10fps
#   tools/sim-record.sh swipe 6                        # record whatever's on screen
#
# Output:
#   /tmp/sim-rec-<label>.mp4            the raw recording
#   /tmp/sim-rec-<label>/frame-NNN.png  frames (frame N ≈ N/fps seconds)
set -euo pipefail

LABEL="${1:-rec}"
DUR="${2:-9}"
BID="${3:-}"
FPS="${4:-10}"
HERE="$(cd "$(dirname "$0")" && pwd)"
VIDEO="/tmp/sim-rec-$LABEL.mp4"
OUTDIR="/tmp/sim-rec-$LABEL"

UDID=$(xcrun simctl list devices booted | grep -oE "[0-9A-F-]{36}" | head -1)
if [ -z "${UDID:-}" ]; then echo "❌ No booted simulator. Boot one first."; exit 1; fi

rm -f "$VIDEO"; rm -rf "$OUTDIR"; mkdir -p "$OUTDIR"

# Cold-launch path: terminate first so the recording starts from springboard.
if [ -n "$BID" ]; then xcrun simctl terminate "$UDID" "$BID" 2>/dev/null || true; sleep 1; fi

echo "Recording $UDID for ${DUR}s → $VIDEO"
xcrun simctl io "$UDID" recordVideo --codec=h264 --force "$VIDEO" &
REC_PID=$!
sleep 1.2   # let the recorder spin up

if [ -n "$BID" ]; then
  echo "Launching $BID …"
  xcrun simctl launch "$UDID" "$BID" >/dev/null 2>&1 || true
fi

sleep "$DUR"
kill -INT "$REC_PID" 2>/dev/null || true   # SIGINT → simctl finalizes the mp4
wait "$REC_PID" 2>/dev/null || true
sleep 1

echo "Extracting frames @${FPS}fps …"
swift "$HERE/extract-frames.swift" "$VIDEO" "$OUTDIR" "$FPS" "$((DUR + 3))"
echo "→ $OUTDIR/frame-NNN.png  (frame N ≈ N/${FPS}s)"
