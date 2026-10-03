/**
 * GeometryCorrector - turns a recognition result into CLEAN geometry.
 *
 *   recognition -> snap angles / regularise -> shape "spec" -> polyline points
 *
 * A spec is a small, editable description of the shape (centre + radius,
 * corner list, ...). It is stored on the annotation so the shape can later be
 * moved, resized and rotated mathematically instead of as loose pixels.
 *
 * Specs:
 *   { kind:'line',   a, b }
 *   { kind:'angle',  a, vertex, b }
 *   { kind:'arc',    cx, cy, r, a0, sweep }
 *   { kind:'circle', cx, cy, r }
 *   { kind:'ellipse',cx, cy, rx, ry, rot }
 *   { kind:'triangle'|'rectangle'|'square'|'quadrilateral'|'pentagon'|
 *           'hexagon'|'polygon', verts:[...] }
 *   { kind:'freehand', points:[...] }          (plain strokes, move/resize only)
 */

import {
  DEG,
  dist,
  pt,
  centroid,
  rotatePoint,
  angleDiff,
  mean,
  stdDev
} from './geometrymath.js';
import { SHAPE_LABELS } from './shaperecognizer.js';

export const SNAP_CONFIG = {
  // Directions a line can snap to (degrees, modulo 180)
  lineAngles: [0, 30, 45, 60, 90, 120, 135, 150, 180],
  axisTolerance: 6, // horizontal / vertical
  commonTolerance: 3.5, // 30, 45, 60 ...
  // Opening angles an angle can snap to (degrees)
  openingAngles: [30, 45, 60, 90, 120, 135, 150],
  openingTolerance: 4,
  rectangleAxisTolerance: 7
};

// ---------------------------------------------------------------------------
// Snapping helpers
// ---------------------------------------------------------------------------

/** Snap a direction (degrees) to the nearest common line angle, or null. */
function snapDirection(deg) {
  const d = ((deg % 180) + 180) % 180;
  let best = null;
  let bestDiff = Infinity;
  for (const s of SNAP_CONFIG.lineAngles) {
    const tol =
      s % 90 === 0 ? SNAP_CONFIG.axisTolerance : SNAP_CONFIG.commonTolerance;
    const diff = Math.abs(d - s);
    if (diff <= tol && diff < bestDiff) {
      best = s;
      bestDiff = diff;
    }
  }
  return best === null ? null : best - d; // correction to apply (degrees)
}

function snapToMultiple(deg, step, tol) {
  const nearest = Math.round(deg / step) * step;
  return Math.abs(deg - nearest) <= tol ? nearest - deg : 0;
}

const rotateAll = (points, pivot, angle) =>
  points.map((p) => ({ ...p, ...rotatePoint(p, pivot, angle) }));

// ---------------------------------------------------------------------------
// Per-shape correction -> spec
// ---------------------------------------------------------------------------

function correctLine({ a, b }) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const len = dist(a, b);
  let theta = Math.atan2(b.y - a.y, b.x - a.x);

  const fix = snapDirection(theta / DEG);
  if (fix !== null) theta += fix * DEG;

  const hx = (Math.cos(theta) * len) / 2;
  const hy = (Math.sin(theta) * len) / 2;
  return {
    kind: 'line',
    a: { x: mid.x - hx, y: mid.y - hy },
    b: { x: mid.x + hx, y: mid.y + hy }
  };
}

function correctAngle({ a, vertex, b }) {
  const len1 = dist(vertex, a);
  const len2 = dist(vertex, b);
  let th1 = Math.atan2(a.y - vertex.y, a.x - vertex.x);
  let th2 = Math.atan2(b.y - vertex.y, b.x - vertex.x);

  // 1. first arm snaps to horizontal / vertical, whole angle rotates with it
  const axisFix = snapToMultiple(th1 / DEG, 90, SNAP_CONFIG.axisTolerance);
  th1 += axisFix * DEG;
  th2 += axisFix * DEG;

  // 2. opening between the arms snaps to a common angle
  const signed = angleDiff(th2, th1); // -PI..PI
  const sign = signed >= 0 ? 1 : -1;
  const opening = Math.abs(signed) / DEG;
  let target = opening;
  for (const s of SNAP_CONFIG.openingAngles) {
    if (Math.abs(opening - s) <= SNAP_CONFIG.openingTolerance) {
      target = s;
      break;
    }
  }
  th2 = th1 + sign * target * DEG;

  return {
    kind: 'angle',
    a: { x: vertex.x + Math.cos(th1) * len1, y: vertex.y + Math.sin(th1) * len1 },
    vertex: { x: vertex.x, y: vertex.y },
    b: { x: vertex.x + Math.cos(th2) * len2, y: vertex.y + Math.sin(th2) * len2 }
  };
}

function regularPolygon(verts) {
  const m = verts.length;
  const c = centroid(verts);
  const R = mean(verts.map((v) => dist(v, c)));
  let sx = 0;
  let sy = 0;
  for (const v of verts) {
    const a = Math.atan2(v.y - c.y, v.x - c.x);
    sx += Math.cos(m * a);
    sy += Math.sin(m * a);
  }
  const phi = Math.atan2(sy, sx) / m;
  const out = [];
  for (let i = 0; i < m; i++) {
    const a = phi + (2 * Math.PI * i) / m;
    out.push({ x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R });
  }
  return out;
}

function isRegular(verts, metrics) {
  const m = verts.length;
  const sides = metrics.sides;
  const sideCv = stdDev(sides) / (mean(sides) || 1);
  const expected = ((m - 2) * 180) / m;
  const anglesOk = metrics.angles.every(
    (a) => Math.abs(a - expected) < expected * (m === 3 ? 0.15 : 0.2)
  );
  return sideCv < (m === 3 ? 0.09 : 0.15) && anglesOk;
}

/** Edge orientation (radians) shared by the four sides of a rectangle. */
function rectangleOrientation(verts) {
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < 4; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % 4];
    const phi = Math.atan2(b.y - a.y, b.x - a.x);
    sx += Math.cos(4 * phi);
    sy += Math.sin(4 * phi);
  }
  let theta = Math.atan2(sy, sx) / 4;
  const fix = snapToMultiple(theta / DEG, 90, SNAP_CONFIG.rectangleAxisTolerance);
  theta += fix * DEG;
  return theta;
}

function correctRectangle(verts, forceSquare) {
  const theta = rectangleOrientation(verts);
  const u = { x: Math.cos(theta), y: Math.sin(theta) };
  const v = { x: -Math.sin(theta), y: Math.cos(theta) };

  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const p of verts) {
    const pu = p.x * u.x + p.y * u.y;
    const pv = p.x * v.x + p.y * v.y;
    minU = Math.min(minU, pu);
    maxU = Math.max(maxU, pu);
    minV = Math.min(minV, pv);
    maxV = Math.max(maxV, pv);
  }
  const cu = (minU + maxU) / 2;
  const cv = (minV + maxV) / 2;
  let w = maxU - minU;
  let h = maxV - minV;
  if (forceSquare) w = h = (w + h) / 2;

  const corner = (su, sv) => {
    const pu = cu + (su * w) / 2;
    const pv = cv + (sv * h) / 2;
    return { x: pu * u.x + pv * v.x, y: pu * u.y + pv * v.y };
  };
  return [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
}

function correctTriangle(verts, metrics) {
  // Clearly equilateral -> make it exactly equilateral
  if (isRegular(verts, metrics)) return regularPolygon(verts);

  // Right-angled -> make the right angle exact and axis-align the legs
  const idx = metrics.angles.findIndex((a) => Math.abs(a - 90) < 7);
  if (idx !== -1) {
    const V = verts[idx];
    const A = verts[(idx + 2) % 3];
    const B = verts[(idx + 1) % 3];

    const lenA = dist(V, A);
    const lenB = dist(V, B);
    const ux = (A.x - V.x) / lenA;
    const uy = (A.y - V.y) / lenA;
    let wx = -uy;
    let wy = ux;
    if (wx * (B.x - V.x) + wy * (B.y - V.y) < 0) {
      wx = -wx;
      wy = -wy;
    }
    let out = [V, A, { x: V.x + wx * lenB, y: V.y + wy * lenB }];

    const legAngle = Math.atan2(A.y - V.y, A.x - V.x) / DEG;
    const fix = snapToMultiple(legAngle, 90, 6);
    if (fix !== 0) out = rotateAll(out, V, fix * DEG);

    // keep the original vertex order (idx, idx+2, idx+1 -> back to order)
    const result = new Array(3);
    result[idx] = out[0];
    result[(idx + 2) % 3] = out[1];
    result[(idx + 1) % 3] = out[2];
    return result;
  }

  // Any other triangle: keep the user's proportions
  return verts.map((v) => ({ x: v.x, y: v.y }));
}

function correctPolygon(recognition) {
  const { kind, params, metrics } = recognition;
  const verts = params.verts;

  if (kind === 'triangle') return correctTriangle(verts, metrics);
  if (kind === 'rectangle') return correctRectangle(verts, false);
  if (kind === 'square') return correctRectangle(verts, true);

  if (
    (kind === 'pentagon' || kind === 'hexagon' || kind === 'polygon') &&
    isRegular(verts, metrics)
  ) {
    return regularPolygon(verts);
  }
  return verts.map((v) => ({ x: v.x, y: v.y }));
}

// ---------------------------------------------------------------------------
// Spec -> points
// ---------------------------------------------------------------------------

export function specToPoints(spec) {
  if (spec.points) return spec.points.map((p) => ({ ...p }));

  switch (spec.kind) {
    case 'line':
      return [pt(spec.a.x, spec.a.y), pt(spec.b.x, spec.b.y)];

    case 'angle':
      return [
        pt(spec.a.x, spec.a.y),
        pt(spec.vertex.x, spec.vertex.y),
        pt(spec.b.x, spec.b.y)
      ];

    case 'arc': {
      const steps = Math.max(12, Math.ceil(Math.abs(spec.sweep) / (3 * DEG)));
      const out = [];
      for (let i = 0; i <= steps; i++) {
        const a = spec.a0 + (spec.sweep * i) / steps;
        out.push(pt(spec.cx + Math.cos(a) * spec.r, spec.cy + Math.sin(a) * spec.r));
      }
      return out;
    }

    case 'circle': {
      const steps = 128;
      const out = [];
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        out.push(pt(spec.cx + Math.cos(a) * spec.r, spec.cy + Math.sin(a) * spec.r));
      }
      return out;
    }

    case 'ellipse': {
      const steps = 128;
      const cos = Math.cos(spec.rot);
      const sin = Math.sin(spec.rot);
      const out = [];
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const x = Math.cos(t) * spec.rx;
        const y = Math.sin(t) * spec.ry;
        out.push(pt(spec.cx + x * cos - y * sin, spec.cy + x * sin + y * cos));
      }
      return out;
    }

    default:
      if (spec.verts) {
        return spec.verts
          .map((v) => pt(v.x, v.y))
          .concat([pt(spec.verts[0].x, spec.verts[0].y)]);
      }
      return [];
  }
}

export function isClosedSpec(spec) {
  return (
    !!spec.verts || spec.kind === 'circle' || spec.kind === 'ellipse'
  );
}

// ---------------------------------------------------------------------------
// Editing: move / resize / rotate a spec
// ---------------------------------------------------------------------------

/**
 * Apply  p' = pivot + R(rotation) * scale * (p - pivot) + (dx, dy)
 * to every defining point of the spec. Returns a NEW spec.
 */
export function transformSpec(
  spec,
  { pivot = { x: 0, y: 0 }, scale = 1, rotation = 0, dx = 0, dy = 0 } = {}
) {
  const map = (p) => {
    const sx = pivot.x + (p.x - pivot.x) * scale;
    const sy = pivot.y + (p.y - pivot.y) * scale;
    const r = rotatePoint({ x: sx, y: sy }, pivot, rotation);
    return { ...p, x: r.x + dx, y: r.y + dy };
  };

  if (spec.points) return { ...spec, points: spec.points.map(map) };
  if (spec.verts) return { ...spec, verts: spec.verts.map(map) };

  switch (spec.kind) {
    case 'line':
      return { ...spec, a: map(spec.a), b: map(spec.b) };
    case 'angle':
      return { ...spec, a: map(spec.a), vertex: map(spec.vertex), b: map(spec.b) };
    case 'circle': {
      const c = map({ x: spec.cx, y: spec.cy });
      return { ...spec, cx: c.x, cy: c.y, r: spec.r * scale };
    }
    case 'ellipse': {
      const c = map({ x: spec.cx, y: spec.cy });
      return {
        ...spec,
        cx: c.x,
        cy: c.y,
        rx: spec.rx * scale,
        ry: spec.ry * scale,
        rot: spec.rot + rotation
      };
    }
    case 'arc': {
      const c = map({ x: spec.cx, y: spec.cy });
      return {
        ...spec,
        cx: c.x,
        cy: c.y,
        r: spec.r * scale,
        a0: spec.a0 + rotation
      };
    }
    default:
      return spec;
  }
}

// ---------------------------------------------------------------------------
// Public: recognition -> corrected geometry
// ---------------------------------------------------------------------------

export function correctGeometry(recognition) {
  const { family, params, kind } = recognition;
  let spec;

  switch (family) {
    case 'line':
      spec = correctLine(params);
      break;
    case 'angle':
      spec = correctAngle(params);
      break;
    case 'arc':
      spec = { kind: 'arc', ...params };
      break;
    case 'circle':
      spec = { kind: 'circle', ...params };
      break;
    case 'ellipse':
      spec = { kind: 'ellipse', ...params };
      break;
    default:
      spec = { kind, verts: correctPolygon(recognition) };
  }

  return {
    kind,
    label: SHAPE_LABELS[kind] || 'Shape',
    spec,
    points: specToPoints(spec)
  };
}