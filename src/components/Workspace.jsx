import React, { useEffect, useRef, useState, useCallback } from 'react';

import { useStore } from '../state/StoreContext';

import PdfLayer from './PdfLayer';
import AnnotationLayer from './AnnotationLayer';
import GeometryLayer from './GeometryLayer';

export default function Workspace() {
  const {
    pdfDoc,
    totalPages,
    currentPage,
    setCurrentPage,
    pageDimensions,
    zoom,
    setZoom,
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
    y: 0,
    scrollLeft: 0,
    scrollTop: 0
  });

  // Multi-touch tracking for pinch-to-zoom and 2-finger scroll
  const activePointersRef = useRef(new Map());
  const pinchRef = useRef(null);

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
  const pageGap = 36; // gap between stacked pages in continuous view

  /*
   * -------------------------------------------------------
   * FIT PAGE ON MOUNT & RESIZE
   * -------------------------------------------------------
   */

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) return;

    fitPage(width, height);
  }, [pageDimensions.width, pageDimensions.height, fitPage]);

  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      if (!container) return;

      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width <= 0 || height <= 0) return;

      fitPage(width, height);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [fitPage]);

  /*
   * -------------------------------------------------------
   * CONTINUOUS SCROLL: DETECT CURRENT PAGE IN VIEW
   * -------------------------------------------------------
   */

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || totalPages <= 1) return;

    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    const viewCenter = scrollTop + clientHeight / 2;

    for (let p = 1; p <= totalPages; p++) {
      const pageEl = document.getElementById(`page-stage-${p}`);
      if (pageEl) {
        const top = pageEl.offsetTop;
        const bottom = top + pageEl.offsetHeight;
        if (viewCenter >= top && viewCenter <= bottom) {
          if (currentPage !== p && typeof setCurrentPage === 'function') {
            setCurrentPage(p);
          }
          break;
        }
      }
    }
  }, [totalPages, currentPage, setCurrentPage]);

  /*
   * -------------------------------------------------------
   * TOUCH & TRACKPAD WHEEL (PINCH ZOOM & SCROLL)
   * -------------------------------------------------------
   */

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      // Laptop trackpad pinch or Ctrl + MouseWheel
      if (e.ctrlKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.05 : 0.95;
        setZoom(Number(Math.max(0.35, Math.min(3.0, safeZoom * factor)).toFixed(2)));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [safeZoom, setZoom]);

  /*
   * -------------------------------------------------------
   * TOUCH & POINTER EVENTS: PANNING & 2-FINGER PINCH
   * -------------------------------------------------------
   */

  const handlePointerDown = (event) => {
    const container = containerRef.current;
    if (!container) return;

    // Track active pointers (for touch devices)
    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      type: event.pointerType
    });

    // 2-FINGER TOUCH DETECTED: PINCH ZOOM & 2-FINGER PAN
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const p1 = pts[0];
      const p2 = pts[1];
      const initialDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const midpoint = {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
      };

      pinchRef.current = {
        startDist: Math.max(10, initialDist),
        startZoom: safeZoom,
        startMidpoint: midpoint,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop
      };

      setIsPanning(false);
      return;
    }

    // 1-FINGER TOUCH / MOUSE PANNING (HAND TOOL, MIDDLE CLICK, OR ALT+DRAG)
    const shouldPan =
      activeTool === 'pan' ||
      event.button === 1 ||
      event.altKey;

    if (shouldPan) {
      event.preventDefault();
      setIsPanning(true);

      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop
      };

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {}
    }
  };

  const handlePointerMove = (event) => {
    const container = containerRef.current;
    if (!container) return;

    // Update tracked pointer
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        type: event.pointerType
      });
    }

    // 2-FINGER PINCH & PAN GESTURE
    if (activePointersRef.current.size === 2 && pinchRef.current) {
      event.preventDefault();
      const pts = Array.from(activePointersRef.current.values());
      const p1 = pts[0];
      const p2 = pts[1];
      const currentDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const scale = currentDist / pinchRef.current.startDist;

      // Smooth zoom calculation
      const newZoom = Number(
        Math.max(0.35, Math.min(3.0, pinchRef.current.startZoom * scale)).toFixed(2)
      );
      setZoom(newZoom);

      // 2-finger scroll calculation
      const currentMidpoint = {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
      };
      const dx = currentMidpoint.x - pinchRef.current.startMidpoint.x;
      const dy = currentMidpoint.y - pinchRef.current.startMidpoint.y;

      container.scrollLeft = pinchRef.current.scrollLeft - dx;
      container.scrollTop = pinchRef.current.scrollTop - dy;
      return;
    }

    // 1-FINGER PANNING (HAND TOOL OR MIDDLE CLICK)
    if (isPanning) {
      event.preventDefault();
      const dx = event.clientX - panStartRef.current.x;
      const dy = event.clientY - panStartRef.current.y;

      container.scrollLeft = panStartRef.current.scrollLeft - dx;
      container.scrollTop = panStartRef.current.scrollTop - dy;
    }
  };

  const handlePointerUp = (event) => {
    activePointersRef.current.delete(event.pointerId);

    if (activePointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    if (isPanning && activePointersRef.current.size === 0) {
      setIsPanning(false);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {}
    }
  };

  const handlePointerCancel = (event) => {
    activePointersRef.current.delete(event?.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    setIsPanning(false);
  };

  /*
   * -------------------------------------------------------
   * GRID & CURSOR
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

  const getToolCursor = () => {
    switch (activeTool) {
      case 'select':
        return 'default';
      case 'pan':
        return isPanning ? 'grabbing' : 'grab';
      case 'text':
        return 'text';
      case 'laser':
      case 'magicPen':
      case 'pen':
      case 'highlighter':
      case 'eraser':
      case 'line':
      case 'circle':
      case 'angle':
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
   * VIEWPORT AND CANVAS LAYOUT
   * -------------------------------------------------------
   */

  const viewportWidth = containerRef.current?.clientWidth || 1000;
  const viewportHeight = containerRef.current?.clientHeight || 700;

  // Center horizontally inside scrollable canvas
  const centerX = renderedWidth < viewportWidth ? (viewportWidth - renderedWidth) / 2 : 40;
  const stageTop = 40 + pan.y;
  const stageLeft = centerX + pan.x;

  const totalPagesHeight = totalPages * renderedHeight + Math.max(0, totalPages - 1) * pageGap;
  const contentWidth = Math.max(viewportWidth, renderedWidth + stageLeft * 2);
  const pageBottom = stageTop + totalPagesHeight;
  const footerTop = Math.max(pageBottom + 80, viewportHeight + 160);
  const contentHeight = Math.max(viewportHeight, footerTop + 140);

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
      onScroll={handleScroll}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        position: 'relative',
        overflow: 'auto',
        cursor: getToolCursor(),
        touchAction: activeTool === 'pan' ? 'pan-x pan-y' : 'none',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {/* Status notification toast */}
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
          <span style={{ color: 'var(--math-cyan)' }}>&bull;</span>
          {statusMessage}
        </div>
      )}

      {/* Touch Screen Quick Controls: Touch zoom reset / Fit to screen button */}
      <div
        style={{
          position: 'fixed',
          bottom: '68px',
          right: '24px',
          zIndex: 400,
          display: 'flex',
          gap: '8px',
          background: 'rgba(13, 27, 45, 0.85)',
          padding: '6px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 6px 16px rgba(0,0,0,0.35)'
        }}
      >
        <button
          type="button"
          onClick={() => fitPage(viewportWidth, viewportHeight)}
          title="Fit Document to Screen"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Fit Screen
        </button>
        <button
          type="button"
          onClick={() => setZoom(1.0)}
          title="Reset Zoom (100%)"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border-color)',
            color: 'var(--math-cyan)',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          {Math.round(safeZoom * 100)}%
        </button>
      </div>

      <div
        style={{
          position: 'relative',
          width: contentWidth,
          height: contentHeight,
          minWidth: '100%',
          minHeight: '100%'
        }}
      >
        {/* Continuous stacked pages column */}
        <div
          ref={stageRef}
          style={{
            position: 'absolute',
            left: stageLeft,
            top: stageTop,
            width: renderedWidth,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: `${pageGap}px`,
            boxSizing: 'border-box'
          }}
        >
          {Array.from({ length: totalPages }, (_, idx) => {
            const pageNum = idx + 1;
            return (
              <div
                key={pageNum}
                id={`page-stage-${pageNum}`}
                data-page={pageNum}
                className={'paper-stage ' + gridClass}
                style={{
                  position: 'relative',
                  width: renderedWidth,
                  height: renderedHeight,
                  boxSizing: 'border-box',
                  background: 'var(--paper-bg)',
                  boxShadow: 'var(--paper-shadow)',
                  borderRadius: '3px'
                }}
              >
                {/* Header badge showing page index */}
                {totalPages > 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-24px',
                      left: '4px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.06em',
                      pointerEvents: 'none',
                      fontWeight: 600
                    }}
                  >
                    PAGE {pageNum} OF {totalPages}
                  </div>
                )}

                <PdfLayer
                  pdfDoc={pdfDoc}
                  currentPage={pageNum}
                  width={pageWidth}
                  height={pageHeight}
                  zoom={safeZoom}
                />

                <AnnotationLayer
                  pageNum={pageNum}
                  width={pageWidth}
                  height={pageHeight}
                  zoom={safeZoom}
                />

                <GeometryLayer
                  pageNum={pageNum}
                  width={pageWidth}
                  height={pageHeight}
                  zoom={safeZoom}
                />
              </div>
            );
          })}
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
            <span style={{ color: 'var(--math-blue)' }}>Δ</span>
            <span>GeoCanvas</span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--text-secondary)' }}>Digital Mathematics Workspace</span>
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
