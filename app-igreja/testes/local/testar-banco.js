/* Teste das regras de segurança do banco (quem pode ver e mexer em quê).
   Usa um PostgreSQL de verdade, temporário, só no computador de teste.

   Uso:  node testes/local/testar-banco.js
   Precisa de:  npm install embedded-postgres   (ou IBNM_MODULOS=/caminho/node_modules) */
const { subir, criarPessoa, como } = require('./banco.js');

let falhas = 0;
function ok(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { falhas++; console.log('  ✗ ' + msg); }
}

(async () => {
  const b = await subir();
  const c = b.cliente;

  /* roda um comando como a pessoa (uid) ou visitante (null); nunca estoura */
  async function tenta(uid, sql, params) {
    try {
      const r = await como(c, uid, (q) => q(sql, params));
      return { ok: true, linhas: r.rows || [], n: r.rowCount };
    } catch (e) {
      return { ok: false, erro: e.message, linhas: [], n: 0 };
    }
  }
  const direto = (sql, params) => c.query(sql, params).then((r) => r.rows);
  const um = async (uid, sql, params) => { const r = await tenta(uid, sql, params); return r.linhas[0] || null; };

  /* ---------------- pessoas ---------------- */
  const P = await criarPessoa(c, 'Adaias Principal', 'principal@teste.com');   // 1º perfil = ADM principal
  const SEC = await criarPessoa(c, 'Sara Secretária', 'sara@teste.com');       // ADM de: eventos, avisos
  const EBD = await criarPessoa(c, 'Eduardo Superintendente', 'edu@teste.com'); // ADM de: ebd
  const TES = await criarPessoa(c, 'Tiago Tesoureiro', 'tiago@teste.com');     // ADM de: pix, ofertas
  const JOV = await criarPessoa(c, 'Júlia Jovens', 'julia@teste.com');         // ADM de uma seção livre
  const PROF = await criarPessoa(c, 'Paula Professora', 'paula@teste.com');    // professora da sala A
  const AL1 = await criarPessoa(c, 'Ana Aluna', 'ana@teste.com');              // aluna da sala A
  const AL2 = await criarPessoa(c, 'Bruno Aluno', 'bruno@teste.com');          // aluno da sala B
  const MEM = await criarPessoa(c, 'Marcos Membro', 'marcos@teste.com');       // membro comum

  console.log('\n== 1. Versão 1.0 continua funcionando ==');
  {
    const perfis = await direto('select id, is_adm from public.ibnm_perfis');
    ok(perfis.length === 9, 'cada pessoa ganhou um perfil automaticamente');
    ok(perfis.filter((p) => p.is_adm).length === 1 && perfis.find((p) => p.is_adm).id === P, 'só o primeiro perfil é ADM principal');
    ok((await tenta(null, 'select * from public.ibnm_config')).linhas.length === 2, 'visitante lê as configurações');
    ok((await tenta(null, 'select * from public.ibnm_devocionais')).linhas.length === 0, 'visitante não vê devocional oculto');
    ok((await tenta(P, 'select * from public.ibnm_devocionais')).linhas.length === 1, 'ADM principal vê devocional oculto');
    ok((await tenta(MEM, 'select * from public.ibnm_perfis')).linhas.length === 1, 'membro vê só o próprio perfil');
    ok((await tenta(P, 'select * from public.ibnm_perfis')).linhas.length === 9, 'ADM principal vê todos os perfis');
    ok((await tenta(MEM, "update public.ibnm_perfis set telefone = '85999990000' where id = $1 returning id", [MEM])).n === 1, 'membro edita o próprio perfil');
    ok((await tenta(MEM, "update public.ibnm_perfis set nome = 'x' where id = $1 returning id", [AL1])).n === 0, 'membro não edita perfil de outra pessoa');
    ok((await tenta(P, "insert into public.ibnm_avisos (titulo, texto) values ('Aviso', 'Texto') returning id")).ok, 'ADM principal cria aviso');
    ok(!(await tenta(MEM, "insert into public.ibnm_avisos (titulo, texto) values ('Aviso', 'Texto')")).ok, 'membro não cria aviso');
    ok((await tenta(P, "update public.ibnm_config set valor = valor || '{\"pastor\":\"Pr. João\"}' where chave = 'igreja' returning chave")).n === 1, 'ADM principal salva os dados da igreja');
    ok((await tenta(MEM, "update public.ibnm_config set valor = '{}' where chave = 'igreja' returning chave")).n === 0, 'membro não altera os dados da igreja');
    ok((await tenta(MEM, "insert into public.ibnm_oracoes (nome, pedido) values ('Marcos', 'Oração') returning id")).ok, 'membro envia pedido de oração');
    ok((await tenta(AL1, 'select * from public.ibnm_oracoes')).linhas.length === 0, 'outro membro não vê o pedido');
    ok((await tenta(P, 'select * from public.ibnm_oracoes')).linhas.length === 1, 'ADM principal vê o pedido');
    ok((await tenta(MEM, 'select * from public.ibnm_aniversariantes(null)')).ok, 'aniversariantes continua funcionando');
  }

  console.log('\n== 2. ADM principal ==');
  {
    ok((await tenta(MEM, 'update public.ibnm_perfis set is_adm = true where id = $1 returning is_adm', [MEM])).linhas[0].is_adm === false, 'membro não consegue virar ADM sozinho');
    ok((await tenta(SEC, 'update public.ibnm_perfis set is_adm = true where id = $1 returning is_adm', [SEC])).linhas[0].is_adm === false, 'ADM de seção não consegue virar ADM principal');
    const r = await tenta(P, 'update public.ibnm_perfis set is_adm = false where id = $1 returning is_adm', [P]);
    ok(!r.ok && /pelo menos um ADM principal/.test(r.erro), 'o último ADM principal não pode ser removido pelo app');
    ok((await tenta(P, 'update public.ibnm_perfis set is_adm = true where id = $1 returning is_adm', [MEM])).linhas[0].is_adm === true, 'ADM principal promove outra pessoa');
    ok((await tenta(P, 'update public.ibnm_perfis set is_adm = false where id = $1 returning is_adm', [MEM])).linhas[0].is_adm === false, 'ADM principal remove a promoção');
    await direto('update public.ibnm_perfis set is_adm = true where email = $1', ['marcos@teste.com']);
    ok((await direto('select is_adm from public.ibnm_perfis where id = $1', [MEM]))[0].is_adm === true, 'comando manual pelo SQL Editor agora funciona (correção)');
    await direto('update public.ibnm_perfis set is_adm = false where id = $1', [MEM]);
  }

  console.log('\n== 3. Seções e ADMs de seção ==');
  let secJovens;
  {
    const s = await direto('select chave, tipo from public.ibnm_secoes order by ordem');
    ok(s.length === 11 && s.filter((x) => x.tipo === 'painel').length === 10 && s.filter((x) => x.tipo === 'ebd').length === 1, 'vieram as 10 áreas do painel + Escola Bíblica');
    ok((await tenta(null, 'select * from public.ibnm_secoes')).linhas.length === 11, 'visitante vê a lista de seções');

    const nova = await tenta(P, "insert into public.ibnm_secoes (nome, icone) values ('Jovens', '🔥') returning *");
    ok(nova.ok && nova.linhas[0].chave === 'jovens' && nova.linhas[0].tipo === 'livre', 'ADM principal cria a seção "Jovens" (endereço: jovens)');
    secJovens = nova.linhas[0].id;
    ok(nova.linhas[0].criado_por === P, 'fica registrado quem criou');
    const rep = await tenta(P, "insert into public.ibnm_secoes (nome) values ('Jóvens') returning chave");
    ok(rep.ok && rep.linhas[0].chave === 'jovens-2', 'nome repetido ganha endereço diferente (jovens-2)');
    const esp = await tenta(P, "insert into public.ibnm_secoes (nome, tipo, chave) values ('Missões & Evangelismo', 'painel', 'pix') returning chave, tipo");
    ok(esp.ok && esp.linhas[0].chave === 'missoes-evangelismo' && esp.linhas[0].tipo === 'livre', 'pelo app só nascem seções "livres" e a chave é gerada');
    ok(!(await tenta(MEM, "insert into public.ibnm_secoes (nome) values ('Invasão')")).ok, 'membro não cria seção');
    ok(!(await tenta(SEC, "insert into public.ibnm_secoes (nome) values ('Invasão')")).ok, 'ADM de seção não cria seção');
    const del = await tenta(P, "delete from public.ibnm_secoes where chave = 'ebd'");
    ok(!del.ok && /não pode ser excluída/.test(del.erro), 'seção do app não pode ser excluída');
    const mud = await tenta(P, "update public.ibnm_secoes set chave = 'outra', tipo = 'livre', nome = 'EBD' where chave = 'ebd' returning chave, tipo, nome");
    ok(mud.linhas[0].chave === 'ebd' && mud.linhas[0].tipo === 'ebd' && mud.linhas[0].nome === 'EBD', 'dá para renomear, mas chave e tipo não mudam');
    await tenta(P, "update public.ibnm_secoes set nome = 'Escola Bíblica Dominical' where chave = 'ebd'");
    ok((await tenta(P, "delete from public.ibnm_secoes where chave = 'jovens-2' returning id")).n === 1, 'ADM principal exclui seção livre');

    /* liberar acessos */
    const dar = (quem, chave) => tenta(P, 'insert into public.ibnm_secao_adms (secao_id, user_id) select id, $1 from public.ibnm_secoes where chave = $2 returning concedido_por', [quem, chave]);
    ok((await dar(SEC, 'eventos')).linhas[0].concedido_por === P, 'ADM principal libera "Agenda" para a secretária');
    await dar(SEC, 'avisos'); await dar(EBD, 'ebd'); await dar(TES, 'pix'); await dar(TES, 'ofertas'); await dar(JOV, 'jovens');
    ok(!(await tenta(SEC, 'insert into public.ibnm_secao_adms (secao_id, user_id) select id, $1 from public.ibnm_secoes where chave = $2', [SEC, 'pix'])).ok, 'ADM de seção não libera acesso para si mesmo');
    ok(!(await tenta(MEM, 'insert into public.ibnm_secao_adms (secao_id, user_id) select id, $1 from public.ibnm_secoes where chave = $2', [MEM, 'ebd'])).ok, 'membro não libera acesso para si mesmo');
    ok((await tenta(SEC, 'select * from public.ibnm_secao_adms')).linhas.length === 2, 'ADM de seção vê só os próprios acessos');
    ok((await tenta(P, 'select * from public.ibnm_secao_adms')).linhas.length === 6, 'ADM principal vê todos os acessos');

    const a = await um(SEC, 'select public.ibnm_meu_acesso() as a');
    ok(a.a.principal === false && a.a.secoes.join() === 'eventos,avisos', 'app recebe as seções liberadas (eventos, avisos)');
    ok((await um(P, 'select public.ibnm_meu_acesso() as a')).a.principal === true, 'app sabe quem é ADM principal');
    const v = await um(null, 'select public.ibnm_meu_acesso() as a');
    ok(v.a.principal === false && v.a.secoes.length === 0 && v.a.ebd.length === 0, 'visitante não tem acesso nenhum');

    /* o que a secretária pode e não pode */
    ok((await tenta(SEC, "insert into public.ibnm_eventos (titulo, data) values ('Culto jovem', current_date) returning id")).ok, 'secretária cria evento (seção liberada)');
    ok((await tenta(SEC, "insert into public.ibnm_avisos (titulo) values ('Aviso da secretaria') returning id")).ok, 'secretária cria aviso (seção liberada)');
    ok(!(await tenta(SEC, "insert into public.ibnm_devocionais (data, titulo) values (current_date + 5, 'X')")).ok, 'secretária não cria devocional (não liberado)');
    ok(!(await tenta(SEC, "insert into public.ibnm_palavras (titulo) values ('X')")).ok, 'secretária não cria palavra pastoral (não liberado)');
    ok((await tenta(SEC, 'select * from public.ibnm_perfis')).linhas.length === 1, 'secretária não vê a lista de membros (não liberado)');
    ok((await tenta(SEC, 'select * from public.ibnm_oracoes')).linhas.length === 0, 'secretária não vê pedidos de oração (não liberado)');
    ok((await tenta(SEC, 'select * from public.ibnm_ofertas')).linhas.length === 0, 'secretária não vê ofertas (não liberado)');
    ok((await tenta(SEC, 'select * from public.ibnm_eventos where publicado = false')).linhas.length > 0, 'secretária vê eventos ocultos da agenda');

    /* membros: leitura sim, edição não */
    await dar(SEC, 'membros');
    ok((await tenta(SEC, 'select * from public.ibnm_perfis')).linhas.length === 9, 'com "Membros" liberado, vê a lista');
    ok((await tenta(SEC, "update public.ibnm_perfis set nome = 'x' where id = $1 returning id", [MEM])).n === 0, '…mas não edita o cadastro dos outros');
    ok((await tenta(SEC, 'delete from public.ibnm_perfis where id = $1 returning id', [MEM])).n === 0, '…nem apaga ninguém');
    await tenta(P, "delete from public.ibnm_secao_adms where user_id = $1 and secao_id = (select id from public.ibnm_secoes where chave = 'membros')", [SEC]);
    ok((await tenta(SEC, 'select * from public.ibnm_perfis')).linhas.length === 1, 'ADM principal tira o acesso e a lista some');
  }

  console.log('\n== 4. Dados da igreja: cada um só altera a sua parte ==');
  {
    const antes = (await direto("select valor from public.ibnm_config where chave = 'igreja'"))[0].valor;
    const tudo = JSON.stringify(Object.assign({}, antes, {
      nome: 'IGREJA INVADIDA', pastor: 'Outro',
      pix: Object.assign({}, antes.pix, { chave: '85911112222' }),
      radio: Object.assign({}, antes.radio, { ativa: true, url: 'http://x' })
    }));
    const r = await tenta(TES, "update public.ibnm_config set valor = $1::jsonb where chave = 'igreja' returning valor", [tudo]);
    ok(r.n === 1 && r.linhas[0].valor.pix.chave === '85911112222', 'tesoureiro (PIX) salva a chave PIX');
    ok(r.linhas[0].valor.nome === antes.nome && r.linhas[0].valor.pastor === antes.pastor, '…mas o nome da igreja e o pastor não mudam');
    ok(r.linhas[0].valor.radio.ativa === false, '…nem a rádio');
    ok((await tenta(SEC, "update public.ibnm_config set valor = $1::jsonb where chave = 'igreja' returning valor", [tudo])).n === 0, 'secretária (sem igreja/pix/rádio) não altera nada');
    await tenta(P, "insert into public.ibnm_secao_adms (secao_id, user_id) select id, $1 from public.ibnm_secoes where chave = 'igreja'", [SEC]);
    const r2 = await tenta(SEC, "update public.ibnm_config set valor = $1::jsonb where chave = 'igreja' returning valor",
      [JSON.stringify(Object.assign({}, antes, { pastor: 'Pr. Novo', pix: { chave: 'golpe' } }))]);
    ok(r2.linhas[0].valor.pastor === 'Pr. Novo' && r2.linhas[0].valor.pix.chave === '85911112222', 'com "Dados da igreja" liberado muda o pastor, mas não o PIX');
    ok(!(await tenta(TES, "insert into public.ibnm_config (chave, valor) values ('x', '{}')")).ok, 'ADM de seção não cria configuração nova');
    ok((await tenta(TES, "delete from public.ibnm_config where chave = 'igreja' returning chave")).n === 0, 'ADM de seção não apaga configuração');
    ok((await tenta(EBD, "update public.ibnm_config set valor = '{\"horario\":\"Domingos, 9h\"}' where chave = 'ebd' returning valor")).n === 1, 'ADM da Escola Bíblica salva os dados da EBD');
    ok((await tenta(TES, "update public.ibnm_config set valor = '{}' where chave = 'ebd' returning valor")).n === 0, 'tesoureiro não altera os dados da EBD');
  }

  console.log('\n== 5. Ofertas ==');
  {
    const o = await tenta(MEM, "insert into public.ibnm_ofertas (nome, valor, tipo, status, confirmado_em) values ('Marcos', 50, 'Dízimo', 'confirmado', now()) returning *");
    ok(o.ok && o.linhas[0].status === 'pendente' && o.linhas[0].confirmado_em === null, 'membro não registra oferta já "confirmada" (correção)');
    const id = o.linhas[0].id;
    const u = await tenta(MEM, "update public.ibnm_ofertas set status = 'confirmado', valor = 9999, comprovante_url = 'comprovantes/x.jpg' where id = $1 returning *", [id]);
    ok(u.linhas[0].status === 'pendente' && Number(u.linhas[0].valor) === 50 && u.linhas[0].comprovante_url === 'comprovantes/x.jpg', 'membro anexa comprovante, mas não confirma nem muda o valor');
    ok((await tenta(SEC, 'select * from public.ibnm_ofertas')).linhas.length === 0, 'secretária não vê as ofertas');
    const t = await tenta(TES, "update public.ibnm_ofertas set status = 'confirmado', confirmado_em = now() where id = $1 returning status", [id]);
    ok(t.n === 1 && t.linhas[0].status === 'confirmado', 'tesoureiro (Ofertas) confirma a oferta');
  }

  console.log('\n== 6. Escola Bíblica: salas e matrículas ==');
  let salaA, salaB, mProf, mAna;
  {
    ok((await tenta(null, 'select * from public.ibnm_ebd_salas')).linhas.length === 0, 'visitante não vê as salas de exemplo (ocultas)');
    ok((await tenta(EBD, 'select * from public.ibnm_ebd_salas')).linhas.length === 4, 'ADM da EBD vê as 4 salas de exemplo');
    ok((await tenta(EBD, 'update public.ibnm_ebd_salas set ativo = true returning id')).n === 4, 'ADM da EBD ativa as salas');
    ok((await tenta(null, 'select * from public.ibnm_ebd_salas')).linhas.length === 4, 'agora o visitante vê as salas');
    ok(!(await tenta(MEM, "insert into public.ibnm_ebd_salas (nome) values ('Minha sala')")).ok, 'membro não cria sala');
    ok(!(await tenta(SEC, "insert into public.ibnm_ebd_salas (nome) values ('Minha sala')")).ok, 'ADM de outra seção não cria sala');
    const salas = await direto('select id, nome from public.ibnm_ebd_salas order by ordem');
    salaA = salas[0].id; salaB = salas[1].id;

    const semLogin = await tenta(null, 'select public.ibnm_ebd_matricular($1, $2)', [salaA, 'aluno']);
    ok(!semLogin.ok, 'visitante não consegue se matricular');

    const ana = await um(AL1, 'select public.ibnm_ebd_matricular($1, $2) as m', [salaA, 'aluno']);
    mAna = ana.m.id;
    ok(ana.m.status === 'ativo' && ana.m.papel === 'aluno' && ana.m.nome === 'Ana Aluna', 'aluna se cadastra na sala e já entra');
    const bruno = await um(AL2, 'select public.ibnm_ebd_matricular($1, $2) as m', [salaA, 'aluno']);
    const bruno2 = await um(AL2, 'select public.ibnm_ebd_matricular($1, $2) as m', [salaB, 'aluno']);
    const doBruno = await direto('select sala_id, status from public.ibnm_ebd_matriculas where user_id = $1 order by criado_em', [AL2]);
    ok(bruno.m.status === 'ativo' && bruno2.m.status === 'ativo' && doBruno.length === 2 && doBruno[0].status === 'inativo', 'ao trocar de sala, a matrícula antiga fica inativa');
    const denovo = await um(AL1, 'select public.ibnm_ebd_matricular($1, $2) as m', [salaA, 'aluno']);
    ok(denovo.m.id === mAna && (await direto('select count(*)::int n from public.ibnm_ebd_matriculas where user_id = $1', [AL1]))[0].n === 1, 'cadastrar de novo não duplica');

    const prof = await um(PROF, 'select public.ibnm_ebd_matricular($1, $2) as m', [salaA, 'professor']);
    mProf = prof.m.id;
    ok(prof.m.status === 'pendente' && prof.m.papel === 'professor', 'pedido de professora fica aguardando aprovação');
    ok((await um(PROF, 'select public.ibnm_ebd_professor($1) as p', [salaA])).p === false, 'enquanto aguarda, não tem poderes de professora');
    ok(!(await tenta(PROF, "update public.ibnm_ebd_matriculas set status = 'ativo' where id = $1 returning id", [mProf])).n, 'professora não aprova a si mesma');
    ok((await um(EBD, 'select public.ibnm_meu_acesso() as a')).a.ebd_pendentes === 1, 'ADM da EBD é avisado do pedido pendente');
    ok((await tenta(EBD, "update public.ibnm_ebd_matriculas set status = 'ativo' where id = $1 returning status", [mProf])).n === 1, 'ADM da EBD aprova a professora');
    ok((await um(PROF, 'select public.ibnm_ebd_professor($1) as p', [salaA])).p === true, 'depois de aprovada, vira professora da sala');
    const ac = (await um(PROF, 'select public.ibnm_meu_acesso() as a')).a;
    ok(ac.ebd.length === 1 && ac.ebd[0].papel === 'professor' && ac.ebd[0].sala === 'Adultos', 'app recebe a sala e o papel da professora');

    /* professora cuida só dos alunos da própria sala */
    const man = await tenta(PROF, "insert into public.ibnm_ebd_matriculas (sala_id, nome, responsavel) values ($1, 'Carlinhos Souza', 'Dona Maria') returning *", [salaA]);
    ok(man.ok && man.linhas[0].user_id === null && man.linhas[0].papel === 'aluno', 'professora lança aluno sem conta no app');
    ok(!(await tenta(PROF, "insert into public.ibnm_ebd_matriculas (sala_id, nome) values ($1, 'Fulano')", [salaB])).ok, 'professora não lança aluno em outra sala');
    const esc = await tenta(PROF, "insert into public.ibnm_ebd_matriculas (sala_id, nome, papel) values ($1, 'Amigo', 'professor')", [salaA]);
    ok(!esc.ok && /Só o ADM da Escola Bíblica/.test(esc.erro), 'professora não nomeia outro professor');
    ok(!(await tenta(PROF, "update public.ibnm_ebd_matriculas set papel = 'professor' where id = $1", [mAna])).ok, 'professora não promove aluno a professor');
    ok(!(await tenta(PROF, 'delete from public.ibnm_ebd_matriculas where id = $1', [mProf])).ok, 'professora não apaga matrícula de professor');
    ok((await tenta(PROF, 'select * from public.ibnm_ebd_matriculas where sala_id = $1', [salaA])).linhas.length === 4, 'professora vê a lista da própria sala (incl. inativos)');
    ok((await tenta(PROF, 'select * from public.ibnm_ebd_matriculas where sala_id = $1', [salaB])).linhas.length === 0, 'professora não vê a lista de outra sala');
    const visAna = await tenta(AL1, 'select papel from public.ibnm_ebd_matriculas order by papel');
    ok(visAna.linhas.length === 2 && visAna.linhas[1].papel === 'professor', 'aluna vê a própria matrícula e quem é professor (não vê colegas)');
    ok((await tenta(MEM, "insert into public.ibnm_ebd_matriculas (sala_id, user_id, nome, papel, status) values ($1, $2, 'Marcos', 'professor', 'ativo')", [salaA, MEM])).ok === false, 'membro não se coloca como professor direto na tabela');

    /* aluno lançado pelo nome liga a conta quando a pessoa se cadastra */
    const CARLOS = await criarPessoa(c, 'carlinhos  souza', 'carlinhos@teste.com');
    const lig = await um(CARLOS, 'select public.ibnm_ebd_matricular($1, $2) as m', [salaA, 'aluno']);
    ok(lig.m.id === man.linhas[0].id && lig.m.user_id === CARLOS && lig.m.responsavel === 'Dona Maria', 'aluno lançado pelo nome é ligado à conta (sem duplicar)');

    const res = await tenta(null, 'select * from public.ibnm_ebd_resumo() order by alunos desc');
    const rA = res.linhas.find((x) => x.sala_id === salaA);
    ok(res.ok && rA.alunos === 2 && rA.professores === 'Paula Professora', 'resumo das salas: 2 alunos e o nome da professora');

    ok((await tenta(EBD, 'select * from public.ibnm_ebd_buscar_pessoas($1)', ['mar'])).linhas.length === 1, 'ADM da EBD busca pessoas pelo nome');
    ok((await tenta(PROF, 'select * from public.ibnm_ebd_buscar_pessoas($1)', ['mar'])).linhas.length === 0, 'professora não busca pessoas');
    ok(!(await tenta(null, 'select * from public.ibnm_ebd_buscar_pessoas($1)', ['mar'])).ok, 'visitante não busca pessoas');
    const dir = await tenta(EBD, "insert into public.ibnm_ebd_matriculas (sala_id, user_id, papel, status) values ($1, $2, 'professor', 'ativo') returning nome", [salaB, MEM]);
    ok(dir.ok && dir.linhas[0].nome === 'Marcos Membro', 'ADM da EBD nomeia professor direto (nome vem do cadastro)');

    ok((await um(AL2, 'select public.ibnm_ebd_sair($1) as s', [bruno2.m.id])).s === true, 'aluno sai da sala');
    ok((await um(AL2, 'select public.ibnm_ebd_sair($1) as s', [mAna])).s === false, 'ninguém tira outra pessoa da sala');
    await um(AL2, 'select public.ibnm_ebd_matricular($1, $2) as m', [salaB, 'aluno']);
  }

  console.log('\n== 7. Escola Bíblica: chamada, presença e relatório ==');
  {
    const alunos = await direto("select id, nome from public.ibnm_ebd_matriculas where sala_id = $1 and papel = 'aluno' and status = 'ativo' order by nome", [salaA]);
    const pres = JSON.stringify(alunos.map((a, i) => ({ m: a.id, p: i === 0 })).concat([{ m: 'lixo', p: true }]));
    const dados = JSON.stringify({ tema: 'A fé de Abraão', visitantes: 2, biblias: 5, revistas: 4, oferta: '37.50', observacao: '' });
    const ch = await tenta(PROF, 'select public.ibnm_ebd_salvar_chamada($1, current_date, $2::jsonb, $3::jsonb) as a', [salaA, dados, pres]);
    ok(ch.ok && ch.linhas[0].a.presentes === 1 && ch.linhas[0].a.matriculados === 2 && Number(ch.linhas[0].a.oferta) === 37.5, 'professora salva a chamada (1 presente de 2, oferta 37,50)');
    const aulaId = ch.ok ? ch.linhas[0].a.id : null;
    const ch2 = await tenta(PROF, 'select public.ibnm_ebd_salvar_chamada($1, current_date, $2::jsonb, $3::jsonb) as a',
      [salaA, dados, JSON.stringify(alunos.map((a) => ({ m: a.id, p: true })))]);
    ok(ch2.ok && ch2.linhas[0].a.id === aulaId && ch2.linhas[0].a.presentes === 2, 'salvar de novo corrige a mesma chamada (não duplica)');
    ok(!(await tenta(PROF, 'select public.ibnm_ebd_salvar_chamada($1, current_date, $2::jsonb, $3::jsonb)', [salaB, dados, '[]'])).ok, 'professora não faz chamada de outra sala');
    ok(!(await tenta(AL1, 'select public.ibnm_ebd_salvar_chamada($1, current_date, $2::jsonb, $3::jsonb)', [salaA, dados, '[]'])).ok, 'aluna não faz chamada');
    ok(!(await tenta(PROF, "select public.ibnm_ebd_salvar_chamada($1, current_date + 10, $2::jsonb, '[]'::jsonb)", [salaA, dados])).ok, 'não aceita chamada com data no futuro');
    ok((await tenta(EBD, "select public.ibnm_ebd_salvar_chamada($1, current_date - 7, $2::jsonb, '[]'::jsonb) as a", [salaB, dados])).ok, 'ADM da EBD faz chamada de qualquer sala');

    ok((await tenta(AL1, 'select * from public.ibnm_ebd_presencas')).linhas.length === 1, 'aluna vê só a própria presença');
    ok((await tenta(AL1, 'select * from public.ibnm_ebd_aulas')).linhas.length === 1, 'aluna vê as aulas da própria sala');
    ok((await tenta(AL2, 'select * from public.ibnm_ebd_aulas where sala_id = $1', [salaA])).linhas.length === 0, 'aluno de outra sala não vê as aulas desta');
    ok((await tenta(MEM, 'select * from public.ibnm_ebd_presencas')).linhas.length === 0, 'professor de outra sala não vê as presenças desta');
    ok((await tenta(PROF, 'select * from public.ibnm_ebd_presencas')).linhas.length === 2, 'professora vê as presenças da sala');
    ok((await tenta(EBD, 'select * from public.ibnm_ebd_aulas')).linhas.length === 2, 'ADM da EBD vê as aulas de todas as salas');
    ok((await tenta(AL1, 'update public.ibnm_ebd_presencas set presente = true returning aula_id')).n === 0, 'aluna não altera presença');
    ok((await tenta(AL1, 'update public.ibnm_ebd_aulas set oferta = 0 returning id')).n === 0, 'aluna não altera a aula');

    const rel = await tenta(PROF, "insert into public.ibnm_ebd_relatorios (sala_id, titulo, caminho) values ($1, 'Relatório', $2) returning autor, criado_por", [salaA, 'ebd/relatorios/' + salaA + '/a.jpg']);
    ok(rel.ok && rel.linhas[0].autor === 'Paula Professora' && rel.linhas[0].criado_por === PROF, 'professora envia a foto do relatório da sala');
    ok(!(await tenta(PROF, "insert into public.ibnm_ebd_relatorios (sala_id, caminho) values ($1, 'x')", [salaB])).ok, 'professora não envia relatório de outra sala');
    ok(!(await tenta(PROF, "insert into public.ibnm_ebd_relatorios (sala_id, caminho) values (null, 'x')")).ok, 'professora não envia relatório geral');
    ok(!(await tenta(AL1, "insert into public.ibnm_ebd_relatorios (sala_id, caminho) values ($1, 'x')", [salaA])).ok, 'aluna não envia relatório');
    ok((await tenta(AL1, 'select * from public.ibnm_ebd_relatorios')).linhas.length === 0, 'aluna não vê as fotos de relatório');
    ok((await tenta(MEM, 'select * from public.ibnm_ebd_relatorios')).linhas.length === 0, 'professor de outra sala não vê o relatório desta');
    ok((await tenta(EBD, 'select * from public.ibnm_ebd_relatorios')).linhas.length === 1, 'ADM da EBD vê todos os relatórios');
    ok((await tenta(EBD, "insert into public.ibnm_ebd_relatorios (sala_id, caminho) values (null, 'ebd/relatorios/geral/b.jpg') returning id")).ok, 'ADM da EBD envia relatório geral');
  }

  console.log('\n== 8. Mural, materiais e fotos das seções ==');
  {
    const ebdId = (await direto("select id from public.ibnm_secoes where chave = 'ebd'"))[0].id;
    ok((await tenta(JOV, "insert into public.ibnm_secao_posts (secao_id, titulo, texto) values ($1, 'Retiro', 'Dia 20') returning autor", [secJovens])).linhas[0].autor === 'Júlia Jovens', 'ADM de "Jovens" publica no mural da seção');
    ok(!(await tenta(JOV, "insert into public.ibnm_secao_posts (secao_id, titulo) values ($1, 'X')", [ebdId])).ok, '…mas não publica no mural de outra seção');
    ok(!(await tenta(MEM, "insert into public.ibnm_secao_posts (secao_id, titulo) values ($1, 'X')", [secJovens])).ok, 'membro não publica no mural');
    await tenta(JOV, "insert into public.ibnm_secao_posts (secao_id, titulo, publicado) values ($1, 'Rascunho', false)", [secJovens]);
    ok((await tenta(null, 'select * from public.ibnm_secao_posts')).linhas.length === 1, 'visitante lê o mural publicado (rascunho não)');
    ok((await tenta(JOV, 'select * from public.ibnm_secao_posts')).linhas.length === 2, 'ADM da seção vê também o rascunho');
    const mv = await tenta(JOV, "update public.ibnm_secao_posts set secao_id = $1 where titulo = 'Retiro' returning secao_id", [ebdId]);
    ok(mv.linhas.length === 1 && mv.linhas[0].secao_id === secJovens, 'post não pode ser movido para outra seção');

    ok((await tenta(JOV, "insert into public.ibnm_secao_materiais (secao_id, titulo, tipo, url) values ($1, 'Apostila', 'link', 'https://x') returning id", [secJovens])).ok, 'ADM de "Jovens" publica material');
    const mp = await tenta(PROF, "insert into public.ibnm_secao_materiais (secao_id, sala_id, titulo, tipo, url) values ($1, $2, 'Lição 3', 'pdf', 'https://x/licao.pdf') returning id", [ebdId, salaA]);
    ok(mp.ok, 'professora publica material da própria sala');
    ok(!(await tenta(PROF, "insert into public.ibnm_secao_materiais (secao_id, sala_id, titulo) values ($1, $2, 'X')", [ebdId, salaB])).ok, 'professora não publica material em outra sala');
    ok(!(await tenta(PROF, "insert into public.ibnm_secao_materiais (secao_id, titulo) values ($1, 'X')", [ebdId])).ok, 'professora não publica material geral da EBD');
    ok(!(await tenta(PROF, "insert into public.ibnm_secao_materiais (secao_id, sala_id, titulo) values ($1, $2, 'X')", [secJovens, salaA])).ok, 'professora não usa a sala para publicar em outra seção');
    ok((await tenta(EBD, "insert into public.ibnm_secao_materiais (secao_id, titulo, tipo, url) values ($1, 'Revista do trimestre', 'link', 'https://x') returning id", [ebdId])).ok, 'ADM da EBD publica material geral');
    const sj = await tenta(JOV, "insert into public.ibnm_secao_materiais (secao_id, sala_id, titulo) values ($1, $2, 'Sem sala') returning sala_id", [secJovens, salaA]);
    ok(sj.ok && sj.linhas[0].sala_id === null, 'fora da EBD, material nunca fica preso a uma sala');
    ok((await tenta(null, 'select * from public.ibnm_secao_materiais')).linhas.length === 4, 'visitante lê os materiais publicados');
    ok((await tenta(PROF, "update public.ibnm_secao_materiais set titulo = 'Lição 3 (revisada)' where id = $1 returning id", [mp.linhas[0].id])).n === 1, 'professora edita o próprio material');
    ok((await tenta(AL1, "update public.ibnm_secao_materiais set titulo = 'hack' returning id")).n === 0, 'aluna não edita materiais');

    const f = await tenta(PROF, "insert into public.ibnm_secao_fotos (secao_id, sala_id, url, caminho) values ($1, $2, 'https://x/f.jpg', 'secoes/ebd/x/f.jpg') returning id", [ebdId, salaA]);
    ok(f.ok, 'professora publica foto da sala');
    ok((await tenta(JOV, "insert into public.ibnm_secao_fotos (secao_id, url) values ($1, 'https://x/j.jpg') returning id", [secJovens])).ok, 'ADM de "Jovens" publica foto');
    ok(!(await tenta(AL1, "insert into public.ibnm_secao_fotos (secao_id, sala_id, url) values ($1, $2, 'x')", [ebdId, salaA])).ok, 'aluna não publica foto');
    const semLogin = await tenta(null, 'select * from public.ibnm_secao_fotos');
    ok(semLogin.linhas.length === 0, 'visitante NÃO vê fotos (só quem está logado)');
    ok((await tenta(MEM, 'select * from public.ibnm_secao_fotos')).linhas.length === 2, 'membro logado vê as fotos');

    await tenta(P, 'update public.ibnm_secoes set ativo = false where id = $1', [secJovens]);
    ok((await tenta(null, 'select * from public.ibnm_secao_posts')).linhas.length === 0, 'seção desativada: mural some para o público');
    ok((await tenta(MEM, 'select * from public.ibnm_secao_fotos')).linhas.length === 1, 'seção desativada: fotos somem para os membros');
    ok((await tenta(JOV, 'select * from public.ibnm_secao_posts')).linhas.length === 2, '…mas o ADM da seção continua vendo');
    await tenta(P, 'update public.ibnm_secoes set ativo = true where id = $1', [secJovens]);
  }

  console.log('\n== 9. Arquivos (fotos, comprovantes e relatórios) ==');
  {
    const VIS = await criarPessoa(c, 'Vera Visitante', 'vera@teste.com');     // membro sem nenhum papel
    const sobe = (uid, bucket, nome) => tenta(uid, 'insert into storage.objects (bucket_id, name, owner, owner_id) values ($1, $2, $3, $4) returning id', [bucket, nome, uid, uid]);
    ok((await sobe(MEM, 'igreja', 'comprovantes/' + MEM + '/1.jpg')).ok, 'membro envia o próprio comprovante');
    ok(!(await sobe(MEM, 'igreja', 'comprovantes/' + AL1 + '/1.jpg')).ok, 'membro não envia arquivo na pasta de outra pessoa');
    ok(!(await sobe(AL1, 'igreja', 'ebd/relatorios/' + salaA + '/x.jpg')).ok, 'aluna não envia arquivo na pasta de relatórios');
    ok((await sobe(PROF, 'igreja', 'ebd/relatorios/' + salaA + '/r1.jpg')).ok, 'professora envia a foto do relatório da sala');
    ok(!(await sobe(PROF, 'igreja', 'ebd/relatorios/' + salaB + '/r1.jpg')).ok, 'professora não envia relatório de outra sala');
    ok(!(await sobe(PROF, 'igreja', 'ebd/relatorios/geral/r1.jpg')).ok, 'professora não envia relatório geral');
    ok((await sobe(EBD, 'igreja', 'ebd/relatorios/geral/r2.jpg')).ok, 'ADM da EBD envia relatório geral');
    ok((await tenta(TES, "select * from storage.objects where bucket_id = 'igreja'")).linhas.length === 1, 'tesoureiro (Ofertas) vê os comprovantes — e só eles');
    ok((await tenta(SEC, "select * from storage.objects where bucket_id = 'igreja'")).linhas.length === 0, 'secretária não vê arquivos privados');
    ok((await tenta(AL1, "select * from storage.objects where bucket_id = 'igreja'")).linhas.length === 0, 'aluna não vê arquivos privados');
    ok((await tenta(PROF, "select * from storage.objects where bucket_id = 'igreja'")).linhas.length === 1, 'professora vê só os relatórios da própria sala');
    ok((await tenta(EBD, "select * from storage.objects where bucket_id = 'igreja'")).linhas.length === 2, 'ADM da EBD vê todos os relatórios (não os comprovantes)');
    ok((await tenta(P, "select * from storage.objects where bucket_id = 'igreja'")).linhas.length === 3, 'ADM principal vê tudo');

    ok(!(await sobe(VIS, 'igreja-publico', 'secoes/jovens/geral/x.jpg')).ok, 'membro comum não envia imagem pública (correção)');
    ok(!(await sobe(AL1, 'igreja-publico', 'qualquer/x.jpg')).ok, 'aluna não envia imagem pública');
    ok((await sobe(AL1, 'igreja-publico', 'perfis/' + AL1 + '/foto.jpg')).ok, '…só a própria foto de perfil');
    ok((await sobe(JOV, 'igreja-publico', 'secoes/jovens/geral/x.jpg')).ok, 'ADM de seção envia imagem pública');
    ok((await sobe(PROF, 'igreja-publico', 'secoes/ebd/' + salaA + '/y.jpg')).ok, 'professora envia foto da sala');
    ok((await sobe(P, 'igreja-publico', 'palavras/1.jpg')).ok, 'ADM principal envia imagem do painel (como na versão 1.0)');
    ok((await tenta(null, "select * from storage.objects where bucket_id = 'igreja-publico'")).linhas.length === 4, 'imagens públicas continuam abertas');
    ok((await tenta(PROF, "delete from storage.objects where name = 'secoes/jovens/geral/x.jpg' returning id")).n === 0, 'professora não apaga imagem de outra seção');
    ok((await tenta(JOV, "delete from storage.objects where name = 'secoes/jovens/geral/x.jpg' returning id")).n === 1, 'ADM da seção apaga a própria imagem');
    ok((await tenta(PROF, "delete from storage.objects where name = $1 returning id", ['secoes/ebd/' + salaA + '/y.jpg'])).n === 1, 'professora apaga foto da própria sala');
    ok((await tenta(PROF, "delete from storage.objects where name = $1 returning id", ['ebd/relatorios/' + salaA + '/r1.jpg'])).n === 1, 'professora apaga o relatório que enviou');
  }

  console.log('\n== 10. Limpeza e repetição ==');
  {
    ok((await tenta(P, 'delete from public.ibnm_perfis where id = $1 returning id', [AL1])).n === 1, 'ADM principal apaga um perfil');
    const orf = await direto('select user_id, nome, status from public.ibnm_ebd_matriculas where id = $1', [mAna]);
    ok(orf.length === 1 && orf[0].user_id === null && orf[0].nome === 'Ana Aluna', 'a matrícula continua como "aluno sem conta" (histórico preservado)');
    ok((await tenta(EBD, 'delete from public.ibnm_ebd_salas where id = $1 returning id', [salaB])).n === 1, 'ADM da EBD exclui uma sala (leva matrículas e aulas junto)');
    ok((await tenta(P, 'delete from public.ibnm_secoes where id = $1 returning id', [secJovens])).n === 1, 'ADM principal exclui a seção "Jovens" com todo o conteúdo');
    ok((await direto('select count(*)::int n from public.ibnm_secao_posts'))[0].n === 0, 'mural da seção excluída foi junto');

    const antes = await direto("select (select count(*) from public.ibnm_secoes)::int s, (select count(*) from public.ibnm_ebd_salas)::int e, (select count(*) from public.ibnm_config)::int c, (select count(*) from public.ibnm_palavras)::int p, (select count(*) from public.ibnm_eventos)::int ev");
    await c.query(b.ler('sql/01-base.sql'));
    await c.query(b.ler('sql/02-secoes-ebd.sql'));
    const depois = await direto("select (select count(*) from public.ibnm_secoes)::int s, (select count(*) from public.ibnm_ebd_salas)::int e, (select count(*) from public.ibnm_config)::int c, (select count(*) from public.ibnm_palavras)::int p, (select count(*) from public.ibnm_eventos)::int ev");
    ok(JSON.stringify(antes) === JSON.stringify(depois), 'rodar os dois arquivos SQL de novo não duplica nem apaga nada');
    ok((await tenta(SEC, "insert into public.ibnm_eventos (titulo, data) values ('Depois de repetir', current_date) returning id")).ok, 'as permissões continuam valendo depois de repetir');
  }

  await b.parar();
  console.log(falhas ? '\n❌ ' + falhas + ' TESTE(S) FALHARAM' : '\n✅ TODAS AS REGRAS DO BANCO PASSARAM');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('\nERRO NO TESTE:', e.message); process.exit(1); });
