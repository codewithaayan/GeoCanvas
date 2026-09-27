import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useStore } from "../state/StoreContext";

import { RulerModel } from "../geometry/Ruler";
import { ProtractorModel } from "../geometry/Protractor";
import { CompassModel } from "../geometry/Compass";
import { SetSquareModel } from "../geometry/SetSquares";
import { AngleMeasureModel } from "../geometry/AngleMeasure";

import {
  LineModel,
  CircleModel,
  ArcModel,
} from "../geometry/Shapes";

import {
  distance,
  snapLineToAngle,
  angleBetweenPoints,
  DEG_TO_RAD,
} from "../geometry/math";

/* =========================================================
   TOOL LISTS
========================================================= */

const GEOMETRY_TOOLS = [
  "select",
  "line",
  "circle",
  "ruler",
  "protractor",
  "compass",
  "setSquare45",
  "setSquare60",
  "angle",
];

const PHYSICAL_TOOLS = [
  "ruler",
  "protractor",
  "compass",
  "setSquare45",
  "setSquare60",
];

/* =========================================================
   CONSTANTS
========================================================= */

const MIN_DRAW_DISTANCE = 5;

const MIN_PROTRACTOR_RADIUS = 80;
const MAX_PROTRACTOR_RADIUS = 320;

const MIN_COMPASS_RADIUS = 35;
const MAX_COMPASS_RADIUS = 400;

// How much of the way to the pointer's target angle a
// rotate-handle drag moves per pointer event. Lower = slower,
// heavier-feeling rotation (Ruler / Protractor rotate handles).
const ROTATE_DAMPING = 0.18;

const POINTS_PER_CM = 72 / 2.54;

/* =========================================================
   BASIC HELPERS
========================================================= */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pointsToCm(points) {
  return points / POINTS_PER_CM;
}

function formatCm(value) {
  return `${Number(value || 0).toFixed(1)} cm`;
}

function createGeometryId(type) {
  return `${type}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function angleFromPoint(point, center) {
  return (
    ((Math.atan2(
      point.y - center.y,
      point.x - center.x
    ) *
      180) /
      Math.PI +
      360) %
    360
  );
}

function getSignedAngleDifference(startAngle, endAngle) {
  let difference = endAngle - startAngle;

  while (difference > 180) {
    difference -= 360;
  }

  while (difference < -180) {
    difference += 360;
  }

  return difference;
}

/*
 * Rounds an absolute angle to the nearest multiple of
 * `incrementDeg` and returns it only if it's within
 * `toleranceDeg` of that multiple - otherwise returns null
 * (meaning: don't snap, too far from a clean value).
 */
function snapAngleToIncrement(
  angleDeg,
  incrementDeg = 15,
  toleranceDeg = 4
) {
  const normalized =
    ((angleDeg % 360) + 360) % 360;

  const nearest =
    Math.round(normalized / incrementDeg) *
    incrementDeg;

  const diff = Math.abs(
    normalized - nearest
  );

  if (diff <= toleranceDeg) {
    return nearest % 360;
  }

  return null;
}

/*
 * Like snapAngleToIncrement, but works on a raw (possibly
 * negative, possibly >360) value without wrapping it into
 * [0, 360) first - used for compass sweep deltas, where the
 * sign and magnitude both matter.
 */
function snapSignedDeltaToIncrement(
  deltaDeg,
  incrementDeg = 15,
  toleranceDeg = 4
) {
  const nearest =
    Math.round(deltaDeg / incrementDeg) *
    incrementDeg;

  const diff = Math.abs(
    deltaDeg - nearest
  );

  if (diff <= toleranceDeg) {
    return nearest;
  }

  return null;
}

/*
 * Finds a Ruler on the page whose edge the given point is
 * currently resting on/near, so a Line drawn from there can
 * snap to run exactly along it (the classic "draw along the
 * ruler" workflow).
 */
function findRulerEdgeAngle(
  geometryObjects,
  point
) {
  for (const obj of geometryObjects) {
    if (obj.type !== "ruler") {
      continue;
    }

    try {
      const hit = RulerModel.hitTest(
        obj,
        point
      );

      if (hit?.part === "body") {
        return obj.rotation || 0;
      }
    } catch {
      // Ignore malformed ruler objects.
    }
  }

  return null;
}

/* =========================================================
   POINTER COORDINATES

   IMPORTANT:

   Models use PAGE coordinates.

   The canvas is displayed at:

   pageWidth * zoom
   pageHeight * zoom

   So we convert the actual mouse/touch position from
   the displayed canvas back into page coordinates.

========================================================= */

function getPointerPoint(
  event,
  canvas,
  pageWidth,
  pageHeight
) {
  const rect = canvas.getBoundingClientRect();

  if (
    !rect.width ||
    !rect.height ||
    !pageWidth ||
    !pageHeight
  ) {
    return {
      x: 0,
      y: 0,
    };
  }

  const x =
    ((event.clientX - rect.left) / rect.width) *
    pageWidth;

  const y =
    ((event.clientY - rect.top) / rect.height) *
    pageHeight;

  return {
    x: clamp(x, 0, pageWidth),
    y: clamp(y, 0, pageHeight),
  };
}

/* =========================================================
   MODEL LOOKUP
========================================================= */

function getModelForObject(object) {
  if (!object) {
    return null;
  }

  switch (object.type) {
    case "ruler":
      return RulerModel;

    case "protractor":
      return ProtractorModel;

    case "compass":
      return CompassModel;

    case "setSquare45":
    case "setSquare60":
      return SetSquareModel;

    case "angle":
      return AngleMeasureModel;

    case "line":
      return LineModel;

    case "circle":
      return CircleModel;

    case "arc":
      return ArcModel;

    default:
      return null;
  }
}

/* =========================================================
   MEASUREMENT LABEL
========================================================= */

function drawMeasurementLabel(
  ctx,
  text,
  x,
  y
) {
  ctx.save();

  ctx.font =
    "600 12px Inter, Arial, sans-serif";

  const metrics = ctx.measureText(text);

  const paddingX = 9;
  const height = 26;

  const width =
    metrics.width + paddingX * 2;

  const pageWidth =
    ctx.canvas._geoPageWidth ||
    ctx.canvas.width;

  const pageHeight =
    ctx.canvas._geoPageHeight ||
    ctx.canvas.height;

  let labelX = x;
  let labelY = y;

  if (labelX + width > pageWidth - 8) {
    labelX = pageWidth - width - 8;
  }

  if (labelX < 8) {
    labelX = 8;
  }

  if (labelY - height < 8) {
    labelY = height + 8;
  }

  if (labelY > pageHeight - 8) {
    labelY = pageHeight - 8;
  }

  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = "#ffffff";

  ctx.beginPath();

  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(
      labelX,
      labelY - height,
      width,
      height,
      7
    );
  } else {
    ctx.rect(
      labelX,
      labelY - height,
      width,
      height
    );
  }

  ctx.fill();

  ctx.shadowColor = "transparent";

  ctx.fillStyle = "#0f172a";

  ctx.fillText(
    text,
    labelX + paddingX,
    labelY - 9
  );

  ctx.restore();
}

/* =========================================================
   COMPONENT
========================================================= */

export default function GeometryLayer({
  width: pageWidth,
  height: pageHeight,
  zoom,
}) {
  const {
    activeTool,
    currentPageData,

    selectedObjectId,
    setSelectedObjectId,

    addGeometryObject,
    updateGeometryObject,
    removeGeometryObject,

    strokeColor,
    strokeWidth,

    setLiveCoords,

    geometryToolSize,

    snapToTools,
  } = useStore();

  const canvasRef = useRef(null);

  const drawingShapeRef = useRef(null);

  const dragStateRef = useRef(null);

  const angleStepRef = useRef(0);

  const angleDraftRef = useRef(null);

  const [
    drawingShape,
    setDrawingShape,
  ] = useState(null);

  const [
    hoveredObjectId,
    setHoveredObjectId,
  ] = useState(null);

  const geometryObjects =
    currentPageData?.geometryObjects || [];

  const geometryIsInteractive =
    GEOMETRY_TOOLS.includes(activeTool);

  /* =========================================================
     RESET TEMPORARY STATE WHEN TOOL CHANGES
  ========================================================= */

  useEffect(() => {
    drawingShapeRef.current = null;
    setDrawingShape(null);

    dragStateRef.current = null;

    angleStepRef.current = 0;
    angleDraftRef.current = null;

    setHoveredObjectId(null);
  }, [activeTool]);

  /* =========================================================
     FIND OBJECT AT POINT
  ========================================================= */

  const findObjectAtPoint = useCallback(
    (point) => {
      for (
        let i = geometryObjects.length - 1;
        i >= 0;
        i--
      ) {
        const object =
          geometryObjects[i];

        const model =
          getModelForObject(object);

        if (!model?.hitTest) {
          continue;
        }

        try {
          const hit =
            model.hitTest(
              object,
              point
            );

          if (hit) {
            return {
              object,

              part:
                typeof hit === "string"
                  ? hit
                  : hit.part || "body",
            };
          }
        } catch (error) {
          console.error(
            "Geometry hit-test error:",
            error
          );
        }
      }

      return null;
    },
    [geometryObjects]
  );

  /* =========================================================
     LIVE LINE MEASUREMENT
  ========================================================= */

  const drawLiveLineMeasurement =
    useCallback(
      (ctx, line) => {
        if (
          !line?.start ||
          !line?.end
        ) {
          return;
        }

        const length =
          distance(
            line.start,
            line.end
          );

        const cm =
          pointsToCm(length);

        const midX =
          (line.start.x +
            line.end.x) /
          2;

        const midY =
          (line.start.y +
            line.end.y) /
          2;

        drawMeasurementLabel(
          ctx,
          `Length = ${formatCm(cm)}`,
          midX + 12,
          midY - 12
        );
      },
      []
    );

  /* =========================================================
     LIVE CIRCLE MEASUREMENT
  ========================================================= */

  const drawLiveCircleMeasurement =
    useCallback(
      (ctx, circle) => {
        if (!circle?.center) {
          return;
        }

        const radius =
          Number(circle.radius) || 0;

        const diameter =
          radius * 2;

        const radiusCm =
          pointsToCm(radius);

        const diameterCm =
          pointsToCm(diameter);

        const angle =
          circle.measurementAngle ??
          -Math.PI / 4;

        const distanceFromCenter =
          Math.max(radius, 35);

        const labelX =
          circle.center.x +
          Math.cos(angle) *
            distanceFromCenter +
          15;

        const labelY =
          circle.center.y +
          Math.sin(angle) *
            distanceFromCenter;

        drawMeasurementLabel(
          ctx,
          `R = ${formatCm(
            radiusCm
          )}  •  D = ${formatCm(
            diameterCm
          )}`,
          labelX,
          labelY
        );
      },
      []
    );

  /* =========================================================
     LIVE ANGLE
  ========================================================= */

  const drawLiveAngle =
    useCallback(
      (ctx, draft) => {
        if (!draft?.B) {
          return;
        }

        const B = draft.B;

        ctx.save();

        ctx.fillStyle =
          "#2563eb";

        ctx.beginPath();

        ctx.arc(
          B.x,
          B.y,
          5,
          0,
          Math.PI * 2
        );

        ctx.fill();

        /* ---------------------------------------------------
           ARM A
        --------------------------------------------------- */

        if (draft.A) {
          ctx.strokeStyle =
            strokeColor ||
            "#2563eb";

          ctx.lineWidth =
            strokeWidth || 2.5;

          ctx.beginPath();

          ctx.moveTo(
            B.x,
            B.y
          );

          ctx.lineTo(
            draft.A.x,
            draft.A.y
          );

          ctx.stroke();

          ctx.fillStyle =
            "#2563eb";

          ctx.beginPath();

          ctx.arc(
            draft.A.x,
            draft.A.y,
            5,
            0,
            Math.PI * 2
          );

          ctx.fill();
        }

        /* ---------------------------------------------------
           ARM C
        --------------------------------------------------- */

        if (
          draft.A &&
          draft.C
        ) {
          ctx.strokeStyle =
            strokeColor ||
            "#2563eb";

          ctx.lineWidth =
            strokeWidth || 2.5;

          ctx.beginPath();

          ctx.moveTo(
            B.x,
            B.y
          );

          ctx.lineTo(
            draft.C.x,
            draft.C.y
          );

          ctx.stroke();

          const BAx =
            draft.A.x - B.x;

          const BAy =
            draft.A.y - B.y;

          const BCx =
            draft.C.x - B.x;

          const BCy =
            draft.C.y - B.y;

          const lenA =
            Math.hypot(
              BAx,
              BAy
            );

          const lenC =
            Math.hypot(
              BCx,
              BCy
            );

          if (
            lenA > 0 &&
            lenC > 0
          ) {
            const dot =
              BAx * BCx +
              BAy * BCy;

            const cosine =
              clamp(
                dot /
                  (lenA * lenC),
                -1,
                1
              );

            const angle =
              (Math.acos(
                cosine
              ) *
                180) /
              Math.PI;

            const start =
              Math.atan2(
                BAy,
                BAx
              );

            const end =
              Math.atan2(
                BCy,
                BCx
              );

            const arcRadius =
              Math.min(
                40,
                lenA * 0.35,
                lenC * 0.35
              );

            if (
              arcRadius > 5
            ) {
              ctx.strokeStyle =
                "#2563eb";

              ctx.lineWidth = 2;

              ctx.beginPath();

              ctx.arc(
                B.x,
                B.y,
                arcRadius,
                start,
                end,
                false
              );

              ctx.stroke();

              const signed =
                getSignedAngleDifference(
                  (start * 180) /
                    Math.PI,
                  (end * 180) /
                    Math.PI
                );

              const mid =
                start +
                ((signed * Math.PI) /
                  180) /
                  2;

              drawMeasurementLabel(
                ctx,
                `${angle.toFixed(1)}°`,
                B.x +
                  Math.cos(mid) *
                    (arcRadius + 25),
                B.y +
                  Math.sin(mid) *
                    (arcRadius + 25)
              );
            }
          }

          ctx.fillStyle =
            "#2563eb";

          ctx.beginPath();

          ctx.arc(
            draft.C.x,
            draft.C.y,
            5,
            0,
            Math.PI * 2
          );

          ctx.fill();
        }

        ctx.restore();
      },
      [
        strokeColor,
        strokeWidth,
      ]
    );

  /* =========================================================
     RENDER CANVAS
  ========================================================= */

  const renderCanvas =
    useCallback(() => {
      const canvas =
        canvasRef.current;

      if (!canvas) {
        return;
      }

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      const safeZoom =
        Number(zoom) || 1;

      const safePageWidth =
        Number(pageWidth) || 1;

      const safePageHeight =
        Number(pageHeight) || 1;

      const dpr =
        window.devicePixelRatio || 1;

      const renderedWidth =
        safePageWidth * safeZoom;

      const renderedHeight =
        safePageHeight * safeZoom;

      canvas._geoPageWidth =
        safePageWidth;

      canvas._geoPageHeight =
        safePageHeight;

      /* ---------------------------------------------------
         Canvas bitmap
      --------------------------------------------------- */

      canvas.width =
        Math.max(
          1,
          Math.round(
            renderedWidth * dpr
          )
        );

      canvas.height =
        Math.max(
          1,
          Math.round(
            renderedHeight * dpr
          )
        );

      canvas.style.width =
        `${renderedWidth}px`;

      canvas.style.height =
        `${renderedHeight}px`;

      /* ---------------------------------------------------
         Page-coordinate drawing
      --------------------------------------------------- */

      ctx.setTransform(
        dpr * safeZoom,
        0,
        0,
        dpr * safeZoom,
        0,
        0
      );

      ctx.clearRect(
        0,
        0,
        safePageWidth,
        safePageHeight
      );

      /* ---------------------------------------------------
         Saved geometry
      --------------------------------------------------- */

      geometryObjects.forEach(
        (object) => {
          const model =
            getModelForObject(
              object
            );

          if (!model?.draw) {
            return;
          }

          try {
            model.draw(
              ctx,
              object,
              object.id === selectedObjectId,
              object.id === hoveredObjectId
            );
          } catch (error) {
            console.error(
              "Geometry draw error:",
              object,
              error
            );
          }
        }
      );

      /* ---------------------------------------------------
         Live geometry
      --------------------------------------------------- */

      const live =
        drawingShapeRef.current;

      if (live) {
        if (
          live.type ===
          "angle"
        ) {
          drawLiveAngle(
            ctx,
            live
          );
        } else if (
          live.type ===
          "arc"
        ) {
          // Drawn entirely by the dedicated "LIVE COMPASS
          // ARC" block below (dashed preview + R/angle
          // readouts) - skip the generic model draw here so
          // the sweep doesn't get double-rendered.
        } else {
          const liveModel =
            getModelForObject(
              live
            );

          if (liveModel?.draw) {
            try {
              liveModel.draw(
                ctx,
                live,
                true,
                false
              );
            } catch (error) {
              console.error(
                "Live geometry draw error:",
                error
              );
            }
          }

          if (
            live.type ===
            "line"
          ) {
            drawLiveLineMeasurement(
              ctx,
              live
            );
          }

          if (
            live.type ===
            "circle"
          ) {
            drawLiveCircleMeasurement(
              ctx,
              live
            );
          }
        }

        /* -------------------------------------------------
           LIVE COMPASS ARC
        ------------------------------------------------- */

        if (
          live.type ===
          "arc"
        ) {
            const center =
              live.center;

            const radius =
              Number(
                live.radius
              ) || 0;

            const start =
              (Number(
                live.startAngle
              ) *
                Math.PI) /
              180;

            const end =
              (Number(
                live.endAngle
              ) *
                Math.PI) /
              180;

            if (center) {
              ctx.save();

              ctx.beginPath();

              ctx.arc(
                center.x,
                center.y,
                radius,
                start,
                end,
                false
              );

              ctx.strokeStyle =
                live.color ||
                strokeColor ||
                "#2563eb";

              ctx.lineWidth =
                live.width ||
                strokeWidth ||
                2;

              ctx.setLineDash([
                7,
                5,
              ]);

              ctx.stroke();

              ctx.restore();

              drawMeasurementLabel(
                ctx,
                `R = ${formatCm(
                  pointsToCm(radius)
                )}`,
                center.x +
                  radius +
                  12,
                center.y
              );

              const angleDifference =
                Math.abs(
                  getSignedAngleDifference(
                    Number(
                      live.startAngle
                    ),
                    Number(
                      live.endAngle
                    )
                  )
                );

              const labelAngle =
                (Number(
                  live.endAngle
                ) *
                  Math.PI) /
                180;

              drawMeasurementLabel(
                ctx,
                `Angle = ${angleDifference.toFixed(
                  1
                )}°`,
                center.x +
                  Math.cos(
                    labelAngle
                  ) *
                    radius *
                    0.72,
                center.y +
                  Math.sin(
                    labelAngle
                  ) *
                    radius *
                    0.72
              );
            }
          }
        }

      /* ---------------------------------------------------
         ANGLE DRAFT
      --------------------------------------------------- */

      if (
        angleDraftRef.current
      ) {
        drawLiveAngle(
          ctx,
          angleDraftRef.current
        );
      }
    }, [
      geometryObjects,
      selectedObjectId,
      hoveredObjectId,
      pageWidth,
      pageHeight,
      zoom,
      strokeColor,
      strokeWidth,
      geometryToolSize,
      drawingShape,
      drawLiveLineMeasurement,
      drawLiveCircleMeasurement,
      drawLiveAngle,
    ]);

  /* =========================================================
     RENDER EFFECT
  ========================================================= */

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  /* =========================================================
     WINDOW RESIZE
  ========================================================= */

  useEffect(() => {
    const handleResize =
      () => {
        renderCanvas();
      };

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, [renderCanvas]);

  /* =========================================================
     BEGIN LINE
  ========================================================= */

  const beginLine =
    useCallback(
      (point) => {
        const line =
          LineModel.create(
            point,
            point,
            strokeColor,
            strokeWidth
          );

        if (!line) {
          return;
        }

        drawingShapeRef.current =
          line;

        setDrawingShape(
          line
        );

        dragStateRef.current = {
          type:
            "drawingLine",
        };
      },
      [
        strokeColor,
        strokeWidth,
      ]
    );

  /* =========================================================
     BEGIN CIRCLE
  ========================================================= */

  const beginCircle =
    useCallback(
      (point) => {
        const circle =
          CircleModel.create(
            point,
            0,
            strokeColor,
            strokeWidth
          );

        if (!circle) {
          return;
        }

        drawingShapeRef.current =
          circle;

        setDrawingShape(
          circle
        );

        dragStateRef.current = {
          type:
            "drawingCircle",
        };
      },
      [
        strokeColor,
        strokeWidth,
      ]
    );

  /* =========================================================
     POINTER DOWN
  ========================================================= */

  const handlePointerDown =
    useCallback(
      (event) => {
        if (
          !geometryIsInteractive
        ) {
          return;
        }

        const canvas =
          canvasRef.current;

        if (!canvas) {
          return;
        }

        const isLeftClick =
          event.button === 0;

        const isRightClick =
          event.button === 2;

        const compassRightClick =
          activeTool ===
            "compass" &&
          isRightClick;

        if (
          !isLeftClick &&
          !compassRightClick
        ) {
          return;
        }

        event.preventDefault();

        const point =
          getPointerPoint(
            event,
            canvas,
            Number(pageWidth) || 1,
            Number(pageHeight) || 1
          );

        setLiveCoords?.(
          point
        );

        try {
          canvas.setPointerCapture(
            event.pointerId
          );
        } catch {}

        /* ===================================================
           LINE
        =================================================== */

        if (
          activeTool ===
            "line" &&
          isLeftClick
        ) {
          beginLine(point);
          return;
        }

        /* ===================================================
           CIRCLE
        =================================================== */

        if (
          activeTool ===
            "circle" &&
          isLeftClick
        ) {
          beginCircle(point);
          return;
        }

        /* ===================================================
           ANGLE
        =================================================== */

        if (
          activeTool ===
            "angle" &&
          isLeftClick
        ) {
          const step =
            angleStepRef.current;

          /* Before starting a fresh measurement, let the
             user tap an existing angle's close (x) button
             to delete it without switching to Select. */

          if (step === 0) {
            const existingHit =
              findObjectAtPoint(
                point
              );

            if (
              existingHit?.object?.type ===
                "angle" &&
              existingHit.part ===
                "close"
            ) {
              removeGeometryObject(
                existingHit.object.id
              );

              return;
            }
          }

          /* First click = B */

          if (step === 0) {
            angleDraftRef.current = {
              type: "angle",

              A: null,

              B: {
                ...point,
              },

              C: null,

              color:
                strokeColor ||
                "#2563eb",

              width:
                strokeWidth ||
                2.5,
            };

            angleStepRef.current =
              1;

            dragStateRef.current = {
              type:
                "drawingAngle",
            };

            renderCanvas();

            return;
          }

          /* Second click = A */

          if (step === 1) {
            const draft =
              angleDraftRef.current;

            if (!draft) {
              angleStepRef.current =
                0;

              return;
            }

            angleDraftRef.current = {
              ...draft,

              A: {
                ...point,
              },
            };

            angleStepRef.current =
              2;

            renderCanvas();

            return;
          }

          /* Third click = C */

          if (step === 2) {
            const draft =
              angleDraftRef.current;

            if (
              !draft?.A ||
              !draft?.B
            ) {
              angleStepRef.current =
                0;

              angleDraftRef.current =
                null;

              dragStateRef.current =
                null;

              return;
            }

            const finalAngle = {
              id:
                createGeometryId(
                  "angle"
                ),

              type:
                "angle",

              A: {
                ...draft.A,
              },

              B: {
                ...draft.B,
              },

              C: {
                ...point,
              },

              color:
                draft.color ||
                strokeColor ||
                "#2563eb",

              width:
                draft.width ||
                strokeWidth ||
                2.5,

              arcRadius: 35,

              precision: 1,
            };

            addGeometryObject(
              finalAngle
            );

            angleStepRef.current =
              0;

            angleDraftRef.current =
              null;

            dragStateRef.current =
              null;

            renderCanvas();

            return;
          }
        }

        /* ===================================================
           SELECT
        =================================================== */

        if (
          activeTool ===
            "select" &&
          isLeftClick
        ) {
          const hit =
            findObjectAtPoint(
              point
            );

          if (!hit) {
            setSelectedObjectId(
              null
            );

            dragStateRef.current =
              null;

            return;
          }

          const {
            object,
            part,
          } = hit;

          if (
            part ===
            "close"
          ) {
            removeGeometryObject(
              object.id
            );

            return;
          }

          setSelectedObjectId(
            object.id
          );

          dragStateRef.current = {
            type:
              "selectDrag",

            objectId:
              object.id,

            part,

            startPoint: {
              ...point,
            },

            original: {
              ...object,

              x: object.x,
              y: object.y,

              center:
                object.center
                  ? {
                      ...object.center,
                    }
                  : undefined,

              start:
                object.start
                  ? {
                      ...object.start,
                    }
                  : undefined,

              end:
                object.end
                  ? {
                      ...object.end,
                    }
                  : undefined,

              A:
                object.A
                  ? {
                      ...object.A,
                    }
                  : undefined,

              B:
                object.B
                  ? {
                      ...object.B,
                    }
                  : undefined,

              C:
                object.C
                  ? {
                      ...object.C,
                    }
                  : undefined,
            },
          };

          return;
        }

        /* ===================================================
           PHYSICAL TOOLS
        =================================================== */

        if (
          PHYSICAL_TOOLS.includes(
            activeTool
          ) &&
          activeTool !==
            "compass" &&
          isLeftClick
        ) {
          const hit =
            findObjectAtPoint(
              point
            );

          if (hit) {
            if (
              hit.part ===
              "close"
            ) {
              removeGeometryObject(
                hit.object.id
              );

              return;
            }

            setSelectedObjectId(
              hit.object.id
            );

            dragStateRef.current = {
              type:
                "physicalDrag",

              objectId:
                hit.object.id,

              part:
                hit.part,

              startPoint: {
                ...point,
              },

              original: {
                ...hit.object,
              },
            };

            return;
          }

          let object = null;

          if (
            activeTool ===
            "ruler"
          ) {
            object =
              RulerModel.createDefault(
                point.x,
                point.y
              );
          }

          if (
            activeTool ===
            "protractor"
          ) {
            object =
              ProtractorModel.createDefault(
                point.x,
                point.y
              );
          }

          if (
            activeTool ===
            "setSquare45"
          ) {
            object =
              SetSquareModel.createDefault45(
                point.x,
                point.y
              );
          }

          if (
            activeTool ===
            "setSquare60"
          ) {
            object =
              SetSquareModel.createDefault60(
                point.x,
                point.y
              );
          }

          if (object) {
            addGeometryObject(
              object
            );
          }

          return;
        }

        /* ===================================================
           COMPASS
        =================================================== */

        if (
          activeTool ===
          "compass"
        ) {
          const hit =
            findObjectAtPoint(
              point
            );

          /* -------------------------------------------------
             RIGHT CLICK = PENCIL ARC
          ------------------------------------------------- */

          if (
            isRightClick &&
            hit &&
            hit.object.type ===
              "compass" &&
            hit.part ===
              "pencil"
          ) {
            const compass =
              hit.object;

            const center = {
              x:
                Number(
                  compass.x
                ) ||
                point.x,

              y:
                Number(
                  compass.y
                ) ||
                point.y,
            };

            const radius =
              clamp(
                Number(
                  compass.radius
                ) || 100,

                MIN_COMPASS_RADIUS,

                MAX_COMPASS_RADIUS
              );

            const startAngle =
              angleFromPoint(
                point,
                center
              );

            const liveArc = {
              id:
                `live-arc-${Date.now()}`,

              type:
                "arc",

              center,

              radius,

              startAngle,

              endAngle:
                startAngle,

              color:
                strokeColor ||
                "#2563eb",

              width:
                strokeWidth || 2,
            };

            drawingShapeRef.current =
              liveArc;

            setDrawingShape(
              liveArc
            );

            dragStateRef.current = {
              type:
                "compassArc",

              objectId:
                compass.id,

              center,

              radius,

              startAngle,
            };

            renderCanvas();

            return;
          }

          /* -------------------------------------------------
             LEFT CLICK
          ------------------------------------------------- */

          if (isLeftClick) {
            if (hit) {
              if (
                hit.part ===
                "close"
              ) {
                removeGeometryObject(
                  hit.object.id
                );

                return;
              }

              setSelectedObjectId(
                hit.object.id
              );

              /* Quick circle */

              if (
                hit.part ===
                  "draw_circle" ||
                hit.part ===
                  "quickDraw"
              ) {
                const compass =
                  hit.object;

                const circle =
                  CircleModel.create(
                    {
                      x:
                        compass.x ??
                        point.x,

                      y:
                        compass.y ??
                        point.y,
                    },

                    clamp(
                      Number(
                        compass.radius
                      ) || 100,

                      MIN_COMPASS_RADIUS,

                      MAX_COMPASS_RADIUS
                    ),

                    strokeColor,

                    strokeWidth
                  );

                if (circle) {
                  addGeometryObject(
                    circle
                  );
                }

                return;
              }

              return;
            }

            /* Blank area = create compass */

            const compass =
              CompassModel.create(
                point
              );

            if (compass) {
              addGeometryObject(
                compass
              );
            }
          }

          return;
        }
      },
      [
        geometryIsInteractive,
        activeTool,
        pageWidth,
        pageHeight,
        strokeColor,
        strokeWidth,
        findObjectAtPoint,
        setSelectedObjectId,
        setLiveCoords,
        removeGeometryObject,
        addGeometryObject,
        beginLine,
        beginCircle,
        renderCanvas,
      ]
    );

  /* =========================================================
     POINTER MOVE
  ========================================================= */

  const handlePointerMove =
    useCallback(
      (event) => {
        const canvas =
          canvasRef.current;

        if (!canvas) {
          return;
        }

        if (
          !geometryIsInteractive
        ) {
          return;
        }

        const point =
          getPointerPoint(
            event,
            canvas,
            Number(pageWidth) || 1,
            Number(pageHeight) || 1
          );

        setLiveCoords?.(
          point
        );

        /* ---------------------------------------------------
           SELECT HOVER
        --------------------------------------------------- */

        if (
          activeTool ===
          "select"
        ) {
          const hit =
            findObjectAtPoint(
              point
            );

          setHoveredObjectId(
            hit?.object?.id ||
              null
          );
        }

        /* ---------------------------------------------------
           CIRCLE HOVER
           (so an existing circle's radius readout only
           shows up while the Circle tool is hovering it -
           not tracked under "select", which is handled
           above, and not while actively drawing a new one)
        --------------------------------------------------- */

        if (
          activeTool ===
            "circle" &&
          !dragStateRef.current
        ) {
          const hit =
            findObjectAtPoint(
              point
            );

          setHoveredObjectId(
            hit?.object?.type ===
              "circle"
              ? hit.object.id
              : null
          );
        }

        /* ---------------------------------------------------
           LIVE ANGLE
        --------------------------------------------------- */

        if (
          activeTool ===
            "angle" &&
          angleDraftRef.current
        ) {
          const draft =
            angleDraftRef.current;

          if (
            angleStepRef.current ===
            1
          ) {
            angleDraftRef.current = {
              ...draft,

              A: {
                ...point,
              },

              C: null,
            };
          }

          if (
            angleStepRef.current ===
            2
          ) {
            angleDraftRef.current = {
              ...draft,

              C: {
                ...point,
              },
            };
          }

          renderCanvas();
        }

        const drag =
          dragStateRef.current;

        if (!drag) {
          return;
        }

        /* ===================================================
           DRAWING LINE
        =================================================== */

        if (
          drag.type ===
          "drawingLine"
        ) {
          const current =
            drawingShapeRef.current;

          if (!current?.start) {
            return;
          }

          let end = {
            ...point,
          };

          if (snapToTools) {
            const rulerAngle =
              findRulerEdgeAngle(
                geometryObjects,
                current.start
              );

            try {
              if (
                rulerAngle !== null
              ) {
                // Snap along (or perpendicular to) a ruler
                // resting near the line's start point.
                const snapped =
                  snapLineToAngle(
                    current.start,
                    end,
                    rulerAngle,
                    6
                  );

                if (snapped) {
                  end =
                    snapped.end ||
                    snapped;
                }
              } else if (
                distance(
                  current.start,
                  end
                ) > 8
              ) {
                // No ruler nearby - fall back to snapping
                // to common construction angles.
                const rawAngle =
                  angleBetweenPoints(
                    current.start,
                    end
                  );

                const snappedAngle =
                  snapAngleToIncrement(
                    rawAngle,
                    45,
                    5
                  );

                if (
                  snappedAngle !== null
                ) {
                  const len =
                    distance(
                      current.start,
                      end
                    );

                  const rad =
                    snappedAngle *
                    DEG_TO_RAD;

                  end = {
                    x:
                      current.start.x +
                      len *
                        Math.cos(rad),

                    y:
                      current.start.y +
                      len *
                        Math.sin(rad),
                  };
                }
              }
            } catch {}
          }

          const updated = {
            ...current,

            end,
          };

          drawingShapeRef.current =
            updated;

          setDrawingShape(
            updated
          );

          renderCanvas();

          return;
        }

        /* ===================================================
           DRAWING CIRCLE
        =================================================== */

        if (
          drag.type ===
          "drawingCircle"
        ) {
          const current =
            drawingShapeRef.current;

          if (!current?.center) {
            return;
          }

          const radius =
            distance(
              current.center,
              point
            );

          const updated = {
            ...current,

            radius:
              Math.max(
                MIN_DRAW_DISTANCE,
                radius
              ),

            measurementAngle:
              Math.atan2(
                point.y -
                  current.center.y,

                point.x -
                  current.center.x
              ),
          };

          drawingShapeRef.current =
            updated;

          setDrawingShape(
            updated
          );

          renderCanvas();

          return;
        }

        /* ===================================================
           COMPASS ARC
        =================================================== */

        if (
          drag.type ===
          "compassArc"
        ) {
          const currentAngle =
            angleFromPoint(
              point,
              drag.center
            );

          const delta =
            getSignedAngleDifference(
              drag.startAngle,
              currentAngle
            );

          // Let the sweep "catch" on clean angles
          // (15°/30°/45°/90°...) - the way a real compass
          // paired with a protractor would be used to
          // construct an exact angle.
          const snappedDelta =
            snapToTools
              ? snapSignedDeltaToIncrement(
                  delta,
                  15,
                  1.5
                )
              : null;

          const endAngle =
            drag.startAngle +
            (snappedDelta ?? delta);

          const updated = {
            id:
              drawingShapeRef.current
                ?.id ||
              `live-arc-${Date.now()}`,

            type:
              "arc",

            center:
              drag.center,

            radius:
              drag.radius,

            startAngle:
              drag.startAngle,

            endAngle,

            color:
              strokeColor ||
              "#2563eb",

            width:
              strokeWidth || 2,
          };

          drawingShapeRef.current =
            updated;

          setDrawingShape(
            updated
          );

          renderCanvas();

          return;
        }

        /* ===================================================
           SELECT DRAG
        =================================================== */

        if (
          drag.type ===
          "selectDrag"
        ) {
          const object =
            geometryObjects.find(
              (item) =>
                item.id ===
                drag.objectId
            );

          if (!object) {
            return;
          }

          const dx =
            point.x -
            drag.startPoint.x;

          const dy =
            point.y -
            drag.startPoint.y;

          const original =
            drag.original;

          /* -------------------------------------------------
             COMPASS
          ------------------------------------------------- */

          if (
            object.type ===
            "compass"
          ) {
            if (
              drag.part ===
              "pencil"
            ) {
              const center = {
                x:
                  original.x ??
                  point.x,

                y:
                  original.y ??
                  point.y,
              };

              const rawRadius =
                clamp(
                  distance(
                    center,
                    point
                  ),

                  MIN_COMPASS_RADIUS,

                  MAX_COMPASS_RADIUS
                );

              // Catch on clean half-centimetre radii when
              // close, so it's easy to land on an exact
              // "5.0 cm" instead of a continuous value.
              let radius =
                rawRadius;

              if (snapToTools) {
                const halfCmStep =
                  0.5 *
                  CompassModel.CM_TO_PT;

                const nearestSteps =
                  Math.round(
                    rawRadius /
                      halfCmStep
                  ) * halfCmStep;

                if (
                  Math.abs(
                    rawRadius -
                      nearestSteps
                  ) <= 4
                ) {
                  radius =
                    clamp(
                      nearestSteps,
                      MIN_COMPASS_RADIUS,
                      MAX_COMPASS_RADIUS
                    );
                }
              }

              const rotation =
                angleFromPoint(
                  point,
                  center
                );

              updateGeometryObject(
                object.id,
                {
                  radius,
                  rotation,
                }
              );

              return;
            }

            updateGeometryObject(
              object.id,
              {
                x:
                  (original.x ?? 0) +
                  dx,

                y:
                  (original.y ?? 0) +
                  dy,
              }
            );

            return;
          }

          /* -------------------------------------------------
             RULER
          ------------------------------------------------- */

          if (
            object.type ===
            "ruler"
          ) {
            if (
              drag.part ===
              "rotate"
            ) {
              const center = {
                x:
                  (original.x ??
                    0) +
                  (original.width ??
                    0) /
                    2,

                y:
                  original.y ?? 0,
              };

              // Slow, damped rotation: move only a
              // fraction of the way toward the pointer's
              // angle each frame instead of snapping to it.
              const targetRotation =
                angleFromPoint(
                  point,
                  center
                );

              const currentRotation =
                object.rotation ?? 0;

              const delta =
                getSignedAngleDifference(
                  currentRotation,
                  targetRotation
                );

              const rawRotation =
                currentRotation +
                delta *
                  ROTATE_DAMPING;

              // Let common drafting angles "catch" the
              // rotation once it's close, like a magnetic
              // detent on a real ruler.
              const snappedRulerRotation =
                snapToTools
                  ? snapAngleToIncrement(
                      rawRotation,
                      15,
                      1.5
                    )
                  : null;

              const rotation =
                snappedRulerRotation ??
                rawRotation;

              updateGeometryObject(
                object.id,
                {
                  rotation,
                }
              );

              return;
            }

            if (
              drag.part ===
              "resize"
            ) {
              const newWidth =
                clamp(
                  point.x -
                    (original.x ??
                      0),

                  RulerModel.MIN_LENGTH ||
                    120,

                  RulerModel.MAX_LENGTH ||
                    2400
                );

              updateGeometryObject(
                object.id,
                {
                  width:
                    newWidth,
                }
              );

              return;
            }

            updateGeometryObject(
              object.id,
              {
                x:
                  (original.x ?? 0) +
                  dx,

                y:
                  (original.y ?? 0) +
                  dy,
              }
            );

            return;
          }

          /* -------------------------------------------------
             PROTRACTOR
          ------------------------------------------------- */

          if (
            object.type ===
            "protractor"
          ) {
            if (
              drag.part ===
              "rotate"
            ) {
              const center = {
                x:
                  original.x ?? 0,

                y:
                  original.y ?? 0,
              };

              const targetRotation =
                angleFromPoint(
                  point,
                  center
                );

              const currentRotation =
                object.rotation ?? 0;

              const delta =
                getSignedAngleDifference(
                  currentRotation,
                  targetRotation
                );

              const rawRotation =
                currentRotation +
                delta *
                  ROTATE_DAMPING;

              const snappedProtractorRotation =
                snapToTools
                  ? snapAngleToIncrement(
                      rawRotation,
                      15,
                      1.5
                    )
                  : null;

              const rotation =
                snappedProtractorRotation ??
                rawRotation;

              updateGeometryObject(
                object.id,
                {
                  rotation,
                }
              );

              return;
            }

            if (
              drag.part ===
              "resize"
            ) {
              const radius =
                clamp(
                  distance(
                    {
                      x:
                        original.x ??
                        0,

                      y:
                        original.y ??
                        0,
                    },

                    point
                  ),

                  MIN_PROTRACTOR_RADIUS,

                  MAX_PROTRACTOR_RADIUS
                );

              updateGeometryObject(
                object.id,
                {
                  radius,
                }
              );

              return;
            }

            updateGeometryObject(
              object.id,
              {
                x:
                  (original.x ?? 0) +
                  dx,

                y:
                  (original.y ?? 0) +
                  dy,
              }
            );

            return;
          }

          /* -------------------------------------------------
             SET SQUARE
          ------------------------------------------------- */

          if (
            object.type ===
              "setSquare45" ||
            object.type ===
              "setSquare60"
          ) {
            if (
              drag.part ===
              "rotate"
            ) {
              const rotation =
                angleFromPoint(
                  point,
                  {
                    x:
                      original.x ??
                      0,

                    y:
                      original.y ??
                      0,
                  }
                );

              updateGeometryObject(
                object.id,
                {
                  rotation,
                }
              );

              return;
            }

            if (
              drag.part ===
              "resize"
            ) {
              const size =
                clamp(
                  distance(
                    {
                      x:
                        original.x ??
                        0,

                      y:
                        original.y ??
                        0,
                    },

                    point
                  ),

                  60,
                  1000
                );

              updateGeometryObject(
                object.id,
                {
                  size,
                }
              );

              return;
            }

            updateGeometryObject(
              object.id,
              {
                x:
                  (original.x ?? 0) +
                  dx,

                y:
                  (original.y ?? 0) +
                  dy,
              }
            );

            return;
          }

          /* -------------------------------------------------
             LINE
          ------------------------------------------------- */

          if (
            object.type ===
            "line"
          ) {
            if (
              drag.part ===
              "start"
            ) {
              updateGeometryObject(
                object.id,
                {
                  start: {
                    x:
                      original.start
                        .x +
                      dx,

                    y:
                      original.start
                        .y +
                      dy,
                  },
                }
              );

              return;
            }

            if (
              drag.part ===
              "end"
            ) {
              updateGeometryObject(
                object.id,
                {
                  end: {
                    x:
                      original.end
                        .x +
                      dx,

                    y:
                      original.end
                        .y +
                      dy,
                  },
                }
              );

              return;
            }

            updateGeometryObject(
              object.id,
              {
                start: {
                  x:
                    original.start
                      .x +
                    dx,

                  y:
                    original.start
                      .y +
                    dy,
                },

                end: {
                  x:
                    original.end
                      .x +
                    dx,

                  y:
                    original.end
                      .y +
                    dy,
                },
              }
            );

            return;
          }

          /* -------------------------------------------------
             CIRCLE
          ------------------------------------------------- */

          if (
            object.type ===
            "circle"
          ) {
            if (
              drag.part ===
              "radius"
            ) {
              const radius =
                Math.max(
                  MIN_DRAW_DISTANCE,

                  distance(
                    original.center,
                    point
                  )
                );

              updateGeometryObject(
                object.id,
                {
                  radius,
                }
              );

              return;
            }

            updateGeometryObject(
              object.id,
              {
                center: {
                  x:
                    original.center
                      .x +
                    dx,

                  y:
                    original.center
                      .y +
                    dy,
                },
              }
            );

            return;
          }

          /* -------------------------------------------------
             ARC
          ------------------------------------------------- */

          if (
            object.type ===
            "arc"
          ) {
            if (
              drag.part ===
              "start"
            ) {
              updateGeometryObject(
                object.id,
                {
                  startAngle:
                    angleFromPoint(
                      point,
                      original.center
                    ),
                }
              );

              return;
            }

            if (
              drag.part ===
              "end"
            ) {
              updateGeometryObject(
                object.id,
                {
                  endAngle:
                    angleFromPoint(
                      point,
                      original.center
                    ),
                }
              );

              return;
            }

            updateGeometryObject(
              object.id,
              {
                center: {
                  x:
                    original.center
                      .x +
                    dx,

                  y:
                    original.center
                      .y +
                    dy,
                },
              }
            );

            return;
          }

          /* -------------------------------------------------
             ANGLE
          ------------------------------------------------- */

          if (
            object.type ===
            "angle"
          ) {
            if (
              drag.part ===
              "vertex_B"
            ) {
              updateGeometryObject(
                object.id,
                {
                  B: {
                    x:
                      original.B.x +
                      dx,

                    y:
                      original.B.y +
                      dy,
                  },
                }
              );

              return;
            }

            if (
              drag.part ===
              "point_A"
            ) {
              updateGeometryObject(
                object.id,
                {
                  A: {
                    x:
                      original.A.x +
                      dx,

                    y:
                      original.A.y +
                      dy,
                  },
                }
              );

              return;
            }

            if (
              drag.part ===
              "point_C"
            ) {
              updateGeometryObject(
                object.id,
                {
                  C: {
                    x:
                      original.C.x +
                      dx,

                    y:
                      original.C.y +
                      dy,
                  },
                }
              );

              return;
            }

            updateGeometryObject(
              object.id,
              {
                A: {
                  x:
                    original.A.x +
                    dx,

                  y:
                    original.A.y +
                    dy,
                },

                B: {
                  x:
                    original.B.x +
                    dx,

                  y:
                    original.B.y +
                    dy,
                },

                C: {
                  x:
                    original.C.x +
                    dx,

                  y:
                    original.C.y +
                    dy,
                },
              }
            );

            return;
          }

          /* -------------------------------------------------
             GENERIC X/Y
          ------------------------------------------------- */

          if (
            object.x !==
              undefined ||
            object.y !==
              undefined
          ) {
            updateGeometryObject(
              object.id,
              {
                x:
                  (original.x ?? 0) +
                  dx,

                y:
                  (original.y ?? 0) +
                  dy,
              }
            );

            return;
          }

          /* -------------------------------------------------
             GENERIC CENTER
          ------------------------------------------------- */

          if (
            object.center
          ) {
            updateGeometryObject(
              object.id,
              {
                center: {
                  x:
                    original.center
                      .x +
                    dx,

                  y:
                    original.center
                      .y +
                    dy,
                },
              }
            );
          }

          return;
        }

        /* ===================================================
           PHYSICAL DRAG
        =================================================== */

        if (
          drag.type ===
          "physicalDrag"
        ) {
          const object =
            geometryObjects.find(
              (item) =>
                item.id ===
                drag.objectId
            );

          if (!object) {
            return;
          }

          const dx =
            point.x -
            drag.startPoint.x;

          const dy =
            point.y -
            drag.startPoint.y;

          updateGeometryObject(
            object.id,
            {
              x:
                (drag.original.x ??
                  0) +
                dx,

              y:
                (drag.original.y ??
                  0) +
                dy,
            }
          );
        }
      },
      [
        geometryIsInteractive,
        activeTool,
        geometryObjects,
        pageWidth,
        pageHeight,
        findObjectAtPoint,
        setLiveCoords,
        updateGeometryObject,
        strokeColor,
        strokeWidth,
        renderCanvas,
        snapToTools,
      ]
    );

  /* =========================================================
     POINTER UP
  ========================================================= */

  const handlePointerUp =
    useCallback(
      (event) => {
        const canvas =
          canvasRef.current;

        const drag =
          dragStateRef.current;

        if (!drag) {
          return;
        }

        /* ===================================================
           LINE
        =================================================== */

        if (
          drag.type ===
          "drawingLine"
        ) {
          const line =
            drawingShapeRef.current;

          if (
            line?.start &&
            line?.end &&
            distance(
              line.start,
              line.end
            ) >=
              MIN_DRAW_DISTANCE
          ) {
            addGeometryObject({
              ...line,

              id:
                createGeometryId(
                  "line"
                ),
            });
          }
        }

        /* ===================================================
           CIRCLE
        =================================================== */

        if (
          drag.type ===
          "drawingCircle"
        ) {
          const circle =
            drawingShapeRef.current;

          if (
            circle &&
            Number(circle.radius) >=
              MIN_DRAW_DISTANCE
          ) {
            const finalCircle = {
              ...circle,

              id:
                createGeometryId(
                  "circle"
                ),
            };

            delete finalCircle.measurementAngle;

            addGeometryObject(
              finalCircle
            );
          }
        }

        /* ===================================================
           COMPASS ARC
        =================================================== */

        if (
          drag.type ===
          "compassArc"
        ) {
          const arc =
            drawingShapeRef.current;

          if (arc) {
            const angleDifference =
              Math.abs(
                getSignedAngleDifference(
                  Number(
                    arc.startAngle
                  ),
                  Number(
                    arc.endAngle
                  )
                )
              );

            if (
              angleDifference >=
              2
            ) {
              const finalArc =
                ArcModel.create(
                  arc.center,
                  arc.radius,
                  arc.startAngle,
                  arc.endAngle,
                  arc.color ||
                    strokeColor ||
                    "#2563eb",
                  arc.width ||
                    strokeWidth ||
                    2
                );

              if (finalArc) {
                addGeometryObject({
                  ...finalArc,

                  id:
                    createGeometryId(
                      "arc"
                    ),
                });
              }
            }
          }
        }

        /* ===================================================
           CLEANUP
        =================================================== */

        drawingShapeRef.current =
          null;

        setDrawingShape(
          null
        );

        dragStateRef.current =
          null;

        if (canvas) {
          try {
            canvas.releasePointerCapture(
              event.pointerId
            );
          } catch {}
        }
      },
      [
        addGeometryObject,
        strokeColor,
        strokeWidth,
      ]
    );

  /* =========================================================
     POINTER CANCEL
  ========================================================= */

  const handlePointerCancel =
    useCallback(() => {
      drawingShapeRef.current =
        null;

      setDrawingShape(
        null
      );

      dragStateRef.current =
        null;

      angleStepRef.current =
        0;

      angleDraftRef.current =
        null;
    }, []);

  /* =========================================================
     DELETE / BACKSPACE
  ========================================================= */

  useEffect(() => {
    const handleKeyDown =
      (event) => {
        if (
          activeTool !==
          "select"
        ) {
          return;
        }

        if (
          event.key !==
            "Delete" &&
          event.key !==
            "Backspace"
        ) {
          return;
        }

        if (
          !selectedObjectId
        ) {
          return;
        }

        const exists =
          geometryObjects.some(
            (object) =>
              object.id ===
              selectedObjectId
          );

        if (!exists) {
          return;
        }

        event.preventDefault();

        removeGeometryObject(
          selectedObjectId
        );
      };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    activeTool,
    selectedObjectId,
    geometryObjects,
    removeGeometryObject,
  ]);

  /* =========================================================
     DISABLE BROWSER CONTEXT MENU
  ========================================================= */

  const handleContextMenu =
    useCallback(
      (event) => {
        event.preventDefault();
      },
      []
    );

  /* =========================================================
     CURSOR
  ========================================================= */

  let cursor =
    "default";

  if (
    activeTool === "line" ||
    activeTool === "circle" ||
    activeTool === "angle" ||
    activeTool === "compass" ||
    PHYSICAL_TOOLS.includes(
      activeTool
    )
  ) {
    cursor =
      "crosshair";
  }

  if (
    activeTool ===
    "select"
  ) {
    cursor =
      "default";
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <canvas
      ref={canvasRef}
      className="geometry-layer"
      onPointerDown={
        handlePointerDown
      }
      onPointerMove={
        handlePointerMove
      }
      onPointerUp={
        handlePointerUp
      }
      onPointerCancel={
        handlePointerCancel
      }
      onContextMenu={
        handleContextMenu
      }
      style={{
        position:
          "absolute",

        left: 0,
        top: 0,

        width:
          `${Number(pageWidth) * Number(zoom)}px`,

        height:
          `${Number(pageHeight) * Number(zoom)}px`,

        zIndex: 30,

        display:
          "block",

        pointerEvents:
          geometryIsInteractive
            ? "auto"
            : "none",

        touchAction:
          geometryIsInteractive
            ? "none"
            : "auto",

        cursor,

        userSelect:
          "none",
      }}
    />
  );
}