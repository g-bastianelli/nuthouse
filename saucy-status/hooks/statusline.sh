#!/bin/bash
set -euo pipefail

FLAG="$HOME/.claude/.saucy-status"

if [ ! -e "$FLAG" ] || [ -L "$FLAG" ]; then
  exit 0
fi

SIZE=$(wc -c < "$FLAG" 2>/dev/null || echo 99)
if [ "$SIZE" -gt 10 ]; then
  exit 0
fi

MODE=$(tr -d '[:space:]' < "$FLAG" 2>/dev/null)

case "$MODE" in
  saucy|gooning) ;;
  *) exit 0 ;;
esac

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MSG=$(node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync('$PLUGIN_ROOT/data/messages.json', 'utf8'));
  const pool = data['$MODE'];
  console.log(pool[Math.floor(Math.random() * pool.length)]);
" 2>/dev/null)

if [ -z "$MSG" ]; then
  case "$MODE" in
    saucy)   printf '\033[35m[SAUCY]\033[0m' ;;
    gooning) printf '\033[31m[GOONING]\033[0m' ;;
  esac
  exit 0
fi

case "$MODE" in
  saucy)   printf '\033[35m[SAUCY]\033[0m \033[2m%s\033[0m' "$MSG" ;;
  gooning) printf '\033[31m[GOONING]\033[0m \033[2m%s\033[0m' "$MSG" ;;
esac
