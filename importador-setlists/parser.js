/* Importador de setlists: sem dependências e sem envio da conversa a servidores. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SetlistParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAYS = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
  const pad = n => String(n).padStart(2, '0');
  const plain = s => String(s || '').replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/\*/g, '').trim();
  const normalized = s => plain(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  function date(y, m, d) {
    const result = new Date(y, m - 1, d, 12);
    return result.getFullYear() === y && result.getMonth() === m - 1 && result.getDate() === d ? result : null;
  }
  function parseDay(raw, reference) {
    const match = String(raw || '').match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (!match) return null;
    const d = +match[1], m = +match[2];
    if (match[3]) return date(+match[3] < 100 ? 2000 + +match[3] : +match[3], m, d);
    if (!reference) return null;
    // A week can straddle New Year's Eve. Pick the closest occurrence to the message.
    const years = [reference.getFullYear() - 1, reference.getFullYear(), reference.getFullYear() + 1];
    return years.map(y => date(y, m, d)).filter(Boolean).sort((a, b) => Math.abs(a - reference) - Math.abs(b - reference))[0] || null;
  }
  function iso(d) { return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : ''; }
  function br(d) { return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : ''; }
  function fromISO(s) {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? date(+m[1], +m[2], +m[3]) : null;
  }
  // WhatsApp Android: 28/10/2026 20:10 - Nome: ...
  // WhatsApp iPhone: [28/10/2026, 20:10:32] Nome: ...
  const stamp = /^(?:\[)?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]?\s*(?:-\s*)?([^:]+):\s?(.*)$/i;
  function messages(text) {
    const result = [];
    let current = null;
    String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').forEach(line => {
      const match = line.match(stamp);
      if (match) {
        const when = parseDay(match[1]);
        current = { when, author: match[3].trim(), text: match[4], line: result.length + 1 };
        result.push(current);
      } else if (current) current.text += '\n' + line;
    });
    return result;
  }
  const datesIn = s => String(s).match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g) || [];
  const addDays = (d, days) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12);
  const weekly = s => /^(?:MUSICAS?\s+(?:DA|PARA\s+A)\s+(?:(?:PROXIMA|PR[OÓ]XIMA)\s+)?SEMANA|SETLIST\b|REPERTORIO\b|LISTA\s+(?:DE\s+)?MUSICAS\b)/.test(s);
  function weekRange(heading, sent, fallback) {
    const list = datesIn(heading);
    if (list.length >= 2) {
      const first = parseDay(list[0], sent || fallback);
      const last = first && parseDay(list[list.length - 1], first);
      if (first && last && last >= first && (last - first) / 86400000 <= 8) return [first, last];
      return null; // An ambiguous or invalid range must not create invented dates.
    }
    const base = list.length ? parseDay(list[0], sent || fallback) : (sent || fallback);
    if (!base) return null;
    const day = (base.getDay() + 6) % 7; // Monday is the start of the week.
    const next = /PROXIMA\s+SEMANA/.test(normalized(heading)) && !list.length ? 7 : 0;
    const monday = addDays(base, -day + next);
    return [monday, addDays(monday, 6)];
  }
  function serviceName(heading) {
    const label = heading.replace(/\s*[-–—:]?\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*[:：-]?\s*$/, '').trim();
    const name = normalized(label).replace(/^[^A-Z]+/, '').trim();
    if (/^(?:CULTO\s+(?:DA|DE)\s+)?QUARTA(?:[\s-]+FEIRA)?$/.test(name)) return 'CULTO DA QUARTA';
    if (/^(?:EBD|ESCOLA\s+BIBLICA(?:\s+DOMINICAL)?)$/.test(name)) return 'EBD';
    if (/^CULTO\s+DA\s+NOITE$/.test(name)) return 'CULTO DA NOITE';
    return label;
  }
  function serviceDay(heading) {
    const name = normalized(heading);
    for (const [label, number] of [['DOMINGO', 0], ['SEGUNDA', 1], ['TERCA', 2], ['QUARTA', 3], ['QUINTA', 4], ['SEXTA', 5], ['SABADO', 6]]) {
      if (new RegExp(`\\b${label}(?:[\\s-]+FEIRA)?\\b`).test(name)) return number;
    }
    // These headings usually refer to Sunday. All other undated services require review.
    if (/^(?:EBD|ESCOLA BIBLICA|CULTO DA (?:NOITE|MANHA|TARDE))\b/.test(name)) return 0;
    return null;
  }
  function weekdayIn(range, weekday) {
    if (!range) return null;
    for (let d = range[0]; d <= range[1]; d = addDays(d, 1)) if (d.getDay() === weekday) return d;
    return null;
  }
  function song(line) {
    let value = plain(line).replace(/^[-•–—]\s+/, '').trim();
    const notes = [...value.matchAll(/\(([^)]+)\)/g)].map(m => m[1]);
    value = value.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    let artist = '', title = value;
    const hymn = value.match(/^HINO\s*(CC|C\.\s*C\.)?\s*(\d{1,3})\s*[-–—:]\s*(.+)$/i);
    if (hymn) {
      artist = hymn[1] ? 'Cantor Cristão' : '';
      title = hymn[1] ? `${hymn[3].trim()} - ${hymn[2]}` : `Hino ${hymn[2]} - ${hymn[3].trim()}`;
    } else {
      const split = value.match(/^(.+?)\s+[-–—]{1,3}\s+(.+)$/);
      if (split) { title = split[1].trim(); artist = split[2].trim(); }
    }
    return { title, artist, notes };
  }
  function extract(text, options = {}) {
    const start = fromISO(options.start), end = fromISO(options.end);
    if (!start || !end || start > end) throw new Error('Escolha um período válido (data inicial até data final).');
    const all = messages(text);
    const fallback = start;
    // Text pasted without a WhatsApp envelope is treated as a single undated setlist.
    const sources = all.length ? all : [{ when: null, author: 'Texto colado', text: String(text || ''), line: 1 }];
    const groups = [], warnings = [];
    for (const source of sources) {
      if (source.when && (source.when < start || source.when > end)) continue;
      const lines = source.text.replace(/\r\n?/g, '\n').split('\n');
      let event = null, eventDate = null, group = null, week = null, inWeekly = false;
      for (let i = 0; i < lines.length; i++) {
        const raw = plain(lines[i]);
        if (!raw) continue;
        const bullet = /^[-•–—]\s+(.+)/.exec(raw);
        if (!bullet) {
          const heading = raw.replace(/^\s*[#*_]+\s*|\s*[#*_]+\s*$/g, '').trim();
          const name = normalized(heading).replace(/^[^A-Z]+/, '');
          if (weekly(name)) {
            inWeekly = true;
            week = weekRange(heading, source.when, fallback);
            event = null; eventDate = null; group = null;
            if (!week) warnings.push(`Período semanal ambíguo em “${heading}” (${source.author}); informe a data em cada culto.`);
            continue;
          }
          const dates = datesIn(heading);
          // Inside a weekly list, any labeled block is a candidate (Friday, Saturday,
          // special services, etc.). Outside it, only explicitly dated worship blocks.
          const standalone = /^(?:CULTO\b|EBD\b|ESCOLA\s+BIBLICA\b|(?:SEGUNDA|TERCA|QUARTA|QUINTA|SEXTA|SABADO|DOMINGO)(?:[\s-]+FEIRA)?\b)/.test(name);
          if (inWeekly || (standalone && dates.length)) {
            event = serviceName(heading);
            const day = serviceDay(event);
            eventDate = dates.length ? parseDay(dates[dates.length - 1], source.when || (week && week[0]) || fallback)
              : day !== null ? weekdayIn(week, day) : null;
            group = null;
            if (!eventDate) warnings.push(`Confira a data de “${heading}” (${source.author}) na prévia antes de exportar.`);
          } else {
            event = null; eventDate = null; group = null;
          }
          continue;
        }
        if (!event) continue;
        const parsed = song(bullet[1]);
        if (!parsed.title || /^(?:https?:\/\/|<m[ií]dia oculta>|imagem omitida)/i.test(parsed.title)) continue;
        if (!group) {
          group = { id: groups.length, author: source.author, sent: br(source.when), event, date: br(eventDate), iso: iso(eventDate), day: eventDate ? DAYS[eventDate.getDay()] : '', songs: [] };
          groups.push(group);
        }
        group.songs.push({ ...parsed, id: `${group.id}-${group.songs.length}` });
      }
    }
    return { groups, warnings, messageCount: all.length, selectedMessageCount: sources.filter(s => !s.when || (s.when >= start && s.when <= end)).length };
  }
  function records(groups) {
    let order = 1;
    return groups.flatMap(g => g.songs.map(s => ({
      data: g.date, dia: g.day, evento: g.event, musica: s.title,
      artista: s.artist, tom: '', web: '', ordem: order++
    })));
  }
  return { extract, records, messages, fromISO, br };
});
