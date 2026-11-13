'use strict';
/* Regressão da data das rotas — node scripts/test-route-dates.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function between(startMarker, endMarker) {
  const a = html.indexOf(startMarker); assert(a >= 0, startMarker);
  const b = html.indexOf(endMarker, a); assert(b > a, endMarker);
  return html.slice(a, b);
}
function script(id) {
  const m = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)<\\/script>'));
  assert(m, 'script ' + id); return m[1];
}
function storage() {
  const m = new Map();
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _map: m };
}
function timers() { return { setTimeout: () => 0, setInterval: () => 0, clearTimeout: () => {}, clearInterval: () => {} }; }
const noop = () => {};

(function dataCadastrada() {
  const code = between('    function fastDataValidaISO(', '    function carregarSequenciaDia()');
  const bd = {
    rotas: [
      { id: 1, data: '2026-11-12', statusExecucao: 'EM ROTA' },
      { id: 2, data: '2026-11-12', statusExecucao: 'CONCLUÍDA' },
      { id: 3, data: '2026-11-14', statusExecucao: 'EM ROTA' },
      { id: 4, data: 'data-inválida', statusExecucao: 'EM ROTA' },
      { id: 5, data: '2026-11-13', statusExecucao: 'CONCLUÍDA' },
      { id: 6, data: '2026-11-12', statusExecucao: 'EM ROTA' }
    ],
    sequencias: {
      '2026-11-12': [{ id: 11, rotaId: 1, status: 'EM ROTA' }, { id: 12, rotaId: 2, status: 'CONCLUÍDA' }, { id: 16, rotaId: 5, status: 'CONCLUÍDA' }],
      '2026-11-13': [{ id: 13, rotaId: 3, status: 'EM ROTA' }, { id: 14, rotaId: 4, status: 'EM ROTA' }, { id: 15, status: 'EM ROTA' }, { id: 17, rotaId: 6, status: 'EM ROTA' }]
    }
  };
  let salvou = 0;
  const ctx = { bancoDados: bd, localStorage: storage(), console, Date, Set, Map, JSON,
    fastRotaPorId: (arr, id) => arr.find(r => String(r.id) === String(id)) || null,
    salvarStorage: () => { salvou++; }, mostrarToast: noop };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  const antes = JSON.stringify(bd.rotas.map(r => r.data));
  ctx.verificarEVirarDia();
  assert.deepStrictEqual(bd.rotas.map(r => r.data), JSON.parse(antes), 'verificarEVirarDia não pode alterar rota.data');
  assert(bd.sequencias['2026-11-12'].some(i => i.id === 11), 'pendente de ontem continua em ontem');
  assert(bd.sequencias['2026-11-12'].some(i => i.id === 12), 'concluída de ontem continua em ontem');
  assert(bd.sequencias['2026-11-12'].some(i => i.id === 16), 'concluída histórica não é promovida mesmo se cadastro veio com data de hoje');
  assert(bd.sequencias['2026-11-13'].some(i => i.id === 13), 'manutenção não promove item para dia futuro automaticamente');
  assert(bd.sequencias['2026-11-13'].some(i => i.id === 14), 'data inválida não provoca movimento');
  assert(bd.sequencias['2026-11-13'].some(i => i.id === 15), 'item manual sem rota permanece');
  assert.strictEqual(ctx.fastDataValidaISO('2026-02-30'), false);
  assert.strictEqual(ctx.fastDataValidaISO('2028-02-29'), true);
  assert(bd.sequencias['2026-11-12'].some(i => i.id === 17), 'cópia que caiu em hoje volta para a data cadastrada anterior');
  assert(!bd.sequencias['2026-11-13'].some(i => i.id === 17), 'cópia não fica duplicada em hoje');
  assert(salvou >= 1);
})();

(function reparoConservador() {
  const code = between('    function fastDataValidaISO(', '    function carregarSequenciaDia()');
  const passou = '2026-11-13T03:00:00.000Z';
  const bd = { rotas: [{ id: 1, data: '2026-11-13', updatedAt: passou }, { id: 2, data: '2026-11-13', updatedAt: '2026-11-13T12:00:00.000Z' }],
    sequencias: { '2026-11-13': [
      { id: 11, rotaId: 1, dataOriginal: '2026-11-12', passouEm: passou },
      { id: 12, rotaId: 2, dataOriginal: '2026-11-12', passouEm: passou }
    ], '2026-11-12': [] } };
  const ls = storage();
  const ctx = { bancoDados: bd, localStorage: ls, console, Date, Set, Map, JSON,
    fastRotaPorId: (arr, id) => arr.find(r => String(r.id) === String(id)) || null, salvarStorage: noop, mostrarToast: noop };
  vm.createContext(ctx); vm.runInContext(code, ctx); ctx.verificarEVirarDia();
  assert.strictEqual(bd.rotas[0].data, '2026-11-12', 'migração automática marcada é desfeita');
  assert.strictEqual(bd.rotas[1].data, '2026-11-13', 'edição manual posterior é respeitada');
  assert(bd.sequencias['2026-11-12'].some(i => i.id === 11));
  assert(bd.sequencias['2026-11-13'].some(i => i.id === 12));
  assert(ls.getItem('fast539_backup_datas_automaticas'), 'reparo deixa backup local');
})();

(function dedupSemMudarData() {
  const bd = { rotas: [{ id: 7, data: '2026-11-12' }], sequencias: {
    '2026-11-12': [{ id: 70, rotaId: 7, status: 'EM ROTA', fotos: ['a'] }],
    '2026-11-13': [{ id: 71, rotaId: 7, status: 'CONCLUÍDA', statusUpdatedAt: '2026-11-13T10:00:00Z', fotos: ['b'] }]
  } };
  const win = { bancoDados: bd, verificarEVirarDia: noop };
  const doc = { hidden: false, addEventListener: noop };
  const ctx = { window: win, document: doc, bancoDados: bd, console, Date, Set, Map, JSON,
    fastRotaPorId: (arr, id) => arr.find(r => String(r.id) === String(id)) || null,
    fastDataValidaISO: v => /^\d{4}-\d{2}-\d{2}$/.test(v), salvarStorage: noop, renderizarSequencia: noop, renderizar: noop, ...timers() };
  vm.createContext(ctx); vm.runInContext(script('fast538-protege-data'), ctx);
  const n = win.fast538Deduplicar();
  assert.strictEqual(bd.rotas[0].data, '2026-11-12', 'dedup nunca reescreve a data da rota');
  assert.strictEqual(bd.sequencias['2026-11-12'].length, 1);
  assert.strictEqual(bd.sequencias['2026-11-13'].length, 0);
  const it = bd.sequencias['2026-11-12'][0];
  assert.strictEqual(it.status, 'CONCLUÍDA', 'status mais recente da cópia é preservado');
  assert.deepStrictEqual(Array.from(it.fotos).sort(), ['a', 'b'], 'fotos das cópias são unidas');
  assert(n >= 1);
  const bd2 = { rotas: [{ id: 8, data: '2026-11-13' }], sequencias: { '2026-11-12': [{ id: 80, rotaId: 8, status: 'CONCLUÍDA' }], '2026-11-13': [{ id: 81, rotaId: 8, status: 'CONCLUÍDA' }] } };
  win.bancoDados = bd2; ctx.bancoDados = bd2;
  win.fast538Deduplicar();
  assert.strictEqual(bd2.sequencias['2026-11-12'].length, 1, 'cópia histórica mais antiga permanece');
  assert.strictEqual(bd2.sequencias['2026-11-13'].length, 0, 'cópia em hoje é removida sem promover a rota');
  assert.strictEqual(bd2.rotas[0].data, '2026-11-13', 'dedup não reescreve rota.data');
})();

(function meiaNoiteMantemDataSelecionada() {
  let dia = '2026-11-12';
  const dp = { value: '2026-11-12' };
  const win = { addEventListener: noop };
  const doc = { hidden: false, getElementById: id => id === 'dpDataSequencia' ? dp : null, addEventListener: noop };
  const ctx = { window: win, document: doc, localStorage: storage(), console, Date,
    fastDataLocalYYYYMMDD: () => dia, verificarEVirarDia: noop, carregarSequenciaDia: noop, renderizar: noop, mostrarToast: noop, ...timers() };
  vm.createContext(ctx); vm.runInContext(script('fast537-virada-rotas'), ctx);
  dia = '2026-11-13'; win.fastRotasConferirDia();
  assert.strictEqual(dp.value, '2026-11-12', 'virada do dia não troca a data consultada');
})();

(function restauracaoMantemDataDeOntem() {
  const dp = { value: '2026-11-13', dispatchEvent: noop };
  const aba = { id: 'rotasDia' };
  const ls = storage(); ls.setItem('fast523_tela', JSON.stringify({ aba: 'rotasDia', y: 0, data: '2026-11-12', dia: '2026-11-12', jan: null, em: Date.now() }));
  const win = { addEventListener: noop, scrollY: 0, scrollTo: noop, abrirModalEditarSeq: noop };
  const doc = { readyState: 'complete', activeElement: null, getElementById: id => id === 'dpDataSequencia' ? dp : null,
    querySelector: sel => sel.includes('.tab-content.active') ? aba : null, addEventListener: noop };
  const ctx = { window: win, document: doc, localStorage: ls, console, Date, Event: function () {},
    trocarAba: noop, carregarSequenciaDia: noop, getComputedStyle: () => ({ display: 'none' }), ...timers() };
  ctx.setTimeout = fn => { fn(); return 0; };
  vm.createContext(ctx); vm.runInContext(script('fast523-manter-tela'), ctx);
  assert.strictEqual(dp.value, '2026-11-12', 'data consultada ontem é restaurada ao reabrir');
})();

(function metadadosSobrevivemSync() {
  function body(name) {
    const start = html.indexOf('function ' + name + '('); assert(start >= 0, name);
    const brace = html.indexOf('{', start); let depth = 0, quote = '', esc = false;
    for (let i = brace; i < html.length; i++) {
      const ch = html[i];
      if (quote) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === quote) quote = ''; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
      if (ch === '{') depth++; else if (ch === '}' && --depth === 0) return html.slice(brace + 1, i);
    }
    throw new Error(name);
  }
  const ctx = { console, Date, JSON, Number, String, Array, Object, Math, normalizarFotosItem: noop };
  vm.createContext(ctx);
  vm.runInContext('function sequenciasToRows(sequencias){' + body('sequenciasToRows') + '}', ctx);
  vm.runInContext('function rowsToSequencias(rows){' + body('rowsToSequencias') + '}', ctx);
  const item = { id: 1, rotaId: 2, status: 'CONCLUÍDA', statusUpdatedAt: '2026-11-12T10:00:00Z', updatedAt: '2026-11-12T10:00:00Z', dataOriginal: '2026-11-11', passouEm: '2026-11-12T03:00:00Z' };
  const rows = ctx.sequenciasToRows({ '2026-11-12': [item] });
  assert.strictEqual(rows[0].updated_at, item.updatedAt, 'sync não carimba item antigo como agora');
  const volta = ctx.rowsToSequencias(rows)['2026-11-12'][0];
  assert.strictEqual(volta.dataOriginal, item.dataOriginal);
  assert.strictEqual(volta.passouEm, item.passouEm);
  assert.strictEqual(volta.statusUpdatedAt, item.statusUpdatedAt);
})();

assert(!html.includes('fast538_carrega_desde'), 'gatilho antigo de carry-over ainda presente');
assert(!html.includes('setInterval(limpar,4000)'), 'timer antigo que movia concluídas ainda presente');
console.log('OK — datas cadastradas, seleção do dia, reparo conservador, dedup e metadados de sync protegidos.');
