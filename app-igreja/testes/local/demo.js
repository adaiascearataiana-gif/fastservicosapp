/* Conteúdo de exemplo para o servidor local (node testes/local/servidor.js --demo).
   Cria pessoas, salas, chamadas, materiais e fotos de mentira para ver o app "cheio".
   Tudo é feito pelo mesmo caminho que o app usa (login + regras do banco), então
   também serve de teste: se alguma permissão estiver errada, este arquivo falha.

   Todas as contas usam a senha 123456. */

const CONTAS = [
  'adaias@teste.com (ADM principal)',
  'sara@teste.com (ADM de Agenda e Avisos)',
  'edu@teste.com (ADM da Escola Bíblica)',
  'julia@teste.com (ADM da seção Missões)',
  'paula@teste.com (professora da sala Jovens)',
  'ana@teste.com (aluna da sala Jovens)',
  'pedro@teste.com (pediu para ser professor)',
  'marcos@teste.com (membro comum)'
];

const dois = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate());
function domingo(semanasAtras) {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() - 7 * (semanasAtras || 0));
  return iso(d);
}
function emDias(n) { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); }

/* "foto" de mentira (desenho simples), só para a galeria não ficar vazia */
function desenho(titulo, cor1, cor2, pessoas) {
  let gente = '';
  for (let i = 0; i < (pessoas || 5); i++) {
    const x = 110 + i * (580 / Math.max(1, (pessoas || 5) - 1));
    const alto = 330 + (i % 2) * 26;
    gente += `<circle cx="${x}" cy="${alto}" r="36" fill="#fff" fill-opacity=".92"/>` +
      `<rect x="${x - 50}" y="${alto + 42}" width="100" height="150" rx="46" fill="#fff" fill-opacity=".85"/>`;
  }
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cor1}"/><stop offset="1" stop-color="${cor2}"/></linearGradient></defs>` +
    `<rect width="800" height="600" fill="url(#g)"/><circle cx="660" cy="120" r="64" fill="#fff" fill-opacity=".25"/>` +
    gente +
    `<rect x="0" y="520" width="800" height="80" fill="#000" fill-opacity=".28"/>` +
    `<text x="400" y="570" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#fff">${titulo}</text></svg>`, 'utf8');
}

/* "foto do relatório" de mentira: uma folha com linhas */
function folha(titulo, linhas) {
  let y = 150, corpo = '';
  linhas.forEach((l) => {
    corpo += `<text x="70" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#1b2a24">${l}</text>` +
      `<line x1="60" y1="${y + 14}" x2="740" y2="${y + 14}" stroke="#c9d6cf" stroke-width="2"/>`;
    y += 62;
  });
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000"><rect width="800" height="1000" fill="#fbfaf4"/>` +
    `<rect x="30" y="30" width="740" height="940" rx="14" fill="#fff" stroke="#d9d2b8" stroke-width="3"/>` +
    `<text x="400" y="92" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700" fill="#0b4a3a">${titulo}</text>` +
    corpo + `</svg>`, 'utf8');
}

async function povoar(s) {
  const base = 'http://127.0.0.1:' + s.servidor.address().port;

  /* cliente bem pequeno, igual ao que o app faz */
  async function pedir(metodo, caminho, corpo, token, cab) {
    const h = Object.assign({ apikey: 'demo' }, cab || {});
    if (token) h.Authorization = 'Bearer ' + token;
    let body;
    if (Buffer.isBuffer(corpo)) body = corpo;
    else if (corpo !== undefined && corpo !== null) { body = JSON.stringify(corpo); h['Content-Type'] = 'application/json'; }
    const r = await fetch(base + caminho, { method: metodo, headers: h, body });
    const txt = await r.text();
    let dados = null;
    try { dados = txt ? JSON.parse(txt) : null; } catch (e) { dados = txt; }
    if (!r.ok) throw new Error(metodo + ' ' + caminho + ' -> ' + r.status + ' ' + txt.slice(0, 300));
    return dados;
  }
  const entrar = async (email) => (await pedir('POST', '/auth/v1/token?grant_type=password', { email, password: '123456' })).access_token;
  const inserir = (t, tabela, dados) => pedir('POST', '/rest/v1/' + tabela, dados, t, { Prefer: 'return=representation' }).then((r) => r[0]);
  const mudar = (t, tabela, filtro, dados) => pedir('PATCH', '/rest/v1/' + tabela + '?' + filtro, dados, t, { Prefer: 'return=representation' });
  const listar = (t, tabela, filtro) => pedir('GET', '/rest/v1/' + tabela + '?select=*' + (filtro ? '&' + filtro : ''), null, t);
  const rpc = (t, nome, args) => pedir('POST', '/rest/v1/rpc/' + nome, args || {}, t);
  const subir = (t, bucket, caminho, dados, tipo) => pedir('POST', '/storage/v1/object/' + bucket + '/' + caminho, dados, t, { 'Content-Type': tipo || 'image/svg+xml', 'x-upsert': 'true' });
  /* endereço sem o nome do servidor: funciona em localhost e em qualquer endereço de pré-visualização */
  const publico = (caminho) => '/storage/v1/object/public/igreja-publico/' + caminho;

  /* ---------------- pessoas (a primeira conta vira ADM principal) ---------------- */
  const id = {};
  const pessoas = [
    ['adaias', 'Adaias Medeiros', '85999990001', '1988-03-12'],
    ['sara', 'Sara Lima', '85999990002', '1992-11-20'],
    ['edu', 'Eduardo Sousa', '85999990003', '1979-07-02'],
    ['julia', 'Júlia Costa', '85999990004', '1998-01-28'],
    ['paula', 'Paula Rocha', '85999990005', '1990-11-05'],
    ['ana', 'Ana Beatriz Nunes', '85999990006', '2004-09-17'],
    ['pedro', 'Pedro Henrique Alves', '85999990007', '1995-05-30'],
    ['marcos', 'Marcos Silva', '85999990008', '1985-11-23']
  ];
  for (const p of pessoas) {
    id[p[0]] = await s.criarPessoa(p[1], p[0] + '@teste.com', '123456');
    await s.interno('update public.ibnm_perfis set telefone = $2, nascimento = $3, cidade = $4 where id = $1', [id[p[0]], p[2], p[3], 'Caucaia/CE']);
  }
  const T = {};
  for (const p of pessoas) T[p[0]] = await entrar(p[0] + '@teste.com');

  /* ---------------- dados da igreja (ADM principal) ---------------- */
  const cfg = (await listar(T.adaias, 'ibnm_config', 'chave=eq.igreja'))[0].valor;
  Object.assign(cfg, {
    pastor: 'Pr. João Batista', endereco: 'Rua das Acácias', numero: '250', bairro: 'Nova Metrópole', cidade: 'Caucaia', uf: 'CE', cep: '61600-000',
    whatsapp: '85999990001', boas_vindas: 'Que bom ter você aqui! Acompanhe a vida da nossa igreja.',
    horarios: [{ dia: 'Domingo', hora: '09:00', titulo: 'Escola Bíblica Dominical' }, { dia: 'Domingo', hora: '18:00', titulo: 'Culto de Celebração' }, { dia: 'Quarta-feira', hora: '19:30', titulo: 'Culto de Oração e Ensino' }],
    links: Object.assign({}, cfg.links || {}, { instagram: 'https://instagram.com/ibnm', youtube: 'https://youtube.com/@ibnm' }),
    pix: Object.assign({}, cfg.pix || {}, { chave: '85999990001', tipo: 'telefone', nome: 'IGREJA BATISTA EM NOVA METROPOLE', cidade: 'CAUCAIA' })
  });
  await mudar(T.adaias, 'ibnm_config', 'chave=eq.igreja', { valor: cfg });

  await pedir('POST', '/rest/v1/ibnm_devocionais?on_conflict=data', {
    data: iso(new Date()), titulo: 'A esperança que não decepciona',
    versiculo: 'Os que esperam no Senhor renovarão as suas forças.', referencia: 'Isaías 40:31',
    texto: 'Esperar no Senhor não é ficar parado: é confiar enquanto caminhamos. Hoje, entregue a Ele o que tem pesado no seu coração.',
    autor: 'Pr. João Batista', publicado: true
  }, T.adaias, { Prefer: 'resolution=merge-duplicates,return=representation' });
  await mudar(T.adaias, 'ibnm_eventos', 'id=not.is.null', { publicado: true });
  await inserir(T.adaias, 'ibnm_eventos', { titulo: 'Congresso de Missões', descricao: 'Três noites de louvor, palavra e desafio missionário.', categoria: 'especial', data: emDias(6), hora: '19:00', local: 'Templo', destaque: true });
  await mudar(T.adaias, 'ibnm_avisos', 'id=not.is.null', { publicado: true });
  await mudar(T.adaias, 'ibnm_palavras', 'id=not.is.null', { publicado: true });

  /* ---------------- ADM principal cria seção e libera acessos ---------------- */
  const secoes = await listar(T.adaias, 'ibnm_secoes');
  const sec = (chave) => secoes.find((x) => x.chave === chave);
  const missoes = await inserir(T.adaias, 'ibnm_secoes', { nome: 'Missões', icone: '🌍', descricao: 'Projetos, missionários e campanhas de oração.', ordem: 200 });
  const louvor = await inserir(T.adaias, 'ibnm_secoes', { nome: 'Louvor', icone: '🎵', descricao: 'Escalas, ensaios e repertório.', ordem: 210, no_inicio: false });
  for (const [quem, chaves] of [['sara', ['eventos', 'avisos']], ['edu', ['ebd']]]) {
    for (const ch of chaves) await inserir(T.adaias, 'ibnm_secao_adms', { secao_id: sec(ch).id, user_id: id[quem] });
  }
  await inserir(T.adaias, 'ibnm_secao_adms', { secao_id: missoes.id, user_id: id.julia });
  await inserir(T.adaias, 'ibnm_secao_adms', { secao_id: louvor.id, user_id: id.julia });

  /* ---------------- Escola Bíblica (ADM da seção: Eduardo) ---------------- */
  await mudar(T.edu, 'ibnm_config', 'chave=eq.ebd', {
    valor: { horario: 'Domingos, às 9h', tema: 'A vida de Jesus nos Evangelhos', revista: 'Compromisso — 4º trimestre', aviso: 'Venha estudar a Bíblia com a gente. Há uma sala para cada idade!' }
  });
  await mudar(T.edu, 'ibnm_ebd_salas', 'id=not.is.null', { ativo: true });
  const salas = await listar(T.edu, 'ibnm_ebd_salas', 'order=ordem.asc');
  const sala = (nome) => salas.find((x) => x.nome === nome);
  const ebd = sec('ebd');

  await inserir(T.edu, 'ibnm_ebd_matriculas', { sala_id: sala('Jovens').id, user_id: id.paula, papel: 'professor', status: 'ativo' });
  await inserir(T.edu, 'ibnm_ebd_matriculas', { sala_id: sala('Adultos').id, user_id: id.edu, papel: 'professor', status: 'ativo' });
  await rpc(T.pedro, 'ibnm_ebd_matricular', { p_sala: sala('Adolescentes').id, p_papel: 'professor' });   // fica aguardando
  await rpc(T.ana, 'ibnm_ebd_matricular', { p_sala: sala('Jovens').id, p_papel: 'aluno' });
  await rpc(T.marcos, 'ibnm_ebd_matricular', { p_sala: sala('Adultos').id, p_papel: 'aluno' });

  const nomes = {
    Jovens: ['Bruno Carvalho', 'Camila Freitas', 'Daniel Moreira', 'Estela Ribeiro', 'Felipe Araújo', 'Gabriela Pinto', 'Hugo Martins'],
    Adultos: ['Irene Barbosa', 'José Ferreira', 'Lúcia Gomes', 'Manoel Teixeira', 'Neide Cavalcante', 'Osvaldo Lima', 'Rita Fernandes', 'Sebastião Dias'],
    Adolescentes: ['Alice Monteiro', 'Caio Duarte', 'Larissa Queiroz', 'Mateus Vieira', 'Sofia Brandão'],
    'Crianças': ['Arthur Sales', 'Helena Paiva', 'Isaac Nogueira', 'Laura Mendes', 'Miguel Castro', 'Valentina Reis']
  };
  for (const nomeSala of Object.keys(nomes)) {
    for (const n of nomes[nomeSala]) {
      await inserir(nomeSala === 'Jovens' ? T.paula : T.edu, 'ibnm_ebd_matriculas', {
        sala_id: sala(nomeSala).id, nome: n, telefone: nomeSala === 'Crianças' ? '' : '8598888' + String(1000 + Math.floor(Math.random() * 8999)),
        responsavel: nomeSala === 'Crianças' ? 'Mãe de ' + n.split(' ')[0] : ''
      });
    }
  }

  /* chamadas: a professora faz as da sala dela; o ADM da EBD faz as outras */
  const chamada = async (t, nomeSala, data, faltam, dados) => {
    const alunos = await listar(t, 'ibnm_ebd_matriculas', 'sala_id=eq.' + sala(nomeSala).id + '&papel=eq.aluno&status=eq.ativo&order=nome.asc');
    return rpc(t, 'ibnm_ebd_salvar_chamada', {
      p_sala: sala(nomeSala).id, p_data: data, p_dados: dados,
      p_presencas: alunos.map((a, i) => ({ m: a.id, p: !faltam.includes(i) }))
    });
  };
  await chamada(T.paula, 'Jovens', domingo(2), [1, 4], { tema: 'Lição 5 — O chamado dos discípulos', professor: 'Paula Rocha', visitantes: 1, biblias: 5, revistas: 4, oferta: 32.5 });
  await chamada(T.paula, 'Jovens', domingo(1), [6], { tema: 'Lição 6 — O sermão do monte', professor: 'Paula Rocha', visitantes: 2, biblias: 7, revistas: 6, oferta: 41 });
  await chamada(T.paula, 'Jovens', domingo(0), [2, 5], { tema: 'Lição 7 — As parábolas do Reino', professor: 'Paula Rocha', visitantes: 3, biblias: 6, revistas: 5, oferta: 38 });
  await chamada(T.edu, 'Adultos', domingo(0), [3], { tema: 'Lição 7 — As parábolas do Reino', professor: 'Eduardo Sousa', visitantes: 1, biblias: 8, revistas: 8, oferta: 96.4 });
  await chamada(T.edu, 'Crianças', domingo(0), [0, 4], { tema: 'Jesus e as crianças', professor: 'Tia Rute', visitantes: 2, biblias: 3, revistas: 0, oferta: 12 });

  /* materiais */
  await inserir(T.edu, 'ibnm_secao_materiais', { secao_id: ebd.id, titulo: 'Calendário das lições do trimestre', tipo: 'texto', descricao: 'Para todas as salas', data: domingo(2),
    texto: 'Lição 5 — O chamado dos discípulos\nLição 6 — O sermão do monte\nLição 7 — As parábolas do Reino\nLição 8 — Os milagres de Jesus\nLição 9 — A última ceia' });
  await inserir(T.edu, 'ibnm_secao_materiais', { secao_id: ebd.id, titulo: 'Como estudar a lição durante a semana', tipo: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', descricao: 'Vídeo de 8 minutos', data: domingo(1) });
  await inserir(T.paula, 'ibnm_secao_materiais', { secao_id: ebd.id, sala_id: sala('Jovens').id, titulo: 'Lição 7 — As parábolas do Reino', tipo: 'texto', data: domingo(0),
    descricao: 'Resumo e perguntas para a semana', texto: 'Texto base: Mateus 13.\n\n1. O que a parábola do semeador ensina sobre ouvir a Palavra?\n2. Em que "solo" o seu coração está hoje?\n3. Versículo para decorar: Mateus 13:23.' });
  await inserir(T.paula, 'ibnm_secao_materiais', { secao_id: ebd.id, sala_id: sala('Jovens').id, titulo: 'Leitura complementar (PDF)', tipo: 'pdf', url: 'https://example.com/licao7.pdf', data: domingo(0) });

  /* mural e fotos */
  await inserir(T.edu, 'ibnm_secao_posts', { secao_id: ebd.id, titulo: 'Domingo da família na Escola Bíblica', texto: 'No próximo domingo todas as salas se reúnem no templo às 9h. Traga um visitante!', fixado: true });
  const fotosDemo = [
    ['Jovens', domingo(0), 'Aula das parabolas', '#0f6b50', '#c9a227', 6],
    ['Jovens', domingo(0), 'Dinamica em grupo', '#12866a', '#0b4a3a', 4],
    ['Jovens', domingo(1), 'Sermao do monte', '#2a6f97', '#0b4a3a', 5],
    ['Crianças', domingo(0), 'Jesus e as criancas', '#e07a5f', '#f2cc8f', 7],
    ['Adultos', domingo(0), 'Classe de adultos', '#3d405b', '#81b29a', 6]
  ];
  let n = 0;
  for (const f of fotosDemo) {
    const t = f[0] === 'Jovens' ? T.paula : T.edu;
    const caminho = 'secoes/ebd/' + sala(f[0]).id + '/demo-' + (++n) + '.svg';
    await subir(t, 'igreja-publico', caminho, desenho(f[2], f[3], f[4], f[5]));
    await inserir(t, 'ibnm_secao_fotos', { secao_id: ebd.id, sala_id: sala(f[0]).id, url: publico(caminho), caminho, legenda: f[2].replace('parabolas', 'parábolas').replace('Dinamica', 'Dinâmica').replace('Sermao', 'Sermão').replace('criancas', 'crianças'), data: f[1] });
  }

  /* fotos de relatório (arquivo reservado) */
  const rel = 'ebd/relatorios/' + sala('Jovens').id + '/demo-relatorio.svg';
  await subir(T.paula, 'igreja', rel, folha('Relatorio - Jovens', ['Matriculados: 8', 'Presentes: 6', 'Ausentes: 2', 'Visitantes: 3', 'Biblias: 6    Revistas: 5', 'Oferta: R$ 38,00', 'Professora: Paula Rocha']));
  await inserir(T.paula, 'ibnm_ebd_relatorios', { sala_id: sala('Jovens').id, data: domingo(0), titulo: 'Caderneta da classe', caminho: rel });
  const relGeral = 'ebd/relatorios/geral/demo-geral.svg';
  await subir(T.edu, 'igreja', relGeral, folha('Relatorio geral da EBD', ['Adultos: 8 presentes', 'Jovens: 6 presentes', 'Criancas: 4 presentes', 'Visitantes: 6', 'Oferta total: R$ 146,40']));
  await inserir(T.edu, 'ibnm_ebd_relatorios', { sala_id: null, data: domingo(0), titulo: 'Quadro geral', caminho: relGeral });

  /* ---------------- seção Missões (ADM da seção: Júlia) ---------------- */
  await inserir(T.julia, 'ibnm_secao_posts', { secao_id: missoes.id, titulo: 'Campanha de oração pelos missionários', texto: 'Durante este mês vamos orar todos os dias, às 21h, pelas famílias missionárias que a igreja sustenta.', fixado: true });
  await inserir(T.julia, 'ibnm_secao_posts', { secao_id: missoes.id, titulo: 'Arrecadação de alimentos', texto: 'Traga 1 kg de alimento não perecível até o próximo domingo. As cestas vão para o projeto do sertão.' });
  await inserir(T.julia, 'ibnm_secao_materiais', { secao_id: missoes.id, titulo: 'Carta do campo — novembro', tipo: 'texto', data: emDias(-3), texto: 'Queridos irmãos, graças a Deus abrimos um novo ponto de pregação. Orem pelas crianças do projeto e pela saúde da nossa equipe.' });
  const capa = 'secoes/missoes/geral/demo-1.svg';
  await subir(T.julia, 'igreja-publico', capa, desenho('Culto de missoes', '#264653', '#2a9d8f', 5));
  await inserir(T.julia, 'ibnm_secao_fotos', { secao_id: missoes.id, url: publico(capa), caminho: capa, legenda: 'Culto de missões', data: emDias(-7) });

  /* ---------------- um pouco de movimento de membro comum ---------------- */
  await inserir(T.marcos, 'ibnm_oracoes', { nome: 'Marcos Silva', pedido: 'Peço oração pela saúde da minha mãe.', privado: true });
  await inserir(T.marcos, 'ibnm_ofertas', { nome: 'Marcos Silva', valor: 50, tipo: 'Dízimo' });

  return { id, salas, secoes: await listar(T.adaias, 'ibnm_secoes'), tokens: T };
}

module.exports = { povoar, CONTAS };
