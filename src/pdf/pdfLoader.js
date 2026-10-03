import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { readGeoCanvasLayers, stripGeoCanvasOverlay } from './geocanvasLayers';

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

    // Check for embedded GeoCanvas editable layers in the PDF
    let cleanData = data;
    let embeddedPagesData = null;
    let blankInfo = null;

    try {
      const pdfLibDoc = await PDFDocument.load(data.slice(0), { ignoreEncryption: true });
      const layers = readGeoCanvasLayers(pdfLibDoc);

      if (layers && layers.data && layers.data.pagesData) {
        const saved = layers.data;
        embeddedPagesData = saved.pagesData;

        // Remove the flattened picture of the ink so only the editable
        // vector layer remains (otherwise old lines could not be erased)
        stripGeoCanvasOverlay(pdfLibDoc, layers);

        const cleanBytes = await pdfLibDoc.save();
        cleanData = cleanBytes.buffer.slice(
          cleanBytes.byteOffset,
          cleanBytes.byteOffset + cleanBytes.byteLength
        );

        // Exported from a blank workspace: go back to the blank paper
        // (grid + theme) instead of treating it as an imported PDF
        if (saved.blankWorkspace) {
          const first = pdfLibDoc.getPages()[0];
          const size = first ? first.getSize() : { width: 595.28, height: 841.89 };

          blankInfo = {
            numPages: pdfLibDoc.getPageCount(),
            width: size.width,
            height: size.height,
            gridType: saved.gridType || 'none',
            theme: saved.theme || null
          };
        }
      }
    } catch (metaErr) {
      console.warn('Could not inspect embedded GeoCanvas layers:', metaErr);
    }

    if (blankInfo) {
      return {
        success: true,
        isBlankWorkspace: true,
        pdfDoc: null,
        numPages: blankInfo.numPages,
        fileName,
        arrayBuffer: null,
        naturalWidth: blankInfo.width,
        naturalHeight: blankInfo.height,
        embeddedPagesData,
        gridType: blankInfo.gridType,
        theme: blankInfo.theme
      };
    }

    // Hand pdf.js its own clone of cleanData so original remains intact
    const loadingTask = pdfjsLib.getDocument({ data: cleanData.slice(0) });
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
      arrayBuffer: cleanData,
      naturalWidth: viewport.width,
      naturalHeight: viewport.height,
      embeddedPagesData
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