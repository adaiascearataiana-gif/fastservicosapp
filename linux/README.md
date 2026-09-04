# FAST Serviços 2 para Linux

Aplicativo desktop profissional sincronizado com a mesma base da versão web 2.1. Inclui rotas, Rotas do Dia, clientes, destinos, despesas, equipe, RH, login por setor, dashboards, backups, Supabase, Google Drive, modo offline e atualização pelo GitHub.

## Instalação rápida

Requer Node.js 20+ e npm.

```bash
chmod +x scripts/install.sh scripts/configure.sh
./scripts/install.sh
```

Os instaladores AppImage e DEB serão criados em `dist/`. Para testar antes de empacotar:

```bash
npm install
npm start
```

## Integrações seguras

1. Copie `config.example.json` para o diretório de configuração exibido pelo aplicativo/script.
2. Use somente a URL REST e a chave **anon pública** do Supabase. Nunca use `service_role` no cliente.
3. No Google Cloud, crie um Client ID OAuth; o Drive é autorizado pelo próprio usuário.
4. No GitHub, o aplicativo recebe atualizações por **Releases públicas**. `GH_TOKEN` é usado apenas no terminal ou GitHub Actions para publicar, nunca salvo no HTML.

## Login por setor

O app mantém os perfis Administrador, Atendimento e Entregador, com permissões configuráveis por área. O SQL em `supabase/r102_security.sql` prepara Administração, Atendimento, Logística, Financeiro, RH e Motorista usando Supabase Auth e RLS. Crie usuários no painel seguro do Supabase/servidor; não distribua chave administrativa ao aplicativo.

## GitHub

Crie uma tag como `v2.1.0`. O workflow da raiz do repositório gera AppImage e DEB e publica os instaladores na Release do GitHub.

## Segurança aplicada

- `contextIsolation`, sandbox e `nodeIntegration` desativada na tela do app.
- Navegação externa bloqueada e aberta no navegador padrão.
- Permissões limitadas a câmera, localização, notificações e clipboard seguro.
- Cofre local protegido por `safeStorage` do Linux.
- Scanner impede empacotamento com tokens GitHub, `service_role` ou IDs HTML duplicados.
- Atualização por Release assinada pelo fluxo do GitHub, sem token no cliente.

## Migração de dados

Antes de trocar de dispositivo, use **Fotos e Backups → Criar Ponto de Restauração/Backup**. O desktop usa armazenamento próprio e preserva checkpoints locais; para trazer dados exclusivos de outro navegador, importe o backup na primeira abertura ou conclua a sincronização pelo Supabase.
