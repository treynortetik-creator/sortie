#!/usr/bin/env bash
# Regenerates the app icons from one SVG. Needs ImageMagick (`magick`).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/icons
mkdir -p "$OUT"
# Viewfinder brackets around a lead dot. `any` icons have rounded corners; maskable and Apple icons are full bleed.
art() { cat <<SVG
<g fill="none" stroke="#fff" stroke-width="$2" stroke-linecap="round" stroke-linejoin="round" transform="translate(256 256) scale($1) translate(-256 -256)">
  <path d="M136 200v-48a16 16 0 0 1 16-16h48M312 136h48a16 16 0 0 1 16 16v48M376 312v48a16 16 0 0 1-16 16h-48M200 376h-48a16 16 0 0 1-16-16v-48"/>
</g>
<circle cx="256" cy="256" r="$3" fill="#fff"/>
SVG
}
svg_any="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect width='512' height='512' rx='112' fill='#E8480C'/>$(art 1 28 44)</svg>"
svg_full="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect width='512' height='512' fill='#E8480C'/>$(art 0.82 30 48)</svg>"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
printf '%s' "$svg_any"  > "$tmp/any.svg"
printf '%s' "$svg_full" > "$tmp/full.svg"
magick -background none -density 384 "$tmp/any.svg"  -resize 512x512 "$OUT/icon-512.png"
magick -background none -density 384 "$tmp/any.svg"  -resize 192x192 "$OUT/icon-192.png"
magick -density 384 "$tmp/full.svg" -resize 512x512 "$OUT/icon-maskable-512.png"
magick -density 384 "$tmp/full.svg" -resize 180x180 -alpha off "$OUT/apple-touch-icon.png"
magick -background none -density 384 "$tmp/any.svg"  -resize 48x48 src/app/favicon.ico
ls -la "$OUT"
