/* PDF processing happens locally; never sends the document anywhere. */
(function (root, factory) {
  const ops = factory();
  if (typeof module === 'object' && module.exports) module.exports = ops;
  else root.CantorPdfOps = ops;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  async function removeFirstTwo(source, pdfLib) {
    if (!pdfLib || !pdfLib.PDFDocument) throw new Error('Leitor de PDF indisponível. Reabra o app com todos os arquivos da pasta.');
    const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
    const pdf = await pdfLib.PDFDocument.load(bytes);
    const originalPages = pdf.getPageCount();
    if (originalPages <= 2) throw new Error('O PDF precisa ter pelo menos três páginas para remover as duas primeiras.');
    pdf.removePage(1);
    pdf.removePage(0);
    const result = await pdf.save();
    return { bytes: result, originalPages, remainingPages: pdf.getPageCount() };
  }
  return { removeFirstTwo };
});
