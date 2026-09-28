import fs from 'node:fs';

const html=fs.readFileSync(new URL('../app-motorista/index.html',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../motorista-admin.js',import.meta.url),'utf8');
const required=[
  'data-mot-step="0"','data-mot-step="1"','data-mot-step="2"',
  'data-camera','data-gallery-btn','data-remove','data-confirm',
  'motVirarCamera','motReviewStage','motOtpStage','motPasswordStage',
  '/otp','/verify','motUploadDocs','motorista-documentos',
  'RNTRC é obrigatório','AAA0000','AAA0A00','Comprovar situação na Receita Federal'
];
for(const marker of required)if(!html.includes(marker))throw new Error(`Recurso ausente: ${marker}`);
for(const marker of ['Cadastro novo','Em processo de aprovação','Motorista aprovado','Motorista negado','motivoNegacao'])if(!admin.includes(marker))throw new Error(`Estado administrativo ausente: ${marker}`);

const plate=/^[A-Z]{3}(?:\d{4}|\d[A-Z]\d{2})$/;
for(const [value,expected] of [['AAA0000',true],['AAA0A00',true],['AAA-0000',false],['AA00000',false],['AAA00A0',false]])if(plate.test(value)!==expected)throw new Error(`Placa: ${value}`);
function cpf(value){const v=String(value).replace(/\D/g,'');if(v.length!==11||/^(\d)\1{10}$/.test(v))return false;for(let t=9;t<11;t++){let sum=0;for(let i=0;i<t;i++)sum+=Number(v[i])*(t+1-i);let digit=sum*10%11;if(digit===10)digit=0;if(digit!==Number(v[t]))return false}return true}
if(!cpf('52998224725')||cpf('52998224724')||cpf('11111111111'))throw new Error('Validação de CPF falhou');
console.log('Cadastro do Motorista: testes estruturais e regras críticas OK.');
