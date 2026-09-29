# -*- coding: utf-8 -*-
"""FAST Serviços — aplica as artes oficiais em TODOS os ícones.

Fonte: icones-fonte/<app>.png  (fast, rotas, despesas, cliente, motorista).
FAST Limpo usa a arte do FAST (amarelo).

- Android (APK): android/app/src/<sabor>/res
    drawable-*/ic_launcher_foreground.png -> arte INTEIRA dentro da área que o
    Android sempre mostra (66 de 108), fundo na cor da borda da arte. Nada estoura.
    mipmap-*/*.png (ícones antigos, Android < 8) -> arte inteira no tamanho do arquivo.
- Web (gate, Central de Downloads, instalação): imagens quadradas em assets/, app-*/,
  despesas/, rotas-do-dia/, downloads/ e linux/src/renderer/assets cujo nome indica o app
  são substituídas mantendo tamanho e formato.
- *.webmanifest: ícones deixam de ser "maskable" (era o que cortava no diálogo de instalação).
"""
import json, os, re, sys
from PIL import Image

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FONTE = os.path.join(RAIZ, 'icones-fonte')
FUNDO = {'fast': (255, 228, 1), 'limpo': (255, 228, 1), 'rotas': (10, 40, 110),
         'despesas': (120, 10, 12), 'cliente': (8, 70, 20), 'motorista': (120, 45, 5)}
SABOR = {'main': 'fast', 'fast': 'fast', 'limpo': 'limpo', 'rotas': 'rotas',
         'despesas': 'despesas', 'cliente': 'cliente', 'motorista': 'motorista'}
IGNORAR = {'.git', 'node_modules', 'backups', 'build', 'icones-fonte'}

def arte(app):
    nome = 'fast' if app == 'limpo' else app
    return Image.open(os.path.join(FONTE, nome + '.png')).convert('RGBA')

def primeiro_plano(app, px):
    """Canvas 108dp com a arte inteira em 66dp (dentro da zona segura de 72dp)."""
    c = Image.new('RGBA', (px, px), FUNDO[app] + (255,))
    inner = int(round(px * 66 / 108))
    a = arte(app).resize((inner, inner), Image.LANCZOS)
    off = (px - inner) // 2
    c.paste(a, (off, off), a)
    return c

def inteira(app, w, h):
    """Arte inteira, sem cortar, no tamanho pedido (sobra preenchida com a cor da borda)."""
    a = arte(app)
    lado = min(w, h)
    a = a.resize((lado, lado), Image.LANCZOS)
    c = Image.new('RGBA', (w, h), FUNDO[app] + (255,))
    c.paste(a, ((w - lado) // 2, (h - lado) // 2), a)
    return c

def salvar(img, caminho, modelo):
    ext = os.path.splitext(caminho)[1].lower()
    if ext in ('.jpg', '.jpeg'):
        img.convert('RGB').save(caminho, quality=90)
    elif ext == '.webp':
        img.save(caminho, quality=90)
    else:
        (img if modelo.mode == 'RGBA' else img.convert('RGB')).save(caminho, optimize=True)

def app_pelo_nome(nome):
    n = nome.lower()
    if 'despesa' in n: return 'despesas'
    if 'motorista' in n: return 'motorista'
    if 'client' in n: return 'cliente'
    if 'limpo' in n: return 'limpo'
    if 'rota' in n: return 'rotas'
    if re.search(r'fast[-_]?servicos|official[-_]?yellow|fast[-_]?icon|icon[-_]?fast|app[-_]?fast', n): return 'fast'
    return None

trocados = []

# 1) Android
res_base = os.path.join(RAIZ, 'android', 'app', 'src')
if os.path.isdir(res_base):
    for sabor in os.listdir(res_base):
        app = SABOR.get(sabor)
        res = os.path.join(res_base, sabor, 'res')
        if not app or not os.path.isdir(res):
            continue
        for pasta in os.listdir(res):
            dirp = os.path.join(res, pasta)
            if not os.path.isdir(dirp):
                continue
            for arq in os.listdir(dirp):
                cam = os.path.join(dirp, arq)
                if not arq.lower().endswith('.png'):
                    continue
                with Image.open(cam) as im:
                    w, h, modelo = im.size[0], im.size[1], im.copy()
                if pasta.startswith('drawable') and arq.startswith('ic_launcher_foreground'):
                    salvar(primeiro_plano(app, w), cam, modelo); trocados.append(cam)
                elif pasta.startswith('mipmap'):
                    salvar(inteira(app, w, h), cam, modelo); trocados.append(cam)

# 2) Web e desktop
PASTAS_WEB = ['assets', 'downloads', 'despesas', 'rotas-do-dia', os.path.join('linux', 'src', 'renderer', 'assets')]
PASTAS_WEB += [d for d in os.listdir(RAIZ) if d.startswith('app-') and os.path.isdir(os.path.join(RAIZ, d))]
for base in PASTAS_WEB:
    top = os.path.join(RAIZ, base)
    if not os.path.isdir(top):
        continue
    for dirp, dirs, files in os.walk(top):
        dirs[:] = [d for d in dirs if d not in IGNORAR]
        for arq in files:
            if not re.search(r'\.(png|jpe?g|webp)$', arq, re.I):
                continue
            cam = os.path.join(dirp, arq)
            app = app_pelo_nome(arq)
            if not app:
                # pasta do app (ex.: app-cliente/): só troca o que for ícone/logo/gate
                if re.search(r'icon|logo|gate|splash|brand|launch', arq, re.I):
                    app = app_pelo_nome(os.path.relpath(dirp, RAIZ))
            if not app:
                continue
            try:
                with Image.open(cam) as im:
                    w, h, modelo = im.size[0], im.size[1], im.copy()
            except Exception:
                continue
            if w < 32 or h < 32 or not (0.8 <= w / h <= 1.25):
                continue  # só ícones/miniaturas quadradas; fotos e fundos ficam como estão
            salvar(inteira(app, w, h), cam, modelo); trocados.append(cam)

# 3) Manifestos: ícones sem "maskable" (o Android cortava a arte no diálogo de instalação)
for dirp, dirs, files in os.walk(RAIZ):
    dirs[:] = [d for d in dirs if d not in IGNORAR]
    for arq in files:
        if not arq.endswith('.webmanifest'):
            continue
        cam = os.path.join(dirp, arq)
        try:
            dados = json.load(open(cam, encoding='utf-8'))
        except Exception:
            continue
        mudou = False
        for ic in dados.get('icons', []):
            if 'maskable' in str(ic.get('purpose', '')):
                ic['purpose'] = 'any'; mudou = True
        if mudou:
            json.dump(dados, open(cam, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
            trocados.append(cam)

print('Arquivos atualizados: %d' % len(trocados))
for t in trocados:
    print(' -', os.path.relpath(t, RAIZ))
if not trocados:
    sys.exit('Nenhum ícone encontrado — confira a pasta icones-fonte.')
