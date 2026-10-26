# FAST Serviços — Melhorias, Inovações e Ideias

> Diagnóstico feito sobre o código-fonte da versão 5.3.8 (outubro/2026).
> Cada item abaixo referencia arquivos e números reais do repositório.

---

## 1. Retrato atual (o que os números dizem)

| Fato | Evidência no repositório |
|---|---|
| App monolítico gigante | `index.html` tem **48.047 linhas / 3,1 MB**, 158 blocos `<script>`, 110 blocos `<style>`, 1.977 funções, 396 usos de `innerHTML` e 469 referências a `localStorage` |
| Dois monólitos paralelos | `index.html` (3,1 MB) + `fast-index.html` (2,7 MB / 42.616 linhas) |
| Código duplicado | Renderer inteiro copiado em `linux/src/renderer/` (index.html de 4 MB) + 5 mini-apps copiados nas duas árvores |
| Versionamento disperso | App em 5.3.8, mas `linux/package.json` e `fast-sw.js` em 4.0.24, `app-limpo` em 4.0.33, `v2-ui.js?v=5.1.6`, `fast-4067.js?v=42`, `prepare-release.js` ainda presume 4.0.7 |
| Patches manuais | `patch_r140.py` … `patch_r144.py` (substituição de string), deploy descrito no `LEIA-ME.txt` como upload manual pelo site do GitHub |
| Testes quase inexistentes | Apenas 1 teste estrutural (`scripts/test-motorista-registration.mjs`), sem framework, sem `package.json` na raiz, sem linter |
| Dependências de CDN sem SRI | 7 bibliotecas do jsdelivr (Leaflet, Chart.js, jsPDF, Tesseract, pdf.js, jsQR…) sem `integrity` |
| CSP ineficaz | A meta real (linha 260 do `index.html`) usa `default-src ... https:` + `unsafe-inline` + `unsafe-eval` — permite script de qualquer origem HTTPS |
| Token GitHub no navegador | PAT (`ghp_…`) é salvo no `localStorage` (`fast_gh_sync_config`, linha 12115) — qualquer XSS leva o token |
| Edge Function aberta | `motorista-status-email/index.ts` aceita requisições sem autenticação, com CORS `*`, e envia e-mail pela Brevo — pode ser explorada para disparo em massa |
| Sincronização frágil | O changelog da 5.3.8 já documenta corridas entre login e sincronização ("o app concluía que as tabelas não existiam") e exclusões que escondiam registros para sempre |

---

## 2. Engenharia e arquitetura (maior causa de retrabalho hoje)

### P0 — Acabar com o monólito e as cópias manuais
1. **Build com Vite (ou esbuild) e módulos ES.** Quebrar o `index.html` em módulos por domínio: `rotas/`, `clientes/`, `despesas/`, `rh/`, `motorista/`, `sincronizacao/`, `ui/`. O build gera o HTML final único do PWA — o usuário continua recebendo um app de página única, mas o código-fonte vira manutenível.
2. **Fonte única da verdade.** Os mini-apps (cliente, motorista, despesas, rotas, limpo) e o renderer do Electron passam a ser *saídas do mesmo build*, não cópias. Isso elimina `linux/scripts/sync-renderer.js`, os patches `.py` e a duplicação de árvores.
3. **Uma única fonte de versão.** Criar `version.json` (ou usar o `package.json` raiz) e injetar a versão no build — nas metas, nos `?v=`, no SW, no manifest e no Electron. Acaba com a classe de bug do "fica na 12" (relatório 2.3.19) e com os drifts 4.0.x vs 5.3.x.
4. **`package.json` na raiz** com scripts: `test`, `lint`, `check`, `build`, `release`.

### P1 — Automatizar o que hoje é manual
5. **CI em todo push** (GitHub Actions): `node --check` em todos os JS, validação de sintaxe dos blocos inline, teste estrutural, auditoria de segredos e ID duplicados (o `audit-html.js` já existe — só rodar no CI), Lighthouse.
6. **Deploy web automático:** git push na `main` → Actions faz o build e publica no GitHub Pages. Apertar "Upload files" no site deveria ser substituído por `git push`; o publicador interno com PAT some do app (ver segurança).
7. **Tags geram releases** como hoje, mas com o versionamento automático do item 3.
8. **Linter e formatação** (ESLint + Prettier) e fim dos 47 TODO/FIXME espalhados no `index.html` — cada um vira issue numerada.

### P1 — Camada de dados e sincronização
9. **Centralizar o armazenamento local num único módulo** (`storage.js`): hoje são 469 acessos diretos a `localStorage` espalhados. Um módulo único permite versionamento de schema, migrações com checkpoint (que hoje é feito caso a caso, como o `fast_v2_pre_migration_checkpoint`) e teste.
10. **Fila de sincronização formal (padrão outbox).** Os 295 pontos com "fila/pendente" mostram que a fila existe de forma improvisada. Formalizar: toda mutação grava numa fila com `id`, timestamp e status; um worker drena a fila, com retry exponencial e conflito resolvido por timestamp. Isso corrige na origem os bugs de corrida login×sync da 5.3.8.
11. **Tombstones com data em exclusões** (a 5.3.8 já começou isso) e nunca mais exclusão "só pelo nome", que escondia registros para sempre.
12. **Usar Supabase Realtime** (já há 10 referências a canais) para espelhar clientes/motoristas/RH sem precisar de polling nem de reload — é a solução definitiva para o bug "painel tem 143 e o app mostra 5".

### P2 — Qualidade e performance
13. **Vitest + Playwright:** testes unitários das regras (CPF, placa, telefone, valor por extenso — já há lógica excelente no `recibo-fast.js`) e testes E2E dos fluxos críticos: login → criar rota → lançar despesa → sincronizar.
14. **Lazy-load das bibliotecas pesadas:** Tesseract (OCR) e pdf.js só devem carregar quando o recurso abre; hoje entram no carregamento inicial e incham o app.
15. **Higiene do repositório:** as 5 PNGs da raiz somam ~4,7 MB e são só capturas de tela — mover para `docs/`; remover `patch_r*.py` após aplicados; o `.git` já tem 31 MB.
16. **Monitoramento de erros:** um coletor simples (tabela `erros_frontend` no Supabase ou Sentry/GlitchTip) para parar de descobrir bug só quando o cliente reclama — hoje não há telemetria nenhuma.

---

## 3. Segurança (há achados concretos aqui)

| # | Achado | Correção sugerida | Prioridade |
|---|---|---|---|
| S1 | **CSP permissiva** (linha 260): `https:` em `default-src` + `unsafe-inline` + `unsafe-eval` equivale a nenhuma proteção XSS. O `recomendacoes-csp.txt` tem a versão rigorosa, mas não foi a aplicada. | Aplicar a CSP restrita por domínios (já redigida no próprio repo) e evoluir para hashes/nonces removendo `unsafe-inline`; hospedar num host com cabeçalhos HTTP (Cloudflare Pages/Netlify) para HSTS e amigos | **P0** |
| S2 | **PAT do GitHub no `localStorage`** (`fast_gh_sync_config`). Com 396 `innerHTML` e CSP frouxa, um XSS rouba o token e o invasor passa a commitar no repositório. | Remover o publicador interno do app; publicação só via CI com `GITHUB_TOKEN` do Actions. Para os aparelhos que já têm token salvo, incluir rotina que apaga a chave | **P0** |
| S3 | **7 libs de CDN sem SRI.** Um CDN comprometido = execução de código no app de todos os clientes. | Adicionar `integrity` + `crossorigin`, ou melhor: **vendorizar** as libs no repositório/build (CSP passa a aceitar só `'self'`) | **P1** |
| S4 | **Edge Function de e-mail aberta:** sem auth e CORS `*`, qualquer um pode POSTar e-mails e gastar a cota Brevo (risco também de reputação do domínio). | Exigir chave de serviço ou sessão Supabase, restringir CORS à origem do app, validar destino contra a tabela de motoristas e adicionar rate limiting (por IP/e-mail) | **P1** |
| S5 | **RLS já foi `USING (true)` em todas as tabelas** (conforme `correcao-rls-supabase.sql`). | Confirmar no Supabase que o script foi aplicado; evoluir de "só autenticado" para políticas por papel (motorista só lê suas rotas e sua pasta no storage — o bucket de documentos já está correto nesse modelo) e adicionar teste automatizado das políticas | **P1** |
| S6 | **QR Code de terceiros:** `api.qrserver.com` recebe dados do app pela URL. | Gerar QR localmente (a lib `jsqr` já está no app; uma lib geradora pequena resolve) — o próprio `recomendacoes-csp.txt` já sugere isso | **P2** |
| S7 | **`img-src` permite `http:`** — abre brecha para conteúdo misto. | Remover `http:` e permitir só `https:`/`data:`/`blob:` | **P2** |

---

## 4. Inovações de produto (logística e serviços, contexto Brasil)

### Experiência do motorista e prova de entrega
1. **Comprovante de entrega digital completo:** foto + assinatura na tela + geolocalização + carimbo de data/hora, gerando PDF automático (o `recibo-fast.js` já tem toda a mecânica de PDF/imagem/WhatsApp — é estender, não construir do zero). Vira documento jurídico e acaba com papel.
2. **OCR de CT-e/NF-e e canhoto:** o Tesseract já está embarcado. Ler chave da nota, código de barras e pré-preencher destino e valores — hoje o motorista digita tudo na mão.
3. **Navegação offline por trecho:** baixar tiles do Leaflet da rota do dia quando houver Wi-Fi, para funcionar em área sem sinal (o app já é PWA offline; falta o mapa offline).
4. **Check-in por geocerca:** o app detecta sozinho a chegada no destino (raio de ~150 m) e registra o evento, sem o motorista tocar no celular — útil para SLA de entrega.
5. **Biometria no app do motorista:** a tabela `biometria` já existe; usar a API nativa (WebAuthn/biometria do Android) para liberar início de jornada e confirmar entregas.

### Inteligência operacional
6. **Otimização automática de rotas:** em vez de ordenar manualmente os destinos do dia, um solver (OR-Tools ou heurística VRP simples) ordena paradas por janela de horário, distância e capacidade — economia direta de combustível. Os dados de destinos e rotas já existem.
7. **Painel de indicadores (já há Chart.js):** taxa de sucesso de entrega, tempo médio por parada, custo por km (despesas já são lançadas), ticket médio, ranking de motoristas e mapa de calor de atrasos.
8. **Alertas preditivos simples:** despesa acima da média da rota, cliente com entrega recusada repetida, documento de motorista vencendo (o cofre `motorista-documentos` já guarda tudo).
9. **Notificações push (Web Push nativo):** hoje não existe nada (`fast-sw.js` não tem push). Avisar motorista de nova rota, cliente de "saiu para entrega" e atraso de sincronização — engajamento alto com pouco esforço.
10. **Rastreio público evoluído:** o `rastreio-fast.js` já usa RPC segura sem expor dados. Adicionar link de rastreio enviado por WhatsApp no momento da saída e ETA calculado pela posição do motorista.

### Financeiro e cliente
11. **Cobrança e comprovação por PIX:** QR Code PIX copia-e-cola gerado no app (gera local, sem terceiro), conciliação automática com os recibos.
12. **Conciliação de despesas:** categorizar automaticamente (combustível, pedágio, manutenção) e fechar o custo real por rota — cruzando `despesas` e `rotas`.
13. **Portal do cliente com login:** hoje o app cliente é enxuto; dar histórico de entregas, segunda via de recibo (PDF pronto no `recibo-fast.js`) e avaliação da entrega.
14. **WhatsApp Business como canal:** o backend no Render já existe. Evoluir para mensagens transacionais automáticas (saída, entrega, atraso) com templates aprovados.
15. **Multi-empresa no mesmo app:** o `dados_empresa` já é estrutura separada — permitir trocar de empresa no login, abrir o produto para outras transportadoras (licenciamento/SaaS).

### Acessibilidade e maturidade
16. **Acessibilidade:** auditoria com axe, navegação 100% por teclado (há um `desktop-guides-keyboard.js`, bom sinal), ARIA em tabelas e modais, contraste nos modos do v2-ui.
17. **Internacionalização** preparando a estrutura (pt-BR hoje, espanhol amanhã) com arquivos de mensagens — barato se feito antes do monólito crescer mais.

---

## 5. Roadmap sugerido

### Fase 1 — Quick wins (1–2 semanas, alto impacto, baixo risco)
- [ ] Aplicar a CSP rigorosa que já está redigida em `recomendacoes-csp.txt` e remover `http:` do `img-src` (S1, S7)
- [ ] Adicionar SRI nas 7 libs do jsdelivr (S3)
- [ ] Travar a Edge Function com auth + rate limit (S4)
- [ ] Rotina que remove o `fast_gh_sync_config` dos aparelhos + desativar o publicador interno (S2)
- [ ] Sincronizar os números de versão (SW, Electron, app-limpo) via arquivo único
- [ ] Mover as PNGs da raiz para `docs/` e limpar `patch_r*.py`

### Fase 2 — Base de engenharia (1–2 meses)
- [ ] `package.json` raiz + ESLint/Prettier + CI com os testes e auditorias já existentes
- [ ] Deploy automático no GitHub Pages via Actions (fim do upload manual)
- [ ] Extrair os módulos de domínio do `index.html` e introduzir build (Vite)
- [ ] `storage.js` único + outbox formal de sincronização + testes Vitest

### Fase 3 — Produto (contínuo)
- [ ] Supabase Realtime como espelho oficial dos dados (fim dos bugs de "5 vs 143")
- [ ] Push notifications, comprovante de entrega com geolocalização/assinatura
- [ ] Otimização de rotas e painel de indicadores
- [ ] PIX, conciliação de despesas e portal do cliente

---

## 6. Os 5 itens que eu priorizaria agora

1. **CSP rigorosa e remoção do PAT do localStorage** — hoje a superfície de ataque é real e a correção é pequena.
2. **Uma fonte única de versão + CI** — o histórico do projeto (2.3.19, 5.3.8) mostra que versionamento e deploy manuais são a maior fonte de incidentes.
3. **Fila de sincronização formal + Realtime** — os bugs mais recentes são todos de corrida/divergência de dados.
4. **Modularização com build** — sem ela, cada nova versão fica mais arriscada e mais lenta de fazer.
5. **Comprovante de entrega digital + push** — inovação visível para o cliente, reaproveitando PDF, fotos e WhatsApp que já existem.
