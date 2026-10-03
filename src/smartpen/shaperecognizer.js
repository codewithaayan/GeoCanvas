/**
 * ShapeRecognizer - decides WHAT the user meant to draw.
 *
 * Pure geometry (no machine learning, no canvas, no UI):
 *
 *   raw points -> smooth noise -> open / closed -> simplify (RDP)
 *     -> detect corners -> angles & side lengths -> classify -> confidence
 *
 * It only classifies and fits rough parameters. Producing the clean, snapped
 * geometry is the job of GeometryCorrector.
 *
 * recognizeStroke() returns null, or:
 * {
 *   kind:        'line' | 'angle' | 'arc' | 'circle' | 'ellipse' | 'triangle' |
 *                'rectangle' | 'square' | 'quadrilateral' | 'pentagon' |
 *                'hexagon' | 'polygon',
 *   family:      'line' | 'angle' | 'arc' | 'circle' | 'ellipse' | 'polygon',
 *   confidence:  0..1,
 *   params:      fitted (not yet snapped) geometry for that family,
 *   metrics:     { closed, corners, angles (deg), sides, fitError },
 *   alternatives:[{ kind, confidence }]
 * }
 */

import {
  DEG,
  dist,
  clamp,
  clamp01,
  pt,
  pathLength,
  centroid,
  bounds,
  pointSegmentDistance,
  distanceToPolyline,
  resample,
  rdpIndices,
  fitCircle,
  fitLine,
  projectOnLine,
  distanceToLine,
  intersectLines,
  interiorAngle,
  mean
} from './geometrymath.js';
import { smoothStroke } from './strokesmoother.js';

export const SHAPE_LABELS = {
  line: 'Line',
  angle: 'Angle',
  arc: 'Arc',
  circle: 'Circle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  rectangle: 'Rectangle',
  square: 'Square',
  quadrilateral: 'Quadrilateral',
  pentagon: 'Pentagon',
  hexagon: 'Hexagon',
  polygon: 'Polygon'
};

// Error (relative to shape size) at which confidence drops to 0.
const TOLERANCE = {
  line: 0.06,
  angle: 0.06,
  arc: 0.08,
  circle: 0.075,
  ellipse: 0.065,
  polygon: 0.055
};

const fitConfidence = (err, family) => clamp01(1 - err / TOLERANCE[family]);

const rms = (values) => Math.sqrt(mean(values.map((v) => v * v)));

// ---------------------------------------------------------------------------
// Open strokes: line / angle / arc
// ---------------------------------------------------------------------------

function lineCandidate(pts, totalLen, unit) {
  const a = pts[0];
  const b = pts[pts.length - 1];
  const chord = dist(a, b);
  if (chord < 20 * unit) return null;
  if (totalLen / chord > 1.25) return null;

  const line = fitLine(pts);
  const err = rms(pts.map((p) => distanceToLine(p, line))) / chord;

  return {
    kind: 'line',
    family: 'line',
    err,
    conf: fitConfidence(err, 'line'),
    params: { a: projectOnLine(a, line), b: projectOnLine(b, line) },
    metrics: { corners: 2, angles: [], sides: [chord] }
  };
}

function angleCandidate(pts, totalLen, unit) {
  if (totalLen < 40 * unit) return null;
  const n = pts.length;

  let idx = null;
  for (const f of [0.03, 0.045, 0.06, 0.08, 0.11, 0.15]) {
    const found = rdpIndices(pts, 0, n - 1, f * totalLen);
    if (found.length === 3) {
      idx = found;
      break;
    }
    if (found.length < 3) break;
  }
  if (!idx) return null;

  const v = idx[1];
  const arm1 = pts.slice(0, v + 1);
  const arm2 = pts.slice(v);
  const L1 = pathLength(arm1);
  const L2 = pathLength(arm2);
  if (L1 < Math.max(15 * unit, 0.15 * totalLen)) return null;
  if (L2 < Math.max(15 * unit, 0.15 * totalLen)) return null;

  // Fit each arm on its core (the rounded corner would bias the fit)
  const core = (arm) => {
    const trim = Math.floor(arm.length * 0.15);
    const c = arm.slice(trim, arm.length - trim);
    return c.length >= 2 ? c : arm;
  };
  const l1 = fitLine(core(arm1));
  const l2 = fitLine(core(arm2));

  let vertex = intersectLines(l1, l2);
  if (!vertex || dist(vertex, pts[v]) > 0.25 * totalLen) {
    vertex = { x: pts[v].x, y: pts[v].y };
  }
  const a = projectOnLine(pts[0], l1);
  const b = projectOnLine(pts[n - 1], l2);

  const angle = interiorAngle(a, vertex, b) / DEG;
  if (angle < 18 || angle > 165) return null;

  const poly = [a, vertex, b];
  const err = rms(pts.map((p) => distanceToPolyline(p, poly))) / (totalLen * 0.7);

  return {
    kind: 'angle',
    family: 'angle',
    err,
    conf: fitConfidence(err, 'angle'),
    params: { a, vertex, b },
    metrics: { corners: 3, angles: [angle], sides: [dist(a, vertex), dist(vertex, b)] }
  };
}

function arcCandidate(pts, totalLen, unit) {
  if (totalLen < 50 * unit) return null;
  const s = resample(pts, 48);
  const fit = fitCircle(s);
  if (!fit || fit.r < 12 * unit || fit.r > 4000) return null;

  const err =
    rms(s.map((p) => Math.hypot(p.x - fit.cx, p.y - fit.cy) - fit.r)) / fit.r;

  let prev = Math.atan2(s[0].y - fit.cy, s[0].x - fit.cx);
  const a0 = prev;
  let sweep = 0;
  for (let i = 1; i < s.length; i++) {
    const a = Math.atan2(s[i].y - fit.cy, s[i].x - fit.cx);
    let d = a - prev;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    sweep += d;
    prev = a;
  }
  if (Math.abs(sweep) < 100 * DEG || Math.abs(sweep) > 340 * DEG) return null;

  return {
    kind: 'arc',
    family: 'arc',
    err,
    conf: fitConfidence(err, 'arc'),
    params: { cx: fit.cx, cy: fit.cy, r: fit.r, a0, sweep },
    metrics: { corners: 2, angles: [], sides: [] }
  };
}

function recognizeOpen(pts, totalLen, unit) {
  return [
    lineCandidate(pts, totalLen, unit),
    angleCandidate(pts, totalLen, unit),
    arcCandidate(pts, totalLen, unit)
  ].filter(Boolean);
}

// ---------------------------------------------------------------------------
// Closed strokes: circle / ellipse / polygons
// ---------------------------------------------------------------------------

function circleCandidate(loop, size) {
  const fit = fitCircle(loop);
  if (!fit || fit.r < 10) return null;
  const err =
    rms(loop.map((p) => Math.hypot(p.x - fit.cx, p.y - fit.cy) - fit.r)) / size;
  return {
    kind: 'circle',
    family: 'circle',
    err,
    weight: 1,
    conf: fitConfidence(err, 'circle'),
    params: { cx: fit.cx, cy: fit.cy, r: fit.r },
    metrics: { corners: 0, angles: [], sides: [] }
  };
}

function ellipseCandidate(loop, size) {
  const c = centroid(loop);
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of loop) {
    const u = p.x - c.x;
    const v = p.y - c.y;
    sxx += u * u;
    syy += v * v;
    sxy += u * v;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const rot = loop.map((p) => ({
    x: (p.x - c.x) * cos + (p.y - c.y) * sin,
    y: -(p.x - c.x) * sin + (p.y - c.y) * cos
  }));
  const b = bounds(rot);
  const a = b.w / 2;
  const bb = b.h / 2;
  if (a < 8 || bb < 8) return null;
  if (Math.max(a, bb) / Math.min(a, bb) < 1.12) return null; // it is a circle

  const mx = (b.minX + b.maxX) / 2;
  const my = (b.minY + b.maxY) / 2;
  const err =
    rms(
      rot.map(
        (p) =>
          (Math.hypot((p.x - mx) / a, (p.y - my) / bb) - 1) * Math.min(a, bb)
      )
    ) / size;

  // centre of the ellipse in world coordinates
  const cx = c.x + mx * cos - my * sin;
  const cy = c.y + mx * sin + my * cos;

  return {
    kind: 'ellipse',
    family: 'ellipse',
    err,
    weight: 1.15,
    conf: fitConfidence(err, 'ellipse'),
    params: { cx, cy, rx: a, ry: bb, rot: theta },
    metrics: { corners: 0, angles: [], sides: [] }
  };
}

// Remove vertices that are nearly collinear (turn angle < 25 deg).
function pruneCollinear(rot, idx) {
  const list = idx.slice();
  while (list.length > 3) {
    let worst = -1;
    let worstTurn = Infinity;
    for (let i = 0; i < list.length; i++) {
      const prev = rot[list[(i - 1 + list.length) % list.length]];
      const cur = rot[list[i]];
      const next = rot[list[(i + 1) % list.length]];
      const turn = Math.PI - interiorAngle(prev, cur, next);
      if (turn < worstTurn) {
        worstTurn = turn;
        worst = i;
      }
    }
    if (worstTurn < 25 * DEG) list.splice(worst, 1);
    else break;
  }
  return list;
}

// Replace RDP vertices by intersections of best-fit edge lines (sharp corners).
function fitCornerVertices(rot, idx, size) {
  const m = idx.length;
  const N = rot.length;
  const lines = [];

  for (let i = 0; i < m; i++) {
    const s = idx[i];
    const e = idx[(i + 1) % m];
    const edge = [];
    let k = s;
    let guard = 0;
    while (guard++ <= N) {
      edge.push(rot[k]);
      if (k === e) break;
      k = (k + 1) % N;
    }
    const trim = Math.floor(edge.length * 0.15);
    const coreEdge =
      edge.length - 2 * trim >= 3 ? edge.slice(trim, edge.length - trim) : edge;
    lines.push(coreEdge.length >= 2 ? fitLine(coreEdge) : null);
  }

  const verts = [];
  for (let i = 0; i < m; i++) {
    const original = rot[idx[i]];
    const l1 = lines[(i - 1 + m) % m];
    const l2 = lines[i];
    let v = l1 && l2 ? intersectLines(l1, l2) : null;
    if (!v || dist(v, original) > 0.3 * size) v = { x: original.x, y: original.y };
    verts.push(v);
  }
  return verts;
}

function polygonMeasurements(verts) {
  const m = verts.length;
  const angles = verts.map(
    (v, i) =>
      interiorAngle(verts[(i - 1 + m) % m], v, verts[(i + 1) % m]) / DEG
  );
  const sides = verts.map((v, i) => dist(v, verts[(i + 1) % m]));
  return { angles, sides };
}

function classifyPolygon(verts) {
  const m = verts.length;
  const { angles, sides } = polygonMeasurements(verts);
  let kind = 'polygon';
  let quality = 1;

  if (m === 3) {
    kind = 'triangle';
  } else if (m === 4) {
    const devs = angles.map((a) => Math.abs(a - 90));
    const oppEqual =
      Math.abs(sides[0] - sides[2]) / Math.max(sides[0], sides[2]) < 0.22 &&
      Math.abs(sides[1] - sides[3]) / Math.max(sides[1], sides[3]) < 0.22;

    if (devs.every((d) => d < 13) && oppEqual) {
      const a = (sides[0] + sides[2]) / 2;
      const b = (sides[1] + sides[3]) / 2;
      kind = Math.abs(a - b) / Math.max(a, b) < 0.12 ? 'square' : 'rectangle';
      quality = clamp01(1 - mean(devs) / 25);
    } else {
      kind = 'quadrilateral';
    }
  } else if (m === 5) {
    kind = 'pentagon';
  } else if (m === 6) {
    kind = 'hexagon';
  }

  return { kind, quality, angles, sides };
}

function polygonCandidate(loop, size) {
  // Start the loop at the point farthest from the centre (a likely corner)
  const c = centroid(loop);
  let best = 0;
  let bestD = -1;
  loop.forEach((p, i) => {
    const d = dist(p, c);
    if (d > bestD) {
      bestD = d;
      best = i;
    }
  });
  const rot = loop.slice(best).concat(loop.slice(0, best));
  const path = rot.concat([rot[0]]);

  // Simplify with growing tolerance; remember each distinct corner count
  const byCount = new Map();
  for (let f = 0.22; f >= 0.012; f *= 0.85) {
    const all = rdpIndices(path, 0, path.length - 1, f * size);
    const idx = pruneCollinear(rot, all.slice(0, -1));
    if (idx.length >= 3 && idx.length <= 8 && !byCount.has(idx.length)) {
      byCount.set(idx.length, idx);
    }
  }

  const options = [];
  for (const [count, idx] of byCount) {
    const verts = fitCornerVertices(rot, idx, size);
    const err =
      rms(loop.map((p) => distanceToPolyline(p, verts, true))) / size;
    options.push({ count, verts, err });
  }
  if (options.length === 0) return null;

  // More corners always fit better, so take the SIMPLEST polygon that is
  // still a good fit.
  options.sort((a, b) => a.count - b.count);
  const minErr = Math.min(...options.map((o) => o.err));
  const limit = Math.max(0.03, minErr * 1.6);
  const chosen = options.find((o) => o.err <= limit) || options[0];

  const cls = classifyPolygon(chosen.verts);
  const conf = fitConfidence(chosen.err, 'polygon') * (0.75 + 0.25 * cls.quality);

  return {
    kind: cls.kind,
    family: 'polygon',
    err: chosen.err,
    // Polygons with many corners are easily confused with wobbly circles,
    // so they must fit clearly better to win.
    weight: chosen.count >= 7 ? 2.2 : chosen.count === 6 ? 1.5 : chosen.count === 5 ? 1.3 : 1,
    conf,
    params: { verts: chosen.verts },
    metrics: { corners: chosen.count, angles: cls.angles, sides: cls.sides }
  };
}

function recognizeClosed(pts, totalLen, unit) {
  const n = clamp(Math.round(totalLen / (3 * unit)), 48, 160);
  const loop = resample(pts, n);
  const b = bounds(loop);
  const size = (b.w + b.h) / 2;
  if (size < 20 * unit) return [];

  return [
    circleCandidate(loop, size),
    ellipseCandidate(loop, size),
    polygonCandidate(loop, size)
  ].filter(Boolean);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @param rawPoints  [{x, y, t?, pressure?}] in document coordinates
 * @param options.unit  document units per CSS pixel (1 / zoom). Keeps all
 *                      thresholds identical at every zoom level and DPI.
 */
export function recognizeStroke(rawPoints, { unit = 1 } = {}) {
  if (!rawPoints || rawPoints.length < 3) return null;

  const pts = smoothStroke(rawPoints, { unit });
  if (pts.length < 3) return null;

  const totalLen = pathLength(pts);
  if (totalLen < 14 * unit) return null;

  const gap = dist(pts[0], pts[pts.length - 1]);
  const closed = totalLen > 60 * unit && gap <= Math.max(18 * unit, totalLen * 0.22);

  const candidates = closed
    ? recognizeClosed(pts, totalLen, unit)
    : recognizeOpen(pts, totalLen, unit);
  if (candidates.length === 0) return null;

  // Rank. Closed shapes compare weighted fit error; open shapes compare conf.
  const ranked = candidates
    .map((c) => ({ ...c, score: closed ? c.err * (c.weight || 1) : 1 - c.conf }))
    .sort((a, b) => a.score - b.score);

  const best = ranked[0];
  let confidence = best.conf;

  // Ambiguity: a different family fits almost as well -> be less sure.
  const rival = ranked.find((c) => c.family !== best.family);
  if (rival && best.score > 0 && best.score / (rival.score || 1e-9) > 0.75) {
    confidence *= 0.85;
  }

  // A loop that is barely closed is less convincing than a tight one.
  if (closed) {
    confidence *= 1 - 0.15 * clamp01(gap / Math.max(1, totalLen * 0.22));
  }

  return {
    kind: best.kind,
    family: best.family,
    confidence: clamp01(confidence),
    params: best.params,
    metrics: {
      closed,
      corners: best.metrics.corners,
      angles: best.metrics.angles,
      sides: best.metrics.sides,
      fitError: best.err
    },
    alternatives: ranked
      .slice(1)
      .map((c) => ({ kind: c.kind, confidence: clamp01(c.conf) }))
  };
}