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
console.log(`Auditoria OK: ${ids.length} IDs únicos; nenhuma credencial GitHub/Supabase administrativa encontrada.`);
