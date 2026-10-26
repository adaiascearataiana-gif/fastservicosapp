# FAST OS — Modelo B · "Light Executive"

Segundo conceito visual do FAST OS, construído **do zero e isolado nesta pasta**.
Nada do que já existe foi alterado: o app real (`index.html`, `fast-index.html`,
mini-apps) e o **Modelo A** (`prototipo-novo/`) continuam exatamente como estavam.

- **Modelo A** → `prototipo-novo/` · escuro "cockpit", limão ácido, cantos retos
- **Modelo B** → `prototipo-novo-b/` ← esta pasta · claro executivo, azul-marinho + esmeralda

## Como abrir

| Forma | Comando / arquivo |
|---|---|
| Arquivo único (offline, sem dependências) | abra `FAST-OS-modelo-b.html` no navegador |
| Versão com arquivos separados | abra `index.html` ou rode `python3 -m http.server 8090` nesta pasta e acesse `http://localhost:8090` |

Não precisa de build, servidor, login nem banco de dados. Todos os dados são fictícios.

## Linguagem visual (referências Stripe / Linear)

| Elemento | Definição |
|---|---|
| Fundo | off-white `#FAFAF8` com brilho azul e verde muito sutis |
| Cor principal | azul-marinho `#1E3A8A` (navegação ativa, botões primários, gráficos) |
| Acento | esmeralda `#059669` (confirmações, tendências positivas, IA) |
| Cantos | 14–20px nos cards, 11–14px nos controles, pills 999px |
| Sombras | suaves e difusas, várias camadas (`--shadow-card`, `--shadow-lift`, `--shadow-pop`) |
| Fontes | **Manrope** (títulos e números) + **Inter** (texto) — arquivos locais em `fontes/` |
| Ícones | traço estilo **Lucide** (sprite SVG inline, sem biblioteca externa) |
| Contraste | textos em `#0D1726` / `#5E6B7E` sobre superfícies brancas |

Tema escuro alternativo completo (`data-theme="dark"`): mesma estrutura, paleta
noturna com superfícies azuladas — todos os tokens são variáveis CSS em `styles.css`.

## As 6 telas (mesmas do Modelo A)

1. **Painel** — 4 KPIs com sparklines, mapa operacional estilizado (rota animada,
   geocerca, chips de status), feed em tempo real, desempenho semanal e tabela de
   próximas janelas. O seletor **Hoje / Semana / Mês** troca números, subtítulo,
   notas e as barras do gráfico.
2. **Entregas** — filtros por status, busca, tabela completa com avatares e
   paginação; no celular cada linha vira um cartão com rótulos.
3. **Rotas do dia** — faixa de estatísticas, timeline da Rota 03, prévia do mapa
   com economia de combustível/km/tempo e faixa de otimização por IA.
4. **Motoristas** — resumo da equipe e 6 cartões com status, avaliação, pontualidade
   e progresso de jornada.
5. **Clientes** — carteira com receita e último pedido, filtros e gráfico de rosca
   com a composição da base.
6. **Financeiro** — KPIs (receita, despesas, margem, a receber), gráfico
   receita × despesa, despesas por categoria, lançamentos e checklist de fechamento.

## Recursos funcionando (sem backend)

- **Paleta de comandos Ctrl+K** (ou ⌘K): busca, setas ↑↓, Enter, Esc, grupos
  "Navegação" e "Ações", foco preso dentro do diálogo e botão de busca no topo.
- **Alternador de tema** claro/escuro no rodapé da sidebar e no topo no celular,
  com preferência salva em `localStorage` (`proto_fast_b_theme`).
- **Versão mobile** de verdade: sidebar vira barra inferior com 6 destinos, tabelas
  viram cartões, filtros rolam na horizontal, tipografia e espaçamentos reduzidos
  (testado de 320px a 1440px, sem rolagem lateral).
- **Navegação com deep link** (`#painel`, `#entregas`, …), títulos de página,
  `aria-current`, contadores animados em pt-BR e toasts de demonstração.
- **Acessibilidade**: navegação por teclado, `aria-*` nos controles, `aria-hidden`
  na paleta fechada, respeito a `prefers-reduced-motion`.

## Arquivos

```
prototipo-novo-b/
├── index.html            → versão modular (referencia styles.css e app.js)
├── styles.css            → design system completo (tokens + componentes + responsivo)
├── app.js                → navegação, tema, Ctrl+K, contadores, toasts, filtros
├── FAST-OS-modelo-b.html → arquivo único gerado (CSS + JS + fontes embutidos)
├── build.py              → gera o arquivo único a partir dos três arquivos acima
└── fontes/               → Inter e Manrope em woff2 + licenças OFL
```

Para regerar o arquivo único depois de qualquer ajuste:

```bash
python3 prototipo-novo-b/build.py
```

## Publicação (GitHub Pages)

O site do repositório publica a branch `main` na raiz, então:

- Protótipo completo: `https://adaiascearataiana-gif.github.io/fastservicosapp/prototipo-novo-b/`
- Arquivo único: `https://adaiascearataiana-gif.github.io/fastservicosapp/prototipo-novo-b/FAST-OS-modelo-b.html`
- Modelo A (intacto): `https://adaiascearataiana-gif.github.io/fastservicosapp/prototipo-novo/`

## Próximos passos (se o Modelo B for o escolhido)

1. Comparar A e B lado a lado com a equipe e eleger a direção.
2. Componentizar (botão, card, KPI, pill, tabela) a partir de `styles.css`.
3. Portar para o build modular sugerido em `MELHORIAS_E_IDEIAS.md`.
4. Trocar as fixtures pelos dados reais do Supabase, mantendo o app atual intacto
   até a nova interface atingir paridade de funcionalidades.
