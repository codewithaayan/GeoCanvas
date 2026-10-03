/**
 * StrokeManager - collects the live stroke while the pen / finger is down.
 *
 * Stores x, y, timestamp, pressure and pointer type for every sample, using
 * coalesced events for full digitiser resolution. It does NO recognition:
 * nothing is analysed or replaced while the user is still drawing.
 */

import { PenTool } from '../tools/PenTool.js';

export class StrokeManager {
  constructor() {
    this.stroke = null;
    this.pointerType = 'mouse';
    this.startTime = 0;
  }

  get isActive() {
    return !!this.stroke;
  }

  /** Begin a stroke. Returns the stroke object (renderable by PenTool). */
  begin(sample, style = {}) {
    this.pointerType = sample.pointerType || 'mouse';
    this.startTime = sample.t ?? performance.now();

    this.stroke = PenTool.createStroke(sample, { tool: 'pen', ...style });
    this.stroke.points[0].t = this.startTime;
    this.stroke.pointerType = this.pointerType;
    return this.stroke;
  }

  /** Append one sample (ignores sub-pixel jitter). Returns true if added. */
  add(sample, minDistance = 1.1) {
    if (!this.stroke) return false;
    const pts = this.stroke.points;
    const last = pts[pts.length - 1];
    if (Math.hypot(sample.x - last.x, sample.y - last.y) < minDistance) {
      return false;
    }
    pts.push({
      x: sample.x,
      y: sample.y,
      t: sample.t ?? performance.now(),
      pressure: sample.pressure || 0.5
    });
    return true;
  }

  /** Append every sample of a SmartPenInput batch. */
  addAll(samples, minDistance = 1.1) {
    let changed = false;
    for (const s of samples) changed = this.add(s, minDistance) || changed;
    return changed;
  }

  /** Finish and hand the raw stroke over. */
  end() {
    const finished = this.stroke;
    this.stroke = null;
    return finished;
  }

  cancel() {
    this.stroke = null;
  }
}