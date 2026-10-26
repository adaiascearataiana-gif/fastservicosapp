#!/usr/bin/env python3
"""Gera FAST-OS-modelo-b.html — versão de arquivo único do protótipo Modelo B.

O arquivo de saída tem CSS, JavaScript e as fontes (Inter + Manrope) embutidos,
sem nenhuma dependência externa: dá para abrir com dois cliques, enviar por
e-mail ou publicar direto no GitHub Pages.

Uso:
    python3 prototipo-novo-b/build.py

Fontes: index.html + styles.css + app.js + fontes/*.woff2
Saída:  prototipo-novo-b/FAST-OS-modelo-b.html
"""

from __future__ import annotations

import base64
import re
from pathlib import Path

PASTA = Path(__file__).resolve().parent
SAIDA = PASTA / "FAST-OS-modelo-b.html"

FONTES = (
    "inter-400.woff2",
    "inter-500.woff2",
    "inter-600.woff2",
    "inter-700.woff2",
    "manrope-500.woff2",
    "manrope-600.woff2",
    "manrope-700.woff2",
    "manrope-800.woff2",
)

BANNER = """<!--
  ============================================================================
  FAST OS — Modelo B · "Light Executive"
  Arquivo único gerado por prototipo-novo-b/build.py — NÃO EDITE À MÃO.
  Fontes: index.html + styles.css + app.js + fontes/*.woff2
  Protótipo visual com dados fictícios: sem backend, sem chamadas externas.
  Nada do aplicativo real foi alterado. Modelo A permanece em prototipo-novo/.
  ============================================================================
-->
"""


def base64_fonte(nome: str) -> str:
    dados = (PASTA / "fontes" / nome).read_bytes()
    return base64.b64encode(dados).decode("ascii")


def css_embutido() -> str:
    css = (PASTA / "styles.css").read_text(encoding="utf-8")

    def troca(match: re.Match[str]) -> str:
        nome = match.group(1)
        if nome not in FONTES:
            raise SystemExit(f"Fonte inesperada em styles.css: {nome}")
        return f'url("data:font/woff2;base64,{base64_fonte(nome)}") format("woff2")'

    css, total = re.subn(r'url\("fontes/([\w.-]+\.woff2)"\)', troca, css)
    if total != len(FONTES):
        raise SystemExit(f"Esperava {len(FONTES)} fontes no CSS, encontrei {total}")
    return css


def js_embutido() -> str:
    js = (PASTA / "app.js").read_text(encoding="utf-8")
    # Evita fechar o <script> prematuramente caso apareça a sequência no código.
    return js.replace("</script", "<\\/script")


def main() -> None:
    html = (PASTA / "index.html").read_text(encoding="utf-8")

    marcador_css = '<link rel="stylesheet" href="styles.css">'
    if marcador_css not in html:
        raise SystemExit("index.html não referencia styles.css como esperado")
    html = html.replace(marcador_css, "<style>\n" + css_embutido() + "</style>")

    marcador_js = '<script src="app.js"></script>'
    if marcador_js not in html:
        raise SystemExit("index.html não referencia app.js como esperado")
    html = html.replace(marcador_js, "<script>\n" + js_embutido() + "\n</script>")

    html = html.replace("<!doctype html>\n", "<!doctype html>\n" + BANNER, 1)

    restos = ['href="styles.css"', 'src="app.js"', 'url("fontes/', "href=\"fontes/"]
    for resto in restos:
        if resto in html:
            raise SystemExit(f"Sobrou referência local no arquivo final: {resto}")

    SAIDA.write_text(html, encoding="utf-8")
    tamanho = SAIDA.stat().st_size / 1024
    print(f"OK · {SAIDA.relative_to(PASTA.parent)} · {tamanho:.0f} KB · arquivo único sem dependências")


if __name__ == "__main__":
    main()
