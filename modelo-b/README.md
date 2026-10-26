# Modelo B no app real

Esta pasta é o **app FAST inteiro** — as mesmas telas, as mesmas funções, a mesma
sincronização e os mesmos apps — com o **visual Modelo B** (claro, executivo,
azul-marinho + verde esmeralda).

O app atual continua intacto em `../`. Nada foi apagado, substituído ou movido.

| | Endereço |
|---|---|
| **Visual atual** (intacto) | `https://adaiascearataiana-gif.github.io/fastservicosapp/` |
| **Modelo B** | `https://adaiascearataiana-gif.github.io/fastservicosapp/modelo-b/` |
| Apps do Modelo B | `.../modelo-b/app-cliente/`, `app-motorista/`, `app-rotas-dia/`, `app-despesas/`, `app-limpo/` |

> **Importante:** os arquivos `index.html` desta pasta são **gerados**. Não edite
> à mão. Para mudar o visual, edite `skin-modelo-b.css` / `skin.js`; para trazer
> qualquer alteração feita no app real, rode o build de novo (§ *Como atualizar*).

## Como é possível “usar tudo” sem reescrever nada

`modelo-b/index.html` é uma **cópia byte a byte do `index.html` real**, com duas
injeções:

1. `<base href="../">` — todos os 17 scripts, o `fast-sw.js`, o manifest, as
   imagens e os apps continuam carregando **os arquivos reais da raiz**;
2. a skin (`skin-modelo-b.css` + `skin.js`) logo antes de `</head>`.

Por isso as funções, a sincronização em tempo real, a fila offline, o login no
Supabase, os 13 menus e os 5 apps são **os mesmos arquivos** — não uma cópia que
pode ficar diferente. Os apps recebem `../../<app>/` como base e uma skin leve.
O `build.py` confere isso a cada geração (ver `PARIDADE.md`).

## O que muda no visual

- fundo `#FAFAF8`, cartões brancos, bordas `#E9E9E2`, cantos de 14–20 px;
- azul-marinho `#1E3A8A` como cor principal e verde esmeralda `#059669` de apoio;
- fontes **Inter** e **Manrope** (locais, em `fontes/`, com licença OFL);
- login claro, cartão branco e botão **CONFIRMAR azul-marinho**;
- menu lateral branco, item ativo em azul-marinho com barra à esquerda;
- cabeçalho claro, busca e pílulas brancas, cartão do usuário claro;
- cartão “Boa tarde…” em gradiente azul-marinho;
- cabeçalhos de tabela legíveis (eram cinza-claro), cartão **Total** de Despesas
  em azul-marinho, blocos “Destaque” e “Comando de voz” claros;
- painel de sincronização/erros em azul-marinho (só aparece quando falta login ou
  há erro — o vermelho continua nos textos e ícones de alerta);
- botão flutuante de atalhos (raio) em azul-marinho, antes quase invisível.

Capturas em [`prints/`](prints/): login, Centro de Operações, Rotas, Clientes,
Despesas, Motoristas, Configurações, celular (390 px) e apps.

## O que **não** muda

- os 17 scripts do app e o service worker (`fast-sw.js`, versão 4.0.24);
- sincronização `realtime:fast-sync-db` (`rotas`, `despesas`,
  `sequencias_itens`, `destinos`, `clientes`), fila offline e resolução de
  conflitos;
- login/Supabase (`fast_supa_session`), Google Drive das fotos, backups;
- dados, permissões, textos, validações e fluxos;
- os 5 apps e seus service workers (quando o app registra um);
- o app atual em `/` — nenhum arquivo dele foi alterado.

A única chave nova no navegador é `fast_modelo_b` (o selo “visual atual” grava
`off` nela; para voltar ao Modelo B, limpe a chave ou use a URL normal).

## Como atualizar (depois de mexer no app real)

```bash
python3 modelo-b/build.py            # regenera as cópias
python3 modelo-b/build.py --check    # só confere; sai com erro se estiver velho
```

O build:

- lê `index.html` e os 5 `app-*/index.html` **sem alterá-los**;
- injeta `<base>` e a skin;
- **remove a injeção e compara** com o original (precisa bater byte a byte);
- confere que nenhum script do app mudou de endereço e que o service worker é o
  mesmo;
- grava `build-info.json` com o SHA-256 de cada origem e a lista de scripts.

## Arquivos

| Arquivo | Papel |
|---|---|
| `build.py` | gerador + conferência (não altera o app real) |
| `skin-modelo-b.css` | visual do app principal (tokens, login, menu, cabeçalho, tabelas, contraste) |
| `skin.js` | liga a skin, pinta o que o app define por JS e mostra o selo |
| `skin-apps.css` | toque leve nos 5 apps: fontes, raio, foco, impressão |
| `fontes/` | Inter e Manrope (woff2) + licenças OFL |
| `prints/` | capturas usadas nesta documentação |
| `index.html`, `app-*/index.html` | **gerados** — não editar |
| `build-info.json` | **gerado** — origem, SHA, tamanho e scripts |

## Limites desta fase (Fase 1)

- os ícones continuam sendo Font Awesome (208 ícones distintos, 806 usos). A
  troca para ícones de traço (Lucide) é a Fase 2, para não quebrar nenhum botão;
- os 5 apps mantêm o visual próprio; por enquanto recebem só fonte, raio, foco e
  impressão. O visual novo dos apps é a Fase 2;
- o visual foi revisado tela a tela em Centro de Operações, Rotas, Clientes,
  Despesas, Motoristas e Configurações, além de modais e do celular. As demais
  abas usam os mesmos componentes (cartões, tabelas, formulários) e a mesma skin,
  mas ainda não tiveram revisão visual individual — checklist em `PARIDADE.md`;
- problemas que **já existem no app atual** (não são da skin): ícones quebrados
  em `assets/` de alguns apps e uma lista branca sobre branco na paleta do
  celular em tema claro.

## Próximas fases

- **Fase 2** — revisão tela a tela das 13 abas + 5 apps, ícones Lucide, ajustes
  finos de tabelas, formulários e modais;
- **Fase 3** — teste de sincronização: criar offline → reconectar → conferir
  duplicidade, duas abas abertas, conflito de edição, atualização do service
  worker.

A paridade atual está documentada em [`PARIDADE.md`](PARIDADE.md).
