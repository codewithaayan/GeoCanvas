import React from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { useStore } from '../state/StoreContext';
import { IconClose } from '../assets/math-icons';

export default function SampleDocumentModal({ isOpen, onClose }) {
  const { loadPdf } = useStore();

  if (!isOpen) return null;

  const createEuclideanWorksheet = async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);

    // Title
    page.drawText('MATHEMATICS WORKSHEET: GEOMETRIC CONSTRUCTIONS', {
      x: 50,
      y: 790,
      size: 15,
      font,
      color: rgb(0.1, 0.2, 0.5)
    });

    page.drawLine({
      start: { x: 50, y: 780 },
      end: { x: 545, y: 780 },
      thickness: 1.5,
      color: rgb(0.2, 0.3, 0.6)
    });

    // Question 1
    page.drawText('Question 1: Angle Bisector Construction', {
      x: 50,
      y: 750,
      size: 12,
      font,
      color: rgb(0.1, 0.1, 0.1)
    });

    page.drawText('Using your compass and ruler, construct the angle bisector of the angle ABC shown below.', {
      x: 50,
      y: 730,
      size: 10,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2)
    });

    // Draw Angle ABC
    const bx = 120, by = 600;
    page.drawLine({ start: { x: bx, y: by }, end: { x: 320, y: by }, thickness: 2, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: bx, y: by }, end: { x: 260, y: 710 }, thickness: 2, color: rgb(0, 0, 0) });
    page.drawText('B', { x: bx - 15, y: by - 10, size: 12, font });
    page.drawText('C', { x: 330, y: by - 5, size: 12, font });
    page.drawText('A', { x: 265, y: 715, size: 12, font });

    // Question 2
    page.drawText('Question 2: Triangle Construction & Circumcircle', {
      x: 50,
      y: 520,
      size: 12,
      font,
      color: rgb(0.1, 0.1, 0.1)
    });

    page.drawText('Construct a triangle with side lengths 8.0 cm, 6.0 cm, and angle 60 degrees. Find its circumcenter.', {
      x: 50,
      y: 500,
      size: 10,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2)
    });

    // Page 2: Coordinate Geometry
    const page2 = pdfDoc.addPage([595.28, 841.89]);
    page2.drawText('COORDINATE GEOMETRY & CIRCLE EQUATIONS', {
      x: 50,
      y: 790,
      size: 15,
      font,
      color: rgb(0.1, 0.2, 0.5)
    });

    page2.drawText('Plot the circle with center (4, 3) and radius 5 cm. Determine the equation of the tangent at (0, 0).', {
      x: 50,
      y: 750,
      size: 10,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2)
    });

    const pdfBytes = await pdfDoc.save();
    await loadPdf(pdfBytes.buffer, 'Geometry_Worksheet.pdf');
    onClose();
  };

  const createCoordinateGridPdf = async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    page.drawText('CARTESIAN COORDINATE PLANE (1:1 SCALE)', {
      x: 50,
      y: 800,
      size: 13,
      font,
      color: rgb(0.15, 0.25, 0.45)
    });

    // Center origin (297.6, 420.9)
    const ox = 297.6, oy = 420.9;

    // Major Axes
    page.drawLine({ start: { x: 50, y: oy }, end: { x: 545, y: oy }, thickness: 2, color: rgb(0.1, 0.1, 0.1) });
    page.drawLine({ start: { x: ox, y: 70 }, end: { x: ox, y: 770 }, thickness: 2, color: rgb(0.1, 0.1, 0.1) });

    page.drawText('X', { x: 550, y: oy - 4, size: 10, font });
    page.drawText('Y', { x: ox - 4, y: 775, size: 10, font });
    page.drawText('O (0,0)', { x: ox + 6, y: oy - 14, size: 9, font });

    const pdfBytes = await pdfDoc.save();
    await loadPdf(pdfBytes.buffer, 'Cartesian_Grid.pdf');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 className="font-math-title" style={{ fontSize: '18px', color: 'var(--text-primary)' }}>
              Mathematics Worksheets & Templates
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Select a pre-loaded worksheet or start on blank mathematical drafting paper
            </span>
          </div>
          <button className="touch-btn" onClick={onClose} style={{ padding: '6px' }}>
            <IconClose size={18} />
          </button>
        </div>

        {/* Templates List */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          <div
            onClick={createEuclideanWorksheet}
            style={{
              padding: '14px 18px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'rgba(255, 255, 255, 0.03)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--math-blue)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
          >
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Euclidean Constructions Examination (2 Pages)
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Standard high school exam questions: angle bisectors, triangle circumcenter, and coordinate tangents.
              </p>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--math-cyan)' }}>Open &rarr;</span>
          </div>

          <div
            onClick={createCoordinateGridPdf}
            style={{
              padding: '14px 18px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'rgba(255, 255, 255, 0.03)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--math-blue)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
          >
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Cartesian Coordinate Plane (1:1 Metric)
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Centered origin with orthogonal axes for analytic geometry, vectors, and graphing.
              </p>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--math-cyan)' }}>Open &rarr;</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            className="touch-btn"
            onClick={onClose}
            style={{ fontSize: '12px', background: 'var(--border-color)', padding: '6px 14px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
