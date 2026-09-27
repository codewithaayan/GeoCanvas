import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
try {
  // Vite URL import for worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url
  ).toString();
} catch (e) {
  // Fallback worker from CDN matching version
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

/**
 * Load and validate a PDF document from File or ArrayBuffer
 */
export async function loadPdfDocument(source, fileName = 'Document.pdf') {
  try {
    let data;
    if (source instanceof File || source instanceof Blob) {
      data = await source.arrayBuffer();
      fileName = source.name || fileName;
    } else if (source instanceof ArrayBuffer) {
      data = source;
    } else {
      throw new Error('Unsupported source format');
    }

    // Verify minimal PDF header (%PDF)
    const headerBytes = new Uint8Array(data.slice(0, 5));
    const headerStr = String.fromCharCode(...headerBytes);
    if (!headerStr.startsWith('%PDF')) {
      throw new Error('Invalid PDF header');
    }

    // IMPORTANT: pdf.js can transfer/detach the ArrayBuffer it's given
    // (it hands `data` off to its worker as a Transferable for speed).
    // We hand pdf.js its own CLONE and keep `data` intact, because
    // `data` is also returned below and later reused by pdf-lib for
    // saveProject()/exportPdf(). Without this clone, pdf.js silently
    // detaches the original buffer, and any later
    // `PDFDocument.load(pdfArrayBuffer)` call in pdfExporter.js/db.js
    // fails (or saves 0 bytes) even though the PDF opened/rendered fine.
    const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });
    const pdfDoc = await loadingTask.promise;

    if (!pdfDoc || pdfDoc.numPages <= 0) {
      throw new Error('Empty PDF document');
    }

    // Read first page natural dimensions (at 72 DPI canonical scale 1.0)
    const firstPage = await pdfDoc.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1.0 });

    return {
      success: true,
      pdfDoc,
      numPages: pdfDoc.numPages,
      fileName,
      arrayBuffer: data,
      naturalWidth: viewport.width,
      naturalHeight: viewport.height
    };
  } catch (err) {
    console.error('PDF Load Error:', err);
    return {
      success: false,
      error: 'Unable to open this PDF. The document may be corrupted or unsupported.'
    };
  }
}

/**
 * Render a specific PDF page to a canvas
 */
export async function renderPdfPage(pdfDoc, pageNum, canvas, scale = 1.0, dpr = window.devicePixelRatio || 1) {
  if (!pdfDoc || !canvas) return null;

  try {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: scale * dpr });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    await page.render(renderContext).promise;

    return {
      width: viewport.width / (scale * dpr),
      height: viewport.height / (scale * dpr)
    };
  } catch (err) {
    console.error(`Error rendering page ${pageNum}:`, err);
    throw err;
  }
}