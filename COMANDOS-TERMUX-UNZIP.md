# Comandos Termux — Baixar, Descompactar e Subar o App Atualizado

## 1. Baixar o zip do repositório

```bash
# Se o zip já está no repositório (GitHub), basta clonar/baixar
cd ~
git clone https://github.com/adaiascearataiana-gif/fastservicosapp.git
cd fastservicosapp
```

## 2. Descompactar o zip (se recebeu via arquivo)

```bash
# Entrar na pasta onde o zip foi baixado
cd ~/Downloads  # ou onde estiver o arquivo

# Descompactar
unzip fastservicosapp-atualizado.zip

# Entrar na pasta descompactada
cd fastservicosapp-atualizado  # ou a pasta resultante
```

## 3. Subar o app atualizado (via GitHub)

```bash
# Configurar git (se já não configurado)
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"

# Inicializar repositório (se não for um clone)
git init

# Adicionar arquivos
git add index.html COMANDOS-TERMUX.md

# Commitar
git commit -m "Atualização: performance/UI + comandos Termux"

# Adicionar remote (se não tenha)
git remote add origin https://github.com/adaiascearataiana-gif/fastservicosapp.git

# Subar
git push -u origin arena/122bc272-fastservicosapp
```

## 4. Rodar o app localmente no Termux

```bash
# Instalar Python (se já não tiver)
pkg install python3

# Iniciar servidor HTTP
python3 -m http.server 8080

# Acessar no navegador do celular:
# http://localhost:8080

# Ou usar o navegador do Termux (se instalado)
# termux-open-url http://localhost:8080
```

## 5. Verificar a versão do app

```bash
# Verificar se o arquivo existe
ls -la index.html

# Verificar o tamanho do arquivo
wc -c index.html

# Verificar a versão no arquivo
grep "fast-latest-update" index.html | head -1
```

## 6. Comandos de depuração

```bash
# Verificar se o servidor está rodando
curl http://localhost:8080

# Verificar a sintaxe JS (extrair e validar)
python3 -c "
import re
with open('index.html','r',encoding='utf-8') as f:
    content = f.read()
scripts = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', content, re.DOTALL)
print('Blocos JS:', len(scripts))
"

# Verificar se há erros no console
# (abra o navegador com o app e veja o console)
```

## 7. Comandos de rede

```bash
# Verificar conexão com a nuvem (Supabase)
# O app usa Supabase para sincronização

# Testar conexão
ping -c 4 supabase.co

# Verificar DNS
nslookup supabase.co
```

## 8. Comandos de segurança

```bash
# O app tem área protegida por senha
# A senha é definida na primeira vez

# Para redefinir a senha:
# (não há comando direto — use a interface do app)
```

## 9. Comandos de rápido acesso

```bash
# Abrir o app no navegador
xdg-open http://localhost:8080

# Para Android: usar o navegador do celular
# (digite http://localhost:8080 no navegador do celular)

# Para acessar via IP do celular:
# (verifique o IP com)
ip addr show
# (use http://<IP>:8080 no computador)
```

## 10. Comandos para produção

```bash
# Se quiser empacotar o app
zip -r fastservicosapp.zip index.html COMANDOS-TERMUX.md

# Para hospedar no GitHub Pages
# O app já está configurado para GitHub Pages
```

## Resumo dos comandos mais usados

```bash
# Instalar Termux + Node (primeira vez)
pkg update && pkg upgrade -y
pkg install nodejs npm python3

# Baixar e descompactar
git clone https://github.com/adaiascearataiana-gif/fastservicosapp.git
cd fastservicosapp

# Rodar o app
python3 -m http.server 8080

# Subar atualizações
git add index.html
git commit -m "Atualização"
git push
```
