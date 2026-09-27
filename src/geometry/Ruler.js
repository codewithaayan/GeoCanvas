import {
  distance,
  DEG_TO_RAD,
  RAD_TO_DEG
} from './math';

const CM_TO_PT = 28.3465;
const MM_TO_PT = CM_TO_PT / 10;

export class RulerModel {
  static CM_TO_PT = CM_TO_PT;

  // Large enough for practically any PDF page.
  static MIN_LENGTH = 120;
  static MAX_LENGTH = 2400;

  static createDefault(x = 150, y = 150) {
    return {
      id:
        'ruler_' +
        Date.now() +
        '_' +
        Math.random().toString(36).slice(2, 6),

      type: 'ruler',

      x,
      y,

      // 30 cm default instead of the old ~14 cm.
      width: 30 * CM_TO_PT,

      rotation: 0
    };
  }

  static getLength(ruler) {
    return Math.max(
      this.MIN_LENGTH,
      Math.min(
        this.MAX_LENGTH,
        ruler.width || 30 * CM_TO_PT
      )
    );
  }

  static getPoint(ruler, localX, localY = 0) {
    const angle =
      (ruler.rotation || 0) * DEG_TO_RAD;

    return {
      x:
        ruler.x +
        localX * Math.cos(angle) -
        localY * Math.sin(angle),

      y:
        ruler.y +
        localX * Math.sin(angle) +
        localY * Math.cos(angle)
    };
  }

  static toLocal(ruler, point) {
    const angle =
      -(ruler.rotation || 0) * DEG_TO_RAD;

    const dx = point.x - ruler.x;
    const dy = point.y - ruler.y;

    return {
      x:
        dx * Math.cos(angle) -
        dy * Math.sin(angle),

      y:
        dx * Math.sin(angle) +
        dy * Math.cos(angle)
    };
  }

  static hitTest(ruler, point) {
    const local = this.toLocal(ruler, point);
    const length = this.getLength(ruler);

    const halfHeight = 24;

    // Close button.
    const closePos = this.getPoint(
      ruler,
      length - 12,
      -34
    );

    if (distance(point, closePos) <= 15) {
      return { part: 'close' };
    }

    // Rotation handle.
    const rotatePos = this.getPoint(
      ruler,
      length / 2,
      -40
    );

    if (distance(point, rotatePos) <= 17) {
      return { part: 'rotate' };
    }

    // Resize handle at the far end.
    const resizePos = this.getPoint(
      ruler,
      length,
      0
    );

    if (distance(point, resizePos) <= 20) {
      return { part: 'resize' };
    }

    // Main ruler body.
    if (
      local.x >= -12 &&
      local.x <= length + 12 &&
      Math.abs(local.y) <= halfHeight
    ) {
      return { part: 'body' };
    }

    return null;
  }

  static draw(
    ctx,
    ruler,
    isSelected = false
  ) {
    const length = this.getLength(ruler);

    ctx.save();

    ctx.translate(
      ruler.x,
      ruler.y
    );

    ctx.rotate(
      (ruler.rotation || 0) * DEG_TO_RAD
    );

    // ----------------------------------------
    // Ruler body
    // ----------------------------------------

    const bodyHeight = 48;

    ctx.beginPath();
    ctx.roundRect(
      0,
      -bodyHeight / 2,
      length,
      bodyHeight,
      5
    );

    // Soft drop shadow so the ruler reads as sitting on
    // top of the page rather than painted flat into it.
    ctx.save();
    ctx.shadowColor =
      'rgba(15, 23, 42, 0.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;

    // Subtle top-to-bottom bevel instead of a flat fill.
    const bodyGradient =
      ctx.createLinearGradient(
        0,
        -bodyHeight / 2,
        0,
        bodyHeight / 2
      );

    bodyGradient.addColorStop(
      0,
      'rgba(255, 255, 255, 0.6)'
    );

    bodyGradient.addColorStop(
      0.5,
      'rgba(248, 250, 252, 0.5)'
    );

    bodyGradient.addColorStop(
      1,
      'rgba(226, 232, 240, 0.42)'
    );

    ctx.fillStyle =
      bodyGradient;

    ctx.fill();
    ctx.restore();

    ctx.strokeStyle =
      isSelected
        ? '#2563eb'
        : '#64748b';

    ctx.lineWidth =
      isSelected ? 2 : 1.5;

    ctx.stroke();

    // ----------------------------------------
    // Measurement scale
    // ----------------------------------------

    const totalMm =
      Math.max(
        1,
        Math.floor(length / MM_TO_PT)
      );

    for (
      let mm = 0;
      mm <= totalMm;
      mm++
    ) {
      const x =
        mm * MM_TO_PT;

      if (x > length) {
        break;
      }

      const isCm =
        mm % 10 === 0;

      const isHalfCm =
        mm % 5 === 0;

      let tickHeight = 9;

      if (isCm) {
        tickHeight = 25;
      } else if (isHalfCm) {
        tickHeight = 18;
      }

      // Measurements now read on the upper side of the
      // ruler body (ticks grow downward from the top edge).
      ctx.beginPath();
      ctx.moveTo(
        x,
        -20
      );

      ctx.lineTo(
        x,
        -20 + tickHeight
      );

      ctx.strokeStyle =
        isCm
          ? '#0f172a'
          : isHalfCm
          ? '#334155'
          : '#475569';

      ctx.lineWidth =
        isCm
          ? 1.5
          : isHalfCm
          ? 1.15
          : 1;

      ctx.stroke();

      // Centimetre labels.
      if (
        isCm &&
        mm > 0
      ) {
        const cm =
          mm / 10;

        ctx.save();

        ctx.fillStyle =
          '#0f172a';

        ctx.font =
          'bold 10px "JetBrains Mono", monospace';

        ctx.textAlign =
          'center';

        ctx.textBaseline =
          'top';

        ctx.fillText(
          String(cm),
          x,
          -12
        );

        ctx.restore();
      }
    }

    // 0 label (upper side).
    ctx.fillStyle =
      '#0f172a';

    ctx.font =
      'bold 10px "JetBrains Mono", monospace';

    ctx.textAlign =
      'left';

    ctx.textBaseline =
      'top';

    ctx.fillText(
      '0',
      3,
      -12
    );

    // ----------------------------------------
    // CM indicator (kept on the lower side, out of
    // the way of the upper tick labels)
    // ----------------------------------------

    ctx.fillStyle =
      '#2563eb';

    ctx.font =
      'bold 9px "JetBrains Mono", monospace';

    ctx.textAlign =
      'right';

    ctx.textBaseline =
      'bottom';

    const totalCm =
      length / CM_TO_PT;

    ctx.fillText(
      `${totalCm.toFixed(1)} cm`,
      length - 8,
      20
    );

    // ----------------------------------------
    // Resize handle
    // ----------------------------------------

    if (isSelected) {
      // Resize grip.
      ctx.beginPath();
      ctx.arc(
        length,
        0,
        9,
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

      // Rotation handle.
      ctx.beginPath();
      ctx.arc(
        length / 2,
        -40,
        9,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#2563eb';

      ctx.fill();

      ctx.strokeStyle =
        '#ffffff';

      ctx.lineWidth = 2;
      ctx.stroke();

      // Close button.
      ctx.beginPath();
      ctx.arc(
        length - 12,
        -34,
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
        length - 12,
        -34
      );
    }

    ctx.restore();
  }
}