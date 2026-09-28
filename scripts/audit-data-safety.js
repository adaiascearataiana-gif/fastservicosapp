'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function bodyOf(name) {
  const marker = `function ${name}`;
  const start = main.indexOf(marker);
  assert(start >= 0, `Função crítica ausente: ${name}`);
  const brace = main.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = brace; i < main.length; i++) {
    const ch = main[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}' && --depth === 0) return main.slice(brace + 1, i);
  }
  throw new Error(`Função incompleta: ${name}`);
}

assert(!/localStorage\.clear\s*\(/.test(main), 'Limpeza global de localStorage encontrada.');
assert(!/indexedDB\.deleteDatabase\s*\(\s*FAST_DB_NAME/.test(main), 'Exclusão do cofre principal encontrada.');
assert(main.includes("const FAST_TOMBSTONES_KEY = 'fastapp_exclusoes_permanentes_v1'"), 'Cofre permanente de exclusões ausente.');

const normalize = bodyOf('fastNormalizarBanco');
assert(normalize.includes('fastUnirExclusoesPermanentes(b)'), 'Normalização não preserva exclusões permanentes.');

const save = bodyOf('salvarStorage');
assert(save.includes('localStorage.setItem(FAST_LOCAL_KEY'), 'Salvamento síncrono local ausente.');
assert(save.includes('fastEnfileirarPersistencia'), 'Espelho IndexedDB ausente.');
assert(save.includes('fastMutationRevision++'), 'Revisão transacional ausente.');

const merge = bodyOf('mergeDados');
for (const key of ['rotasExcluidasSet', 'fotosExcluidasSet', 'seqItensExcluidosSet', 'seqRotasExcluidasSet', 'clientesExcluidos', 'destinosExcluidos']) {
  assert(merge.includes(key), `Merge não protege ${key}.`);
}

const destinationSave = bodyOf('salvarDestinoModal');
assert(destinationSave.includes('salvarStorage()'), 'Destino não é persistido antes da confirmação.');
assert(destinationSave.includes('fastPropagarRenomeacao'), 'Renomeação de destino não é propagada.');

const clientSave = bodyOf('salvarCliente');
assert(clientSave.includes('if (!salvarStorage())'), 'Cliente não é persistido antes da confirmação.');
assert(clientSave.includes('fastPropagarRenomeacao'), 'Renomeação de cliente não é propagada.');

const restore = main.slice(main.indexOf('window.fast70RestaurarCheckpoint='), main.indexOf('function rotasCliente', main.indexOf('window.fast70RestaurarCheckpoint=')));
assert(restore.includes("fast70CriarCheckpoint(true,'antes da restauração')"), 'Restauração não cria ponto de retorno.');
assert(restore.includes("'fotosExcluidas'"), 'Restauração pode ressuscitar fotos excluídas.');
assert(restore.includes("'clientesExcluidos'"), 'Restauração pode ressuscitar clientes excluídos.');
assert(restore.includes("'destinosExcluidos'"), 'Restauração pode ressuscitar destinos excluídos.');

const syncGuards = (main.match(/fastMutationRevision !== revisaoNoInicio/g) || []).length;
assert(syncGuards >= 2, 'Proteções contra merge concorrente insuficientes.');

const serviceWorkers = [
  'fast-sw.js', 'sw.js', 'app-cliente/sw.js', 'app-motorista/sw.js',
  'app-rotas-dia/sw.js', 'app-despesas/sw.js', 'app-limpo/sw.js'
];
for (const rel of serviceWorkers) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  assert(!/localStorage\.clear|indexedDB\.deleteDatabase/.test(text), `${rel} contém limpeza destrutiva de dados.`);
}

console.log('Segurança de dados OK: journal síncrono, espelho IndexedDB, snapshots, lápides e merge concorrente protegidos.');
