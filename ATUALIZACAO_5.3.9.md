# FAST 5.3.9 — COLAR ENDEREÇO + data das rotas protegida

## O que mudou
- **COLAR ENDEREÇO** em Rotas do Dia, Nova Rota, Editar Rota e cadastro de Lugares/Destinos.
  Lê o texto copiado do WhatsApp, separa **rua/avenida, número e bairro** (também complemento, cidade/UF e CEP) e abre uma conferência antes de preencher.
  Se o navegador bloquear a área de transferência, abre campo para **colagem manual**.
- **Data das rotas**: a virada do dia, a sincronização e as rotinas de manutenção não movem mais rotas pendentes ou concluídas para “hoje”.
  A data cadastrada em ROTAS é a fonte de verdade; a data selecionada na tela é lembrada mesmo após a meia-noite.
  Cópias duplicadas são consolidadas na data cadastrada, sem reescrever `rota.data`.
  Migrações automáticas antigas que ainda tenham marca (`dataOriginal` + `passouEm`) e não tenham edição manual posterior são desfeitas com backup local.

## Arquivos do app
`index.html` + `fast-endereco.js` (sem SQL).

## Termux — baixar esta branch e testar
```bash
cd ~/fastservicosapp && \
git fetch origin arena/cbc88c3c-fastservicosapp && \
git switch arena/cbc88c3c-fastservicosapp && \
git pull --ff-only origin arena/cbc88c3c-fastservicosapp && \
node scripts/test-fast-endereco.js && \
node scripts/test-route-dates.js && \
node scripts/audit-data-safety.js
```

Se a pasta ainda não existir:
```bash
cd ~ && \
git clone --branch arena/cbc88c3c-fastservicosapp https://github.com/adaiascearataiana-gif/fastservicosapp.git && \
cd fastservicosapp && \
node scripts/test-fast-endereco.js && node scripts/test-route-dates.js && node scripts/audit-data-safety.js
```

## Publicar no site
A branch `arena/cbc88c3c-fastservicosapp` contém a correção. Para o GitHub Pages publicado a partir de `main`, mescle o Pull Request desta branch no GitHub.
Depois da publicação, aguarde 1–2 minutos e feche/abra o app em **todos os aparelhos**.

## Observação importante
Registros cuja data já foi sobrescrita por uma versão antiga **sem deixar marca de migração** não têm como ser adivinhados com segurança.
Nesses casos, a data correta pode ser restaurada por backup ou ajustada manualmente em Editar Rota.
