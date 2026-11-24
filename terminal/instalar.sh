#!/bin/bash
# Liga os atalhos que se atualizam sozinhos pelo GitHub (Linux e Termux).
# Depois disso, qualquer mudança feita nos atalhos e enviada pelo notebook
# chega no celular na próxima vez que o Termux abrir (e vice-versa).
LINHA='[ -f ~/fastservicosapp/terminal/atalhos-apps.sh ] && source ~/fastservicosapp/terminal/atalhos-apps.sh || source ~/.atalhos-apps.sh'
cp ~/fastservicosapp/terminal/atalhos-apps.sh ~/.atalhos-apps.sh 2>/dev/null
# troca a linha antiga pela nova (sem mexer no resto do .bashrc)
if grep -q 'source ~/.atalhos-apps.sh' ~/.bashrc 2>/dev/null; then
  grep -v 'source ~/.atalhos-apps.sh' ~/.bashrc > ~/.bashrc.novo && mv ~/.bashrc.novo ~/.bashrc
fi
echo "$LINHA" >> ~/.bashrc
echo "Pronto: atalhos ligados ao GitHub. Feche e abra o terminal."
