#!/usr/bin/env bash
# FAST Serviços — instalação e empacotamento para Linux (2.3.9)
# Uso: chmod +x scripts/install.sh && ./scripts/install.sh
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo 'Instale Node.js 20 ou superior.'; exit 1; }
node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" -ge 20 ] || { echo 'Node.js 20 ou superior é necessário.'; exit 1; }
npm install
npm run dist
echo 'Instaladores criados na pasta dist/.'

# --- Verificação pós-instalação (r119): confere se o pacote gerado já contém a 2.3.9 ---
echo
echo '=== Verificando a versão empacotada ==='
if [ -d dist/linux-unpacked ]; then
  if grep -q 'fast-app-version" content="2.3.9"' dist/linux-unpacked/resources/app.asar.unpacked/src/renderer/index.html 2>/dev/null \
     || grep -q 'fast-app-version" content="2.3.9"' dist/linux-unpacked/resources/app/src/renderer/index.html 2>/dev/null; then
    echo 'OK: o aplicativo empacotado contém a versão 2.3.9.'
  else
    # asar embutido: extrai em temp e confere
    tmpdir="$(mktemp -d)"
    npx asar extract dist/linux-unpacked/resources/app.asar "$tmpdir/app" 2>/dev/null || true
    if grep -q 'fast-app-version" content="2.3.9"' "$tmpdir/app/src/renderer/index.html" 2>/dev/null; then
      echo 'OK: o aplicativo empacotado contém a versão 2.3.9.'
    else
      echo 'AVISO: não achei a marcação 2.3.9 no pacote. Verifique src/renderer/index.html.'
    fi
    rm -rf "$tmpdir"
  fi
fi
for f in dist/FAST-Servicos-2.3.9-*; do
  [ -e "$f" ] || continue
  echo "Pacote pronto: $f"
done
echo 'Instalação concluída. Abra o FAST Serviços no menu de aplicativos.'
echo 'Dica: o aplicativo procura atualizações sozinho 7 segundos após abrir (GitHub Releases).'
