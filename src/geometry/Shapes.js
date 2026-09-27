import {
  distance,
  angleBetweenPoints,
  pointToSegmentDistance,
  pointToArcDistance,
  DEG_TO_RAD
} from './math';

const CM_TO_PT = 28.3465;

/* =========================================================
   LINE
   ========================================================= */

export class LineModel {
  static create(
    start,
    end,
    color = '#1e3a8a',
    width = 2.5
  ) {
    return {
      id:
        'line_' +
        Date.now() +
        '_' +
        Math.random()
          .toString(36)
          .slice(2, 7),

      type: 'line',

      start: {
        x: start.x,
        y: start.y
      },

      end: {
        x: end.x,
        y: end.y
      },

      color,
      width
    };
  }

  static hitTest(line, point) {
    const tol = 16;

    const mid = {
      x:
        (line.start.x +
          line.end.x) / 2,

      y:
        (line.start.y +
          line.end.y) / 2
    };

    /*
     * Keep the close button outside the line body.
     * Check it first so it can never be swallowed by
     * the line hit-test.
     */
    const closePos = {
      x: mid.x + 20,
      y: mid.y - 20
    };

    if (
      distance(point, closePos) <= 16
    ) {
      return {
        part: 'close'
      };
    }

    if (
      distance(
        point,
        line.start
      ) <= tol
    ) {
      return {
        part: 'start'
      };
    }

    if (
      distance(
        point,
        line.end
      ) <= tol
    ) {
      return {
        part: 'end'
      };
    }

    const result =
      pointToSegmentDistance(
        point,
        line.start,
        line.end
      );

    if (
      result &&
      result.distance <= tol
    ) {
      return {
        part: 'body'
      };
    }

    return null;
  }

  static draw(
    ctx,
    line,
    isSelected = false,
    isHovered = false
  ) {
    if (!line) {
      return;
    }

    const len = distance(
      line.start,
      line.end
    );

    ctx.save();

    /*
     * Main line.
     */
    ctx.beginPath();

    ctx.moveTo(
      line.start.x,
      line.start.y
    );

    ctx.lineTo(
      line.end.x,
      line.end.y
    );

    ctx.strokeStyle =
      line.color ||
      '#1e3a8a';

    ctx.lineWidth =
      line.width || 2.5;

    ctx.lineCap = 'round';

    ctx.lineJoin = 'round';

    ctx.stroke();

    /*
     * Measurement only while hovering.
     */
    if (
      isHovered &&
      len > 20
    ) {
      const lenCm =
        len / CM_TO_PT;

      const mid = {
        x:
          (line.start.x +
            line.end.x) / 2,

        y:
          (line.start.y +
            line.end.y) / 2
      };

      const label =
        `${lenCm.toFixed(1)} cm`;

      ctx.font =
        'bold 10px "JetBrains Mono", monospace';

      const textWidth =
        ctx.measureText(
          label
        ).width;

      const angle =
        angleBetweenPoints(
          line.start,
          line.end
        ) * DEG_TO_RAD;

      const normalX =
        -Math.sin(angle);

      const normalY =
        Math.cos(angle);

      const badgeX =
        mid.x +
        normalX * 18;

      const badgeY =
        mid.y +
        normalY * 18;

      ctx.beginPath();

      if (
        typeof ctx.roundRect ===
        'function'
      ) {
        ctx.roundRect(
          badgeX -
            textWidth / 2 -
            7,

          badgeY - 10,

          textWidth + 14,

          20,

          5
        );
      } else {
        ctx.rect(
          badgeX -
            textWidth / 2 -
            7,

          badgeY - 10,

          textWidth + 14,

          20
        );
      }

      ctx.fillStyle =
        'rgba(15, 23, 42, 0.94)';

      ctx.fill();

      ctx.strokeStyle =
        '#38bdf8';

      ctx.lineWidth = 1;

      ctx.stroke();

      ctx.fillStyle =
        '#38bdf8';

      ctx.textAlign =
        'center';

      ctx.textBaseline =
        'middle';

      ctx.fillText(
        label,
        badgeX,
        badgeY
      );
    }

    /*
     * Selection controls.
     */
    if (isSelected) {
      /*
       * Start handle.
       */
      ctx.beginPath();

      ctx.arc(
        line.start.x,
        line.start.y,
        6,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#3b82f6';

      ctx.fill();

      ctx.strokeStyle =
        '#ffffff';

      ctx.lineWidth = 2;

      ctx.stroke();

      /*
       * End handle.
       */
      ctx.beginPath();

      ctx.arc(
        line.end.x,
        line.end.y,
        6,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#10b981';

      ctx.fill();

      ctx.strokeStyle =
        '#ffffff';

      ctx.lineWidth = 2;

      ctx.stroke();

      /*
       * Close button.
       */
      const mid = {
        x:
          (line.start.x +
            line.end.x) / 2,

        y:
          (line.start.y +
            line.end.y) / 2
      };

      const closePos = {
        x: mid.x + 20,
        y: mid.y - 20
      };

      ctx.beginPath();

      ctx.arc(
        closePos.x,
        closePos.y,
        8,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#ef4444';

      ctx.fill();

      ctx.strokeStyle =
        '#ffffff';

      ctx.lineWidth = 1.5;

      ctx.stroke();

      ctx.fillStyle =
        '#ffffff';

      ctx.font =
        'bold 10px sans-serif';

      ctx.textAlign =
        'center';

      ctx.textBaseline =
        'middle';

      ctx.fillText(
        '×',
        closePos.x,
        closePos.y + 0.5
      );
    }

    ctx.restore();
  }
}

/* =========================================================
   CIRCLE
   ========================================================= */

export class CircleModel {
  static create(
    center,
    radius,
    color = '#1e3a8a',
    width = 2.5
  ) {
    return {
      id:
        'circle_' +
        Date.now() +
        '_' +
        Math.random()
          .toString(36)
          .slice(2, 7),

      type: 'circle',

      center: {
        x: center.x,
        y: center.y
      },

      radius:
        Math.max(5, radius),

      color,
      width
    };
  }

  static hitTest(circle, point) {
    if (!circle) {
      return null;
    }

    const tol = 16;

    const closeAngle =
      -45 * DEG_TO_RAD;

    const closeDistance =
      circle.radius + 22;

    const closePos = {
      x:
        circle.center.x +
        closeDistance *
          Math.cos(closeAngle),

      y:
        circle.center.y +
        closeDistance *
          Math.sin(closeAngle)
    };

    /*
     * CLOSE FIRST.
     */
    if (
      distance(
        point,
        closePos
      ) <= 17
    ) {
      return {
        part: 'close'
      };
    }

    if (
      distance(
        point,
        circle.center
      ) <= tol
    ) {
      return {
        part: 'center'
      };
    }

    const radiusPoint = {
      x:
        circle.center.x +
        circle.radius,

      y:
        circle.center.y
    };

    if (
      distance(
        point,
        radiusPoint
      ) <= tol
    ) {
      return {
        part: 'radius'
      };
    }

    const d =
      distance(
        point,
        circle.center
      );

    if (
      Math.abs(
        d - circle.radius
      ) <= tol
    ) {
      return {
        part: 'body'
      };
    }

    return null;
  }

  static draw(
    ctx,
    circle,
    isSelected = false,
    isHovered = false
  ) {
    if (!circle) {
      return;
    }

    const {
      center,
      radius,
      color,
      width
    } = circle;

    ctx.save();

    /*
     * Circle.
     */
    ctx.beginPath();

    ctx.arc(
      center.x,
      center.y,
      radius,
      0,
      Math.PI * 2
    );

    ctx.strokeStyle =
      color ||
      '#1e3a8a';

    ctx.lineWidth =
      width || 2.5;

    ctx.stroke();

    /*
     * Center point.
     */
    ctx.beginPath();

    ctx.arc(
      center.x,
      center.y,
      4,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      '#ef4444';

    ctx.fill();

    /*
     * Radius guide + label only show while hovered (or
     * selected) so a page full of circles doesn't stay
     * permanently cluttered with radius readouts.
     */
    const showRadiusInfo =
      (isHovered || isSelected) &&
      radius > 25;

    if (showRadiusInfo) {
    ctx.beginPath();

    ctx.moveTo(
      center.x,
      center.y
    );

    ctx.lineTo(
      center.x + radius,
      center.y
    );

    ctx.strokeStyle =
      'rgba(59, 130, 246, 0.5)';

    ctx.lineWidth = 1.5;

    ctx.setLineDash([
      3,
      2
    ]);

    ctx.stroke();

    ctx.setLineDash([]);
    }

    /*
     * Radius label.
     */
    if (showRadiusInfo) {
      const badgeX =
        center.x +
        radius / 2;

      const badgeY =
        center.y - 10;

      const rCm =
        (
          radius /
          CM_TO_PT
        ).toFixed(1);

      const label =
        `r = ${rCm}cm`;

      ctx.font =
        '9px "JetBrains Mono", monospace';

      const txtWidth =
        ctx.measureText(
          label
        ).width;

      ctx.fillStyle =
        'rgba(15, 23, 42, 0.85)';

      ctx.beginPath();

      if (
        typeof ctx.roundRect ===
        'function'
      ) {
        ctx.roundRect(
          badgeX -
            txtWidth / 2 -
            4,

          badgeY - 8,

          txtWidth + 8,

          16,

          4
        );
      } else {
        ctx.rect(
          badgeX -
            txtWidth / 2 -
            4,

          badgeY - 8,

          txtWidth + 8,

          16
        );
      }

      ctx.fill();

      ctx.fillStyle =
        '#38bdf8';

      ctx.textAlign =
        'center';

      ctx.textBaseline =
        'middle';

      ctx.fillText(
        label,
        badgeX,
        badgeY
      );
    }

    if (isSelected) {
      /*
       * Resize handle.
       */
      ctx.beginPath();

      ctx.arc(
        center.x + radius,
        center.y,
        7,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#10b981';

      ctx.fill();

      ctx.strokeStyle =
        '#ffffff';

      ctx.lineWidth = 2;

      ctx.stroke();

      /*
       * Close button.
       */
      const closeDistance =
        radius + 22;

      const closePos = {
        x:
          center.x +
          closeDistance *
            Math.cos(
              -45 * DEG_TO_RAD
            ),

        y:
          center.y +
          closeDistance *
            Math.sin(
              -45 * DEG_TO_RAD
            )
      };

      ctx.beginPath();

      ctx.arc(
        closePos.x,
        closePos.y,
        8,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#ef4444';

      ctx.fill();

      ctx.strokeStyle =
        '#ffffff';

      ctx.lineWidth = 1.5;

      ctx.stroke();

      ctx.fillStyle =
        '#ffffff';

      ctx.font =
        'bold 10px sans-serif';

      ctx.textAlign =
        'center';

      ctx.textBaseline =
        'middle';

      ctx.fillText(
        '×',
        closePos.x,
        closePos.y
      );
    }

    ctx.restore();
  }
}

/* =========================================================
   ARC
   ========================================================= */

export class ArcModel {
  static create(
    center,
    radius,
    startAngle,
    endAngle,
    color = '#1e3a8a',
    width = 2.5
  ) {
    return {
      id:
        'arc_' +
        Date.now() +
        '_' +
        Math.random()
          .toString(36)
          .slice(2, 7),

      type: 'arc',

      center: {
        x: center.x,
        y: center.y
      },

      radius:
        Math.max(5, radius),

      startAngle,
      endAngle,

      color,
      width
    };
  }

  static hitTest(
    arc,
    point
  ) {
    if (!arc) {
      return null;
    }

    const tol = 16;

    /*
     * Close button first.
     */
    const midAngle =
      (
        arc.startAngle +
        arc.endAngle
      ) /
      2;

    const closePos = {
      x:
        arc.center.x +
        (arc.radius + 20) *
          Math.cos(
            midAngle *
              DEG_TO_RAD
          ),

      y:
        arc.center.y +
        (arc.radius + 20) *
          Math.sin(
            midAngle *
              DEG_TO_RAD
          )
    };

    if (
      distance(
        point,
        closePos
      ) <= 16
    ) {
      return {
        part: 'close'
      };
    }

    if (
      distance(
        point,
        arc.center
      ) <= tol
    ) {
      return {
        part: 'center'
      };
    }

    const sRad =
      arc.startAngle *
      DEG_TO_RAD;

    const startPt = {
      x:
        arc.center.x +
        arc.radius *
          Math.cos(sRad),

      y:
        arc.center.y +
        arc.radius *
          Math.sin(sRad)
    };

    if (
      distance(
        point,
        startPt
      ) <= tol
    ) {
      return {
        part: 'start'
      };
    }

    const eRad =
      arc.endAngle *
      DEG_TO_RAD;

    const endPt = {
      x:
        arc.center.x +
        arc.radius *
          Math.cos(eRad),

      y:
        arc.center.y +
        arc.radius *
          Math.sin(eRad)
    };

    if (
      distance(
        point,
        endPt
      ) <= tol
    ) {
      return {
        part: 'end'
      };
    }

    const distToArc =
      pointToArcDistance(
        point,
        arc.center,
        arc.radius,
        arc.startAngle,
        arc.endAngle
      );

    if (
      distToArc <= tol
    ) {
      return {
        part: 'body'
      };
    }

    return null;
  }

  static draw(
    ctx,
    arc,
    isSelected = false
  ) {
    if (!arc) {
      return;
    }

    const {
      center,
      radius,
      startAngle,
      endAngle,
      color,
      width
    } = arc;

    const sRad =
      startAngle *
      DEG_TO_RAD;

    const eRad =
      endAngle *
      DEG_TO_RAD;

    ctx.save();

    ctx.beginPath();

    ctx.arc(
      center.x,
      center.y,
      radius,
      sRad,
      eRad,
      false
    );

    ctx.strokeStyle =
      color ||
      '#1e3a8a';

    ctx.lineWidth =
      width || 2.5;

    ctx.lineCap =
      'round';

    ctx.stroke();

    if (isSelected) {
      /*
       * Center.
       */
      ctx.beginPath();

      ctx.arc(
        center.x,
        center.y,
        4,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#ef4444';

      ctx.fill();

      /*
       * Start and end points.
       */
      const startPt = {
        x:
          center.x +
          radius *
            Math.cos(sRad),

        y:
          center.y +
          radius *
            Math.sin(sRad)
      };

      const endPt = {
        x:
          center.x +
          radius *
            Math.cos(eRad),

        y:
          center.y +
          radius *
            Math.sin(eRad)
      };

      ctx.beginPath();

      ctx.moveTo(
        center.x,
        center.y
      );

      ctx.lineTo(
        startPt.x,
        startPt.y
      );

      ctx.strokeStyle =
        'rgba(59, 130, 246, 0.4)';

      ctx.lineWidth = 1;

      ctx.setLineDash([
        2,
        2
      ]);

      ctx.stroke();

      ctx.setLineDash([]);

      ctx.beginPath();

      ctx.arc(
        startPt.x,
        startPt.y,
        6,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#3b82f6';

      ctx.fill();

      ctx.strokeStyle =
        '#ffffff';

      ctx.lineWidth = 2;

      ctx.stroke();

      ctx.beginPath();

      ctx.arc(
        endPt.x,
        endPt.y,
        6,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#10b981';

      ctx.fill();

      ctx.strokeStyle =
        '#ffffff';

      ctx.lineWidth = 2;

      ctx.stroke();

      /*
       * Close button.
       */
      const midAngle =
        (
          startAngle +
          endAngle
        ) /
        2;

      const closePos = {
        x:
          center.x +
          (radius + 20) *
            Math.cos(
              midAngle *
                DEG_TO_RAD
            ),

        y:
          center.y +
          (radius + 20) *
            Math.sin(
              midAngle *
                DEG_TO_RAD
            )
      };

      ctx.beginPath();

      ctx.arc(
        closePos.x,
        closePos.y,
        7,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#ef4444';

      ctx.fill();

      ctx.strokeStyle =
        '#ffffff';

      ctx.lineWidth = 1.5;

      ctx.stroke();

      ctx.fillStyle =
        '#ffffff';

      ctx.font =
        'bold 9px sans-serif';

      ctx.textAlign =
        'center';

      ctx.textBaseline =
        'middle';

      ctx.fillText(
        '×',
        closePos.x,
        closePos.y
      );
    }

    ctx.restore();
  }
}