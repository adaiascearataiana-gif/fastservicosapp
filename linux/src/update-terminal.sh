#!/usr/bin/env bash
# ============================================================================
#  FAST Serviços — ATUALIZAÇÃO PELO TERMINAL (r145)
#  Gerado pelo aplicativo quando você clica em ATUALIZAR PELO TERMINAL.
#  Mostra ao vivo cada etapa: procura, baixa, confere e instala a versão
#  mais nova das Releases oficiais do GitHub.
# ============================================================================
set -uo pipefail

REPO="adaiascearataiana-gif/fastservicosapp"
BASE="https://github.com/${REPO}/releases/latest/download"
YML_URL="${BASE}/latest-linux.yml"
ATUAL="${FAST_CURRENT_VERSION:-desconhecida}"
APPIMAGE_PATH="${APPIMAGE:-}"

info(){ printf '\033[1;36m%s\033[0m\n' "$*"; }
ok(){   printf '\033[1;32m%s\033[0m\n' "$*"; }
warn(){ printf '\033[1;33m%s\033[0m\n' "$*"; }
erro(){ printf '\033[1;31m%s\033[0m\n' "$*"; }
linha(){ printf '\033[2m──────────────────────────────────────────────\033[0m\n'; }

pausa(){ printf '\n'; read -r -p "  Pressione ENTER para fechar este terminal..." _; }

# Baixa URL -> DESTINO mostrando barra de progresso (curl ou wget).
dl(){
  if command -v curl >/dev/null 2>&1; then
    curl -fL --progress-bar -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -q --show-progress -O "$2" "$1"
  else
    erro "  Nem curl nem wget estão instalados. Instale o curl e tente de novo."
    return 127
  fi
}

# Devolve 0 quando $1 é MAIS NOVA que $2 (comparação 2.3.27 > 2.3.19).
ver_gt(){
  local IFS='.'
  local -a a=($1) b=($2)
  local i x y
  for i in 0 1 2 3; do
    x=$((10#${a[i]:-0})); y=$((10#${b[i]:-0}))
    (( x > y )) && return 0
    (( x < y )) && return 1
  done
  return 1
}

clear
echo ""
printf '\033[1;37;44m                                              \033[0m\n'
printf '\033[1;37;44m   FAST SERVIÇOS · ATUALIZAÇÃO PELO TERMINAL   \033[0m\n'
printf '\033[1;37;44m                                              \033[0m\n'
echo ""
info "  Versão instalada .... $ATUAL"
info "  Origem .............. GitHub Releases (oficial)"
if [ -n "$APPIMAGE_PATH" ]; then
  info "  Tipo de instalação .. AppImage"
  info "  Local ................ $APPIMAGE_PATH"
else
  info "  Tipo de instalação .. pacote .deb (sistema)"
fi
echo ""
linha

# --------------------------------------------------------------------------
info "▶ ETAPA 1/4 — Procurando a versão mais recente…"
echo ""
TMPDIR_FAST="$(mktemp -d /tmp/fast-update.XXXXXX)" || { erro "Não consegui criar pasta temporária."; pausa; exit 1; }
cd "$TMPDIR_FAST" || exit 1

if ! dl "$YML_URL" latest.yml 2>/dev/null || ! [ -s latest.yml ]; then
  erro "  Não consegui ler a lista de versões do GitHub."
  erro "  Verifique sua conexão com a internet e tente de novo."
  pausa; exit 1
fi

NOVA="$(sed -n 's/^version:[[:space:]]*//p' latest.yml | head -1 | tr -d "'\"")"
if [ -z "$NOVA" ]; then
  erro "  Lista de versões veio em branco. Tente de novo em alguns minutos."
  pausa; exit 1
fi
ok "  Versão mais recente publicada: $NOVA"
echo ""

if ! ver_gt "$NOVA" "$ATUAL"; then
  ok "  Você já está na versão mais recente ($ATUAL). Nada a fazer!"
  echo ""
  linha
  pausa; exit 0
fi
warn "  Há uma versão nova: $ATUAL  →  $NOVA"
echo ""
linha

# --------------------------------------------------------------------------
info "▶ ETAPA 2/4 — Baixando o FAST Serviços $NOVA…"
echo ""
if [ -n "$APPIMAGE_PATH" ]; then
  ARQ="FAST-Servicos-${NOVA}-x86_64.AppImage"
else
  ARQ="FAST-Servicos-${NOVA}-amd64.deb"
fi
URL_ARQ="${BASE}/${ARQ}"
info "  $URL_ARQ"
echo ""
if ! dl "$URL_ARQ" "$ARQ"; then
  erro "  O download falhou (internet caiu?). O arquivo parcial foi descartado."
  rm -f "$ARQ"
  pausa; exit 1
fi
if ! [ -s "$ARQ" ]; then
  erro "  O arquivo veio vazio — cancelado por segurança."
  pausa; exit 1
fi
TAM_MB=$(( $(stat -c%s "$ARQ") / 1048576 ))
ok "  Baixado: $ARQ (${TAM_MB} MB)"
echo ""
linha

# --------------------------------------------------------------------------
info "▶ ETAPA 3/4 — Conferindo a integridade do pacote (sha512)…"
echo ""
SHA_ESPERADO="$(awk -v f="$ARQ" 'index($0,"url: "f)>0{getline; print $2}' latest.yml | head -1)"
if [ -n "$SHA_ESPERADO" ]; then
  SHA_ATUAL=""
  if command -v openssl >/dev/null 2>&1; then
    SHA_ATUAL="$(openssl dgst -sha512 -binary "$ARQ" 2>/dev/null | openssl base64 -A 2>/dev/null)"
  elif command -v xxd >/dev/null 2>&1; then
    SHA_ATUAL="$(sha512sum "$ARQ" | cut -d' ' -f1 | xxd -r -p | base64 -w0)"
  fi
  if [ -n "$SHA_ATUAL" ]; then
    if [ "$SHA_ATUAL" = "$SHA_ESPERADO" ]; then
      ok "  Assinatura confere — pacote oficial e íntegro."
    else
      erro "  A assinatura NÃO confere! O arquivo pode estar corrompido."
      erro "  Abortado por segurança. Rode a atualização de novo."
      cd /tmp; rm -rf "$TMPDIR_FAST"
      pausa; exit 1
    fi
  else
    warn "  Sem openssl/xxd no sistema para conferir — seguindo o download."
  fi
else
  warn "  Não achei o hash deste arquivo na lista — seguindo o download."
fi
echo ""
linha

# --------------------------------------------------------------------------
info "▶ ETAPA 4/4 — Instalando e reiniciando o FAST Serviços…"
echo ""
chmod +x "$ARQ"

if [ -n "$APPIMAGE_PATH" ]; then
  # ---------- AppImage: substitui o arquivo em uso e relança ----------
  DEST_DIR="$(dirname "$APPIMAGE_PATH")"
  if [ -w "$DEST_DIR" ]; then
    cp -f "$APPIMAGE_PATH" "${APPIMAGE_PATH}.backup" 2>/dev/null || true
    if mv -f "$ARQ" "$APPIMAGE_PATH"; then
      chmod +x "$APPIMAGE_PATH"
      ok "  Novo AppImage instalado no mesmo lugar:"
      info "  $APPIMAGE_PATH"
      [ -f "${APPIMAGE_PATH}.backup" ] && info "  Backup da versão antiga: ${APPIMAGE_PATH}.backup"
      echo ""
      info "  Fechando o app antigo…"
      pkill -f "$APPIMAGE_PATH" 2>/dev/null || true
      sleep 2
      pkill -9 -f "$APPIMAGE_PATH" 2>/dev/null || true
      info "  Abrindo a versão nova…"
      ( setsid nohup "$APPIMAGE_PATH" >/dev/null 2>&1 & ) 2>/dev/null || true
      sleep 2
      echo ""
      ok "  ✔ ATUALIZADO COM SUCESSO: $ATUAL  →  $NOVA"
      echo ""
      ok "  O FAST Serviços $NOVA está abrindo agora."
      info "  (Se não abrir sozinho, dê dois cliques no AppImage.)"
    else
      erro "  Não consegui substituir o AppImage (permissão?)."
      info "  O arquivo novo ficou em: $TMPDIR_FAST/$ARQ"
    fi
  else
    erro "  A pasta do AppImage não permite escrita: $DEST_DIR"
    info "  O arquivo novo ficou em: $TMPDIR_FAST/$ARQ"
    info "  Mova ele para lá manualmente e abra o aplicativo."
  fi
elif [ -x "/opt/FAST Serviços/fast-servicos-linux" ] || command -v apt-get >/dev/null 2>&1; then
  # ---------- .deb: instala com sudo e relança ----------
  info "  Instalando o pacote .deb no sistema (pode pedir sua senha)…"
  echo ""
  if sudo apt-get install -y "$TMPDIR_FAST/$ARQ"; then
    echo ""
    ok "  Pacote .deb instalado."
    info "  Fechando o app antigo…"
    pkill -f '/opt/FAST Serviços/fast-servicos' 2>/dev/null || true
    pkill -f 'fast-servicos-linux' 2>/dev/null || true
    sleep 2
    info "  Abrindo a versão nova…"
    ( setsid nohup '/opt/FAST Serviços/fast-servicos-linux' >/dev/null 2>&1 & ) 2>/dev/null || true
    sleep 2
    echo ""
    ok "  ✔ ATUALIZADO COM SUCESSO: $ATUAL  →  $NOVA"
    echo ""
    ok "  O FAST Serviços $NOVA está abrindo agora."
    info "  (Se não abrir sozinho, abra pelo menu de aplicativos.)"
  else
    echo ""
    erro "  A instalação falhou ou foi cancelada (senha sudo?)."
    info "  O pacote continua em: $TMPDIR_FAST/$ARQ"
    info "  Tente manualmente:  sudo apt install $TMPDIR_FAST/$ARQ"
  fi
else
  # ---------- instalação não identificada: entrega o AppImage ----------
  warn "  Não identifiquei AppImage nem pacote .deb no sistema."
  DEST="$HOME/Aplicativos"
  mkdir -p "$DEST" 2>/dev/null || DEST="$HOME"
  ARQ_OUT="FAST-Servicos-${NOVA}-x86_64.AppImage"
  if mv "$ARQ" "$DEST/$ARQ_OUT" 2>/dev/null; then
    chmod +x "$DEST/$ARQ_OUT"
    ok "  Novo AppImage salvo em: $DEST/$ARQ_OUT"
    info "  Fechando o app antigo…"
    pkill -f "$APPIMAGE_PATH" 2>/dev/null || true
    sleep 1
    info "  Abrindo a versão nova…"
    ( setsid nohup "$DEST/$ARQ_OUT" >/dev/null 2>&1 & ) 2>/dev/null || true
    ok "  ✔ ATUALIZADO COM SUCESSO: $ATUAL  →  $NOVA"
  else
    erro "  Não consegui salvar em $DEST."
    info "  O arquivo ficou em: $TMPDIR_FAST/$ARQ"
  fi
fi

echo ""
linha
pausa
exit 0
