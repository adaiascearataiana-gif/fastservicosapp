/* Teste automatizado do app (sem navegador).
   Uso:  node testes/testar.js       (precisa do jsdom instalado)
   Confere as telas com um banco de mentira. As regras de permissão do banco
   de verdade são testadas em testes/local/testar-banco.js. */
const fs = require('fs');
const path = require('path');
function carregarJsdom() {
  const tentativas = [process.env.JSDOM, 'jsdom', '/tmp/jsdomtest/node_modules/jsdom'].filter(Boolean);
  for (const caminho of tentativas) {
    try { return require(caminho); } catch (e) {}
  }
  console.log('Instale o jsdom para rodar os testes:  npm install jsdom');
  process.exit(1);
}
const { JSDOM } = carregarJsdom();

const RAIZ = path.join(__dirname, '..');
const pasta = (f) => path.join(RAIZ, f);
let falhas = 0;

function ok(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { falhas++; console.log('  ✗ ' + msg); }
}

const CONFIG = {
  nome: 'Igreja Batista em Nova Metrópole', sigla: 'IBNM', pastor: 'Pastor Teste',
  endereco: 'Rua das Flores', numero: '100', bairro: 'Nova Metrópole', cidade: 'Caucaia', uf: 'CE', cep: '61600-000',
  telefone: '(85) 3333-4444', whatsapp: '85999998888', email: 'contato@ibnm.com',
  boas_vindas: 'Que bom ter você aqui!',
  horarios: [{ dia: 'Domingo', hora: '18:00', titulo: 'Culto de Celebração' }],
  links: { instagram: 'https://instagram.com/ibnm', youtube: 'https://youtube.com/@ibnm', facebook: '', site: '', maps: '' },
  pix: { chave: '85999998888', tipo: 'telefone', nome: 'IGREJA BATISTA EM NOVA METROPOLE', cidade: 'CAUCAIA', mensagem: 'Oferte com alegria' },
  oferta: { ativa: true, tipos: ['Dízimo', 'Oferta'], texto: 'Escolha o valor' },
  radio: { ativa: false, ao_vivo: false, nome: 'Rádio IBNM', url: '', capa: '', mensagem: 'Ouça' }
};

const hoje = new Date();
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const perfil = {
  id: '11111111-1111-1111-1111-111111111111', nome: 'Maria da Silva', email: 'maria@teste.com',
  telefone: '85988887777', nascimento: '1990-05-04', casamento: null, endereco: '', numero: '', bairro: '', cidade: '',
  cep: '', foto_url: '', is_adm: true, origem: 'email'
};

function resposta(dados, status) {
  return Promise.resolve({
    ok: (status || 200) < 400,
    status: status || 200,
    text: () => Promise.resolve(JSON.stringify(dados)),
    json: () => Promise.resolve(dados)
  });
}

/* ---------- versão 1.1: seções, ADMs e Escola Bíblica ---------- */
const painel = (chave, nome, icone, ordem) => ({ id: 's-' + chave, chave, nome, icone, descricao: '', tipo: 'painel', ordem, ativo: true, no_inicio: false, sistema: true });
const SECOES = [
  painel('igreja', 'Dados da igreja', '⛪', 10), painel('pix', 'PIX e oferta', '💚', 20), painel('radio', 'Rádio', '📻', 30),
  painel('devocional', 'Devocional', '📖', 40), painel('eventos', 'Agenda', '📅', 50), painel('palavra', 'Palavra pastoral', '💬', 60),
  painel('avisos', 'Avisos', '📌', 70), painel('oracoes', 'Pedidos de oração', '🙏', 80), painel('ofertas', 'Ofertas recebidas', '💰', 90),
  painel('membros', 'Membros', '👥', 100),
  { id: 's-ebd', chave: 'ebd', nome: 'Escola Bíblica Dominical', icone: '🎓', descricao: 'Salas, materiais, fotos, chamada e relatórios.', tipo: 'ebd', ordem: 110, ativo: true, no_inicio: true, sistema: true },
  { id: 's-missoes', chave: 'missoes', nome: 'Missões', icone: '🌍', descricao: 'Projetos e campanhas de oração.', tipo: 'livre', ordem: 500, ativo: true, no_inicio: true, sistema: false }
];
const SALAS = [
  { id: 'sala-adultos', nome: 'Adultos', descricao: 'Estudo para adultos', faixa: 'A partir de 25 anos', local: 'Templo', icone: '📘', ordem: 10, ativo: true },
  { id: 'sala-jovens', nome: 'Jovens', descricao: 'Estudo e conversa', faixa: '18 a 24 anos', local: 'Sala 2', icone: '🔥', ordem: 20, ativo: true }
];
const RESUMO = [
  { sala_id: 'sala-adultos', alunos: 9, professores: 'Eduardo Sousa' },
  { sala_id: 'sala-jovens', alunos: 3, professores: 'Paula Rocha' }
];
const EBD_CONFIG = { horario: 'Domingos, às 9h', tema: 'A vida de Jesus', revista: 'Compromisso', aviso: '' };
const ALUNOS = [
  { id: 'm1', sala_id: 'sala-jovens', user_id: null, nome: 'Ana Beatriz', papel: 'aluno', status: 'ativo', telefone: '85911112222', nascimento: '2004-09-17', responsavel: '', observacao: '' },
  { id: 'm2', sala_id: 'sala-jovens', user_id: null, nome: 'Bruno Carvalho', papel: 'aluno', status: 'ativo', telefone: '', nascimento: null, responsavel: '', observacao: '' },
  { id: 'm3', sala_id: 'sala-jovens', user_id: null, nome: 'Camila Freitas', papel: 'aluno', status: 'ativo', telefone: '', nascimento: null, responsavel: '', observacao: '' },
  { id: 'm9', sala_id: 'sala-jovens', user_id: perfil.id, nome: 'Maria da Silva', papel: 'professor', status: 'ativo', telefone: '', nascimento: null, responsavel: '', observacao: '' }
];
const MATRICULA = (papel, status) => ({ id: 'm9', sala_id: 'sala-jovens', sala: 'Jovens', icone: '🔥', papel, status: status || 'ativo' });
const CLIMA = {
  current: { temperature_2m: 29.4, apparent_temperature: 33.1, relative_humidity_2m: 70, weather_code: 2, is_day: 1, wind_speed_10m: 18 },
  daily: { temperature_2m_max: [31.2], temperature_2m_min: [24.8], precipitation_probability_max: [20] }
};

/* cenario: { perfil, acesso, v10, sessaoMorta }
     perfil  = dados da pessoa logada (padrão: Maria, ADM principal)
     acesso  = resposta de ibnm_meu_acesso (seções liberadas e salas)
     v10     = true para imitar um banco que ainda não recebeu o sql/02 (tabelas novas não existem)
     sessaoMorta = o servidor recusa a sessão guardada no aparelho (foi cancelada, ou o app passou a usar
                   outro banco). true: recusa também a renovação (caso normal);  'servidor-fora': a renovação
                   cai num servidor fora do ar;  'chave': a renovação reclama da chave do app;
                   'bloqueio': a renovação esbarra numa página de bloqueio (não é resposta do login). */
function criarMock(cenario) {
  cenario = cenario || {};
  const eu = cenario.perfil || perfil;
  const acesso = cenario.acesso || { principal: !!eu.is_adm, secoes: [], ebd: [], ebd_pendentes: 0 };
  const chamadas = [];
  const cabecalhos = [];      /* o "Authorization" de cada pedido, na mesma ordem de "chamadas" */
  const NOVAS = ['ibnm_secoes', 'ibnm_secao_', 'ibnm_ebd_', 'rpc/ibnm_meu_acesso', 'rpc/ibnm_ebd_'];

  function mockFetch(url, opcoes) {
    const u = String(url);
    const aut = (opcoes && opcoes.headers && opcoes.headers.Authorization) || '';
    chamadas.push(((opcoes && opcoes.method) || 'GET') + ' ' + u);
    cabecalhos.push(aut);
    if (cenario.sessaoMorta) {
      if (u.includes('grant_type=refresh_token')) {
        if (cenario.sessaoMorta === 'servidor-fora') return resposta({ message: 'Service Unavailable' }, 503);
        if (cenario.sessaoMorta === 'chave') return resposta({ message: 'Invalid API key', hint: 'Double check your Supabase API key.' }, 401);
        if (cenario.sessaoMorta === 'bloqueio') return resposta('<html><body>Just a moment...</body></html>', 403);
        return resposta({ code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }, 400);
      }
      if (aut === 'Bearer fake') return resposta({ code: 'PGRST301', details: null, hint: null, message: 'JWSError JWSInvalidSignature' }, 401);
    }
    if (u.includes('open-meteo.com')) return cenario.semClima ? Promise.reject(new Error('sem internet')) : resposta(CLIMA);
    if (cenario.v10 && NOVAS.some((n) => u.includes('/rest/v1/' + n))) {
      return resposta({ code: 'PGRST205', message: 'Could not find the table in the schema cache' }, 404);
    }
    if (u.includes('/auth/v1/user')) return resposta({ id: eu.id, email: eu.email, user_metadata: { nome: eu.nome } });
    if (u.includes('/auth/v1/token')) return resposta({ access_token: 'fake', refresh_token: 'r', expires_in: 3600, user: { id: eu.id, email: eu.email } });
    if (u.includes('/rest/v1/rpc/ibnm_aniversariantes')) return resposta([{ id: eu.id, nome: eu.nome, dia: 4, foto: '' }]);
    if (u.includes('/rest/v1/rpc/ibnm_meu_acesso')) return resposta(acesso);
    if (u.includes('/rest/v1/rpc/ibnm_ebd_resumo')) return resposta(RESUMO);
    if (u.includes('/rest/v1/rpc/ibnm_ebd_minha_frequencia')) return resposta([]);
    if (u.includes('/rest/v1/rpc/')) return resposta([]);
    if (u.includes('/rest/v1/ibnm_config')) {
      if (u.includes('chave=eq.ebd')) return resposta(cenario.v10 ? [] : [{ chave: 'ebd', valor: EBD_CONFIG }]);
      return resposta([{ chave: 'igreja', valor: CONFIG }]);
    }
    if (u.includes('/rest/v1/ibnm_secoes')) return resposta(SECOES);
    if (u.includes('/rest/v1/ibnm_secao_adms')) return resposta([{ id: 'x1', secao_id: 's-avisos', user_id: '22222222-2222-2222-2222-222222222222' }]);
    if (u.includes('/rest/v1/ibnm_secao_posts')) return resposta([{ id: 'po1', secao_id: 's-missoes', sala_id: null, titulo: 'Campanha de oração', texto: 'Vamos orar pelos missionários.', imagem: '', link: '', fixado: true, publicado: true, autor: 'Júlia', criado_em: hoje.toISOString() }]);
    if (u.includes('/rest/v1/ibnm_secao_materiais')) return resposta([{ id: 'ma1', secao_id: 's-ebd', sala_id: null, titulo: 'Lição 7 — As parábolas', descricao: '', tipo: 'texto', url: '', texto: 'Resumo da lição.', data: iso(hoje), publicado: true }]);
    if (u.includes('/rest/v1/ibnm_secao_fotos')) return resposta([]);
    if (u.includes('/rest/v1/ibnm_ebd_salas')) return resposta(SALAS);
    if (u.includes('/rest/v1/ibnm_ebd_matriculas')) return resposta(u.includes('papel=eq.aluno') ? ALUNOS.filter((m) => m.papel === 'aluno') : ALUNOS);
    if (u.includes('/rest/v1/ibnm_ebd_')) return resposta([]);
    if (u.includes('/rest/v1/ibnm_devocionais')) return resposta([{
      id: 'd1', data: iso(hoje), titulo: 'A esperança que não decepciona',
      versiculo: 'Os que esperam no Senhor renovarão as suas forças.', referencia: 'Isaías 40:31',
      texto: 'Texto do devocional de hoje.', autor: 'Pastor Teste', publicado: true
    }]);
    if (u.includes('/rest/v1/ibnm_eventos')) return resposta([
      { id: 'e1', titulo: 'Culto de Celebração', descricao: 'Venha adorar', categoria: 'culto', recorrente: true, dia_semana: 0, hora: '18:00', local: 'Templo', publicado: true },
      { id: 'e2', titulo: 'Culto de Ensino', descricao: 'Estudo bíblico', categoria: 'culto', recorrente: true, dia_semana: 3, hora: '19:30', local: 'Templo', publicado: true },
      { id: 'e3', titulo: 'Congresso de Missões', descricao: 'Especial', categoria: 'especial', recorrente: false, data: iso(new Date(hoje.getTime() + 5 * 864e5)), hora: '20:00', local: 'Templo', publicado: true }
    ]);
    if (u.includes('/rest/v1/ibnm_palavras')) return resposta([{ id: 'p1', titulo: 'Uma igreja que cuida', autor: 'Pastor Teste', resumo: 'Resumo', texto: 'Texto', data: iso(hoje), publicado: true }]);
    if (u.includes('/rest/v1/ibnm_avisos')) return resposta([{ id: 'a1', titulo: 'Aviso de teste', texto: 'Conteúdo do aviso', urgencia: 'importante' }]);
    if (u.includes('/rest/v1/ibnm_oracoes')) return resposta([]);
    if (u.includes('/rest/v1/ibnm_ofertas')) return resposta([]);
    if (u.includes('/rest/v1/ibnm_perfis')) return resposta([eu, { id: '22222222-2222-2222-2222-222222222222', nome: 'Sara Lima', email: 'sara@teste.com', is_adm: false }]);
    return resposta([]);
  }
  mockFetch.chamadas = chamadas;
  mockFetch.cabecalhos = cabecalhos;
  return mockFetch;
}

/* os arquivos do app são lidos do próprio index.html, na mesma ordem (assim o teste nunca fica desatualizado) */
function scriptsDoIndex() {
  const html = fs.readFileSync(pasta('index.html'), 'utf8');
  return Array.from(html.matchAll(/<script src="([^"]+)"><\/script>/g)).map((m) => m[1]);
}

function criarApp(logado, cenario) {
  cenario = cenario || {};
  const eu = cenario.perfil || perfil;
  let html = fs.readFileSync(pasta('index.html'), 'utf8');
  html = html.replace(/<script src="[^"]+"><\/script>/g, '');
  const dom = new JSDOM(html, {
    url: 'http://localhost:8080/app-igreja/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const w = dom.window;
  w.fetch = criarMock(cenario);
  w.scrollTo = () => {};
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  w.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  w.erros = [];
  w.addEventListener('error', (e) => w.erros.push(String(e.message || e.error)));
  if (logado) {
    w.localStorage.setItem('ibnm.sessao.v1', JSON.stringify({ access_token: 'fake', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: eu.id, email: eu.email } }));
    w.localStorage.setItem('ibnm.perfil.v1', JSON.stringify(eu));
  }
  scriptsDoIndex().forEach((f) => w.eval(fs.readFileSync(pasta(f.split('?')[0]), 'utf8')));
  return w;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms || 60));

(async () => {
  console.log('\n== 1. PIX (código copia e cola) ==');
  {
    const w = criarApp(false);
    const PIX = w.IBNM.PIX;
    ok(PIX.crc16('123456789') === '29B1', 'CRC16 confere com o padrão (29B1)');
    const p = PIX.montarPayload({ chave: '85999998888', tipo: 'telefone', nome: 'Igreja Batista', cidade: 'Caucaia' });
    ok(p.startsWith('00020126'), 'payload começa com o indicador PIX');
    ok(p.includes('br.gov.bcb.pix'), 'contém o GUI do PIX');
    ok(p.includes('+5585999998888'), 'telefone normalizado com +55');
    ok(p.slice(-4) === PIX.crc16(p.slice(0, -4)), 'CRC do payload está correto');
    ok(p.includes('5303986'), 'moeda BRL (986)');
    ok(p.includes('5802BR'), 'país BR');
    const qr = PIX.qrSvg(p);
    ok(qr.indexOf('<svg') === 0 && qr.length > 500, 'QR Code gerado em SVG');
    ok(PIX.validar('', 'telefone') !== '', 'validação avisa chave vazia');
    ok(PIX.validar('85999998888', 'telefone') === '', 'validação aceita telefone');
    ok(PIX.validar('1234', 'cpf') !== '', 'validação recusa CPF curto');
    await espera(80);
    ok(w.document.querySelector('#tela').textContent.indexOf('Devocional do dia') >= 0, 'tela inicial mostra devocional');
  }

  console.log('\n== 2. Visitante (sem login) ==');
  {
    const w = criarApp(false);
    await espera(150);
    const doc = w.document;
    ok(!!doc.querySelector('#saudacao').textContent.match(/Bom dia|Boa tarde|Boa noite/), 'saudação pelo horário');
    ok(doc.querySelectorAll('#menu button').length === 5, 'menu inferior tem 5 itens');
    ok(doc.querySelector('#topoIgreja').textContent.includes('Nova Metrópole'), 'nome da igreja no topo');
    ok(!!doc.querySelector('#btnOfertar'), 'botão de oferta na barra superior');
    ok(doc.querySelector('#tela').textContent.includes('Próximos encontros'), 'seção de próximos encontros');
    ok(doc.querySelector('#tela').textContent.includes('Bem-vindos') === false, 'avisos ocultos não aparecem');
    ok(doc.querySelector('#radioBar').hidden === true, 'rádio começa desligada');

    w.App.ir('#/devocional'); await espera(60);
    ok(doc.querySelector('#tela').textContent.includes('Isaías 40:31'), 'devocional mostra o versículo');

    w.App.ir('#/agenda'); await espera(60);
    ok(doc.querySelectorAll('.semana-dia').length === 7, 'agenda semanal mostra 7 dias');
    const btnMes = doc.querySelector('[data-aba="mes"]');
    btnMes.click(); await espera(80);
    ok(doc.querySelectorAll('.cal-dia').length >= 28, 'agenda mensal mostra o calendário');

    w.App.ir('#/oferta'); await espera(80);
    ok(!!doc.querySelector('#pixQr svg'), 'tela de oferta gera o QR Code');
    ok(doc.querySelector('#pixChave').textContent.includes('99999'), 'mostra a chave PIX');
    ok(doc.querySelector('#tela').textContent.includes('Entrar para registrar'), 'visitante é convidado a entrar');

    w.App.ir('#/igreja'); await espera(60);
    ok(doc.querySelector('#tela').textContent.includes('Rua das Flores'), 'página da igreja mostra o endereço');
    ok(doc.querySelector('#tela').innerHTML.includes('instagram.com/ibnm'), 'link do Instagram');

    w.App.ir('#/entrar'); await espera(60);
    ok(!!doc.querySelector('#lGoogle'), 'botão Entrar com Google');
    ok(!!doc.querySelector('#cCriar') === false, 'aba de cadastro inicia fechada');
    doc.querySelector('[data-aba="criar"]').click(); await espera(80);
    ok(!!doc.querySelector('#cNasc'), 'cadastro pede data de nascimento');
    ok(!!doc.querySelector('#cEnd'), 'cadastro pede endereço');

    w.App.ir('#/mais'); await espera(60);
    ok(doc.querySelector('#tela').textContent.includes('Como usar o app'), 'menu Mais tem ajuda');
    ok(doc.querySelector('#tela').textContent.includes('Tamanho da letra'), 'menu Mais tem tamanho da letra');
  }

  console.log('\n== 3. Membro logado (administrador) ==');
  {
    const w = criarApp(true);
    await espera(200);
    const doc = w.document;
    ok(doc.querySelector('#saudacao').textContent.includes('Maria'), 'saudação com o nome do membro');
    ok(doc.querySelector('#tela').textContent.includes('Aniversariantes'), 'aniversariantes do mês aparecem');

    w.App.ir('#/admin'); await espera(200);
    ok(doc.querySelector('#tela').textContent.includes('Painel do administrador'), 'painel do administrador abre');
    const abas = Array.from(doc.querySelectorAll('[data-adm]')).map((b) => b.getAttribute('data-adm'));
    ok(abas.length === 11, 'painel do ADM principal tem 11 abas (10 de edição + ADMs e seções)');
    ok(abas.includes('pix') && abas.includes('radio') && abas.includes('eventos'), 'abas de PIX, rádio e agenda');
    ok(abas[abas.length - 1] === 'secoes', 'a última aba é "ADMs e seções"');

    for (const aba of abas) {
      doc.querySelector('[data-adm="' + aba + '"]').click();
      await espera(120);
      ok(doc.querySelector('#admCorpo').childElementCount > 0, 'aba "' + aba + '" carrega conteúdo');
    }

    // campos editáveis da aba Igreja
    doc.querySelector('[data-adm="igreja"]').click(); await espera(120);
    ok(!!doc.querySelector('#igNome') && doc.querySelector('#igNome').value.includes('Metrópole'), 'campo nome da igreja preenchido');
    ok(!!doc.querySelector('#igEnd'), 'campo endereço da igreja existe');

    // PIX
    doc.querySelector('[data-adm="pix"]').click(); await espera(120);
    ok(!!doc.querySelector('#pxChave') && doc.querySelector('#pxChave').value === '85999998888', 'campo da chave PIX preenchido');

    // Rádio desligada, mas pronta
    doc.querySelector('[data-adm="radio"]').click(); await espera(120);
    ok(!!doc.querySelector('#rdAtiva') && doc.querySelector('#rdAtiva').checked === false, 'rádio está desligada');
    ok(!!doc.querySelector('#rdUrl'), 'campo de link da rádio existe (pronto para ativar)');

    w.App.ir('#/perfil'); await espera(120);
    ok(doc.querySelector('#tela').textContent.includes('Meus dados'), 'perfil com dados editáveis');
    ok(!!doc.querySelector('#pNasc'), 'perfil tem data de nascimento');

    w.App.ir('#/oferta'); await espera(120);
    ok(doc.querySelector('#tela').textContent.includes('Minhas ofertas'), 'histórico de ofertas do membro');

    w.App.ir('#/oracao'); await espera(120);
    ok(!!doc.querySelector('#orTexto'), 'formulário de pedido de oração');
  }

  console.log('\n== 4. Tamanho da letra ==');
  {
    const w = criarApp(false);
    await espera(80);
    w.document.querySelector('#btnFonte').click();
    await espera(60);
    const opcoes = w.document.querySelectorAll('#modal [data-fonte]');
    ok(opcoes.length === 4, 'quatro tamanhos de letra disponíveis');
    opcoes[3].click();
    await espera(60);
    ok(w.document.documentElement.getAttribute('data-fonte') === '4', 'tamanho escolhido é aplicado');
    ok(w.localStorage.getItem('ibnm.fonte') === '4', 'tamanho fica salvo no aparelho');
  }

  console.log('\n== 5. Barra de cima: data, hora com segundos e clima ==');
  {
    const w = criarApp(false);
    await espera(120);
    const doc = w.document;
    const data = doc.querySelector('#topoData').textContent;
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const agora = new Date();
    ok(data.includes(dias[agora.getDay()]) && data.includes(String(agora.getDate())) && data.includes(meses[agora.getMonth()]) && data.includes(String(agora.getFullYear())),
      'data completa por extenso (' + data + ')');
    ok(/^\d\d:\d\d$/.test(doc.querySelector('#topoHM').textContent), 'hora e minutos no formato 00:00');
    ok(/^:\d\d$/.test(doc.querySelector('#topoSeg').textContent), 'segundos aparecem ao lado da hora');
    const antes = doc.querySelector('#topoSeg').textContent;
    await espera(1150);
    ok(doc.querySelector('#topoSeg').textContent !== antes, 'os segundos andam sozinhos');
    await w.IBNM.Topo.buscarClima(true);
    const clima = doc.querySelector('#topoClima').textContent;
    ok(clima.includes('29°C'), 'temperatura aparece na barra (' + clima.trim() + ')');
    ok(clima.includes('Parcialmente nublado'), 'descrição do tempo aparece');
    ok(!!w.localStorage.getItem('ibnm.clima.v1'), 'clima fica guardado no aparelho (aparece mesmo sem internet)');
    doc.querySelector('#topoTempo').click(); await espera(60);
    const folha = doc.querySelector('#modal').textContent;
    ok(folha.includes('Sensação térmica') && folha.includes('33°C'), 'tocar na barra abre os detalhes do clima');
    ok(folha.includes('Máxima 31°C') && folha.includes('20%'), 'detalhes mostram máxima, mínima e chance de chuva');
    ok(w.erros.length === 0, 'nenhum erro de script');

    const sem = criarApp(false, { semClima: true });
    await espera(120);
    await sem.IBNM.Topo.buscarClima(true);
    ok(/^\d\d:\d\d$/.test(sem.document.querySelector('#topoHM').textContent), 'sem internet a hora continua funcionando');
    ok(!sem.document.querySelector('#topoClima').textContent.includes('°C'), 'sem internet não inventa temperatura');
  }

  console.log('\n== 6. Seções e Escola Bíblica (visitante) ==');
  {
    const w = criarApp(false);
    await espera(200);
    const doc = w.document;
    const inicio = doc.querySelector('#tela').textContent;
    ok(inicio.includes('Escola Bíblica Dominical'), 'tela inicial tem atalho da Escola Bíblica');
    ok(inicio.includes('Missões'), 'tela inicial tem atalho da seção criada pelo ADM');
    ok(!inicio.includes('Pedidos de oração recebidos'), 'partes do painel não viram atalho');

    w.App.ir('#/ebd'); await espera(200);
    const ebd = doc.querySelector('#tela').textContent;
    ok(ebd.includes('Adultos') && ebd.includes('Jovens'), 'Escola Bíblica lista as salas');
    ok(ebd.includes('9 alunos') && ebd.includes('Paula Rocha'), 'cada sala mostra alunos e quem ensina');
    ok(ebd.includes('Domingos, às 9h') && ebd.includes('A vida de Jesus'), 'mostra horário e tema do trimestre');
    ok(ebd.includes('Entrar ou criar conta'), 'visitante é convidado a entrar para participar');
    ok(!doc.querySelector('[data-ir="#/ebd/gestao"]'), 'visitante não vê a gestão');

    w.App.ir('#/ebd/sala/sala-jovens'); await espera(200);
    const abasSala = Array.from(doc.querySelectorAll('[data-aba-sala]')).map((b) => b.getAttribute('data-aba-sala'));
    ok(abasSala.length > 0 && !abasSala.includes('chamada') && !abasSala.includes('alunos') && !abasSala.includes('relatorios'), 'visitante não vê chamada, alunos nem relatórios (' + abasSala.join(', ') + ')');

    w.App.ir('#/secao/missoes'); await espera(200);
    ok(doc.querySelector('#tela').textContent.includes('Campanha de oração'), 'seção livre mostra o mural');
    ok(!doc.querySelector('#muNovo'), 'visitante não tem botão de publicar');
    doc.querySelector('[data-aba-secao="fotos"]').click(); await espera(120);
    ok(/só para quem entrou/i.test(doc.querySelector('#secaoCorpo').textContent), 'fotos só aparecem para quem entrou no app');

    w.App.ir('#/admin'); await espera(150);
    ok(!doc.querySelector('[data-adm]'), 'visitante não abre o painel');

    w.App.ir('#/entrar'); await espera(80);
    doc.querySelector('[data-aba="criar"]').click(); await espera(80);
    const papel = doc.querySelector('#cEbdPapel');
    ok(!!papel && papel.querySelectorAll('option').length === 3, 'cadastro tem a opção "Sou aluno(a)" / "Sou professor(a)"');
    ok(doc.querySelector('#cEbdSalaBox').hidden === true, 'a escolha da sala começa escondida');
    papel.value = 'professor'; papel.onchange();
    ok(doc.querySelector('#cEbdSalaBox').hidden === false && doc.querySelectorAll('#cEbdSala option').length === 2, 'ao escolher, aparecem as salas');
    ok(doc.querySelector('#cEbdDica').textContent.includes('aprovação'), 'professor(a) é avisado de que precisa de aprovação');
    ok(w.erros.length === 0, 'nenhum erro de script');
  }

  console.log('\n== 7. ADM secundário (só as seções liberadas) ==');
  {
    const sara = Object.assign({}, perfil, { id: '22222222-2222-2222-2222-222222222222', nome: 'Sara Lima', email: 'sara@teste.com', is_adm: false });
    const w = criarApp(true, { perfil: sara, acesso: { principal: false, secoes: ['eventos', 'avisos'], ebd: [], ebd_pendentes: 0 } });
    await espera(250);
    const doc = w.document;
    w.App.ir('#/admin'); await espera(200);
    const abas = Array.from(doc.querySelectorAll('[data-adm]')).map((b) => b.getAttribute('data-adm'));
    ok(abas.join(',') === 'eventos,avisos', 'painel mostra só Agenda e Avisos (' + abas.join(', ') + ')');
    ok(!abas.includes('secoes'), 'ADM secundário não vê "ADMs e seções"');
    ok(doc.querySelector('#tela').textContent.includes('liberou para você'), 'painel explica que o acesso é limitado');
    for (const aba of abas) {
      doc.querySelector('[data-adm="' + aba + '"]').click();
      await espera(120);
      ok(doc.querySelector('#admCorpo').childElementCount > 0, 'aba "' + aba + '" carrega conteúdo');
    }
    w.App.ir('#/perfil'); await espera(150);
    ok(doc.querySelector('#tela').textContent.includes('ADM de seção'), 'perfil mostra a etiqueta "ADM de seção"');
    w.App.ir('#/secao/missoes'); await espera(200);
    ok(!doc.querySelector('#muNovo'), 'não publica em seção que não foi liberada para ela');

    const marcos = Object.assign({}, perfil, { id: '33333333-3333-3333-3333-333333333333', nome: 'Marcos Silva', email: 'marcos@teste.com', is_adm: false });
    const m = criarApp(true, { perfil: marcos });
    await espera(250);
    m.App.ir('#/mais'); await espera(120);
    ok(!m.document.querySelector('#tela').textContent.includes('Painel do administrador'), 'membro comum não vê o painel no menu');
    m.App.ir('#/admin'); await espera(150);
    ok(!m.document.querySelector('[data-adm]') && m.document.querySelector('#tela').textContent.includes('não tem permissão'), 'membro comum não abre o painel');

    const julia = Object.assign({}, perfil, { id: '44444444-4444-4444-4444-444444444444', nome: 'Júlia Costa', email: 'julia@teste.com', is_adm: false });
    const j = criarApp(true, { perfil: julia, acesso: { principal: false, secoes: ['missoes'], ebd: [], ebd_pendentes: 0 } });
    await espera(250);
    j.App.ir('#/secao/missoes'); await espera(200);
    ok(!!j.document.querySelector('#muNovo'), 'ADM de uma seção livre publica no mural dela');
    j.App.ir('#/admin'); await espera(150);
    ok(j.document.querySelectorAll('[data-adm]').length === 0 && !!j.document.querySelector('.adm-atalho'), 'no painel ela vê só o atalho da seção dela');
    ok(w.erros.length + m.erros.length + j.erros.length === 0, 'nenhum erro de script');
  }

  console.log('\n== 8. Escola Bíblica: aluna, professora e ADM ==');
  {
    const aluna = Object.assign({}, perfil, { is_adm: false });
    const a = criarApp(true, { perfil: aluna, acesso: { principal: false, secoes: [], ebd: [MATRICULA('aluno')], ebd_pendentes: 0 } });
    await espera(250);
    ok(a.document.querySelector('#tela').textContent.includes('Jovens'), 'início mostra a sala da aluna');
    a.App.ir('#/ebd/sala/sala-jovens'); await espera(200);
    let abas = Array.from(a.document.querySelectorAll('[data-aba-sala]')).map((b) => b.getAttribute('data-aba-sala'));
    ok(abas.includes('frequencia') && !abas.includes('chamada') && !abas.includes('alunos'), 'aluna vê a própria frequência, mas não a chamada (' + abas.join(', ') + ')');

    const pend = criarApp(true, { perfil: aluna, acesso: { principal: false, secoes: [], ebd: [MATRICULA('professor', 'pendente')], ebd_pendentes: 0 } });
    await espera(250);
    const inicioPend = pend.document.querySelector('#tela').textContent;
    ok(/em análise/i.test(inicioPend) && !/Você ensina/.test(inicioPend), 'início de quem pediu para ser professor(a) diz "em análise" (e não "Você ensina")');
    pend.App.ir('#/ebd/sala/sala-jovens'); await espera(200);
    abas = Array.from(pend.document.querySelectorAll('[data-aba-sala]')).map((b) => b.getAttribute('data-aba-sala'));
    ok(!abas.includes('chamada'), 'professor(a) ainda não aprovado não faz chamada');
    ok(/aguardando|aprova/i.test(pend.document.querySelector('#tela').textContent), 'e vê o aviso de que o pedido aguarda aprovação');

    const p = criarApp(true, { perfil: aluna, acesso: { principal: false, secoes: [], ebd: [MATRICULA('professor')], ebd_pendentes: 0 } });
    await espera(250);
    const doc = p.document;
    ok(/Você ensina: Jovens/.test(doc.querySelector('#tela').textContent), 'início da professora aprovada diz "Você ensina: Jovens"');
    p.App.ir('#/ebd/sala/sala-jovens'); await espera(250);
    ok(!!doc.querySelector('.abas-rolam[data-abas-ok] [data-aba-sala]'), 'as abas da sala ficam numa faixa que rola para o lado');
    abas = Array.from(doc.querySelectorAll('[data-aba-sala]')).map((b) => b.getAttribute('data-aba-sala'));
    ok(['chamada', 'alunos', 'relatorios', 'materiais', 'fotos'].every((x) => abas.includes(x)), 'professora vê chamada, alunos, relatórios, materiais e fotos');
    doc.querySelector('#chNova').click(); await espera(250);
    const caixas = Array.from(doc.querySelectorAll('[data-pres]'));
    ok(caixas.length === 3, 'a chamada lista os 3 alunos da sala');
    caixas[0].click(); caixas[1].click(); await espera(30);
    ok(doc.querySelector('#chPres').textContent === '2', 'contador de presentes acompanha as marcações');
    ok(Object.keys(p.localStorage).some((k) => k.indexOf('ibnm.chamada.') === 0), 'marcações ficam guardadas no aparelho (não se perdem sem internet)');
    ok(!!doc.querySelector('#chVis') && !!doc.querySelector('#chBib') && !!doc.querySelector('#chOferta') && !!doc.querySelector('#chSalvar'), 'chamada tem visitantes, Bíblias, oferta e botão salvar');
    doc.querySelector('[data-aba-sala="alunos"]').click(); await espera(200);
    ok(doc.querySelector('#salaCorpo').textContent.includes('Ana Beatriz') && !!doc.querySelector('#alNovo'), 'lista de alunos com botão de adicionar');
    doc.querySelector('[data-aba-sala="relatorios"]').click(); await espera(200);
    ok(!!doc.querySelector('#rlNovo'), 'professora pode enviar foto do relatório');
    ok(!doc.querySelector('[data-ir="#/ebd/gestao"]'), 'professora não vê a gestão geral');
    p.App.ir('#/admin'); await espera(150);
    ok(!doc.querySelector('[data-adm]'), 'professora não ganha painel de administrador');

    const edu = criarApp(true, { perfil: aluna, acesso: { principal: false, secoes: ['ebd'], ebd: [], ebd_pendentes: 2 } });
    await espera(250);
    edu.App.ir('#/ebd'); await espera(200);
    ok(!!edu.document.querySelector('[data-ir="#/ebd/gestao"]'), 'ADM da Escola Bíblica vê o botão de gestão');
    edu.App.ir('#/ebd/gestao'); await espera(250);
    const gest = Array.from(edu.document.querySelectorAll('[data-aba-gestao]')).map((b) => b.getAttribute('data-aba-gestao'));
    ok(['domingo', 'salas', 'professores', 'dados'].every((x) => gest.includes(x)), 'gestão tem domingo, salas, professores e dados');
    ok(edu.document.querySelector('[data-aba-gestao="professores"]').textContent.includes('2'), 'pedidos de professor pendentes aparecem no botão');
    for (const g of gest) {
      edu.document.querySelector('[data-aba-gestao="' + g + '"]').click();
      await espera(200);
      ok(edu.document.querySelector('#gestaoCorpo').childElementCount > 0, 'gestão: aba "' + g + '" carrega conteúdo');
    }
    edu.App.ir('#/admin'); await espera(150);
    ok(edu.document.querySelectorAll('[data-adm]').length === 0 && !!edu.document.querySelector('.adm-atalho'), 'painel dele só tem o atalho da Escola Bíblica');
    ok(a.erros.length + pend.erros.length + p.erros.length + edu.erros.length === 0, 'nenhum erro de script');
  }

  console.log('\n== 9. Banco ainda na versão 1.0 (sem o sql/02) ==');
  {
    const w = criarApp(true, { v10: true });
    await espera(250);
    const doc = w.document;
    ok(doc.querySelector('#tela').textContent.includes('Devocional do dia'), 'o app abre normalmente');
    ok(!doc.querySelector('#tela').textContent.includes('Escola Bíblica'), 'sem as tabelas novas, os atalhos novos não aparecem');
    ok(/^\d\d:\d\d$/.test(doc.querySelector('#topoHM').textContent), 'data, hora e clima funcionam mesmo assim');
    w.App.ir('#/admin'); await espera(200);
    const abas = Array.from(doc.querySelectorAll('[data-adm]')).map((b) => b.getAttribute('data-adm'));
    ok(abas.includes('igreja') && abas.includes('membros'), 'o ADM continua com o painel completo');
    doc.querySelector('[data-adm="secoes"]').click(); await espera(200);
    ok(/sql\/02|02-secoes-ebd/.test(doc.querySelector('#admCorpo').textContent), 'a aba "ADMs e seções" explica que falta rodar o sql/02');
    w.App.ir('#/ebd'); await espera(200);
    ok(doc.querySelector('#tela').childElementCount > 0 && !doc.querySelector('[data-aba-ebd]'), 'abrir a Escola Bíblica pelo endereço não quebra o app');
    const v = criarApp(false, { v10: true });
    await espera(200);
    v.App.ir('#/entrar'); await espera(80);
    v.document.querySelector('[data-aba="criar"]').click(); await espera(80);
    ok(!v.document.querySelector('#cEbdPapel') && !!v.document.querySelector('#cCriar'), 'cadastro funciona, sem a pergunta da Escola Bíblica');
    ok(w.erros.length + v.erros.length === 0, 'nenhum erro de script');
  }

  console.log('\n== 10. Arquivos do app (versão e funcionamento sem internet) ==');
  {
    const index = fs.readFileSync(pasta('index.html'), 'utf8');
    const sw = fs.readFileSync(pasta('sw.js'), 'utf8');
    const versao = (fs.readFileSync(pasta('js/config.js'), 'utf8').match(/VERSAO:\s*'([^']+)'/) || [])[1];
    ok(/^\d+\.\d+\.\d+$/.test(versao || ''), 'versão do app em js/config.js (' + versao + ')');
    ok((sw.match(/var VERSAO = '([^']+)'/) || [])[1] === versao, 'sw.js está na mesma versão');
    const scripts = scriptsDoIndex();
    ok(scripts.length === 11 && scripts.every((x) => x.endsWith('?v=' + versao)), 'os 11 arquivos do index.html usam ?v=' + versao);
    ok(index.includes('css/app.css?v=' + versao), 'o visual (css) também usa ?v=' + versao);
    ok(scripts.every((x) => sw.includes("'./" + x.split('?')[0] + "' + V")), 'todos os arquivos estão na lista que funciona sem internet');
    ok(scripts.every((x) => fs.existsSync(pasta(x.split('?')[0]))), 'todos os arquivos citados existem');
    const ordem = scripts.map((x) => x.split('?')[0].replace(/^(js|vendor)\//, '').replace('.js', ''));
    ok(ordem.indexOf('views') < ordem.indexOf('secoes') && ordem.indexOf('secoes') < ordem.indexOf('ebd') && ordem.indexOf('ebd') < ordem.indexOf('admin') && ordem[ordem.length - 1] === 'app',
      'arquivos carregam na ordem certa (' + ordem.join(' → ') + ')');
  }

  console.log('\n== 11. Cuidados com o servidor de verdade (Supabase) ==');
  {
    /* (a) o Supabase entrega no máximo 1000 linhas por pedido: a lista de presenças vem em partes */
    const w = criarApp(true);
    await espera(120);
    const DB = w.IBNM.DB;
    const pedidos = [];
    const linhas = (n, de) => Array.from({ length: n }, (_, i) => ({ aula_id: 'a' + (de + i), matricula_id: 'm1', presente: true }));
    const original = w.fetch;
    w.fetch = (url, op) => {
      const u = String(url);
      if (u.includes('/rest/v1/ibnm_ebd_presencas')) {
        pedidos.push(u);
        const q = new URL(u).searchParams;
        const off = Number(q.get('offset') || 0);
        return resposta(off === 0 ? linhas(1000, 0) : off === 1000 ? linhas(1000, 1000) : linhas(170, 2000));
      }
      return original(url, op);
    };
    const tudo = await DB.Tabela.listarTudo('ibnm_ebd_presencas', { filtros: { aula_id: 'in.(a,b)' }, ordem: 'aula_id.asc,matricula_id.asc' });
    ok(tudo.length === 2170, 'lista grande chega inteira (2170 linhas em 3 pedidos de até 1000)');
    ok(pedidos.length === 3 && pedidos.every((u) => u.includes('limit=1000')) && pedidos[1].includes('offset=1000') && pedidos[2].includes('offset=2000'),
      'cada pedido continua de onde o anterior parou');
    ok(pedidos.every((u) => u.includes('order=aula_id.asc')), 'sempre na mesma ordem (não repete nem pula linha)');
    const codigoEbd = fs.readFileSync(pasta('js/ebd.js'), 'utf8');
    ok(!/listar\('ibnm_ebd_presencas'[^\n]*limite:\s*[1-9]\d{3}/.test(codigoEbd) && (codigoEbd.match(/listarTudo\('ibnm_ebd_presencas'/g) || []).length === 2,
      'chamada e frequência da sala usam a lista inteira');

    /* (b) nome do arquivo enviado: só letras e números (o Storage recusa acento, espaço e símbolo) */
    const ext = DB.Arquivos.extensao;
    ok(ext('Foto da Aula.JPG', 'jpg') === 'jpg' && ext('lição 1.PDF', 'pdf') === 'pdf' && ext('a.b.jpeg') === 'jpeg', 'extensão do arquivo em minúsculas');
    ok(ext('comprovante', 'jpg') === 'jpg' && ext('recibo.ação', 'pdf') === 'ao' && ext('x.extensaogigante', 'pdf') === 'pdf' && ext('', 'jpg') === 'jpg' && ext('fim.', 'pdf') === 'pdf',
      'arquivo sem extensão (ou estranha) nunca gera nome inválido');

    /* (c) envio de arquivo com a sessão quase vencida: renova antes de enviar */
    const envios = [];
    w.fetch = (url, op) => {
      const u = String(url);
      if (u.includes('/auth/v1/token')) { envios.push('renovou'); return resposta({ access_token: 'novo', refresh_token: 'r2', expires_in: 3600, user: { id: perfil.id, email: perfil.email } }); }
      if (u.includes('/storage/v1/object/')) { envios.push(((op && op.method) || 'GET') + ' ' + ((op.headers && op.headers.Authorization) || '')); return resposta({ Key: 'ok' }); }
      return original(url, op);
    };
    const arquivo = new w.Blob(['abc'], { type: 'image/jpeg' });
    await DB.Arquivos.enviar('igreja', 'ebd/relatorios/geral/1.jpg', arquivo);
    ok(envios.length === 1 && envios[0] === 'POST Bearer fake', 'sessão em dia: envia direto, sem pedido a mais');
    DB.Auth.sessao.expires_at = Math.floor(Date.now() / 1000) + 30;
    envios.length = 0;
    await DB.Arquivos.enviar('igreja', 'ebd/relatorios/geral/2.jpg', arquivo);
    ok(envios.length === 2 && envios[0] === 'renovou' && envios[1] === 'POST Bearer novo', 'sessão no fim: renova e envia com a sessão nova');
    DB.Auth.sessao.expires_at = Math.floor(Date.now() / 1000) + 30;
    envios.length = 0;
    const apagou = await DB.Arquivos.apagar('igreja', 'ebd/relatorios/geral/2.jpg');
    ok(apagou === true && envios[0] === 'renovou' && envios[1] === 'DELETE Bearer novo', 'apagar arquivo também confere a sessão antes');
    ok(await DB.Arquivos.apagar('igreja', '') === false, 'apagar sem caminho não faz pedido nenhum');
    DB.Auth.sessao.expires_at = Math.floor(Date.now() / 1000) + 30;
    envios.length = 0;
    await Promise.all([1, 2, 3, 4, 5, 6].map((n) => DB.Arquivos.baixar('igreja', 'ebd/relatorios/geral/' + n + '.jpg').catch(() => null)));
    ok(envios.filter((x) => x === 'renovou').length === 1 && envios.filter((x) => x === 'GET Bearer novo').length === 6,
      'seis miniaturas ao mesmo tempo: uma única renovação de sessão');
    ok(!w.erros.length, 'sem erros de JavaScript');
  }

  console.log('\n== 12. Sessão que o servidor não aceita mais ==');
  {
    const renovacoes = (w) => w.fetch.chamadas.filter((c) => c.includes('grant_type=refresh_token')).length;
    const comSessao = (w) => w.fetch.cabecalhos.filter((a) => a === 'Bearer fake').length;
    const guardada = (w) => !!w.localStorage.getItem('ibnm.sessao.v1');

    /* (a) o aparelho guarda uma sessão que o servidor recusa de vez
           (foi cancelada, a conta saiu do ar ou o app passou a usar outro banco) */
    {
      const w = criarApp(true, { sessaoMorta: true });
      await espera(350);
      const doc = w.document, DB = w.IBNM.DB;
      ok(!DB.Auth.logado() && !guardada(w) && !w.localStorage.getItem('ibnm.perfil.v1') && !w.localStorage.getItem('ibnm.acesso.v1'),
        'a sessão recusada é esquecida: a pessoa volta a ser visitante');
      ok(renovacoes(w) === 1, 'tentou renovar a sessão uma única vez');
      ok(comSessao(w) === 1, 'só um pedido foi com a sessão recusada; os outros já foram como visitante');
      ok(doc.querySelector('#toast').textContent.includes('Sua sessão expirou. Entre novamente.'), 'avisa: "Sua sessão expirou. Entre novamente."');
      ok(!doc.querySelector('#saudacao').textContent.includes('Maria'), 'a saudação deixa de usar o nome de quem estava logado');
      ok(doc.querySelector('#tela').textContent.includes('Os que esperam no Senhor'), 'a tela inicial mostra o conteúdo da igreja normalmente');
      const antes = w.fetch.chamadas.length;
      w.App.ir('#/devocional'); await espera(150);
      ok(doc.querySelector('#tela').textContent.includes('A esperança que não decepciona'), 'as outras telas abrem como visitante');
      w.App.ir('#/admin'); await espera(150);
      ok(w.location.hash === '#/entrar' && !!doc.getElementById('lEntrar'), 'o painel leva para a tela de entrar');
      ok(renovacoes(w) === 1 && w.fetch.cabecalhos.slice(antes).every((a) => a !== 'Bearer fake'), 'não insiste mais na sessão antiga');
      ok(!w.erros.length, 'sem erros de JavaScript');
    }

    /* (b) servidor fora do ar na hora de renovar: NÃO desloga ninguém */
    {
      const w = criarApp(true, { sessaoMorta: 'servidor-fora' });
      await espera(350);
      ok(w.IBNM.DB.Auth.logado() && guardada(w), 'servidor fora do ar: a sessão continua guardada (tenta de novo depois)');
      ok(w.document.querySelector('#saudacao').textContent.includes('Maria'), '…e a pessoa continua identificada');
      ok(!w.erros.length, 'sem erros de JavaScript');
    }

    /* (c) a própria renovação responde 401 (chave do app com problema): não entra em repetição sem fim */
    {
      const w = criarApp(true, { sessaoMorta: 'chave' });
      await espera(500);
      const n = renovacoes(w);
      ok(n >= 1 && n <= 3, 'renovação recusada com erro 401 não vira uma fila sem fim de pedidos');
      ok(w.IBNM.DB.Auth.logado() && guardada(w), 'problema na chave do app não apaga a sessão de ninguém');
    }
    {
      const w = criarApp(true, { sessaoMorta: 'bloqueio' });
      await espera(350);
      ok(w.IBNM.DB.Auth.logado() && guardada(w) && renovacoes(w) <= 3, 'página de bloqueio no meio do caminho também não desloga ninguém');
    }

    /* (d) vários pedidos recusados ao mesmo tempo dividem uma única renovação e são repetidos com a sessão nova */
    {
      const w = criarApp(true);
      await espera(200);
      const DB = w.IBNM.DB;
      const original = w.fetch;
      const visto = [];
      w.fetch = (url, op) => {
        const u = String(url);
        const aut = (op && op.headers && op.headers.Authorization) || '';
        if (u.includes('grant_type=refresh_token')) { visto.push('renovou'); return espera(40).then(() => resposta({ access_token: 'novo', refresh_token: 'r2', expires_in: 3600, user: { id: perfil.id, email: perfil.email } })); }
        if (u.includes('/rest/v1/ibnm_avisos')) { visto.push(aut); return aut === 'Bearer novo' ? resposta([{ id: 'a1', titulo: 'ok' }]) : resposta({ code: 'PGRST303', message: 'JWT expired' }, 401); }
        return original(url, op);
      };
      const r = await Promise.all([1, 2, 3, 4].map(() => DB.Tabela.listar('ibnm_avisos', {})));
      ok(r.every((x) => x.length === 1 && x[0].titulo === 'ok'), 'sessão vencida no servidor: renova e repete o pedido sozinho');
      ok(visto.filter((x) => x === 'renovou').length === 1, 'quatro pedidos recusados ao mesmo tempo: uma única renovação');
      ok(DB.Auth.sessao.access_token === 'novo' && JSON.parse(w.localStorage.getItem('ibnm.sessao.v1')).access_token === 'novo', 'a sessão nova fica guardada');

      /* o pedido repetido também é recusado: para ali (não repete de novo) e não mostra mensagem técnica */
      const teimoso = w.fetch;
      let quantos = 0;
      w.fetch = (url, op) => String(url).includes('/rest/v1/ibnm_palavras') ? (quantos++, resposta({ code: 'PGRST301', message: 'JWSError JWSInvalidSignature' }, 401)) : teimoso(url, op);
      let recusado = null;
      try { await DB.Tabela.listar('ibnm_palavras', {}); } catch (e) { recusado = e; }
      ok(quantos === 2 && recusado && recusado.message === 'Não foi possível confirmar seu login agora. Tente de novo em instantes.' && DB.Auth.logado(),
        'recusado de novo depois de renovar: para na segunda tentativa, com aviso em português');
      w.fetch = teimoso;

      /* (e) o app aberto em outra aba já renovou: usa a sessão guardada em vez de renovar de novo */
      visto.length = 0;
      DB.Auth.sessao = Object.assign({}, DB.Auth.sessao, { expires_at: Math.floor(Date.now() / 1000) - 10 });      /* esta aba ficou com a velha */
      w.localStorage.setItem('ibnm.sessao.v1', JSON.stringify({ access_token: 'da-outra-aba', refresh_token: 'r3', expires_at: Math.floor(Date.now() / 1000) + 3500, user: { id: perfil.id, email: perfil.email } }));
      const bom = await DB.Auth.renovar(false);
      ok(bom === true && DB.Auth.sessao.access_token === 'da-outra-aba' && !visto.includes('renovou'), 'outra aba já renovou: aproveita a sessão nova, sem pedir de novo ao servidor');
      w.localStorage.setItem('ibnm.sessao.v1', JSON.stringify({ access_token: 'de-outra-pessoa', refresh_token: 'r4', expires_at: Math.floor(Date.now() / 1000) + 7000, user: { id: 'outra-pessoa', email: 'x@y.z' } }));
      await DB.Auth.renovar(false);
      ok(DB.Auth.sessao.access_token === 'da-outra-aba', 'nunca troca para a sessão de outra pessoa');
      w.localStorage.setItem('ibnm.sessao.v1', JSON.stringify(DB.Auth.sessao));

      /* (f) a pessoa sai do app enquanto a renovação está a caminho: a sessão antiga não volta */
      DB.Auth.sessao.expires_at = Math.floor(Date.now() / 1000) + 20;
      const pendente = DB.Auth.renovar(false);
      DB.Auth.limparSessao();
      const res = await pendente;
      ok(res === false && !DB.Auth.logado() && !guardada(w), 'saiu durante a renovação: continua fora (a sessão antiga não volta)');
      ok(!w.erros.length, 'sem erros de JavaScript');
    }

    /* (g) sessão sem código de renovação recusada pelo servidor: também volta a ser visitante */
    {
      const w = criarApp(true);
      await espera(200);
      const DB = w.IBNM.DB;
      let avisos = 0;
      w.addEventListener('ibnm:sessao-encerrada', () => { avisos++; });
      const original = w.fetch;
      w.fetch = (url, op) => String(url).includes('/rest/v1/ibnm_avisos') ? resposta({ message: 'JWT expired' }, 401) : original(url, op);
      delete DB.Auth.sessao.refresh_token;
      let erro = null;
      try { await DB.Tabela.listar('ibnm_avisos', {}); } catch (e) { erro = e; }
      ok(erro && erro.message === 'Sua sessão expirou. Entre novamente.' && !DB.Auth.logado() && avisos === 1, 'sem como renovar: encerra a sessão e avisa o app uma vez');
    }
  }

  console.log('\n' + (falhas ? '❌ ' + falhas + ' verificação(ões) falharam' : '✅ TODOS OS TESTES PASSARAM'));
  process.exit(falhas ? 1 : 0);
})();
