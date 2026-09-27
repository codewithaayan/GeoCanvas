/**
 * GeoCanvas
 * Smooth Vector Pen / Highlighter Engine
 */

export class PenTool {
  static createStroke(
    point,
    options = {}
  ) {
    const isHighlighter =
      options.tool ===
      'highlighter';

    return {
      id:
        'stroke_' +
        Date.now() +
        '_' +
        Math.random()
          .toString(36)
          .slice(2, 7),

      type: isHighlighter
        ? 'highlighter'
        : 'pen',

      color:
        options.color ||
        (isHighlighter
          ? '#fde047'
          : '#1d4ed8'),

      width:
        options.width ||
        (isHighlighter
          ? 24
          : 3),

      opacity:
        options.opacity !==
        undefined
          ? options.opacity
          : isHighlighter
          ? 0.4
          : 1,

      points: [
        {
          x: point.x,
          y: point.y,
          pressure:
            point.pressure || 0.5
        }
      ]
    };
  }

  static addPoint(
    stroke,
    point,
    minDistance = 1.2
  ) {
    if (
      !stroke ||
      !stroke.points ||
      stroke.points.length === 0
    ) {
      return false;
    }

    const last =
      stroke.points[
        stroke.points.length - 1
      ];

    const dx =
      point.x - last.x;

    const dy =
      point.y - last.y;

    const d =
      Math.hypot(dx, dy);

    if (d < minDistance) {
      return false;
    }

    stroke.points.push({
      x: point.x,
      y: point.y,
      pressure:
        point.pressure || 0.5
    });

    return true;
  }

  static addCoalescedPoints(
    stroke,
    event,
    minDistance = 1.2
  ) {
    if (
      !event ||
      !stroke
    ) {
      return false;
    }

    let changed = false;

    const events =
      typeof event.getCoalescedEvents ===
      'function'
        ? event.getCoalescedEvents()
        : [event];

    for (const pointEvent of events) {
      changed =
        PenTool.addPoint(
          stroke,
          {
            x:
              pointEvent.clientX,
            y:
              pointEvent.clientY,
            pressure:
              pointEvent.pressure ||
              0.5
          },
          minDistance
        ) || changed;
    }

    return changed;
  }

  static drawStroke(
    ctx,
    stroke
  ) {
    if (
      !stroke ||
      !stroke.points ||
      stroke.points.length === 0
    ) {
      return;
    }

    const points =
      stroke.points;

    ctx.save();

    ctx.strokeStyle =
      stroke.color;

    ctx.lineWidth =
      stroke.width;

    ctx.lineCap =
      'round';

    ctx.lineJoin =
      'round';

    ctx.globalAlpha =
      stroke.opacity !==
      undefined
        ? stroke.opacity
        : 1;

    if (
      stroke.type ===
      'highlighter'
    ) {
      ctx.globalCompositeOperation =
        'multiply';
    }

    if (
      points.length === 1
    ) {
      ctx.beginPath();

      ctx.arc(
        points[0].x,
        points[0].y,
        stroke.width / 2,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        stroke.color;

      ctx.fill();

      ctx.restore();

      return;
    }

    if (
      points.length === 2
    ) {
      ctx.beginPath();

      ctx.moveTo(
        points[0].x,
        points[0].y
      );

      ctx.lineTo(
        points[1].x,
        points[1].y
      );

      ctx.stroke();

      ctx.restore();

      return;
    }

    ctx.beginPath();

    ctx.moveTo(
      points[0].x,
      points[0].y
    );

    for (
      let i = 1;
      i < points.length - 2;
      i++
    ) {
      const p1 =
        points[i];

      const p2 =
        points[i + 1];

      const midX =
        (p1.x + p2.x) / 2;

      const midY =
        (p1.y + p2.y) / 2;

      ctx.quadraticCurveTo(
        p1.x,
        p1.y,
        midX,
        midY
      );
    }

    const penultimate =
      points[
        points.length - 2
      ];

    const last =
      points[
        points.length - 1
      ];

    ctx.quadraticCurveTo(
      penultimate.x,
      penultimate.y,
      last.x,
      last.y
    );

    ctx.stroke();

    ctx.restore();
  }
}