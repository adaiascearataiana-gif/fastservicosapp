/* Teste automatizado do app (sem navegador).
   Uso:  node testes/testar.js       (precisa do jsdom instalado) */
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

function mockFetch(url, opcoes) {
  const u = String(url);
  if (u.includes('/auth/v1/user')) return resposta({ id: perfil.id, email: perfil.email, user_metadata: { nome: perfil.nome } });
  if (u.includes('/auth/v1/token')) return resposta({ access_token: 'fake', refresh_token: 'r', expires_in: 3600, user: { id: perfil.id, email: perfil.email } });
  if (u.includes('/rest/v1/rpc/ibnm_aniversariantes')) return resposta([{ id: perfil.id, nome: perfil.nome, dia: 4, foto: '' }]);
  if (u.includes('/rest/v1/ibnm_config')) return resposta([{ chave: 'igreja', valor: CONFIG }]);
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
  if (u.includes('/rest/v1/ibnm_perfis')) return resposta(opcoes && opcoes.method === 'GET' ? [perfil] : [perfil]);
  return resposta([]);
}

function criarApp(logado) {
  let html = fs.readFileSync(pasta('index.html'), 'utf8');
  html = html.replace(/<script src="[^"]+"><\/script>/g, '');
  const dom = new JSDOM(html, {
    url: 'http://localhost:8080/app-igreja/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const w = dom.window;
  w.fetch = mockFetch;
  w.scrollTo = () => {};
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  w.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  if (logado) {
    w.localStorage.setItem('ibnm.sessao.v1', JSON.stringify({ access_token: 'fake', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: perfil.id, email: perfil.email } }));
    w.localStorage.setItem('ibnm.perfil.v1', JSON.stringify(perfil));
  }
  ['vendor/qrcode.js', 'js/config.js', 'js/db.js', 'js/pix.js', 'js/ui.js', 'js/views.js', 'js/admin.js', 'js/app.js']
    .forEach((f) => w.eval(fs.readFileSync(pasta(f), 'utf8')));
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
    ok(abas.length === 10, 'painel tem 10 abas de edição');
    ok(abas.includes('pix') && abas.includes('radio') && abas.includes('eventos'), 'abas de PIX, rádio e agenda');

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

  console.log('\n' + (falhas ? '❌ ' + falhas + ' verificação(ões) falharam' : '✅ TODOS OS TESTES PASSARAM'));
  process.exit(falhas ? 1 : 0);
})();
