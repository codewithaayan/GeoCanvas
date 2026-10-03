/**
 * SmartPenController - the framework-independent "brain" of the Smart Pen.
 *
 *   SmartPenInput -> StrokeManager -> StrokeSmoother -> ShapeRecognizer
 *     -> GeometryCorrector -> ShapeRenderer -> canvas
 *
 * This class glues the modules together without knowing anything about React
 * or the canvas component:
 *   analyze()   finished rough stroke  -> decision + clean annotation
 *   morph*()    rough -> clean animation data
 *   hitTest() / beginEdit() / updateEdit()   move, resize, rotate afterwards
 */

import { recognizeStroke } from './shaperecognizer.js';
import {
  correctGeometry,
  specToPoints,
  transformSpec,
  isClosedSpec
} from './geometrycorrector.js';
import {
  prepareMorph,
  selectionFrame,
  hitHandle,
  oppositeCorner
} from './shaperenderer.js';
import {
  clamp,
  dist,
  distanceToPolyline,
  pointInPolygon
} from './geometrymath.js';

export const CONFIDENCE = {
  auto: 0.8, // >= auto    : replace immediately (undo available)
  preview: 0.55 // >= preview : show a dashed suggestion, user accepts / rejects
  //  below preview: keep the original drawing
};

export const MORPH_DURATION = 240; // ms

export class SmartPenController {
  constructor(thresholds = {}) {
    this.thresholds = { ...CONFIDENCE, ...thresholds };
  }

  // -------------------------------------------------------------------------
  // Recognition
  // -------------------------------------------------------------------------

  /**
   * @param rawStroke  finished stroke ({ id, color, width, points:[{x,y,t}] })
   * @param unit       document units per CSS pixel (1 / zoom)
   * @returns {
   *   mode: 'auto' | 'preview' | 'keep',
   *   confidence, kind, label,
   *   corrected: annotation | null,
   *   recognition
   * }
   */
  analyze(rawStroke, { unit = 1 } = {}) {
    const recognition = recognizeStroke(rawStroke.points, { unit });

    if (!recognition || recognition.confidence < this.thresholds.preview) {
      return {
        mode: 'keep',
        confidence: recognition ? recognition.confidence : 0,
        kind: recognition ? recognition.kind : null,
        label: null,
        corrected: null,
        recognition
      };
    }

    const geometry = correctGeometry(recognition);
    const corrected = this.buildAnnotation(rawStroke, geometry, recognition);

    return {
      mode: recognition.confidence >= this.thresholds.auto ? 'auto' : 'preview',
      confidence: recognition.confidence,
      kind: geometry.kind,
      label: geometry.label,
      corrected,
      recognition
    };
  }

  /** Corrected annotation: same id and style as the rough stroke. */
  buildAnnotation(rawStroke, geometry, recognition) {
    const { points: _rawPoints, pointerType: _pt, ...style } = rawStroke;
    return {
      ...style,
      points: geometry.points,
      polyline: true, // draw with straight segments (sharp corners)
      shapeRecognized: geometry.kind,
      shape: geometry.spec, // editable description of the shape
      smartConfidence: Math.round(recognition.confidence * 100) / 100
    };
  }

  // -------------------------------------------------------------------------
  // Morph animation data
  // -------------------------------------------------------------------------

  createMorph(rawStroke, corrected, now = performance.now()) {
    const closed = !!(corrected.shape && isClosedSpec(corrected.shape));
    const { from, to } = prepareMorph(rawStroke.points, corrected.points, closed);
    return {
      id: corrected.id,
      from,
      to,
      start: now,
      duration: MORPH_DURATION,
      style: {
        color: corrected.color,
        width: corrected.width,
        opacity: corrected.opacity
      }
    };
  }

  morphProgress(morph, now = performance.now()) {
    return clamp((now - morph.start) / morph.duration, 0, 1);
  }

  // -------------------------------------------------------------------------
  // Editing: hit test, move, resize, rotate
  // -------------------------------------------------------------------------

  /** Top-most ink stroke under the point (outline first, then fill area). */
  hitTest(annotations, point, zoom = 1) {
    let interior = null;

    for (let i = annotations.length - 1; i >= 0; i--) {
      const ann = annotations[i];
      if (ann.type !== 'pen' && ann.type !== 'highlighter') continue;
      if (!ann.points || ann.points.length === 0) continue;

      const tol = (ann.width || 3) / 2 + 10 / zoom;
      if (distanceToPolyline(point, ann.points, false) <= tol) return ann;

      if (
        !interior &&
        ann.shape &&
        isClosedSpec(ann.shape) &&
        pointInPolygon(point, ann.points)
      ) {
        interior = ann;
      }
    }
    return interior;
  }

  frameFor(annotation, zoom = 1) {
    return selectionFrame(annotation.points, annotation.width || 3, zoom);
  }

  /** Which handle of the selected stroke is under the point? */
  handleAt(annotation, point, zoom = 1) {
    return hitHandle(this.frameFor(annotation, zoom), point, zoom);
  }

  beginEdit(annotation, handle, startPoint, zoom = 1) {
    const spec = annotation.shape || {
      kind: 'freehand',
      points: annotation.points
    };
    return {
      id: annotation.id,
      handle: handle || 'move',
      start: startPoint,
      original: annotation,
      spec,
      frame: this.frameFor(annotation, zoom)
    };
  }

  /** Returns the edited annotation for the current pointer position. */
  updateEdit(session, point) {
    const { handle, start, spec, frame, original } = session;
    let next;

    if (handle === 'move') {
      next = transformSpec(spec, {
        dx: point.x - start.x,
        dy: point.y - start.y
      });
    } else if (handle === 'rotate') {
      const c = frame.center;
      const rotation =
        Math.atan2(point.y - c.y, point.x - c.x) -
        Math.atan2(start.y - c.y, start.x - c.x);
      next = transformSpec(spec, { pivot: c, rotation });
    } else {
      const pivot = oppositeCorner(frame, handle);
      const base = dist(start, pivot) || 1;
      const scale = clamp(dist(point, pivot) / base, 0.05, 40);
      next = transformSpec(spec, { pivot, scale });
    }

    return {
      ...original,
      points: specToPoints(next),
      shape: original.shape ? next : undefined
    };
  }
}