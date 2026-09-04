# FAST Serviços para Linux — r102

Aplicativo desktop Linux baseado na versão r101, com isolamento do Electron, suporte offline, câmera, GPS, notificações, cofre criptografado do sistema, configuração externa e instaladores AppImage/DEB.

## Instalação rápida

Requer Node.js 20+ e npm.

```bash
chmod +x scripts/install.sh scripts/configure.sh
./scripts/install.sh
```

Os instaladores serão criados em `dist/`. Para testar antes de empacotar:

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

O app r101 mantém os perfis Administrador, Atendimento e Entregador e permissões por área. O SQL em `supabase/r102_security.sql` adiciona a base robusta para Administração, Atendimento, Logística, Financeiro, RH e Motorista usando Supabase Auth e RLS. Crie usuários no painel seguro do Supabase/servidor; não distribua chave administrativa ao aplicativo.

## GitHub

Copie este projeto para o repositório, execute `npm install` para gerar `package-lock.json`, faça commit e crie uma tag como `v1.0.2`. O workflow gera AppImage e DEB e publica os artefatos na Release.

## Segurança aplicada

- `contextIsolation`, sandbox e `nodeIntegration` desativada na tela do app.
- Navegação externa bloqueada e aberta no navegador padrão.
- Permissões limitadas a câmera, localização, notificações e clipboard seguro.
- Cofre local protegido por `safeStorage` do Linux.
- Scanner impede empacotamento com tokens GitHub, `service_role` ou IDs HTML duplicados.
- Atualização por Release assinada pelo fluxo do GitHub, sem token no cliente.

## Migração de dados

Antes de trocar de versão, use **Fotos e Backups → Criar Ponto de Restauração/Backup** no r101. Instalar o desktop cria um perfil separado; importe o backup na primeira abertura. Não apague o PWA antigo até validar rotas, despesas e fotos.
