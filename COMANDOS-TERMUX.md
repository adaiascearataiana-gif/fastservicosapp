# Comandos para o Termux — FastServiços App

Esse arquivo lista os comandos para rodar o app no Termux (Android).

## 1. Instalar Termux (se ainda não tiver)

```
pkg update && pkg upgrade -y
pkg install nodejs npm
```

## 2. Baixar o app

```
# Clonar o repositório
git clone https://github.com/adaiascearataiana-gif/fastservicosapp.git
cd fastservicosapp
```

## 3. Rodar o app localmente

```
# Usar um servidor HTTP simples
python3 -m http.server 8080

# Ou com Node
npx http-server -p 8080

# Acessar via navegador:
# http://localhost:8080
```

## 4. Comandos útils do app

### Fotografia (câmera)
```
# Permissão de câmera — automaticamente solicitada pelo navegador
# Para tirar foto da rota: toque no botão "Bater Foto"
```

### Sincronização
```
# Sincronizar dados com a nuvem (Supabase)
# O app sincroniza automaticamente
# Para forçar sincronização: toque no botão "Sincronizar"
```

### Modo coleta
```
# No modo coleta, os pontos de coleta aparecem agrupados
# O destino final aparece ao lado do valor da coleta
```

## 5. Comandos de desempenho (se o app estiver lento)

```
# Limpar cache do navegador Termux
# (depende do navegador usado)

# Reiniciar o servidor
# Pressione Ctrl+C no terminal e rode novamente:
python3 -m http.server 8080
```

## 6. Comandos de depuração

```
# Verificar versão do Node
node -v

# Verificar se o servidor está rodando
curl http://localhost:8080

# Verificar se o arquivo principal existe
ls -la index.html
```

## 7. Comandos para produção

```
# Se quiser empacotar o app
# (o app é um único arquivo HTML, não precisa de build)

# Para hospedar no GitHub Pages
# O app já está configurado para GitHub Pages
```

## 8. Comandos de área de trabalho (se usar Termux no PC)

```
# Instalar termux-x11 para interface gráfica
pkg install termux-x11
termux-setup-storage

# Acessar arquivos do celular no PC
ls ~/storage/shared/
```

## 9. Comandos de rede

```
# Verificar conexão com a nuvem (Supabase)
# O app usa Supabase para sincronização

# Verificar DNS
nslookup supabase.co

# Testar conexão
ping -c 4 supabase.co
```

## 10. Comandos de segurança

```
# O app tem área protegida por senha
# A senha é definida na primeira vez

# Para redefinir a senha:
# (não há comando direto — use a interface do app)
```

## 11. Comandos para desenvolvedores

```
# Instalar dependências (se houver)
npm install

# Rodar testes
# (o app usa testes em JS, rodar com Node)

# Validar sintaxe do index.html
node --check index.html
# (nota: index.html é HTML, não JS — usar validação de JS extraída)
```

## 12. Comandos de rápido acesso

```
# Abrir o app no navegador
xdg-open http://localhost:8080

# Para Android: usar o navegador do celular
# (digite http://localhost:8080 no navegador do celular)

# Para acessar via IP do celular:
# (verifique o IP com)
ip addr show
# (use http://<IP>:8080 no computador)
```
