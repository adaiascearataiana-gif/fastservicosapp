# FAST//OS — Protótipo de plataforma nova

Conceito visual **totalmente novo**, construído do zero e isolado nesta pasta.
O app real (`index.html`, `fast-index.html`, mini-apps etc.) **não foi tocado** —
dá para abrir os dois lado a lado e comparar.

## Como abrir

- Servidor local: na pasta `prototipo-novo/`, rode `python3 -m http.server 8090`
  e acesse `http://localhost:8090`
- Ou simplesmente abra o `index.html` no navegador (não precisa de build nem backend)

## O que mudou — comparação direta

| Elemento | App atual | Protótipo novo |
|---|---|---|
| Tema padrão | Claro, fundo branco/ciano | Escuro "cockpit" (com tema claro alternável) |
| Cor principal | Azul/ciano `#0891b2`/`#2563eb` em gradientes | Verde-limão ácido `#CBF235`, cor chapada, sem gradiente |
| Cantos | Arredondados 9–15px, pills 999px | Quase retos: 2–4px |
| Sombras | Suaves e desfocadas | Sombra dura deslocada (estilo neo-brutalista) |
| Fontes | Inter / Arial | **Space Grotesk** (títulos e números) + **IBM Plex Sans** (texto) + **IBM Plex Mono** (dados e etiquetas) |
| Labels | Texto normal | Etiquetas MAIÚSCULAS mono com letter-spacing e numeração (`01 / Painel`) |
| Layout | Sidebar + tabelas convencionais | Grid **bento** assimétrico, mapa operacional e feed em tempo real |
| Botões | Gradientes arredondados | Chapados, retos, com deslocamento no hover (`translate` + sombra 4px) |
| Mobile | Tabelas com scroll | Tabelas viram cartões + bottom nav próprio |
| Busca | Campos tradicionais | Paleta de comandos **Ctrl+K** estilo command-palette |

## Recursos do protótipo (todos funcionando, sem backend)

1. **6 telas** navegáveis: Painel, Entregas, Rotas do dia, Motoristas, Clientes, Financeiro
2. **Tema escuro/claro** alternável (persiste no `localStorage` em chave própria `proto_fast_theme`)
3. **Paleta de comandos Ctrl+K** com navegação por teclado (setas, Enter, Esc)
4. **KPIs com contadores animados**, medidores e gráficos de barras em CSS puro
5. **Mapa operacional estilizado** em SVG com rota animada (tracejado em movimento) e geocercas
6. **Timeline de rota** com etapas, otimização sugerida e economia calculada
7. **Tabelas responsivas** que viram cartões empilhados no celular
8. **Relógio ao vivo**, toasts de demonstração e estados de status com pills coloridas
9 Dados 100% fictícios, nenhuma chamada externa além das fontes do Google

## Design tokens (em `styles.css`)

- `--accent: #CBF235` (limão) · secundárias: violeta `#9A8CFF`, âmbar `#FFB020`, vermelho `#FF6A55`, ciano `#5FE3D0`
- Tudo derivado de variáveis CSS: trocar a identidade inteira = trocar ~15 variáveis no `:root`
- Fundo com grade "blueprint" sutil + camada de ruído para dar textura

## Caminho de evolução (se aprovar o conceito)

1. Validar a linguagem visual com a equipe e escolher 1–2 telas para refinar
2. Componentizar (botões, pills, cards, tabelas) e portar para dentro do build modular sugerido no `MELHORIAS_E_IDEIAS.md`
3. Conectar com os dados reais (Supabase) substituindo as fixtures deste protótipo
4. Manter o app atual intacto até o novo atingir paridade de funcionalidades
