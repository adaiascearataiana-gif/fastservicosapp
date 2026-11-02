const test = require('node:test');
const assert = require('node:assert/strict');
const { extract, records, messages } = require('./parser');
const sample = `28/10/2026 19:30 - Maria: *SETLIST DA SEMANA 04/10 - 08/11*

*CULTO DA QUARTA 28/10*
- Hino CC 05 - Presença Divina *(CANTAR NOVAMENTE)*
- Hino CC 222 - Manso e Suave
- Bem mais que tudo

*EBD 01/11*
- Ele vem pra te salvar - Adhemar de Campos
- Hino 410 - Felicidade no Serviço

*CULTO DA NOITE 01/11*
- Hino CC 85 - Cantai Louvores
- Hino CC 135 - Louvor
- Preciso de Ti - Diante do Trono
- Quebrantado - Vineyard
- Basta que me toque Senhor / Mãos ensanguentadas de sangue / Tocou-me --- Ariane`;
test('extracts example into table records with inferred year and separate services', () => {
  const data = extract(sample, { start: '2026-10-01', end: '2026-10-31' });
  assert.equal(data.groups.length, 3);
  const rows = records(data.groups);
  assert.equal(rows.length, 10);
  assert.deepEqual(rows[0], { data: '28/10/2026', dia: 'QUARTA', evento: 'CULTO DA QUARTA', musica: 'Presença Divina - 05', artista: 'Cantor Cristão', tom: '', web: '', ordem: 1 });
  assert.equal(rows[3].data, '01/11/2026');
  assert.equal(rows[3].dia, 'DOMINGO');
  assert.equal(rows[4].artista, '');
  assert.equal(rows[4].musica, 'Hino 410 - Felicidade no Serviço');
  assert.equal(rows[9].musica, 'Basta que me toque Senhor / Mãos ensanguentadas de sangue / Tocou-me');
  assert.equal(rows[9].artista, 'Ariane');
});
test('inclusive message range, not event date; unrelated chat ignored', () => {
  const text = sample + '\n29/10/2026 08:00 - João: Bom dia!\n01/11/2026 14:00 - Ana: *EBD 01/11*\n- Canção B';
  assert.equal(extract(text, { start: '2026-10-28', end: '2026-10-28' }).groups.length, 3);
  assert.equal(extract(text, { start: '2026-11-01', end: '2026-11-01' }).groups[0].songs[0].title, 'Canção B');
});
test('iPhone timestamps and multiline messages; year boundary', () => {
  const input = `[31/12/2025, 21:09:02] Ana: *CULTO DA NOITE 01/01*\n• Feliz Ano Novo - Grupo\n[01/01/2026, 00:01] Bia: Obrigada`;
  assert.equal(messages(input).length, 2);
  assert.equal(records(extract(input, { start: '2025-12-31', end: '2025-12-31' }).groups)[0].data, '01/01/2026');
});
test('plain pasted setlist uses start year, invalid inputs rejected', () => {
  const data = extract('*EBD 01/11*\n- Música 1', { start: '2026-10-01', end: '2026-11-30' });
  assert.equal(records(data.groups)[0].data, '01/11/2026');
  assert.throws(() => extract(sample, { start: '2026-11-30', end: '2026-10-01' }));
  const invalid = extract('*CULTO 31/02*\n- Música', { start: '2026-01-01', end: '2026-12-31' });
  assert.equal(invalid.groups.length, 1);
  assert.equal(invalid.groups[0].date, '');
  assert.ok(invalid.warnings.length);
});

test('weekly heading variants and undated Wednesday/EBD/night sections', () => {
  const examples = [
    'MÚSICAS DA SEMANA 02/11 - 08/11',
    'MÚSICAS DA PRÓXIMA SEMANA 02/11 - 08/11',
    'SETLIST 02/11 a 08/11'
  ];
  for (const title of examples) {
    const input = `02/11/2026 18:00 - Maria: *${title}*\n*QUARTA FEIRA*\n- Hino CC 05 - Presença Divina\n*ENSAIO*\n- Não incluir\n*EBD*\n- Canção da manhã\n*CULTO DA NOITE*\n- Canção da noite`;
    const rows = records(extract(input, { start: '2026-11-02', end: '2026-11-02' }).groups);
    assert.deepEqual(rows.map(r => [r.data, r.evento, r.musica]), [
      ['04/11/2026', 'CULTO DA QUARTA', 'Presença Divina - 05'],
      ['', 'ENSAIO', 'Não incluir'],
      ['08/11/2026', 'EBD', 'Canção da manhã'],
      ['08/11/2026', 'CULTO DA NOITE', 'Canção da noite']
    ]);
  }
});
test('next-week label without dates uses next week, including year rollover', () => {
  const input = `28/12/2026 12:00 - Maria: MÚSICAS DA PRÓXIMA SEMANA\nQUARTA-FEIRA\n• Hino CC 10 - Louvor\nEBD\n• Feliz Ano Novo`;
  const rows = records(extract(input, { start: '2026-12-28', end: '2026-12-28' }).groups);
  assert.equal(rows[0].data, '06/01/2027');
  assert.equal(rows[1].data, '10/01/2027');
});
test('other dated and undated blocks become their own services, not leaked to the previous' , () => {
  const input = `02/11/2026 12:00 - Maria: *SETLIST DA SEMANA 02/11 - 08/11*\n*QUARTA FEIRA 04/11*\n- Sim\n*CULTO DA MANHÃ*\n- Não\n*ENSAIO 05/11*\n- Não também\n*EBD 08/11*\n- Sim também`;
  assert.deepEqual(records(extract(input, { start: '2026-11-02', end: '2026-11-02' }).groups).map(r => [r.evento, r.musica]), [['CULTO DA QUARTA', 'Sim'], ['CULTO DA MANHÃ', 'Não'], ['ENSAIO', 'Não também'], ['EBD', 'Sim também']]);
});
test('undated section outside weekly context is skipped with warning', () => {
  const data = extract('02/11/2026 12:00 - Maria: EBD\n- Música', { start: '2026-11-01', end: '2026-11-05' });
  assert.equal(data.groups.length, 0);
});

test('includes Friday, Saturday and other services from a weekly list', () => {
  const input = `02/11/2026 12:00 - Maria: MÚSICAS DA SEMANA 02/11 - 08/11
SEXTA-FEIRA
- Canção sexta
SÁBADO
- Canção sábado
CULTO ESPECIAL 07/11
- Canção especial
EBD
- Canção domingo`;
  const data = extract(input, { start: '2026-11-02', end: '2026-11-02' });
  assert.deepEqual(records(data.groups).map(r => [r.evento, r.data, r.dia]), [
    ['SEXTA-FEIRA', '06/11/2026', 'SEXTA'],
    ['SÁBADO', '07/11/2026', 'SÁBADO'],
    ['CULTO ESPECIAL', '07/11/2026', 'SÁBADO'],
    ['EBD', '08/11/2026', 'DOMINGO']
  ]);
});
test('unknown undated weekly service is retained for manual date entry', () => {
  const data = extract('02/11/2026 12:00 - Maria: SETLIST DA SEMANA 02/11 - 08/11\nCULTO DE JOVENS\n- Música', { start: '2026-11-02', end: '2026-11-02' });
  assert.equal(data.groups.length, 1);
  assert.equal(data.groups[0].date, '');
  assert.equal(data.groups[0].songs[0].title, 'Música');
  assert.ok(data.warnings.length);
});
