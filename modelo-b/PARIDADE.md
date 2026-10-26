# Paridade — Modelo B × app atual

Objetivo: provar que `modelo-b/` **não é uma reimplementação** do FAST, mas o
mesmo app com outra pele. Tudo o que o app atual faz (funções, abas, modais,
apps, login, sincronização) continua sendo executado **pelos mesmos arquivos**.

Legenda: ✅ conferido · 🔎 revisão visual feita · 👁 ainda não revisado a olho
(usa os mesmos componentes da skin) · ➖ não se aplica

## 1. Garantia estrutural (o que o build confere)

A cada `python3 modelo-b/build.py`, para as 6 páginas:

1. o HTML gerado, **removida a injeção**, é comparado com o original e precisa
   ser **idêntico byte a byte** (o build aborta se não for);
2. a lista de scripts do app precisa ser **a mesma**; o único script extra
   permitido é `modelo-b/skin.js` (e só na página principal);
3. a URL do service worker precisa ser **a mesma**;
4. a skin referenciada precisa existir no disco.

`build-info.json` guarda o SHA-256 (12 primeiros caracteres) de cada origem:

| Página | Origem | SHA da origem | Tamanho gerado |
|---|---|---|---|
| `modelo-b/index.html` | `index.html` | `e1b07a334b60` | 3.024 KB |
| `modelo-b/app-cliente/index.html` | `app-cliente/index.html` | `e36db916bfc6` | 220 KB |
| `modelo-b/app-motorista/index.html` | `app-motorista/index.html` | `55a48e8481e7` | 166 KB |
| `modelo-b/app-rotas-dia/index.html` | `app-rotas-dia/index.html` | `2449ca5aa143` | 6 KB |
| `modelo-b/app-despesas/index.html` | `app-despesas/index.html` | `11331196a655` | 9 KB |
| `modelo-b/app-limpo/index.html` | `app-limpo/index.html` | `a636297576d6` | 4 KB |

O que a cópia injeta, e só isso:

```html
<base href="../">                  <!-- apps: <base href="../../<app>/"> -->
<link rel="stylesheet" href="modelo-b/skin-modelo-b.css">
<script src="modelo-b/skin.js" defer></script>
```

## 2. Conferência no navegador (26/10/2026, Chromium sem interface)

Mesmo perfil, mesma máquina, `/index.html` × `/modelo-b/index.html`:

| Medida | App atual | Modelo B | Resultado |
|---|---|---|---|
| Funções globais no `window` | 1.040 | 1.040 | ✅ iguais |
| `.tab-content` | 13 | 13 | ✅ |
| Botões do menu lateral | 13 | 13 | ✅ |
| `.card` | 32 | 32 | ✅ |
| `.metric-card` | 27 | 27 | ✅ |
| Blocos de modal no DOM | 14 | 14 | ✅ |
| Scripts carregados | 17 | 18 | ✅ +`skin.js` |
| Service worker ativo | sim | sim | ✅ |
| Erros de página | 0 | 0 | ✅ |
| Pedidos de arquivo falhados (`file://`) | 0 | 0 | ✅ |
| Chaves de `localStorage` (perfil novo) | 27 | 30 | ✅ +`fast_modelo_b` e 2 chaves criadas na sessão |
| Imagens quebradas | 1 (`src` vazio, já existia) | a mesma | ✅ |

> As chaves variam conforme o uso (login, Drive, tema). O importante é que a
> skin cria **uma** chave própria e não reescreve nenhuma do app.

## 3. As 13 abas do app

Todas apontam para o mesmo `index.html` e para os mesmos scripts. A coluna
“visual” diz onde houve revisão a olho nesta fase.

| # | Aba (`data-pro-tab`) | Conteúdo | Funções/dados | Visual |
|---|---|---|---|---|
| 1 | `central` — Centro de Operações | Ferramentas FAST, KPIs, hero, atenção | ✅ iguais | 🔎 |
| 2 | `rotas` — Rotas e Serviços | Lançar/editar rota, WhatsApp, histórico, pré-visualização | ✅ iguais | 🔎 |
| 3 | `rotasDia` — Rotas do Dia | Execução do dia, fotos, conclusão | ✅ iguais | 👁 |
| 4 | `rastreamento` — Mapa & Rastreamento | Leaflet, motoristas, ETA, geofencing | ✅ iguais | 👁 |
| 5 | `clientes` — Clientes | Cadastro, busca, letras, tabela, CSV | ✅ iguais | 🔎 |
| 6 | `motoristas` — Motoristas | Equipe, acesso, documentos | ✅ iguais | 🔎 |
| 7 | `rh` — RH | Indicadores e cadastros de pessoal | ✅ iguais | 👁 |
| 8 | `lugares` — Lugares/Destinos | Cadastro e unificação de destinos | ✅ iguais | 👁 |
| 9 | `dashboard` — Dashboard | Indicadores e gráficos (Chart.js) | ✅ iguais | 👁 |
| 10 | `dre` — DRE | Resultado financeiro, breakdown | ✅ iguais | 👁 |
| 11 | `despesas` — Despesas | Lançamento, voz, anexos, categorias | ✅ iguais | 🔎 |
| 12 | `despesasEmpresa` — Despesas da Empresa | Despesas por empresa | ✅ iguais | 👁 |
| 13 | `configuracoes` — Configurações | Integrações, segurança, backup | ✅ iguais | 🔎 |

Além das abas: 14 blocos de modal, a paleta de comandos (Ctrl+K), o painel de
sincronização, o tema claro/escuro e os avisos usam o mesmo código. O modal
“Novo Cliente” e o painel de sincronização foram abertos e revisados a olho.

## 4. Os 5 apps

Cada app é copiado com `<base href="../../<app>/">`, o que mantém seus scripts,
service worker, manifest e imagens apontando para **os arquivos reais**.

| App | Mesmas funções | Scripts / service worker | Visual |
|---|---|---|---|
| `app-cliente` | ✅ | 3 scripts; não registra SW (só remove registros antigos) | fonte + raio + foco |
| `app-motorista` | ✅ | 5 scripts; `./sw.js?v=r4010` | fonte + raio + foco |
| `app-rotas-dia` | ✅ | sem scripts; `./sw.js?v=neon4034` | fonte + raio + foco |
| `app-despesas` | ✅ | sem scripts; `./sw.js?v=neon4034` | fonte + raio + foco |
| `app-limpo` | ✅ | sem scripts; `./sw.js?v=r4010` | fonte + raio + foco |

Os apps **não** recebem o layout novo nesta fase (ver “Limites” no README).

## 5. Sincronização e dados — nada foi tocado

| Ponto | Situação no Modelo B |
|---|---|
| Supabase (`https://yhxuplhohhetzloxvgku.supabase.co`) | mesma URL, mesmas chaves, mesmo `supabaseHeaders` |
| Tempo real `realtime:fast-sync-db` | mesmo canal e mesmas tabelas (`rotas`, `despesas`, `sequencias_itens`, `destinos`, `clientes`) |
| `TABS_RT` (`rotas`, `despesas`, `sequencias_itens`) | inalterado |
| Fila offline / IndexedDB | inalterada |
| Sessão (`fast_supa_session`), renovação de token | inalterada |
| Google Drive das fotos | inalterado |
| Backups e `updates.json` | inalterados |
| `fast-sw.js` (4.0.24) e cache | mesma URL e mesmo registro (`scope: './'`) |
| App atual em `/` | nenhum arquivo alterado (`git status` só mostra `modelo-b/`) |

O registro do service worker na cópia resolve para o **mesmo** `fast-sw.js` da
raiz por causa do `<base href="../">`; o `build.py` compara e aborta se a URL
mudar. É por isso que a sincronização é a mesma: o código é o mesmo arquivo.

## 6. Auditoria visual do que foi corrigido

Medições feitas por script (cor computada + razão de contraste) nas abas
Clientes, Rotas, Despesas e no login:

| Antes | Depois |
|---|---|
| cabeçalho de tabela `#8B96A7` sobre `#F7F8F4` (2,8:1, 10 px) | `#4A586B` (≈7:1) e cabeçalho `#F3F4EF` |
| cartão **Total** (Despesas) em violeta `#6D28D9` → azul | azul-marinho `#1E3A8A` → `#2563EB` |
| “Destaque” e “Comando de voz” em violeta/ciano claros | off-white `#F7F8F4` → `#EEF2FB`, borda `#E3E6DC` |
| selo “VISÃO FINANCEIRA” violeta | azul-marinho |
| ícones de KPI em ciano/violeta | azul-marinho, esmeralda, âmbar e ardósia |
| “Versão 5.3.8” branco 42% sobre cartão branco | `#6B7789` |
| botão de biometria branco sobre lilás translúcido | fundo `#EEF2FB`, texto azul-marinho |
| link “Redefinir acesso” lilás claro | azul-marinho |
| painel de sincronização vermelho cobrindo a tela | azul-marinho, raio 18 px, no máximo 78% da altura |
| botão flutuante “raio” branco sobre cinza | azul-marinho com ícone branco |

Também foi corrigido um efeito colateral da própria skin: ao trocar de aba, o
item anterior do menu continuava com o realce. A pintura agora é reconciliada
(o que deixou de valer é removido na hora), e o app pode reescrever a cor do
painel que a skin repinta.

## 7. Pendências conhecidas (não bloqueiam o uso)

- revisão a olho das abas 4, 7, 8, 9, 10 e 12 — usam os mesmos componentes, mas
  ainda não foram capturadas uma a uma;
- ícones continuam em Font Awesome (troca para Lucide na Fase 2);
- apps com visual próprio (só fonte/raio/foco nesta fase);
- problemas **pré-existentes**, iguais no app atual: imagens `assets/app-*.png`
  que não existem em `app-motorista`/`app-rotas-dia`/`app-despesas`, um `<img>`
  com `src` vazio na página principal e a lista da paleta do celular em branco
  sobre branco no tema claro.

## 8. Como repetir a verificação

```bash
# 1. as cópias batem com o app real?
python3 modelo-b/build.py --check     # sai com erro e lista o que estiver velho

# 2. o app atual continua intocado?
git status --short                     # só deve aparecer modelo-b/

# 3. no navegador (manual ou com o harness de captura)
#    abrir /index.html e /modelo-b/index.html e comparar:
#    window — funções globais (1.040), .tab-content (13), .card (32),
#    .metric-card (27), blocos de modal (14), service worker ativo, erros (0).
```
