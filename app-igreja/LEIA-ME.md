# ⛪ App da Igreja Batista em Nova Metrópole (IBNM)

Aplicativo (site instalável no celular) da **Igreja Batista em Nova Metrópole**.
Funciona no Android, iPhone e computador, sem precisar baixar na loja.

**Endereço do app já no ar:**
`https://adaiascearataiana-gif.github.io/fastservicosapp/app-igreja/`
(atalho: `https://adaiascearataiana-gif.github.io/fastservicosapp/igreja.html`)

Endereço próprio (depois de criar o repositório `igrejaibnm`):
`https://adaiascearataiana-gif.github.io/igrejaibnm/`

> Já vem com: login por e-mail e Google, cadastro com data de nascimento e endereço,
> devocional do dia, agenda semanal e mensal, programações, atividades, palavra pastoral,
> pedidos de oração, aniversariantes, oferta por PIX (com QR Code), painel do administrador,
> tamanhos de letra e a **rádio da igreja pronta, mas desligada**.

---

## 1. O que já está pronto (não precisa fazer nada)

| Item | Situação |
|---|---|
| Banco de dados (tabelas, segurança, regras) | ✅ criado no Supabase (projeto `mmibnm`) |
| Login com Google | ✅ ativado no Supabase |
| Login por e-mail e senha | ✅ ativado |
| App completo (telas, PIX, QR Code, rádio) | ✅ neste repositório |
| Endereços de retorno do login | ✅ liberados para o GitHub Pages |
| Rádio | ⏸️ pronta e **desligada** — liga quando você quiser |

---

## 2. Primeiros passos (10 minutos)

1. Abra o app no celular.
2. Toque em **Mais › Entrar ou criar conta › Criar conta**.
3. Preencha nome, e-mail, data de nascimento, endereço e senha.
   **A primeira conta criada vira ADMINISTRADOR automaticamente.**
4. Vá em **Mais › Painel do administrador** e preencha:
   - **⛪ Igreja**: nome, endereço, telefone, WhatsApp, horários dos cultos,
     Instagram e YouTube (links completos, começando com `https://`).
   - **💚 PIX e oferta**: chave PIX, nome do recebedor, cidade e mensagem.
   - **📅 Agenda**: cadastre os cultos fixos (“repete toda semana”) e os eventos com data.
   - **📖 Devocional**: escreva o devocional de hoje e toque em **Publicar**.
   - **💬 Palavra**, **📌 Avisos**: o que quiser mostrar na tela inicial.
5. Pronto. Quem entrar depois vê tudo preenchido.

> **Já tinha conta no app do MM (IBNM)?** O login é o mesmo. Se a sua conta não virou ADM,
> rode no Supabase (SQL Editor):
> ```sql
> update public.ibnm_perfis set is_adm = true where email = 'seuemail@gmail.com';
> ```

---

## 3. Como ligar a rádio (quando você mandar)

1. Entre como administrador → **Painel → 📻 Rádio**.
2. Cole o **link do áudio** da rádio (ex.: `https://servidor.com:8000/radio.mp3`).
3. Nome, imagem da capa (link) e mensagem (opcional).
4. Ligue a chave **“Rádio da igreja ligada”** e toque em **Salvar**.
5. No mesmo instante aparece um player em todas as telas do app, com botão de play.
6. Para desligar depois: desligue a mesma chave.

O player toca o link direto (Icecast/Shoutcast, `.mp3`, `.m3u8`). Não precisa mexer no código.

---

## 4. Oferta por PIX

- O QR Code é **gerado no próprio celular**, sem serviço externo, e já sai com o valor escolhido.
- Quem oferta pode copiar o **código PIX** (botão “Copiar código PIX”).
- O membro logado pode **registrar a oferta** e **enviar o comprovante** (foto/PDF).
  O comprovante fica em pasta privada: só a pessoa e o administrador conseguem abrir.
- No painel **💰 Ofertas** você vê os valores, confirma o recebimento e abre o comprovante.
- **Importante:** o app não processa pagamento. O dinheiro cai direto na conta da igreja
  pela chave PIX cadastrada.

💡 Dica: imprima o QR Code da tela do painel e cole no mural da igreja.

---

## 5. Tamanhos de letra (para quem tem dificuldade)

- Botão **“A”** no topo da tela, ou **Mais › Tamanho da letra**.
- São 4 tamanhos: Pequeno, Normal, Grande e Muito grande.
- A escolha fica salva no aparelho da pessoa (não afeta os outros).
- Todo o app usa letras grandes, botões altos e linguagem simples.
- Existe também a tela **Mais › Como usar o app**, com passo a passo.

---

## 6. Instalar no celular

- **Android (Chrome):** menu **⋮ › Adicionar à tela inicial** (ou o botão “Instalar” que aparece no app).
- **iPhone (Safari):** botão **Compartilhar › Adicionar à Tela de Início**.
- Depois de instalado, abre como um aplicativo normal, com ícone próprio.
- Funciona **sem internet** para o que já foi aberto (devocional, agenda…).

---

## 7. Banco de dados (Supabase)

Projeto usado: **mmibnm** — `https://whtbzermbyuxicswyvsy.supabase.co`

- Se precisar recriar tudo em outro projeto, rode o arquivo **`sql/01-base.sql`**
  no **SQL Editor** do Supabase (pode rodar quantas vezes quiser).
- Tabelas criadas (todas com segurança por linha — RLS):
  `ibnm_perfis`, `ibnm_config`, `ibnm_devocionais`, `ibnm_eventos`,
  `ibnm_palavras`, `ibnm_avisos`, `ibnm_oracoes`, `ibnm_ofertas`.
- Pastas de arquivos: `igreja` (privada, comprovantes) e `igreja-publico` (fotos).
- Funções: `ibnm_is_adm()`, `ibnm_aniversariantes(mês)`.

### Ativar login com Google (se um dia trocar de projeto)

1. **Google Cloud Console** → APIs e serviços → Credenciais → **Criar ID do cliente OAuth**
   (tipo: Aplicativo da Web).
2. Em **Origens JavaScript autorizadas**, coloque:
   `https://adaiascearataiana-gif.github.io`
3. Em **URIs de redirecionamento autorizados**, coloque:
   `https://SEU-PROJETO.supabase.co/auth/v1/callback`
4. Copie **Client ID** e **Client Secret**.
5. No Supabase: **Authentication → Sign In / Providers → Google → Enable** e cole os dois.
6. No Supabase: **Authentication → URL Configuration**:
   - Site URL: `https://adaiascearataiana-gif.github.io/igrejaibnm/`
   - Redirect URLs: `https://adaiascearataiana-gif.github.io/igrejaibnm/**`
   - (deixe também a URL antiga `.../fastservicosapp/app-igreja/**` se quiser)

> No projeto atual isso **já está feito**. O login por e-mail funciona sempre, mesmo sem Google.

---

## 7.1 Criar o repositório próprio (opcional, um comando)

O app já está publicado dentro do repositório `fastservicosapp`. Se quiser um
repositório só dele (`igrejaibnm`), rode **uma vez**:

```bash
cd ~/fastservicosapp/app-igreja
bash publicar-novo-repo.sh igrejaibnm
```

O script copia o app para uma pasta nova, cria o repositório no GitHub,
envia o código e liga o GitHub Pages. No fim ele mostra o endereço.
Depois disso, os comandos de atualização passam a ser no repositório novo.

---

## 8. Comandos — TERMUX (Android)

```bash
# 1) preparar o Termux (só na primeira vez)
pkg update -y && pkg upgrade -y
pkg install -y git nodejs-lts python

# 2) baixar o app
cd ~
git clone https://github.com/adaiascearataiana-gif/igrejaibnm.git
cd igrejaibnm

# 3) criar o atalho "ibnm" (igual ao mm e ao fast)
echo "alias ibnm='cd ~/igrejaibnm'" >> ~/.bashrc
source ~/.bashrc

# 4) testar
ibnm                 # já cai dentro da pasta do app
python -m http.server 8080
# abra no navegador do celular: http://localhost:8080
```

Atualizar o app depois de uma mudança:

```bash
ibnm
git pull
```

---

## 9. Comandos — Linux (terminal do computador)

```bash
# 1) preparar (Ubuntu/Debian) — só na primeira vez
sudo apt update
sudo apt install -y git python3

# 2) baixar o app
cd ~
git clone https://github.com/adaiascearataiana-gif/igrejaibnm.git
cd igrejaibnm

# 3) criar o atalho "ibnm"
echo "alias ibnm='cd ~/igrejaibnm'" >> ~/.bashrc
source ~/.bashrc

# 4) testar
ibnm
python3 -m http.server 8080
# abra no navegador: http://localhost:8080
```

> Usa Zsh (macOS ou Linux com zsh)? Troque `~/.bashrc` por `~/.zshrc`.

Se o seu `mm` e o `fast` apontam para outra pasta, ajuste o caminho no atalho:

```bash
# ver como estão os atalhos atuais
alias | grep -E "mm|fast|ibnm"

# redefinir o caminho do ibnm (exemplo: pasta em ~/Documentos)
echo "alias ibnm='cd ~/Documentos/igrejaibnm'" >> ~/.bashrc
source ~/.bashrc
```

Se quiser o atalho valendo para **todos** os usuários (Linux):

```bash
sudo tee /usr/local/bin/ibnm >/dev/null <<'EOF'
#!/bin/sh
cd "$HOME/igrejaibnm" || exit 1
exec "${SHELL:-/bin/bash}"
EOF
sudo chmod +x /usr/local/bin/ibnm
```

Agora digitar `ibnm` em qualquer terminal abre a pasta do app.

---

## 10. Publicar / atualizar o app

O GitHub Pages publica sozinho o que está na branch `main` do repositório.
Para mandar mudanças feitas no celular/computador:

```bash
ibnm
git pull
# ... edite os arquivos ...
git add -A
git commit -m "Atualização do app da igreja"
git push
```

Em 1 ou 2 minutos o site atualiza. Se o celular não mostrar a novidade,
feche e abra o app, ou puxe a página para baixo.

---

## 11. Testar sem publicar

```bash
ibnm
node testes/testar.js        # roda os testes automáticos (precisa de Node)
```

O teste confere: login, telas, agenda da semana e do mês, QR Code do PIX,
painel do administrador (10 abas) e os 4 tamanhos de letra.

---

## 12. Arquivos do app

```
index.html          tela e estrutura
css/app.css         aparência (cores, letras, botões)
js/config.js        endereço do banco (Supabase) e versão
js/db.js            login, banco e envio de arquivos
js/pix.js           código PIX + QR Code
js/ui.js            ajuda de telas, datas, avisos, tamanho da letra
js/views.js         telas: início, agenda, devocional, oferta, oração, perfil...
js/admin.js         painel do administrador
js/app.js           navegação, rádio e instalação
vendor/qrcode.js    gerador de QR Code (funciona sem internet)
icons/              ícones e logo
sql/01-base.sql     banco de dados completo
testes/testar.js    testes automáticos
```

---

## 13. Ideias para as próximas versões

- Escala de louvor e de obreiros (com aviso para quem está escalado).
- Notificações no celular quando sair aviso ou devocional novo.
- Plano de leitura da Bíblia e versículo do dia automático.
- Transmissão ao vivo do culto dentro do app (além da rádio).
- Cadastro de visitantes e acompanhamento de discipulado.
- Relatórios de ofertas por mês e por tipo (dízimo, oferta, missões).
- Área de células/pequenos grupos com endereço e líder.

É só pedir que a gente vai acrescentando. 🙏
