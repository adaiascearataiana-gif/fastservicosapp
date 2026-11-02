const test = require('node:test');
const assert = require('node:assert/strict');
const PDFLib = require('./vendor/pdf-lib.min.js');
const { removeFirstTwo } = require('./pdf-ops');

test('removes exactly the first two pages, retaining order and original', async () => {
  const input = await PDFLib.PDFDocument.create();
  for (let i = 1; i <= 5; i++) {
    const page = input.addPage([200 + i, 300]);
    page.drawText(`Hino ${i}`);
  }
  const original = await input.save();
  const { bytes, originalPages, remainingPages } = await removeFirstTwo(original, PDFLib);
  const result = await PDFLib.PDFDocument.load(bytes);
  assert.equal(originalPages, 5);
  assert.equal(remainingPages, 3);
  assert.deepEqual(result.getPages().map(page => page.getWidth()), [203, 204, 205]);
  assert.equal((await PDFLib.PDFDocument.load(original)).getPageCount(), 5);
});
test('refuses to produce an empty document', async () => {
  const input = await PDFLib.PDFDocument.create();
  input.addPage(); input.addPage();
  await assert.rejects(removeFirstTwo(await input.save(), PDFLib), /pelo menos três páginas/);
});
