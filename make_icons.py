# -*- coding: utf-8 -*-
"""Gera icones adaptativos + legados do FAST Servicos.

Objetivo: o logo deve PREENCHER o icone (sem a moldura branca que o Android
coloca em icones legados). Usamos icone adaptativo (Android 8+):
  - background: cor amarela solida do logo (#FFEB00) -> cobre TODO o icone
  - foreground: logo centralizado, escalado para 84dp (de 108dp) para que o
    conteudo fique dentro da "safe zone" (72dp) e nao seja cortado pela mascara
    do launcher (circulo/squircle).
Para Android < 8 (legado) geramos PNGs quadrados preenchidos pelo logo.
"""
import os
from PIL import Image

SRC = "assets/fast-servicos-icon-512.png"
RES = "android/app/src/main/res"

logo = Image.open(SRC).convert("RGBA")
bg = logo.getpixel((3, 3))[:3]  # cor amarela de fundo do logo
print("bg color:", bg)

# Escala do foreground: 84dp de 108dp (mantem conteudo dentro da safe zone 72dp)
FG_DP = 84
CANVAS_DP = 108


def ensure(d):
    os.makedirs(d, exist_ok=True)


def make_foreground(px):
    """Canvas px x px (108dp) com o logo centralizado em 84dp, fundo amarelo."""
    canvas = Image.new("RGBA", (px, px), tuple(bg) + (255,))
    inner = int(round(px * FG_DP / CANVAS_DP))
    fit = logo.resize((inner, inner), Image.LANCZOS)
    off = (px - inner) // 2
    canvas.paste(fit, (off, off), fit)
    return canvas


# ---------- 1) Foreground do icone adaptativo ----------
# Densidades: mdpi=108, hdpi=162, xhdpi=216, xxhdpi=324, xxxhdpi=432
fg_sizes = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
for dens, px in fg_sizes.items():
    d = os.path.join(RES, "drawable-" + dens)
    ensure(d)
    make_foreground(px).save(os.path.join(d, "ic_launcher_foreground.png"))

# ---------- 2) Icones legados (pre-Android 8) ----------
# Preenchem todo o quadrado do icone (sem moldura).
legacy_sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for dens, px in legacy_sizes.items():
    d = os.path.join(RES, "mipmap-" + dens)
    ensure(d)
    img = logo.resize((px, px), Image.LANCZOS)
    img.save(os.path.join(d, "ic_launcher.png"))
    img.save(os.path.join(d, "ic_launcher_round.png"))

# ---------- 3) Adaptive icon XML (Android 8+) ----------
anydpi = os.path.join(RES, "mipmap-anydpi-v26")
ensure(anydpi)
adaptive = (
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
    '    <background android:drawable="@color/ic_launcher_background"/>\n'
    '    <foreground android:drawable="@drawable/ic_launcher_foreground"/>\n'
    '</adaptive-icon>\n'
)
with open(os.path.join(anydpi, "ic_launcher.xml"), "w") as f:
    f.write(adaptive)
with open(os.path.join(anydpi, "ic_launcher_round.xml"), "w") as f:
    f.write(adaptive)

# ---------- 4) Cor de fundo ----------
values = os.path.join(RES, "values")
ensure(values)
hexcol = "#%02X%02X%02X" % (bg[0], bg[1], bg[2])
with open(os.path.join(values, "colors.xml"), "w") as f:
    f.write(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<resources>\n'
        '    <color name="ic_launcher_background">%s</color>\n'
        '</resources>\n' % hexcol
    )

print("OK icones gerados. bg=%s fg=%ddp" % (hexcol, FG_DP))
