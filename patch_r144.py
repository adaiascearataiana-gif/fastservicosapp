# -*- coding: utf-8 -*-
"""patch_r144.py — troca os ícones dos apps ROTAS DO DIA e DESPESAS (r144).

O usuário enviou dois designs novos (887x887) para os ícones dos mini-apps
instaláveis. As fontes ficam em assets/fontes/ (rotas-do-dia-887.png e
despesas-887.png). Este patch é AUTOCONTIDO e idempotente:

 1. gera os ícones novos (recorte do card com margem fotográfica + máscara
    RGBA de cantos arredondados ~21%, supersampling 4x) em .tmp_icons/;
 2. arquiva os PNGs atuais (antigos) em backups/atalho-*-old-r143.png — só
    se ainda não foram arquivados e se diferem dos novos;
 3. instala os novos PNGs em assets/atalho-{rotas-dia,despesas}-{192,512}.png;
 4. bump de TODOS os cache-busts que apontam para esses PNGs
    (r72/r89/r114/r128/2.1.0 -> r144) nos manifests, páginas e instaladoras;
 5. bump do link do manifest nas páginas (?v=r128/?v=r89 -> ?v=r144) para o
    navegador baixar o manifest novo em vez do cache;
 6. bump do nome do cache e da URL de registro dos Service Workers dos
    mini-apps (r134 -> r144) — reinstala o SW e troca o ícone de apps já
    instalados na tela inicial;
 7. espelho linux/src/renderer sincronizado;
 8. sanidade: varre o repo inteiro e garante que nenhuma referência a esses
    PNGs ficou com versão velha ou sem cache-bust.

Nenhum arquivo do app principal (index.html raiz) é tocado — mudança só nos
mini-apps, como no r134 (commit separado, sem bump da versão principal).
"""

import os
import re
import shutil
import sys

import glob

R = 'r144'

# ---------------------------------------------------------------- helpers

def must(cond, msg):
    if not cond:
        print('FALHOU: ' + msg)
        sys.exit(1)
    print('ok ' + msg)


def load(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def save(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)


def replace_all(path, pairs, label):
    """Substitui cada (old, new, expected) em TODAS as ocorrências."""
    c = load(path)
    for old, new, expected in pairs:
        n = c.count(old)
        must(n == expected,
             f'[{label}] âncora {old[:60]!r} presente {n}x (esperado {expected})')
        c = c.replace(old, new)
    save(path, c)
    print(f'ok gravado {path}')


def replace_exact(path, pairs, label):
    """Substitui cada (old, new) exatamente 1x."""
    c = load(path)
    for old, new in pairs:
        n = c.count(old)
        must(n == 1,
             f'[{label}] âncora {old[:60]!r} presente {n}x (esperado 1)')
        c = c.replace(old, new)
    save(path, c)
    print(f'ok gravado {path}')


# ------------------------------------------- 0) fontes + geração dos ícones

from PIL import Image, ImageDraw

FONTES = [
    # (fonte 887x887, bbox do card detectado, base do nome de saída)
    ('assets/fontes/rotas-do-dia-887.png', (47, 23, 865, 887), 'atalho-rotas-dia'),
    ('assets/fontes/despesas-887.png', (11, 22, 840, 887), 'atalho-despesas'),
]
SS = 4  # supersampling da máscara (anti-aliasing dos cantos)

os.makedirs('assets/fontes', exist_ok=True)
for src, _, _ in FONTES:
    must(os.path.exists(src), f'fonte presente: {src}')

os.makedirs('.tmp_icons', exist_ok=True)
for src, box, base in FONTES:
    im = Image.open(src).convert('RGB')
    must(im.size == (887, 887), f'{src}: {im.size} (esperado 887x887)')
    card = im.crop(box)
    for size in (512, 192):
        card_s = card.resize((size, size), Image.LANCZOS)
        r = int(round(size * 0.21))
        m = Image.new('L', (size * SS, size * SS), 0)
        ImageDraw.Draw(m).rounded_rectangle(
            [0, 0, size * SS - 1, size * SS - 1], radius=r * SS, fill=255)
        m = m.resize((size, size), Image.LANCZOS)
        out = card_s.convert('RGBA')
        out.putalpha(m)
        out.save(f'.tmp_icons/{base}-{size}.png', optimize=True)
    print(f'ok gerados .tmp_icons/{base}-{{192,512}}.png a partir de {src}')

# ---------------------------------------- 1) arquivar antigos + instalar novos

os.makedirs('backups', exist_ok=True)
for base in ('atalho-rotas-dia', 'atalho-despesas'):
    for size in (192, 512):
        cur = f'assets/{base}-{size}.png'
        new = f'.tmp_icons/{base}-{size}.png'
        must(os.path.exists(cur), f'ícone atual presente: {cur}')
        same = open(cur, 'rb').read() == open(new, 'rb').read()
        dst = f'backups/{base}-{size}-old-r143.png'
        if not same and not os.path.exists(dst):
            shutil.copy2(cur, dst)
            print(f'ok arquivado {dst}')
        elif os.path.exists(dst):
            print(f'ok já arquivado {dst}')
        shutil.copy2(new, cur)
        print(f'ok instalado {cur}')

# ------------------------------------------------- 2) manifests dos mini-apps

for path in ['app-rotas-dia/manifest.webmanifest',
             'linux/src/renderer/app-rotas-dia/manifest.webmanifest']:
    replace_all(path, [
        ('atalho-rotas-dia-192.png?v=r114', 'atalho-rotas-dia-192.png?v=r144', 2),
        ('atalho-rotas-dia-512.png?v=r114', 'atalho-rotas-dia-512.png?v=r144', 2),
    ], 'manifest rotas')

for path in ['app-despesas/manifest.webmanifest',
             'linux/src/renderer/app-despesas/manifest.webmanifest']:
    replace_all(path, [
        ('atalho-despesas-192.png?v=r114', 'atalho-despesas-192.png?v=r144', 2),
        ('atalho-despesas-512.png?v=r114', 'atalho-despesas-512.png?v=r144', 2),
    ], 'manifest despesas')

# ------------------------------------------------------ 3) páginas dos apps

# favicon/img (?v=r128 x2) + link do manifest (?v=r128 x1) + registro do sw
for path in ['app-rotas-dia/index.html',
             'linux/src/renderer/app-rotas-dia/index.html']:
    replace_all(path, [
        ('atalho-rotas-dia-192.png?v=r128', 'atalho-rotas-dia-192.png?v=r144', 2),
        ('href="manifest.webmanifest?v=r128"', 'href="manifest.webmanifest?v=r144"', 1),
        ("serviceWorker.register('./sw.js?v=r134'", "serviceWorker.register('./sw.js?v=r144'", 1),
    ], 'index rotas')

for path in ['app-despesas/index.html',
             'linux/src/renderer/app-despesas/index.html']:
    replace_all(path, [
        ('atalho-despesas-192.png?v=r128', 'atalho-despesas-192.png?v=r144', 2),
        ('href="manifest.webmanifest?v=r128"', 'href="manifest.webmanifest?v=r144"', 1),
        ("serviceWorker.register('./sw.js?v=r134'", "serviceWorker.register('./sw.js?v=r144'", 1),
    ], 'index despesas')

# ------------------------------------------------- 4) instaladoras legadas

replace_exact('instalar-rotas.html', [
    ('manifest-rotas.webmanifest?v=r72', 'manifest-rotas.webmanifest?v=r144'),
    ('href="assets/atalho-rotas-dia-192.png"',
     'href="assets/atalho-rotas-dia-192.png?v=r144"'),
    ('src="assets/atalho-rotas-dia-192.png"',
     'src="assets/atalho-rotas-dia-192.png?v=r144"'),
], 'instalar rotas')

replace_exact('instalar-despesas.html', [
    ('manifest-despesas.webmanifest?v=r72', 'manifest-despesas.webmanifest?v=r144'),
    ('href="assets/atalho-despesas-192.png"',
     'href="assets/atalho-despesas-192.png?v=r144"'),
    ('src="assets/atalho-despesas-192.png"',
     'src="assets/atalho-despesas-192.png?v=r144"'),
], 'instalar despesas')

# ------------------------------------------- 5) manifests de atalho (raiz)

replace_exact('manifest-rotas.webmanifest', [
    ('atalho-rotas-dia-192.png?v=r72', 'atalho-rotas-dia-192.png?v=r144'),
    ('atalho-rotas-dia-512.png?v=r72', 'atalho-rotas-dia-512.png?v=r144'),
], 'manifest-rotas raiz')

replace_exact('manifest-despesas.webmanifest', [
    ('atalho-despesas-192.png?v=r72', 'atalho-despesas-192.png?v=r144'),
    ('atalho-despesas-512.png?v=r72', 'atalho-despesas-512.png?v=r144'),
], 'manifest-despesas raiz')

for path in ['manifest.webmanifest',
             'linux/src/renderer/manifest.webmanifest']:
    replace_exact(path, [
        ('atalho-rotas-dia-192.png?v=2.1.0', 'atalho-rotas-dia-192.png?v=r144'),
        ('atalho-despesas-192.png?v=2.1.0', 'atalho-despesas-192.png?v=r144'),
    ], 'manifest raiz shortcuts')

# ------------------------------------ 6) wrappers legados rotas-do-dia/ despesas/

# wrappers legados: só favicon href (não têm <img>) + link do manifest ?v=r89
WRAPPERS = {
    'rotas-do-dia': 'rotas-dia',
    'despesas': 'despesas',
}
for pasta, base in WRAPPERS.items():
    replace_exact(f'{pasta}/manifest.webmanifest', [
        (f'atalho-{base}-192.png?v=r89', f'atalho-{base}-192.png?v=r144'),
        (f'atalho-{base}-512.png?v=r89', f'atalho-{base}-512.png?v=r144'),
    ], f'manifest wrapper {base}')
    replace_exact(f'{pasta}/index.html', [
        ('href="manifest.webmanifest?v=r89"', 'href="manifest.webmanifest?v=r144"'),
        (f'href="../assets/atalho-{base}-192.png"',
         f'href="../assets/atalho-{base}-192.png?v=r144"'),
    ], f'index wrapper {base}')

# ------------------------------------------------------- 7) sw.js dos apps

for path in ['app-rotas-dia/sw.js', 'linux/src/renderer/app-rotas-dia/sw.js']:
    replace_exact(path, [
        ('/* FAST Servicos - app Rotas do Dia - Service Worker persistente (r134)',
         '/* FAST Servicos - app Rotas do Dia - Service Worker persistente (r134; r144 = novos icones)'),
        ("const CACHE='fast-rotas-dia-r134'", "const CACHE='fast-rotas-dia-r144'"),
        ("atalho-rotas-dia-192.png','", "atalho-rotas-dia-192.png?v=r144','"),
        ("atalho-rotas-dia-512.png']", "atalho-rotas-dia-512.png?v=r144']"),
    ], f'sw rotas {path}')

for path in ['app-despesas/sw.js', 'linux/src/renderer/app-despesas/sw.js']:
    replace_exact(path, [
        ('/* FAST Servicos - app Despesas - Service Worker persistente (r134)',
         '/* FAST Servicos - app Despesas - Service Worker persistente (r134; r144 = novos icones)'),
        ("const CACHE='fast-despesas-r134'", "const CACHE='fast-despesas-r144'"),
        ("atalho-despesas-192.png','", "atalho-despesas-192.png?v=r144','"),
        ("atalho-despesas-512.png']", "atalho-despesas-512.png?v=r144']"),
    ], f'sw despesas {path}')

# --------------------------------------------------------- 8) sanidade final

# 8a) varre o repo inteiro: nenhuma ref a esses PNGs com versão velha ou sem ?v=
STALE = [
    'atalho-rotas-dia-192.png?v=r72', 'atalho-rotas-dia-512.png?v=r72',
    'atalho-despesas-192.png?v=r72', 'atalho-despesas-512.png?v=r72',
    'atalho-rotas-dia-192.png?v=r89', 'atalho-rotas-dia-512.png?v=r89',
    'atalho-despesas-192.png?v=r89', 'atalho-despesas-512.png?v=r89',
    'atalho-rotas-dia-192.png?v=r114', 'atalho-rotas-dia-512.png?v=r114',
    'atalho-despesas-192.png?v=r114', 'atalho-despesas-512.png?v=r114',
    'atalho-rotas-dia-192.png?v=r128', 'atalho-rotas-dia-512.png?v=r128',
    'atalho-despesas-192.png?v=r128', 'atalho-despesas-512.png?v=r128',
    'atalho-rotas-dia-192.png?v=2.1.0', 'atalho-despesas-192.png?v=2.1.0',
]
BARE = re.compile(r'atalho-(rotas-dia|despesas)-(192|512)\.png(?!\?v=)["\']')
VERSIONED = re.compile(r'atalho-(rotas-dia|despesas)-(192|512)\.png\?v=([A-Za-z0-9.]+)')

scanned = 0
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ('.git', '.tmp_icons', 'backups', 'assets')]
    for fn in files:
        if not fn.endswith(('.html', '.js', '.webmanifest', '.json', '.md', '.py')):
            continue
        p = os.path.join(root, fn)
        if p.endswith('patch_r144.py'):
            continue
        c = load(p)
        scanned += 1
        for s in STALE:
            must(c.count(s) == 0, f'sem ref velha: {p} :: {s!r}')
        m = BARE.search(c)
        must(m is None, f'sem ref sem cache-bust: {p} :: {m.group(0) if m else ""!r}')
        for m in VERSIONED.finditer(c):
            must(m.group(3) == 'r144',
                 f'versão ok: {p} :: {m.group(0)}')
print(f'ok varredura completa: {scanned} arquivos de texto sem refs velhas/sem bust')

# 8b) caches e registros novos
for path, cache in [('app-rotas-dia/sw.js', 'fast-rotas-dia-r144'),
                    ('app-despesas/sw.js', 'fast-despesas-r144'),
                    ('linux/src/renderer/app-rotas-dia/sw.js', 'fast-rotas-dia-r144'),
                    ('linux/src/renderer/app-despesas/sw.js', 'fast-despesas-r144')]:
    c = load(path)
    must(c.count(f"const CACHE='{cache}'") == 1, f'{path}: CACHE {cache}')
    must("fast-rotas-dia-r134'" not in c and "fast-despesas-r134'" not in c,
         f'{path}: sem CACHE r134 velho')
for path in ['app-rotas-dia/index.html', 'app-despesas/index.html',
             'linux/src/renderer/app-rotas-dia/index.html',
             'linux/src/renderer/app-despesas/index.html']:
    c = load(path)
    must(c.count('sw.js?v=r144') == 1, f'{path}: registro sw ?v=r144')
    must(c.count('sw.js?v=r134') == 0, f'{path}: sem registro r134')

# 8c) PNGs instalados: RGBA, tamanho certo, cantos transparentes
for p in ['assets/atalho-rotas-dia-192.png', 'assets/atalho-rotas-dia-512.png',
          'assets/atalho-despesas-192.png', 'assets/atalho-despesas-512.png']:
    im = Image.open(p)
    must(im.mode == 'RGBA' and im.size in [(192, 192), (512, 512)],
         f'{p}: {im.mode} {im.size}')
    w_, h_ = im.size
    corners = [im.getpixel((x, y))[3] for x, y in
               [(0, 0), (w_ - 1, 0), (0, h_ - 1), (w_ - 1, h_ - 1)]]
    must(all(a == 0 for a in corners), f'{p}: cantos transparentes {corners}')

# 8d) backups dos ícones antigos presentes
for p in ['backups/atalho-rotas-dia-192-old-r143.png', 'backups/atalho-rotas-dia-512-old-r143.png',
          'backups/atalho-despesas-192-old-r143.png', 'backups/atalho-despesas-512-old-r143.png']:
    must(os.path.exists(p), f'backup presente: {p}')

shutil.rmtree('.tmp_icons')
print('\nPATCH R144 CONCLUÍDO — ícones novos instalados e cache-busts no r144')
