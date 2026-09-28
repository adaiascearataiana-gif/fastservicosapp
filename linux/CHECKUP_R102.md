# Check-up técnico r102

## Corrigido no aplicativo web

- Central de Notificações: removido o modal estático residual que impedia a rotina de criação de registrar os eventos dos botões.
- Botão X: fechamento garantido por evento direto e delegação em modo de captura.
- Acessibilidade: fechamento por `Esc`, toque no fundo, `aria-modal` e restauração da rolagem.
- Mobile: opções voltaram a ser linhas compactas; checkbox fixado em 21 px; textos sem caixa alta forçada; painel limitado à tela e com rolagem interna.
- Versão: identificadores visíveis atualizados para `2026.09.04-r102`; histórico em execução reduzido às mudanças desta versão.

## Validações executadas

- 36 blocos JavaScript analisados com `node --check`: zero erros de sintaxe.
- 757 IDs no DOM inicial: zero IDs duplicados.
- Nenhum token GitHub ou chave `service_role` encontrado no HTML entregue.
- Cópia estática de `fast89NotifModal`: removida; o modal passa a ser criado e ligado pelo JavaScript correto.

## Problemas estruturais identificados e tratados no Linux

- O HTML concentra interface, dados, autenticação e integrações. O desktop usa processo principal isolado e uma ponte mínima, sem acesso Node pela interface.
- A autenticação de funcionários existente ainda é local. O SQL r102 adiciona Supabase Auth/RLS por setor para a migração segura.
- Token GitHub no navegador é inseguro. O desktop atualiza por Releases e o workflow publica com o segredo temporário do GitHub Actions.
- Configurações Supabase/Google foram retiradas do código-fonte e aceitas por arquivo externo/variáveis de ambiente.
- O arquivo r101 apontava para `motorista.html`, mas esse arquivo não veio no anexo. O pacote Linux inclui o módulo do motorista com login, rotas, GPS, CHEGUEI, foto e conclusão.

## Observação de segurança

O token enviado na conversa não foi copiado para nenhum arquivo. Como uma credencial digitada em conversa deve ser considerada exposta, ela precisa ser revogada e substituída por um segredo novo no GitHub Actions antes da publicação definitiva.
