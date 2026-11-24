# Atalhos dos apps (Linux e Termux) — fast, mm, ibnm, part + online
REPOS="fast:fastservicosapp mm:mmibnmapp ibnm:igrejaibnm part:mmibnm-partituras"
GHUSER="adaiascearataiana-gif"
for a in fast mm ibnm igreja part online; do unalias $a 2>/dev/null; unset -f $a 2>/dev/null; done
_abrir_repo() {
  local pasta="$HOME/$1"
  if [ ! -d "$pasta/.git" ]; then
    echo "Baixando $1 do GitHub..."; git clone -q "https://github.com/$GHUSER/$1.git" "$pasta" || return 1
  fi
  cd "$pasta" && git pull --ff-only
}
fast()   { _abrir_repo fastservicosapp; }
mm()     { _abrir_repo mmibnmapp; }
ibnm()   { _abrir_repo igrejaibnm; }
igreja() { _abrir_repo igrejaibnm; }
part()   { _abrir_repo mmibnm-partituras; }
online() {
  local par atalho repo pasta site v sb key c local_h remoto lista aqui
  # dentro da pasta de um app: mostra só ele; fora: mostra todos
  aqui=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null)
  lista="$REPOS"
  for par in $REPOS; do [ "${par#*:}" = "$aqui" ] && lista="$par"; done
  for par in $lista; do
    atalho=${par%%:*}; repo=${par#*:}; pasta="$HOME/$repo"
    echo ""
    echo "===== $atalho  ($repo) ====="
    remoto=$(git ls-remote "https://github.com/$GHUSER/$repo.git" refs/heads/main 2>/dev/null | cut -c1-7)
    if [ -d "$pasta/.git" ]; then
      git -C "$pasta" fetch -q origin 2>/dev/null
      echo "GitHub: $(git -C "$pasta" log -1 --format='%h  %ad  %s' --date=format:'%d/%m %H:%M' origin/main 2>/dev/null)"
      local_h=$(git -C "$pasta" rev-parse --short=7 HEAD 2>/dev/null)
      [ "$local_h" = "$remoto" ] && echo "Pasta no aparelho: atualizada" || echo "Pasta no aparelho: DESATUALIZADA (digite $atalho)"
    else
      echo "GitHub: último envio $remoto   (pasta não baixada — digite $atalho)"
    fi
    site="https://$GHUSER.github.io/$repo/"
    c=$(curl -s -o /tmp/.online_site -w '%{http_code}' -m 20 "${site}?nc=$(date +%s)")
    v=$(grep -oE '(fast-app-version|app-version)" content="[0-9.]+"|data-fast-version="[^"]*"|mmibnm-v[0-9]+' /tmp/.online_site 2>/dev/null | head -1)
    [ "$c" = "200" ] && echo "Site: NO AR  ${v}" || echo "Site: FORA (código $c)  $site"
    sb=""; key=""
    if [ -d "$pasta" ]; then
      sb=$(grep -rhoE 'https://[a-z0-9]{20}\.supabase\.co' --include=*.html --include=*.js "$pasta" 2>/dev/null | head -1)
      key=$(grep -rhoE 'sb_publishable_[A-Za-z0-9_-]+|eyJhbGciOiJIUzI1NiIs[A-Za-z0-9._-]+' --include=*.html --include=*.js "$pasta" 2>/dev/null | head -1)
    fi
    if [ -n "$sb" ]; then
      c=$(curl -s -o /dev/null -w '%{http_code}' -m 20 "$sb/auth/v1/health" -H "apikey: $key")
      case "$c" in
        200) echo "Supabase: OK";;
        402) echo "Supabase: BLOQUEADO — cota do plano grátis estourou";;
        000) echo "Supabase: sem resposta (internet ou Supabase fora)";;
        *)   echo "Supabase: código $c";;
      esac
    fi
  done
  echo ""
}

# ---- atualizar: baixa agora a última versão dos 4 apps (e destes atalhos) ----
atualizar() {
  local par repo
  for par in $REPOS; do
    repo=${par#*:}
    if [ -d "$HOME/$repo/.git" ]; then
      printf '%-22s ' "$repo"; git -C "$HOME/$repo" pull -q --ff-only 2>&1 | tail -1; echo "ok"
    fi
  done
  [ -f "$HOME/fastservicosapp/terminal/atalhos-apps.sh" ] && source "$HOME/fastservicosapp/terminal/atalhos-apps.sh"
  echo "Tudo atualizado."
}

# ---- ao abrir o terminal: atualiza os 4 apps em segundo plano (no máximo a cada 10 min) ----
_auto_atualizar() {
  local marca="$HOME/.atalhos-ultima-atualizacao" agora antes
  agora=$(date +%s); antes=$(cat "$marca" 2>/dev/null || echo 0)
  [ $((agora - antes)) -lt 600 ] && return
  echo "$agora" > "$marca"
  (
    for par in $REPOS; do
      repo=${par#*:}
      [ -d "$HOME/$repo/.git" ] && timeout 60 git -C "$HOME/$repo" pull -q --ff-only >/dev/null 2>&1
    done
  ) >/dev/null 2>&1 &
  disown 2>/dev/null
}
case $- in *i*) _auto_atualizar;; esac
