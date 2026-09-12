'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
// IDs em templates JavaScript são criados sob demanda e não pertencem ao DOM inicial.
const initialMarkup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const ids = [...initialMarkup.matchAll(/<[^>]*\sid="([^"]+)"[^>]*>/g)].map(m => m[1]);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
const forbidden = [/ghp_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /service_role\s*[:=]/i];
if (duplicates.length) throw new Error(`IDs HTML duplicados: ${[...new Set(duplicates)].join(', ')}`);
for (const pattern of forbidden) if (pattern.test(html)) throw new Error(`Credencial potencialmente exposta: ${pattern}`);
if (!html.includes('desktop-bridge.js')) throw new Error('Integração Linux ausente.');
let scriptsOk = 0;
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
scripts.forEach((match, index) => {
  const attrs = match[1] || '';
  const code = match[2] || '';
  if (/\bsrc\s*=/.test(attrs) || /type\s*=\s*["'](?:application\/ld\+json|module)["']/.test(attrs) || !code.trim()) return;
  try { new Function(code); scriptsOk++; }
  catch (error) { throw new Error(`JavaScript interno quebrado no bloco ${index + 1}: ${error.message}`); }
});
console.log(`Auditoria OK: ${ids.length} IDs únicos; ${scriptsOk} scripts internos válidos; nenhuma credencial administrativa encontrada.`);
