'use strict';
const $ = id => document.getElementById(id);
let groups = [];
const file = $('file'), area = $('conversation');
const now = new Date();
const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
$('start').value = `${now.getFullYear()}-01-01`;
$('end').value = today;
function error(message) { $('error').textContent = message; $('error').hidden = !message; }
async function loadFile(selected) {
  if (!selected) return;
  if (!/\.txt$/i.test(selected.name)) { error('Selecione um arquivo .txt exportado sem mídia.'); return; }
  if (selected.size > 25 * 1024 * 1024) { error('Arquivo maior que 25 MB. Divida o histórico em trechos menores.'); return; }
  try {
    area.value = await selected.text();
    $('fileName').textContent = `${selected.name} · ${(selected.size / 1024).toFixed(0)} KB`;
    error('');
  } catch (_) { error('Não foi possível ler este arquivo.'); }
}
file.addEventListener('change', () => loadFile(file.files[0]));
const drop = $('drop');
['dragenter', 'dragover'].forEach(event => drop.addEventListener(event, e => { e.preventDefault(); drop.classList.add('drag'); }));
['dragleave', 'drop'].forEach(event => drop.addEventListener(event, e => { e.preventDefault(); drop.classList.remove('drag'); }));
drop.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
function count() {
  const n = groups.reduce((sum, g) => sum + g.songs.length, 0);
  $('summary').textContent = `${groups.length} se${groups.length === 1 ? 'ção' : 'ções'} encontrada${groups.length === 1 ? '' : 's'} · ${n} música${n === 1 ? '' : 's'} para exportar${groups.some(g => !g.iso) ? ' · preencha as datas destacadas' : ''}`;
  $('json').disabled = $('csv').disabled = n === 0 || groups.some(g => !g.iso);
}
function build() {
  const container = $('groups'); container.replaceChildren();
  if (!groups.length) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'Nenhuma lista encontrada nesse período. Confira o formato das mensagens e as datas selecionadas.'; container.append(empty); }
  groups.forEach(g => {
    const card = document.createElement('article'); card.className = 'group';
    const head = document.createElement('div'); head.className = 'group-head';
    const info = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = g.event;
    const meta = document.createElement('small'); meta.textContent = `${g.day ? g.day + ' · ' : ''}Enviado por ${g.author}${g.sent ? ' em ' + g.sent : ' (sem data de envio)'}`;
    const label = document.createElement('label'); label.className = 'event-date'; label.textContent = 'DATA DO CULTO ';
    const dateInput = document.createElement('input'); dateInput.type = 'date'; dateInput.value = g.iso;
    dateInput.setAttribute('aria-label', `Data do evento ${g.event}`);
    if (!g.iso) dateInput.classList.add('missing');
    dateInput.addEventListener('change', () => {
      const d = SetlistParser.fromISO(dateInput.value);
      g.iso = d ? dateInput.value : '';
      g.date = SetlistParser.br(d);
      g.day = d ? ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'][d.getDay()] : '';
      meta.textContent = `${g.day ? g.day + ' · ' : ''}Enviado por ${g.author}${g.sent ? ' em ' + g.sent : ' (sem data de envio)'}`;
      dateInput.classList.toggle('missing', !g.iso);
      count();
    });
    label.append(dateInput); info.append(title, label, meta);
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remover lista';
    remove.addEventListener('click', () => { groups = groups.filter(x => x !== g); build(); });
    head.append(info, remove); card.append(head);
    g.songs.forEach((s, i) => {
      const row = document.createElement('div'); row.className = 'song-row';
      const num = document.createElement('span'); num.textContent = String(i + 1).padStart(2, '0');
      for (const [key, placeholder] of [['title', 'Título da música'], ['artist', 'Artista (opcional)']]) {
        const input = document.createElement('input'); input.type = 'text'; input.value = s[key]; input.placeholder = placeholder;
        input.setAttribute('aria-label', `${placeholder}, ${g.event}, ${g.date}`);
        if (key === 'artist') input.className = 'artist';
        input.addEventListener('input', () => { s[key] = input.value; }); row.append(input);
      }
      row.prepend(num);
      const del = document.createElement('button'); del.type = 'button'; del.textContent = '×'; del.title = 'Remover música'; del.setAttribute('aria-label', 'Remover ' + s.title);
      del.addEventListener('click', () => { g.songs.splice(g.songs.indexOf(s), 1); if (!g.songs.length) groups = groups.filter(x => x !== g); build(); });
      row.append(del); card.append(row);
    });
    container.append(card);
  });
  count();
}
$('analyze').addEventListener('click', () => {
  error('');
  if (!area.value.trim()) { error('Carregue um arquivo .txt ou cole o texto da conversa.'); return; }
  try {
    const parsed = SetlistParser.extract(area.value, { start: $('start').value, end: $('end').value });
    groups = parsed.groups;
    const notices = [];
    if (parsed.messageCount && !parsed.selectedMessageCount) notices.push('Nenhuma mensagem enviada dentro do período escolhido.');
    notices.push(...parsed.warnings);
    $('warnings').hidden = notices.length === 0;
    $('warnings').textContent = notices.join(' ');
    $('results').hidden = false; build(); $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { error(e.message); }
});
function safeRecords() {
  const rows = SetlistParser.records(groups);
  if (groups.some(g => !g.iso)) { $('warnings').hidden = false; $('warnings').textContent = 'Preencha as datas destacadas antes de exportar.'; $('warnings').scrollIntoView(); return null; }
  if (rows.some(row => !row.musica.trim())) { $('warnings').hidden = false; $('warnings').textContent = 'Preencha os títulos vazios ou remova essas músicas antes de exportar.'; $('warnings').scrollIntoView(); return null; }
  return rows.map(row => ({ ...row, musica: row.musica.trim(), artista: row.artista.trim() }));
}
function download(contents, filename, mime, bom = false) {
  const url = URL.createObjectURL(new Blob([...(bom ? ['\uFEFF'] : []), contents], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function csv(rows) {
  const columns = ['data', 'dia', 'evento', 'musica', 'artista', 'tom', 'web', 'ordem'];
  const cell = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  return [columns.join(','), ...rows.map(row => columns.map(col => cell(row[col])).join(','))].join('\r\n');
}
$('json').addEventListener('click', () => { const rows = safeRecords(); if (rows && rows.length) download(JSON.stringify(rows, null, 2), 'musicas_cantadas.json', 'application/json;charset=utf-8'); });
$('csv').addEventListener('click', () => { const rows = safeRecords(); if (rows && rows.length) download(csv(rows), 'musicas_cantadas.csv', 'text/csv;charset=utf-8', true); });
