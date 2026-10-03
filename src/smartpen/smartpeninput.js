/**
 * SmartPenInput - turns browser pointer events into clean samples and decides
 * which pointers are allowed to draw (palm rejection).
 *
 * Works with stylus, finger and mouse through Pointer Events only, so it does
 * not depend on any touchscreen brand.
 */

export class SmartPenInput {
  constructor({ penGraceMs = 1500, palmContactSize = 40 } = {}) {
    this.penGraceMs = penGraceMs;
    this.palmContactSize = palmContactSize;
    this.lastPenTime = -Infinity;
  }

  /** Should this pointer be allowed to start / continue drawing? */
  accept(e) {
    const now = performance.now();

    if (e.pointerType === 'pen') {
      this.lastPenTime = now;
      return true;
    }

    if (e.pointerType === 'touch') {
      // A stylus was used a moment ago: a touch now is almost surely a palm.
      if (now - this.lastPenTime < this.penGraceMs) return false;

      // Very large contact area (flat palm / fist). Many browsers report 1.
      if (Math.max(e.width || 0, e.height || 0) > this.palmContactSize) {
        return false;
      }
    }

    return true;
  }

  /** A pen hovering above the glass fires moves with no button pressed. */
  isHover(e) {
    return e.pointerType === 'pen' && e.buttons === 0;
  }

  /**
   * All samples carried by one pointer event (coalesced events keep the full
   * digitiser resolution). `toDoc` converts client coordinates to document
   * coordinates, so zoom and device pixel ratio are handled by the caller.
   */
  samples(e, toDoc) {
    const events =
      typeof e.getCoalescedEvents === 'function' && e.getCoalescedEvents().length
        ? e.getCoalescedEvents()
        : [e];

    return events.map((ev) => {
      const p = toDoc(ev);
      return {
        x: p.x,
        y: p.y,
        t: ev.timeStamp ?? performance.now(),
        pressure: ev.pressure && ev.pressure > 0 ? ev.pressure : 0.5,
        pointerType: ev.pointerType || e.pointerType || 'mouse'
      };
    });
  }
}