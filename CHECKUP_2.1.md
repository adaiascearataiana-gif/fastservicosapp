# FAST Serviços 2.1 — Check-up de entrega

## Aplicativo web

- Interface 2.1 aplicada sobre a base funcional existente, sem troca das chaves de armazenamento.
- Barra superior fixa, navegação lateral, Central Rápida, modos Foco e Compacto responsivos.
- Login por setor, rotas, Rotas do Dia, clientes, lugares, despesas, RH, motorista, dashboards, fotos e backups preservados.
- Deduplicação de lugares executada por nome canônico, com backup preventivo antes da consolidação.
- Checkpoint local da migração disponível em `fast_v2_pre_migration_checkpoint`.

## Aplicativo Linux

- O HTML embarcado é idêntico ao HTML web 2.1; a única adição é a ponte segura do Electron.
- `contextIsolation`, sandbox e bloqueio de Node.js na interface continuam ativos.
- Configurações externas para Supabase e Google; atualização por Releases do GitHub.
- Pacotes gerados e inspecionados: AppImage x86-64 e DEB amd64.
- Workflow da raiz do repositório preparado para gerar os dois instaladores em tags `v*`.

## Integridade verificada

- 36 blocos JavaScript internos sem erro de sintaxe.
- 728 IDs únicos no HTML inicial do desktop.
- Nenhum token GitHub ou chave `service_role` incluído no pacote.
- Manifestos válidos e arquivos locais referenciados presentes.
- HTML web e Linux comparados automaticamente após remover apenas a chamada da ponte desktop: conteúdo idêntico.
- `npm run check` e `electron-builder --linux AppImage deb` concluídos.

## Instaladores validados

- `FAST-Servicos-2.1.0-x86_64.AppImage`
- `FAST-Servicos-2.1.0-amd64.deb`

