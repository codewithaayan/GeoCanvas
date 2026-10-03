import React, { useState, useEffect } from 'react';
import { useStore } from '../state/StoreContext';
import {
  IconPrev,
  IconNext,
  IconZoomIn,
  IconZoomOut,
  IconFitPage,
  IconUndo,
  IconRedo
} from '../assets/math-icons';

export default function BottomBar() {
  const {
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    addBlankPage,
    deletePage,
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    fitPage,
    undo,
    redo,
    canUndo,
    canRedo,
    liveCoords
  } = useStore();

  const zoomPercent = Math.round(zoom * 100);

  // Two-step delete: the first tap asks, the second tap confirms
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Ask again when the page changes, and stop asking after a few seconds
  useEffect(() => {
    setConfirmDelete(false);
  }, [currentPage]);

  useEffect(() => {
    if (!confirmDelete) return undefined;
    const timer = setTimeout(() => setConfirmDelete(false), 5000);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  useEffect(() => {
    if (!deleteError) return undefined;
    const timer = setTimeout(() => setDeleteError(null), 4000);
    return () => clearTimeout(timer);
  }, [deleteError]);

  const handleDeletePage = async () => {
    const pageToDelete = currentPage;
    const remaining = totalPages - 1;

    setConfirmDelete(false);

    const result = await deletePage(pageToDelete);

    if (!result.success) {
      setDeleteError(result.error);
      return;
    }

    setTimeout(() => {
      const el = document.getElementById(
        `page-stage-${Math.min(pageToDelete, remaining)}`
      );
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const zoomPresets = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  const handlePrev = () => {
    if (currentPage > 1) {
      prevPage();
      const el = document.getElementById(`page-stage-${currentPage - 1}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      nextPage();
      const el = document.getElementById(`page-stage-${currentPage + 1}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleAddPage = () => {
    addBlankPage();
    setTimeout(() => {
      const el = document.getElementById(`page-stage-${totalPages + 1}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  return (
    <footer style={{
      height: 'var(--bottombar-height)',
      background: 'var(--bg-panel)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      zIndex: 100
    }}>
      {/* Left: Page Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          className="touch-btn tooltip-wrap"
          onClick={handlePrev}
          disabled={currentPage <= 1}
          data-tooltip="Previous Page"
        >
          <IconPrev size={16} />
        </button>

        <div style={{
          padding: '4px 12px',
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: 'var(--text-primary)'
        }}>
          Page {currentPage} / {totalPages}
        </div>

        <button
          className="touch-btn tooltip-wrap"
          onClick={handleNext}
          disabled={currentPage >= totalPages}
          data-tooltip="Next Page"
        >
          <IconNext size={16} />
        </button>

        <button
          className="touch-btn tooltip-wrap"
          onClick={handleAddPage}
          data-tooltip="Add Blank Page"
          style={{ fontSize: '11px', color: 'var(--math-cyan)', gap: '4px' }}
        >
          <span>+ Page</span>
        </button>

        {!confirmDelete ? (
          <button
            className="touch-btn tooltip-wrap"
            onClick={() => setConfirmDelete(true)}
            disabled={totalPages <= 1}
            data-tooltip={
              totalPages <= 1
                ? 'A document needs at least one page'
                : `Delete page ${currentPage}`
            }
            aria-label={`Delete page ${currentPage}`}
            style={{
              fontSize: '11px',
              color: totalPages <= 1 ? 'var(--text-muted)' : '#dc2626',
              gap: '4px'
            }}
          >
            <span>&minus; Page</span>
          </button>
        ) : (
          <div
            role="alertdialog"
            aria-label={`Confirm deleting page ${currentPage}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 6px 3px 10px',
              borderRadius: '8px',
              border: '1px solid #dc2626',
              background: 'rgba(220, 38, 38, 0.08)',
              fontSize: '12px',
              color: 'var(--text-primary)'
            }}
          >
            <span>Delete page {currentPage}?</span>

            <button
              className="touch-btn"
              onClick={handleDeletePage}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 10px'
              }}
            >
              Delete
            </button>

            <button
              className="touch-btn"
              onClick={() => setConfirmDelete(false)}
              style={{ fontSize: '12px', padding: '4px 10px' }}
            >
              Cancel
            </button>
          </div>
        )}

        {deleteError && (
          <span style={{ fontSize: '11px', color: '#dc2626' }}>
            {deleteError}
          </span>
        )}
      </div>

      {/* Center: Live Mathematical Coordinates & Angle Snapping Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)'
      }}>
        <span>
          X: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(liveCoords.x)}</strong> pt
        </span>
        <span>
          Y: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(liveCoords.y)}</strong> pt
        </span>
        <span style={{ color: 'var(--border-color)' }}>|</span>
        <span>
          {(liveCoords.x / 28.3465).toFixed(1)} cm, {(liveCoords.y / 28.3465).toFixed(1)} cm
        </span>
      </div>

      {/* Right: Zoom & History */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          className="touch-btn tooltip-wrap"
          onClick={undo}
          disabled={!canUndo}
          data-tooltip="Undo (Ctrl+Z)"
        >
          <IconUndo size={16} />
        </button>

        <button
          className="touch-btn tooltip-wrap"
          onClick={redo}
          disabled={!canRedo}
          data-tooltip="Redo (Ctrl+Y)"
        >
          <IconRedo size={16} />
        </button>

        <div style={{
          height: '18px',
          width: '1px',
          background: 'var(--border-color)',
          margin: '0 4px'
        }} />

        <button
          className="touch-btn tooltip-wrap"
          onClick={zoomOut}
          data-tooltip="Zoom Out (-25%)"
        >
          <IconZoomOut size={16} />
        </button>

        {/* Zoom selector */}
        <select
          value={zoomPresets.includes(zoom) ? zoom : ''}
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <option value="" disabled>{zoomPercent}%</option>
          {zoomPresets.map(pz => (
            <option key={pz} value={pz}>{Math.round(pz * 100)}%</option>
          ))}
        </select>

        <button
          className="touch-btn tooltip-wrap"
          onClick={zoomIn}
          data-tooltip="Zoom In (+25%)"
        >
          <IconZoomIn size={16} />
        </button>

        <button
          className="touch-btn tooltip-wrap"
          onClick={() => {
            const viewport = document.getElementById('geocanvas-viewport');
            if (viewport) {
              fitPage(viewport.clientWidth, viewport.clientHeight);
            } else {
              fitPage(800, 600);
            }
          }}
          data-tooltip="Fit Page to Screen"
        >
          <IconFitPage size={16} />
        </button>
      </div>
    </footer>
  );
}