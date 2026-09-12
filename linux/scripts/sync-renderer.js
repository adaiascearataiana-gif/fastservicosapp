'use strict';

const fs = require('fs');
const path = require('path');

const linuxRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(linuxRoot, '..');
const rendererRoot = path.join(linuxRoot, 'src', 'renderer');

function copy(relative) {
  const source = path.join(repoRoot, relative);
  const target = path.join(rendererRoot, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function syncMain() {
  // A cópia gerada remove espaços residuais no fim das linhas, sem alterar
  // conteúdo ou comportamento, para manter o pacote limpo e auditável.
  const source = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8').replace(/[ \t]+$/gm, '');
  const marker = '<script src="desktop-bridge.js"></script>';
  const closing = source.lastIndexOf('</body>');
  if (closing < 0) throw new Error('index.html principal sem </body>.');
  const desktop = source.slice(0, closing) + marker + '\n' + source.slice(closing);
  fs.writeFileSync(path.join(rendererRoot, 'index.html'), desktop, 'utf8');
}

syncMain();
[
  'motorista.html',
  'manifest.webmanifest',
  'manifest-motorista.webmanifest',
  'manifest-rotas.webmanifest',
  'manifest-despesas.webmanifest',
  'fast-sw.js',
  'sw.js',
  'v2-ui.css',
  'v2-ui.js',
  'app-cliente/index.html',
  'app-cliente/manifest.webmanifest',
  'app-cliente/sw.js',
  'app-rotas-dia/index.html',
  'app-rotas-dia/manifest.webmanifest',
  'app-rotas-dia/sw.js',
  'app-despesas/index.html',
  'app-despesas/manifest.webmanifest',
  'app-despesas/sw.js',
  'rotas-do-dia/index.html',
  'rotas-do-dia/manifest.webmanifest',
  'despesas/index.html',
  'despesas/manifest.webmanifest'
].forEach(copy);

for (const name of fs.readdirSync(path.join(repoRoot, 'assets'))) {
  const source = path.join(repoRoot, 'assets', name);
  if (fs.statSync(source).isFile()) copy(path.join('assets', name));
}

console.log('Renderer Linux sincronizado com os cinco aplicativos da raiz.');
