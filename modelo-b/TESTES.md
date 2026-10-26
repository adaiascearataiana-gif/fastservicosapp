# Testes de sincronização, layout e transições

Rodados em 26/10/2026 sobre o Modelo B **e sobre o app atual**, na mesma
máquina e no mesmo navegador, para comparar. Nada foi testado contra a nuvem
real (o ambiente de teste não alcança o Supabase); a nuvem foi substituída por
um banco falso que responde nos mesmos endereços e com as mesmas regras
(PostgREST + Auth). É o mesmo código do app: só o servidor muda.

## 1. Sincronização — 8 cenários

| # | Cenário | Resultado |
|---|---|---|
| 1 | Abrir o app com sessão válida | 5 tabelas obrigatórias respondem; leitura de todas as tabelas; painel sem “falta criar” |
| 2 | Criar despesa com internet | 1 envio (`POST /rest/v1/despesas`); 1 linha na nuvem; recarregar e sincronizar de novo **não duplica** |
| 3 | Criar despesa **sem internet** e reconectar | 0 linhas na nuvem enquanto offline; ao reconectar, 1 envio → 1 linha; sem duplicar |
| 4 | Duas abas abertas | a aba 2 recebe a despesa criada na aba 1; total na nuvem continua 1 |
| 5 | Nuvem recusa (HTTP 500) | nada é gravado; **nada se perde no aparelho**; erro aparece em “Erros recentes” (`HTTP 500`) |
| 6 | Recusa → servidor volta | 1 envio, 1 linha, sem duplicar |
| 7 | Editar offline e reconectar | atualiza **no mesmo id** (valor 99,9), sem criar cópia |
| 8 | Outro aparelho já tem a despesa | este aparelho começa vazio e **recebe** a linha; sem duplicar localmente |

Observações:

- o app **não reenvia** o que já estava sincronizado: ao reconectar, só as
  linhas pendentes sobem (foi o que fez o cenário 3 gravar exatamente 1 linha);
- as exclusões continuam guardadas como antes (listas de “excluídos”), o que
  impede que uma linha apagada volte no próximo sincronismo;
- nenhum erro de JavaScript em nenhum cenário.

## 2. Service worker

Sem `ServiceWorkerRegistration.scriptURL` (que existe no Chrome/Edge/Android,
mas **não** no Chromium de teste), a auto-cura do próprio app (r135) trata a
própria SW como “legada” e a remove. Simulando essa propriedade — como no
navegador real — o resultado é:

| Página | Registros | Escopo | Script | Página controlada |
|---|---|---|---|---|
| app atual `/` | 1 | `/` | `fast-sw.js?v=5.3.8` | sim |
| Modelo B `/modelo-b/` | 1 | `/` | `fast-sw.js?v=5.3.8` | sim |

Igual nos dois: o `<base href="../">` faz a SW ser **a mesma** da raiz, com o
mesmo escopo. O `updates.json` (5.3.8) continua casando com a versão do app.

## 3. Layout — estouro de tela

13 abas × 6 larguras (1440, 1024, 768, 390, 360, 320 px), nas duas versões:

| Medida | App atual | Modelo B |
|---|---|---|
| Abas com rolagem horizontal da página | 0 de 78 | 0 de 78 |
| Abas com duas seções ativas ao mesmo tempo | 0 de 78 | 0 de 78 |
| Erros de JavaScript | 0 | 0 |

Casos que **parecem** estouro e são rolagem normal:

- tabela de Rotas: 1255 px de tabela dentro de uma caixa com rolagem lateral
  (364 px no celular, 1114 px no desktop) — igual no app atual;
- modal “Novo Cliente”: ocupa a tela e rola por dentro em 1440, 768 e 390;
- paleta Ctrl+K: largura de 100% da tela no celular, sem corte lateral.

## 4. Transições

| Medida | App atual | Modelo B |
|---|---|---|
| Tempo para trocar de aba | 8–32 ms | 8–32 ms |
| Seções ativas após a troca | 1 | 1 |
| Aba invisível depois da animação | nenhuma | nenhuma |
| Clique na aba que já está aberta | não faz nada (correto) | não faz nada (correto) |

## 5. Correções feitas nesta rodada

1. **Botão da Central Rápida (raio).** O arquivo do app carrega uma posição
   arrastada antiga (`inset: 411px auto auto 373px`) e o botão ficava no meio
   do conteúdo. No Modelo B ele vai para o canto inferior direito. Se a pessoa
   arrastar, a posição dela é respeitada nas próximas aberturas — coisa que o
   app atual não faz (ao reabrir, o botão volta para 411/373 mesmo com posição
   salva). A marca usada para decidir é `fastV2LauncherPos`, a posição real
   gravada pelo app; `data-dragged` não serve (dura 450 ms).
2. Nada mais foi alterado no motor, nos textos ou nos dados.

## 6. O que ainda precisa ser visto em aparelho real

- dois celulares logados na mesma conta, criando rotas ao mesmo tempo (o
  tempo real usa WebSocket, que o teste não reproduz);
- modo avião de verdade (perda de rede do sistema, não simulada);
- instalar o app pela tela “Instalar” e conferir a atualização automática
  depois de uma publicação nova;
- rolagem por toque no celular (o navegador de teste não aplica gesto de
  arrasto; a rolagem por roda é igual nas duas versões).
