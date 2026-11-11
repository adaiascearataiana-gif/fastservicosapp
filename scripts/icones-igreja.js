// Gera o logotipo e os ícones do app da Igreja Batista em Nova Metrópole.
// Uso: node scripts/icones-igreja.js
function carregarSharp() {
  for (const caminho of ['sharp', '/tmp/sharpcheck/node_modules/sharp']) {
    try { return require(caminho); } catch (e) {}
  }
  console.log('Instale o sharp para gerar os ícones:  npm install sharp');
  process.exit(1);
}
const sharp = carregarSharp();
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'app-igreja', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// Emblema: cruz + Bíblia aberta dentro de anel dourado.
// `fundo` = true desenha o quadrado verde (ícone); false deixa transparente (logo do topo).
function svg({ fundo = true, texto = true, escala = 1 } = {}) {
  const S = 512;
  const grad = fundo
    ? `<defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0d5b45"/>
          <stop offset="55%" stop-color="#0b4a3a"/>
          <stop offset="100%" stop-color="#083a2e"/>
        </linearGradient>
        <radialGradient id="brilho" cx="30%" cy="18%" r="80%">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".18"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${S}" height="${S}" rx="${fundo ? 112 : 0}" fill="url(#g)"/>
      <rect width="${S}" height="${S}" rx="${fundo ? 112 : 0}" fill="url(#brilho)"/>`
    : '';

  const g = (escala || 1);
  const cx = 256, cy = fundo ? 236 : 256;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
    ${grad}
    <g transform="translate(${cx} ${cy}) scale(${g}) translate(${-cx} ${-cy})">
      <circle cx="256" cy="236" r="188" fill="none" stroke="#c9a227" stroke-width="10" opacity=".95"/>
      <circle cx="256" cy="236" r="168" fill="none" stroke="#f0c75e" stroke-width="2.5" opacity=".55"/>
      <!-- cruz -->
      <g fill="#ffffff">
        <rect x="243" y="92" width="26" height="196" rx="9"/>
        <rect x="188" y="146" width="136" height="26" rx="9"/>
      </g>
      <!-- bíblia aberta -->
      <g fill="none" stroke="#f0c75e" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M256 300c-30-18-62-24-92-22v56c30-2 62 4 92 22"/>
        <path d="M256 300c30-18 62-24 92-22v56c-30-2-62 4-92 22"/>
        <path d="M256 300v56"/>
      </g>
    </g>
    ${texto ? `<text x="256" y="${fundo ? 470 : 492}" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="52" letter-spacing="10"
        fill="#f0c75e" font-weight="700">IBNM</text>` : ''}
  </svg>`;
}

const logoClaro = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="256" cy="256" r="256" fill="#ffffff"/>
  <g transform="translate(56 56) scale(0.78)">
    ${svg({ fundo: false, texto: false })}
  </g>
</svg>`;

(async () => {
  const jobs = [
    ['icon-512.png', svg({ fundo: true, texto: true }), 512],
    ['icon-192.png', svg({ fundo: true, texto: true }), 192],
    ['icon-maskable-512.png', svg({ fundo: true, texto: true, escala: 0.82 }), 512],
    ['apple-touch-icon.png', svg({ fundo: true, texto: false }), 180],
    ['favicon-32.png', svg({ fundo: true, texto: false }), 32],
    ['logo.png', svg({ fundo: true, texto: false }), 256],
    ['logo-claro.png', logoClaro, 256],
    ['logo-512.png', svg({ fundo: true, texto: false }), 512]
  ];
  for (const [nome, s, size] of jobs) {
    const buffer = Buffer.from(s);
    await sharp(buffer, { density: 400 }).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(OUT, nome));
    console.log('gerado', nome, size);
  }
})();
