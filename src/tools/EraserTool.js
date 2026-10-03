import { distance } from '../geometry/math';

let partCounter = 0;

/**
 * Find the portion of segment A -> B that lies inside a circle.
 *
 * Returns:
 *   [t1, t2] where 0 <= t1 <= t2 <= 1
 *
 * Returns null if the segment does not intersect the circle.
 */
function segmentCircleInterval(a, b, center, radius) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  const fx = a.x - center.x;
  const fy = a.y - center.y;

  const A = dx * dx + dy * dy;

  // A very tiny segment / point
  if (A < 1e-9) {
    const inside =
      fx * fx + fy * fy <= radius * radius;

    return inside ? [0, 1] : null;
  }

  const B = 2 * (fx * dx + fy * dy);
  const C =
    fx * fx +
    fy * fy -
    radius * radius;

  const discriminant =
    B * B -
    4 * A * C;

  if (discriminant < 0) {
    return null;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);

  let t1 =
    (-B - sqrtDiscriminant) /
    (2 * A);

  let t2 =
    (-B + sqrtDiscriminant) /
    (2 * A);

  // Make sure t1 <= t2
  if (t1 > t2) {
    [t1, t2] = [t2, t1];
  }

  // Entire intersection is outside the segment
  if (t2 < 0 || t1 > 1) {
    return null;
  }

  t1 = Math.max(0, t1);
  t2 = Math.min(1, t2);

  return [t1, t2];
}

/**
 * Interpolate between two points.
 */
function lerpPoint(a, b, t) {
  const pressureA = a.pressure ?? 0.5;
  const pressureB = b.pressure ?? 0.5;

  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    pressure:
      pressureA +
      (pressureB - pressureA) * t
  };
}

/**
 * Calculate total length of a stroke/run.
 */
function runLength(run) {
  let length = 0;

  for (let i = 1; i < run.length; i++) {
    length += Math.hypot(
      run[i].x - run[i - 1].x,
      run[i].y - run[i - 1].y
    );
  }

  return length;
}

/**
 * Add a point to a run while avoiding duplicate points.
 */
function pushPoint(run, point) {
  const last = run[run.length - 1];

  if (
    !last ||
    Math.hypot(
      last.x - point.x,
      last.y - point.y
    ) > 0.05
  ) {
    run.push({
      x: point.x,
      y: point.y,
      pressure: point.pressure ?? 0.5
    });
  }
}

/**
 * Cut a stroke with a circular eraser.
 *
 * Returns:
 *   null -> stroke was untouched
 *   []   -> stroke was completely erased
 *   runs -> surviving pieces
 */
function cutStroke(points, center, radius) {
  if (!points || points.length === 0) {
    return null;
  }

  // Single-point stroke / dot
  if (points.length === 1) {
    return distance(points[0], center) <= radius
      ? []
      : null;
  }

  const runs = [];

  let currentRun = [];
  let touched = false;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    const hit = segmentCircleInterval(
      a,
      b,
      center,
      radius
    );

    /**
     * Segment does not intersect eraser.
     */
    if (!hit) {
      pushPoint(currentRun, a);
      pushPoint(currentRun, b);
      continue;
    }

    touched = true;

    const [t1, t2] = hit;

    /**
     * Portion BEFORE the eraser.
     */
    if (t1 > 1e-6) {
      pushPoint(currentRun, a);

      pushPoint(
        currentRun,
        lerpPoint(a, b, t1)
      );
    }

    /**
     * The middle portion is erased.
     *
     * Close the current surviving run.
     */
    if (currentRun.length > 0) {
      runs.push(currentRun);
      currentRun = [];
    }

    /**
     * Portion AFTER the eraser.
     */
    if (t2 < 1 - 1e-6) {
      pushPoint(
        currentRun,
        lerpPoint(a, b, t2)
      );

      pushPoint(currentRun, b);
    }
  }

  /**
   * Add final surviving run.
   */
  if (currentRun.length > 0) {
    runs.push(currentRun);
  }

  /**
   * Nothing was actually touched.
   */
  if (!touched) {
    return null;
  }

  /**
   * Closed shape handling.
   *
   * If a circle/rectangle/square begins and ends at
   * approximately the same point, the two surviving
   * ends can be joined back together.
   */
  const first = points[0];
  const last = points[points.length - 1];

  const isClosed =
    Math.hypot(
      first.x - last.x,
      first.y - last.y
    ) < 0.5;

  if (isClosed && runs.length >= 2) {
    const head = runs[0];
    const tail = runs[runs.length - 1];

    const headStartsAtOrigin =
      head.length > 0 &&
      Math.hypot(
        head[0].x - first.x,
        head[0].y - first.y
      ) < 0.5;

    const tailEndsAtOrigin =
      tail.length > 0 &&
      Math.hypot(
        tail[tail.length - 1].x - last.x,
        tail[tail.length - 1].y - last.y
      ) < 0.5;

    if (
      headStartsAtOrigin &&
      tailEndsAtOrigin
    ) {
      runs.splice(0, 1);

      runs[runs.length - 1] =
        tail.concat(head.slice(1));
    }
  }

  /**
   * Remove tiny pieces which would otherwise
   * appear as dots after erasing.
   */
  return runs.filter(
    (run) =>
      run.length >= 2 &&
      runLength(run) >= 1.5
  );
}

export class EraserTool {
  /**
   * Partially erase vector strokes.
   *
   * Pen and highlighter strokes are split into
   * surviving pieces.
   *
   * Text is removed as a complete object.
   */
  static eraseStrokes(
    annotations,
    eraserPoint,
    radius = 16
  ) {
    if (
      !Array.isArray(annotations) ||
      !eraserPoint
    ) {
      return {
        updatedAnnotations: annotations || [],
        deletedAnnotations: [],
        changed: false
      };
    }

    const updatedAnnotations = [];
    const deletedAnnotations = [];

    for (const annotation of annotations) {
      /**
       * TEXT
       *
       * Text is treated as a complete object.
       */
      if (annotation.type === 'text') {
        const textDistance = distance(
          eraserPoint,
          {
            x: annotation.x,
            y: annotation.y
          }
        );

        if (textDistance <= radius + 20) {
          deletedAnnotations.push(annotation);
        } else {
          updatedAnnotations.push(annotation);
        }

        continue;
      }

      /**
       * Only pen/highlighter strokes can be
       * partially erased.
       */
      if (
        annotation.type !== 'pen' &&
        annotation.type !== 'highlighter'
      ) {
        updatedAnnotations.push(annotation);
        continue;
      }

      /**
       * Make the eraser slightly larger for
       * thick strokes.
       */
      const effectiveRadius =
        radius +
        (annotation.width || 3) / 2;

      const runs = cutStroke(
        annotation.points || [],
        eraserPoint,
        effectiveRadius
      );

      /**
       * Completely untouched.
       */
      if (runs === null) {
        updatedAnnotations.push(annotation);
        continue;
      }

      /**
       * Original annotation was affected.
       */
      deletedAnnotations.push(annotation);

      /**
       * Add surviving pieces as separate
       * annotations.
       */
      for (const run of runs) {
        if (
          !run ||
          run.length < 2 ||
          runLength(run) < 1.5
        ) {
          continue;
        }

        partCounter += 1;

        updatedAnnotations.push({
          ...annotation,

          id:
            `${annotation.id}_part_${partCounter}`,

          /**
           * A recognised shape is no longer
           * considered a complete editable shape.
           */
          shapeRecognized:
            annotation.shapeRecognized
              ? 'partial'
              : undefined,

          /**
           * Remove editable geometry information
           * because the shape has been modified.
           */
          shape: undefined,

          smartConfidence: undefined,

          /**
           * Keep the surviving points.
           */
          points: run
        });
      }
    }

    return {
      updatedAnnotations,
      deletedAnnotations,

      changed:
        deletedAnnotations.length > 0
    };
  }

  /**
   * Draw the eraser cursor.
   *
   * IMPORTANT:
   * This expects coordinates in the same document
   * coordinate system as the annotation canvas.
   */
  static drawCursor(
    ctx,
    point,
    radius = 16
  ) {
    if (!ctx || !point) {
      return;
    }

    ctx.save();

    /**
     * Outer translucent eraser area.
     */
    ctx.beginPath();

    ctx.arc(
      point.x,
      point.y,
      radius,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      'rgba(239, 68, 68, 0.08)';

    ctx.fill();

    /**
     * Outer border.
     */
    ctx.beginPath();

    ctx.arc(
      point.x,
      point.y,
      radius,
      0,
      Math.PI * 2
    );

    ctx.strokeStyle =
      'rgba(239, 68, 68, 0.9)';

    ctx.lineWidth = 1.5;

    ctx.stroke();

    /**
     * Center dot.
     */
    ctx.beginPath();

    ctx.arc(
      point.x,
      point.y,
      2,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      'rgba(239, 68, 68, 0.9)';

    ctx.fill();

    ctx.restore();
  }
}