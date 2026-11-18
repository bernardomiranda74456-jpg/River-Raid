#!/usr/bin/env bash
# Gera a versão web (Safari no iPad/iPhone, "Adicionar à Tela de Início").
# Uso: ./scripts/build-web.sh [caminho-base]   ex.: ./scripts/build-web.sh /River-Raid/ritmo
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="${1:-}"
rm -rf dist
EXPO_WEB_BASE_URL="$BASE" CI=1 npx expo export --platform web --output-dir dist
# Metadados de PWA e iPad (tela cheia, ícone, idioma)
python3 - "$BASE" <<'PY'
import sys, pathlib, shutil
base = sys.argv[1].rstrip('/')
p = pathlib.Path('dist/index.html'); s = p.read_text()
s = s.replace('<html lang="en">', '<html lang="pt-BR">')
s = s.replace('<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />\n'
  '    <meta name="apple-mobile-web-app-capable" content="yes" />\n'
  '    <meta name="mobile-web-app-capable" content="yes" />\n'
  '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n'
  '    <meta name="apple-mobile-web-app-title" content="Ritmo" />\n'
  '    <meta name="theme-color" content="#0F4C5C" />\n'
  f'    <link rel="apple-touch-icon" href="{base}/apple-touch-icon.png" />\n'
  f'    <link rel="manifest" href="{base}/manifest.webmanifest" />')
p.write_text(s)
shutil.copy('assets/images/icon.png', 'dist/apple-touch-icon.png')
pathlib.Path('dist/manifest.webmanifest').write_text(
  '{"name":"Ritmo","short_name":"Ritmo","display":"standalone","start_url":"%s/","scope":"%s/","background_color":"#0F4C5C","theme_color":"#0F4C5C","lang":"pt-BR","icons":[{"src":"%s/apple-touch-icon.png","sizes":"1024x1024","type":"image/png"}]}\n' % (base, base, base))
# Fallback de rota para hospedagem estática (GitHub Pages devolve 404.html em caminhos desconhecidos)
shutil.copy('dist/index.html', 'dist/404.html')
PY
echo "✔ versão web em dist/ (base: '${BASE:-/}')"
