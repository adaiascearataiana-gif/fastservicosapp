#!/usr/bin/env bash
set -euo pipefail
config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/fast-servicos-linux"
install -d -m 700 "$config_dir"
if [ ! -f "$config_dir/config.json" ]; then
  install -m 600 config.example.json "$config_dir/config.json"
fi
echo "Configuração criada em: $config_dir/config.json"
echo 'Preencha apenas URL pública, chave anon do Supabase e Client ID OAuth do Google.'

