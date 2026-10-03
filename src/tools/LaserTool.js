/**
 * GeoCanvas - Laser Pointer
 *
 * A temporary, semi-transparent "light pen" for presenting and writing on the
 * board without leaving permanent ink.
 *
 *  - Every stroke stays fully visible for LASER_LIFETIME (20 s) after you lift
 *    the pen, then fades out over the last LASER_FADE ms and is removed.
 *  - Strokes are drawn as ONE smooth path each, so translucent overlaps do not
 *    create dark blobs - handwriting stays clean and readable.
 *  - Switching to another tool clears everything (handled by AnnotationLayer).
 */

export class LaserTool {
  static LASER_LIFETIME = 20000; // ms a finished stroke stays on screen
  static LASER_FADE = 2000; // ms of fade-out at the end of that lifetime

  /** Start a new laser stroke. */
  static createLaser(point, options = {}) {
    const now = performance.now();
    return {
      type: 'laser',
      color: options.color || '#ef4444',
      width: options.width || 3,
      active: true, // pen is still down
      lastTime: now,
      points: [{ x: point.x, y: point.y }]
    };
  }

  /** Append a point (ignores sub-pixel jitter). */
  static addPoint(laser, point) {
    if (!laser || !laser.points) return;
    const last = laser.points[laser.points.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.8) return;
    laser.points.push({ x: point.x, y: point.y });
    laser.lastTime = performance.now();
  }

  /** Pen lifted: the 20 s countdown starts now. */
  static finish(laser, now = performance.now()) {
    if (!laser) return;
    laser.active = false;
    laser.lastTime = now;
  }

  /** Remove expired strokes. Returns the surviving strokes. */
  static prune(strokes, now = performance.now()) {
    return (strokes || []).filter(
      (s) => s.active || now - s.lastTime < this.LASER_LIFETIME
    );
  }

  /** 1 while fresh, fading to 0 at the very end of the lifetime. */
  static strokeOpacity(stroke, now = performance.now()) {
    if (stroke.active) return 1;
    const age = now - stroke.lastTime;
    const fadeStart = this.LASER_LIFETIME - this.LASER_FADE;
    if (age <= fadeStart) return 1;
    return Math.max(0, 1 - (age - fadeStart) / this.LASER_FADE);
  }

  static tracePath(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 1) {
      ctx.lineTo(points[0].x + 0.01, points[0].y);
      return;
    }

    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
      return;
    }

    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }

  /**
   * Draw all laser strokes plus a small pointer dot at `head`
   * (the current cursor position, or null).
   */
  static draw(ctx, strokes, head = null, now = performance.now()) {
    if ((!strokes || strokes.length === 0) && !head) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokes || []) {
      if (!stroke.points || stroke.points.length === 0) continue;

      const fade = this.strokeOpacity(stroke, now);
      if (fade <= 0) continue;

      const w = stroke.width;

      // Soft halo (very transparent)
      ctx.globalAlpha = 0.14 * fade;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = w * 3;
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = 8;
      this.tracePath(ctx, stroke.points);
      ctx.stroke();

      // Main coloured line (translucent so the page shows through)
      ctx.globalAlpha = 0.5 * fade;
      ctx.lineWidth = w;
      ctx.shadowBlur = 0;
      this.tracePath(ctx, stroke.points);
      ctx.stroke();

      // Thin bright centre for a light-pen look
      ctx.globalAlpha = 0.35 * fade;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(0.8, w * 0.3);
      this.tracePath(ctx, stroke.points);
      ctx.stroke();
    }

    // Small pointer dot under the cursor
    // (head = { x, y, color, width } supplied by the canvas)
    if (head) {
      const color = head.color || '#ef4444';
      const base = head.width || 3;
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(head.x, head.y, Math.max(4, base * 1.6), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(head.x, head.y, Math.max(1.8, base * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}