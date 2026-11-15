#!/usr/bin/env bash
# ============================================================
#  APP DA IGREJA (IBNM) — COLOCAR ESTA VERSÃO NO AR
#
#  O que este comando faz, sozinho:
#    1. baixa a versão nova do app (só a pasta do app, coisa de 1 MB);
#    2. atualiza a sua pasta ~/igrejaibnm (ou baixa, se ainda não existir);
#    3. copia os arquivos novos por cima;
#    4. envia para o GitHub (git push). O site atualiza em 1 ou 2 minutos.
#
#  Uso (Termux ou Linux) — cole UMA linha:
#    curl -fsSL https://raw.githubusercontent.com/adaiascearataiana-gif/fastservicosapp/arena/00e71f32-fastservicosapp/app-igreja/publicar-no-ar.sh | bash
#
#  Ou, se você já está dentro da pasta com a versão nova:
#    bash publicar-no-ar.sh
#
#  Ele NÃO mexe no banco de dados e não apaga nada da sua pasta.
#  Se o repositório igrejaibnm tiver mudanças que este script não conhece,
#  ele para e avisa (use "--forcar" só se tiver certeza).
# ============================================================
set -e

USUARIO="adaiascearataiana-gif"
ORIGEM_REPO="${IBNM_ORIGEM_REPO:-https://github.com/$USUARIO/fastservicosapp.git}"
ORIGEM_RAMO="${IBNM_ORIGEM_RAMO:-arena/00e71f32-fastservicosapp}"
DESTINO_REPO="${IBNM_DESTINO_REPO:-https://github.com/$USUARIO/igrejaibnm.git}"
DESTINO="${IBNM_PASTA:-$HOME/igrejaibnm}"
# commit que estava no ar quando esta versão foi feita (1.0.0)
BASE_CONHECIDA="ff8f216d27c67ecdc028a367943a8af276c1bf34"
FORCAR=0
ENVIAR=1
for a in "$@"; do
  case "$a" in
    --forcar) FORCAR=1 ;;
    --sem-enviar) ENVIAR=0 ;;
  esac
done

diz()  { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }
erro() { printf '\n\033[1;31mXX \033[0m %s\n' "$1" >&2; exit 1; }

command -v git >/dev/null 2>&1 || erro "Falta o git. No Termux: pkg install -y git"

# ---------- 1. de onde vem a versão nova ----------
ORIGEM=""
TEMP=""
AQUI=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
if [ -n "$AQUI" ] && [ -f "$AQUI/index.html" ] && [ -f "$AQUI/sql/02-secoes-ebd.sql" ] && [ "$AQUI" != "$DESTINO" ]; then
  ORIGEM="$AQUI"
  diz "Usando a versão nova desta pasta: $ORIGEM"
else
  diz "Baixando a versão nova do app..."
  TEMP="$(mktemp -d 2>/dev/null || true)"
  [ -n "$TEMP" ] || { TEMP="$HOME/.ibnm-temp-$$"; mkdir -p "$TEMP"; }
  trap 'rm -rf "$TEMP"' EXIT
  # baixa só a pasta app-igreja (o repositório inteiro é grande)
  if git clone --quiet --depth 1 --filter=blob:none --no-checkout --branch "$ORIGEM_RAMO" "$ORIGEM_REPO" "$TEMP/origem" 2>/dev/null \
     && git -C "$TEMP/origem" sparse-checkout set --no-cone '/app-igreja/' 2>/dev/null \
     && git -C "$TEMP/origem" checkout --quiet 2>/dev/null; then
    :
  else
    rm -rf "$TEMP/origem"
    git clone --quiet --depth 1 --branch "$ORIGEM_RAMO" "$ORIGEM_REPO" "$TEMP/origem" \
      || erro "Não consegui baixar a versão nova. Confira a internet e tente de novo."
  fi
  ORIGEM="$TEMP/origem/app-igreja"
fi
[ -f "$ORIGEM/index.html" ] && [ -f "$ORIGEM/js/config.js" ] || erro "A pasta da versão nova está incompleta: $ORIGEM"
VERSAO="$(sed -n "s/.*VERSAO: *'\([^']*\)'.*/\1/p" "$ORIGEM/js/config.js" | head -n 1)"
[ -n "$VERSAO" ] || VERSAO="nova"

# ---------- 2. a pasta do app que está no ar ----------
if [ -d "$DESTINO/.git" ]; then
  diz "Atualizando a pasta $DESTINO ..."
  cd "$DESTINO"
  if [ -n "$(git status --porcelain)" ] && [ "$FORCAR" != "1" ]; then
    git status --short
    erro "A pasta $DESTINO tem mudanças suas que ainda não foram enviadas (lista acima). Envie ou desfaça essas mudanças e rode de novo. (Para passar por cima mesmo assim: --forcar)"
  fi
  git pull --ff-only --quiet || erro "Não consegui atualizar $DESTINO (git pull). Resolva isso e rode de novo."
else
  diz "Baixando o repositório igrejaibnm em $DESTINO ..."
  git clone --quiet "$DESTINO_REPO" "$DESTINO" || erro "Não consegui baixar o repositório igrejaibnm."
  cd "$DESTINO"
fi

NO_AR="$(sed -n "s/.*VERSAO: *'\([^']*\)'.*/\1/p" js/config.js 2>/dev/null | head -n 1)"

# Você mudou algum arquivo depois da última versão publicada por aqui? Então eu não passo por cima sem avisar.
ULTIMA="$(git log --format=%H --grep='^App IBNM ' -n 1 2>/dev/null || true)"
[ -n "$ULTIMA" ] || ULTIMA="$BASE_CONHECIDA"
PERIGO=""
if git cat-file -e "$ULTIMA^{commit}" 2>/dev/null; then
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    [ -f "$ORIGEM/$f" ] || continue
    novo="$(git hash-object "$ORIGEM/$f")"
    atual="$(git rev-parse -q --verify "HEAD:$f" 2>/dev/null || true)"
    [ "$novo" = "$atual" ] || PERIGO="$PERIGO
    $f"
  done <<LISTA
$(git -c core.quotePath=false diff --name-only "$ULTIMA" HEAD)
LISTA
elif [ "$NO_AR" != "$VERSAO" ]; then
  PERIGO="
    (não reconheci o histórico deste repositório)"
fi
if [ -n "$PERIGO" ] && [ "$FORCAR" != "1" ]; then
  printf '\nArquivos que VOCÊ mudou no repositório igrejaibnm e que a versão nova também muda:%s\n' "$PERIGO" >&2
  erro "Parei para não apagar as suas mudanças. Se pode passar por cima, rode de novo com --forcar"
fi

# ---------- 3. copia os arquivos novos ----------
diz "Copiando a versão $VERSAO (no ar hoje: ${NO_AR:-?}) ..."
cp -R "$ORIGEM"/. "$DESTINO"/
rm -f "$DESTINO/publicar-no-ar.sh"

git add -A
if git diff --cached --quiet; then
  diz "Nada para mudar: a pasta já está na versão $VERSAO."
else
  git config user.name  >/dev/null 2>&1 || git config user.name  "Igreja IBNM"
  git config user.email >/dev/null 2>&1 || git config user.email "igreja@users.noreply.github.com"
  git commit --quiet -m "App IBNM $VERSAO - Escola Biblica, secoes, ADMs secundarios, data/hora/clima"
  diz "Arquivos preparados ($(git show --stat --oneline HEAD | tail -n 1 | sed 's/^ *//'))."
fi

# ---------- 4. envia ----------
if [ "$ENVIAR" = "1" ]; then
  if [ -n "$(git log --oneline '@{u}..HEAD' 2>/dev/null)" ]; then
    diz "Enviando para o GitHub..."
    git push || erro "O envio (git push) falhou. Confira o login do GitHub e rode: cd $DESTINO && git push"
    printf '\n\033[1;32mPRONTO!\033[0m Versão %s enviada.\n' "$VERSAO"
    echo "  Em 1 ou 2 minutos o app atualiza em:"
  else
    printf '\n\033[1;32mTUDO CERTO.\033[0m A versão %s já estava enviada. O app fica em:\n' "$VERSAO"
  fi
  echo "    https://$USUARIO.github.io/igrejaibnm/"
  echo "  No celular: feche e abra o app (ou puxe a tela para baixo) para pegar a versão nova."
else
  printf '\nArquivos copiados para %s (não enviei, por causa do --sem-enviar).\n' "$DESTINO"
  echo "Para enviar depois:  cd $DESTINO && git push"
fi
