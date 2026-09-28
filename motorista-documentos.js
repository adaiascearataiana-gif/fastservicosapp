(function () {
  'use strict';
  var pdfLoader;
  var ocrLoader;
  function loadOCR() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!ocrLoader) ocrLoader = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = function () { window.Tesseract ? resolve(window.Tesseract) : reject(Error('Leitor OCR indisponível.')); };
      script.onerror = function () { reject(Error('Sem acesso ao leitor de imagens. Verifique a conexão.')); };
      document.head.appendChild(script);
    }).catch(function (error) { ocrLoader = null; throw error; });
    return ocrLoader;
  }
  function loadPdf() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfLoader) pdfLoader = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = function () {
        if (!window.pdfjsLib) return reject(Error('Biblioteca de PDF indisponível.'));
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = function () { reject(Error('Sem acesso ao leitor de PDF. Conecte-se à internet e tente novamente.')); };
      document.head.appendChild(script);
    }).catch(function (error) { pdfLoader = null; throw error; });
    return pdfLoader;
  }
  function decodePdf(data) {
    var raw = atob(String(data).split(',')[1] || '');
    return Uint8Array.from(raw, function (c) { return c.charCodeAt(0); });
  }
  async function parsePdf(data) {
    var lib = await loadPdf();
    var doc = await lib.getDocument({data: decodePdf(data)}).promise;
    var text = [], canvas;
    for (var index = 1; index <= Math.min(doc.numPages, 3); index++) {
      var page = await doc.getPage(index);
      var content = await page.getTextContent();
      text.push(content.items.map(function (item) { return item.str || ''; }).join(' '));
      if (index === 1) {
        var viewport = page.getViewport({scale: 2});
        canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({canvasContext: canvas.getContext('2d'), viewport: viewport}).promise;
      }
    }
    return {text: text.join('\n'), image: canvas.toDataURL('image/jpeg', .88)};
  }
  var originalImageData = window.motImagemData;
  window.motImagemData = async function (file) {
    if (file.type !== 'application/pdf') return originalImageData(file);
    if (file.size > 9 * 1024 * 1024) throw Error('PDF muito grande. Envie um arquivo de até 9 MB.');
    var data = await new Promise(function (resolve, reject) {
      var reader = new FileReader(); reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
    var page = await parsePdf(data);
    var image = await fetch(page.image).then(function (r) { return r.blob(); });
    var quality = await originalImageData(new File([image], 'pagina.jpg', {type: 'image/jpeg'}));
    return Object.assign(quality, {data: data});
  };
  window.motAbrirCamera = async function (box) {
    window.MOT_CAMERA.box = box;
    var status = box.querySelector('.mot-doc-status');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      status.textContent = 'Câmera ao vivo indisponível neste navegador. Use a opção Abrir câmera do Android.';
      showNativeCapture(box);
      return;
    }
    try {
      var stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: window.MOT_CAMERA.facing}}, audio: false});
      window.MOT_CAMERA.stream = stream;
      var video = document.getElementById('motCameraVideo');
      video.srcObject = stream;
      await video.play();
      document.getElementById('motCameraModal').classList.remove('hide');
    } catch (error) {
      if (window.MOT_CAMERA.stream) window.MOT_CAMERA.stream.getTracks().forEach(function (track) { track.stop(); });
      window.MOT_CAMERA.stream = null;
      status.textContent = error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError'
        ? 'Acesso à câmera negado. Libere a câmera nas permissões do Android ou do site e tente novamente.'
        : 'Não foi possível iniciar a câmera ao vivo. Tente a câmera nativa abaixo.';
      showNativeCapture(box);
    }
  };
  function showNativeCapture(box) {
    var button = box.querySelector('[data-native-camera]');
    if (!button) {
      var input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; input.hidden = true;
      input.addEventListener('change', function () {
        if (input.files && input.files[0]) window.motAnalisarDocumento(box, input.files[0]);
      });
      button = document.createElement('button');
      button.type = 'button'; button.dataset.nativeCamera = '1'; button.className = 'mot-doc-read';
      button.textContent = 'Abrir câmera do Android';
      button.addEventListener('click', function () { input.click(); });
      box.append(input, button);
    }
    button.hidden = false;
  }
  window.motLerDocumento = async function (kind, data, status) {
    if (!data) { status.textContent = 'Selecione o documento antes de tocar em LER ARQUIVO.'; return; }
    status.textContent = 'Lendo o arquivo…';
    try {
      var text = '';
      if (/^data:application\/pdf/i.test(data)) {
        var pdf = await parsePdf(data);
        text = pdf.text;
        if (text.replace(/\s/g, '').length < 35) {
          var pdfOCR = await loadOCR();
          text = (await pdfOCR.recognize(pdf.image, 'por')).data.text || '';
        }
      } else {
        var imageOCR = await loadOCR();
        text = (await imageOCR.recognize(data, 'por')).data.text || '';
      }
      if (text) {
        window.motAplicarOCR(kind, text);
        status.textContent = 'Leitura concluída. Confira os dados preenchidos com o documento original.';
      } else status.textContent = 'Nenhum dado reconhecido. Preencha manualmente e confira o arquivo.';
    } catch (error) {
      status.textContent = 'Leitura indisponível: ' + (error.message || 'verifique a conexão e tente novamente.');
    }
  };
  function fill(id, value) {
    var field = document.getElementById(id);
    if (!field || !value || String(field.value || '').trim()) return;
    field.value = String(value).trim();
    field.dispatchEvent(new Event('input', {bubbles: true}));
    field.dispatchEvent(new Event('change', {bubbles: true}));
  }
  function capture(text, expression) { return (text.match(expression) || [])[1] || ''; }
  function dateFrom(text) {
    var match = text.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
    if (!match) return '';
    var iso = match[3] + '-' + match[2] + '-' + match[1];
    var date = new Date(iso + 'T12:00:00');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : '';
  }
  var originalApply = window.motAplicarOCR;
  window.motAplicarOCR = function (kind, raw) {
    var text = String(raw || '').replace(/\s+/g, ' ').toUpperCase();
    if (kind === 'address') {
      var cep = capture(text, /\b(\d{5}[- ]?\d{3})\b/);
      fill('motCadCep', cep);
      if (cep && typeof window.motBuscarCep === 'function') window.motBuscarCep();
      fill('motCadEndereco', capture(text, /(?:RUA|AVENIDA|AV\.|TRAVESSA|ALAMEDA)\s+([A-ZÀ-Ü0-9 .-]{5,70}?)(?=\s*(?:N[º°.]|NÚMERO|BAIRRO|CEP|CIDADE|$))/));
      return;
    }
    if (kind === 'cnh') {
      var documentCpf = capture(text, /\bCPF\s*[:.-]?\s*(\d{3}[. ]?\d{3}[. ]?\d{3}[- ]?\d{2})\b/).replace(/\D/g, '');
      var typedCpf = (document.getElementById('motCadCpf') || {}).value || '';
      if (documentCpf && typedCpf.replace(/\D/g, '') !== documentCpf) {
        var warning = document.getElementById('motCadMsg');
        if (warning) warning.textContent = 'CPF lido na CNH diferente do cadastro. Confira o documento e corrija os dados.';
        window.MOT_DOCUMENT_MISMATCH = true;
      } else if (documentCpf) window.MOT_DOCUMENT_MISMATCH = false;
      fill('motCadCnh', capture(text, /(?:N[º°.]?\s*REGISTRO|REGISTRO|CNH)\s*[:.-]?\s*(\d{9,11})\b/));
      fill('motCadCnhCategoria', capture(text, /(?:CAT(?:EGORIA)?\s*(?:HAB(?:ILITAÇÃO)?)?|CATEGORIA)\s*[:.-]?\s*(ACC|AE|AD|AC|AB|A|B|C|D|E)\b/));
      var after = capture(text, /(?:VALIDADE|VÁLIDA ATÉ|VENCIMENTO)\s*[:.-]?\s*(\d{2}[./-]\d{2}[./-]\d{4})/);
      fill('motCadVal', dateFrom(after));
      return;
    }
    if (kind === 'crlv') {
      fill('motCadPlaca', capture(text, /(?:PLACA)\s*[:.-]?\s*([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\b/));
      fill('motCadRenavam', capture(text, /(?:RENAVAM|CÓD(?:IGO)?\s*RENAVAM)\s*[:.-]?\s*(\d{11})\b/));
      fill('motCadVeiculo', capture(text, /(?:MARCA\s*\/\s*MODELO|MARCA\/MODELO|MODELO)\s*[:.-]?\s*([A-Z0-9 /.-]{3,55}?)(?=\s*(?:ANO|COR|PLACA|RENAVAM|$))/));
      fill('motCadAno', capture(text, /(?:ANO\s*(?:DE\s*)?(?:FABRICAÇÃO|FABRICACAO|MODELO))\s*[:.-]?\s*(\d{4})\b/));
      fill('motCadCor', capture(text, /(?:COR\s*(?:PREDOMINANTE)?)\s*[:.-]?\s*([A-ZÀ-Ü]{3,20})\b/));
      return;
    }
    originalApply(kind, raw);
  };
  var originalStepValidation = window.motValidarEtapa;
  window.motValidarEtapa = function (step) {
    var hasDifferentWhatsApp = document.getElementById('motWaNao');
    if (step === 0 && hasDifferentWhatsApp && hasDifferentWhatsApp.checked) {
      var otherPhone = document.getElementById('motCadWhatsApp');
      if (!otherPhone || otherPhone.value.replace(/\D/g, '').length < 10) {
        document.getElementById('motCadMsg').textContent = 'Informe o WhatsApp com DDD ou marque Sim.';
        if (otherPhone) otherPhone.focus();
        return false;
      }
    }
    if (step === 1 && window.MOT_DOCUMENT_MISMATCH) {
      document.getElementById('motCadMsg').textContent = 'CPF da CNH diferente do CPF informado. Leia novamente o documento ou revise o cadastro.';
      return false;
    }
    return originalStepValidation(step);
  };
  var originalProfile = window.motPerfil;
  window.motPerfil = function (status) {
    var profile = originalProfile(status);
    var different = document.getElementById('motWaNao');
    profile.whatsapp = different && different.checked ? document.getElementById('motCadWhatsApp').value : profile.telefone;
    return profile;
  };
  function init() {
    var registration = document.querySelector('#motCadastro .gate-brand');
    if (registration && !document.getElementById('motDocReviewNote')) {
      var note = document.createElement('p'); note.id = 'motDocReviewNote';
      note.textContent = 'A leitura ajuda a preencher o cadastro. Os documentos serão conferidos pelo administrador antes da aprovação.';
      note.style.cssText = 'font-size:12px;line-height:1.5;color:#cbd5e1;margin:8px 0 12px';
      registration.appendChild(note);
    }
    document.querySelectorAll('.mot-doc[data-ocr]').forEach(function (box) {
      if (box.querySelector('[data-read]')) return;
      if (box.dataset.doc === 'cnh') box.querySelector('[data-remove]').addEventListener('click', function () { window.MOT_DOCUMENT_MISMATCH = false; });
      var button = document.createElement('button');
      button.type = 'button'; button.dataset.read = '1'; button.className = 'mot-doc-read';
      button.innerHTML = '<i class="fa-solid fa-file-lines"></i> LER ARQUIVO';
      button.addEventListener('click', function () {
        var doc = (window.MOT_DOCS || {})[box.dataset.doc];
        window.motLerDocumento(box.dataset.ocr, doc && doc.data, box.querySelector('.mot-doc-status'));
      });
      var actions = box.querySelector('.mot-doc-actions');
      if (actions) actions.insertAdjacentElement('afterend', button);
    });
    var cpf = document.getElementById('motCadCpf');
    var renavam = document.getElementById('motCadRenavam');
    if (cpf) { cpf.maxLength = 11; cpf.addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 11); }); }
    if (renavam) { renavam.maxLength = 11; renavam.addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 11); }); }
    var plate = document.getElementById('motCadPlaca');
    if (plate) { plate.maxLength = 7; plate.addEventListener('input', function () { this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7); }); }
    if (cpf && !document.getElementById('motCpfReceita')) {
      var link = document.createElement('a'); link.id = 'motCpfReceita';
      link.href = 'https://servicos.receita.fazenda.gov.br/Servicos/CPF/ConsultaSituacao/ConsultaPublica.asp';
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = 'Consultar situação do CPF na Receita Federal';
      cpf.closest('.gate-field').appendChild(link);
    }
    var phone = document.getElementById('motCadTel');
    if (phone && !document.getElementById('motWhatsAppChoice')) {
      var choice = document.createElement('div');
      choice.id = 'motWhatsAppChoice'; choice.className = 'gate-field';
      choice.innerHTML = '<label>Este telefone é WhatsApp?</label><div style="display:flex;gap:16px;padding:8px 0"><label><input type="radio" name="motUsaWhatsApp" id="motWaSim" checked> Sim</label><label><input type="radio" name="motUsaWhatsApp" id="motWaNao"> Não</label></div><div id="motWaOutro" hidden><label for="motCadWhatsApp">Número do WhatsApp *</label><input id="motCadWhatsApp" type="tel" autocomplete="tel" inputmode="tel" placeholder="DDD e número"></div>';
      phone.closest('.gate-field').insertAdjacentElement('afterend', choice);
      choice.addEventListener('change', function () { document.getElementById('motWaOutro').hidden = !document.getElementById('motWaNao').checked; });
    }
    var style = document.createElement('style');
    style.textContent = '.mot-doc-read{width:100%;min-height:42px;border:1px solid #60a5fa;border-radius:10px;margin-top:8px;background:#1d4ed8;color:white;font-weight:800;cursor:pointer}.mot-doc-read:focus-visible{outline:3px solid #f59e0b}#motCpfReceita{display:inline-block;color:#93c5fd;margin-top:7px;font-size:12px}';
    document.head.appendChild(style);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); }); else setTimeout(init, 0);
})();
