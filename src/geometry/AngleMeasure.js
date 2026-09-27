import { calculate3PointAngle, distance, pointToSegmentDistance } from './math';

export class AngleMeasureModel {
  static createDefault(x = 300, y = 300, armLen = 90, angleDeg = 53.2) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      id: 'angle_' + Date.now(),
      type: 'angle',
      B: { x, y }, // Vertex
      A: { x: x + armLen, y }, // Arm 1
      C: { x: x + armLen * Math.cos(rad), y: y - armLen * Math.sin(rad) }, // Arm 2
      color: '#2563eb',
      arcRadius: 35,
      precision: 1
    };
  }

  static hitTest(obj, point) {
    const tol = 16;
    // Check Vertex B
    if (distance(point, obj.B) <= tol) return { part: 'vertex_B' };
    // Check Arm A endpoint
    if (distance(point, obj.A) <= tol) return { part: 'point_A' };
    // Check Arm C endpoint
    if (distance(point, obj.C) <= tol) return { part: 'point_C' };

    // Check Close button (near vertex)
    const closePos = { x: obj.B.x - 22, y: obj.B.y - 22 };
    if (distance(point, closePos) <= 14) return { part: 'close' };

    // Check proximity to arms BA or BC
    const dBA = pointToSegmentDistance(point, obj.B, obj.A).distance;
    const dBC = pointToSegmentDistance(point, obj.B, obj.C).distance;
    if (dBA <= 12 || dBC <= 12) return { part: 'body' };

    return null;
  }

  static draw(ctx, obj, isSelected = false) {
    const { A, B, C, color, precision = 1 } = obj;
    const mathAngle = calculate3PointAngle(A, B, C, precision);

    ctx.save();

    // 1. Draw Arm Rays: BA and BC
    ctx.beginPath();
    ctx.moveTo(B.x, B.y);
    ctx.lineTo(A.x, A.y);
    ctx.moveTo(B.x, B.y);
    ctx.lineTo(C.x, C.y);
    ctx.strokeStyle = color || '#2563eb';
    ctx.lineWidth = isSelected ? 2.5 : 2;
    ctx.stroke();

    // 2. Draw Angle Measurement Arc
    const r = Math.min(obj.arcRadius || 35, distance(B, A) * 0.7, distance(B, C) * 0.7);
    if (r > 8) {
      ctx.beginPath();
      ctx.arc(B.x, B.y, r, mathAngle.startAngle, mathAngle.endAngle, mathAngle.clockwise);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Semi-transparent arc fill
      ctx.beginPath();
      ctx.moveTo(B.x, B.y);
      ctx.arc(B.x, B.y, r, mathAngle.startAngle, mathAngle.endAngle, mathAngle.clockwise);
      ctx.closePath();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.fill();
    }

    // 3. Draw Angle Degree Badge
    // Compute bisector angle for label placement
    let bisector = (mathAngle.startAngle + mathAngle.endAngle) / 2;
    if (mathAngle.clockwise && mathAngle.startAngle < mathAngle.endAngle) {
      bisector += Math.PI;
    }
    const labelDist = r + 22;
    const labelX = B.x + labelDist * Math.cos(bisector);
    const labelY = B.y + labelDist * Math.sin(bisector);

    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    const text = mathAngle.text;
    const textWidth = ctx.measureText(text).width;

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(labelX - textWidth / 2 - 6, labelY - 11, textWidth + 12, 22, 5);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, labelX, labelY);

    // 4. Draw Vertex and Endpoint Markers
    // Vertex B (amber pivot)
    ctx.beginPath();
    ctx.arc(B.x, B.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Endpoint A
    ctx.beginPath();
    ctx.arc(A.x, A.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Endpoint C
    ctx.beginPath();
    ctx.arc(C.x, C.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 5. Handles when selected
    if (isSelected) {
      const closePos = { x: B.x - 22, y: B.y - 22 };
      ctx.beginPath();
      ctx.arc(closePos.x, closePos.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('×', closePos.x, closePos.y);
    }

    ctx.restore();
  }
}
