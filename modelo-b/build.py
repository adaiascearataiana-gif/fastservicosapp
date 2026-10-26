#!/usr/bin/env python3
"""Gera a pasta MODELO B do FAST a partir do app real — sem alterar o app real.

O que este script faz:

  1. Lê `index.html` (raiz) — o app que já está no ar — e grava uma CÓPIA em
     `modelo-b/index.html`. Na cópia ele injeta apenas duas coisas:
        <base href="../">            → todos os caminhos (scripts, assets, fontes,
                                      service worker, manifest, apps) continuam
                                      apontando para os arquivos reais na raiz;
        skin-modelo-b.css + skin.js   → a aparência nova.
     Nenhum script, função, texto ou URL do app é reescrito. O conteúdo original
     permanece byte a byte igual (o script confere isso no final).

  2. Faz o mesmo com os apps que já existem (app-cliente, app-motorista,
     app-rotas-dia, app-despesas, app-limpo): copia cada index.html para
     `modelo-b/<app>/index.html` com `<base href="../../<app>/">` + a skin
     leve de apps. Os apps originais e seus service workers não são tocados.

Resultado: `modelo-b/` é o app inteiro — mesmas funções, mesma sincronização,
mesmos apps — com o visual Modelo B.

Uso:
    python3 modelo-b/build.py            # gera/atualiza as cópias
    python3 modelo-b/build.py --check    # só confere se estão em dia

Importante: as cópias são geradas. Não edite `modelo-b/index.html` à mão —
edite o app real e rode o build de novo (ou ajuste a skin, em skin-modelo-b.css).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "modelo-b"

APPS = ("app-cliente", "app-motorista", "app-rotas-dia", "app-despesas", "app-limpo")

MARCA_BASE = '<!-- modelo-b: base href para os arquivos reais -->'
MARCA_SKIN = "<!-- modelo-b: skin (só aparência) -->"


def sha(texto: str) -> str:
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()[:12]


def script_urls(html: str) -> list[str]:
    return re.findall(r'<script[^>]+src="([^"]+)"', html)


def sw_urls(html: str) -> list[str]:
    return re.findall(r"serviceWorker\.register\(\s*['\"]([^'\"]+)", html)


def injetar(origem: str, base_href: str, skin_href: str, skin_js: str | None,
            outros_scripts: tuple[str, ...] = ()) -> str:
    """Devolve o HTML com <base> e a skin injetados, sem mexer no resto."""
    if re.search(r"<base\s", origem, re.I):
        raise SystemExit("O arquivo de origem já tem <base>; ajuste o script.")

    cabeca = re.search(r"<head[^>]*>", origem, re.I)
    if not cabeca:
        raise SystemExit("Não encontrei <head> no arquivo de origem.")

    bloco_base = f"\n{MARCA_BASE}\n<base href=\"{base_href}\">\n"

    extra = f'\n{MARCA_SKIN}\n<link rel="stylesheet" href="{skin_href}">\n'
    for script in outros_scripts:
        extra += f'<script src="{script}" defer></script>\n'
    if skin_js:
        extra += f'<script src="{skin_js}" defer></script>\n'

    fechamento = re.search(r"</head\s*>", origem, re.I)
    if not fechamento:
        raise SystemExit("Não encontrei </head> no arquivo de origem.")

    # base entra logo depois de <head>; skin entra no fim do head (vence o CSS do app)
    saida = (
        origem[: cabeca.end()]
        + bloco_base
        + origem[cabeca.end(): fechamento.start()]
        + extra
        + origem[fechamento.start():]
    )
    return saida


def remover_injecao(html: str) -> str:
    """Reconstrói o original (para conferir que nada além do previsto mudou)."""
    html = re.sub(r"\n" + re.escape(MARCA_BASE) + r"\n<base href=\"[^\"]+\">\n", "", html)
    html = re.sub(
        r"\n" + re.escape(MARCA_SKIN) + r"\n<link rel=\"stylesheet\" href=\"[^\"]+\">\n(?:<script src=\"[^\"]+\"(?:\s+defer)?></script>\n)*",
        "",
        html,
    )
    return html


CONFERIR = False
PENDENTES: list[str] = []


def gerar_app(nome: str, destino_rel: str, base_href: str, skin_href: str, skin_js: str | None,
             outros_scripts: tuple[str, ...] = ()) -> dict:
    origem_path = RAIZ / nome / "index.html" if destino_rel != "index.html" else RAIZ / "index.html"
    if not origem_path.exists():
        raise SystemExit(f"Não encontrei {origem_path}")

    origem = origem_path.read_text(encoding="utf-8", errors="strict")
    html = injetar(origem, base_href, skin_href, skin_js, outros_scripts)

    # conferência: tirando a injeção, o arquivo tem de ser idêntico ao original
    if remover_injecao(html) != origem:
        raise SystemExit(f"Injeção alterou mais do que devia em {origem_path}")

    # conferência: nenhum script do app trocado de endereço
    # (o único script extra permitido é o skin.js)
    extras = [u for u in script_urls(html) if u not in script_urls(origem)]
    permitidos = [u for u in (*outros_scripts, skin_js) if u]
    if sorted(extras) != sorted(permitidos):
        raise SystemExit(f"Script inesperado em {origem_path}: {extras} (esperado: {permitidos})")
    # conferência: a skin precisa existir no disco (caminho resolvido pela base)
    alvo_skin = (RAIZ / skin_href).resolve() if not skin_href.startswith("../") else None
    if alvo_skin is not None and not alvo_skin.exists():
        raise SystemExit(f"Skin não encontrada: {alvo_skin}")
    if sw_urls(html) != sw_urls(origem):
        raise SystemExit(f"Service worker mudou em {origem_path}")

    destino = SAIDA / destino_rel
    if CONFERIR:
        if not destino.exists() or destino.read_text(encoding="utf-8") != html:
            PENDENTES.append(str(destino.relative_to(RAIZ)))
    else:
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(html, encoding="utf-8")

    return {
        "origem": str(origem_path.relative_to(RAIZ)),
        "destino": str(destino.relative_to(RAIZ)),
        "origem_sha": sha(origem),
        "destino_bytes": len(html.encode("utf-8")),
        "scripts": script_urls(origem),
        "service_worker": sw_urls(origem),
    }


def copiar_fontes() -> int:
    origem = RAIZ / "prototipo-novo-b" / "fontes"
    destino = SAIDA / "fontes"
    destino.mkdir(parents=True, exist_ok=True)
    n = 0
    for arquivo in sorted(origem.glob("*.woff2")) + sorted(origem.glob("OFL-*.txt")):
        alvo = destino / arquivo.name
        if not alvo.exists() or alvo.read_bytes() != arquivo.read_bytes():
            if CONFERIR:
                PENDENTES.append(str(alvo.relative_to(RAIZ)))
            else:
                shutil.copy2(arquivo, alvo)
            n += 1
    return n


def main() -> None:
    global CONFERIR
    ap = argparse.ArgumentParser(description="Gera a pasta modelo-b a partir do app real.")
    ap.add_argument("--check", action="store_true", help="só verifica se as cópias estão em dia")
    args = ap.parse_args()
    CONFERIR = args.check

    for obrigatorio in ("skin-modelo-b.css", "skin-apps.css", "skin.js", "skin-apps.js", "lucide.js"):
        if not (SAIDA / obrigatorio).exists():
            raise SystemExit(f"{obrigatorio} não encontrado — a pasta modelo-b está incompleta.")

    info = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "aviso": "Arquivos gerados por modelo-b/build.py. Não edite à mão.",
        "arquivos": [],
    }

    # As URLs abaixo são resolvidas a partir do <base href>, não do arquivo.
    info["arquivos"].append(
        gerar_app(
            "index.html",
            "index.html",
            "../",
            "modelo-b/skin-modelo-b.css",
            "modelo-b/skin.js",
            ("modelo-b/lucide.js",),
        )
    )
    for app in APPS:
        info["arquivos"].append(
            gerar_app(
                app,
                f"{app}/index.html",
                f"../../{app}/",
                "../modelo-b/skin-apps.css",
                None,
                ("../modelo-b/skin-apps.js",),
            )
        )

    total_fontes = copiar_fontes()

    if CONFERIR:
        if PENDENTES:
            print("DESATUALIZADO — estas cópias não batem com o app real:", file=sys.stderr)
            for item in PENDENTES:
                print("   ·", item, file=sys.stderr)
            raise SystemExit(1)
        print("OK · cópias em dia com o app real (nada foi gravado).", file=sys.stderr)
        return

    (SAIDA / "build-info.json").write_text(
        json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"OK · {len(info['arquivos'])} páginas geradas · {total_fontes} fonte(s) copiada(s)")
    for item in info["arquivos"]:
        print(f"   {item['origem']}  →  {item['destino']}  ({item['destino_bytes'] / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
