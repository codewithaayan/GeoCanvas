/**
 * StrokeSmoother - removes hand / digitiser noise from a raw stroke.
 *
 * Pure functions. Points keep their timestamp (`t`) and `pressure`.
 */

import { dist } from './geometryMath.js';

/** Drop points closer than `minDist` to the previous kept point. */
export function dedupe(points, minDist = 0.5) {
  if (points.length === 0) return [];
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (dist(points[i], out[out.length - 1]) >= minDist) out.push(points[i]);
  }
  if (points.length > 1) out.push(points[points.length - 1]);
  return out;
}

/** Centered moving average. First and last points are kept exactly. */
export function movingAverage(points, windowSize = 5) {
  const n = points.length;
  if (n < 5 || windowSize < 3) return points.slice();

  const half = Math.floor(windowSize / 2);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i === 0 || i === n - 1) {
      out[i] = { ...points[i] };
      continue;
    }
    const h = Math.min(half, i, n - 1 - i); // shrink window near the ends
    let x = 0;
    let y = 0;
    let pr = 0;
    let count = 0;
    for (let k = -h; k <= h; k++) {
      const p = points[i + k];
      x += p.x;
      y += p.y;
      pr += p.pressure ?? 0.5;
      count++;
    }
    out[i] = { ...points[i], x: x / count, y: y / count, pressure: pr / count };
  }
  return out;
}

/**
 * Full smoothing step of the pipeline.
 * `unit` = document units per CSS pixel (1 / zoom) so the filter strength
 * does not depend on the zoom level.
 */
export function smoothStroke(points, { unit = 1 } = {}) {
  const cleaned = dedupe(points, 0.6 * unit);
  const windowSize = cleaned.length >= 40 ? 5 : 3;
  return movingAverage(cleaned, windowSize);
}