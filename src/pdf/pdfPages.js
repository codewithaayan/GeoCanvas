import { PDFDocument } from 'pdf-lib';

/**
 * Remove one page (1-based) from a PDF and return the new PDF bytes
 * as an ArrayBuffer. The input buffer is never modified.
 */
export async function removePdfPage(arrayBuffer, pageNum) {
  const doc = await PDFDocument.load(arrayBuffer.slice(0), {
    ignoreEncryption: true
  });

  const count = doc.getPageCount();

  if (count <= 1) {
    throw new Error('A PDF needs at least one page.');
  }

  if (pageNum < 1 || pageNum > count) {
    throw new Error(`Page ${pageNum} does not exist in this PDF.`);
  }

  doc.removePage(pageNum - 1);

  const bytes = await doc.save();

  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  );
}