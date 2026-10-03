/**
 * Small, dependency-free geometry helpers shared by the Smart Pen modules.
 * Everything here is pure math: no canvas, no React, no DOM.
 */

export const DEG = Math.PI / 180;

export const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const clamp01 = (v) => clamp(v, 0, 1);

export const pt = (x, y, pressure = 0.5) => ({ x, y, pressure });

export function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += dist(points[i - 1], points[i]);
  return len;
}

export function centroid(points) {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

export function bounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export function pointSegmentDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distanceToPolyline(p, pts, closed = false) {
  let best = Infinity;
  const n = pts.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const d = pointSegmentDistance(p, pts[i], pts[(i + 1) % n]);
    if (d < best) best = d;
  }
  if (n === 1) best = dist(p, pts[0]);
  return best;
}

export function pointInPolygon(p, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const a = verts[i];
    const b = verts[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Uniform arc-length resampling of an open path into n points. */
export function resample(points, n) {
  if (points.length === 0) return [];
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
  }
  const total = cum[cum.length - 1];
  if (total <= 0 || n < 2) return [{ x: points[0].x, y: points[0].y }];

  const out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const t = (k / (n - 1)) * total;
    while (j < cum.length - 1 && cum[j] < t) j++;
    const segLen = cum[j] - cum[j - 1];
    const u = segLen > 0 ? (t - cum[j - 1]) / segLen : 0;
    out.push({
      x: points[j - 1].x + (points[j].x - points[j - 1].x) * u,
      y: points[j - 1].y + (points[j].y - points[j - 1].y) * u
    });
  }
  return out;
}

/** Ramer-Douglas-Peucker returning the kept INDICES. */
export function rdpIndices(points, start, end, epsilon) {
  let dmax = 0;
  let index = -1;
  for (let i = start + 1; i < end; i++) {
    const d = pointSegmentDistance(points[i], points[start], points[end]);
    if (d > dmax) {
      dmax = d;
      index = i;
    }
  }
  if (index !== -1 && dmax > epsilon) {
    const left = rdpIndices(points, start, index, epsilon);
    const right = rdpIndices(points, index, end, epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [start, end];
}

/** Least-squares circle fit (Kasa). Returns { cx, cy, r } or null. */
export function fitCircle(points) {
  const n = points.length;
  if (n < 3) return null;
  const m = centroid(points);
  let Suu = 0, Suv = 0, Svv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
  for (const p of points) {
    const u = p.x - m.x;
    const v = p.y - m.y;
    Suu += u * u;
    Suv += u * v;
    Svv += v * v;
    Suuu += u * u * u;
    Svvv += v * v * v;
    Suvv += u * v * v;
    Svuu += v * u * u;
  }
  const det = Suu * Svv - Suv * Suv;
  if (Math.abs(det) < 1e-9) return null;
  const b1 = 0.5 * (Suuu + Suvv);
  const b2 = 0.5 * (Svvv + Svuu);
  const uc = (b1 * Svv - b2 * Suv) / det;
  const vc = (Suu * b2 - Suv * b1) / det;
  const r = Math.sqrt(uc * uc + vc * vc + (Suu + Svv) / n);
  if (!Number.isFinite(r)) return null;
  return { cx: uc + m.x, cy: vc + m.y, r };
}

/** Total-least-squares line: { c (a point on it), dx, dy (unit direction) }. */
export function fitLine(points) {
  const c = centroid(points);
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of points) {
    const u = p.x - c.x;
    const v = p.y - c.y;
    sxx += u * u;
    syy += v * v;
    sxy += u * v;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { c, dx: Math.cos(theta), dy: Math.sin(theta) };
}

export function projectOnLine(p, line) {
  const t = (p.x - line.c.x) * line.dx + (p.y - line.c.y) * line.dy;
  return { x: line.c.x + line.dx * t, y: line.c.y + line.dy * t };
}

export function distanceToLine(p, line) {
  const q = projectOnLine(p, line);
  return Math.hypot(p.x - q.x, p.y - q.y);
}

export function intersectLines(l1, l2) {
  const cross = l1.dx * l2.dy - l1.dy * l2.dx;
  if (Math.abs(cross) < 0.2) return null; // nearly parallel
  const t = ((l2.c.x - l1.c.x) * l2.dy - (l2.c.y - l1.c.y) * l2.dx) / cross;
  return { x: l1.c.x + l1.dx * t, y: l1.c.y + l1.dy * t };
}

/** Interior angle at `cur` between rays to `prev` and `next`, in radians. */
export function interiorAngle(prev, cur, next) {
  const ax = prev.x - cur.x;
  const ay = prev.y - cur.y;
  const bx = next.x - cur.x;
  const by = next.y - cur.y;
  const d = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (d === 0) return 0;
  return Math.acos(clamp((ax * bx + ay * by) / d, -1, 1));
}

export function rotatePoint(p, pivot, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  return { x: pivot.x + dx * c - dy * s, y: pivot.y + dx * s + dy * c };
}

/** Smallest signed difference between two angles in radians (-PI..PI). */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
}

export function stdDev(arr) {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
}