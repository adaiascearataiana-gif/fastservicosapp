# Paridade — Modelo B × app atual

Objetivo: provar que `modelo-b/` **não é uma reimplementação** do FAST, mas o
mesmo app com outra pele. Tudo o que o app atual faz (funções, abas, modais,
apps, login, sincronização) continua sendo executado **pelos mesmos arquivos**.

Legenda: ✅ conferido por script · 🔎 conferido a olho nas capturas · ➖ não se
aplica

## 1. Garantia estrutural (o que o build confere)

A cada `python3 modelo-b/build.py`, para as 6 páginas:

1. o HTML gerado, **removida a injeção**, é comparado com o original e precisa
   ser **idêntico byte a byte** (o build aborta se não for);
2. a lista de scripts do app precisa ser **a mesma**; os únicos scripts extras
   permitidos são `modelo-b/lucide.js` e `modelo-b/skin.js` (e, nos apps,
   `modelo-b/skin-apps.js`);
3. a URL do service worker precisa ser **a mesma**;
4. a skin referenciada (`skin-modelo-b.css`, `skin-apps.css`, `skin.js`,
   `skin-apps.js`, `lucide.js`) precisa existir no disco.

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
<base href="../">                       <!-- apps: <base href="../../<app>/"> -->
<link rel="stylesheet" href="modelo-b/skin-modelo-b.css">
<link rel="stylesheet" href="modelo-b/skin-apps.css">   <!-- só nos apps -->
<script src="modelo-b/lucide.js" defer></script>
<script src="modelo-b/skin.js" defer></script>
<script src="modelo-b/skin-apps.js" defer></script>      <!-- só nos apps -->
```

## 2. Conferência no navegador (26/10/2026, Chromium sem interface)

Mesmo perfil, mesma máquina, `/index.html` × `/modelo-b/index.html`:

| Medida | App atual | Modelo B | Resultado |
|---|---|---|---|
| Funções/objetos globais no `window` | 1.318 | 1.322 | ✅ +4 da skin (`MB_ICONES`, `MB_MAPA_ICONES`, `__mbIcones`, `__mbBadge`) |
| Abas na barra lateral (`[data-pro-tab]`) | 13 | 13 | ✅ |
| `.card`, `.pro-card`, `.fd-card`, `.metric-card` | 64 | 64 | ✅ |
| `.metric-card` | 27 | 27 | ✅ |
| Blocos de modal (`.modal`, `dialog`) | 1 | 1 | ✅ |
| Scripts do app | 17 | 17 | ✅ lista idêntica |
| Scripts extras | — | 2 | ✅ `lucide.js` + `skin.js` |
| Ícones trocados por Lucide | — | 639 | ✅ no carregamento; 648 após alternar as 13 abas |
| `<i>` sólidos sem equivalente Lucide | — | 0 | ✅ (ícones de marca preservados) |
| SVG vazio | — | 0 | ✅ |
| Aba ativa após alternar 13 abas | 1 | 1 | ✅ |
| Erros de página | 0 | 0 | ✅ |

> As requisições falhadas em `file://` são as mesmas nos dois (CDNs, v2-ui.css
> remoto e o Supabase sem rede); não há diferença entre atual e Modelo B.

## 3. As 13 abas do app

Todas apontam para o mesmo `index.html` e para os mesmos scripts. “Visual”
significa: abre, mantém as funções e foi auditada por script (cor + contraste)
e a olho nas capturas de [`prints/`](prints/).

| # | Aba (`data-pro-tab`) | Conteúdo | Funções/dados | Visual | Fora da paleta | Avisos de contraste |
|---|---|---|---|---|---|---|
| 1 | `central` | Ferramentas FAST, KPIs, hero, atenção | ✅ | 🔎 | 0 | 1 (falso positivo: texto claro sobre gradiente) |
| 2 | `rotas` | Lançar/editar rota, WhatsApp, histórico | ✅ | 🔎 | 0 | 0 |
| 3 | `rotasDia` | Execução do dia, fotos, conclusão | ✅ | 🔎 | 0 | 0 |
| 4 | `rastreamento` | Leaflet, motoristas, ETA, geofencing | ✅ | 🔎 | 0 | 0 |
| 5 | `clientes` | Cadastro, busca, letras, tabela, CSV | ✅ | 🔎 | 0 | 0 |
| 6 | `motoristas` | Equipe, acesso, documentos | ✅ | 🔎 | 0 | 0 |
| 7 | `rh` | Indicadores e cadastros de pessoal | ✅ | 🔎 | 0 | 0 |
| 8 | `lugares` | Cadastro e unificação de destinos | ✅ | 🔎 | 0 | 0 |
| 9 | `dashboard` | Indicadores e gráficos (Chart.js) | ✅ | 🔎 | 0 | 0 |
| 10 | `dre` | Resultado financeiro, breakdown | ✅ | 🔎 | 0 | 2 (texto vermelho 18 px, ≥3:1 para texto grande) |
| 11 | `despesas` | Lançamento, voz, anexos, categorias | ✅ | 🔎 | 0 | 0 |
| 12 | `despesasEmpresa` | Despesas por empresa | ✅ | 🔎 | 0 | 0 |
| 13 | `configuracoes` | Integrações, segurança, backup | ✅ | 🔎 | 0 | 1 (falso positivo: botão com fundo em gradiente) |

Resultado global da auditoria: **0 elementos com cor fora da paleta nas 13
abas**; 10 abas sem nenhum aviso de contraste; os 4 avisos restantes são falsos
positivos do medidor (fundo em gradiente) ou texto grande que atende 3:1.

Além das abas: modais (Novo Cliente, Despesa, Rota), a paleta de comandos
(Ctrl+K), o painel de sincronização, o tema e os avisos usam o mesmo código. O
modal “Novo Cliente”, o painel de sincronização e a paleta foram revisados.

## 4. Os 5 apps

Cada app é copiado com `<base href="../../<app>/">`, o que mantém seus scripts,
service worker, manifest e imagens apontando para **os arquivos reais**.

| App | Mesmas funções | Scripts / service worker | Visual |
|---|---|---|---|
| `app-cliente` | ✅ | 3 scripts; não registra SW | ✅ claro, Entrar marinho, ícone real |
| `app-motorista` | ✅ | 5 scripts; `./sw.js?v=r4010` | ✅ acesso claro, ações marinhas |
| `app-rotas-dia` | ✅ | sem scripts; `./sw.js?v=neon4034` | ✅ instalação clara, botão marinho |
| `app-despesas` | ✅ | sem scripts; `./sw.js?v=neon4034` | ✅ instalação clara, botão marinho |
| `app-limpo` | ✅ | sem scripts; `./sw.js?v=r4010` | ✅ instalação clara, botão marinho |

Conferido por script nos 5 apps: 0 erros de página, 0 imagens quebradas
visíveis, fonte `Inter MB` aplicada, `theme-color` `#1E3A8A`. As telas de acesso
foram abertas a olho (prints 13 e 14).

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

Medições por script (cor computada + razão de contraste) nas 13 abas, no login
e nos apps:

| Antes | Depois |
|---|---|
| cabeçalho de tabela `#8B96A7` sobre `#F7F8F4` (2,8:1, 10 px) | `#4A586B` (≈7:1) e cabeçalho `#F3F4EF` |
| textos de apoio `#8B96A7` (2,99:1) | `#5E6B7E` (≈5,4:1) via token `--text-faint` |
| cartão **Total** (Despesas) em violeta `#6D28D9` → azul | marinho `#1E3A8A` → `#2563EB` |
| “Destaque” e “Comando de voz” em violeta/ciano claros | off-white `#F7F8F4` → `#EEF2FB` |
| barras do gráfico de Despesas violeta → ciano | `#2563EB` → `#1E3A8A` |
| selo “VISÃO FINANCEIRA” violeta | marinho |
| ícones de KPI em ciano/violeta | marinho, esmeralda, âmbar e ardósia |
| botão de WhatsApp azul-céu | verde `#059669` → `#047857` |
| botão verde `#16A34A` (ações) | marinho |
| “Versão 5.3.8” branco 42% sobre cartão branco | `#6B7789` |
| botão de biometria branco sobre lilás translúcido | fundo `#EEF2FB`, texto marinho |
| link “Redefinir acesso” lilás claro | marinho |
| painel de sincronização vermelho cobrindo a tela | marinho, raio 18 px, no máximo 78% da altura |
| botão flutuante “raio” branco sobre cinza, parado no meio da tela | marinho no canto inferior direito (volta se o usuário arrastar) |
| paleta Ctrl+K com texto branco em botões claros | folha branca com texto `#0D1726` |
| logo do login do app Cliente era um emoji (virava “tofu”) | ícone real `fast-cliente-512.png` |

Também foi corrigido um efeito colateral da própria skin: ao trocar de aba, o
item anterior do menu continuava com o realce. A pintura agora é reconciliada
(o que deixou de valer é removido na hora), e o app pode reescrever a cor do
painel que a skin repinta.

## 7. Pendências conhecidas (não bloqueiam o uso)

- os ícones sem equivalente Lucide continuam em Font Awesome (de propósito);
- as telas internas escuras de `app-motorista` seguem escuras;
- problemas **pré-existentes**, iguais no app atual: widgets flutuantes que se
  sobrepõem no canto inferior direito, uma caixa branca sobre o cartão “Pedidos
  pagamento”, o `ESC` solto na paleta do celular e o formato de hora nativo
  (`08:00 AM`) seguindo o idioma do aparelho;
- a auditoria de contraste não avalia fundos em gradiente: esses casos foram
  conferidos a olho nas capturas.

## 8. Como repetir a verificação

```bash
# 1. as cópias batem com o app real?
python3 modelo-b/build.py --check     # sai com erro e lista o que estiver velho

# 2. o app atual continua intocado?
git status --short                     # só deve aparecer modelo-b/

# 3. no navegador (manual ou com o harness de captura)
#    abrir /index.html e /modelo-b/index.html e comparar:
#    window — funções globais (1.318 × 1.322), 13 abas, 64 cartões,
#    27 .metric-card, 1 bloco de modal, os 17 scripts do app, 0 erros.
#    No Modelo B: 639 <i> com SVG Lucide e 0 sólidos sem equivalente.
```
