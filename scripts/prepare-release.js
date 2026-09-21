'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  throw new Error('Uso: node scripts/prepare-release.js X.Y.Z');
}
const cacheTag = 'r' + version.replace(/\D/g, '');
const previous = '4.0.3';
const previousTag = 'r403';

const files = [
  'index.html', 'fast-logistics-2.4.js', 'fast-sw.js', 'manifest.webmanifest',
  'manifest-motorista.webmanifest', 'manifest-rotas.webmanifest',
  'manifest-despesas.webmanifest', 'app-cliente/index.html',
  'app-cliente/manifest.webmanifest', 'app-cliente/sw.js',
  'app-motorista/index.html', 'app-motorista/manifest.webmanifest',
  'app-motorista/sw.js', 'app-rotas-dia/index.html',
  'app-rotas-dia/manifest.webmanifest', 'app-rotas-dia/sw.js',
  'app-despesas/index.html', 'app-despesas/manifest.webmanifest',
  'app-despesas/sw.js', 'app-limpo/index.html', 'motorista.html',
  'app-limpo/manifest.webmanifest', 'app-limpo/sw.js',
  'despesas/manifest.webmanifest', 'rotas-do-dia/manifest.webmanifest',
  'android/app/build.gradle',
  'android/app/src/main/java/br/com/fastservicos/app/MainActivity.java',
  'linux/package.json'
];

for (const rel of files) {
  const file = path.join(root, rel);
  let text = fs.readFileSync(file, 'utf8');
  text = text.split(previous).join(version).split(previousTag).join(cacheTag);
  fs.writeFileSync(file, text);
}

// Entradas legadas ainda são usadas por atalhos antigos e precisam anunciar a
// mesma versão; isso evita instalações presas em 3.1.8.
for (const rel of ['motorista.html', 'despesas/manifest.webmanifest', 'rotas-do-dia/manifest.webmanifest']) {
  const file = path.join(root, rel);
  let text = fs.readFileSync(file, 'utf8');
  text = text.split('3.1.8').join(version);
  fs.writeFileSync(file, text);
}

// Android exige versionCode crescente; X.Y.Z vira XXYYZZ (4.0.2 => 40002).
const gradle = path.join(root, 'android/app/build.gradle');
let android = fs.readFileSync(gradle, 'utf8');
const parts = version.split('.').map(Number);
const code = parts[0] * 10000 + parts[1] * 100 + parts[2];
android = android.replace(/versionCode\s+\d+/, 'versionCode ' + code);
fs.writeFileSync(gradle, android);

// No package-lock, alterar somente a versão do projeto. Substituição global
// corromperia versões legítimas de dependências que coincidam com a anterior.
const lockFile = path.join(root, 'linux/package-lock.json');
const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
lock.version = version;
if (lock.packages && lock.packages['']) lock.packages[''].version = version;
fs.writeFileSync(lockFile, JSON.stringify(lock, null, 2) + '\n');

console.log(`Versão ${version} preparada em todos os aplicativos (${cacheTag}).`);

// Usa a lista oficial da versão como fonte única para o modal do FAST e para
// os cards exclusivos. Evita que o HTML imediato e o JavaScript mostrem notas
// antigas ou diferentes entre si.
const updatesFile = path.join(root, 'updates.json');
if (fs.existsSync(updatesFile)) {
  const release = JSON.parse(fs.readFileSync(updatesFile, 'utf8'));
  if (release.version === version && Array.isArray(release.updates)) {
    const indexFile = path.join(root, 'index.html');
    let index = fs.readFileSync(indexFile, 'utf8');
    const escaped = JSON.stringify(release.updates)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    index = index.replace(/(<meta name="fast-app-changelog" content=")[^"]*(")/, '$1' + escaped + '$2');
    index = index.replace(/(<meta name="fast-app-date" content=")[^"]*(")/, '$1' + release.releasedAt + '$2');
    index = index.replace(/(<meta name="fast-latest-update" content=")[^"]*(")/, '$1' + version + ': auditoria geral, proteção de dados, sincronização e layout corrigidos.$2');
    index = index.split('\n').map(function(line) {
      return line.includes('id="fastUpdatesBody"')
        ? '                <div class="fast-updates-panel-body" id="fastUpdatesBody"></div>'
        : line;
    }).join('\n');
    fs.writeFileSync(indexFile, index);

    const logisticsFile = path.join(root, 'fast-logistics-2.4.js');
    let logistics = fs.readFileSync(logisticsFile, 'utf8');
    logistics = logistics.replace(/var allChanges=\[[\s\S]*?\],exclusive=/, 'var allChanges=' + JSON.stringify(release.updates) + ',exclusive=');
    logistics = logistics.replace(/latest\.content='[^']*';/, "latest.content='" + version + ": auditoria geral, proteção de dados, sincronização e layout corrigidos.';");
    logistics = logistics.replace(/date\.content='[^']*';/, "date.content='" + release.releasedAt + "';");
    fs.writeFileSync(logisticsFile, logistics);
  }
}
