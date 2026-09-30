import {
  distance,
  DEG_TO_RAD
} from './math';

export class ProtractorModel {
  static MIN_RADIUS = 90;

  static MAX_RADIUS = 300;

  static createDefault(
    x = 300,
    y = 300
  ) {
    return {
      id:
        'protractor_' +
        Date.now() +
        '_' +
        Math.random()
          .toString(36)
          .slice(2, 6),

      type:
        'protractor',

      x,
      y,

      radius:
        155,

      rotation:
        0
    };
  }

  static getRadius(
    protractor
  ) {
    return Math.max(
      this.MIN_RADIUS,
      Math.min(
        this.MAX_RADIUS,
        protractor.radius || 155
      )
    );
  }

  /*
   * Rotate a page-space point around the protractor's
   * centre by angleDeg. Used to move between the
   * protractor's own unrotated local frame (where all the
   * existing tick/hit-test math already works) and page
   * space (where the instrument is actually drawn/clicked
   * once `rotation` is applied).
   */
  static rotateAroundCenter(
    protractor,
    point,
    angleDeg
  ) {
    const rad =
      angleDeg * DEG_TO_RAD;

    const cos =
      Math.cos(rad);

    const sin =
      Math.sin(rad);

    const dx =
      point.x - protractor.x;

    const dy =
      point.y - protractor.y;

    return {
      x:
        protractor.x +
        dx * cos -
        dy * sin,

      y:
        protractor.y +
        dx * sin +
        dy * cos
    };
  }

  static getPoint(
    protractor,
    degree,
    radiusOverride = null
  ) {
    const radius =
      radiusOverride ??
      this.getRadius(protractor);

    /*
     * 0° starts from the left.
     * 90° is directly above the centre.
     * 180° ends at the right.
     */
    const angle =
      Math.PI +
      degree *
        DEG_TO_RAD;

    return {
      x:
        protractor.x +
        Math.cos(angle) *
          radius,

      y:
        protractor.y +
        Math.sin(angle) *
          radius
    };
  }

  static _localResizePos(
    protractor
  ) {
    const radius =
      this.getRadius(protractor);

    /*
     * Resize handle at the
     * right end of the baseline
     * (unrotated local frame).
     */
    return {
      x:
        protractor.x +
        radius,

      y:
        protractor.y
    };
  }

  static getResizePos(
    protractor
  ) {
    return this.rotateAroundCenter(
      protractor,
      this._localResizePos(protractor),
      protractor.rotation || 0
    );
  }

  /*
   * Rotate handle sits directly above the protractor's
   * centre (over the 90° mark) in its own local frame,
   * then gets carried around with the current rotation.
   */
  static _localRotatePos(
    protractor
  ) {
    const radius =
      this.getRadius(protractor);

    return {
      x:
        protractor.x,

      y:
        protractor.y -
        (radius + 30)
    };
  }

  static getRotatePos(
    protractor
  ) {
    return this.rotateAroundCenter(
      protractor,
      this._localRotatePos(protractor),
      protractor.rotation || 0
    );
  }

  static _localClosePos(
    protractor
  ) {
    const radius =
      this.getRadius(protractor);

    /*
     * Close button sits outside the
     * top-right corner.
     */
    const angle =
      -35 *
      DEG_TO_RAD;

    const offset =
      22;

    const d =
      radius + offset;

    return {
      x:
        protractor.x +
        Math.cos(angle) *
          d,

      y:
        protractor.y +
        Math.sin(angle) *
          d
    };
  }

  static getClosePos(
    protractor
  ) {
    return this.rotateAroundCenter(
      protractor,
      this._localClosePos(protractor),
      protractor.rotation || 0
    );
  }

  static toLocal(
    protractor,
    point
  ) {
    return {
      x:
        point.x -
        protractor.x,

      y:
        point.y -
        protractor.y
    };
  }

  static getAngleAtPoint(
    protractor,
    point
  ) {
    // Undo the instrument's current rotation first so the
    // 0-180° reading lines up with how it's actually drawn.
    const unrotatedPoint =
      this.rotateAroundCenter(
        protractor,
        point,
        -(protractor.rotation || 0)
      );

    const local =
      this.toLocal(
        protractor,
        unrotatedPoint
      );

    if (
      local.y > 20
    ) {
      return null;
    }

    const angle =
      Math.atan2(
        -local.y,
        -local.x
      ) *
      (180 / Math.PI);

    let result =
      angle;

    if (
      result < 0
    ) {
      result += 360;
    }

    /*
     * Convert the upper semicircle
     * into 0–180°.
     */
    if (
      result >= 180 &&
      result <= 360
    ) {
      return null;
    }

    return Math.max(
      0,
      Math.min(
        180,
        result
      )
    );
  }

  static hitTest(
    protractor,
    point
  ) {
    const radius =
      this.getRadius(
        protractor
      );

    // Work entirely in the protractor's own unrotated
    // local frame so rotation doesn't have to be undone
    // separately for every check below.
    const localPoint =
      this.rotateAroundCenter(
        protractor,
        point,
        -(protractor.rotation || 0)
      );

    /*
     * CLOSE MUST BE CHECKED FIRST.
     */
    const close =
      this._localClosePos(
        protractor
      );

    if (
      distance(
        localPoint,
        close
      ) <= 18
    ) {
      return {
        part:
          'close'
      };
    }

    /*
     * ROTATE HANDLE
     */
    const rotateHandle =
      this._localRotatePos(
        protractor
      );

    if (
      distance(
        localPoint,
        rotateHandle
      ) <= 18
    ) {
      return {
        part:
          'rotate'
      };
    }

    /*
     * RESIZE HANDLE
     */
    const resize =
      this._localResizePos(
        protractor
      );

    if (
      distance(
        localPoint,
        resize
      ) <= 18
    ) {
      return {
        part:
          'resize'
      };
    }

    const d =
      distance(
        localPoint,
        {
          x:
            protractor.x,

          y:
            protractor.y
        }
      );

    /*
     * Body area.
     *
     * y <= centre + small tolerance
     * means the upper semicircle + baseline.
     */
    if (
      d <= radius + 12 &&
      localPoint.y <=
        protractor.y + 18
    ) {
      return {
        part:
          'fixed'
      };
    }

    /*
     * Baseline itself.
     */
    if (
      Math.abs(
        localPoint.y -
          protractor.y
      ) <= 12 &&
      localPoint.x >=
        protractor.x -
          radius -
          10 &&
      localPoint.x <=
        protractor.x +
          radius +
          10
    ) {
      return {
        part:
          'fixed'
      };
    }

    return null;
  }

  static draw(
    ctx,
    protractor,
    isSelected = false
  ) {
    const {
      x,
      y
    } = protractor;

    const radius =
      this.getRadius(
        protractor
      );

    ctx.save();

    // Rotate the whole instrument around its own centre.
    // Everything below still draws with the original,
    // unrotated x/y math - the canvas transform carries it
    // around visually, so hit-testing (which undoes this
    // same rotation before comparing points) stays in sync.
    const rotationDeg =
      protractor.rotation || 0;

    if (rotationDeg) {
      ctx.translate(x, y);
      ctx.rotate(
        rotationDeg * DEG_TO_RAD
      );
      ctx.translate(-x, -y);
    }

    /*
     * -----------------------------------------------------
     * BODY
     * -----------------------------------------------------
     */

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      radius,
      Math.PI,
      2 * Math.PI
    );

    ctx.lineTo(
      x + radius,
      y
    );

    ctx.lineTo(
      x - radius,
      y
    );

    ctx.closePath();

    ctx.fillStyle =
      'rgba(248,250,252,0.5)';

    ctx.fill();

    ctx.strokeStyle =
      '#334155';

    ctx.lineWidth = 2;

    ctx.stroke();

    /*
     * -----------------------------------------------------
     * BASELINE
     * -----------------------------------------------------
     */

    ctx.beginPath();

    ctx.moveTo(
      x - radius,
      y
    );

    ctx.lineTo(
      x + radius,
      y
    );

    ctx.strokeStyle =
      '#0f172a';

    ctx.lineWidth = 2;

    ctx.stroke();

    /*
     * -----------------------------------------------------
     * CENTRE
     * -----------------------------------------------------
     */

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      5,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      '#2563eb';

    ctx.fill();

    /*
     * -----------------------------------------------------
     * DEGREE TICKS
     * -----------------------------------------------------
     */

    for (
      let degree = 0;
      degree <= 180;
      degree++
    ) {
      const angle =
        Math.PI +
        degree *
          DEG_TO_RAD;

      const isMajor =
        degree % 10 === 0;

      const isMedium =
        degree % 5 === 0;

      const outerRadius =
        radius - 4;

      const tickLength =
        isMajor
          ? 17
          : isMedium
          ? 11
          : 6;

      const innerRadius =
        outerRadius -
        tickLength;

      const x1 =
        x +
        Math.cos(angle) *
          innerRadius;

      const y1 =
        y +
        Math.sin(angle) *
          innerRadius;

      const x2 =
        x +
        Math.cos(angle) *
          outerRadius;

      const y2 =
        y +
        Math.sin(angle) *
          outerRadius;

      ctx.beginPath();

      ctx.moveTo(
        x1,
        y1
      );

      ctx.lineTo(
        x2,
        y2
      );

      ctx.strokeStyle =
        isMajor
          ? '#0f172a'
          : '#64748b';

      ctx.lineWidth =
        isMajor
          ? 1.5
          : isMedium
          ? 1
          : 0.6;

      ctx.stroke();
    }

    /*
     * -----------------------------------------------------
     * INTERNAL RADIAL LINES
     * -----------------------------------------------------
     */

    for (
      let degree = 10;
      degree < 180;
      degree += 10
    ) {
      const angle =
        Math.PI +
        degree *
          DEG_TO_RAD;

      const innerRadius =
        radius * 0.72;

      ctx.beginPath();

      ctx.moveTo(
        x,
        y
      );

      ctx.lineTo(
        x +
          Math.cos(angle) *
            innerRadius,

        y +
          Math.sin(angle) *
            innerRadius
      );

      ctx.strokeStyle =
        'rgba(100,116,139,0.16)';

      ctx.lineWidth =
        0.7;

      ctx.stroke();
    }

    /*
     * -----------------------------------------------------
     * DUAL-SCALE DIVIDER ARCS
     * -----------------------------------------------------
     */

    // Divider arc between outer (0-180) and inner (180-0) scales
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      radius - 35,
      Math.PI,
      2 * Math.PI
    );
    ctx.strokeStyle = 'rgba(71,85,105,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Baseline arc for inner degree scale
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      radius * 0.68,
      Math.PI,
      2 * Math.PI
    );
    ctx.strokeStyle = 'rgba(71,85,105,0.3)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    /*
     * -----------------------------------------------------
     * DEGREE LABELS
     * -----------------------------------------------------
     */

    ctx.font =
      '10px "JetBrains Mono", monospace';

    ctx.fillStyle =
      '#1e293b';

    ctx.textAlign =
      'center';

    ctx.textBaseline =
      'middle';

    for (
      let degree = 0;
      degree <= 180;
      degree += 10
    ) {
      const angle =
        Math.PI +
        degree *
          DEG_TO_RAD;

      // Outer label (0 on left, 180 on right)
      const outerLabelRadius =
        radius - 28;
      const outerX =
        x +
        Math.cos(angle) *
          outerLabelRadius;
      const outerY =
        y +
        Math.sin(angle) *
          outerLabelRadius;

      // Inner label (180 on left, 0 on right)
      const innerDegree = 180 - degree;
      const innerLabelRadius =
        radius - 42;
      const innerX =
        x +
        Math.cos(angle) *
          innerLabelRadius;
      const innerY =
        y +
        Math.sin(angle) *
          innerLabelRadius;

      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(
        String(degree),
        outerX,
        outerY
      );

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(
        String(innerDegree),
        innerX,
        innerY
      );
    }

    /*
     * -----------------------------------------------------
     * TITLE
     * -----------------------------------------------------
     */

    ctx.font =
      'bold 11px "JetBrains Mono", monospace';

    ctx.fillStyle =
      '#334155';

    ctx.fillText(
      'PROTRACTOR',
      x,
      y -
        radius * 0.38
    );

    /*
     * -----------------------------------------------------
     * SELECTION
     * -----------------------------------------------------
     */

    if (isSelected) {
      ctx.beginPath();

      ctx.arc(
        x,
        y,
        radius + 6,
        Math.PI,
        2 * Math.PI
      );

      ctx.strokeStyle =
        '#3b82f6';

      ctx.lineWidth =
        2;

      ctx.setLineDash([
        5,
        4
      ]);

      ctx.stroke();

      ctx.setLineDash([]);

      /*
       * Rotate handle (drawn in local coordinates - the
       * canvas is already rotated at this point).
       */
      const rotateHandle =
        this._localRotatePos(
          protractor
        );

      ctx.beginPath();

      ctx.moveTo(
        x,
        y - radius
      );

      ctx.lineTo(
        rotateHandle.x,
        rotateHandle.y
      );

      ctx.strokeStyle =
        'rgba(8,145,178,0.55)';

      ctx.lineWidth =
        1.5;

      ctx.setLineDash([
        4,
        3
      ]);

      ctx.stroke();

      ctx.setLineDash([]);

      ctx.beginPath();

      ctx.arc(
        rotateHandle.x,
        rotateHandle.y,
        9,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#0891b2';

      ctx.fill();

      ctx.strokeStyle =
        '#ffffff';

      ctx.lineWidth =
        2;

      ctx.stroke();

      ctx.beginPath();

      ctx.arc(
        rotateHandle.x,
        rotateHandle.y,
        3.5,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#ffffff';

      ctx.fill();

      /*
       * Resize handle
       */
      const resize =
        this._localResizePos(
          protractor
        );

      ctx.beginPath();

      ctx.arc(
        resize.x,
        resize.y,
        8,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#2563eb';

      ctx.fill();

      ctx.strokeStyle =
        '#ffffff';

      ctx.lineWidth =
        2;

      ctx.stroke();

      /*
       * Resize icon
       */
      ctx.beginPath();

      ctx.moveTo(
        resize.x - 3,
        resize.y
      );

      ctx.lineTo(
        resize.x + 3,
        resize.y
      );

      ctx.moveTo(
        resize.x,
        resize.y - 3
      );

      ctx.lineTo(
        resize.x,
        resize.y + 3
      );

      ctx.strokeStyle =
        '#ffffff';

      ctx.lineWidth =
        1.5;

      ctx.stroke();

      /*
       * Close button
       */
      const close =
        this._localClosePos(
          protractor
        );

      ctx.beginPath();

      ctx.arc(
        close.x,
        close.y,
        10,
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
        'bold 12px sans-serif';

      ctx.textAlign =
        'center';

      ctx.textBaseline =
        'middle';

      ctx.fillText(
        '×',
        close.x,
        close.y
      );
    }

    ctx.restore();
  }
}