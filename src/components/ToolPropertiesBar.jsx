import React from 'react';
import { useStore } from '../state/StoreContext';

export default function ToolPropertiesBar() {
  const {
    activeTool,

    strokeColor,
    setStrokeColor,

    strokeWidth,
    setStrokeWidth,

    highlighterColor,
    setHighlighterColor,

    highlighterWidth,
    setHighlighterWidth,

    highlighterOpacity,
    setHighlighterOpacity,

    eraserSize,
    setEraserSize,

    snapToTools,
    setSnapToTools
  } = useStore();

  const penColors = [
    { label: 'Royal Blue', value: '#1d4ed8' },
    { label: 'Matte Black', value: '#0f172a' },
    { label: 'Crimson', value: '#dc2626' },
    { label: 'Emerald', value: '#059669' },
    { label: 'Amber', value: '#d97706' },
    { label: 'Purple', value: '#7c3aed' }
  ];

  const highlighterColors = [
    {
      label: 'Fluorescent Yellow',
      value: '#fde047'
    },
    {
      label: 'Cyan Glow',
      value: '#38bdf8'
    },
    {
      label: 'Mint Green',
      value: '#4ade80'
    },
    {
      label: 'Bright Orange',
      value: '#fb923c'
    },
    {
      label: 'Rose Pink',
      value: '#f472b6'
    }
  ];

  const penWidths = [
    1.5,
    3,
    5,
    8
  ];

  const highlighterWidths = [
    16,
    24,
    36
  ];

  const eraserSizes = [
    8,
    16,
    24,
    36,
    48
  ];

  return (
    <div className="tool-properties-bar">

      <div className="tool-context">
        <span className="tool-context-label">
          TOOL
        </span>

        <span className="tool-context-name">
          {activeTool}
        </span>
      </div>

      {(activeTool === 'pen' ||
        activeTool === 'magicPen' ||
        activeTool === 'line' ||
        activeTool === 'circle' ||
        activeTool === 'angle') && (
        <>
          <div className="property-group">
            <span className="property-label">
              Ink
            </span>

            <div className="color-row">
              {penColors.map(c => (
                <button
                  key={c.value}
                  onClick={() =>
                    setStrokeColor(c.value)
                  }
                  className={
                    strokeColor === c.value
                      ? 'color-dot selected'
                      : 'color-dot'
                  }
                  style={{
                    background: c.value
                  }}
                  title={c.label}
                  aria-label={c.label}
                />
              ))}
            </div>
          </div>

          <div className="property-divider" />

          <div className="property-group">
            <span className="property-label">
              Width
            </span>

            <div className="option-row">
              {penWidths.map(w => (
                <button
                  key={w}
                  onClick={() =>
                    setStrokeWidth(w)
                  }
                  className={
                    strokeWidth === w
                      ? 'property-option active'
                      : 'property-option'
                  }
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTool === 'highlighter' && (
        <>
          <div className="property-group">
            <span className="property-label">
              Highlight
            </span>

            <div className="color-row">
              {highlighterColors.map(c => (
                <button
                  key={c.value}
                  onClick={() =>
                    setHighlighterColor(c.value)
                  }
                  className={
                    highlighterColor === c.value
                      ? 'color-dot selected'
                      : 'color-dot'
                  }
                  style={{
                    background: c.value
                  }}
                  title={c.label}
                  aria-label={c.label}
                />
              ))}
            </div>
          </div>

          <div className="property-divider" />

          <div className="property-group">
            <span className="property-label">
              Width
            </span>

            <div className="option-row">
              {highlighterWidths.map(w => (
                <button
                  key={w}
                  onClick={() =>
                    setHighlighterWidth(w)
                  }
                  className={
                    highlighterWidth === w
                      ? 'property-option active'
                      : 'property-option'
                  }
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="property-divider" />

          <div className="property-group slider-group">
            <span className="property-label">
              Opacity
            </span>

            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={highlighterOpacity}
              onChange={e =>
                setHighlighterOpacity(
                  Number(e.target.value)
                )
              }
            />

            <span className="value-badge">
              {Math.round(
                highlighterOpacity * 100
              )}%
            </span>
          </div>
        </>
      )}

      {activeTool === 'eraser' && (
        <>
          <div className="eraser-mode-card">
            <span className="eraser-mode-icon">
              ◌
            </span>

            <div>
              <strong>
                Partial Eraser
              </strong>

              <small>
                Drag across strokes to erase only
                the touched area.
              </small>
            </div>
          </div>

          <div className="property-divider" />

          <div className="property-group eraser-size-group">
            <span className="property-label">
              Size
            </span>

            <div className="option-row">
              {eraserSizes.map(size => (
                <button
                  key={size}
                  onClick={() =>
                    setEraserSize(size)
                  }
                  className={
                    eraserSize === size
                      ? 'property-option active'
                      : 'property-option'
                  }
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="property-divider" />

          <div className="property-group slider-group">
            <input
              type="range"
              min="4"
              max="60"
              step="2"
              value={eraserSize}
              onChange={e =>
                setEraserSize(
                  Number(e.target.value)
                )
              }
            />

            <span className="value-badge">
              {eraserSize}px
            </span>
          </div>
        </>
      )}

      {activeTool === 'laser' && (
        <>
          <div className="property-group">
            <span className="property-label">Laser Color</span>
            <div className="color-row">
              {[
                { label: 'Laser Red', value: '#ef4444' },
                { label: 'Neon Emerald', value: '#10b981' },
                { label: 'Neon Cyan', value: '#06b6d4' },
                { label: 'Electric Amber', value: '#f59e0b' }
              ].map(c => (
                <button
                  key={c.value}
                  onClick={() => setStrokeColor(c.value)}
                  className={strokeColor === c.value ? 'color-dot selected' : 'color-dot'}
                  style={{ background: c.value }}
                  title={c.label}
                  aria-label={c.label}
                />
              ))}
            </div>
          </div>
          <div className="property-divider" />
          <div className="property-group">
            <span className="property-label">Width</span>
            <div className="option-row">
              {[4, 6, 8, 12].map(w => (
                <button
                  key={w}
                  onClick={() => setStrokeWidth(w)}
                  className={strokeWidth === w ? 'property-option active' : 'property-option'}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '12px' }}>
            Trail self-dissolves automatically
          </span>
        </>
      )}

      {activeTool === 'pan' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span>👋 <strong>Hand Tool</strong>: Slide finger or drag mouse to scroll across pages smoothly. Pinch with 2 fingers to zoom.</span>
        </div>
      )}

      <div className="snap-control">
        <label>
          <input
            type="checkbox"
            checked={snapToTools}
            onChange={e =>
              setSnapToTools(
                e.target.checked
              )
            }
          />

          <span>
            Snap
          </span>
        </label>
      </div>
    </div>
  );
}