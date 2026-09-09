# -*- coding: utf-8 -*-
# r141 / 2.3.25 — Rotas do Dia: card nao estoura mais no celular.
# Pedido do usuario: "Na mesma linha esta checkbox, 1 ACARACUZINHO, 1x VALOR.
# Quebre esta linha, remova '1x' e coloque Valor em uma linha abaixo."
#   1) remove o selo "Nx" de quantidade da linha do cabecalho (.seq-number-wrap)
#      no template JS e nos 11 cards pre-renderizados;
#   2) o VALOR (R$) passa a morar em linha propria (.seq-valor-linha) no topo do
#      corpo do card, com a quantidade de volumes como tooltip do valor;
#   3) CSS r141 para a nova linha;
#   4) changelog: 4a entrada 2.3.25 (meta HTML-encoded + item visivel no
#      fastUpdatesBody) + fast-latest-update (meta + copia runtime r91);
#   5) carimbo de lancamento 21:50 -> 22:30 (2.3.25 ainda nao publicada).
import re, json, html, sys

PATH = 'index.html'
src = open(PATH, encoding='utf-8').read()
erros = []

def rep(old, new, n=1, label=''):
    global src
    c = src.count(old)
    if c != n:
        erros.append('%s: esperado %d, achado %d' % (label, n, c))
        return
    src = src.replace(old, new)

def build_valor_linha(qtd, valor):
    return ('<div class="seq-valor-linha" title="Quantidade de volumes: %sx">'
            '<i class="fa-solid fa-sack-dollar"></i> <span class="seq-valor-linha-label">Valor</span> '
            '<strong class="seq-valor-badge seq-valor-destino">%s</strong></div>' % (qtd, valor))

VALOR_TPL = ('<div class="seq-valor-linha" title="Quantidade de volumes: ${item.qtdMercadorias != null ? item.qtdMercadorias : 1}x">'
             '<i class="fa-solid fa-sack-dollar"></i> <span class="seq-valor-linha-label">Valor</span> '
             '<strong class="seq-valor-badge seq-valor-destino">${fmtMoedaBR(item.valor != null ? item.valor : 0)}</strong></div>')

# ---------- 1) TEMPLATE JS: remover selo antigo do cabecalho ----------
OLD_TPL = ('<span class="seq-meta-inline"><span class="seq-qtd-badge" title="Quantidade de volumes">\u00b0 ${item.qtdMercadorias != null ? item.qtdMercadorias : 1}x</span>'
           '<span class="seq-valor-badge seq-valor-destino">${fmtMoedaBR(item.valor != null ? item.valor : 0)}</span></span>')
rep(OLD_TPL, '', 1, 'template: selo antigo')

# ---------- 2) TEMPLATE JS: linha de valor no topo do .seq-body ----------
TPL_BODY = '<div class="seq-body">\n              ${(item.confirmadoQR'
rep(TPL_BODY, '<div class="seq-body">\n              ' + VALOR_TPL + '\n              ${(item.confirmadoQR', 1, 'template: linha de valor')

# ---------- 3) STATIC CARDS: regex unica (selo + abertura do seq-body) ----------
STATIC_RE = re.compile(
    r'<span class="seq-meta-inline"><span class="seq-qtd-badge" title="Quantidade de volumes">\u00b0 (\d+)x</span>'
    r'<span class="seq-valor-badge seq-valor-destino">(R\$ [\d.,]+)</span></span>'
    r'(\s*</div>\s*<div class="seq-body">)'
)
matches = list(STATIC_RE.finditer(src))
if len(matches) != 11:
    erros.append('statics: esperado 11, achado %d' % len(matches))
else:
    src = STATIC_RE.sub(lambda m: m.group(3) + '\n              ' + build_valor_linha(m.group(1), m.group(2)), src)

# ---------- 4) CSS r141 ----------
CSS_ANCHOR = 'body .seq-destino-ordinal{flex:1 1 auto !important;min-width:0 !important;max-width:100% !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important}'
CSS_NEW = CSS_ANCHOR + '''
/* r141/2.3.25 \u2014 Rotas do Dia: valor em linha propria, card nao estoura.
   O selo "\u00b0 Nx" de quantidade saiu da linha do cabecalho (era ele que empurrava
   os botoes para fora do card no celular); a quantidade de volumes virou tooltip
   da linha de valor, logo abaixo do cabecalho. */
body .seq-valor-linha{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:#374151;margin-top:2px;margin-bottom:2px;flex-wrap:wrap}
body .seq-valor-linha .seq-valor-linha-label{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--accent,#6366f1)}
body .seq-valor-linha .seq-valor-badge{font-size:13px;background:#e8f7ee;border:1px solid #b7e2c6;border-radius:8px;padding:1px 8px;color:#0a7a3d}
body .seq-valor-linha i.fa-sack-dollar{color:#0a7a3d;font-size:13px}'''
rep(CSS_ANCHOR, CSS_NEW, 1, 'CSS r141')

# ---------- 5) changelog meta: 4a entrada 2.3.25 (HTML-encoded) ----------
CH_OLD = '(apaga a posicao salva).&quot;},{&quot;type&quot;:&quot;corrigido&quot;,&quot;text&quot;:&quot;2.3.24 (08/09/2026): BUG DEFINITIVO'
CH_NEW = ('(apaga a posicao salva).&quot;},'
          '{&quot;type&quot;:&quot;melhorado&quot;,&quot;text&quot;:&quot;2.3.25 (08/09/2026): fim do card das Rotas do Dia estourando no celular \u2014 '
          'o selo \u00b0 1x de quantidade saiu da linha do cabecalho (era ele que empurrava os botoes para fora do card) e o VALOR (R$) '
          'passou a morar em uma linha propria, logo abaixo do cabecalho, com a quantidade de volumes aparecendo no tooltip do valor; '
          'a linha do cabecalho ficou leve: so checkbox, numero da rota, destino e selo EM ROTA/CONCLUIDA.&quot;},'
          '{&quot;type&quot;:&quot;corrigido&quot;,&quot;text&quot;:&quot;2.3.24 (08/09/2026): BUG DEFINITIVO')
rep(CH_OLD, CH_NEW, 1, 'changelog meta 4a entrada')

# ---------- 6) fastUpdatesBody: 4o item visivel ----------
FUP_OLD = '(apaga a posicao salva).</div></div></div></div>'
FUP_ITEM4 = ('<div class="fup-item"><div class="fup-item-dot" style="background:rgba(37,99,235,0.10);">'
             '<i class="fa-solid fa-arrow-up" style="color:#2563eb;"></i></div>'
             '<div class="fup-item-content"><span class="fup-item-badge" style="color:#2563eb;background:rgba(37,99,235,0.10);">Melhorado</span>'
             '<div class="fup-item-text">2.3.25 (08/09/2026): fim do card das Rotas do Dia estourando no celular \u2014 o selo \u00b0 1x de quantidade saiu '
             'da linha do cabecalho (era ele que empurrava os botoes para fora do card) e o VALOR (R$) passou a morar em uma linha propria, logo '
             'abaixo do cabecalho, com a quantidade de volumes aparecendo no tooltip do valor; a linha do cabecalho ficou leve: so checkbox, '
             'numero da rota, destino e selo EM ROTA/CONCLUIDA.</div></div></div>')
FUP_NEW = '(apaga a posicao salva).</div></div></div>' + FUP_ITEM4 + '</div>'
rep(FUP_OLD, FUP_NEW, 1, 'fastUpdatesBody 4o item')

# ---------- 7) fast-latest-update (meta + copia r91) ----------
LU_OLD = ('2.3.25: O botao rapido da Central Rapida (raio) agora flutua LIVRE: arraste com o dedo para qualquer canto da tela e a posicao fica gravada '
          'no aparelho; ele nunca mais fica escondido atras da barra inferior (camada propria acima da barra e das setas de rolagem); o toque normal '
          'continua abrindo a Central Rapida e segurar sem mover por meio segundo devolve o botao ao canto padrao.')
LU_NEW = ('2.3.25: Central Rapida com botao raio ARRASTAVEL (segure e arraste para qualquer ponto da tela; a posicao fica gravada no aparelho; '
          'segurar sem mover por meio segundo devolve ao canto padrao) + Rotas do Dia sem card estourando no celular: o selo de quantidade saiu '
          'da linha do cabecalho e o VALOR (R$) ganhou linha propria abaixo, com a quantidade de volumes no tooltip.')
rep(LU_OLD, LU_NEW, 2, 'fast-latest-update meta + r91')

# ---------- 8) carimbo 21:50 -> 22:30 (+ fallbacks estaticos 18:20 e 12:00) ----------
rep('2026-09-08T21:50:00-03:00', '2026-09-08T22:30:00-03:00', 3, 'fast-app-date (meta + comentario + r91)')
rep('Lan\u00e7ada em 08/09/2026 21:50', 'Lan\u00e7ada em 08/09/2026 22:30', 1, 'fastUpdatesBody Lancada em 21:50')
rep('Lan\u00e7ada em 08/09/2026 18:20', 'Lan\u00e7ada em 08/09/2026 22:30', 1, 'fastVersaoDateLabel fallback 18:20')
rep('Lan\u00e7ada em 08/09/2026 12:00', 'Lan\u00e7ada em 08/09/2026 22:30', 1, 'fastWhatsNewDate fallback 12:00')

# ---------- verificacao ----------
if erros:
    print('ERROS:')
    for e in erros: print(' -', e)
    sys.exit(1)

m = re.search(r'<meta name="fast-app-changelog" content="([^"]*)"', src)
data = json.loads(html.unescape(m.group(1)))
n233 = sum(1 for d in data if d['text'].startswith('2.3.25'))
print('changelog items:', len(data), '| 2.3.25:', n233)
assert n233 == 4, 'esperado 4 entradas 2.3.25'
assert data[3]['text'].startswith('2.3.25 (08/09/2026): fim do card'), '4a entrada fora de ordem'

n_linha = src.count('class="seq-valor-linha"')
print('seq-valor-linha (markup):', n_linha)
assert n_linha == 12, 'esperado 12 (11 statics + template)'
assert 'title="Quantidade de volumes">\u00b0' not in src, 'selo antigo ainda presente'
assert '\u00b0 ${item.qtdMercadorias' not in src, 'selo antigo no template'
assert src.count('seq-meta-inline"><span class="seq-qtd-badge') == 0, 'seq-qtd-badge residual'
assert src.count('fup-item-text') >= 4

open(PATH, 'w', encoding='utf-8').write(src)
print('OK \u2014 r141 aplicado. tamanho:', len(src.encode('utf-8')))
