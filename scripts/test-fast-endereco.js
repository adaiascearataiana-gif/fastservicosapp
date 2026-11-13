'use strict';
/* node scripts/test-fast-endereco.js */
const assert = require('assert');
const api = require('../fast-endereco.js');

function confere(entrada, esperado) {
  const r = api.reconhecer(entrada);
  Object.keys(esperado).forEach(k => {
    if (Array.isArray(esperado[k])) assert.deepStrictEqual(r[k], esperado[k], k + ' em: ' + JSON.stringify(entrada));
    else assert.strictEqual(r[k], esperado[k], k + ' em: ' + JSON.stringify(entrada));
  });
  return r;
}

confere('Rua das Flores, 123 - Centro', { logradouro: 'Rua das Flores', numero: '123', bairro: 'Centro', avisos: [] });
confere('Endereço: Rua das Flores, 123 - Centro\nBairro: Centro\nNúmero: 123', { logradouro: 'Rua das Flores', numero: '123', bairro: 'Centro' });
confere('📍 *Rua das Flores*, nº 123\n*Bairro:* Centro', { logradouro: 'Rua das Flores', numero: '123', bairro: 'Centro' });
confere('Avenida Dom Luís, 500 – Aldeota, Fortaleza - CE, CEP 60160-230', { logradouro: 'Avenida Dom Luís', numero: '500', bairro: 'Aldeota', cidadeUf: 'Fortaleza - CE', cep: '60160-230' });
confere('Rua A\n123\nBairro: Messejana', { logradouro: 'Rua A', numero: '123', bairro: 'Messejana' });
confere('Rua 13 de Maio 456, Benfica', { logradouro: 'Rua 13 de Maio', numero: '456', bairro: 'Benfica' });
confere('Rua Sem Nome, S/N - Jardim', { numero: 'S/N', bairro: 'Jardim' });
confere('Travessa São José, nº 25, Casa B - Parquelândia', { logradouro: 'Travessa São José', numero: '25', bairro: 'Parquelândia', complemento: 'Casa B' });
confere('Bom dia!\nRua X, 77\nMondubim', { logradouro: 'Rua X', numero: '77', bairro: 'Mondubim' });
confere('Rua X, 100\nComplemento: Apto 202\nReferência: perto da praça\nCEP: 60000-000', { numero: '100', complemento: 'Apto 202', referencia: 'perto da praça', cep: '60000-000' });
confere('Rua X, 100\nTelefone: (85) 99999-9999', { numero: '100', logradouro: 'Rua X' });
confere('Endereço: Rua X, 123 - Bairro: Centro - Número: 123', { logradouro: 'Rua X', numero: '123', bairro: 'Centro' });
confere('Avenida 23 de Maio, 100 - Centro', { logradouro: 'Avenida 23 de Maio', numero: '100', bairro: 'Centro' });
const incompleto = confere('RuaSemNumero - Bairro', { numero: '' });
assert(incompleto.avisos.some(a => /Número/.test(a)));
const vazio = api.reconhecer('Bom dia, tudo bem?');
assert.strictEqual(vazio.logradouro, '');
assert(vazio.avisos.length >= 1);
assert.strictEqual(api.juntarNumero('Rua X, 123', '123'), 'Rua X, 123');
assert.strictEqual(api.juntarNumero('Rua X', '123'), 'Rua X, 123');
assert.strictEqual(api.juntarNumero('Rua X', ''), 'Rua X');
assert.strictEqual(api.separarNumero('Rua X, nº 123 - Centro').numero, '123');
assert.strictEqual(api.montar({ logradouro: 'Rua X', numero: '10', bairro: 'Centro' }), 'Rua X, 10 - Centro');
console.log('OK — endereços do WhatsApp: rua, número, bairro, complemento, CEP, S/N e fallback manual.');
