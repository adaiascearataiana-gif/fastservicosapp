/* Banco de dados local para testes (PostgreSQL de verdade, dentro do Node).
   Sobe um Postgres temporário, cria o "Supabase de mentira" e aplica os
   arquivos da pasta sql/.  Nada aqui encosta no banco real da igreja.

   Precisa de:  npm install embedded-postgres            (só para testar)  */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

/* Procura um módulo aqui, ou na pasta indicada em IBNM_MODULOS (um node_modules qualquer). */
function carregar(nome) {
  const { createRequire } = require('module');
  const lugares = [__filename];
  if (process.env.IBNM_MODULOS) lugares.unshift(path.join(process.env.IBNM_MODULOS, '_.js'));
  for (const lugar of lugares) {
    try { return createRequire(lugar)(nome); } catch (e) { /* tenta o próximo */ }
  }
  console.log('Instale para rodar este teste:  npm install ' + nome);
  process.exit(1);
}

async function subir(opcoes) {
  opcoes = opcoes || {};
  const mod = carregar('embedded-postgres');
  const EmbeddedPostgres = mod.default || mod;
  const pasta = opcoes.pasta || path.join(require('os').tmpdir(), 'ibnm-pg-' + process.pid);
  fs.rmSync(pasta, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir: pasta, user: 'postgres', password: 'teste', port: opcoes.porta || Number(process.env.PORTA_BANCO) || 54330,
    persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: () => {}
  });
  await pg.initialise();
  await pg.start();
  const cliente = pg.getPgClient();
  await cliente.connect();
  await cliente.query(fs.readFileSync(path.join(__dirname, 'supabase-falso.sql'), 'utf8'));
  /* Que tipo de projeto do Supabase imitar:
       'antigo' (padrão) = toda tabela nova nasce liberada para o app e só a RLS protege
                           (é como está o banco atual da igreja);
       'novo'            = regra dos projetos criados desde 30/05/2026: nada nasce liberado,
                           só vale o que os arquivos da pasta sql/ liberam com GRANT.
     São os mesmos comandos que o painel do Supabase roda ao criar um projeto com a opção
     "Automatically expose new tables" desligada. */
  const projeto = opcoes.projeto || process.env.IBNM_PROJETO || 'antigo';
  if (projeto === 'novo') {
    await cliente.query(`
      alter default privileges for role postgres in schema public
        revoke select, insert, update, delete on tables from anon, authenticated, service_role;
      alter default privileges for role postgres in schema public
        revoke usage, select, update on sequences from anon, authenticated, service_role;
      alter default privileges for role postgres in schema public
        revoke execute on functions from anon, authenticated, service_role;`);
  }
  const arquivos = opcoes.arquivos || ['sql/01-base.sql', 'sql/02-secoes-ebd.sql'];
  for (const f of arquivos) {
    try {
      await cliente.query(ler(f));
    } catch (e) {
      e.message = f + ': ' + e.message + (e.position ? ' (posição ' + e.position + ', perto de: «' +
        ler(f).slice(Math.max(0, e.position - 80), Number(e.position) + 60).replace(/\s+/g, ' ') + '»)' : '');
      await cliente.end().catch(() => {});
      await pg.stop().catch(() => {});
      throw e;
    }
  }
  return {
    pg, cliente, ler, projeto,
    async parar() {
      await cliente.end().catch(() => {});
      await pg.stop().catch(() => {});
      fs.rmSync(pasta, { recursive: true, force: true });
    }
  };
}

/* Cria uma pessoa (igual ao cadastro do app: entra em auth.users e ganha perfil). */
async function criarPessoa(cliente, nome, email) {
  const r = await cliente.query(
    `insert into auth.users (email, raw_user_meta_data, raw_app_meta_data)
     values ($1, jsonb_build_object('nome', $2::text), '{"provider":"email"}') returning id`, [email, nome]);
  return r.rows[0].id;
}

/* Roda comandos como se fosse o app com aquela pessoa logada (uid) ou visitante (null).
   Tudo dentro de uma transação; "desfazer: true" desfaz no final. */
async function como(cliente, uid, fn, opcoes) {
  opcoes = opcoes || {};
  const claims = uid ? { sub: uid, role: 'authenticated' } : { role: 'anon' };
  await cliente.query('begin');
  try {
    await cliente.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await cliente.query('set local role ' + (uid ? 'authenticated' : 'anon'));
    const r = await fn((sql, params) => cliente.query(sql, params));
    await cliente.query(opcoes.desfazer ? 'rollback' : 'commit');
    return r;
  } catch (e) {
    await cliente.query('rollback').catch(() => {});
    throw e;
  }
}

module.exports = { subir, criarPessoa, como, carregar, RAIZ };
