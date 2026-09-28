# FAST Serviços 2.0 — Check-up de migração

## Preservação de dados

- A versão 2.0 não renomeia nem remove chaves de `localStorage`, bancos IndexedDB, tabelas Supabase ou caminhos do Google Drive.
- As rotinas existentes de rotas, despesas, clientes, destinos, RH, motoristas, fotos e sincronização permanecem no `index.html` original.
- Na primeira abertura, `v2-ui.js` tenta gerar `fast_v2_pre_migration_checkpoint` antes de ativar a nova interface.
- O cache PWA mudou para `fast-servicos-v2`, fazendo o navegador descartar somente arquivos de interface antigos, nunca os dados do usuário.
- A função `fastV2.restoreCheckpoint()` fica disponível para restaurar o checkpoint local, se necessário.

## Verificações antes do deploy

- 36 blocos JavaScript internos: nenhum erro de sintaxe.
- `v2-ui.js`: sintaxe válida.
- 757 IDs HTML: nenhum duplicado.
- Referências locais: nenhuma ausente.
- Manifesto PWA: JSON válido.
- Nenhum token GitHub, chave administrativa Supabase ou credencial privada incluída.
- `git diff --check`: nenhum erro de espaços ou patch.

## Funcionalidades 2.0

- Nova linguagem visual completa para desktop e celular.
- Navegação lateral transformada em central de operações.
- Nova barra superior com busca e estados de conexão.
- Central Rápida por botão flutuante ou `Ctrl+K`.
- Modo Foco para maximizar a área de trabalho.
- Densidade confortável ou compacta, salva no dispositivo.
- Novos cartões, formulários, tabelas, estados ativos, sombras e hierarquia tipográfica.
- Compatibilidade com redução de movimento e ampliação de texto.
- Correções da Central de Notificações da r102 preservadas.
