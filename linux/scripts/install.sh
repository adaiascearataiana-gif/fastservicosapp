#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo 'Instale Node.js 20 ou superior.'; exit 1; }
node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" -ge 20 ] || { echo 'Node.js 20 ou superior é necessário.'; exit 1; }
npm install
npm run dist
echo 'Instaladores criados na pasta dist/.'

