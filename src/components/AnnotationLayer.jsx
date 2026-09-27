import React, {
  useRef,
  useEffect,
  useState,
  useCallback
} from 'react';

import { useStore } from '../state/StoreContext';

import { PenTool } from '../tools/PenTool';
import { EraserTool } from '../tools/EraserTool';
import { TextTool } from '../tools/TextTool';

const ANNOTATION_TOOLS = [
  'pen',
  'highlighter',
  'eraser',
  'text'
];

export default function AnnotationLayer({
  width,
  height,
  zoom
}) {
  const {
    activeTool,

    strokeColor,
    strokeWidth,

    highlighterColor,
    highlighterWidth,
    highlighterOpacity,

    eraserSize,

    currentPageData,

    addAnnotation,
    setPageAnnotations,

    pushHistory,
    setLiveCoords
  } = useStore();

  const canvasRef = useRef(null);
  const activeStrokeRef = useRef(null);
  const annotationsRef = useRef([]);
  const animationFrameRef = useRef(null);

  const eraseHistoryCapturedRef = useRef(false);

  const [isDrawing, setIsDrawing] =
    useState(false);

  const [editingText, setEditingText] =
    useState(null);

  const [cursorPoint, setCursorPoint] =
    useState(null);

  const textInputRef = useRef(null);

  const isInteractive =
    ANNOTATION_TOOLS.includes(activeTool);

  // =========================================================
  // KEEP LOCAL ANNOTATION REFERENCE UPDATED
  // =========================================================

  useEffect(() => {
    annotationsRef.current =
      currentPageData?.annotations || [];

    // Redraw whenever page annotations change.
    requestAnimationFrame(() => {
      renderCanvas();
    });
  }, [currentPageData]);

  // =========================================================
  // DOCUMENT COORDINATES
  // =========================================================

  const getDocCoordinates = useCallback(
    e => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return {
          x: 0,
          y: 0,
          pressure: 0.5
        };
      }

      const rect =
        canvas.getBoundingClientRect();

      if (
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return {
          x: 0,
          y: 0,
          pressure: 0.5
        };
      }

      return {
        x: Math.max(
          0,
          Math.min(
            width,
            (e.clientX - rect.left) /
              zoom
          )
        ),

        y: Math.max(
          0,
          Math.min(
            height,
            (e.clientY - rect.top) /
              zoom
          )
        ),

        pressure:
          e.pressure && e.pressure > 0
            ? e.pressure
            : 0.5
      };
    },
    [width, height, zoom]
  );

  // =========================================================
  // DRAW CANVAS
  // =========================================================

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext('2d');

    if (!ctx) return;

    const dpr =
      window.devicePixelRatio || 1;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    /*
     * The canvas backing resolution is:
     *
     * width  = documentWidth  * zoom * dpr
     * height = documentHeight * zoom * dpr
     *
     * Therefore drawing is scaled by zoom here.
     */
    ctx.save();

    ctx.scale(
      zoom * dpr,
      zoom * dpr
    );

    const annotations =
      annotationsRef.current || [];

    // -------------------------------------------------------
    // STORED ANNOTATIONS
    // -------------------------------------------------------

    for (const ann of annotations) {
      if (
        ann.type === 'pen' ||
        ann.type === 'highlighter'
      ) {
        PenTool.drawStroke(
          ctx,
          ann
        );
      }

      if (ann.type === 'text') {
        TextTool.drawText(
          ctx,
          ann,
          false
        );
      }
    }

    // -------------------------------------------------------
    // LIVE STROKE
    // -------------------------------------------------------

    if (activeStrokeRef.current) {
      PenTool.drawStroke(
        ctx,
        activeStrokeRef.current
      );
    }

    // -------------------------------------------------------
    // ERASER CURSOR
    // -------------------------------------------------------

    if (
      activeTool === 'eraser' &&
      cursorPoint
    ) {
      EraserTool.drawCursor(
        ctx,
        cursorPoint,
        eraserSize
      );
    }

    ctx.restore();
  }, [
    zoom,
    activeTool,
    cursorPoint,
    eraserSize
  ]);

  // =========================================================
  // SCHEDULE RENDER
  // =========================================================

  const scheduleRender =
    useCallback(() => {
      if (
        animationFrameRef.current
      ) {
        return;
      }

      animationFrameRef.current =
        requestAnimationFrame(() => {
          animationFrameRef.current =
            null;

          renderCanvas();
        });
    }, [renderCanvas]);

  // =========================================================
  // CANVAS SIZE
  // =========================================================

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const dpr =
      window.devicePixelRatio || 1;

    canvas.width = Math.max(
      1,
      Math.floor(
        width * zoom * dpr
      )
    );

    canvas.height = Math.max(
      1,
      Math.floor(
        height * zoom * dpr
      )
    );

    canvas.style.width =
      `${width * zoom}px`;

    canvas.style.height =
      `${height * zoom}px`;

    renderCanvas();
  }, [
    width,
    height,
    zoom,
    renderCanvas
  ]);

  // =========================================================
  // CLEANUP
  // =========================================================

  useEffect(() => {
    return () => {
      if (
        animationFrameRef.current
      ) {
        cancelAnimationFrame(
          animationFrameRef.current
        );
      }
    };
  }, []);

  // =========================================================
  // ERASER
  // =========================================================

  const eraseAtPoint =
    useCallback(
      point => {
        const annotations =
          annotationsRef.current || [];

        if (
          annotations.length === 0
        ) {
          return;
        }

        const result =
          EraserTool.eraseStrokes(
            annotations,
            point,
            eraserSize
          );

        if (!result) {
          return;
        }

        const updated =
          Array.isArray(
            result.updatedAnnotations
          )
            ? result.updatedAnnotations
            : annotations;

        const deleted =
          Array.isArray(
            result.deletedAnnotations
          )
            ? result.deletedAnnotations
            : [];

        /*
         * Detect both:
         *
         * 1. Whole annotation deletion
         * 2. Partial stroke modification
         */
        const changed =
          deleted.length > 0 ||
          updated.length !==
            annotations.length;

        if (!changed) {
          return;
        }

        // Only create one history snapshot
        // for one continuous erase gesture.
        if (
          !eraseHistoryCapturedRef.current
        ) {
          pushHistory();

          eraseHistoryCapturedRef.current =
            true;
        }

        annotationsRef.current =
          updated;

        setPageAnnotations(
          updated
        );

        scheduleRender();
      },
      [
        eraserSize,
        pushHistory,
        setPageAnnotations,
        scheduleRender
      ]
    );

  // =========================================================
  // POINTER DOWN
  // =========================================================

  const handlePointerDown = e => {
    if (
      e.button !== 0 ||
      e.altKey ||
      !isInteractive
    ) {
      return;
    }

    e.preventDefault();

    const point =
      getDocCoordinates(e);

    setLiveCoords(point);
    setCursorPoint(point);

    // -------------------------------------------------------
    // PEN / HIGHLIGHTER
    // -------------------------------------------------------

    if (
      activeTool === 'pen' ||
      activeTool === 'highlighter'
    ) {
      try {
        e.currentTarget.setPointerCapture(
          e.pointerId
        );
      } catch {}

      const isHighlighter =
        activeTool === 'highlighter';

      const stroke =
        PenTool.createStroke(
          point,
          {
            tool: activeTool,

            color: isHighlighter
              ? highlighterColor
              : strokeColor,

            width: isHighlighter
              ? highlighterWidth
              : strokeWidth,

            opacity: isHighlighter
              ? highlighterOpacity
              : 1
          }
        );

      activeStrokeRef.current =
        stroke;

      setIsDrawing(true);

      scheduleRender();

      return;
    }

    // -------------------------------------------------------
    // ERASER
    // -------------------------------------------------------

    if (activeTool === 'eraser') {
      try {
        e.currentTarget.setPointerCapture(
          e.pointerId
        );
      } catch {}

      eraseHistoryCapturedRef.current =
        false;

      setIsDrawing(true);

      eraseAtPoint(point);

      return;
    }

    // -------------------------------------------------------
    // TEXT
    // -------------------------------------------------------

    if (activeTool === 'text') {
      setEditingText({
        x: point.x,
        y: point.y,
        text: ''
      });

      setTimeout(() => {
        textInputRef.current?.focus();
      }, 20);
    }
  };

  // =========================================================
  // POINTER MOVE
  // =========================================================

  const handlePointerMove = e => {
    if (!isInteractive) {
      return;
    }

    const point =
      getDocCoordinates(e);

    setLiveCoords(point);
    setCursorPoint(point);

    // -------------------------------------------------------
    // NOT DRAWING
    // -------------------------------------------------------

    if (!isDrawing) {
      scheduleRender();
      return;
    }

    // -------------------------------------------------------
    // PEN / HIGHLIGHTER
    // -------------------------------------------------------

    if (
      activeTool === 'pen' ||
      activeTool === 'highlighter'
    ) {
      const stroke =
        activeStrokeRef.current;

      if (!stroke) {
        return;
      }

      const events =
        typeof e.getCoalescedEvents ===
        'function'
          ? e.getCoalescedEvents()
          : [e];

      for (const event of events) {
        const p =
          getDocCoordinates(event);

        PenTool.addPoint(
          stroke,
          p,
          1.1
        );
      }

      scheduleRender();

      return;
    }

    // -------------------------------------------------------
    // ERASER
    // -------------------------------------------------------

    if (
      activeTool === 'eraser'
    ) {
      eraseAtPoint(point);
    }
  };

  // =========================================================
  // FINISH DRAWING
  // =========================================================

  const finishDrawing = e => {
    if (!isDrawing) {
      return;
    }

    e.preventDefault();

    setIsDrawing(false);

    try {
      e.currentTarget.releasePointerCapture(
        e.pointerId
      );
    } catch {}

    // -------------------------------------------------------
    // FINISH PEN / HIGHLIGHTER
    // -------------------------------------------------------

    if (
      activeStrokeRef.current
    ) {
      const stroke =
        activeStrokeRef.current;

      if (
        stroke.points &&
        stroke.points.length > 0
      ) {
        /*
         * Keep local reference immediately
         * so the stroke appears without waiting
         * for another render cycle.
         */
        annotationsRef.current = [
          ...annotationsRef.current,
          stroke
        ];

        addAnnotation(stroke);
      }

      activeStrokeRef.current =
        null;
    }

    // -------------------------------------------------------
    // RESET ERASER HISTORY
    // -------------------------------------------------------

    eraseHistoryCapturedRef.current =
      false;

    scheduleRender();
  };

  // =========================================================
  // POINTER CANCEL
  // =========================================================

  const handlePointerCancel = e => {
    setIsDrawing(false);

    activeStrokeRef.current =
      null;

    eraseHistoryCapturedRef.current =
      false;

    try {
      e.currentTarget.releasePointerCapture(
        e.pointerId
      );
    } catch {}

    scheduleRender();
  };

  // =========================================================
  // TEXT SAVE
  // =========================================================

  const handleSaveText =
    useCallback(() => {
      if (!editingText) {
        return;
      }

      const text =
        editingText.text.trim();

      if (text.length > 0) {
        const annotation =
          TextTool.createText(
            editingText.x,
            editingText.y,
            text,
            {
              fontSize: 18,
              color: strokeColor
            }
          );

        annotationsRef.current = [
          ...annotationsRef.current,
          annotation
        ];

        addAnnotation(
          annotation
        );
      }

      setEditingText(null);

      setTimeout(() => {
        canvasRef.current?.focus();
      }, 0);
    }, [
      editingText,
      strokeColor,
      addAnnotation
    ]);

  // =========================================================
  // TEXT KEYBOARD
  // =========================================================

  const handleTextKeyDown = e => {
    if (e.key === 'Escape') {
      e.preventDefault();

      setEditingText(null);

      return;
    }

    if (
      e.key === 'Enter' &&
      !e.shiftKey
    ) {
      e.preventDefault();

      handleSaveText();
    }
  };

  // =========================================================
  // POINTER LEAVE
  // =========================================================

  const handlePointerLeave = () => {
    if (!isDrawing) {
      setCursorPoint(null);

      scheduleRender();
    }
  };

  // =========================================================
  // CURSOR
  // =========================================================

  let cursor = 'crosshair';

  if (activeTool === 'text') {
    cursor = 'text';
  }

  if (activeTool === 'eraser') {
    cursor = 'none';
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,

        width:
          `${width * zoom}px`,

        height:
          `${height * zoom}px`,

        zIndex: 10,

        pointerEvents:
          isInteractive
            ? 'auto'
            : 'none'
      }}
    >
      <canvas
        ref={canvasRef}
        tabIndex={-1}

        onPointerDown={
          handlePointerDown
        }

        onPointerMove={
          handlePointerMove
        }

        onPointerUp={
          finishDrawing
        }

        onPointerCancel={
          handlePointerCancel
        }

        onPointerLeave={
          handlePointerLeave
        }

        style={{
          display: 'block',

          width:
            `${width * zoom}px`,

          height:
            `${height * zoom}px`,

          cursor,

          touchAction:
            isInteractive
              ? 'none'
              : 'auto',

          pointerEvents:
            isInteractive
              ? 'auto'
              : 'none',

          userSelect: 'none',

          WebkitUserSelect:
            'none'
        }}
      />

      {editingText && (
        <div
          style={{
            position: 'absolute',

            left:
              `${editingText.x * zoom}px`,

            top:
              `${editingText.y * zoom}px`,

            zIndex: 100,

            pointerEvents: 'auto'
          }}

          onPointerDown={e =>
            e.stopPropagation()
          }
        >
          <textarea
            ref={textInputRef}

            value={
              editingText.text
            }

            onChange={e => {
              const value =
                e.target.value;

              setEditingText(
                previous => ({
                  ...previous,
                  text: value
                })
              );
            }}

            onKeyDown={
              handleTextKeyDown
            }

            onBlur={
              handleSaveText
            }

            autoFocus

            rows={2}

            placeholder="Type a math note..."

            style={{
              minWidth: '220px',
              minHeight: '54px',

              padding:
                '9px 11px',

              resize: 'both',

              border:
                '2px solid var(--math-blue)',

              borderRadius: '9px',

              outline: 'none',

              background: '#ffffff',

              color: '#172033',

              boxShadow:
                '0 8px 24px rgba(15,23,42,0.16)',

              fontSize: '18px',

              fontFamily:
                'Inter, Arial, sans-serif',

              lineHeight: 1.3,

              userSelect: 'text',

              WebkitUserSelect:
                'text'
            }}
          />
        </div>
      )}
    </div>
  );
}