import React, { useEffect, useRef, useState } from 'react';
import { renderPdfPage } from '../pdf/pdfLoader';

export default function PdfLayer({ pdfDoc, currentPage, width, height, zoom }) {
  const canvasRef = useRef(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function render() {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        setIsRendering(true);
        const dpr = window.devicePixelRatio || 1;
        await renderPdfPage(pdfDoc, currentPage, canvasRef.current, zoom, dpr);
      } catch (err) {
        console.error('PdfLayer render error:', err);
      } finally {
        if (!isCancelled) {
          setIsRendering(false);
        }
      }
    }

    render();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, currentPage, zoom]);

  if (!pdfDoc) {
    return null; // In blank paper mode, no PDF canvas is needed
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: `${width}px`, height: `${height}px`, pointerEvents: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: `${width}px`,
          height: `${height}px`,
          pointerEvents: 'none'
        }}
      />
      {isRendering && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'rgba(15, 23, 42, 0.75)',
          color: '#38bdf8',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'monospace'
        }}>
          Rendering page {currentPage}...
        </div>
      )}
    </div>
  );
}
