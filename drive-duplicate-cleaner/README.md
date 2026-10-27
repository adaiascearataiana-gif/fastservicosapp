# 🗂️ Limpa Duplicadas — Google Drive

App web **100% local (sem backend)** que conecta diretamente no seu Google Drive,
encontra imagens duplicadas e deixa apenas **uma** cópia de cada grupo.

- Funciona no navegador: o token OAuth vai direto do seu navegador para o Google — nenhum servidor de terceiro recebe seus arquivos.
- Três modos de detecção:
  1. **Exatas por hash MD5** (recomendado) — compara o conteúdo real, sem baixar nada.
  2. **Exatas + nome e tamanho iguais** — captura casos sem hash disponível.
  3. **Visualmente parecidas** — baixa miniaturas e usa *difference hash* (dHash) para achar fotos iguais ou quase idênticas (ex.: redimensionadas).
- Por padrão as cópias vão para a **lixeira do Drive** (recuperável). Exclusão permanente só com confirmação extra.
- Você escolhe qual cópia manter (mais antiga, mais recente ou caminho mais curto) e pode revisar grupo por grupo.
- Exporta relatório CSV do que será mantido/removido.
- Funciona com Meu Drive e **drives compartilhados**.

---

## 🚀 Como rodar

### 1. Servir os arquivos

Qualquer servidor estático serve. Com Python (já vem na maioria dos sistemas):

```bash
cd drive-duplicate-cleaner
python3 -m http.server 8000
```

Abra `http://localhost:8000`.

> Não basta abrir o `index.html` pelo `file://`: o Google bloqueia OAuth fora de origens HTTP(S).

### 2. Criar o Client ID OAuth (uma vez, ~3 minutos)

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie um projeto.
2. **APIs e Serviços → Biblioteca** → procure **Google Drive API** → **Ativar**.
3. **APIs e Serviços → Tela de consentimento OAuth**:
   - Tipo de usuário: **Externo**;
   - Preencha nome do app, e-mail de suporte e e-mail de contato;
   - Em **Usuários de teste**, adicione o e-mail Google que vai usar o app.
4. **APIs e Serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**;
   - Em **Origens JavaScript autorizadas**, adicione exatamente a origem onde o app roda, por exemplo:
     - `http://localhost:8000`
     - a URL de preview HTTPS do ambiente, se for o caso (sem barra no final);
   - Não é preciso configurar URIs de redirecionamento (o fluxo é via token, no próprio navegador).
5. Copie o Client ID (termina em `.apps.googleusercontent.com`).

### 3. Usar o app

1. Cole o Client ID na etapa 1 e clique em **Salvar** (fica guardado só no `localStorage` do navegador).
2. Clique em **Conectar com o Google** e autorize o acesso ao Drive.
   - Em modo "teste", o Google mostra uma tela "o app não foi verificado": clique em **Avançado → Ir para (nome do app)**. Isso é normal para apps pessoais.
3. Escolha o escopo (todo o Drive ou uma pasta específica — pode colar o link da pasta) e o modo de detecção.
4. Clique em **Iniciar varredura**, revise os grupos e escolha qual cópia manter.
5. **Mover para a lixeira** (seguro, reversível) ou **Excluir permanentemente** (com confirmação).

---

## 🔒 Segurança e comportamento

| Ação | O que acontece | Dá para desfazer? |
|---|---|---|
| Mover para a lixeira | `PATCH trashed=true` em cada duplicata | ✅ Sim: restaure direto no Google Drive |
| Excluir permanentemente | `DELETE` na API, ignora a lixeira | ❌ Não |
| Varredura | apenas leitura (`list`), nenhuma alteração | — |

O app nunca envia seus arquivos para outro lugar: no modo visual, apenas as **miniaturas públicas geradas pelo próprio Drive** são baixadas para o navegador para calcular o hash perceptual.

## 🧠 Como a detecção funciona

- **MD5**: o Drive já calcula o `md5Checksum` de cada arquivo. Arquivos com o mesmo hash têm conteúdo idêntico, mesmo com nomes diferentes.
- **Nome + tamanho**: grupo de contingência quando o hash não existe (raro para imagens). Vem marcado como "provável" para você revisar.
- **dHash visual**: cada miniatura é reduzida para 9×8 em escala de cinza; comparam-se pixels adjacentes, gerando uma impressão de 64 bits. Duas imagens com distância de Hamming ≤ limiar (5/8/12) entram no mesmo grupo.

## 🗂️ Estrutura

```
drive-duplicate-cleaner/
├── index.html          # interface
├── css/styles.css      # estilos
├── js/
│   ├── config.js       # Client ID (opcional; também pode ser digitado na tela)
│   ├── auth.js         # OAuth 2.0 via Google Identity Services
│   ├── drive-api.js    # wrapper da Drive API v3 (paginação, retry, lixeira)
│   ├── dedup.js        # agrupamento por MD5, nome/tamanho e dHash
│   └── ui.js           # controlador da interface
└── README.md
```

## ⚠️ Limitações conhecidas

- Contas com OAuth em modo de teste: até 100 usuários de teste e tela de "app não verificado" (normal para uso pessoal). Para uso público, é preciso passar pela verificação do Google.
- O modo visual tem custo O(n²) nas comparações de hash; para milhares de imagens a varredura leva mais tempo (há atualização de progresso e botão Parar).
- Arquivos que você não tem permissão para modificar (ex.: itens de drives compartilhados de terceiros) falham na hora da remoção e são marcados como "falhou" no resultado.
