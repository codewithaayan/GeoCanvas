import {
  DEG_TO_RAD,
  distance
} from './math';

export class CompassModel {
  static CM_TO_PT = 28.3465;

  static createDefault(
    x = 350,
    y = 350,
    radius = 100
  ) {
    return {
      id:
        'compass_' +
        Date.now() +
        '_' +
        Math.random()
          .toString(36)
          .slice(2, 6),

      type:
        'compass',

      x,
      y,

      radius:
        Math.max(
          40,
          radius
        ),

      /*
       * Pencil leg angle.
       * 0 = right
       * 90 = down
       */
      rotation:
        45,

      isDrawing:
        false
    };
  }

  static getPencilPos(
    compass
  ) {
    const angle =
      compass.rotation *
      DEG_TO_RAD;

    return {
      x:
        compass.x +
        compass.radius *
          Math.cos(angle),

      y:
        compass.y +
        compass.radius *
          Math.sin(angle)
    };
  }

  static getHingePos(
    compass
  ) {
    const angle =
      compass.rotation *
      DEG_TO_RAD;

    /*
     * Hinge is placed above the two
     * legs so the compass looks natural.
     */
    const perpendicular =
      angle -
      Math.PI / 2;

    const midpoint = {
      x:
        compass.x +
        (compass.radius / 2) *
          Math.cos(angle),

      y:
        compass.y +
        (compass.radius / 2) *
          Math.sin(angle)
    };

    const height =
      Math.max(
        48,
        compass.radius *
          0.62
      );

    return {
      x:
        midpoint.x +
        height *
          Math.cos(
            perpendicular
          ),

      y:
        midpoint.y +
        height *
          Math.sin(
            perpendicular
          )
    };
  }

  static getMiddleScrewPos(
    compass
  ) {
    const hinge =
      this.getHingePos(
        compass
      );

    const angle =
      compass.rotation *
      DEG_TO_RAD;

    return {
      x:
        hinge.x +
        Math.cos(angle) *
          10,

      y:
        hinge.y +
        Math.sin(angle) *
          10
    };
  }

  static getQuickDrawPos(
    compass
  ) {
    const hinge =
      this.getHingePos(
        compass
      );

    return {
      x:
        hinge.x,

      y:
        hinge.y -
        28
    };
  }

  static getClosePos(
    compass
  ) {
    const hinge =
      this.getHingePos(
        compass
      );

    return {
      x:
        hinge.x +
        32,

      y:
        hinge.y
    };
  }

  static hitTest(
    compass,
    point
  ) {
    const needle = {
      x:
        compass.x,

      y:
        compass.y
    };

    const pencil =
      this.getPencilPos(
        compass
      );

    const hinge =
      this.getHingePos(
        compass
      );

    const quickDraw =
      this.getQuickDrawPos(
        compass
      );

    const close =
      this.getClosePos(
        compass
      );

    const screw =
      this.getMiddleScrewPos(
        compass
      );

    /*
     * IMPORTANT:
     * Check controls BEFORE the body.
     */

    if (
      distance(
        point,
        close
      ) <= 18
    ) {
      return {
        part:
          'close'
      };
    }

    if (
      distance(
        point,
        quickDraw
      ) <= 17
    ) {
      return {
        part:
          'draw_circle'
      };
    }

    if (
      distance(
        point,
        pencil
      ) <= 22
    ) {
      return {
        part:
          'pencil'
      };
    }

    if (
      distance(
        point,
        needle
      ) <= 20
    ) {
      return {
        part:
          'needle'
      };
    }

    if (
      distance(
        point,
        hinge
      ) <= 25
    ) {
      return {
        part:
          'hinge'
      };
    }

    if (
      distance(
        point,
        screw
      ) <= 15
    ) {
      return {
        part:
          'hinge'
      };
    }

    /*
     * Needle leg
     */
    const needleLeg =
      distance(
        point,
        needle
      ) +
      distance(
        point,
        hinge
      );

    const needleLength =
      distance(
        needle,
        hinge
      );

    if (
      Math.abs(
        needleLeg -
        needleLength
      ) <= 10
    ) {
      return {
        part:
          'body'
      };
    }

    /*
     * Pencil leg
     */
    const pencilLeg =
      distance(
        point,
        pencil
      ) +
      distance(
        point,
        hinge
      );

    const pencilLength =
      distance(
        pencil,
        hinge
      );

    if (
      Math.abs(
        pencilLeg -
        pencilLength
      ) <= 10
    ) {
      return {
        part:
          'pencil'
      };
    }

    return null;
  }

  static draw(
    ctx,
    compass,
    isSelected = false
  ) {
    const needle = {
      x:
        compass.x,

      y:
        compass.y
    };

    const pencil =
      this.getPencilPos(
        compass
      );

    const hinge =
      this.getHingePos(
        compass
      );

    const radius =
      compass.radius;

    const radiusCm =
      (
        radius /
        this.CM_TO_PT
      ).toFixed(1);

    const angle =
      compass.rotation *
      DEG_TO_RAD;

    ctx.save();

    /*
     * Construction circle
     */
    ctx.beginPath();

    ctx.arc(
      needle.x,
      needle.y,
      radius,
      0,
      Math.PI * 2
    );

    ctx.strokeStyle =
      isSelected
        ? 'rgba(37,99,235,0.18)'
        : 'rgba(100,116,139,0.10)';

    ctx.lineWidth =
      1;

    ctx.setLineDash([
      4,
      4
    ]);

    ctx.stroke();

    ctx.setLineDash([]);

    /*
     * Radius guide
     */
    if (isSelected) {
      ctx.beginPath();

      ctx.moveTo(
        needle.x,
        needle.y
      );

      ctx.lineTo(
        pencil.x,
        pencil.y
      );

      ctx.strokeStyle =
        'rgba(8,145,178,0.35)';

      ctx.lineWidth =
        1;

      ctx.setLineDash([
        5,
        4
      ]);

      ctx.stroke();

      ctx.setLineDash([]);
    }

    /*
     * Needle shadow
     */
    ctx.beginPath();

    ctx.moveTo(
      hinge.x + 3,
      hinge.y + 3
    );

    ctx.lineTo(
      needle.x + 3,
      needle.y + 3
    );

    ctx.strokeStyle =
      'rgba(15,23,42,0.22)';

    ctx.lineWidth =
      9;

    ctx.lineCap =
      'round';

    ctx.stroke();

    /*
     * Pencil shadow
     */
    ctx.beginPath();

    ctx.moveTo(
      hinge.x + 3,
      hinge.y + 3
    );

    ctx.lineTo(
      pencil.x + 3,
      pencil.y + 3
    );

    ctx.strokeStyle =
      'rgba(15,23,42,0.22)';

    ctx.lineWidth =
      9;

    ctx.stroke();

    /*
     * Needle leg
     */
    const needleGradient =
      ctx.createLinearGradient(
        hinge.x,
        hinge.y,
        needle.x,
        needle.y
      );

    needleGradient.addColorStop(
      0,
      '#e2e8f0'
    );

    needleGradient.addColorStop(
      0.5,
      '#94a3b8'
    );

    needleGradient.addColorStop(
      1,
      '#475569'
    );

    ctx.beginPath();

    ctx.moveTo(
      hinge.x,
      hinge.y
    );

    ctx.lineTo(
      needle.x,
      needle.y
    );

    ctx.strokeStyle =
      needleGradient;

    ctx.lineWidth =
      7;

    ctx.lineCap =
      'round';

    ctx.stroke();

    /*
     * Pencil leg
     */
    const pencilGradient =
      ctx.createLinearGradient(
        hinge.x,
        hinge.y,
        pencil.x,
        pencil.y
      );

    pencilGradient.addColorStop(
      0,
      '#fde68a'
    );

    pencilGradient.addColorStop(
      0.45,
      '#f59e0b'
    );

    pencilGradient.addColorStop(
      1,
      '#b45309'
    );

    ctx.beginPath();

    ctx.moveTo(
      hinge.x,
      hinge.y
    );

    ctx.lineTo(
      pencil.x,
      pencil.y
    );

    ctx.strokeStyle =
      pencilGradient;

    ctx.lineWidth =
      7;

    ctx.lineCap =
      'round';

    ctx.stroke();

    /*
     * Metal edges
     */
    ctx.beginPath();

    ctx.moveTo(
      hinge.x,
      hinge.y
    );

    ctx.lineTo(
      needle.x,
      needle.y
    );

    ctx.strokeStyle =
      'rgba(255,255,255,0.55)';

    ctx.lineWidth =
      1.3;

    ctx.stroke();

    ctx.beginPath();

    ctx.moveTo(
      hinge.x,
      hinge.y
    );

    ctx.lineTo(
      pencil.x,
      pencil.y
    );

    ctx.strokeStyle =
      'rgba(255,255,255,0.55)';

    ctx.lineWidth =
      1.3;

    ctx.stroke();

    /*
     * Spreader
     */
    const spreadStart = {
      x:
        hinge.x +
        (needle.x -
          hinge.x) *
          0.42,

      y:
        hinge.y +
        (needle.y -
          hinge.y) *
          0.42
    };

    const spreadEnd = {
      x:
        hinge.x +
        (pencil.x -
          hinge.x) *
          0.42,

      y:
        hinge.y +
        (pencil.y -
          hinge.y) *
          0.42
    };

    ctx.beginPath();

    ctx.moveTo(
      spreadStart.x,
      spreadStart.y
    );

    ctx.lineTo(
      spreadEnd.x,
      spreadEnd.y
    );

    ctx.strokeStyle =
      '#64748b';

    ctx.lineWidth =
      4;

    ctx.lineCap =
      'round';

    ctx.stroke();

    /*
     * Radius badge
     */
    const badgePoint = {
      x:
        (spreadStart.x +
          spreadEnd.x) /
        2,

      y:
        (spreadStart.y +
          spreadEnd.y) /
        2
    };

    ctx.beginPath();

    ctx.arc(
      badgePoint.x,
      badgePoint.y,
      15,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      '#172033';

    ctx.fill();

    ctx.strokeStyle =
      '#22d3ee';

    ctx.lineWidth =
      1.5;

    ctx.stroke();

    ctx.font =
      'bold 8px "JetBrains Mono", monospace';

    ctx.fillStyle =
      '#67e8f9';

    ctx.textAlign =
      'center';

    ctx.textBaseline =
      'middle';

    ctx.fillText(
      `${radiusCm}cm`,
      badgePoint.x,
      badgePoint.y
    );

    /*
     * Hinge
     */
    ctx.beginPath();

    ctx.arc(
      hinge.x,
      hinge.y,
      16,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      '#334155';

    ctx.fill();

    ctx.strokeStyle =
      '#e2e8f0';

    ctx.lineWidth =
      2;

    ctx.stroke();

    /*
     * Hinge cap
     */
    ctx.beginPath();

    ctx.arc(
      hinge.x - 2,
      hinge.y - 2,
      8,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      '#64748b';

    ctx.fill();

    ctx.strokeStyle =
      '#cbd5e1';

    ctx.lineWidth =
      1.5;

    ctx.stroke();

    /*
     * Central screw
     */
    const screw =
      this.getMiddleScrewPos(
        compass
      );

    ctx.beginPath();

    ctx.arc(
      screw.x,
      screw.y,
      4,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      '#fbbf24';

    ctx.fill();

    /*
     * Needle holder
     */
    ctx.beginPath();

    ctx.arc(
      needle.x,
      needle.y,
      7,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      '#334155';

    ctx.fill();

    ctx.strokeStyle =
      '#cbd5e1';

    ctx.lineWidth =
      1.5;

    ctx.stroke();

    /*
     * Needle spike
     */
    ctx.beginPath();

    ctx.moveTo(
      needle.x,
      needle.y - 5
    );

    ctx.lineTo(
      needle.x +
        Math.cos(angle) *
          12,

      needle.y +
        Math.sin(angle) *
          12
    );

    ctx.strokeStyle =
      '#0f172a';

    ctx.lineWidth =
      3;

    ctx.lineCap =
      'round';

    ctx.stroke();

    /*
     * Pencil holder
     */
    ctx.beginPath();

    ctx.arc(
      pencil.x,
      pencil.y,
      9,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      '#b45309';

    ctx.fill();

    ctx.strokeStyle =
      '#fef3c7';

    ctx.lineWidth =
      1.5;

    ctx.stroke();

    /*
     * Pencil lead
     */
    ctx.beginPath();

    ctx.moveTo(
      pencil.x,
      pencil.y
    );

    ctx.lineTo(
      pencil.x +
        Math.cos(angle) *
          11,

      pencil.y +
        Math.sin(angle) *
          11
    );

    ctx.strokeStyle =
      '#111827';

    ctx.lineWidth =
      3;

    ctx.stroke();

    /*
     * Selected controls
     */
    if (isSelected) {
      const quick =
        this.getQuickDrawPos(
          compass
        );

      const close =
        this.getClosePos(
          compass
        );

      /*
       * Quick circle
       */
      ctx.beginPath();

      ctx.arc(
        quick.x,
        quick.y,
        12,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#059669';

      ctx.fill();

      ctx.strokeStyle =
        '#ffffff';

      ctx.lineWidth =
        2;

      ctx.stroke();

      ctx.beginPath();

      ctx.arc(
        quick.x,
        quick.y,
        5,
        0,
        Math.PI * 2
      );

      ctx.strokeStyle =
        '#ffffff';

      ctx.lineWidth =
        1.5;

      ctx.stroke();

      /*
       * Close
       */
      ctx.beginPath();

      ctx.arc(
        close.x,
        close.y,
        9,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#e11d48';

      ctx.fill();

      ctx.strokeStyle =
        '#ffffff';

      ctx.lineWidth =
        1.5;

      ctx.stroke();

      ctx.fillStyle =
        '#ffffff';

      ctx.font =
        'bold 11px sans-serif';

      ctx.textAlign =
        'center';

      ctx.textBaseline =
        'middle';

      ctx.fillText(
        '×',
        close.x,
        close.y
      );

      /*
       * Pencil rotation handle
       */
      ctx.beginPath();

      ctx.arc(
        pencil.x,
        pencil.y,
        17,
        0,
        Math.PI * 2
      );

      ctx.strokeStyle =
        'rgba(8,145,178,0.7)';

      ctx.lineWidth =
        1;

      ctx.setLineDash([
        3,
        3
      ]);

      ctx.stroke();

      ctx.setLineDash([]);
    }

    ctx.restore();
  }
}