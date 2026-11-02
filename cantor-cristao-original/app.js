'use strict';
const fileInput = document.getElementById('pdf');
const save = document.getElementById('save');
const status = document.getElementById('status');
const filename = document.getElementById('filename');
const targetName = 'Cantor_Cristao_Tom_Original_Violao_Teclado_001-581.pdf';
let chosen = null;
function report(message, error = false) {
  status.textContent = message;
  status.hidden = false;
  status.classList.toggle('error', error);
}
async function selectFile(file) {
  chosen = null; save.disabled = true;
  if (!file) return;
  filename.textContent = file.name;
  if (!/\.pdf$/i.test(file.name)) { report('Selecione um arquivo .pdf.', true); return; }
  try {
    const prefix = new TextDecoder('ascii').decode(await file.slice(0, 5).arrayBuffer());
    if (prefix !== '%PDF-') { report('O arquivo não tem assinatura de PDF. Confirme o download no Google Drive.', true); return; }
    chosen = file;
    report(`PDF reconhecido · ${(file.size / (1024 * 1024)).toFixed(1)} MB. Confirme no índice se o conteúdo está completo antes de usar.`);
    save.disabled = false;
  } catch (_) { report('Não foi possível ler o arquivo selecionado.', true); }
}
fileInput.addEventListener('change', () => selectFile(fileInput.files[0]));
const drop = document.getElementById('drop');
['dragenter', 'dragover'].forEach(name => drop.addEventListener(name, event => { event.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(name => drop.addEventListener(name, event => { event.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', event => { const file = event.dataTransfer.files[0]; if (file) selectFile(file); });
drop.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); } });
save.addEventListener('click', () => {
  if (!chosen) return;
  const url = URL.createObjectURL(chosen);
  const a = document.createElement('a'); a.href = url; a.download = targetName;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});
