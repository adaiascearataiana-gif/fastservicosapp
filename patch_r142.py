#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_r142.py — v2.3.26
Checkbox de seleção na primeira coluna da tabela de Rotas (Aba Rotas)
+ balão flutuante com botão EXCLUIR quando 2+ rotas marcadas.

Base: index.html v2.3.25 (HEAD 09cdc23, md5 fa8ebb491102726472ce35f3ce12ac25)
Convenções: r125 (Clientes/Destinos) + r142 (Rotas).

Correções vs. rascunho anterior (bugs pré-compaction):
  9d  — itens do changelog inseridos com &quot; (aspas cruas quebrariam o meta)
  9e  — fim do painel de atualizações = âncora única com 4 divs de fechamento
  9g  — máscara de proteção dos 4 itens históricos "2.3.25 (" do changelog meta
        durante o replace global de versão
  8   — migração fast_sort_state usa marcador SEPARADO (fast_sort_m142), pois
        _salvarOrdenacao() grava só {col,dir} e apagaria flags internas
  4c  — shift da regra extra #tabelaRotasBody td:nth-child(5) → (6) (Destino)
  6b  — neutralização mobile do .rot-sel-checkbox (padrão r138 seq-checkbox)
  simp — checkbox de linha carrega apenas data-rota-id (resumo do confirm busca
        nome/data em bancoDados.rotas, igual o r125 faz para clientes)
  drag — alça do balão SEM data-fast-r125 pré-marcado: fastR125BindDrag precisa
        bindar de verdade (padrão do commit original r125 7358893)
"""
import re, sys

SRC = '/workspace/fsapp/index.html'
NEW_VERSION = '2.3.26'
OLD_VERSION = '2.3.25'
NEW_DATE_ISO = '2026-09-09T10:30:00-03:00'
OLD_DATE_ISO = '2026-09-08T22:30:00-03:00'
NEW_DATE_BR = '09/09/2026'

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
# 1) THEAD — coluna de seleção na frente da coluna Ações
# ============================================================
OLD_THEAD = '''              <th>Ações</th>
              <th class="sortable-th" onclick="ordenarTabela(1,'tabelaRotasBody')">Status da Rota</th>
              <th class="sortable-th" onclick="ordenarTabela(2,'tabelaRotasBody')">Cliente</th>
              <th class="sortable-th" onclick="ordenarTabela(3,'tabelaRotasBody')">Origem</th>
              <th class="sortable-th" onclick="ordenarTabela(4,'tabelaRotasBody')">Destino</th>
              <th class="sortable-th sort-desc" onclick="ordenarTabela(5,'tabelaRotasBody')">Data</th>
              <th class="sortable-th" onclick="ordenarTabela(6,'tabelaRotasBody')">Tipo</th>
              <th class="sortable-th" onclick="ordenarTabela(7,'tabelaRotasBody')">Volumes</th>
              <th class="sortable-th" onclick="ordenarTabela(8,'tabelaRotasBody')">Pagamento</th>
              <th class="sortable-th" onclick="ordenarTabela(9,'tabelaRotasBody')">Status Pag.</th>
              <th class="sortable-th" onclick="ordenarTabela(10,'tabelaRotasBody')">Valor (R$)</th>
'''
NEW_THEAD = '''              <th class="rot-sel-th" title="Marcar/desmarcar todas as rotas desta lista"><input type="checkbox" id="rotSelTodos" class="rot-sel-checkbox no-print" onchange="rotAlternarTodos(this.checked)"></th>
              <th>Ações</th>
              <th class="sortable-th" onclick="ordenarTabela(2,'tabelaRotasBody')">Status da Rota</th>
              <th class="sortable-th" onclick="ordenarTabela(3,'tabelaRotasBody')">Cliente</th>
              <th class="sortable-th" onclick="ordenarTabela(4,'tabelaRotasBody')">Origem</th>
              <th class="sortable-th" onclick="ordenarTabela(5,'tabelaRotasBody')">Destino</th>
              <th class="sortable-th sort-desc" onclick="ordenarTabela(6,'tabelaRotasBody')">Data</th>
              <th class="sortable-th" onclick="ordenarTabela(7,'tabelaRotasBody')">Tipo</th>
              <th class="sortable-th" onclick="ordenarTabela(8,'tabelaRotasBody')">Volumes</th>
              <th class="sortable-th" onclick="ordenarTabela(9,'tabelaRotasBody')">Pagamento</th>
              <th class="sortable-th" onclick="ordenarTabela(10,'tabelaRotasBody')">Status Pag.</th>
              <th class="sortable-th" onclick="ordenarTabela(11,'tabelaRotasBody')">Valor (R$)</th>
'''
replace_once('thead rotas', OLD_THEAD, NEW_THEAD)

# ============================================================
# 2) TEMPLATE JS — célula de seleção no início de cada linha
#    (render dinâmico; id da rota vem de ${r.id})
# ============================================================
OLD_ROW = '''        linhasRotas.push(`<tr>
          <td>
            <div class="actions-cell">
              <button class="btn-primary" onclick="abrirModalEditarRota('${r.id}')" title="Editar"><span class="lbl">EDITAR</span></button>
              <button class="btn-danger" onclick="deletarRota('${r.id}')" title="Excluir"><span class="lbl">EXCLUIR</span></button>
            </div>
          </td>
'''
NEW_ROW = '''        linhasRotas.push(`<tr>
          <td class="rot-sel-td"><input type="checkbox" class="rot-sel-checkbox rot-sel-linha no-print" data-rota-id="${r.id}" onchange="rotAtualizarBoxSelecao()" title="Marcar para exclusão em massa"></td>
          <td>
            <div class="actions-cell">
              <button class="btn-primary" onclick="abrirModalEditarRota('${r.id}')" title="Editar"><span class="lbl">EDITAR</span></button>
              <button class="btn-danger" onclick="deletarRota('${r.id}')" title="Excluir"><span class="lbl">EXCLUIR</span></button>
            </div>
          </td>
'''
replace_once('template render rotas', OLD_ROW, NEW_ROW)

# ============================================================
# 3) LINHAS ESTÁTICAS — 450 <tr> do tbody inicial recebem o checkbox
# ============================================================
tbody_start = content.find('<tbody id="tabelaRotasBody">')
tbody_end = content.find('</tbody>', tbody_start)
must('tbody rotas existe', 1 if tbody_start >= 0 else 0)
seg = content[tbody_start:tbody_end]
must('tbody rotas 450 linhas', seg.count('<tr>'), 450)

injected = 0
pattern = re.compile(
    r'<tr>\s*<td>\s*<div class="actions-cell">\s*'
    r'<button class="btn-primary" onclick="abrirModalEditarRota\(\'(\d+)\'\)"'
    r'.*?</tr>', re.S)

def inject_cb(m):
    global injected
    row, rid = m.group(0), m.group(1)
    cb_cell = ('          <td class="rot-sel-td"><input type="checkbox" class="rot-sel-checkbox rot-sel-linha no-print" '
               f'data-rota-id="{rid}" onchange="rotAtualizarBoxSelecao()" title="Marcar para exclusão em massa"></td>\n')
    new_row = row.replace('<tr>', '<tr>\n' + cb_cell.rstrip('\n'), 1)
    injected += 1
    return new_row

new_seg = pattern.sub(inject_cb, seg)
must('checkbox injetado em 450 linhas estáticas', injected, 450)
content = content[:tbody_start] + new_seg + content[tbody_end:]

# ============================================================
# 4) CSS — coluna 1 estreita p/ checkbox; desloca 1..11 → 2..12;
#    4c) regra extra nth-child(5) → (6); 6b) neutralização mobile
# ============================================================
OLD_CSS = '''    /* Coluna Ações — largura mínima, não precisa ser flexível */
    #rotasTable thead th:nth-child(1), #tabelaRotasBody td:nth-child(1) { width: 8%; min-width: 96px; white-space: normal; }
    /* Status Rota — centralizado, largura para o badge */
    #rotasTable thead th:nth-child(2), #tabelaRotasBody td:nth-child(2) { width: 10%; min-width: 110px; text-align: center; }
    /* Cliente — FLEXÍVEL: ajusta-se ao maior nome, sem corte/sobreposição */
    #rotasTable thead th:nth-child(3), #tabelaRotasBody td:nth-child(3) { min-width: 120px; white-space: normal; word-break: break-word; overflow-wrap: anywhere; }
    /* Origem — FLEXÍVEL: ajusta-se ao maior conteúdo */
    #rotasTable thead th:nth-child(4), #tabelaRotasBody td:nth-child(4) { min-width: 90px; white-space: normal; word-break: break-word; overflow-wrap: anywhere; }
    /* Destino — FLEXÍVEL: ajusta-se à maior linha de 2 destinos */
    #rotasTable thead th:nth-child(5), #tabelaRotasBody td:nth-child(5) { min-width: 160px; white-space: normal; word-break: break-word; overflow-wrap: anywhere; line-height: 1.35; }
    /* Data — largura suficiente para "21/08/2026" sem quebrar em mobile */
    #rotasTable thead th:nth-child(6), #tabelaRotasBody td:nth-child(6) { min-width: 112px; white-space: nowrap; text-align: center; }
    /* Tipo — largura suficiente para "MERCADORIA"/"DOCUMENTO" sem quebrar em mobile */
    #rotasTable thead th:nth-child(7), #tabelaRotasBody td:nth-child(7) { min-width: 120px; white-space: nowrap; text-align: center; }
    /* Volumes — número pequeno, não quebra */
    #rotasTable thead th:nth-child(8), #tabelaRotasBody td:nth-child(8) { min-width: 55px; white-space: nowrap; text-align: center; }
    /* Pagamento — "PIX", "DÉBITO", "CRÉDITO", "BOLETO", "À VISTA" sem quebrar */
    #rotasTable thead th:nth-child(9), #tabelaRotasBody td:nth-child(9) { min-width: 78px; white-space: nowrap; text-align: center; }
    /* Status Pagamento — ampliado p/ badge "RECEBIDO"/"PENDENTE" sem quebrar */
    #rotasTable thead th:nth-child(10),#tabelaRotasBody td:nth-child(10){ min-width: 100px; white-space: nowrap; text-align: center; }
    /* Valor — centralizado */
    #rotasTable thead th:nth-child(11),#tabelaRotasBody td:nth-child(11){ min-width: 76px; text-align: center; white-space: nowrap; }
'''
NEW_CSS = '''    /* (r142) Coluna SELEÇÃO — caixinha de marcação na primeira coluna (igual ao Clientes) */
    #rotasTable thead th:nth-child(1), #tabelaRotasBody td:nth-child(1) { width: auto; min-width: 34px; max-width: 46px; white-space: nowrap; text-align: center; padding: 4px 3px; }
    .rot-sel-checkbox { width: 17px; height: 17px; cursor: pointer; accent-color: var(--accent); margin: 0; vertical-align: middle; flex: 0 0 auto; }
    #rotasTable .rot-sel-th { vertical-align: middle; }
    /* (r138/6b) Neutralizar regra mobile que estica todos os inputs (vence por !important) */
    body.fast-edition-mobile .rot-sel-checkbox, body.fast-touch-ui .rot-sel-checkbox,
    body.fast-edition-mobile input[type="checkbox"].rot-sel-checkbox, body.fast-touch-ui input[type="checkbox"].rot-sel-checkbox,
    .rot-sel-checkbox{width:17px !important;height:17px !important;min-width:17px !important;max-width:17px !important;min-height:17px !important;max-height:17px !important;flex:0 0 auto !important;box-sizing:content-box !important;flex-shrink:0 !important;flex-grow:0 !important;margin:0 !important;align-self:center !important}
    /* Coluna Ações — largura mínima, não precisa ser flexível */
    #rotasTable thead th:nth-child(2), #tabelaRotasBody td:nth-child(2) { width: 8%; min-width: 96px; white-space: normal; }
    /* Status Rota — centralizado, largura para o badge */
    #rotasTable thead th:nth-child(3), #tabelaRotasBody td:nth-child(3) { width: 10%; min-width: 110px; text-align: center; }
    /* Cliente — FLEXÍVEL: ajusta-se ao maior nome, sem corte/sobreposição */
    #rotasTable thead th:nth-child(4), #tabelaRotasBody td:nth-child(4) { min-width: 120px; white-space: normal; word-break: break-word; overflow-wrap: anywhere; }
    /* Origem — FLEXÍVEL: ajusta-se ao maior conteúdo */
    #rotasTable thead th:nth-child(5), #tabelaRotasBody td:nth-child(5) { min-width: 90px; white-space: normal; word-break: break-word; overflow-wrap: anywhere; }
    /* Destino — FLEXÍVEL: ajusta-se à maior linha de 2 destinos */
    #rotasTable thead th:nth-child(6), #tabelaRotasBody td:nth-child(6) { min-width: 160px; white-space: normal; word-break: break-word; overflow-wrap: anywhere; line-height: 1.35; }
    /* Data — largura suficiente para "21/08/2026" sem quebrar em mobile */
    #rotasTable thead th:nth-child(7), #tabelaRotasBody td:nth-child(7) { min-width: 112px; white-space: nowrap; text-align: center; }
    /* Tipo — largura suficiente para "MERCADORIA"/"DOCUMENTO" sem quebrar em mobile */
    #rotasTable thead th:nth-child(8), #tabelaRotasBody td:nth-child(8) { min-width: 120px; white-space: nowrap; text-align: center; }
    /* Volumes — número pequeno, não quebra */
    #rotasTable thead th:nth-child(9), #tabelaRotasBody td:nth-child(9) { min-width: 55px; white-space: nowrap; text-align: center; }
    /* Pagamento — "PIX", "DÉBITO", "CRÉDITO", "BOLETO", "À VISTA" sem quebrar */
    #rotasTable thead th:nth-child(10),#tabelaRotasBody td:nth-child(10){ min-width: 78px; white-space: nowrap; text-align: center; }
    /* Status Pagamento — ampliado p/ badge "RECEBIDO"/"PENDENTE" sem quebrar */
    #rotasTable thead th:nth-child(11),#tabelaRotasBody td:nth-child(11){ min-width: 100px; white-space: nowrap; text-align: center; }
    /* Valor — centralizado */
    #rotasTable thead th:nth-child(12),#tabelaRotasBody td:nth-child(12){ min-width: 76px; text-align: center; white-space: nowrap; }
'''
replace_once('css colunas rotas', OLD_CSS, NEW_CSS)

OLD_EXTRA = '''    #tabelaRotasBody td:nth-child(5) { word-break: break-word; overflow-wrap: anywhere; white-space: normal; line-height: 1.3; }  /* Destino: quebra, cresce para preencher */
'''
NEW_EXTRA = '''    #tabelaRotasBody td:nth-child(6) { word-break: break-word; overflow-wrap: anywhere; white-space: normal; line-height: 1.3; }  /* Destino: quebra, cresce para preencher */
'''
replace_once('css extra destino', OLD_EXTRA, NEW_EXTRA)

# ============================================================
# 5) BALÃO FLUTUANTE — floatingRotasBox (padrão r125), handle SEM
#    data-fast-r125 pré-marcado (bind de verdade) + bind + trocarAba
# ============================================================
NEW_BOXES = '''  <!-- (r142) Balão flutuante de seleção em massa — ROTAS (aparece com 2+ marcadas) -->
  <div id="floatingRotasBox" class="floating-select-box" style="user-select: none;">
    <div class="fsb-drag" id="rotFsbDragHandle" title="Arraste para mover"><i class="fa-solid fa-up-down-left-right"></i></div>
    <span class="fsb-count">
      <span class="fsb-num" id="rotFsbNum">0</span>
      <span id="rotFsbLabel">rotas selecionadas</span>
    </span>
    <button class="btn-whatsapp fsb-excluir ripple" id="btnExcluirRotasFloating" onclick="rotExcluirSelecionados()" title="Excluir as rotas selecionadas" style="user-select: none;"><i class="fa-solid fa-trash-can"></i> Excluir</button>
    <button class="fsb-clear ripple" title="Limpar seleção" onclick="rotLimparSelecao()" style="user-select: none;"><i class="fa-solid fa-xmark"></i></button>
  </div>

'''
OLD_DEST_BOX_OPEN = '''  <!-- (r125) Balão flutuante de seleção em massa — LUGARES/DESTINOS (igual ao Rotas do Dia) -->'''
replace_once('balão rotas box', OLD_DEST_BOX_OPEN, NEW_BOXES + OLD_DEST_BOX_OPEN)

OLD_BIND = '''        fastR125BindDrag('floatingClientesBox', 'cliFsbDragHandle', 'floatingBoxPosCliV2');
        fastR125BindDrag('floatingDestinosBox', 'destFsbDragHandle', 'floatingBoxPosDestV2');'''
NEW_BIND = '''        fastR125BindDrag('floatingClientesBox', 'cliFsbDragHandle', 'floatingBoxPosCliV2');
        fastR125BindDrag('floatingDestinosBox', 'destFsbDragHandle', 'floatingBoxPosDestV2');
        fastR125BindDrag('floatingRotasBox', 'rotFsbDragHandle', 'floatingBoxPosRotasV2');'''
replace_once('bind drag rotas', OLD_BIND, NEW_BIND)

OLD_TABS = '''      ['floatingSelectBox', 'floatingClientesBox', 'floatingDestinosBox'].forEach(function(bid) {'''
NEW_TABS = '''      ['floatingSelectBox', 'floatingClientesBox', 'floatingDestinosBox', 'floatingRotasBox'].forEach(function(bid) {'''
replace_once('trocarAba esconde balão rotas', OLD_TABS, NEW_TABS)

# ============================================================
# 6) FUNÇÕES JS — rot* (padrão r125); balão só com 2+ marcadas
# ============================================================
ROT_FUNCS = '''    /* ============================================================
       (r142) SELEÇÃO MÚLTIPLA EM MASSA — ROTAS (Aba Rotas)
       Balão flutuante aparece quando 2+ rotas marcadas.
       ============================================================ */
    function rotAtualizarBoxSelecao() {
      const box = document.getElementById('floatingRotasBox');
      const numEl = document.getElementById('rotFsbNum');
      const labelEl = document.getElementById('rotFsbLabel');
      if (!box || !numEl || !labelEl) return;
      const checkboxes = document.querySelectorAll('.rot-sel-linha');
      const marcados = Array.from(checkboxes).filter(cb => cb.checked).length;
      numEl.textContent = marcados;
      labelEl.textContent = marcados === 1 ? 'rota selecionada' : 'rotas selecionadas';
      // (r142) Balão só sobe com MAIS DE UMA rota marcada
      if (marcados > 1) {
        box.classList.add('show');
      } else {
        box.classList.remove('show');
      }
      // Sincroniza o "marcar todos" do cabeçalho
      const todos = document.getElementById('rotSelTodos');
      if (todos) todos.checked = checkboxes.length > 0 && marcados === checkboxes.length;
    }

    function rotAlternarTodos(marcado) {
      document.querySelectorAll('.rot-sel-linha').forEach(cb => cb.checked = !!marcado);
      rotAtualizarBoxSelecao();
    }

    function rotLimparSelecao() {
      document.querySelectorAll('.rot-sel-linha').forEach(cb => cb.checked = false);
      rotAtualizarBoxSelecao();
    }

    function rotExcluirSelecionados() {
      const checkboxes = document.querySelectorAll('.rot-sel-linha:checked');
      if (checkboxes.length === 0) {
        mostrarToast('Selecione ao menos uma rota (marque a caixinha) para excluir.', 'warning');
        return;
      }
      const idsSel = Array.from(checkboxes).map(cb => String(cb.dataset.rotaId || ''));
      const rotasSel = (bancoDados.rotas || []).filter(r => idsSel.includes(String(r.id)));
      if (rotasSel.length === 0) {
        mostrarToast('As rotas marcadas não foram encontradas no banco de dados.', 'warning');
        return;
      }
      const total = rotasSel.length;
      const valorTotal = rotasSel.reduce((a, b) => a + (parseFloat(b.valor) || 0), 0);
      const resumo = rotasSel.slice(0, 5).map(r => escapeHtml(r.cliente || '(sem nome)') + ' (' + formatarDataBR(r.data) + ')').join('<br>');
      const extra = total > 5 ? '<br>... e mais ' + (total - 5) + ' rota(s).' : '';
      confirmarDialog(
        'Excluir ' + total + ' Rota' + (total > 1 ? 's' : ''),
        'Deseja realmente excluir <strong>' + total + '</strong> rota' + (total > 1 ? 's' : '') + ' selecionada' + (total > 1 ? 's' : '') + '?<br><br>' + resumo + extra + '<br><br>Valor total destas rotas: <strong>R$ ' + valorTotal.toFixed(2).replace('.', ',') + '</strong><br><br>As rotas serão removidas do relatório, das sequências do dia e também da nuvem (Supabase).<br><br><strong>Esta ação não pode ser desfeita.</strong>',
        function() {
          // 1. Blacklist: impede que o merge da nuvem re-crie as rotas excluídas
          if (!Array.isArray(bancoDados.rotasExcluidas)) bancoDados.rotasExcluidas = [];
          if (!Array.isArray(bancoDados.seqRotasExcluidas)) bancoDados.seqRotasExcluidas = [];
          if (!Array.isArray(bancoDados.seqItensExcluidos)) bancoDados.seqItensExcluidos = [];
          rotasSel.forEach(r => {
            const idStr = String(r.id);
            if (!bancoDados.rotasExcluidas.includes(idStr)) bancoDados.rotasExcluidas.push(idStr);
            if (!bancoDados.seqRotasExcluidas.includes(idStr)) bancoDados.seqRotasExcluidas.push(idStr);
            // Registra IDs dos itens de sequência que serão removidos (órfãos)
            if (bancoDados.sequencias) {
              Object.keys(bancoDados.sequencias).forEach(data => {
                if (Array.isArray(bancoDados.sequencias[data])) {
                  bancoDados.sequencias[data].forEach(s => {
                    if (String(s.rotaId) === idStr && s.id != null) {
                      const sid = String(s.id);
                      if (sid && sid !== 'undefined' && sid !== 'null' && !bancoDados.seqItensExcluidos.includes(sid)) {
                        bancoDados.seqItensExcluidos.push(sid);
                      }
                    }
                  });
                }
              });
            }
          });
          // 2. Remove as rotas do array local
          bancoDados.rotas = (bancoDados.rotas || []).filter(r => !idsSel.includes(String(r.id)));
          // 3. Limpa itens de sequência vinculados (órfãos) — igual deletarRota
          if (bancoDados.sequencias) {
            Object.keys(bancoDados.sequencias).forEach(data => {
              if (Array.isArray(bancoDados.sequencias[data])) {
                bancoDados.sequencias[data] = bancoDados.sequencias[data].filter(
                  s => !idsSel.includes(String(s.rotaId))
                );
              }
            });
          }
          // 4. Salva, sincroniza e re-renderiza
          salvarStorage();
          if (typeof sincronizarAgora === 'function') {
            try { sincronizarAgora(); } catch(e) { console.warn('Erro ao sincronizar após exclusão em massa:', e); }
          }
          renderizar();
          try { renderizarSequencia(); } catch(e) {}
          try { renderizarClientes(); } catch(e) {}
          try { atualizarContadoresHeader(); } catch(e) {}
          mostrarToast(total + ' rota' + (total > 1 ? 's' : '') + ' excluída' + (total > 1 ? 's' : '') + '.', 'info');
        }
      );
    }

'''
ANCHOR_FUNCS = '''    /* (r125) Arrasto dos balões de seleção em massa — mesma mecânica do Rotas do Dia */
'''
replace_once('funções rot*', ANCHOR_FUNCS, ROT_FUNCS + ANCHOR_FUNCS)

# ============================================================
# 7) RENDER — rotAtualizarBoxSelecao() ao final do render
# ============================================================
OLD_TAIL = '''      // Reaplicar ordenação salva pelo usuário (persiste após editar/excluir rotas)
      reaplicarOrdenacao();'''
NEW_TAIL = '''      // Reaplicar ordenação salva pelo usuário (persiste após editar/excluir rotas)
      reaplicarOrdenacao();
      // (r142) Sincroniza balão de seleção em massa após re-render (checkboxes zeram)
      try { rotAtualizarBoxSelecao(); } catch(e) {}'''
replace_once('render tail rot box', OLD_TAIL, NEW_TAIL)

# ============================================================
# 8) MIGRAÇÃO DO ESTADO DE ORDENAÇÃO (fast_sort_state = só Rotas)
# ============================================================
OLD_RESTORE = '''        const saved = localStorage.getItem('fast_sort_state');
        if (saved) {
          const obj = JSON.parse(saved);
          if (obj && typeof obj.col === 'number') { _sortCol = obj.col; _sortDir = obj.dir || 'asc'; }
        }'''
NEW_RESTORE = '''        const saved = localStorage.getItem('fast_sort_state');
        if (saved) {
          const obj = JSON.parse(saved);
          if (obj && typeof obj.col === 'number') { _sortCol = obj.col; _sortDir = obj.dir || 'asc'; }
        }
        // (r142) Migração: índices de coluna deslocaram +1 (coluna Seleção na frente).
        // Marcador SEPARADO fast_sort_m142 — _salvarOrdenacao grava só {col,dir}.
        // O marcador é setado SEMPRE no primeiro carregamento pós-r142 (mesmo sem
        // estado salvo): qualquer estado salvo depois já nasce nos índices novos.
        try {
          if (localStorage.getItem('fast_sort_m142') !== '1') {
            if (_sortCol !== null) {
              _sortCol = _sortCol + 1;
              if (_sortCol > 11) _sortCol = 11;
              localStorage.setItem('fast_sort_state', JSON.stringify({ col: _sortCol, dir: _sortDir }));
            }
            localStorage.setItem('fast_sort_m142', '1');
          }
        } catch(e) {}'''
replace_once('migração sort state', OLD_RESTORE, NEW_RESTORE)

OLD_RR = '''        // Tratamento especial para coluna de Data (índice 5): compara como data BR dd/mm/aaaa
        if (colIdx === 5) {'''
NEW_RR = '''        // Tratamento especial para coluna de Data: compara como data BR dd/mm/aaaa
        // (r142) índice deslocado para 6 após a coluna de Seleção entrar na frente
        if (colIdx === 6) {'''
replace_once('reaplicar data col', OLD_RR, NEW_RR)

# ============================================================
# 9) VERSÃO / CHANGELOG / PAINEL — 2.3.25 → 2.3.26
# ============================================================
replace_once('meta version',
  '<meta name="fast-app-version" content="2.3.25">',
  '<meta name="fast-app-version" content="2.3.26">')

replace_once('meta date',
  '<meta name="fast-app-date" content="2026-09-08T22:30:00-03:00">',
  '<meta name="fast-app-date" content="2026-09-09T10:30:00-03:00">')

LATEST_UPDATE = ('2.3.26: Checkbox de seleção na tabela de Rotas — marque 2 ou mais rotas '
  'e o balão flutuante sobe na hora com o botão EXCLUIR para apagar todas de uma vez '
  '(arraste o balão para onde quiser; a posição fica gravada no aparelho); caixinha '
  'Marcar/desmarcar todas no cabeçalho; a coluna não atrapalha a ordenação (setas '
  'de ordenar continuam funcionando, inclusive a ordenação salva).')

m = re.search(r'<meta name="fast-latest-update" content="([^"]*)">', content)
must('meta latest-update', 1 if m else 0)
content = content[:m.start(1)] + LATEST_UPDATE + content[m.end(1):]

replace_once('meta changelog-immediate',
  '<meta name="fast-app-changelog-immediate" content="2.3.25">',
  '<meta name="fast-app-changelog-immediate" content="2.3.26">')

replace_once('r91 version',
  "if(m) m.content='2.3.25';",
  "if(m) m.content='2.3.26';")
replace_once('r91 date',
  "if(d) d.content='2026-09-08T22:30:00-03:00';",
  "if(d) d.content='2026-09-09T10:30:00-03:00';")
m = re.search(r"if\(l\) l\.content='2\.3\.25: Central Rapida[^']*';", content)
must('r91 latest-update', 1 if m else 0)
content = content[:m.start()] + "if(l) l.content='" + LATEST_UPDATE + "';" + content[m.end():]

replace_once('html data-fast-version',
  'data-fast-version="2.3.25">',
  'data-fast-version="2.3.26">')

# 9d) CHANGELOG META — 3 itens novos com &quot;
ITEM1 = ('2.3.26 (09/09/2026): caixinha de seleção na primeira coluna da tabela de Rotas '
  '— cada linha ganhou um checkbox para marcar rotas, com a caixinha '
  'Marcar/desmarcar todas no cabeçalho.')
ITEM2 = ('2.3.26 (09/09/2026): ao marcar 2 ou mais rotas, o balão flutuante sobe '
  'automaticamente com o contador e o botão EXCLUIR para apagar todas de uma vez '
  '(com resumo de cliente/data e valor total antes de confirmar); o balão pode ser '
  'arrastado para qualquer ponto da tela e a posição fica gravada no aparelho.')
ITEM3 = ('2.3.26 (09/09/2026): a nova coluna não quebra nada — a ordenação pelas '
  'setas dos cabeçalhos continua funcionando e a ordenação salva do usuário '
  'migrou automaticamente para os novos índices.')

def enc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')

NEW_ITEMS = ('[{&quot;type&quot;:&quot;novo&quot;,&quot;text&quot;:&quot;' + enc(ITEM1) + '&quot;},'
             '{&quot;type&quot;:&quot;novo&quot;,&quot;text&quot;:&quot;' + enc(ITEM2) + '&quot;},'
             '{&quot;type&quot;:&quot;melhorado&quot;,&quot;text&quot;:&quot;' + enc(ITEM3) + '&quot;},')
replace_once('changelog meta novos itens',
  '<meta name="fast-app-changelog" content="[',
  '<meta name="fast-app-changelog" content="' + NEW_ITEMS)

# 9e) PAINEL ESTÁTICO fastUpdatesBody — substituição integral
#      (âncora de fim com 4 divs de fechamento, única no arquivo)
def fup_item(typ, text):
    if typ == 'novo':
        color, bg, icon, label = '#16a34a', 'rgba(22,163,74,0.10)', 'fa-solid fa-circle-plus', 'Novo'
    else:
        color, bg, icon, label = '#2563eb', 'rgba(37,99,235,0.10)', 'fa-solid fa-arrow-up', 'Melhorado'
    return ('<div class="fup-item"><div class="fup-item-dot" style="background:' + bg + ';"><i class="' + icon + '" style="color:' + color + ';"></i></div>'
            '<div class="fup-item-content"><span class="fup-item-badge" style="color:' + color + ';background:' + bg + ';">' + label + '</span>'
            '<div class="fup-item-text">' + text + '</div></div></div>')

PANEL_OPEN = '<div class="fast-updates-panel-body" id="fastUpdatesBody">'
PANEL_END_ANCHOR = 'EM ROTA/CONCLUIDA.</div></div></div></div>'
must('painel início', content.count(PANEL_OPEN), 1)
must('painel fim (âncora 4 divs)', content.count(PANEL_END_ANCHOR), 1)

ps = content.find(PANEL_OPEN)
pe = content.find(PANEL_END_ANCHOR, ps) + len(PANEL_END_ANCHOR)
old_panel = content[ps:pe]
# sanidade: painel antigo contém exatamente 1 header de versão e 5 "2.3.25"
assert old_panel.count('fup-version-header') == 1, 'painel: header count'
assert old_panel.count('2.3.25') == 5, 'painel: 2.3.25 count = %d' % old_panel.count('2.3.25')

PANEL_NEW = (PANEL_OPEN
  + '<div class="fup-version-header"><div class="fup-version-row"><i class="fa-solid fa-sparkles"></i> <span>Versão 2.3.26</span></div>'
  + '<div class="fup-date-row"><i class="fa-solid fa-clock"></i> <span>Lançada em 09/09/2026 10:30</span></div></div>'
  + fup_item('novo', ITEM1) + fup_item('novo', ITEM2) + fup_item('melhorado', ITEM3)
  + '</div>')
content = content[:ps] + PANEL_NEW + content[pe:]

# também o contador estático do painel (8 → 3 itens da versão corrente)
replace_once('painel count',
  '<span class="fup-count" id="fastUpdatesCount">8</span>',
  '<span class="fup-count" id="fastUpdatesCount">3</span>')

# ============================================================
# 9f/9g) REPLACE GLOBAL DE VERSÃO — com máscara no changelog meta
#        (os 4 itens históricos "2.3.25 (" precisam continuar 2.3.25)
#        e nos comentários históricos de revisão (r141/2.3.25,
#        r140 / 2.3.25 ×2), que seguem a convenção do repo
#        (ex.: "r138/2.3.23" permanece 2.3.23 no arquivo atual).
# ============================================================
MASK = '\x00R142MASK\x00'
cl = re.search(r'(<meta name="fast-app-changelog" content=")([^"]*)(")', content)
must('changelog meta pós-inserção', 1 if cl else 0)
cl_raw = cl.group(2)
content = content[:cl.start(2)] + MASK + content[cl.end(2):]

# protege comentários históricos de revisão: "r141/2.3.25" e "r140 / 2.3.25" (×2)
# (convenção do repo: comentários de revisão mantêm a versão da época,
#  ex.: "r138/2.3.23" permanece 2.3.23 no arquivo atual)
rev_labels = [('r141/2.3.25', content.count('r141/2.3.25')),
              ('r140 / 2.3.25', content.count('r140 / 2.3.25'))]
total_rev = sum(c for _, c in rev_labels)
if total_rev != 3:
    print(f'FALHA: comentários de revisão 2.3.25: {rev_labels} (esperado total 3)')
    sys.exit(1)
content = content.replace('r141/2.3.25', 'r141/\x00R25\x00').replace('r140 / 2.3.25', 'r140 / \x00R25\x00')

before = content.count(OLD_VERSION)
content = content.replace(OLD_VERSION, NEW_VERSION)
after = content.count(OLD_VERSION)
print(f'ok replace global: {before} ocorrências -> restam {after} (masked)')

# restaura os comentários de revisão históricos
content = content.replace('r141/\x00R25\x00', 'r141/2.3.25').replace('r140 / \x00R25\x00', 'r140 / 2.3.25')

# restaura o changelog meta (4 itens históricos 2.3.25 preservados)
must('máscara principal única', content.count(MASK), 1)
content = content.replace(MASK, cl_raw, 1)

remaining = content.count(OLD_VERSION)
# 4 históricos "2.3.25 (" do changelog + 3 comentários de revisão (r141 + r140×2)
if remaining != 7:
    print(f'FALHA: restam {remaining} ocorrências de 2.3.25 (esperado: 4 do changelog + 3 comentários)')
    for m in re.finditer('2\\.3\\.25', content):
        print('  ...', repr(content[max(0,m.start()-50):m.start()+30]))
    sys.exit(1)
print('ok versão: restam exatamente 7 ocorrências históricas (4 changelog + 3 comentários)')

# ============================================================
# 10) SANIDADE FINAL + GRAVAÇÃO
# ============================================================
# floatingRotasBox: 1x HTML do balão + 1x rotAtualizarBoxSelecao + 1x bind drag + 1x trocarAba = 4
assert content.count('floatingRotasBox') == 4, 'floatingRotasBox: %d' % content.count('floatingRotasBox')
# rot-sel-linha: 1x template JS + 450x estáticas + 4x querySelectorAll (rot*) = 455
assert content.count('rot-sel-linha') == 455, 'rot-sel-linha: %d' % content.count('rot-sel-linha')
assert 'rotExcluirSelecionados' in content
assert 'fast_sort_m142' in content
assert NEW_DATE_ISO in content
# OLD_DATE_ISO: meta (L25) e r91 (L56696) trocadas; resta 1 comentário-exemplo do r140 (L41633)
assert content.count(OLD_DATE_ISO) == 1, 'OLD_DATE_ISO restante: %d' % content.count(OLD_DATE_ISO)
assert 'Versão 2.3.26</span>' in content

open(SRC, 'w', encoding='utf-8').write(content)
print(f'ok gravado: {orig_len} -> {len(content)} bytes ({len(content)-orig_len:+d})')
print('PATCH R142 CONCLUÍDO')
