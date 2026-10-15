#!/usr/bin/env bash
# Builds two outputs from src/:
#   index.html          full HTML document, for Netlify / Vercel / GitHub Pages
#   dist/fragment.html  body-only fragment (no <html>/<head>), for hosts that add their own skeleton
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
{
  cat src/page.html
  echo '<script>'
  cat src/data.js
  echo
  cat src/app.js
  echo '</script>'
} > dist/fragment.html
{
  echo '<!doctype html>'
  echo '<html lang="en">'
  echo '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  sed -n '1,/^<\/style>$/p' src/page.html
  echo '</head>'
  echo '<body>'
  sed -n '/^<\/style>$/,$p' src/page.html | tail -n +2
  echo '<script>'
  cat src/data.js
  echo
  cat src/app.js
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > index.html
echo "built index.html and dist/fragment.html"
