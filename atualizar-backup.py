#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Atualiza o backup completo da plataforma (pasta backups/ do site).

Uso:  python3 atualizar-backup.py

O que faz:
  1. Le a versao atual em index.html (meta fast-app-version)
  2. Copia index.html inteiro para backups/fast-servicos-<VERSAO>-<AAAA-MM-DD>.html
  3. Atualiza o cartao da pagina backups/index.html (link + titulo + descricao)
  4. Mantem no maximo os 3 backups mais recentes (apaga mais antigos)
  5. Confere que a copia ficou identica ao index.html (diff de bytes)
"""
import re, os, sys, glob, datetime, hashlib

RAIZ = os.path.dirname(os.path.abspath(__file__))
def p(*a): return os.path.join(RAIZ, *a)

def main():
    src = open(p('index.html'), encoding='utf-8').read()
    m = re.search(r'name="fast-app-version" content="([^"]+)"', src)
    if not m:
        print('ERRO: meta fast-app-version nao encontrado em index.html'); return 1
    versao = m.group(1).strip()
    hoje = datetime.date.today().isoformat()
    destino = p('backups', 'fast-servicos-%s-%s.html' % (versao, hoje))

    os.makedirs(p('backups'), exist_ok=True)
    with open(destino, 'w', encoding='utf-8') as f:
        f.write(src)

    # conferencia de integridade (hash)
    h1 = hashlib.sha256(open(p('index.html'),'rb').read()).hexdigest()
    h2 = hashlib.sha256(open(destino,'rb').read()).hexdigest()
    if h1 != h2:
        print('ERRO: copia divergiu do original!'); return 1

    # atualiza o cartao da pagina de backups
    pag = p('backups', 'index.html')
    if os.path.exists(pag):
        t = open(pag, encoding='utf-8').read()
        t2 = re.sub(r'href="fast-servicos-[\d.\-]+\.html"', 'href="fast-servicos-%s-%s.html"' % (versao, hoje), t)
        t2 = re.sub(r'FAST Servi&ccedil;os [\d.]+ &mdash; [\d/]+', 'FAST Servi&ccedil;os %s &mdash; %s' % (versao, datetime.date.today().strftime('%d/%m/%Y')), t2)
        if t2 != t:
            open(pag, 'w', encoding='utf-8').write(t2)

    # Mantem os 3 mais recentes
    arqs = sorted(glob.glob(p('backups', 'fast-servicos-*.html')), key=os.path.getmtime)
    for velho in arqs[:-3]:
        os.remove(velho); print('removido antigo:', os.path.basename(velho))

    kb = os.path.getsize(destino) / 1024.0
    print('OK: backups/fast-servicos-%s-%s.html (%.0f KB) — identico ao index.html (%s)' % (versao, hoje, kb, versao))
    print('URL publica: https://adaiascearataiana-gif.github.io/fastservicosapp/backups/')
    return 0

if __name__ == '__main__':
    sys.exit(main())
