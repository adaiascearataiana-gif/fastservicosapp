/* Servidor local para desenvolver e testar o app SEM encostar no Supabase de verdade.

   O que ele faz:
     * sobe um PostgreSQL temporário com os arquivos da pasta sql/ (banco.js);
     * imita as partes do Supabase que o app usa (login, tabelas, funções e arquivos),
       respeitando as MESMAS regras de segurança (RLS) do banco;
     * entrega os arquivos do app, apontando o js/config.js para este servidor;
     * imita a previsão do tempo (Open-Meteo), porque aqui não há internet.

   Uso:   node testes/local/servidor.js            (abre em http://localhost:8080)
          node testes/local/servidor.js --demo     (já com pessoas e conteúdo de exemplo)
          node testes/local/servidor.js --sw       (usa o sw.js de verdade, que guarda o app no aparelho)
   Precisa de:  npm install embedded-postgres */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { subir, criarPessoa, RAIZ } = require('./banco.js');

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8', '.sql': 'text/plain; charset=utf-8'
};
const IDENT = /^[a-z_][a-z0-9_]*$/;
const MAX_LINHAS = 1000;   /* teto do Supabase por pedido (Settings › API › Max rows) */

function b64(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url'); }
function lerCorpo(req) {
  return new Promise((ok) => {
    const partes = [];
    req.on('data', (p) => partes.push(p));
    req.on('end', () => ok(Buffer.concat(partes)));
  });
}

class ErroHttp extends Error {
  constructor(status, corpo) { super(corpo && (corpo.message || corpo.msg) || 'erro'); this.status = status; this.corpo = corpo; }
}

async function criarServidor(opcoes) {
  opcoes = opcoes || {};
  const banco = opcoes.banco || await subir({ porta: opcoes.portaBanco });
  const c = banco.cliente;
  const arquivos = new Map();          // "bucket/caminho" -> { tipo, dados }
  const assinados = new Map();         // token -> "bucket/caminho"
  const clima = Object.assign({ temperature_2m: 29.4, apparent_temperature: 33.2, relative_humidity_2m: 68, weather_code: 2, is_day: 1, wind_speed_10m: 17.3 }, opcoes.clima || {});
  let fila = Promise.resolve();        // um comando por vez (uma conexão só)

  /* Cada servidor de teste é como um projeto do Supabase: só aceita as sessões que ele mesmo criou.
     Sessão de outro servidor (ou de antes de reiniciar) é recusada, igual ao Supabase de verdade
     quando o app passa a apontar para outro projeto. */
  const assinatura = opcoes.assinatura || crypto.randomBytes(5).toString('hex');
  function fichaDe(req, servico) {
    const aut = req.headers.authorization || '';
    if (!/^Bearer\s+falso\./.test(aut)) return null;          // sem login: visitante (o app manda a chave pública)
    const m = /^Bearer\s+falso\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(aut);
    let ficha = null;
    if (m && m[2] === assinatura) {
      try { ficha = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')); } catch (e) { ficha = null; }
    }
    if (ficha) return ficha;
    if (servico === 'storage') throw new ErroHttp(400, { statusCode: '403', error: 'Unauthorized', message: 'Invalid JWT' });
    throw new ErroHttp(401, { code: 'PGRST301', details: null, hint: null, message: 'JWSError JWSInvalidSignature' });
  }

  /* roda como o usuário da requisição, com as mesmas regras do Supabase */
  function comoUsuario(ficha, fn) {
    const tarefa = fila.then(async () => {
      const claims = ficha && ficha.sub ? { sub: ficha.sub, role: 'authenticated', email: ficha.email } : { role: 'anon' };
      await c.query('begin');
      try {
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
        await c.query('set local role ' + (claims.sub ? 'authenticated' : 'anon'));
        const r = await fn((sql, params) => c.query(sql, params));
        await c.query('commit');
        return r;
      } catch (e) {
        await c.query('rollback').catch(() => {});
        throw e;
      }
    });
    fila = tarefa.catch(() => {});
    return tarefa;
  }
  function interno(sql, params) {
    const tarefa = fila.then(() => c.query(sql, params));
    fila = tarefa.catch(() => {});
    return tarefa;
  }

  function erroPg(e, ficha) {
    if (e instanceof ErroHttp) return e;
    const codigo = e.code || '';
    let status = 400;
    if (codigo === '42501') status = ficha && ficha.sub ? 403 : 401;
    else if (codigo === '23505' || codigo === '23503') status = 409;
    else if (codigo === '42P01' || codigo === '42883') status = 404;
    return new ErroHttp(status, { code: codigo, message: e.message, details: e.detail || null, hint: e.hint || null });
  }

  /* ---------------- login (imitação do Supabase Auth) ---------------- */
  function sessaoDe(u) {
    const ficha = { sub: u.id, email: u.email, role: 'authenticated' };
    return {
      access_token: 'falso.' + b64(ficha) + '.' + assinatura, token_type: 'bearer', expires_in: 3600,
      refresh_token: 'r.' + b64(ficha) + '.' + assinatura,
      user: { id: u.id, email: u.email, user_metadata: u.raw_user_meta_data || {}, app_metadata: u.raw_app_meta_data || {} }
    };
  }

  async function rotaAuth(req, res, url, corpo) {
    const p = url.pathname.replace('/auth/v1', '');
    const dados = corpo.length ? JSON.parse(corpo.toString('utf8') || '{}') : {};
    if (p === '/signup' && req.method === 'POST') {
      const email = String(dados.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ErroHttp(422, { msg: 'Unable to validate email address: invalid format' });
      if (String(dados.password || '').length < 6) throw new ErroHttp(422, { msg: 'Password should be at least 6 characters' });
      const ja = await interno('select 1 from auth.users where email = $1', [email]);
      if (ja.rows.length) throw new ErroHttp(422, { msg: 'User already registered' });
      const r = await interno(
        `insert into auth.users (email, encrypted_password, raw_user_meta_data, raw_app_meta_data)
         values ($1, $2, $3::jsonb, '{"provider":"email"}') returning *`, [email, String(dados.password), JSON.stringify(dados.data || {})]);
      return enviar(res, 200, sessaoDe(r.rows[0]));
    }
    if (p === '/token' && req.method === 'POST') {
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        let f = null;
        const mr = /^r\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(dados.refresh_token || ''));
        if (mr && mr[2] === assinatura) {
          try { f = JSON.parse(Buffer.from(mr[1], 'base64url').toString('utf8')); } catch (e) {}
        }
        const r = f && f.sub ? await interno('select * from auth.users where id = $1', [f.sub]) : { rows: [] };
        if (!r.rows.length) throw new ErroHttp(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
        return enviar(res, 200, sessaoDe(r.rows[0]));
      }
      const r = await interno('select * from auth.users where email = $1', [String(dados.email || '').trim().toLowerCase()]);
      if (!r.rows.length || r.rows[0].encrypted_password !== String(dados.password)) {
        throw new ErroHttp(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      }
      return enviar(res, 200, sessaoDe(r.rows[0]));
    }
    if (p === '/user') {
      const f = fichaDe(req);
      if (!f) throw new ErroHttp(401, { msg: 'invalid JWT' });
      if (req.method === 'PUT' && dados.password) await interno('update auth.users set encrypted_password = $2 where id = $1', [f.sub, String(dados.password)]);
      const r = await interno('select * from auth.users where id = $1', [f.sub]);
      if (!r.rows.length) throw new ErroHttp(401, { msg: 'invalid JWT' });
      return enviar(res, 200, sessaoDe(r.rows[0]).user);
    }
    if (p === '/logout') return enviar(res, 204, null);
    if (p === '/recover') return enviar(res, 200, {});
    throw new ErroHttp(404, { msg: 'rota de login não imitada: ' + p });
  }

  /* ---------------- tabelas e funções (imitação do PostgREST) ---------------- */
  function condicoes(url, params) {
    const partes = [];
    for (const [k, v] of url.searchParams) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
      if (!IDENT.test(k)) throw new ErroHttp(400, { message: 'filtro não imitado: ' + k });
      let expr = v, nao = false;
      if (expr.startsWith('not.')) { nao = true; expr = expr.slice(4); }
      const i = expr.indexOf('.');
      const op = expr.slice(0, i), val = expr.slice(i + 1);
      let sql;
      const simples = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' };
      if (simples[op]) {
        params.push(op === 'like' || op === 'ilike' ? val.replace(/\*/g, '%') : val);
        sql = `"${k}" ${simples[op]} $${params.length}`;
      } else if (op === 'is') {
        if (!['null', 'true', 'false'].includes(val)) throw new ErroHttp(400, { message: 'valor inválido para is.' });
        sql = `"${k}" is ${val}`;
      } else if (op === 'in') {
        const lista = val.replace(/^\(/, '').replace(/\)$/, '').split(',').filter((x) => x !== '').map((x) => x.replace(/^"|"$/g, ''));
        params.push(lista);
        sql = `"${k}"::text = any($${params.length}::text[])`;
      } else {
        throw new ErroHttp(400, { message: 'operador não imitado: ' + op });
      }
      partes.push(nao ? `not (${sql})` : sql);
    }
    return partes.length ? ' where ' + partes.join(' and ') : '';
  }

  function colunasSelect(url) {
    const s = url.searchParams.get('select') || '*';
    if (s === '*') return '*';
    return s.split(',').map((x) => {
      const col = x.trim();
      if (!IDENT.test(col)) throw new ErroHttp(400, { message: 'select não imitado (sem tabelas embutidas): ' + col });
      return `"${col}"`;
    }).join(', ');
  }

  function ordem(url) {
    const o = url.searchParams.get('order');
    if (!o) return '';
    return ' order by ' + o.split(',').map((x) => {
      const p = x.split('.');
      if (!IDENT.test(p[0])) throw new ErroHttp(400, { message: 'ordem inválida' });
      let s = `"${p[0]}"`;
      if (p.includes('desc')) s += ' desc';
      if (p.includes('nullslast')) s += ' nulls last';
      if (p.includes('nullsfirst')) s += ' nulls first';
      return s;
    }).join(', ');
  }

  async function rotaRest(req, res, url, corpo) {
    const ficha = fichaDe(req);
    const resto = url.pathname.replace('/rest/v1/', '');
    const prefer = String(req.headers.prefer || '');
    try {
      if (resto.startsWith('rpc/')) {
        const nome = resto.slice(4);
        if (!IDENT.test(nome)) throw new ErroHttp(404, { message: 'função inválida' });
        const args = corpo.length ? JSON.parse(corpo.toString('utf8') || '{}') : {};
        const info = await interno(
          `select p.proretset, t.typtype, t.typname, p.proargnames, p.proargtypes::regtype[]::text[] as tipos
             from pg_proc p join pg_type t on t.oid = p.prorettype
            where p.pronamespace = 'public'::regnamespace and p.proname = $1`, [nome]);
        if (!info.rows.length) throw new ErroHttp(404, { code: 'PGRST202', message: 'Could not find the function public.' + nome + ' in the schema cache' });
        const f = info.rows[0];
        const nomes = f.proargnames || [];
        const params = [], lista = [];
        Object.keys(args).forEach((k) => {
          const i = nomes.indexOf(k);
          if (i < 0 || i >= f.tipos.length) throw new ErroHttp(404, { code: 'PGRST202', message: 'Could not find the function public.' + nome + '(' + k + ') in the schema cache' });
          const v = args[k];
          params.push(v === null || v === undefined ? null : (typeof v === 'object' ? JSON.stringify(v) : String(v)));
          lista.push(`"${k}" => $${params.length}::${f.tipos[i]}`);
        });
        const chamada = `public."${nome}"(${lista.join(', ')})`;
        let sql;
        if (f.proretset) sql = `select coalesce(json_agg(x), '[]'::json) as r from ${chamada} x`;
        else if (f.typtype === 'c') sql = `select row_to_json(x) as r from ${chamada} x`;
        else sql = `select to_json(${chamada}) as r`;
        const r = await comoUsuario(ficha, (q) => q(sql, params));
        return enviar(res, 200, r.rows[0] ? r.rows[0].r : null);
      }

      const tabela = resto.split('/')[0];
      if (!IDENT.test(tabela)) throw new ErroHttp(404, { message: 'tabela inválida' });
      const alvo = `public."${tabela}"`;
      const params = [];

      if (req.method === 'GET') {
        let sql = `select ${colunasSelect(url)} from ${alvo}` + condicoes(url, params) + ordem(url);
        /* como no Supabase: no máximo 1000 linhas por pedido, mesmo que o app peça mais */
        const pedido = Number(url.searchParams.get('limit')), off = Number(url.searchParams.get('offset'));
        sql += ' limit ' + (pedido > 0 ? Math.min(Math.floor(pedido), MAX_LINHAS) : MAX_LINHAS);
        if (off > 0) sql += ' offset ' + Math.floor(off);
        const r = await comoUsuario(ficha, (q) => q(sql, params));
        return enviar(res, 200, r.rows);
      }

      if (req.method === 'POST') {
        const dados = JSON.parse(corpo.toString('utf8') || '{}');
        const linhas = Array.isArray(dados) ? dados : [dados];
        const cols = Object.keys(linhas[0] || {});
        cols.forEach((k) => { if (!IDENT.test(k)) throw new ErroHttp(400, { message: 'coluna inválida: ' + k }); });
        const lista = cols.map((k) => `"${k}"`).join(', ');
        let sql = cols.length
          ? `insert into ${alvo} (${lista}) select ${lista} from json_populate_recordset(null::${alvo}, $1::json)`
          : `insert into ${alvo} default values`;
        if (prefer.includes('resolution=merge-duplicates')) {
          let conflito = (url.searchParams.get('on_conflict') || '').split(',').filter(Boolean);
          if (!conflito.length) {
            const pk = await interno(
              `select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
                where i.indrelid = $1::regclass and i.indisprimary`, [alvo]);
            conflito = pk.rows.map((x) => x.attname);
          }
          conflito.forEach((k) => { if (!IDENT.test(k)) throw new ErroHttp(400, { message: 'on_conflict inválido' }); });
          const muda = cols.filter((k) => !conflito.includes(k)).map((k) => `"${k}" = excluded."${k}"`);
          sql += ` on conflict (${conflito.map((k) => `"${k}"`).join(', ')}) ` + (muda.length ? 'do update set ' + muda.join(', ') : 'do nothing');
        }
        sql += ' returning *';
        const r = await comoUsuario(ficha, (q) => q(sql, cols.length ? [JSON.stringify(linhas)] : []));
        return enviar(res, 201, prefer.includes('return=representation') ? r.rows : null);
      }

      if (req.method === 'PATCH') {
        const dados = JSON.parse(corpo.toString('utf8') || '{}');
        const cols = Object.keys(dados);
        if (!cols.length) return enviar(res, 200, []);
        cols.forEach((k) => { if (!IDENT.test(k)) throw new ErroHttp(400, { message: 'coluna inválida: ' + k }); });
        const lista = cols.map((k) => `"${k}"`).join(', ');
        params.push(JSON.stringify(dados));
        const sql = `update ${alvo} set (${lista}) = (select ${lista} from json_populate_record(null::${alvo}, $1::json))` +
          condicoes(url, params) + ' returning *';
        const r = await comoUsuario(ficha, (q) => q(sql, params));
        return enviar(res, 200, prefer.includes('return=representation') ? r.rows : null);
      }

      if (req.method === 'DELETE') {
        const onde = condicoes(url, params);
        if (!onde) throw new ErroHttp(400, { message: 'DELETE sem filtro não é permitido' });
        const r = await comoUsuario(ficha, (q) => q(`delete from ${alvo}${onde} returning *`, params));
        return enviar(res, 200, prefer.includes('return=representation') ? r.rows : null);
      }
      throw new ErroHttp(405, { message: 'método não imitado' });
    } catch (e) {
      throw erroPg(e, ficha);
    }
  }

  /* ---------------- arquivos (imitação do Supabase Storage) ---------------- */
  async function rotaStorage(req, res, url, corpo) {
    const partes = decodeURIComponent(url.pathname.replace('/storage/v1/object/', '')).split('/');
    const modo = ['public', 'authenticated', 'sign'].includes(partes[0]) ? partes.shift() : '';
    /* arquivo público (ou com link assinado) não olha quem está pedindo */
    const ficha = (req.method === 'GET' && (modo === 'public' || (modo === 'sign' && url.searchParams.get('token')))) ? null : fichaDe(req, 'storage');
    const bucket = partes.shift();
    const nome = partes.join('/');
    const chave = bucket + '/' + nome;
    const semPermissao = () => new ErroHttp(400, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
    const naoAchou = () => new ErroHttp(400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    const entrega = () => {
      const a = arquivos.get(chave);
      if (!a) throw naoAchou();
      res.writeHead(200, { 'Content-Type': a.tipo, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      res.end(a.dados);
    };
    const visivel = async () => {
      const r = await comoUsuario(ficha, (q) => q('select 1 from storage.objects where bucket_id = $1 and name = $2', [bucket, nome]));
      return r.rows.length > 0;
    };

    if (req.method === 'GET' && modo === 'public') {
      const b = await interno('select public from storage.buckets where id = $1', [bucket]);
      if (!b.rows.length || !b.rows[0].public) throw naoAchou();
      return entrega();
    }
    if (req.method === 'GET' && modo === 'sign') {
      if (assinados.get(url.searchParams.get('token')) !== chave) throw new ErroHttp(400, { statusCode: '400', error: 'InvalidJWT', message: 'jwt malformed' });
      return entrega();
    }
    if (req.method === 'GET') {
      if (!(await visivel())) throw naoAchou();
      return entrega();
    }
    if (req.method === 'POST' && modo === 'sign') {
      if (!(await visivel())) throw naoAchou();
      const token = crypto.randomBytes(12).toString('hex');
      assinados.set(token, chave);
      return enviar(res, 200, { signedURL: '/object/sign/' + chave + '?token=' + token });
    }
    if (req.method === 'POST') {
      const troca = String(req.headers['x-upsert'] || '') === 'true';
      try {
        await comoUsuario(ficha, (q) => q(
          `insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ($1, $2, $3, $4, $5::jsonb)` +
          (troca ? ' on conflict (bucket_id, name) do update set updated_at = now(), metadata = excluded.metadata' : '') + ' returning id',
          [bucket, nome, ficha && ficha.sub || null, ficha && ficha.sub || null, JSON.stringify({ size: corpo.length, mimetype: req.headers['content-type'] || '' })]));
      } catch (e) {
        if (e.code === '42501') throw semPermissao();
        if (e.code === '23505') throw new ErroHttp(400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
        throw e;
      }
      arquivos.set(chave, { tipo: req.headers['content-type'] || 'application/octet-stream', dados: corpo });
      return enviar(res, 200, { Key: chave, Id: crypto.randomUUID() });
    }
    if (req.method === 'DELETE') {
      const r = await comoUsuario(ficha, (q) => q('delete from storage.objects where bucket_id = $1 and name = $2 returning id', [bucket, nome]));
      if (!r.rows.length) throw naoAchou();
      arquivos.delete(chave);
      return enviar(res, 200, { message: 'Successfully deleted' });
    }
    throw new ErroHttp(405, { message: 'método não imitado' });
  }

  /* ---------------- arquivos do app ---------------- */
  function enviar(res, status, corpo) {
    if (corpo === null || corpo === undefined) { res.writeHead(status, { 'Cache-Control': 'no-store' }); return res.end(); }
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(corpo));
  }

  function estatico(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const arq = path.normalize(path.join(RAIZ, rel));
    if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('não encontrado');
    }
    let dados = fs.readFileSync(arq);
    if (rel === '/sw.js' && !opcoes.swDeVerdade) {
      /* no servidor de teste o app não guarda nada no aparelho: cada recarga mostra os arquivos mais novos */
      dados = Buffer.from("/* service worker de teste: não guarda nada */\n" +
        "self.addEventListener('install', function () { self.skipWaiting(); });\n" +
        "self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) {\n" +
        "  return Promise.all(ks.map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });\n");
    }
    if (rel === '/js/config.js') {
      /* aponta o app para este servidor (o arquivo de verdade não é alterado) */
      dados = Buffer.from(dados.toString('utf8')
        .replace(/SUPABASE:\s*'[^']*'/, 'SUPABASE: location.origin')
        .replace(/api:\s*'[^']*'/, "api: location.origin + '/_clima'"));
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(dados);
  }

  const servidor = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local');
    try {
      if (url.pathname.startsWith('/auth/v1/')) return await rotaAuth(req, res, url, await lerCorpo(req));
      if (url.pathname.startsWith('/rest/v1/')) return await rotaRest(req, res, url, await lerCorpo(req));
      if (url.pathname.startsWith('/storage/v1/object/')) return await rotaStorage(req, res, url, await lerCorpo(req));
      if (url.pathname === '/_clima') {
        const agora = new Date();
        return enviar(res, 200, {
          latitude: Number(url.searchParams.get('latitude')), longitude: Number(url.searchParams.get('longitude')),
          timezone: url.searchParams.get('timezone') || 'GMT',
          current: Object.assign({ time: agora.toISOString().slice(0, 16), interval: 900 }, clima),
          daily: { time: [agora.toISOString().slice(0, 10)], temperature_2m_max: [31.6], temperature_2m_min: [25.2], precipitation_probability_max: [20] }
        });
      }
      return estatico(req, res, url);
    } catch (e) {
      const eh = e instanceof ErroHttp ? e : new ErroHttp(500, { message: String(e && e.message || e) });
      if (!(e instanceof ErroHttp)) console.error('[servidor local]', req.method, req.url, e);
      enviar(res, eh.status, eh.corpo);
    }
  });

  await new Promise((ok) => servidor.listen(opcoes.porta || 8080, '0.0.0.0', ok));
  return {
    banco, servidor, arquivos, clima, interno, criarPessoa: (nome, email, senha) => criarConta(interno, nome, email, senha),
    url: 'http://localhost:' + servidor.address().port + '/',
    async parar() { await new Promise((ok) => servidor.close(ok)); await banco.parar(); }
  };
}

/* cria uma conta com senha (para entrar pelo app) */
async function criarConta(interno, nome, email, senha) {
  const r = await interno(
    `insert into auth.users (email, encrypted_password, raw_user_meta_data, raw_app_meta_data)
     values ($1, $2, jsonb_build_object('nome', $3::text), '{"provider":"email"}') returning id`, [email, senha || '123456', nome]);
  return r.rows[0].id;
}

module.exports = { criarServidor, criarConta };

if (require.main === module) {
  (async () => {
    const s = await criarServidor({ porta: Number(process.env.PORTA || 8080), swDeVerdade: process.argv.includes('--sw') });
    if (process.argv.includes('--demo')) {
      const demo = require('./demo.js');
      await demo.povoar(s);
      console.log('Contas de exemplo (senha 123456): ' + demo.CONTAS.join(', '));
    }
    console.log('App de teste em ' + s.url + '  (banco temporário; nada vai para o Supabase)');
    const sair = () => s.parar().then(() => process.exit(0));
    process.on('SIGINT', sair); process.on('SIGTERM', sair);
  })().catch((e) => { console.error(e); process.exit(1); });
}
