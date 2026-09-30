/**
 * GeoCanvas - Laser Pointer Engine (GoodNotes style)
 * Provides glowing, self-dissolving presentation laser trail.
 */

export class LaserTool {
  static LASER_DURATION = 1200; // ms before trail fades completely

  /**
   * Create a new laser trail container
   */
  static createLaser(point, options = {}) {
    return {
      type: 'laser',
      color: options.color || '#ef4444',
      width: options.width || 6,
      points: [
        {
          x: point.x,
          y: point.y,
          time: performance.now()
        }
      ]
    };
  }

  /**
   * Append point to laser trail
   */
  static addPoint(laser, point) {
    if (!laser || !laser.points) return;
    const now = performance.now();
    laser.points.push({
      x: point.x,
      y: point.y,
      time: now
    });
  }

  /**
   * Prune decayed points and return whether any active points remain
   */
  static update(laser, now = performance.now()) {
    if (!laser || !laser.points) return false;
    laser.points = laser.points.filter(p => now - p.time < this.LASER_DURATION);
    return laser.points.length > 0;
  }

  /**
   * Draw the laser trail with glowing gradient and tip halo
   */
  static draw(ctx, laser, activePoint = null, now = performance.now()) {
    if (!laser || !laser.points || laser.points.length === 0) return;

    const points = laser.points;
    const duration = this.LASER_DURATION;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw glowing segments with fading opacity
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];

      const age = now - p2.time;
      if (age >= duration) continue;

      const progress = 1 - age / duration; // 1.0 (fresh) down to 0.0 (expired)
      const alpha = Math.max(0, Math.min(1, progress));

      // Outer glow
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = laser.color;
      ctx.lineWidth = laser.width * (0.6 + 0.6 * progress);
      ctx.globalAlpha = alpha * 0.45;
      ctx.shadowColor = laser.color;
      ctx.shadowBlur = 12 * progress;
      ctx.stroke();

      // Inner intense core
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, laser.width * 0.35 * progress);
      ctx.globalAlpha = alpha * 0.9;
      ctx.shadowBlur = 0;
      ctx.stroke();
    }

    // Draw active glowing laser pointer head at current position
    const head = activePoint || points[points.length - 1];
    if (head) {
      // Glow halo
      ctx.beginPath();
      ctx.arc(head.x, head.y, laser.width * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = laser.color;
      ctx.globalAlpha = 0.4;
      ctx.shadowColor = laser.color;
      ctx.shadowBlur = 14;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(head.x, head.y, laser.width * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 4;
      ctx.shadowColor = laser.color;
      ctx.fill();
    }

    ctx.restore();
  }
}
