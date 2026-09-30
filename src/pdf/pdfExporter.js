import { PDFDocument } from 'pdf-lib';
import { PenTool } from '../tools/PenTool';
import { TextTool } from '../tools/TextTool';
import { RulerModel } from '../geometry/Ruler';
import { ProtractorModel } from '../geometry/Protractor';
import { CompassModel } from '../geometry/Compass';
import { SetSquareModel } from '../geometry/SetSquares';
import { AngleMeasureModel } from '../geometry/AngleMeasure';
import { LineModel, CircleModel, ArcModel } from '../geometry/Shapes';

/**
 * Render all annotations and geometry objects for a page onto an offscreen canvas
 */
function renderPageToOffscreenCanvas(pageData, width, height, dpr = 2) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Render annotations (Pen, Highlighter, Text)
  if (pageData && pageData.annotations) {
    for (const ann of pageData.annotations) {
      if (ann.type === 'pen' || ann.type === 'highlighter') {
        PenTool.drawStroke(ctx, ann);
      } else if (ann.type === 'text') {
        TextTool.drawText(ctx, ann, false);
      }
    }
  }

  // Render geometry objects
  if (pageData && pageData.geometryObjects) {
    for (const obj of pageData.geometryObjects) {
      switch (obj.type) {
        case 'ruler':
          RulerModel.draw(ctx, obj, false);
          break;
        case 'protractor':
          ProtractorModel.draw(ctx, obj, false);
          break;
        case 'compass':
          CompassModel.draw(ctx, obj, false);
          break;
        case 'setSquare45':
        case 'setSquare60':
          SetSquareModel.draw(ctx, obj, false);
          break;
        case 'angle':
          AngleMeasureModel.draw(ctx, obj, false);
          break;
        case 'line':
          LineModel.draw(ctx, obj, false);
          break;
        case 'circle':
          CircleModel.draw(ctx, obj, false);
          break;
        case 'arc':
          ArcModel.draw(ctx, obj, false);
          break;
      }
    }
  }

  return canvas;
}

/**
 * Export completed project as Solved_Mathematics.pdf
 */
export async function exportCompletedPdf({
  pdfArrayBuffer,
  pagesData,
  totalPages = 1,
  defaultDimensions = { width: 595.28, height: 841.89 }
}) {
  try {
    let pdfDoc;

    if (pdfArrayBuffer) {
      // Load copy of original PDF
      pdfDoc = await PDFDocument.load(pdfArrayBuffer);
    } else {
      // Create new blank PDF document
      pdfDoc = await PDFDocument.create();
      for (let i = 0; i < totalPages; i++) {
        pdfDoc.addPage([defaultDimensions.width, defaultDimensions.height]);
      }
    }

    const pages = pdfDoc.getPages();

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageNum = i + 1;
      const { width, height } = page.getSize();
      const pageData = pagesData[pageNum];

      // If page has annotations or geometry objects, composite them
      if (pageData && ((pageData.annotations && pageData.annotations.length > 0) ||
                       (pageData.geometryObjects && pageData.geometryObjects.length > 0))) {
        const offscreenCanvas = renderPageToOffscreenCanvas(pageData, width, height, 2);
        const dataUrl = offscreenCanvas.toDataURL('image/png');
        const pngBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
        const pngImage = await pdfDoc.embedPng(pngBytes);

        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: width,
          height: height
        });
      }
    }

    // Embed editable GeoCanvas layer metadata so re-importing allows full vector editing/erasing
    try {
      const geocanvasData = {
        version: 1,
        hasAnnotationOverlay: true,
        pagesData,
        totalPages,
        exportedAt: new Date().toISOString()
      };
      const jsonStr = JSON.stringify(geocanvasData);
      const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
      pdfDoc.setSubject('GEOCANVAS_DATA:' + encoded);

      // Also attach JSON file to the PDF as attachment for maximum compatibility
      const encoder = new TextEncoder();
      await pdfDoc.attach(encoder.encode(jsonStr), 'geocanvas_layers.json', {
        mimeType: 'application/json',
        description: 'GeoCanvas Editable Vector Layers'
      });
    } catch (metaErr) {
      console.warn('Could not embed vector layer metadata into PDF:', metaErr);
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const downloadUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'Solved_Mathematics.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    return { success: true };
  } catch (err) {
    console.error('PDF Export Error:', err);
    return {
      success: false,
      error: 'Failed to export PDF. Please ensure your browser supports PDF generation.'
    };
  }
}