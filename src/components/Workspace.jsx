
import React, { useEffect, useRef, useState } from 'react';

import { useStore } from '../state/StoreContext';

import PdfLayer from './PdfLayer';
import AnnotationLayer from './AnnotationLayer';
import GeometryLayer from './GeometryLayer';

export default function Workspace() {
  const {
    pdfDoc,
    currentPage,
    pageDimensions,
    zoom,
    pan,
    setPan,
    gridType,
    fitPage,
    statusMessage,
    activeTool
  } = useStore();

  const containerRef = useRef(null);
  const stageRef = useRef(null);

  const [isPanning, setIsPanning] = useState(false);

  const panStartRef = useRef({
    x: 0,
    y: 0
  });

  /*
   * -------------------------------------------------------
   * PAGE DIMENSIONS
   * -------------------------------------------------------
   */

  const pageWidth = Number(pageDimensions.width) || 595.28;
  const pageHeight = Number(pageDimensions.height) || 841.89;

  const safeZoom =
    Number.isFinite(zoom) && zoom > 0
      ? zoom
      : 1;

  const renderedWidth = pageWidth * safeZoom;
  const renderedHeight = pageHeight * safeZoom;

  /*
   * -------------------------------------------------------
   * FIT PAGE
   * -------------------------------------------------------
   */

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width <= 0 || height <= 0) {
      return;
    }

    fitPage(width, height);
  }, [
    pageDimensions.width,
    pageDimensions.height,
    fitPage
  ]);

  /*
   * -------------------------------------------------------
   * WINDOW RESIZE
   * -------------------------------------------------------
   */

  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width <= 0 || height <= 0) {
        return;
      }

      fitPage(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [fitPage]);

  /*
   * -------------------------------------------------------
   * PAN
   * -------------------------------------------------------
   */

  const handlePointerDown = (event) => {
    if (event.button !== 1 && !event.altKey) {
      return;
    }

    event.preventDefault();

    setIsPanning(true);

    panStartRef.current = {
      x: event.clientX - pan.x,
      y: event.clientY - pan.y
    };

    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    } catch {
      // Ignore pointer capture errors.
    }
  };

  const handlePointerMove = (event) => {
    if (!isPanning) {
      return;
    }

    event.preventDefault();

    setPan({
      x: event.clientX - panStartRef.current.x,
      y: event.clientY - panStartRef.current.y
    });
  };

  const handlePointerUp = (event) => {
    if (!isPanning) {
      return;
    }

    setIsPanning(false);

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    } catch {
      // Ignore pointer capture errors.
    }
  };

  const handlePointerCancel = () => {
    setIsPanning(false);
  };

  /*
   * -------------------------------------------------------
   * GRID
   * -------------------------------------------------------
   */

  let gridClass = '';

  if (gridType === 'millimeter') {
    gridClass = 'grid-millimeter';
  } else if (gridType === 'cartesian') {
    gridClass = 'grid-cartesian';
  } else if (gridType === 'isometric') {
    gridClass = 'grid-isometric';
  }

  /*
   * -------------------------------------------------------
   * CURSOR
   * -------------------------------------------------------
   */

  const getToolCursor = () => {
    switch (activeTool) {
      case 'select':
        return 'default';

      case 'text':
        return 'text';

      case 'pen':
      case 'highlighter':
      case 'eraser':
      case 'line':
      case 'circle':
      case 'angle':
        return 'crosshair';

      case 'compass':
        return 'crosshair';

      case 'ruler':
      case 'protractor':
      case 'setSquare45':
      case 'setSquare60':
        return 'grab';

      default:
        return 'default';
    }
  };

  /*
   * -------------------------------------------------------
   * VIEWPORT SIZE
   * -------------------------------------------------------
   */

  const viewportWidth =
    containerRef.current?.clientWidth || 1000;

  const viewportHeight =
    containerRef.current?.clientHeight || 700;

  /*
   * -------------------------------------------------------
   * CENTER THE PAGE
   * -------------------------------------------------------
   *
   * We calculate the center directly from the viewport.
   *
   * The page is centered when it is smaller than the
   * available workspace.
   *
   * pan is then added on top for manual panning.
   * -------------------------------------------------------
   */

  const centerX =
    renderedWidth < viewportWidth
      ? (viewportWidth - renderedWidth) / 2
      : 0;

  const centerY =
    renderedHeight < viewportHeight
      ? (viewportHeight - renderedHeight) / 2
      : 0;

  const stageLeft = centerX + pan.x;
  const stageTop = centerY + pan.y;

  /*
   * -------------------------------------------------------
   * WORKSPACE CONTENT SIZE
   * -------------------------------------------------------
   */

  const contentWidth = Math.max(
    viewportWidth,
    renderedWidth + 600
  );

  const pageBottom =
    stageTop + renderedHeight;

  const footerTop = Math.max(
    pageBottom + 100,
    viewportHeight + 160
  );

  const contentHeight = Math.max(
    viewportHeight,
    footerTop + 150
  );

  /*
   * -------------------------------------------------------
   * RENDER
   * -------------------------------------------------------
   */

  return (
    <main
      id="geocanvas-viewport"
      ref={containerRef}
      className="workspace-viewport"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        position: 'relative',
        overflow: 'auto',
        cursor: isPanning
          ? 'grabbing'
          : getToolCursor(),
        touchAction: isPanning
          ? 'none'
          : 'pan-y'
      }}
    >
      {statusMessage && (
        <div
          style={{
            position: 'fixed',
            top: '112px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.94)',
            color: '#f8fafc',
            border: '1px solid var(--border-color)',
            padding: '8px 18px',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
            fontSize: '13px',
            fontFamily: 'var(--font-mono)',
            zIndex: 500,
            pointerEvents: 'none',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span
            style={{
              color: 'var(--math-cyan)'
            }}
          >
            &bull;
          </span>

          {statusMessage}
        </div>
      )}

      <div
        style={{
          position: 'relative',
          width: contentWidth,
          height: contentHeight,
          minWidth: '100%',
          minHeight: '100%'
        }}
      >
        <div
          ref={stageRef}
          className={'paper-stage ' + gridClass}
          style={{
            position: 'absolute',
            left: stageLeft,
            top: stageTop,
            width: renderedWidth,
            height: renderedHeight,
            boxSizing: 'border-box'
          }}
        >
          <PdfLayer
            pdfDoc={pdfDoc}
            currentPage={currentPage}
            width={pageWidth}
            height={pageHeight}
            zoom={safeZoom}
          />

          <AnnotationLayer
            width={pageWidth}
            height={pageHeight}
            zoom={safeZoom}
          />

          <GeometryLayer
            width={pageWidth}
            height={pageHeight}
            zoom={safeZoom}
          />
        </div>

        <footer
          className="workspace-footer"
          style={{
            position: 'absolute',
            top: footerTop,
            left: 0,
            width: '100%',
            minHeight: '110px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '8px',
            padding: '24px',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}
          >
            <span
              style={{
                color: 'var(--math-blue)'
              }}
            >
              Δ
            </span>

            <span>
              GeoCanvas
            </span>

            <span
              style={{
                color: 'var(--text-muted)'
              }}
            >
              •
            </span>

            <span
              style={{
                color: 'var(--text-secondary)'
              }}
            >
              Digital Mathematics Workspace
            </span>
          </div>

          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: '11px',
              letterSpacing: '0.06em',
              textAlign: 'center'
            }}
          >
            © 2026 MUHAMMAD AAYAN — ALL RIGHTS RESERVED
          </div>

          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: '9px',
              letterSpacing: '0.12em',
              opacity: 0.75
            }}
          >
            DRAW • MEASURE • LEARN
          </div>
        </footer>
      </div>
    </main>
  );
}

