/**
 * GeoCanvas editable-layer storage inside a PDF.
 *
 * On export the ink / tools are (1) painted into the page as a picture so any
 * PDF viewer shows them, and (2) saved as compressed JSON inside the PDF so
 * GeoCanvas can bring them back as editable objects later.
 *
 * On import the picture is removed again (together with its image data, so the
 * file does not grow every time) and the JSON becomes the live, editable layer.
 */
import {
  PDFName,
  PDFArray,
  PDFDict,
  PDFRawStream,
  decodePDFRawStream
} from 'pdf-lib';

const LAYER_KEY = 'GeoCanvasData';
const LEGACY_PREFIX = 'GEOCANVAS_DATA:';

/** Save the editable layers as a compressed stream in the PDF catalog. */
export function embedGeoCanvasLayers(pdfDoc, payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const stream = pdfDoc.context.flateStream(bytes);
  const ref = pdfDoc.context.register(stream);
  pdfDoc.catalog.set(PDFName.of(LAYER_KEY), ref);
  pdfDoc.setSubject('GeoCanvas editable layers embedded');
}

/**
 * Read embedded layers. Returns { data, ref } or null.
 * Also understands the older format that stored base64 in the Subject field.
 */
export function readGeoCanvasLayers(pdfLibDoc) {
  try {
    const ref = pdfLibDoc.catalog.get(PDFName.of(LAYER_KEY));
    if (ref) {
      const obj = pdfLibDoc.context.lookup(ref);
      if (obj instanceof PDFRawStream) {
        const text = new TextDecoder().decode(
          decodePDFRawStream(obj).decode()
        );
        return { data: JSON.parse(text), ref, legacy: false };
      }
    }
  } catch (err) {
    console.warn('Could not read GeoCanvas layer stream:', err);
  }

  try {
    const subject = pdfLibDoc.getSubject();
    if (subject && subject.startsWith(LEGACY_PREFIX)) {
      const json = decodeURIComponent(
        escape(atob(subject.slice(LEGACY_PREFIX.length)))
      );
      return { data: JSON.parse(json), ref: null, legacy: true };
    }
  } catch (err) {
    console.warn('Could not read legacy GeoCanvas layers:', err);
  }

  return null;
}

function removeLastContentStream(pdfLibDoc, page, requireImageDraw) {
  const context = pdfLibDoc.context;
  const contents = page.node.Contents();
  if (!contents) return false;

  // Page whose only content is the overlay
  if (!(contents instanceof PDFArray)) {
    return false;
  }

  const count = contents.size();
  if (count === 0) return false;

  const lastRef = contents.get(count - 1);
  const stream = contents.lookup(count - 1);

  let imageName = null;
  try {
    if (stream instanceof PDFRawStream) {
      const text = new TextDecoder('latin1').decode(
        decodePDFRawStream(stream).decode()
      );
      const match = text.match(/\/([^\s/]+)\s+Do/);
      if (match) imageName = match[1];
    }
  } catch {}

  // Never remove something that is not clearly our picture
  if (requireImageDraw && !imageName) return false;

  // Remove the picture's image data from the page resources
  if (imageName) {
    try {
      const resources = page.node.Resources();
      const xobjects = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict);
      if (xobjects) {
        const imageRef = xobjects.get(PDFName.of(imageName));
        xobjects.delete(PDFName.of(imageName));
        if (imageRef && imageRef.tag !== undefined) context.delete(imageRef);
      }
    } catch {}
  }

  contents.remove(count - 1);
  if (lastRef && lastRef.tag !== undefined) context.delete(lastRef);
  return true;
}

function streamText(stream) {
  try {
    if (stream instanceof PDFRawStream) {
      return new TextDecoder('latin1')
        .decode(decodePDFRawStream(stream).decode())
        .trim();
    }
  } catch {}
  return null;
}

/**
 * pdf-lib wraps existing page content in an empty "q" ... "Q" pair every time
 * it draws on a page. Remove those leftover pairs so they do not pile up over
 * many export/import cycles.
 */
function removeEmptyWrapperPairs(pdfLibDoc, page) {
  const contents = page.node.Contents();
  if (!(contents instanceof PDFArray)) return;

  while (contents.size() >= 2) {
    const last = contents.size() - 1;
    if (
      streamText(contents.lookup(0)) !== 'q' ||
      streamText(contents.lookup(last)) !== 'Q'
    ) {
      break;
    }

    const firstRef = contents.get(0);
    const lastRef = contents.get(last);

    contents.remove(last);
    contents.remove(0);

    if (firstRef && firstRef.tag !== undefined) pdfLibDoc.context.delete(firstRef);
    if (lastRef && lastRef.tag !== undefined) pdfLibDoc.context.delete(lastRef);
  }
}

/**
 * Remove the exported overlay pictures and the embedded JSON so the PDF is
 * clean again. `layers` is what readGeoCanvasLayers returned.
 */
export function stripGeoCanvasOverlay(pdfLibDoc, layers) {
  const data = layers.data || {};
  const pages = pdfLibDoc.getPages();

  if (Array.isArray(data.overlayPages)) {
    for (const pageNum of data.overlayPages) {
      const page = pages[pageNum - 1];
      if (page) removeLastContentStream(pdfLibDoc, page, true);
    }
  } else if (data.hasAnnotationOverlay) {
    // Older exports: remove the last stream when the page has more than one
    for (const page of pages) {
      const contents = page.node.Contents();
      if (contents && typeof contents.size === 'function' && contents.size() > 1) {
        removeLastContentStream(pdfLibDoc, page, false);
      }
    }
  }

  for (const page of pages) {
    removeEmptyWrapperPairs(pdfLibDoc, page);
  }

  if (layers.ref) {
    pdfLibDoc.catalog.delete(PDFName.of(LAYER_KEY));
    pdfLibDoc.context.delete(layers.ref);
  }
  try {
    pdfLibDoc.setSubject('');
  } catch {}
}