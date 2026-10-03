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

import {
  SmartPenController,
  SmartPenInput,
  StrokeManager,
  ShapeRenderer
} from '../smartpen';

import { bounds as pointBounds } from '../smartpen/geometrymath';

import { LaserTool } from '../tools/LaserTool';

const ANNOTATION_TOOLS = [
  'pen',
  'magicPen',
  'laser',
  'highlighter',
  'eraser',
  'text',
  'shapeEdit'
];

// Tools that draw with a pen / finger
const PEN_LIKE_TOOLS = [
  'pen',
  'magicPen',
  'highlighter'
];

const chipButtonStyle = {
  border: 'none',
  borderRadius: '999px',
  padding: '5px 12px',
  minHeight: '30px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.16)',
  color: '#ffffff'
};

// Remove bookkeeping fields before storing a stroke.
const cleanStroke = raw => {
  const {
    pointerType: _pointerType,
    ...rest
  } = raw;

  return {
    ...rest,
    points: raw.points.map(p => ({
      x: p.x,
      y: p.y,
      pressure: p.pressure ?? 0.5
    }))
  };
};

export default function AnnotationLayer({
  width,
  height,
  zoom,
  pageNum
}) {
  const {
    activeTool,

    strokeColor,
    strokeWidth,

    highlighterColor,
    highlighterWidth,
    highlighterOpacity,

    eraserSize,

    currentPage,
    currentPageData,
    pages,

    addAnnotation,
    setPageAnnotations,

    pushHistory,
    setLiveCoords,

    selectedInk,
    setSelectedInk,
    removeAnnotation,
    selectTool
  } = useStore();

  const targetPageNum =
    pageNum || currentPage;

  const pageAnnotations =
    (pages &&
      pages[targetPageNum]?.annotations) ||
    currentPageData?.annotations ||
    [];

  // =========================================================
  // REFS
  // =========================================================

  const canvasRef = useRef(null);

  const activeStrokeRef =
    useRef(null);

  const annotationsRef =
    useRef([]);

  const animationFrameRef =
    useRef(null);

  const activeTouchesRef =
    useRef(new Map());

  // IMPORTANT:
  // React state updates are asynchronous.
  // This ref gives pointer events an immediate drawing state.
  const isDrawingRef =
    useRef(false);

  // Laser
  const laserStrokesRef =
    useRef([]);

  const laserAnimIdRef =
    useRef(null);

  const activeLaserRef =
    useRef(null);

  // Renderer
  const renderRef =
    useRef(null);

  // Eraser
  const lastEraserPointRef =
    useRef(null);

  const eraseHistoryCapturedRef =
    useRef(false);

  // Smart Pen
  const controllerRef =
    useRef(null);

  if (!controllerRef.current) {
    controllerRef.current =
      new SmartPenController();
  }

  const inputRef =
    useRef(null);

  if (!inputRef.current) {
    inputRef.current =
      new SmartPenInput();
  }

  const strokeManagerRef =
    useRef(null);

  if (!strokeManagerRef.current) {
    strokeManagerRef.current =
      new StrokeManager();
  }

  const morphRef =
    useRef(null);

  const morphAnimRef =
    useRef(null);

  const previewRef =
    useRef(null);

  const smartResultRef =
    useRef(null);

  const noticeTimerRef =
    useRef(null);

  // Shape editing
  const editRef =
    useRef(null);

  // Latest render-only values
  const liveRef =
    useRef({});

  // =========================================================
  // STATE
  // =========================================================

  const [smartNotice, setSmartNotice] =
    useState(null);

  const [isDrawing, setIsDrawing] =
    useState(false);

  const [editingText, setEditingText] =
    useState(null);

  const [cursorPoint, setCursorPoint] =
    useState(null);

  const textInputRef =
    useRef(null);

  // =========================================================
  // TOOL STATE
  // =========================================================

  const isInteractive =
    ANNOTATION_TOOLS.includes(activeTool);

  const laserWidth =
    Math.max(
      2.5,
      strokeWidth || 3
    );

  const trackCursor =
    activeTool === 'eraser' ||
    activeTool === 'laser';

  // Keep latest render values in a ref.
  liveRef.current = {
    zoom,
    activeTool,
    cursorPoint,
    eraserSize,
    strokeColor,
    laserWidth,
    selectedInk,
    targetPageNum
  };

  // =========================================================
  // LOCAL ANNOTATIONS
  // =========================================================

  useEffect(() => {
    annotationsRef.current =
      pageAnnotations;

    // Smart Pen result was removed/undone.
    if (
      smartResultRef.current &&
      !pageAnnotations.some(
        a =>
          a.id ===
          smartResultRef.current.id
      )
    ) {
      clearTimeout(
        noticeTimerRef.current
      );

      previewRef.current = null;
      smartResultRef.current = null;

      setSmartNotice(null);
    }

    requestAnimationFrame(() => {
      if (renderRef.current) {
        renderRef.current();
      }
    });
  }, [pageAnnotations]);

  // =========================================================
  // DOCUMENT COORDINATES
  // =========================================================

  const getDocCoordinates =
    useCallback(
      e => {
        const canvas =
          canvasRef.current;

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
              (e.clientX -
                rect.left) /
                zoom
            )
          ),

          y: Math.max(
            0,
            Math.min(
              height,
              (e.clientY -
                rect.top) /
                zoom
            )
          ),

          pressure:
            e.pressure &&
            e.pressure > 0
              ? e.pressure
              : 0.5
        };
      },
      [
        width,
        height,
        zoom
      ]
    );

  // =========================================================
  // DRAW CANVAS
  // =========================================================

  const renderCanvas =
    useCallback(() => {
      const canvas =
        canvasRef.current;

      if (!canvas) return;

      const ctx =
        canvas.getContext('2d');

      if (!ctx) return;

      const L =
        liveRef.current;

      const controller =
        controllerRef.current;

      const dpr =
        window.devicePixelRatio ||
        1;

      // ALWAYS reset transform.
      // Prevents transforms from accumulating.
      ctx.setTransform(
        1,
        0,
        0,
        1,
        0,
        0
      );

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      ctx.save();

      ctx.scale(
        L.zoom * dpr,
        L.zoom * dpr
      );

      const annotations =
        annotationsRef.current ||
        [];

      const morph =
        morphRef.current;

      // =====================================================
      // STORED ANNOTATIONS
      // =====================================================

      for (
        const ann of annotations
      ) {
        // Morph is drawn separately.
        if (
          morph &&
          ann.id === morph.id
        ) {
          continue;
        }

        if (
          ann.type === 'pen' ||
          ann.type === 'highlighter'
        ) {
          PenTool.drawStroke(
            ctx,
            ann
          );
        }

        if (
          ann.type === 'text'
        ) {
          TextTool.drawText(
            ctx,
            ann,
            false
          );
        }
      }

      // =====================================================
      // SMART PEN MORPH
      // =====================================================

      if (morph) {
        const t =
          controller.morphProgress(
            morph,
            performance.now()
          );

        ShapeRenderer.drawMorph(
          ctx,
          morph.style,
          ShapeRenderer.morphFrame(
            morph,
            t
          ),
          t
        );
      }

      // =====================================================
      // SMART PEN PREVIEW
      // =====================================================

      if (
        previewRef.current
      ) {
        const p =
          previewRef.current;

        ShapeRenderer.drawPreview(
          ctx,
          p.style,
          p.corrected.points,
          L.zoom
        );
      }

      // =====================================================
      // LIVE STROKE
      // =====================================================

      if (
        activeStrokeRef.current
      ) {
        PenTool.drawStroke(
          ctx,
          activeStrokeRef.current
        );
      }

      // =====================================================
      // SHAPE SELECTION
      // =====================================================

      if (
        L.activeTool ===
          'shapeEdit' &&
        L.selectedInk &&
        L.selectedInk.pageNum ===
          L.targetPageNum
      ) {
        const selected =
          annotations.find(
            a =>
              a.id ===
              L.selectedInk.id
          );

        if (
          selected &&
          selected.points &&
          selected.points.length > 0
        ) {
          ShapeRenderer.drawSelection(
            ctx,
            controller.frameFor(
              selected,
              L.zoom
            ),
            L.zoom
          );
        }
      }

      // =====================================================
      // LASER
      // =====================================================

      if (
        L.activeTool ===
        'laser'
      ) {
        LaserTool.draw(
          ctx,
          laserStrokesRef.current,
          L.cursorPoint
            ? {
                x:
                  L.cursorPoint.x,
                y:
                  L.cursorPoint.y,
                color:
                  L.strokeColor ||
                  '#ef4444',
                width:
                  L.laserWidth
              }
            : null
        );
      }

      // =====================================================
      // ERASER CURSOR
      // =====================================================

      if (
        L.activeTool ===
          'eraser' &&
        L.cursorPoint
      ) {
        EraserTool.drawCursor(
          ctx,
          L.cursorPoint,
          L.eraserSize
        );
      }

      ctx.restore();
    }, []);

  // Keep newest renderer available.
  renderRef.current =
    renderCanvas;

  // =========================================================
  // IMMEDIATE RENDER
  // =========================================================

  const renderNow =
    useCallback(() => {
      if (
        renderRef.current
      ) {
        renderRef.current();
      }
    }, []);

  // =========================================================
  // SCHEDULED RENDER
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

          if (
            renderRef.current
          ) {
            renderRef.current();
          }
        });
    }, []);

  // =========================================================
  // RENDER-ONLY STATE CHANGES
  // =========================================================

  useEffect(() => {
    scheduleRender();
  }, [
    activeTool,
    cursorPoint,
    eraserSize,
    strokeColor,
    laserWidth,
    selectedInk,
    scheduleRender
  ]);

  // =========================================================
  // CANVAS SIZE
  // =========================================================

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const dpr =
      window.devicePixelRatio ||
      1;

    canvas.width =
      Math.max(
        1,
        Math.floor(
          width *
            zoom *
            dpr
        )
      );

    canvas.height =
      Math.max(
        1,
        Math.floor(
          height *
            zoom *
            dpr
        )
      );

    canvas.style.width =
      `${width * zoom}px`;

    canvas.style.height =
      `${height * zoom}px`;

    renderNow();
  }, [
    width,
    height,
    zoom,
    renderNow
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

      if (
        laserAnimIdRef.current
      ) {
        cancelAnimationFrame(
          laserAnimIdRef.current
        );
      }

      if (
        morphAnimRef.current
      ) {
        cancelAnimationFrame(
          morphAnimRef.current
        );
      }

      clearTimeout(
        noticeTimerRef.current
      );
    };
  }, []);

  // =========================================================
  // ERASER
  // =========================================================

  const eraseAlong =
    useCallback(
      (from, to) => {
        let annotations =
          annotationsRef.current ||
          [];

        if (
          annotations.length ===
          0
        ) {
          return;
        }

        const start =
          from || to;

        const step =
          Math.max(
            2,
            eraserSize * 0.5
          );

        const distanceMoved =
          Math.hypot(
            to.x - start.x,
            to.y - start.y
          );

        const steps =
          Math.max(
            1,
            Math.ceil(
              distanceMoved /
                step
            )
          );

        let changedAny =
          false;

        for (
          let i = 1;
          i <= steps;
          i++
        ) {
          const t =
            i / steps;

          const point = {
            x:
              start.x +
              (to.x -
                start.x) *
                t,

            y:
              start.y +
              (to.y -
                start.y) *
                t
          };

          const result =
            EraserTool.eraseStrokes(
              annotations,
              point,
              eraserSize
            );

          if (
            result &&
            result.changed
          ) {
            annotations =
              result.updatedAnnotations;

            changedAny =
              true;
          }
        }

        if (!changedAny) {
          return;
        }

        if (
          !eraseHistoryCapturedRef.current
        ) {
          pushHistory();

          eraseHistoryCapturedRef.current =
            true;
        }

        annotationsRef.current =
          annotations;

        setPageAnnotations(
          annotations,
          targetPageNum
        );

        // Paint immediately.
        renderNow();
      },
      [
        eraserSize,
        pushHistory,
        setPageAnnotations,
        targetPageNum,
        renderNow
      ]
    );

  // =========================================================
  // LASER
  // =========================================================

  const stopLaser =
    useCallback(() => {
      if (
        laserAnimIdRef.current
      ) {
        cancelAnimationFrame(
          laserAnimIdRef.current
        );

        laserAnimIdRef.current =
          null;
      }

      laserStrokesRef.current =
        [];

      activeLaserRef.current =
        null;

      renderNow();
    }, [renderNow]);

  const startLaserLoop =
    useCallback(() => {
      if (
        laserAnimIdRef.current
      ) {
        return;
      }

      const loop = () => {
        laserStrokesRef.current =
          LaserTool.prune(
            laserStrokesRef.current
          );

        renderNow();

        if (
          laserStrokesRef.current
            .length > 0
        ) {
          laserAnimIdRef.current =
            requestAnimationFrame(
              loop
            );
        } else {
          laserAnimIdRef.current =
            null;
        }
      };

      laserAnimIdRef.current =
        requestAnimationFrame(
          loop
        );
    }, [renderNow]);

  useEffect(() => {
    if (
      activeTool !==
      'laser'
    ) {
      stopLaser();
    }
  }, [
    activeTool,
    stopLaser
  ]);

  // =========================================================
  // SMART PEN
  // =========================================================

  const dismissSmartNotice =
    useCallback(() => {
      clearTimeout(
        noticeTimerRef.current
      );

      previewRef.current =
        null;

      smartResultRef.current =
        null;

      setSmartNotice(null);

      scheduleRender();
    }, [scheduleRender]);

  useEffect(() => {
    return () => {
      clearTimeout(
        noticeTimerRef.current
      );

      if (
        morphAnimRef.current
      ) {
        cancelAnimationFrame(
          morphAnimRef.current
        );
      }
    };
  }, []);

  useEffect(() => {
    if (
      activeTool !==
      'magicPen'
    ) {
      dismissSmartNotice();
    }
  }, [
    activeTool,
    dismissSmartNotice
  ]);

  // =========================================================
  // SMART PEN MORPH
  // =========================================================

  const startMorph =
    (rawStroke, corrected) => {
      const controller =
        controllerRef.current;

      morphRef.current =
        controller.createMorph(
          rawStroke,
          corrected,
          performance.now()
        );

      if (
        morphAnimRef.current
      ) {
        cancelAnimationFrame(
          morphAnimRef.current
        );
      }

      const loop = () => {
        const morph =
          morphRef.current;

        if (!morph) {
          morphAnimRef.current =
            null;

          return;
        }

        const t =
          controller.morphProgress(
            morph,
            performance.now()
          );

        if (t >= 1) {
          morphRef.current =
            null;

          morphAnimRef.current =
            null;

          renderNow();

          return;
        }

        renderNow();

        morphAnimRef.current =
          requestAnimationFrame(
            loop
          );
      };

      morphAnimRef.current =
        requestAnimationFrame(
          loop
        );
    };

  const showSmartNotice =
    (result, ttl) => {
      const b =
        pointBounds(
          result.corrected.points
        );

      const x =
        Math.max(
          8,
          Math.min(
            b.minX * zoom,
            Math.max(
              8,
              width * zoom -
                330
            )
          )
        );

      let y =
        b.minY * zoom -
        46;

      if (y < 8) {
        y =
          b.maxY * zoom +
          12;
      }

      clearTimeout(
        noticeTimerRef.current
      );

      setSmartNotice({
        id:
          result.corrected.id,

        mode:
          result.mode,

        label:
          result.label,

        percent:
          Math.round(
            result.confidence *
              100
          ),

        x,
        y
      });

      noticeTimerRef.current =
        setTimeout(
          dismissSmartNotice,
          ttl
        );
    };

  const commitLocal =
    list => {
      annotationsRef.current =
        list;

      setPageAnnotations(
        list,
        targetPageNum
      );

      renderNow();
    };

  // =========================================================
  // SMART PEN STROKE
  // =========================================================

  const handleSmartStroke =
    rawStroke => {
      const controller =
        controllerRef.current;

      const raw =
        cleanStroke(
          rawStroke
        );

      const result =
        controller.analyze(
          rawStroke,
          {
            unit:
              1 / zoom
          }
        );

      if (
        result.mode ===
        'auto'
      ) {
        smartResultRef.current =
          {
            id: raw.id,
            raw,
            corrected:
              result.corrected
          };

        previewRef.current =
          null;

        annotationsRef.current =
          [
            ...annotationsRef.current,
            result.corrected
          ];

        addAnnotation(
          result.corrected,
          targetPageNum
        );

        startMorph(
          rawStroke,
          result.corrected
        );

        showSmartNotice(
          result,
          5000
        );

        return;
      }

      // Keep original drawing.
      annotationsRef.current =
        [
          ...annotationsRef.current,
          raw
        ];

      addAnnotation(
        raw,
        targetPageNum
      );

      if (
        result.mode ===
        'preview'
      ) {
        smartResultRef.current =
          {
            id: raw.id,
            raw,
            corrected:
              result.corrected
          };

        previewRef.current =
          {
            id: raw.id,

            corrected:
              result.corrected,

            style: {
              color:
                raw.color,

              width:
                raw.width
            }
          };

        showSmartNotice(
          result,
          8000
        );

        return;
      }

      smartResultRef.current =
        null;
    };

  // =========================================================
  // SMART PEN ACTIONS
  // =========================================================

  const undoCorrection =
    () => {
      const data =
        smartResultRef.current;

      if (!data) return;

      if (
        morphAnimRef.current
      ) {
        cancelAnimationFrame(
          morphAnimRef.current
        );

        morphAnimRef.current =
          null;
      }

      morphRef.current =
        null;

      commitLocal(
        annotationsRef.current.map(
          a =>
            a.id === data.id
              ? data.raw
              : a
        )
      );

      dismissSmartNotice();
    };

  const acceptSuggestion =
    () => {
      const data =
        smartResultRef.current;

      if (!data) return;

      previewRef.current =
        null;

      commitLocal(
        annotationsRef.current.map(
          a =>
            a.id === data.id
              ? data.corrected
              : a
        )
      );

      startMorph(
        data.raw,
        data.corrected
      );

      clearTimeout(
        noticeTimerRef.current
      );

      setSmartNotice(prev =>
        prev
          ? {
              ...prev,
              mode: 'auto'
            }
          : prev
      );

      noticeTimerRef.current =
        setTimeout(
          dismissSmartNotice,
          5000
        );
    };

  const editCorrectedShape =
    () => {
      const data =
        smartResultRef.current;

      if (!data) return;

      dismissSmartNotice();

      selectTool(
        'shapeEdit'
      );

      setSelectedInk({
        id: data.id,
        pageNum:
          targetPageNum
      });
    };

  // =========================================================
  // DELETE / ESCAPE SHAPE EDIT
  // =========================================================

  useEffect(() => {
    if (
      activeTool !==
      'shapeEdit'
    ) {
      return undefined;
    }

    const onKeyDown =
      e => {
        if (
          !selectedInk ||
          selectedInk.pageNum !==
            targetPageNum
        ) {
          return;
        }

        const tag =
          (
            e.target?.tagName ||
            ''
          ).toLowerCase();

        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          e.target
            ?.isContentEditable
        ) {
          return;
        }

        if (
          e.key ===
            'Delete' ||
          e.key ===
            'Backspace'
        ) {
          e.preventDefault();

          removeAnnotation(
            selectedInk.id,
            targetPageNum
          );

          setSelectedInk(
            null
          );
        } else if (
          e.key === 'Escape'
        ) {
          setSelectedInk(
            null
          );
        }
      };

    window.addEventListener(
      'keydown',
      onKeyDown
    );

    return () =>
      window.removeEventListener(
        'keydown',
        onKeyDown
      );
  }, [
    activeTool,
    selectedInk,
    targetPageNum,
    removeAnnotation,
    setSelectedInk
  ]);

  // =========================================================
  // POINTER DOWN
  // =========================================================

  const handlePointerDown =
    e => {
      if (
        e.button !== 0 ||
        e.altKey ||
        !isInteractive
      ) {
        return;
      }

      // Palm rejection
      if (
        PEN_LIKE_TOOLS.includes(
          activeTool
        ) &&
        !inputRef.current.accept(
          e
        )
      ) {
        return;
      }

      // Touch multi-finger rejection
      if (
        e.pointerType ===
        'touch'
      ) {
        activeTouchesRef.current.set(
          e.pointerId,
          {
            x: e.clientX,
            y: e.clientY
          }
        );

        if (
          activeTouchesRef.current
            .size >= 2
        ) {
          activeStrokeRef.current =
            null;

          strokeManagerRef.current.cancel();

          editRef.current =
            null;

          isDrawingRef.current =
            false;

          setIsDrawing(
            false
          );

          renderNow();

          return;
        }
      }

      e.preventDefault();

      const point =
        getDocCoordinates(e);

      setLiveCoords(point);

      if (trackCursor) {
        setCursorPoint(
          point
        );
      }

      // =====================================================
      // PEN / MAGIC PEN / HIGHLIGHTER
      // =====================================================

      if (
        activeTool ===
          'pen' ||
        activeTool ===
          'magicPen' ||
        activeTool ===
          'highlighter'
      ) {
        try {
          e.currentTarget.setPointerCapture(
            e.pointerId
          );
        } catch {}

        // MAGIC PEN
        if (
          activeTool ===
          'magicPen'
        ) {
          dismissSmartNotice();

          const first =
            inputRef.current.samples(
              e,
              getDocCoordinates
            )[0];

          activeStrokeRef.current =
            strokeManagerRef.current.begin(
              first,
              {
                color:
                  strokeColor,

                width:
                  strokeWidth
              }
            );

          isDrawingRef.current =
            true;

          setIsDrawing(
            true
          );

          renderNow();

          return;
        }

        const isHighlighter =
          activeTool ===
          'highlighter';

        const stroke =
          PenTool.createStroke(
            point,
            {
              tool:
                isHighlighter
                  ? 'highlighter'
                  : 'pen',

              color:
                isHighlighter
                  ? highlighterColor
                  : strokeColor,

              width:
                isHighlighter
                  ? highlighterWidth
                  : strokeWidth,

              opacity:
                isHighlighter
                  ? highlighterOpacity
                  : 1
            }
          );

        activeStrokeRef.current =
          stroke;

        isDrawingRef.current =
          true;

        setIsDrawing(
          true
        );

        // Immediately show first point.
        renderNow();

        return;
      }

      // =====================================================
      // SHAPE EDIT
      // =====================================================

      if (
        activeTool ===
        'shapeEdit'
      ) {
        try {
          e.currentTarget.setPointerCapture(
            e.pointerId
          );
        } catch {}

        const controller =
          controllerRef.current;

        const annotations =
          annotationsRef.current;

        const selected =
          selectedInk &&
          selectedInk.pageNum ===
            targetPageNum
            ? annotations.find(
                a =>
                  a.id ===
                  selectedInk.id
              )
            : null;

        if (selected) {
          const handle =
            controller.handleAt(
              selected,
              point,
              zoom
            );

          if (handle) {
            editRef.current =
              controller.beginEdit(
                selected,
                handle,
                point,
                zoom
              );

            isDrawingRef.current =
              true;

            setIsDrawing(
              true
            );

            renderNow();

            return;
          }
        }

        const hit =
          controller.hitTest(
            annotations,
            point,
            zoom
          );

        if (hit) {
          setSelectedInk({
            id: hit.id,
            pageNum:
              targetPageNum
          });

          editRef.current =
            controller.beginEdit(
              hit,
              'move',
              point,
              zoom
            );

          isDrawingRef.current =
            true;

          setIsDrawing(
            true
          );
        } else {
          setSelectedInk(
            null
          );
        }

        renderNow();

        return;
      }

      // =====================================================
      // LASER
      // =====================================================

      if (
        activeTool ===
        'laser'
      ) {
        try {
          e.currentTarget.setPointerCapture(
            e.pointerId
          );
        } catch {}

        const laser =
          LaserTool.createLaser(
            point,
            {
              color:
                strokeColor ||
                '#ef4444',

              width:
                laserWidth
            }
          );

        activeLaserRef.current =
          laser;

        laserStrokesRef.current =
          [
            ...laserStrokesRef.current,
            laser
          ];

        isDrawingRef.current =
          true;

        setIsDrawing(
          true
        );

        startLaserLoop();

        renderNow();

        return;
      }

      // =====================================================
      // ERASER
      // =====================================================

      if (
        activeTool ===
        'eraser'
      ) {
        try {
          e.currentTarget.setPointerCapture(
            e.pointerId
          );
        } catch {}

        eraseHistoryCapturedRef.current =
          false;

        isDrawingRef.current =
          true;

        setIsDrawing(
          true
        );

        lastEraserPointRef.current =
          point;

        eraseAlong(
          point,
          point
        );

        renderNow();

        return;
      }

      // =====================================================
      // TEXT
      // =====================================================

      if (
        activeTool ===
        'text'
      ) {
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

  const handlePointerMove =
    e => {
      if (
        !isInteractive
      ) {
        return;
      }

      // Touch multi-finger protection
      if (
        e.pointerType ===
        'touch'
      ) {
        if (
          activeTouchesRef.current
            .size >= 2
        ) {
          return;
        }
      }

      const point =
        getDocCoordinates(e);

      setLiveCoords(point);

      if (trackCursor) {
        setCursorPoint(
          point
        );
      }

      // IMPORTANT:
      // Use ref instead of React state.
      if (
        !isDrawingRef.current
      ) {
        scheduleRender();
        return;
      }

      // =====================================================
      // SHAPE EDIT
      // =====================================================

      if (
        activeTool ===
        'shapeEdit'
      ) {
        const session =
          editRef.current;

        if (session) {
          const updated =
            controllerRef.current.updateEdit(
              session,
              point
            );

          session.moved =
            true;

          annotationsRef.current =
            annotationsRef.current.map(
              a =>
                a.id ===
                  session.id
                  ? updated
                  : a
            );

          renderNow();
        }

        return;
      }

      // =====================================================
      // LASER
      // =====================================================

      if (
        activeTool ===
        'laser'
      ) {
        if (
          activeLaserRef.current
        ) {
          const laserEvents =
            typeof e.getCoalescedEvents ===
            'function'
              ? e.getCoalescedEvents()
              : [e];

          for (
            const laserEvent of
              laserEvents
          ) {
            LaserTool.addPoint(
              activeLaserRef.current,
              getDocCoordinates(
                laserEvent
              )
            );
          }

          startLaserLoop();

          renderNow();
        }

        return;
      }

      // =====================================================
      // PEN / MAGIC PEN / HIGHLIGHTER
      // =====================================================

      if (
        activeTool ===
          'pen' ||
        activeTool ===
          'magicPen' ||
        activeTool ===
          'highlighter'
      ) {
        const stroke =
          activeStrokeRef.current;

        if (!stroke) {
          return;
        }

        // MAGIC PEN
        if (
          activeTool ===
          'magicPen'
        ) {
          strokeManagerRef.current.addAll(
            inputRef.current.samples(
              e,
              getDocCoordinates
            ),
            1.1
          );

          // IMPORTANT:
          // Paint immediately.
          renderNow();

          return;
        }

        const events =
          typeof e.getCoalescedEvents ===
          'function'
            ? e.getCoalescedEvents()
            : [e];

        for (
          const event of events
        ) {
          const p =
            getDocCoordinates(
              event
            );

          PenTool.addPoint(
            stroke,
            p,
            1.1
          );
        }

        // IMPORTANT:
        // Do not wait for React.
        renderNow();

        return;
      }

      // =====================================================
      // ERASER
      // =====================================================

      if (
        activeTool ===
        'eraser'
      ) {
        eraseAlong(
          lastEraserPointRef.current,
          point
        );

        lastEraserPointRef.current =
          point;

        // Immediate cursor/update.
        renderNow();
      }
    };

  // =========================================================
  // FINISH DRAWING
  // =========================================================

  const finishDrawing =
    e => {
      if (
        e?.pointerType ===
        'touch'
      ) {
        activeTouchesRef.current.delete(
          e.pointerId
        );
      }

      // Use ref, NOT React state.
      if (
        !isDrawingRef.current
      ) {
        return;
      }

      if (
        e?.preventDefault
      ) {
        e.preventDefault();
      }

      isDrawingRef.current =
        false;

      setIsDrawing(
        false
      );

      try {
        e?.currentTarget?.releasePointerCapture(
          e.pointerId
        );
      } catch {}

      // =====================================================
      // SHAPE EDIT
      // =====================================================

      if (
        activeTool ===
        'shapeEdit'
      ) {
        const session =
          editRef.current;

        editRef.current =
          null;

        if (
          session &&
          session.moved
        ) {
          pushHistory();

          setPageAnnotations(
            annotationsRef.current,
            targetPageNum
          );
        }

        renderNow();

        return;
      }

      // =====================================================
      // LASER
      // =====================================================

      if (
        activeTool ===
        'laser'
      ) {
        LaserTool.finish(
          activeLaserRef.current
        );

        activeLaserRef.current =
          null;

        startLaserLoop();

        renderNow();

        return;
      }

      // =====================================================
      // PEN / MAGIC PEN / HIGHLIGHTER
      // =====================================================

      if (
        activeStrokeRef.current
      ) {
        const stroke =
          activeStrokeRef.current;

        if (
          stroke.points &&
          stroke.points.length >
            0
        ) {
          if (
            activeTool ===
            'magicPen'
          ) {
            strokeManagerRef.current.end();

            handleSmartStroke(
              stroke
            );
          } else {
            annotationsRef.current =
              [
                ...annotationsRef.current,
                stroke
              ];

            addAnnotation(
              stroke,
              targetPageNum
            );
          }
        }

        activeStrokeRef.current =
          null;
      }

      // =====================================================
      // ERASER RESET
      // =====================================================

      eraseHistoryCapturedRef.current =
        false;

      lastEraserPointRef.current =
        null;

      renderNow();
    };

  // =========================================================
  // POINTER CANCEL
  // =========================================================

  const handlePointerCancel =
    e => {
      if (
        e?.pointerType ===
        'touch'
      ) {
        activeTouchesRef.current.delete(
          e.pointerId
        );
      }

      isDrawingRef.current =
        false;

      setIsDrawing(
        false
      );

      activeStrokeRef.current =
        null;

      strokeManagerRef.current.cancel();

      // Restore cancelled edit.
      if (
        editRef.current
      ) {
        const session =
          editRef.current;

        editRef.current =
          null;

        annotationsRef.current =
          annotationsRef.current.map(
            a =>
              a.id === session.id
                ? session.original
                : a
          );
      }

      // Cancel laser.
      if (
        activeLaserRef.current
      ) {
        LaserTool.finish(
          activeLaserRef.current
        );

        activeLaserRef.current =
          null;

        startLaserLoop();
      }

      eraseHistoryCapturedRef.current =
        false;

      lastEraserPointRef.current =
        null;

      try {
        e?.currentTarget?.releasePointerCapture(
          e.pointerId
        );
      } catch {}

      renderNow();
    };

  // =========================================================
  // TEXT SAVE
  // =========================================================

  const handleSaveText =
    useCallback(() => {
      if (
        !editingText
      ) {
        return;
      }

      const text =
        editingText.text.trim();

      if (
        text.length > 0
      ) {
        const annotation =
          TextTool.createText(
            editingText.x,
            editingText.y,
            text,
            {
              fontSize: 18,
              color:
                strokeColor
            }
          );

        annotationsRef.current =
          [
            ...annotationsRef.current,
            annotation
          ];

        addAnnotation(
          annotation,
          targetPageNum
        );
      }

      setEditingText(
        null
      );

      setTimeout(() => {
        canvasRef.current?.focus();
      }, 0);
    }, [
      editingText,
      strokeColor,
      addAnnotation,
      targetPageNum
    ]);

  // =========================================================
  // TEXT KEYBOARD
  // =========================================================

  const handleTextKeyDown =
    e => {
      if (
        e.key === 'Escape'
      ) {
        e.preventDefault();

        setEditingText(
          null
        );

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

  const handlePointerLeave =
    () => {
      if (
        !isDrawingRef.current
      ) {
        setCursorPoint(
          null
        );

        renderNow();
      }
    };

  // =========================================================
  // CURSOR
  // =========================================================

  let cursor =
    'crosshair';

  if (
    activeTool ===
    'text'
  ) {
    cursor =
      'text';
  }

  if (
    activeTool ===
    'eraser'
  ) {
    cursor =
      'none';
  }

  if (
    activeTool ===
    'laser'
  ) {
    cursor =
      'crosshair';
  }

  if (
    activeTool ===
    'pan'
  ) {
    cursor =
      'grab';
  }

  if (
    activeTool ===
    'shapeEdit'
  ) {
    cursor =
      'default';
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      style={{
        position:
          'absolute',

        top: 0,
        left: 0,

        width:
          `${width * zoom}px`,

        height:
          `${height * zoom}px`,

        zIndex: 10,

        pointerEvents:
          isInteractive &&
          activeTool !==
            'pan'
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
          display:
            'block',

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

          userSelect:
            'none',

          WebkitUserSelect:
            'none'
        }}
      />

      {/* =====================================================
          SMART PEN NOTICE
          ===================================================== */}

      {smartNotice && (
        <div
          role="status"
          style={{
            position:
              'absolute',

            left:
              `${smartNotice.x}px`,

            top:
              `${smartNotice.y}px`,

            zIndex: 120,

            display:
              'flex',

            alignItems:
              'center',

            gap: '8px',

            padding:
              '6px 8px 6px 14px',

            background:
              'rgba(15, 23, 42, 0.93)',

            color:
              '#ffffff',

            borderRadius:
              '999px',

            fontSize:
              '12px',

            boxShadow:
              '0 6px 18px rgba(15, 23, 42, 0.28)',

            whiteSpace:
              'nowrap',

            pointerEvents:
              'auto',

            touchAction:
              'manipulation',

            userSelect:
              'none'
          }}

          onPointerDown={
            e =>
              e.stopPropagation()
          }
        >
          <span>
            {smartNotice.mode ===
            'auto'
              ? '\u2713 '
              : '? '}

            {smartNotice.label}

            {smartNotice.mode ===
            'auto'
              ? ' detected'
              : ' suggested'}

            {' \u2014 '}

            {
              smartNotice.percent
            }
            % confidence
          </span>

          {smartNotice.mode ===
          'auto' ? (
            <>
              <button
                type="button"
                style={
                  chipButtonStyle
                }
                onClick={
                  undoCorrection
                }
              >
                Undo
              </button>

              <button
                type="button"
                style={
                  chipButtonStyle
                }
                onClick={
                  editCorrectedShape
                }
              >
                Edit
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                style={{
                  ...chipButtonStyle,
                  background:
                    '#2563eb'
                }}
                onClick={
                  acceptSuggestion
                }
              >
                Accept
              </button>

              <button
                type="button"
                style={
                  chipButtonStyle
                }
                onClick={
                  dismissSmartNotice
                }
              >
                Reject
              </button>
            </>
          )}
        </div>
      )}

      {/* =====================================================
          TEXT INPUT
          ===================================================== */}

      {editingText && (
        <div
          style={{
            position:
              'absolute',

            left:
              `${editingText.x * zoom}px`,

            top:
              `${editingText.y * zoom}px`,

            zIndex: 100,

            pointerEvents:
              'auto'
          }}

          onPointerDown={
            e =>
              e.stopPropagation()
          }
        >
          <textarea
            ref={
              textInputRef
            }

            value={
              editingText.text
            }

            onChange={
              e => {
                const value =
                  e.target.value;

                setEditingText(
                  previous => ({
                    ...previous,
                    text:
                      value
                  })
                );
              }
            }

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
              minWidth:
                '220px',

              minHeight:
                '54px',

              padding:
                '9px 11px',

              resize:
                'both',

              border:
                '2px solid var(--math-blue)',

              borderRadius:
                '9px',

              outline:
                'none',

              background:
                '#ffffff',

              color:
                '#172033',

              boxShadow:
                '0 8px 24px rgba(15,23,42,0.16)',

              fontSize:
                '18px',

              fontFamily:
                'Inter, Arial, sans-serif',

              lineHeight:
                1.3,

              userSelect:
                'text',

              WebkitUserSelect:
                'text'
            }}
          />
        </div>
      )}
    </div>
  );
}

