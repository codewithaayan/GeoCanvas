/**
 * GeoCanvas — Core Geometry & Vector Mathematics
 * Consolidated mathematical algorithms for drafting, measurements, and snapping.
 */

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

/**
 * Euclidean distance between two points (x1, y1) and (x2, y2)
 */
export function distance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Angle in degrees of a line segment from p1 to p2 (-180 to 180)
 */
export function angleBetweenPoints(p1, p2) {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x) * RAD_TO_DEG;
}

/**
 * Normalize an angle in degrees to [0, 360)
 */
export function normalizeAngle(deg) {
  let angle = deg % 360;
  if (angle < 0) angle += 360;
  return angle;
}

/**
 * Rotate a point around a center origin by an angle in degrees
 */
export function rotatePoint(p, center, angleDeg) {
  const rad = angleDeg * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + (dx * cos - dy * sin),
    y: center.y + (dx * sin + dy * cos)
  };
}

/**
 * 3-Point Angle Calculation
 * For points A, B, C where B is the vertex:
 *   BA = A - B
 *   BC = C - B
 *   cos(theta) = (BA . BC) / (|BA| * |BC|)
 * Returns angle in degrees, formatted value, and start/end radians for rendering arc.
 */
export function calculate3PointAngle(A, B, C, precision = 1) {
  const BA = { x: A.x - B.x, y: A.y - B.y };
  const BC = { x: C.x - B.x, y: C.y - B.y };

  const dot = BA.x * BC.x + BA.y * BC.y;
  const magBA = Math.sqrt(BA.x * BA.x + BA.y * BA.y);
  const magBC = Math.sqrt(BC.x * BC.x + BC.y * BC.y);

  if (magBA === 0 || magBC === 0) {
    return { degrees: 0, text: '0°', startAngle: 0, endAngle: 0, clockwise: false };
  }

  // Clamp cosine to [-1, 1] to prevent floating point domain errors
  const cosTheta = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  const angleRad = Math.acos(cosTheta);
  const angleDeg = angleRad * RAD_TO_DEG;

  const startRad = Math.atan2(BA.y, BA.x);
  const endRad = Math.atan2(BC.y, BC.x);

  // Determine sweep direction
  const cross = BA.x * BC.y - BA.y * BC.x;
  const clockwise = cross < 0;

  return {
    degrees: angleDeg,
    text: `${angleDeg.toFixed(precision)}°`,
    startAngle: startRad,
    endAngle: endRad,
    clockwise
  };
}

/**
 * Distance from a point P to a line segment AB.
 * Returns { distance, nearestPoint, t }
 */
export function pointToSegmentDistance(P, A, B) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const l2 = dx * dx + dy * dy;

  if (l2 === 0) {
    return {
      distance: distance(P, A),
      nearestPoint: { x: A.x, y: A.y },
      t: 0
    };
  }

  // Parameter t clamped to [0, 1] along the segment
  let t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));

  const nearestPoint = {
    x: A.x + t * dx,
    y: A.y + t * dy
  };

  return {
    distance: distance(P, nearestPoint),
    nearestPoint,
    t
  };
}

/**
 * Check if a point P is within tolerance distance to an entire polyline stroke.
 * Used for vector stroke-based erasing.
 */
export function pointHitsStroke(P, points, tolerance = 10) {
  if (!points || points.length === 0) return false;
  if (points.length === 1) {
    return distance(P, points[0]) <= tolerance;
  }

  for (let i = 0; i < points.length - 1; i++) {
    const res = pointToSegmentDistance(P, points[i], points[i + 1]);
    if (res.distance <= tolerance) {
      return true;
    }
  }
  return false;
}

/**
 * Snap a line's angle to a reference angle (e.g., ruler or set square edge)
 * If the angle difference is within tolerance, returns the snapped endpoint.
 */
export function snapLineToAngle(start, currentEnd, targetAngleDeg, toleranceDeg = 5) {
  const lineAngle = angleBetweenPoints(start, currentEnd);
  const len = distance(start, currentEnd);
  if (len < 5) return currentEnd;

  // Potential snapping angles: parallel, anti-parallel, perpendicular
  const candidateAngles = [
    targetAngleDeg,
    targetAngleDeg + 90,
    targetAngleDeg - 90,
    targetAngleDeg + 180,
    targetAngleDeg - 180
  ];

  let bestSnap = null;
  let minDiff = toleranceDeg;

  for (const cand of candidateAngles) {
    let diff = Math.abs(((lineAngle - cand + 180) % 360) - 180);
    if (diff < minDiff) {
      minDiff = diff;
      bestSnap = cand;
    }
  }

  if (bestSnap !== null) {
    const rad = bestSnap * DEG_TO_RAD;
    return {
      x: start.x + len * Math.cos(rad),
      y: start.y + len * Math.sin(rad),
      snapped: true,
      snappedAngle: bestSnap
    };
  }

  return { ...currentEnd, snapped: false };
}

/**
 * Test if point (px, py) is inside an oriented bounding box
 */
export function isPointInRotatedRect(P, rectCenter, width, height, angleDeg) {
  // Rotate point back by -angleDeg relative to center
  const localP = rotatePoint(P, rectCenter, -angleDeg);
  const halfW = width / 2;
  const halfH = height / 2;
  return (
    localP.x >= rectCenter.x - halfW &&
    localP.x <= rectCenter.x + halfW &&
    localP.y >= rectCenter.y - halfH &&
    localP.y <= rectCenter.y + halfH
  );
}

/**
 * Snap a coordinate value to millimeter or grid increments
 */
export function snapToGrid(val, step = 10) {
  return Math.round(val / step) * step;
}

/**
 * Distance from a point P to a circular arc
 */
export function pointToArcDistance(P, center, radius, startDeg, endDeg) {
  const d = distance(P, center);
  const radDiff = Math.abs(d - radius);

  // Compute angle of P relative to center
  let pAngle = normalizeAngle(angleBetweenPoints(center, P));
  let s = normalizeAngle(startDeg);
  let e = normalizeAngle(endDeg);

  let isInsideAngle = false;
  if (s <= e) {
    isInsideAngle = pAngle >= s && pAngle <= e;
  } else {
    isInsideAngle = pAngle >= s || pAngle <= e;
  }

  if (isInsideAngle) {
    return radDiff;
  }

  // Distance to arc endpoints
  const sRad = s * DEG_TO_RAD;
  const eRad = e * DEG_TO_RAD;
  const startPt = { x: center.x + radius * Math.cos(sRad), y: center.y + radius * Math.sin(sRad) };
  const endPt = { x: center.x + radius * Math.cos(eRad), y: center.y + radius * Math.sin(eRad) };

  return Math.min(distance(P, startPt), distance(P, endPt));
}

