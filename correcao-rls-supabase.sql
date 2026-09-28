-- ============================================================================
-- FAST SERVIÇOS — CORREÇÃO DE SEGURANÇA (RLS) — versão 4.0.32
-- ============================================================================
-- PROBLEMA: hoje TODAS as tabelas têm políticas com USING (true) / WITH CHECK
-- (true), o que permite que QUALQUER pessoa (com a chave pública que está no
-- HTML) leia, insira, altere e apague TODOS os dados.
--
-- SOLUÇÃO: substituir as políticas abertas por políticas que exigem um usuário
-- AUTENTICADO (Supabase Auth). O app já faz login por e-mail/senha, então o
-- acesso continua funcionando normalmente para quem está logado, e fica
-- BLOQUEADO para qualquer visitante anônimo.
--
-- COMO APLICAR:
--   1) Abra o Supabase > SQL Editor > New Query.
--   2) Cole TODO este arquivo e clique em RUN.
--   3) Teste o app: faça login e confirme que salvar/editar/excluir funciona.
--   4) Teste deslogado (aba anônima): a API deve RECUSAR leitura e escrita.
--
-- OBSERVAÇÃO IMPORTANTE: as Edge Functions e o app Cliente/Motorista também
-- usam este banco. Todos eles já autenticam via Supabase Auth, então a regra
-- "somente autenticado" atende todos. Se algum fluxo específico precisar de
-- acesso anônimo (ex.: leitura pública de destinos), crie uma política
-- separada e restrita APENAS para aquela tabela e operação.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PASSO 1 — Remover as políticas ABERTAS (USING true) de todas as tabelas.
-- (DROP POLICY IF EXISTS evita erro caso alguma não exista.)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  p text;
  tabelas text[] := ARRAY[
    'rotas','despesas','sequencias_itens','dados_empresa','destinos',
    'rastreamento','motorista_acessos','motorista_fotos',
    'clientes','motoristas','rh','despesas_empresa','biometria'
  ];
  politicas text[] := ARRAY['read','write','upd','del'];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    FOREACH p IN ARRAY politicas LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_' || p, t);
    END LOOP;
    -- nomes alternativos usados em algumas tabelas
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'rast_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'rast_write', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'rast_upd', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'macc_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'macc_write', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'macc_upd', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'mfot_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'mfot_write', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'mfot_upd', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'cli_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'cli_write', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'cli_upd', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'cli_del', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'mot_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'mot_write', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'mot_upd', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'mot_del', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'rh_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'rh_write', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'rh_upd', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'rh_del', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'emp_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'emp_write', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'emp_upd', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'emp_del', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'dest_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'dest_write', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'dest_upd', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'dest_del', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'seq_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'seq_write', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'seq_upd', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'seq_del', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- PASSO 2 — Garantir RLS ATIVADA em todas as tabelas.
-- ---------------------------------------------------------------------------
ALTER TABLE rotas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequencias_itens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE dados_empresa     ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rastreamento      ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorista_acessos ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorista_fotos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE motoristas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh                ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas_empresa  ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- PASSO 3 — Criar políticas SEGURAS: somente usuário AUTENTICADO.
-- (auth.role() = 'authenticated' é verdadeiro apenas com sessão válida do
--  Supabase Auth. Visitantes anônimos são bloqueados.)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'rotas','despesas','sequencias_itens','dados_empresa','destinos',
    'rastreamento','motorista_acessos','motorista_fotos',
    'clientes','motoristas','rh','despesas_empresa'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (auth.role() = ''authenticated'');',
      t || '_sel_auth', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (auth.role() = ''authenticated'');',
      t || '_ins_auth', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'');',
      t || '_upd_auth', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (auth.role() = ''authenticated'');',
      t || '_del_auth', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- PASSO 4 — Verificação: liste as políticas ativas para conferir.
-- ---------------------------------------------------------------------------
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- ============================================================================
-- FIM. Após aplicar, NENHUM acesso anônimo será permitido.
-- ============================================================================
