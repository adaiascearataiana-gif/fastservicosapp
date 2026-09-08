# RELATÓRIO DE CORREÇÃO — FAST Serviços 2.3.19
**Problema:** o app "fica na 12" — o usuário não conseguia atualizar de jeito nenhum, mesmo com a 2.3.18 publicada no site.
**Data:** 07/09/2026 23:05 (horário de Brasília) · **Versão de correção:** 2.3.19 (r133)

---

## 1. CAUSA RAIZ (encontrada na busca geral)

O arquivo **`v2-ui.js`** publicado no site (pacote visual "FAST 2.0", carregado em TODA abertura pelo `index.html`) continha a versão **fixa** `VERSION='2.3.12'` no código e, ao executar, **REGRAVAVA a versão do aplicativo em toda parte**:

```javascript
// v2-ui.js antigo (bug):
var VERSION='2.3.12', ...
var meta=document.querySelector('meta[name="fast-app-version"]');
if(meta) meta.content=VERSION;              // ← rebaixa a meta que o verificador lê
var menu=document.getElementById('navMenuVersao');
if(menu) menu.textContent='Versão '+VERSION; // ← menu mostra 2.3.12
var splash=document.getElementById('fastSplashVersion');
if(splash) splash.textContent=VERSION;       // ← splash mostra 2.3.12
var gate=document.getElementById('fastGateVersionNum');
if(gate) gate.textContent=VERSION;           // ← tela de acesso mostra 2.3.12
document.documentElement.dataset.fastVersion=VERSION;
```

### O loop infinito, passo a passo
1. O app aberto reporta versão 2.3.12 (por causa do v2-ui.js).
2. O **Verificar Atualizações** consulta o site, vê `fast-app-version = 2.3.18` online → "nova versão!".
3. O app limpa cache, recarrega, baixa o HTML novo (2.3.18)…
4. …mas o `v2-ui.js` (mesmo arquivo antigo, cacheado ou não-bumpado no servidor) roda de novo e **regrava tudo para 2.3.12**.
5. Resultado: o app Volta a "ficar na 12" — **loop de downgrade que nunca terminava**. A atualização "não pegava de jeito nenhum".

### Causas secundárias (encontradas e corrigidas na mesma varredura)
- **Cabeçalhos CORS quebrados (2.3.12):** a versão 2.3.12 verificava atualização enviando cabeçalhos customizados (`Cache-Control`, `Pragma`), que disparam preflight OPTIONS — o GitHub Pages responde 405 e a detecção de versão falhava fora da origem oficial (Electron `fast://`, arquivo local, outras hospedagens). Corrigido desde a 2.3.14 (r129) via cache-bust por query string; confirmado presente na base 2.3.19.
- **Service Worker externo (sw.js) com cache-first para HTML:** podia servir página antiga mesmo após atualização. O SW raiz servia o HTML do cache enquanto houvesse rede — em redes instáveis o aparelho continuava na versão velha para sempre.
- **Execução da atualização sem limpeza (2.3.12):** o `fastExecutarAtualizacao` da 2.3.12 apenas recarregava a página, sem limpar caches nem desativar o Service Worker. Corrigido desde a 2.3.15/2.3.18; mantido na 2.3.19.
- **Releases do GitHub paradas em v2.3.11:** o app Linux (Electron) atualiza via electron-updater + GitHub Releases. Sem tag/release nova, o desktop nunca atualizava. **A tag `v2.3.19` agora dispara o workflow `release-linux.yml`** (AppImage + DEB + latest-linux.yml).
- **Publicador interno gravando a página viva:** o recurso de sincronização com o GitHub da 2.3.17 commitava o `outerHTML` do DOM (com estilos do Google GIS injetados e labels misturados 2.3.17/2.3.18). A base da 2.3.19 é o **código-fonte limpo** do backup, e a sincronização SHA (r132) foi preservada.

---

## 2. O QUE FOI FEITO (2.3.19)

### Arquivo único — `index.html` (base limpa da 2.3.18 + correções)
| # | Correção | Detalhe |
|---|----------|---------|
| 1 | **Anti-loop no botão Verificar Atualizações** (r133) | Conta tentativas na sessão (`sessionStorage`); acima de 2 tentativas sem sucesso o app **avisa o usuário com alerta claro** em vez de recarregar para sempre (`loopDetectado`). |
| 2 | **Service Worker externo DESATIVADO** | O `index.html` não registra mais `sw.js` — nada de página servida do cache. O `sw.js` publicado virou um **"healer"**: qualquer aparelho com o SW antigo recebe a nova versão dele, ele **apaga todos os caches `fast-*`, assume as abas, recarrega e se auto-desregistra**. |
| 3 | **Bump completo 2.3.19** | Metas (`fast-app-version`, `fast-app-changelog` com nova entrada, `fast-latest-update`, `fast-app-date`), labels visíveis (menu `navMenuVersao`, splash, tela de acesso, painel de novidades), cache-busts `?v=2.3.19`, versão no e-mail de cadastro. |
| 4 | **Sincronização GitHub por SHA preservada (r132)** | A comparação por SHA de blob e o auto-incremento de versão do publicador interno seguem funcionando — a causa do "commit infinito" da 2.3.17 continua corrigida. |

### `v2-ui.js` — correção da CAUSA RAIZ (3 cópias: raiz, `linux/`, `linux/src/renderer/`)
- A versão agora é **lida do próprio HTML** (`meta fast-app-version`) em vez de fixa no pacote.
- **Removida completamente a regravação de versão** (metas, menu, splash, tela de acesso). O pacote visual não toca mais em nada de versão — isso era exatamente o bug do "fica na 12".
- Funcionalidades mantidas: Central Rápida (Ctrl+K), densidade, modo foco, checkpoint de migração, sem duplicação de launcher (r127).

### Mini-apps satélites
- **`motorista.html`**: `2.3.19-motorista` (meta, splash, gate, rodapé, VER) + `ATUAL='2.3.19'` no detector de atualização.
- **`app-cliente/index.html`**: `ATUAL='2.3.19'` no detector.
- **`app-despesas/`, `app-rotas-dia/`, `app-cliente/` — `sw.js`**: todos convertidos em "healer" (mesma lógica de auto-limpeza/desregistro), curando os caches antigos (`fast-despesas-r128`, `fast-rotas-dia-r128`, `cliente-fast-r118`).
- **`manifest.webmanifest`**: campo `version: "2.3.19"` adicionado + descrição atualizada.

### Pacote Linux (desktop Electron)
- `linux/package.json` e `package-lock.json`: versão **2.3.19**.
- `linux/README.md` e `linux/scripts/install.sh`: referências e verificações de integridade atualizadas para 2.3.19 (o grep de verificação pedia `2.3.12`!).
- `linux/src/renderer/index.html`: mesmo build 2.3.19 (auditoria `audit-html.js` OK: 747 IDs únicos, nenhuma credencial exposta).
- **Tag `v2.3.19`** enviada → workflow `release-linux.yml` gera AppImage + DEB + `latest-linux.yml` e publica a Release → **o auto-updater do desktop finalmente desbloqueia**.

### Backups
- `backups/fast-servicos-2.3.19-2026-09-07.html`: cópia integral e verificada (SHA-1 `c6ed27227d5f7e403b5dd03ca6e8d2fff04977a1`).
- `backups/index.html`: card da 2.3.19 no topo da galeria de backups.

---

## 3. VERIFICAÇÕES EXECUTADAS

- **50 blocos `<script>`** do `index.html` 2.3.19: sintaxe validada com `node --check` — **0 erros**.
- **Changelog da meta**: JSON válido após decode de entidades HTML (22 entradas, 2.3.19 no topo).
- **Anti-loop**: funções presentes e integradas ao fluxo manual e ao branch "atualizado".
- **Sem registro de SW** no HTML novo; `sw.js` healer válido (`node --check`).
- **`v2-ui.js`**: sintaxe OK; zero regravações de versão; lê `meta fast-app-version`.
- **Audit do repo** (`audit-html.js`): OK — 747 IDs únicos, nenhuma credencial GitHub/Supabase administrativa exposta, integração Linux presente.
- **Sem token em nenhum arquivo**: varredura com o padrão do audit (`ghp_[A-Za-z0-9]{20,}`, `github_pat_…`) em todos os arquivos alterados — limpo. O token é usado apenas em variável de ambiente do processo de publicação, como manda a regra do próprio app ("nunca gravar o token neste HTML").

---

## 4. COMO O USUÁRIO SENTE A CORREÇÃO

1. **No celular/navegador travado na 2.3.12:** ao abrir, o app detecta 2.3.19 online → atualiza → desta vez **nenhum script rebaixa a versão** → menu/splash mostram 2.3.19. Se por qualquer motivo a atualização não concluir, o botão Verificar Atualizações avisa ("loop detectado") em vez de recarregar para sempre. Se o SW antigo ainda estiver preso, o `sw.js` novo apaga os caches e recarrega a aba sozinho.
2. **No desktop Linux:** o auto-updater encontra a Release v2.3.19 (AppImage/DEB) e atualiza normalmente.
3. **Mini-apps** (Motorista, Cliente, Despesas, Rotas do Dia): detectam a versão nova e seus SWs antigos se auto-curam.

## 5. ARQUIVOS ALTERADOS (commit único em `main`)

`index.html` · `v2-ui.js` · `sw.js` · `motorista.html` · `manifest.webmanifest` · `app-cliente/index.html` · `app-cliente/sw.js` · `app-despesas/sw.js` · `app-rotas-dia/sw.js` · `backups/fast-servicos-2.3.19-2026-09-07.html` · `backups/index.html` · `linux/v2-ui.js` · `linux/package.json` · `linux/package-lock.json` · `linux/README.md` · `linux/scripts/install.sh` · `linux/src/renderer/index.html` · `linux/src/renderer/v2-ui.js` · `linux/src/renderer/sw.js` · `linux/src/renderer/motorista.html` · `linux/src/renderer/manifest.webmanifest` · `linux/src/renderer/app-cliente/index.html` · `linux/src/renderer/app-cliente/sw.js` · `linux/src/renderer/app-despesas/sw.js` · `linux/src/renderer/app-rotas-dia/sw.js` · `RELATORIO_CORRECAO_2.3.19.md`

**Tag:** `v2.3.19` (dispara a Release Linux)
