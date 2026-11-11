#!/usr/bin/env bash
# ============================================================
#  Publica o app da Igreja Batista em Nova Metrópole em um
#  repositório próprio no GitHub (ex.: igrejaibnm).
#
#  Como usar (Termux ou Linux), dentro da pasta do app:
#      bash publicar-novo-repo.sh igrejaibnm
#
#  Precisa do GitHub CLI (gh) já logado:   gh auth login
# ============================================================
set -e

REPO="${1:-igrejaibnm}"
ORIGEM="$(cd "$(dirname "$0")" && pwd)"
USUARIO="$(gh api user --jq .login)"

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ Falta o GitHub CLI. Instale com:  pkg install gh   (Termux)"
  echo "                                    sudo apt install gh   (Linux)"
  exit 1
fi

if gh repo view "$USUARIO/$REPO" >/dev/null 2>&1; then
  echo "⚠️  O repositório $USUARIO/$REPO já existe. Nada foi alterado."
  exit 1
fi

TMP="$(mktemp -d)"
DESTINO="$TMP/$REPO"
mkdir -p "$DESTINO"

echo "→ Copiando o app..."
(cd "$ORIGEM" && tar --exclude='./publicar-novo-repo.sh' --exclude='./node_modules' -cf - .) | (cd "$DESTINO" && tar -xf -)

cd "$DESTINO"
touch .nojekyll
git init -q
git branch -M main
git add -A
git -c user.name="App IBNM" -c user.email="app@ibnm.local" commit -qm "App da Igreja Batista em Nova Metrópole 1.0"

echo "→ Criando o repositório $USUARIO/$REPO..."
gh repo create "$USUARIO/$REPO" --public \
  --description "App da Igreja Batista em Nova Metrópole: devocional, agenda, palavra pastoral, oração e ofertas por PIX" \
  --source=. --remote=origin --push

echo "→ Ligando o GitHub Pages..."
gh api -X POST "repos/$USUARIO/$REPO/pages" \
  -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || \
gh api -X PUT "repos/$USUARIO/$REPO/pages" \
  -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || true

echo
echo "✅ Pronto!"
echo "   Repositório: https://github.com/$USUARIO/$REPO"
echo "   App no ar:   https://$USUARIO.github.io/$REPO/"
echo
echo "⚠️  Falta liberar esse endereço no Supabase (login com Google):"
echo "   Authentication → URL Configuration → Redirect URLs:"
echo "   https://$USUARIO.github.io/$REPO/**"
echo
echo "Depois, no seu terminal:  cd ~/$REPO   (ou use o atalho: ibnm)"
