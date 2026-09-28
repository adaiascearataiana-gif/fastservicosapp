#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_r143.py — v2.3.27
Modal ADICIONAR ROTAS (Adicionar Item às Rotas do Dia):
  1) Campos Destino / Qtd / Valor abrem VAZIOS (sem value=1, sem "R$ 0,00",
     sem herdar destino/qtd/valor da última rota do cliente no autocomplete).
  2) Botões − e + ao lado do campo VALOR com passo de R$ 5 (padrão r100
     fast-step-btn/fastValorStep), também nas linhas de destino extra,
     com layout recalibrado para não estourar a largura do card no celular.

Base: index.html v2.3.26 (repo main, arquivo >1MB; push via git).
Convenções: r142 (replace_once + must count==1; changelog com &quot;;
painel fastUpdatesBody substituição integral com âncora de 4 divs;
máscara do changelog meta no replace global de versão).
"""
import re, sys

SRC = 'repo_index.html'
NEW_VERSION = '2.3.27'
OLD_VERSION = '2.3.26'
NEW_DATE_ISO = '2026-09-09T17:15:00-03:00'
OLD_DATE_ISO = '2026-09-09T10:30:00-03:00'
NEW_DATE_BR = '09/09/2026'
NEW_DATE_PANEL = '09/09/2026 17:15'

content = open(SRC, encoding='utf-8').read()
orig_len = len(content)

def must(name, count, expect=1):
    if count != expect:
        print(f'FALHA âncora [{name}]: {count} ocorrências (esperado {expect})')
        sys.exit(1)
    print(f'ok âncora [{name}]')

def replace_once(name, old, new):
    global content
    must(name, content.count(old), 1)
    content = content.replace(old, new, 1)

# ============================================================
# 1) HTML DO MODAL — linha destino/qtd/valor
#    qtd sem value="1" (placeholder "Qtd"); valor embrulhado em
#    .seq-valor-wrap com botões ±R$5 (padrão r100) e blur que
#    MANTÉM o campo vazio (fastMoedaBlurVazio).
# ============================================================
OLD_ROW = '''            <div class="seq-destino-row">
              <input type="text" id="seqDestino" class="seq-destino-input" placeholder="Destino" oninput="capitalizar(this); atualizarPreviewAba2();">
              <input type="number" id="seqQtdDestino" class="seq-qtd-input" step="1" min="0" inputmode="numeric" value="1" title="Quantidade" oninput="atualizarPreviewAba2();" onfocus="limparZero(this);">
              <input type="text" id="seqValorDestino" class="seq-valor-input" inputmode="numeric" placeholder="R$ 0,00" title="Valor (R$)" onfocus="fastMoedaFocus(this)" oninput="fastMascaraMoeda(this); atualizarPreviewAba2();" onblur="fastMoedaBlur(this)">
            </div>'''
NEW_ROW = '''            <div class="seq-destino-row">
              <input type="text" id="seqDestino" class="seq-destino-input" placeholder="Destino" oninput="capitalizar(this); atualizarPreviewAba2();">
              <input type="number" id="seqQtdDestino" class="seq-qtd-input" step="1" min="0" inputmode="numeric" placeholder="Qtd" title="Quantidade" oninput="atualizarPreviewAba2();" onfocus="limparZero(this);">
              <div class="seq-valor-wrap">
                <input type="text" id="seqValorDestino" class="seq-valor-input" inputmode="numeric" placeholder="R$ 0,00" title="Valor (R$)" onfocus="fastMoedaFocus(this)" oninput="fastMascaraMoeda(this); atualizarPreviewAba2();" onblur="fastMoedaBlurVazio(this)">
                <button type="button" class="fast-step-btn ripple" title="Diminuir R$ 5,00" onclick="fastValorStep('seqValorDestino',-5)"><i class="fa-solid fa-minus"></i></button>
                <button type="button" class="fast-step-btn ripple" title="Aumentar R$ 5,00" onclick="fastValorStep('seqValorDestino',5)"><i class="fa-solid fa-plus"></i></button>
              </div>
            </div>'''
replace_once('modal seq-destino-row', OLD_ROW, NEW_ROW)

# ============================================================
# 2) TEMPLATE JS DOS DESTINOS EXTRAS — mesmo padrão: wrap com
#    botões ±R$5 (fastValorStepEl) e blur que mantém vazio.
# ============================================================
OLD_EXTRA = '''        <input type="text" placeholder="Destino extra..." value="${valor}" class="destino-extra-input seq-destino-input" style="flex:1;" oninput="capitalizar(this);">
        <input type="number" placeholder="Qtd" value="${qtd}" class="extra-qtd-input seq-qtd-input" step="1" min="0" inputmode="numeric" title="Quantidade" onfocus="limparZero(this);">
        <input type="text" placeholder="R\\$ 0,00" value="${valr}" class="extra-valor-input seq-valor-input" inputmode="numeric" title="Valor (R\\$)" onfocus="fastMoedaFocus(this)" oninput="fastMascaraMoeda(this);" onblur="fastMoedaBlur(this)">
        <button type="button" class="btn-danger" style="padding:10px 12px;flex-shrink:0;" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>'''
NEW_EXTRA = '''        <input type="text" placeholder="Destino extra..." value="${valor}" class="destino-extra-input seq-destino-input" style="flex:1;" oninput="capitalizar(this);">
        <input type="number" placeholder="Qtd" value="${qtd}" class="extra-qtd-input seq-qtd-input" step="1" min="0" inputmode="numeric" title="Quantidade" onfocus="limparZero(this);">
        <div class="seq-valor-wrap" style="flex:0 0 auto;">
          <input type="text" placeholder="R\\$ 0,00" value="${valr}" class="extra-valor-input seq-valor-input" inputmode="numeric" title="Valor (R\\$)" onfocus="fastMoedaFocus(this)" oninput="fastMascaraMoeda(this);" onblur="fastMoedaBlurVazio(this)">
          <button type="button" class="fast-step-btn ripple" title="Diminuir R\\$ 5,00" onclick="fastValorStepEl(this.closest('.seq-valor-wrap').querySelector('input'),-5)"><i class="fa-solid fa-minus"></i></button>
          <button type="button" class="fast-step-btn ripple" title="Aumentar R\\$ 5,00" onclick="fastValorStepEl(this.closest('.seq-valor-wrap').querySelector('input'),5)"><i class="fa-solid fa-plus"></i></button>
        </div>
        <button type="button" class="btn-danger" style="padding:10px 12px;flex-shrink:0;" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>'''
replace_once('extras template', OLD_EXTRA, NEW_EXTRA)

# ============================================================
# 3) abrirModalNovaSeq — campos por linha de destino abrem VAZIOS
# ============================================================
OLD_ABRIR = '''      // r138: campos por linha de destino
      const inpQtdD = document.getElementById('seqQtdDestino');
      if (inpQtdD) inpQtdD.value = 1;
      fastSetMoeda('seqValorDestino', 0);
      const elQV'''
NEW_ABRIR = '''      // r143: campos por linha de destino abrem VAZIOS (sem 1 / sem R$ 0,00)
      const inpQtdD = document.getElementById('seqQtdDestino');
      if (inpQtdD) inpQtdD.value = '';
      const elValD = document.getElementById('seqValorDestino');
      if (elValD) elValD.value = '';
      const elQV'''
replace_once('abrirModalNovaSeq prefill', OLD_ABRIR, NEW_ABRIR)

# ============================================================
# 4) preencherDadosClienteSeq (autocomplete do cliente) — NÃO
#    preenche mais destino/qtd/valor (origem e obs continuam).
# ============================================================
OLD_PF_DEST = '''      setVal('seqOrigem', ultimaRota.origem || '');
      setVal('seqDestino', ultimaRota.destino || '');
      setVal('seqObs', ultimaRota.descricao || ultimaRota.observacao || '');'''
NEW_PF_DEST = '''      setVal('seqOrigem', ultimaRota.origem || '');
      // r143: destino/qtd/valor NAO sao mais pre-preenchidos — o usuario
      // digita direto, sem precisar apagar nada (pedido do usuario).
      setVal('seqObs', ultimaRota.descricao || ultimaRota.observacao || '');'''
replace_once('prefill cliente destino', OLD_PF_DEST, NEW_PF_DEST)

OLD_PF_QV = '''      // r138: espelha o valor/qtd da ultima rota nos campos por linha de destino
      const inpQtdD = document.getElementById('seqQtdDestino');
      if (inpQtdD) inpQtdD.value = (ultimaRota.qtdMercadorias != null ? ultimaRota.qtdMercadorias : (ultimaRota.qtdVolumes || 1));
      fastSetMoeda('seqValorDestino', ultimaRota.valor != null ? ultimaRota.valor : 0);
      setVal('seqQtdVolumes', ultimaRota.qtdMercadorias != null ? ultimaRota.qtdMercadorias : (ultimaRota.qtdVolumes || 0));'''
NEW_PF_QV = '''      setVal('seqQtdVolumes', ultimaRota.qtdMercadorias != null ? ultimaRota.qtdMercadorias : (ultimaRota.qtdVolumes || 0));'''
replace_once('prefill cliente qtd/valor', OLD_PF_QV, NEW_PF_QV)

# ============================================================
# 5) reset pós-salvar em salvarItemSeq — deixa VAZIO
# ============================================================
OLD_RESET = '''        // r138: re-inicializa campos por linha de destino
        const inpQtdD = document.getElementById('seqQtdDestino');
        if (inpQtdD) inpQtdD.value = 1;
        fastSetMoeda('seqValorDestino', 0);'''
NEW_RESET = '''        // r143: re-inicializa campos por linha de destino VAZIOS
        const inpQtdD = document.getElementById('seqQtdDestino');
        if (inpQtdD) inpQtdD.value = '';
        const elValD2 = document.getElementById('seqValorDestino');
        if (elValD2) elValD2.value = '';'''
replace_once('reset pós-salvar', OLD_RESET, NEW_RESET)

# ============================================================
# 6) fastMoedaBlurVazio — variante que MANTÉM o campo vazio no blur
# ============================================================
OLD_BLUR = '''    // Handler de blur: se vazio, restaura R$ 0,00
    function fastMoedaBlur(input) {
      if (!input) return;
      let val = input.value ? input.value.trim() : '';
      if (val === '' || fastParseMoeda(val) === 0) {
        input.value = 'R$ 0,00';
      }
    }'''
NEW_BLUR = OLD_BLUR + '''

    // r143: variante do blur para os campos de valor por linha de destino
    // (modal ADICIONAR ROTAS): se vazio, PERMANECE vazio — o modal abre
    // limpo (sem "R$ 0,00" pre-preenchido) e o placeholder fica visivel.
    function fastMoedaBlurVazio(input) {
      if (!input) return;
      // intentional no-op: campo vazio permanece vazio (pedido do usuario)
    }'''
replace_once('fastMoedaBlur + variante vazia', OLD_BLUR, NEW_BLUR)

# ============================================================
# 7) fastValorStep → fastValorStepEl (refactor p/ extras sem id)
# ============================================================
OLD_STEP_HEAD = '''  window.fastValorStep = function (idCampo, delta) {
    var el = document.getElementById(idCampo);
    if (!el) return;'''
NEW_STEP_HEAD = '''  // r143: fastValorStepEl recebe o ELEMENTO (linhas de destino extra nao
  // tem id); fastValorStep(id) continua funcionando por compatibilidade.
  window.fastValorStepEl = function (el, delta) {
    if (!el) return;'''
replace_once('fastValorStepEl head', OLD_STEP_HEAD, NEW_STEP_HEAD)

OLD_STEP_TAIL = '''    try { if (el === document.activeElement) el.setSelectionRange(el.value.length, el.value.length); } catch (e) {}
  };
})();'''
NEW_STEP_TAIL = '''    try { if (el === document.activeElement) el.setSelectionRange(el.value.length, el.value.length); } catch (e) {}
  };
  window.fastValorStep = function (idCampo, delta) {
    window.fastValorStepEl(document.getElementById(idCampo), delta);
  };
})();'''
replace_once('fastValorStepEl tail + wrapper', OLD_STEP_TAIL, NEW_STEP_TAIL)

# ============================================================
# 8) CSS — wrap valor+botões sem estourar o card
# ============================================================
OLD_CSS_VALOR = '.seq-destino-row input.seq-valor-input{flex:0 0 110px !important;width:110px !important;min-width:110px !important;text-align:right !important;padding:6px 6px !important}'
NEW_CSS_VALOR = '''.seq-destino-row .seq-valor-wrap{flex:0 0 auto !important;display:flex !important;align-items:stretch !important;gap:4px !important;min-width:0 !important}
.seq-destino-row .seq-valor-wrap input.seq-valor-input{flex:1 1 84px !important;width:84px !important;min-width:0 !important;text-align:right !important;padding:6px 6px !important}
.seq-destino-row .seq-valor-wrap .fast-step-btn{flex:0 0 auto !important;min-width:38px !important;min-height:38px !important;padding:0 8px !important}'''
replace_once('css valor wrap', OLD_CSS_VALOR, NEW_CSS_VALOR)

OLD_CSS_MOBILE = '''body.fast-edition-mobile .seq-destino-row, body.fast-touch-ui .seq-destino-row{display:flex !important;flex-direction:row !important;flex-wrap:nowrap !important}
body.fast-edition-mobile .seq-destino-row input.seq-destino-input{width:auto !important}
body.fast-edition-mobile .seq-destino-row input.seq-qtd-input{width:64px !important}
body.fast-edition-mobile .seq-destino-row input.seq-valor-input{width:110px !important}'''
NEW_CSS_MOBILE = '''body.fast-edition-mobile .seq-destino-row, body.fast-touch-ui .seq-destino-row{display:flex !important;flex-direction:row !important;flex-wrap:nowrap !important}
body.fast-edition-mobile .seq-destino-row input.seq-destino-input{width:auto !important}
body.fast-edition-mobile .seq-destino-row input.seq-qtd-input{width:64px !important}
body.fast-edition-mobile .seq-destino-row .seq-valor-wrap, body.fast-touch-ui .seq-destino-row .seq-valor-wrap{flex:0 0 auto !important}
body.fast-edition-mobile .seq-destino-row .seq-valor-wrap input.seq-valor-input, body.fast-touch-ui .seq-destino-row .seq-valor-wrap input.seq-valor-input{width:84px !important}'''
replace_once('css fast-edition-mobile', OLD_CSS_MOBILE, NEW_CSS_MOBILE)

OLD_CSS_MEDIA = '@media (max-width:520px){.seq-destino-row{flex-wrap:wrap !important}.seq-destino-row input.seq-destino-input{flex:1 1 100% !important;width:100% !important}.seq-destino-row input.seq-qtd-input,.seq-destino-row input.seq-valor-input{flex:1 1 calc(50% - 8px) !important;width:auto !important}}'
NEW_CSS_MEDIA = '@media (max-width:520px){.seq-destino-row{flex-wrap:wrap !important;row-gap:8px !important}.seq-destino-row input.seq-destino-input{flex:1 1 100% !important;width:100% !important}.seq-destino-row input.seq-qtd-input{flex:0 0 64px !important;width:64px !important}.seq-destino-row .seq-valor-wrap{flex:1 1 calc(100% - 64px - 16px) !important;min-width:0 !important}.seq-destino-row .seq-valor-wrap input.seq-valor-input{flex:1 1 0 !important;width:auto !important;min-width:0 !important}.seq-destino-row .seq-valor-wrap .fast-step-btn{min-width:40px !important;min-height:40px !important}.destino-extra-row .seq-valor-wrap .fast-step-btn{min-width:34px !important;min-height:36px !important;padding:0 6px !important}}'
replace_once('css media 520px', OLD_CSS_MEDIA, NEW_CSS_MEDIA)

# ============================================================
# 9) VERSIONAMENTO 2.3.26 -> 2.3.27 (convenções r142)
# ============================================================
LATEST_UPDATE = ('2.3.27: no modal ADICIONAR ROTAS, os campos Destino, Qtd e Valor '
  'agora abrem vazios — sem o R$ 0,00, sem a quantidade 1 e sem herdar o destino '
  'da última rota do cliente; é só digitar direto, sem apagar nada. O campo Valor '
  'ganhou botões − e + que ajustam de R$ 5 em R$ 5 (também nos destinos extra), '
  'com layout que não estoura a largura do card no celular.')

m = re.search(r'<meta name="fast-latest-update" content="([^"]*)">', content)
must('meta latest-update', 1 if m else 0)
content = content[:m.start(1)] + LATEST_UPDATE + content[m.end(1):]

replace_once('meta changelog-immediate',
  '<meta name="fast-app-changelog-immediate" content="2.3.26">',
  '<meta name="fast-app-changelog-immediate" content="2.3.27">')

replace_once('meta fast-app-date',
  '<meta name="fast-app-date" content="' + OLD_DATE_ISO + '">',
  '<meta name="fast-app-date" content="' + NEW_DATE_ISO + '">')

replace_once('r91 version',
  "if(m) m.content='2.3.26';",
  "if(m) m.content='2.3.27';")
replace_once('r91 date',
  "if(d) d.content='" + OLD_DATE_ISO + "';",
  "if(d) d.content='" + NEW_DATE_ISO + "';")
m = re.search(r"if\(l\) l\.content='2\.3\.26: [^']*';", content)
must('r91 latest-update', 1 if m else 0)
content = content[:m.start()] + "if(l) l.content='" + LATEST_UPDATE + "';" + content[m.end():]

replace_once('html data-fast-version',
  'data-fast-version="2.3.26">',
  'data-fast-version="2.3.27">')

# 9d) CHANGELOG META — 2 itens novos com &quot;
ITEM1 = ('2.3.27 (09/09/2026): no modal ADICIONAR ROTAS (Adicionar Item às Rotas '
  'do Dia), os campos Destino, Quantidade e Valor agora abrem vazios — sem o '
  '"R$ 0,00", sem a quantidade 1 e sem herdar o destino da última rota do '
  'cliente; é só digitar direto, sem precisar apagar nada antes.')
ITEM2 = ('2.3.27 (09/09/2026): o campo Valor ganhou botões − e + ao lado que '
  'sobem e descem de R$ 5 em R$ 5 (também nas linhas de destino extra); o '
  'layout foi recalibrado para não estourar a largura do card — no celular o '
  'destino ocupa uma linha e Qtd + Valor com os botões ficam na linha de baixo.')

def enc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')

NEW_ITEMS = ('[{&quot;type&quot;:&quot;melhorado&quot;,&quot;text&quot;:&quot;' + enc(ITEM1) + '&quot;},'
             '{&quot;type&quot;:&quot;novo&quot;,&quot;text&quot;:&quot;' + enc(ITEM2) + '&quot;},')
replace_once('changelog meta novos itens',
  '<meta name="fast-app-changelog" content="[',
  '<meta name="fast-app-changelog" content="' + NEW_ITEMS)

# 9e) PAINEL ESTÁTICO fastUpdatesBody — substituição integral
def fup_item(typ, text):
    if typ == 'novo':
        color, bg, icon, label = '#16a34a', 'rgba(22,163,74,0.10)', 'fa-solid fa-circle-plus', 'Novo'
    else:
        color, bg, icon, label = '#2563eb', 'rgba(37,99,235,0.10)', 'fa-solid fa-arrow-up', 'Melhorado'
    return ('<div class="fup-item"><div class="fup-item-dot" style="background:' + bg + ';"><i class="' + icon + '" style="color:' + color + ';"></i></div>'
            '<div class="fup-item-content"><span class="fup-item-badge" style="color:' + color + ';background:' + bg + ';">' + label + '</span>'
            '<div class="fup-item-text">' + text + '</div></div></div>')

PANEL_OPEN = '<div class="fast-updates-panel-body" id="fastUpdatesBody">'
PANEL_END_ANCHOR = 'novos \u00edndices.</div></div></div></div>'
must('painel início', content.count(PANEL_OPEN), 1)
must('painel fim (âncora 4 divs)', content.count(PANEL_END_ANCHOR), 1)

ps = content.find(PANEL_OPEN)
pe = content.find(PANEL_END_ANCHOR, ps) + len(PANEL_END_ANCHOR)
old_panel = content[ps:pe]
assert old_panel.count('fup-version-header') == 1, 'painel: header count'
assert old_panel.count('2.3.26') == 4, 'painel: 2.3.26 count = %d' % old_panel.count('2.3.26')

PANEL_NEW = (PANEL_OPEN
  + '<div class="fup-version-header"><div class="fup-version-row"><i class="fa-solid fa-sparkles"></i> <span>Vers\u00e3o 2.3.27</span></div>'
  + '<div class="fup-date-row"><i class="fa-solid fa-clock"></i> <span>Lan\u00e7ada em ' + NEW_DATE_PANEL + '</span></div></div>'
  + fup_item('melhorado', ITEM1) + fup_item('novo', ITEM2)
  + '</div>')
content = content[:ps] + PANEL_NEW + content[pe:]

replace_once('painel count',
  '<span class="fup-count" id="fastUpdatesCount">3</span>',
  '<span class="fup-count" id="fastUpdatesCount">2</span>')

# 9f/9g) REPLACE GLOBAL DE VERSÃO — com máscara no changelog meta
MASK = '\x00R143MASK\x00'
cl = re.search(r'(<meta name="fast-app-changelog" content=")([^"]*)(")', content)
must('changelog meta pós-inserção', 1 if cl else 0)
cl_raw = cl.group(2)
cl_hist_count = cl_raw.count(OLD_VERSION)  # itens históricos 2.3.26 que devem permanecer
content = content[:cl.start(2)] + MASK + content[cl.end(2):]

before = content.count(OLD_VERSION)
content = content.replace(OLD_VERSION, NEW_VERSION)
after = content.count(OLD_VERSION)
print(f'ok replace global: {before} ocorrências -> restam {after} (masked)')

must('máscara principal única', content.count(MASK), 1)
content = content.replace(MASK, cl_raw, 1)

remaining = content.count(OLD_VERSION)
# restam apenas os itens históricos "2.3.26 (" do changelog meta
if remaining != cl_hist_count:
    print(f'FALHA: restam {remaining} ocorrências de 2.3.26 (esperado: {cl_hist_count} do changelog)')
    for m in re.finditer(r'2\.3\.26', content):
        print('  ...', repr(content[max(0,m.start()-50):m.start()+30]))
    sys.exit(1)
print(f'ok versão: restam exatamente {cl_hist_count} ocorrências históricas (changelog meta)')

# ============================================================
# 10) SANIDADE FINAL + GRAVAÇÃO
# ============================================================
assert content.count('seq-valor-wrap') >= 6, 'seq-valor-wrap: %d' % content.count('seq-valor-wrap')
assert 'fastValorStepEl' in content
assert 'fastMoedaBlurVazio' in content
assert 'fastValorStep(\'seqValorDestino\',-5)' in content
assert 'value="1" title="Quantidade"' not in content
assert NEW_DATE_ISO in content
assert OLD_DATE_ISO not in content
assert 'Vers\u00e3o 2.3.27</span>' in content
# data-fast-version + metas coerentes
assert '<meta name="fast-app-version" content="2.3.27">' in content
assert content.count('data-fast-version="2.3.27"') == 1

open(SRC, 'w', encoding='utf-8').write(content)
print(f'ok gravado: {orig_len} -> {len(content)} bytes ({len(content)-orig_len:+d})')
print('PATCH R143 CONCLUÍDO')
