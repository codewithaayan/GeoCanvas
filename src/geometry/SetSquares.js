import { DEG_TO_RAD, rotatePoint, distance } from './math';

export class SetSquareModel {
  static CM_TO_PT = 28.3465;

  static createDefault45(x = 220, y = 300, sizeCm = 12) {
    return {
      id: 'setsquare45_' + Date.now(),
      type: 'setSquare45',
      x,
      y,
      size: sizeCm * SetSquareModel.CM_TO_PT,
      rotation: 0
    };
  }

  static createDefault60(x = 380, y = 300, sizeCm = 10) {
    return {
      id: 'setsquare60_' + Date.now(),
      type: 'setSquare60',
      x,
      y,
      size: sizeCm * SetSquareModel.CM_TO_PT, // short leg length
      rotation: 0
    };
  }

  /**
   * Get triangle vertices in local coordinate space (centered at origin)
   */
  static getLocalVertices(square) {
    const is45 = square.type === 'setSquare45';
    if (is45) {
      const L = square.size;
      // Center the centroid at (0, 0) for smooth rotation
      const cx = L / 3;
      const cy = -L / 3;
      return [
        { x: -cx, y: -cy },         // V0: Right angle (90°)
        { x: L - cx, y: -cy },     // V1: 45° corner
        { x: -cx, y: -L - cy }      // V2: 45° corner
      ];
    } else {
      const L = square.size;
      const longLeg = L * Math.sqrt(3);
      const cx = longLeg / 3;
      const cy = -L / 3;
      return [
        { x: -cx, y: -cy },         // V0: Right angle (90°)
        { x: longLeg - cx, y: -cy },// V1: 30° corner
        { x: -cx, y: -L - cy }      // V2: 60° corner
      ];
    }
  }

  /**
   * Get triangle vertices in world coordinates
   */
  static getWorldVertices(square) {
    const localVerts = SetSquareModel.getLocalVertices(square);
    const center = { x: square.x, y: square.y };
    return localVerts.map(v => rotatePoint({ x: square.x + v.x, y: square.y + v.y }, center, square.rotation));
  }

  /**
   * Returns all 3 edges in world coordinates for line snapping
   */
  static getEdges(square) {
    const verts = SetSquareModel.getWorldVertices(square);
    return [
      { start: verts[0], end: verts[1] }, // Leg 1
      { start: verts[1], end: verts[2] }, // Hypotenuse
      { start: verts[2], end: verts[0] }  // Leg 2
    ];
  }

  static hitTest(square, point) {
    const center = { x: square.x, y: square.y };
    const local = rotatePoint(point, center, -square.rotation);
    const localVerts = SetSquareModel.getLocalVertices(square);

    // Rotate handle at corner V1
    const rotHandle = { x: square.x + localVerts[1].x, y: square.y + localVerts[1].y };
    if (distance(local, rotHandle) <= 18) {
      return { part: 'rotate' };
    }

    // Resize handle at corner V2
    const resizeHandle = { x: square.x + localVerts[2].x, y: square.y + localVerts[2].y };
    if (distance(local, resizeHandle) <= 18) {
      return { part: 'resize' };
    }

    // Close button near corner V0 (right angle)
    const closeHandle = { x: square.x + localVerts[0].x + 18, y: square.y + localVerts[0].y - 18 };
    if (distance(local, closeHandle) <= 14) {
      return { part: 'close' };
    }

    // Point in triangle test using barycentric coordinates
    const p = { x: local.x - square.x, y: local.y - square.y };
    const [a, b, c] = localVerts;
    const det = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    const u = ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / det;
    const v = ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / det;
    const w = 1 - u - v;

    if (u >= 0 && v >= 0 && w >= 0) {
      return { part: 'body' };
    }

    return null;
  }

  static draw(ctx, square, isSelected = false) {
    ctx.save();
    ctx.translate(square.x, square.y);
    ctx.rotate(square.rotation * DEG_TO_RAD);

    const is45 = square.type === 'setSquare45';
    const verts = SetSquareModel.getLocalVertices(square);
    const [v0, v1, v2] = verts;

    // Outer Acrylic Triangle
    ctx.beginPath();
    ctx.moveTo(v0.x, v0.y);
    ctx.lineTo(v1.x, v1.y);
    ctx.lineTo(v2.x, v2.y);
    ctx.closePath();

    ctx.fillStyle = is45 ? 'rgba(238, 242, 255, 0.88)' : 'rgba(240, 253, 244, 0.88)';
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#3b82f6' : 'rgba(51, 65, 85, 0.6)';
    ctx.lineWidth = isSelected ? 2 : 1.2;
    ctx.stroke();

    // Inner Cutout Triangle
    const shrink = 0.55;
    ctx.beginPath();
    ctx.moveTo(v0.x * shrink, v0.y * shrink);
    ctx.lineTo(v1.x * shrink, v1.y * shrink);
    ctx.lineTo(v2.x * shrink, v2.y * shrink);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Highlighting on Drafting Edges
    ctx.beginPath();
    ctx.moveTo(v0.x, v0.y);
    ctx.lineTo(v1.x, v1.y);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Metric graduation ticks along bottom leg (v0 to v1)
    const legLen = distance(v0, v1);
    const mmStep = SetSquareModel.CM_TO_PT / 10;
    const numTicks = Math.floor(legLen / mmStep);

    ctx.strokeStyle = '#334155';
    ctx.fillStyle = '#0f172a';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i <= numTicks; i++) {
      const t = (i * mmStep) / legLen;
      if (t > 0.95) break;
      const tx = v0.x + t * (v1.x - v0.x);
      const ty = v0.y + t * (v1.y - v0.y);

      const isCm = i % 10 === 0;
      const is5 = i % 5 === 0 && !isCm;
      const tickH = isCm ? 12 : is5 ? 8 : 5;

      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx, ty - tickH);
      ctx.stroke();

      if (isCm && i > 0) {
        ctx.fillText(`${i / 10}`, tx, ty - 15);
      }
    }

    // Angle degree labels inside corners
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#1e3a8a';
    ctx.fillText('90°', v0.x + 14, v0.y - 12);

    if (is45) {
      ctx.fillText('45°', v1.x - 24, v1.y - 8);
      ctx.fillText('45°', v2.x + 14, v2.y + 24);
      ctx.fillText('45° SET SQUARE', 0, 10);
    } else {
      ctx.fillText('30°', v1.x - 24, v1.y - 8);
      ctx.fillText('60°', v2.x + 14, v2.y + 24);
      ctx.fillText('30°/60° SET SQUARE', 0, 10);
    }

    // Selected handles
    if (isSelected) {
      // Rotate handle (at v1)
      ctx.beginPath();
      ctx.arc(v1.x, v1.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Resize handle (at v2)
      ctx.beginPath();
      ctx.arc(v2.x, v2.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Close button (near v0)
      ctx.beginPath();
      ctx.arc(v0.x + 18, v0.y - 18, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('×', v0.x + 18, v0.y - 18);
    }

    ctx.restore();
  }
}
