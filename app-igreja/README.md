# ⛪ App da Igreja Batista em Nova Metrópole (IBNM) — versão 1.1

Aplicativo (site instalável no celular) da **Igreja Batista em Nova Metrópole**.
Funciona no Android, iPhone e computador, sem precisar baixar na loja.

**Endereço do app:** `https://adaiascearataiana-gif.github.io/igrejaibnm/`

> Já vem com: login por e-mail e Google, cadastro com data de nascimento e endereço,
> devocional do dia, agenda semanal e mensal, programações, atividades, palavra pastoral,
> pedidos de oração, aniversariantes, oferta por PIX (com QR Code), painel do administrador,
> tamanhos de letra e a **rádio da igreja pronta, mas desligada**.

## 🆕 O que entrou na versão 1.1

| Novidade | Em poucas palavras |
|---|---|
| 🕒 **Data, hora e clima** | Faixa no alto do app com a data completa, a hora com segundos e o clima de Caucaia. Toque nela para ver a previsão do dia. |
| 👑 **ADM principal e ADMs secundários** | O ADM principal escolhe quem cuida de cada parte do app. Cada ADM secundário só mexe no que foi liberado para ele. |
| 📁 **Seções** | O ADM principal cria seções novas (Jovens, Missões, Louvor…). Cada seção tem mural, materiais e fotos. |
| 🎓 **Escola Bíblica Dominical** | Salas, alunos, professores, **chamada**, relatório do domingo, foto do relatório, materiais (PDF, vídeo, link) e fotos. |
| 📝 **Cadastro** | Quem cria a conta já diz se é **aluno(a)** ou **professor(a)** e de qual sala. |
| 🔠 **Letra grande melhor** | Com a letra “Grande” e “Muito grande” os campos ficam um embaixo do outro e nada sai da tela. |

---

## 1. O que já está pronto (não precisa fazer nada)

| Item | Situação |
|---|---|
| Banco de dados da versão 1.0 (tabelas, segurança, regras) | ✅ criado no Supabase (projeto `mmibnm`) |
| Banco de dados da versão 1.1 (seções, ADMs, Escola Bíblica) | ✅ aplicado no Supabase em 15/11/2026 |
| Login com Google | ✅ ativado no Supabase |
| Login por e-mail e senha | ✅ ativado |
| App completo (telas, PIX, QR Code, rádio, Escola Bíblica) | ✅ neste repositório |
| Endereços de retorno do login | ✅ liberados para o GitHub Pages |
| Rádio | ⏸️ pronta e **desligada** — liga quando você quiser |
| Salas da Escola Bíblica | ⏸️ vêm 4 salas de exemplo **ocultas** — você ativa as que a igreja tem |

---

## 2. Primeiros passos (10 minutos)

1. Abra o app no celular.
2. Toque em **Mais › Entrar ou criar conta › Criar conta**.
3. Preencha nome, e-mail, data de nascimento, endereço e senha.
   **A primeira conta criada vira ADMINISTRADOR (ADM principal) automaticamente.**
4. Vá em **Mais › Painel do administrador** e preencha:
   - **⛪ Igreja**: nome, endereço, telefone, WhatsApp, horários dos cultos,
     Instagram e YouTube (links completos, começando com `https://`).
   - **💚 PIX e oferta**: chave PIX, nome do recebedor, cidade e mensagem.
   - **📅 Agenda**: cadastre os cultos fixos (“repete toda semana”) e os eventos com data.
   - **📖 Devocional**: escreva o devocional de hoje e toque em **Publicar**.
   - **💬 Palavra**, **📌 Avisos**: o que quiser mostrar na tela inicial.
5. **Escola Bíblica:** no painel, toque no atalho **🎓 Escola Bíblica Dominical** (abre a gestão)
   e depois em **🏫 Salas**. Edite as salas de exemplo, toque em **Ativar** nas que a igreja tem
   e exclua as outras.
6. **Ajudantes:** em **Painel › 👑 ADMs e seções**, escolha quem vai cuidar de cada parte (veja o item 3).
7. Pronto. Quem entrar depois vê tudo preenchido.

> **Já tinha conta no app do MM (IBNM)?** O login é o mesmo. Se a sua conta não virou ADM,
> rode no Supabase (SQL Editor):
> ```sql
> update public.ibnm_perfis set is_adm = true where email = 'seuemail@gmail.com';
> ```

---

## 3. ADM principal e ADMs secundários

- **ADM principal** = você. Vê e edita tudo, cria seções e escolhe os ajudantes.
- **ADM secundário** = uma pessoa com conta no app que você liberou para cuidar de
  **uma ou mais seções**. Ela só enxerga e só consegue mexer no que você liberou.

### Como liberar uma seção para alguém

1. **Mais › Painel do administrador › 👑 ADMs e seções**.
2. Toque em **➕ Adicionar ADM secundário** e procure a pessoa pelo nome ou e-mail
   (ela precisa já ter criado a conta no app).
3. Ligue as chaves das seções que ela pode editar. **Vale na hora — não tem botão salvar.**
4. Para tirar: desligue a chave. Para tirar tudo de uma vez: **Tirar todos os acessos**
   (o botão pede um segundo toque para confirmar).

Outro caminho: na lista de seções, toque em **ADMs** ao lado da seção para ver e escolher
quem cuida dela.

### O que dá para liberar

| Seção | O que a pessoa passa a fazer |
|---|---|
| ⛪ Dados da igreja | Nome, endereço, horários e redes sociais |
| 💚 PIX e oferta | Chave PIX e tela de oferta |
| 📻 Rádio | Ligar, desligar e configurar a rádio |
| 📖 Devocional · 📅 Agenda · 💬 Palavra · 📌 Avisos | Publicar e editar esse conteúdo |
| 🙏 Pedidos de oração | Ver os pedidos (inclusive os em sigilo) e marcar como atendidos |
| 💰 Ofertas recebidas | Ver os registros, abrir comprovantes e confirmar |
| 👥 Membros | Ver a lista de pessoas e contatos (só o ADM principal edita ou apaga) |
| 🎓 Escola Bíblica Dominical | Gestão completa da Escola Bíblica (item 5) |
| 📁 Seções criadas por você | Mural, materiais e fotos daquela seção (item 4) |

**Só o ADM principal** cria e exclui seções, escolhe ADMs e muda quem é ADM principal.

> 🔒 A permissão é conferida **no banco de dados**, não só na tela. Mesmo que alguém tente
> “dar um jeito” pelo navegador, o banco recusa o que não foi liberado.
> Se você tirar o acesso de alguém que está com o app aberto, a tela dessa pessoa fecha sozinha.

Para ter **mais de um ADM principal**, rode no Supabase (SQL Editor) o mesmo comando do item 2
com o e-mail da outra pessoa. O app não deixa a igreja ficar sem nenhum ADM principal.

---

## 4. Seções (Jovens, Missões, Louvor…)

1. **Painel › 👑 ADMs e seções › ➕ Criar nova seção**.
2. Dê um nome, uma descrição curta e escolha um ícone.
3. A seção ganha uma página própria com três partes:
   - **📌 Mural** — recados com texto, imagem e link (dá para fixar um recado no topo);
   - **📚 Materiais** — PDF ou imagem (enviados do aparelho), vídeo do YouTube, link ou texto;
   - **🖼️ Fotos** — álbum de fotos (o app diminui as fotos antes de enviar, para gastar pouca internet).
4. Depois toque em **ADMs** para escolher quem cuida dela.

- **Atalho na tela inicial:** ligado, a seção aparece em “Ministérios e estudos” logo no início.
  Desligado, ela fica só em **Mais**.
- **Seção ativa:** desligue para esconder dos membros sem apagar nada.
- **Excluir** apaga o mural, os materiais e as fotos da seção para sempre (o app pede confirmação).
- Visitante (sem login) vê o mural e os materiais. **As fotos só aparecem para quem entrou no app.**

---

## 5. Escola Bíblica Dominical

Fica em **Início › Escola Bíblica Dominical** (ou em **Mais**).

### 5.1 Quem cuida da Escola Bíblica (ADM da seção “Escola Bíblica”)

Toque em **Gestão da Escola Bíblica**. São quatro abas:

- **📊 Domingo** — o relatório geral do dia: presentes, ausentes, visitantes, Bíblias,
  revistas e oferta de cada sala e o total. Botão **Enviar relatório geral (WhatsApp)** e
  espaço para a **foto do relatório geral**.
- **🏫 Salas** — criar, editar, ocultar/ativar e excluir salas.
- **👩‍🏫 Professores** — aprovar ou recusar quem pediu para ser professor(a) e definir
  professores procurando pelo nome.
- **⚙️ Dados** — dia e horário, tema do trimestre, revista e mensagem de boas-vindas.

### 5.2 Professor(a)

Abre a própria sala e vê:

- **📋 Chamada** — marque quem veio (ou **Marcar todos**), informe visitantes, Bíblias,
  revistas, oferta e o tema da aula e toque em **Salvar**. Dá para corrigir depois e para
  lançar a chamada de outro dia. Se a internet cair, **as marcações ficam guardadas no
  aparelho** até você salvar. Depois de salvar aparecem os botões **Enviar resumo (WhatsApp)**
  e **Enviar foto do relatório**.
- **👥 Alunos** — lista com aniversário, WhatsApp e presença no trimestre. O botão
  **Adicionar aluno** serve para crianças e pessoas **sem conta no app**.
- **📷 Relatórios** — fotos da caderneta/relatório. **São privadas:** só o(a) professor(a)
  da sala e quem cuida da Escola Bíblica conseguem abrir.
- **📚 Materiais** e **🖼️ Fotos** da sala.

### 5.3 Aluno(a)

- No **cadastro**, a pessoa escolhe “Sou aluno(a)” e a sala. Entra na hora.
- Quem já tem conta: **Escola Bíblica › Quero participar**.
- Na sala, o aluno vê os materiais, as fotos e a aba **✅ Frequência** (as próprias presenças).
- Pode **sair** ou **trocar de sala** quando quiser (o histórico fica guardado).

### 5.4 Quem pediu para ser professor(a)

Fica “em análise” até alguém da gestão aprovar na aba **Professores**. Enquanto isso não
faz chamada nem vê a lista de alunos.

### 5.5 Quem vê o quê (privacidade)

| Informação | Quem vê |
|---|---|
| Salas, materiais e mural | Todos (até sem login) |
| Fotos | Só quem entrou no app |
| Lista de alunos, telefone e aniversário | Professor(a) da sala e gestão da Escola Bíblica |
| Chamada e números do domingo | Professor(a) da sala e gestão; o aluno vê só a própria presença |
| Foto do relatório | Professor(a) da sala e gestão |

---

## 6. Data, hora e clima (faixa de cima)

- Mostra a **data por extenso**, a **hora com segundos** (a do próprio aparelho) e o **clima**.
- Toque na faixa para ver sensação térmica, máxima e mínima, chance de chuva, umidade e vento.
- Ao rolar a tela para baixo a faixa encolhe (ficam só data, hora e clima) para sobrar espaço.
- O clima vem do **Open-Meteo**, serviço gratuito que não pede cadastro. Atualiza a cada
  20 minutos. Sem internet, o app mostra o último clima por até 3 horas.
- A cidade é Caucaia/CE. Para mudar, edite `CLIMA` (latitude, longitude e nome da cidade)
  no arquivo `js/config.js`.

---

## 7. Como ligar a rádio (quando você mandar)

1. Entre como administrador → **Painel → 📻 Rádio**.
2. Cole o **link do áudio** da rádio (ex.: `https://servidor.com:8000/radio.mp3`).
3. Nome, imagem da capa (link) e mensagem (opcional).
4. Ligue a chave **“Rádio da igreja ligada”** e toque em **Salvar**.
5. No mesmo instante aparece um player em todas as telas do app, com botão de play.
6. Para desligar depois: desligue a mesma chave.

O player toca o link direto (Icecast/Shoutcast, `.mp3`, `.m3u8`). Não precisa mexer no código.

---

## 8. Oferta por PIX

- O QR Code é **gerado no próprio celular**, sem serviço externo, e já sai com o valor escolhido.
- Quem oferta pode copiar o **código PIX** (botão “Copiar código PIX”).
- O membro logado pode **registrar a oferta** e **enviar o comprovante** (foto/PDF).
  O comprovante fica em pasta privada: só a pessoa e quem cuida das ofertas conseguem abrir.
- No painel **💰 Ofertas** você vê os valores, confirma o recebimento e abre o comprovante.
- **Importante:** o app não processa pagamento. O dinheiro cai direto na conta da igreja
  pela chave PIX cadastrada.

💡 Dica: imprima o QR Code da tela do painel e cole no mural da igreja.

---

## 9. Tamanhos de letra (para quem tem dificuldade)

- Botão **“A”** no topo da tela, ou **Mais › Tamanho da letra**.
- São 4 tamanhos: Pequeno, Normal, Grande e Muito grande.
- A escolha fica salva no aparelho da pessoa (não afeta os outros).
- Todo o app usa letras grandes, botões altos e linguagem simples.
- Quando há mais abas do que cabe na tela, a ponta da faixa fica “esfumada”:
  é só arrastar para o lado.
- Existe também a tela **Mais › Como usar o app**, com passo a passo.

---

## 10. Instalar no celular

- **Android (Chrome):** menu **⋮ › Adicionar à tela inicial** (ou o botão “Instalar” que aparece no app).
- **iPhone (Safari):** botão **Compartilhar › Adicionar à Tela de Início**.
- Depois de instalado, abre como um aplicativo normal, com ícone próprio.
- Funciona **sem internet** para o que já foi aberto (devocional, agenda, salas…).

---

## 11. Banco de dados (Supabase)

Projeto usado: **mmibnm** — `https://whtbzermbyuxicswyvsy.supabase.co`

São dois arquivos, nesta ordem (os dois podem rodar quantas vezes quiser, não apagam dados):

1. **`sql/01-base.sql`** — versão 1.0 (perfis, igreja, devocional, agenda, palavra, avisos,
   orações, ofertas).
2. **`sql/02-secoes-ebd.sql`** — versão 1.1 (seções, ADMs secundários, Escola Bíblica).

> No projeto atual **os dois já foram aplicados**. Só rode de novo se um dia trocar de projeto:
> Supabase → SQL Editor → New query → cole o arquivo → Run.
> ⚠️ Se rodar o `01` de novo, rode o `02` em seguida (o `01` recria as regras da versão 1.0).

- Tabelas da 1.0: `ibnm_perfis`, `ibnm_config`, `ibnm_devocionais`, `ibnm_eventos`,
  `ibnm_palavras`, `ibnm_avisos`, `ibnm_oracoes`, `ibnm_ofertas`.
- Tabelas da 1.1: `ibnm_secoes`, `ibnm_secao_adms`, `ibnm_secao_posts`, `ibnm_secao_materiais`,
  `ibnm_secao_fotos`, `ibnm_ebd_salas`, `ibnm_ebd_matriculas`, `ibnm_ebd_aulas`,
  `ibnm_ebd_presencas`, `ibnm_ebd_relatorios`.
- Todas com segurança por linha (RLS). Tudo começa com `ibnm_` para não misturar com o app do MM.
- Pastas de arquivos:
  - `igreja` (privada): `comprovantes/…` (ofertas) e `ebd/relatorios/…` (foto do relatório);
  - `igreja-publico`: `secoes/…` (fotos e imagens das seções) e imagens do painel.
- Funções principais: `ibnm_is_adm()`, `ibnm_tem_secao('chave')`, `ibnm_meu_acesso()`,
  `ibnm_ebd_matricular()`, `ibnm_ebd_salvar_chamada()`, `ibnm_ebd_resumo()`, `ibnm_aniversariantes(mês)`.

**Se o `02` não tiver sido aplicado**, o app novo não quebra: ele funciona como a versão 1.0
(as seções e a Escola Bíblica simplesmente não aparecem).

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

> No projeto atual isso **já está feito**. O login por e-mail funciona sempre, mesmo sem Google.

---

## 12. Comandos — TERMUX (Android)

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

## 13. Comandos — Linux (terminal do computador)

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

## 14. Publicar / atualizar o app

O GitHub Pages publica sozinho o que está na branch `main` do repositório `igrejaibnm`.
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

> **Mudou algum arquivo do app?** Aumente o número da versão nos três lugares, para os
> celulares pegarem a novidade: `VERSAO` em `js/config.js`, `VERSAO` em `sw.js` e os
> `?v=...` do `index.html`. O teste automático confere se os três estão iguais.

---

## 15. Testar sem publicar

Nada disso encosta no banco de verdade da igreja.

```bash
ibnm
npm install --no-save jsdom embedded-postgres    # só na primeira vez (computador)

node testes/testar.js                 # telas do app (mais de 140 conferências)
node testes/local/testar-banco.js     # regras de permissão do banco (mais de 170 conferências)
node testes/local/servidor.js --demo  # app completo em http://localhost:8080
```

- **`testes/testar.js`** — abre o app sem navegador e confere: PIX e QR Code, visitante,
  painel do ADM principal (11 abas), tamanhos de letra, faixa de data/hora/clima, seções,
  ADM secundário, Escola Bíblica (aluna, professora e gestão), banco ainda na versão 1.0
  e os arquivos do modo sem internet. Precisa só do `jsdom` (funciona no Termux).
- **`testes/local/testar-banco.js`** — sobe um PostgreSQL de verdade, temporário, aplica os
  arquivos da pasta `sql/` e tenta fazer o que **não** pode (ADM secundário mexendo em outra
  seção, professor vendo outra sala, visitante abrindo foto de relatório…). Precisa do
  `embedded-postgres`, que só funciona em computador (Linux, Mac ou Windows), não no Termux.
- **`testes/local/servidor.js --demo`** — o app inteiro funcionando com um banco de mentira
  (também só em computador), já com salas, alunos, chamadas, materiais e fotos de exemplo.
  Bom para treinar a equipe sem medo de estragar nada. O que for feito ali some quando o
  servidor é desligado. Contas de exemplo (senha de todas: `123456`):

| Conta | Papel |
|---|---|
| `adaias@teste.com` | ADM principal |
| `sara@teste.com` | ADM secundária de Agenda e Avisos |
| `edu@teste.com` | ADM da Escola Bíblica (e professor de Adultos) |
| `julia@teste.com` | ADM das seções Missões e Louvor |
| `paula@teste.com` | Professora da sala Jovens |
| `ana@teste.com` | Aluna da sala Jovens |
| `pedro@teste.com` | Pediu para ser professor (aguardando) |
| `marcos@teste.com` | Membro comum, aluno de Adultos |

Outra porta: `PORTA=9000 node testes/local/servidor.js --demo`.
Banco de teste em outra porta: `PORTA_BANCO=54400 node testes/local/testar-banco.js`.

---

## 16. Arquivos do app

```
index.html              tela e estrutura
css/app.css             aparência (cores, letras, botões)
js/config.js            endereço do banco (Supabase), versão e cidade do clima
js/db.js                login, banco, permissões e envio de arquivos
js/pix.js               código PIX + QR Code
js/ui.js                ajuda de telas, datas, avisos, tamanho da letra
js/views.js             telas: início, agenda, devocional, oferta, oração, perfil...
js/secoes.js            seções: mural, materiais e fotos
js/ebd.js               Escola Bíblica: salas, alunos, chamada, relatórios e gestão
js/admin.js             painel do administrador, ADMs e seções
js/topo.js              faixa de cima: data, hora e clima
js/app.js               navegação, rádio e instalação
sw.js                   funcionamento sem internet
vendor/qrcode.js        gerador de QR Code (funciona sem internet)
icons/                  ícones e logo
sql/01-base.sql         banco de dados — versão 1.0
sql/02-secoes-ebd.sql   banco de dados — versão 1.1
testes/testar.js        teste automático das telas
testes/local/           banco e servidor de mentira para testar e demonstrar
```

---

## 17. Ideias para as próximas versões

- **Avisos no celular (notificações)** quando sair devocional, aviso ou material novo.
- **Aniversariantes da sala** e lembrete para o(a) professor(a) (“fulano faltou 3 domingos”).
- **Relatório do trimestre em PDF** da Escola Bíblica (frequência por sala e por aluno).
- **Lição da semana** com perguntas e espaço para o aluno marcar “já li”.
- **Escala** de louvor, recepção e obreiros, com aviso para quem está escalado.
- **Visitantes:** ficha rápida na chamada (nome e WhatsApp) para a igreja entrar em contato.
- **Células / pequenos grupos** usando as mesmas seções (endereço, líder e presença).
- **Relatórios de ofertas** por mês e por tipo (dízimo, oferta, missões).
- **Transmissão ao vivo** do culto dentro do app (além da rádio).
- **Plano de leitura da Bíblia** e versículo do dia automático.
- **Cidade do clima** escolhida pelo painel (hoje fica em `js/config.js`).

É só pedir que a gente vai acrescentando. 🙏
