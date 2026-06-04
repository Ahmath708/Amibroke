#!/usr/bin/env bash
# Pixel-exact diff for two PNGs (no ImageMagick; uses ffmpeg to decode raw RGBA
# and hash). Prints IDENTICAL or DIFFERENT (+PSNR magnitude). Used to gate the
# "no-op" refactors (e.g. accent→primary alias rename must be pixel-identical).
#   tools/pxdiff.sh before.png after.png
set -euo pipefail
a="$1"; b="$2"
ha=$(ffmpeg -v error -i "$a" -f rawvideo -pix_fmt rgba - 2>/dev/null | md5 -q)
hb=$(ffmpeg -v error -i "$b" -f rawvideo -pix_fmt rgba - 2>/dev/null | md5 -q)
if [ "$ha" = "$hb" ]; then
  echo "IDENTICAL  $(basename "$a") == $(basename "$b")"
  exit 0
fi
psnr=$(ffmpeg -i "$a" -i "$b" -lavfi psnr -f null - 2>&1 | grep -oE "average:[0-9.a-z]+" | tail -1 || true)
echo "DIFFERENT  $(basename "$a") != $(basename "$b")  ${psnr:-}"
exit 1
