#!/usr/bin/env bash
# FAST Serviços — instalação e empacotamento para Linux
# Uso: chmod +x scripts/install.sh && ./scripts/install.sh
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo 'Instale Node.js 20 ou superior.'; exit 1; }
node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" -ge 20 ] || { echo 'Node.js 20 ou superior é necessário.'; exit 1; }
npm install
npm run dist
EXPECTED_VERSION="$(node -p "require('./package.json').version")"
echo 'Instaladores criados na pasta dist/.'

# --- Verificação pós-instalação: confere se o pacote gerado contém a versão atual ---
echo
echo '=== Verificando a versão empacotada ==='
if [ -d dist/linux-unpacked ]; then
  if grep -q "fast-app-version\" content=\"${EXPECTED_VERSION}\"" dist/linux-unpacked/resources/app.asar.unpacked/src/renderer/index.html 2>/dev/null \
     || grep -q "fast-app-version\" content=\"${EXPECTED_VERSION}\"" dist/linux-unpacked/resources/app/src/renderer/index.html 2>/dev/null; then
    echo "OK: o aplicativo empacotado contém a versão ${EXPECTED_VERSION}."
  else
    # asar embutido: extrai em temp e confere
    tmpdir="$(mktemp -d)"
    npx asar extract dist/linux-unpacked/resources/app.asar "$tmpdir/app" 2>/dev/null || true
    if grep -q "fast-app-version\" content=\"${EXPECTED_VERSION}\"" "$tmpdir/app/src/renderer/index.html" 2>/dev/null; then
      echo "OK: o aplicativo empacotado contém a versão ${EXPECTED_VERSION}."
    else
      echo "AVISO: não achei a marcação ${EXPECTED_VERSION} no pacote. Verifique src/renderer/index.html."
    fi
    rm -rf "$tmpdir"
  fi
fi
for f in dist/FAST-Servicos-${EXPECTED_VERSION}-*; do
  [ -e "$f" ] || continue
  echo "Pacote pronto: $f"
done
echo 'Instalação concluída. Abra o FAST Serviços no menu de aplicativos.'
echo 'Dica: o aplicativo procura atualizações sozinho 7 segundos após abrir (GitHub Releases).'
