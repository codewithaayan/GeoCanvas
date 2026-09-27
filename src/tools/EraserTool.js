import { pointToSegmentDistance, distance } from '../geometry/math';

export class EraserTool {
  /*
   * Partial/vector eraser.
   *
   * Pen and highlighter strokes are split into smaller stroke objects.
   * Only the section touched by the eraser is removed.
   *
   * Text remains an object-level erase because text is not a freehand stroke.
   */
  static eraseStrokes(annotations, eraserPoint, radius = 16) {
    const updatedAnnotations = [];
    const changedAnnotations = [];

    for (const ann of annotations) {
      if (
        ann.type !== 'pen' &&
        ann.type !== 'highlighter'
      ) {
        if (ann.type === 'text') {
          const d = distance(
            eraserPoint,
            { x: ann.x, y: ann.y }
          );

          if (d <= radius + 20) {
            changedAnnotations.push(ann);
            continue;
          }
        }

        updatedAnnotations.push(ann);
        continue;
      }

      const points = ann.points || [];

      if (points.length === 0) {
        updatedAnnotations.push(ann);
        continue;
      }

      const effectiveRadius =
        radius + (ann.width || 3) / 2;

      const runs = [];
      let currentRun = [];

      const isPointInside = (point) => {
        return distance(
          point,
          eraserPoint
        ) <= effectiveRadius;
      };

      const segmentHitsEraser = (a, b) => {
        return pointToSegmentDistance(
          eraserPoint,
          a,
          b
        ).distance <= effectiveRadius;
      };

      /*
       * Add a point to the current surviving run.
       */
      const pushPoint = (point) => {
        if (!point) return;

        const last =
          currentRun[currentRun.length - 1];

        if (
          !last ||
          distance(last, point) > 0.25
        ) {
          currentRun.push({
            x: point.x,
            y: point.y,
            pressure:
              point.pressure ?? 0.5
          });
        }
      };

      /*
       * Estimate the point where a line segment enters/exits
       * the eraser circle.
       */
      const findBoundaryPoint = (
        a,
        b,
        insideAtStart,
        insideAtEnd
      ) => {
        let lo = 0;
        let hi = 1;

        for (let i = 0; i < 12; i++) {
          const t = (lo + hi) / 2;

          const point = {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t
          };

          const inside = isPointInside(point);

          if (
            inside === insideAtStart
          ) {
            lo = t;
          } else {
            hi = t;
          }
        }

        const t = (lo + hi) / 2;

        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          pressure:
            (a.pressure ?? 0.5) +
            (
              (b.pressure ?? 0.5) -
              (a.pressure ?? 0.5)
            ) * t
        };
      };

      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];

        const aInside =
          isPointInside(a);

        const bInside =
          isPointInside(b);

        const segmentHit =
          segmentHitsEraser(a, b);

        /*
         * Completely untouched segment.
         */
        if (
          !aInside &&
          !bInside &&
          !segmentHit
        ) {
          if (currentRun.length === 0) {
            pushPoint(a);
          }

          pushPoint(b);
          continue;
        }

        /*
         * Segment enters eraser.
         * Keep the portion before the eraser.
         */
        if (
          !aInside &&
          segmentHit
        ) {
          const boundary =
            findBoundaryPoint(
              a,
              b,
              false,
              true
            );

          pushPoint(a);
          pushPoint(boundary);

          if (currentRun.length > 0) {
            runs.push(currentRun);
          }

          currentRun = [];
          continue;
        }

        /*
         * Segment exits eraser.
         * Start a new surviving portion.
         */
        if (
          aInside &&
          !bInside &&
          segmentHit
        ) {
          const boundary =
            findBoundaryPoint(
              a,
              b,
              true,
              false
            );

          currentRun = [];
          pushPoint(boundary);
          pushPoint(b);
          continue;
        }

        /*
         * The entire segment is inside the eraser.
         */
        if (
          aInside &&
          bInside
        ) {
          if (currentRun.length > 0) {
            runs.push(currentRun);
            currentRun = [];
          }

          continue;
        }

        /*
         * Fallback for unusual sparse strokes.
         */
        if (!aInside && !bInside) {
          pushPoint(a);
          pushPoint(b);
        }
      }

      /*
       * Handle the final point.
       */
      const lastPoint =
        points[points.length - 1];

      if (!isPointInside(lastPoint)) {
        if (currentRun.length === 0) {
          pushPoint(lastPoint);
        } else {
          pushPoint(lastPoint);
        }
      } else if (
        currentRun.length > 0
      ) {
        runs.push(currentRun);
        currentRun = [];
      }

      if (currentRun.length > 0) {
        runs.push(currentRun);
      }

      /*
       * Remove tiny fragments.
       */
      const validRuns = runs.filter(
        run => run.length >= 2
      );

      /*
       * Nothing was actually erased.
       */
      if (
        validRuns.length === 1 &&
        validRuns[0].length === points.length
      ) {
        updatedAnnotations.push(ann);
        continue;
      }

      /*
       * If the original stroke was touched,
       * its surviving portions become separate
       * vector strokes.
       */
      if (
        validRuns.length === 0
      ) {
        changedAnnotations.push(ann);
        continue;
      }

      changedAnnotations.push(ann);

      validRuns.forEach(
        (run, index) => {
          updatedAnnotations.push({
            ...ann,
            id:
              `${ann.id}_part_${Date.now()}_${index}_${Math.random()
                .toString(36)
                .slice(2, 6)}`,
            points: run
          });
        }
      );
    }

    return {
      updatedAnnotations,
      deletedAnnotations:
        changedAnnotations,
      changed:
        changedAnnotations.length > 0
    };
  }

  static drawCursor(
    ctx,
    point,
    radius = 16
  ) {
    if (!point) return;

    ctx.save();

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

    ctx.strokeStyle =
      'rgba(239, 68, 68, 0.9)';

    ctx.lineWidth = 1.5;
    ctx.stroke();

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