import { PDFDocument } from 'pdf-lib';
import { usePlainZeroFont } from '../geometry/plainZeroFont';
import { embedGeoCanvasLayers } from './geocanvasLayers';
import { PenTool } from '../tools/PenTool';
import { TextTool } from '../tools/TextTool';
import { RulerModel } from '../geometry/Ruler';
import { ProtractorModel } from '../geometry/Protractor';
import { CompassModel } from '../geometry/Compass';
import { SetSquareModel } from '../geometry/SetSquares';
import { AngleMeasureModel } from '../geometry/AngleMeasure';
import { LineModel, CircleModel, ArcModel } from '../geometry/Shapes';

/**
 * Read a CSS variable from the current theme (falls back to a default).
 */
function themeVar(name, fallback) {
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Draw the paper background and grid so exported blank pages look exactly
 * like the on-screen paper. Sizes match the CSS classes in index.css
 * (millimeter: 20px minor / 100px major, cartesian: 40px, isometric: 40 x 69.28).
 */
function drawPaperGrid(ctx, width, height, gridType) {
  const paper = themeVar('--paper-bg', '#ffffff');
  const major = themeVar('--grid-line-major', 'rgba(59, 130, 246, 0.25)');
  const minor = themeVar('--grid-line-minor', 'rgba(59, 130, 246, 0.1)');

  ctx.save();

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = 1;

  const vertical = (step, color) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let x = 0; x <= width; x += step) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    ctx.stroke();
  };

  const horizontal = (step, color) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let y = 0; y <= height; y += step) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
    ctx.stroke();
  };

  if (gridType === 'millimeter') {
    vertical(20, minor);
    horizontal(20, minor);
    vertical(100, major);
    horizontal(100, major);
  } else if (gridType === 'cartesian') {
    vertical(40, major);
    horizontal(40, major);
  } else if (gridType === 'isometric') {
    const rise = Math.tan(Math.PI / 6); // 30 degrees
    const spacing = 69.28 / 2;

    ctx.strokeStyle = minor;
    ctx.beginPath();
    for (
      let y0 = -width * rise;
      y0 <= height + width * rise;
      y0 += spacing
    ) {
      // 30 degree lines going down to the right
      ctx.moveTo(0, y0);
      ctx.lineTo(width, y0 + width * rise);
      // 150 degree lines going up to the right
      ctx.moveTo(0, y0 + width * rise);
      ctx.lineTo(width, y0);
    }
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Render paper grid (optional), annotations and geometry objects for a page
 * onto an offscreen canvas
 */
function renderPageToOffscreenCanvas(
  pageData,
  width,
  height,
  dpr = 2,
  paper = null
) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  const ctx = canvas.getContext('2d');
  usePlainZeroFont(ctx);
  ctx.scale(dpr, dpr);

  // Paper + grid first, so ink and tools draw on top of it
  if (paper) {
    drawPaperGrid(ctx, width, height, paper.gridType);
  }

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
  defaultDimensions = { width: 595.28, height: 841.89 },
  gridType = 'none',
  theme = 'paper'
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

    // Pages that received a picture of the ink/tools (needed to remove the
    // picture again when the file is re-imported for editing)
    const overlayPages = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageNum = i + 1;
      const { width, height } = page.getSize();
      const pageData = pagesData[pageNum];

      const hasContent =
        pageData &&
        ((pageData.annotations && pageData.annotations.length > 0) ||
          (pageData.geometryObjects && pageData.geometryObjects.length > 0));

      /*
       * The paper grid only belongs to BLANK workspaces. Imported PDFs are
       * opaque pages that already have their own background (on screen the
       * grid is hidden behind them too), so no grid is added to them.
       */
      const isBlankWorkspace = !pdfArrayBuffer;
      const paper =
        isBlankWorkspace && gridType !== 'none' ? { gridType } : null;

      // Composite the page when it has ink/tools OR needs the paper grid
      if (hasContent || paper) {
        const offscreenCanvas = renderPageToOffscreenCanvas(
          pageData,
          width,
          height,
          2,
          paper
        );
        const dataUrl = offscreenCanvas.toDataURL('image/png');
        const pngBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
        const pngImage = await pdfDoc.embedPng(pngBytes);

        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: width,
          height: height
        });

        overlayPages.push(pageNum);
      }
    }

    // Embed the editable GeoCanvas layers (compressed) so that re-importing
    // this PDF - even months later - brings every line, shape, text and
    // geometry tool back as an editable / erasable object.
    try {
      embedGeoCanvasLayers(pdfDoc, {
        version: 2,
        hasAnnotationOverlay: true,
        overlayPages,
        blankWorkspace: !pdfArrayBuffer,
        gridType,
        theme,
        pagesData,
        totalPages,
        exportedAt: new Date().toISOString()
      });
    } catch (metaErr) {
      console.warn('Could not embed editable layers into PDF:', metaErr);
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