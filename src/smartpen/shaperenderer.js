/**
 * ShapeRenderer - everything that DRAWS smart-pen visuals on a canvas context:
 * the rough -> clean morph animation, the dashed suggestion preview and the
 * selection frame with its handles. Pure drawing code, no state.
 */

import { dist, resample, bounds, pt } from './geometryMath.js';

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Prepare a morph between the rough stroke and the clean points.
 * Both are resampled to the same number of points; for closed shapes the
 * start point and direction are aligned so the stroke "flows" into place.
 */
export function prepareMorph(rawPoints, targetPoints, closed) {
  const n = 96;
  const to = resample(targetPoints, n);
  let from = resample(rawPoints, n);

  if (closed) {
    let best = { cost: Infinity, shift: 0, reverse: false };
    for (const reverse of [false, true]) {
      const src = reverse ? from.slice().reverse() : from;
      for (let shift = 0; shift < n; shift += 2) {
        let cost = 0;
        for (let i = 0; i < n; i += 4) {
          const a = src[(i + shift) % n];
          const b = to[i];
          cost += (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
        }
        if (cost < best.cost) best = { cost, shift, reverse };
      }
    }
    const src = best.reverse ? from.slice().reverse() : from;
    from = src.map((_, i) => src[(i + best.shift) % n]);
  }

  return { from, to };
}

/** Points of the morph at progress `t` in 0..1 (eased). */
export function morphFrame(morph, t) {
  const k = easeOutCubic(Math.min(1, Math.max(0, t)));
  return morph.from.map((a, i) => ({
    x: a.x + (morph.to[i].x - a.x) * k,
    y: a.y + (morph.to[i].y - a.y) * k
  }));
}

function strokePath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
}

/** Draw the morphing stroke with a soft glow that fades as it settles. */
export function drawMorph(ctx, style, points, t) {
  if (!points || points.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.globalAlpha = style.opacity ?? 1;

  const glow = 1 - Math.min(1, t);
  if (glow > 0.02) {
    ctx.save();
    ctx.globalAlpha = 0.35 * glow;
    ctx.lineWidth = style.width * (1.6 + glow);
    ctx.shadowColor = style.color;
    ctx.shadowBlur = 14 * glow;
    strokePath(ctx, points);
    ctx.stroke();
    ctx.restore();
  }

  strokePath(ctx, points);
  ctx.stroke();
  ctx.restore();
}

/** Dashed suggestion shown for medium-confidence recognitions. */
export function drawPreview(ctx, style, points, zoom = 1) {
  if (!points || points.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = style.color;
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = Math.max(style.width, 2);
  ctx.setLineDash([8 / zoom, 6 / zoom]);
  strokePath(ctx, points);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Selection frame (move / resize / rotate)
// ---------------------------------------------------------------------------

const HANDLE_PX = 7; // handle radius in screen pixels
const ROTATE_OFFSET_PX = 28; // rotation handle distance above the frame

/** Frame geometry for a set of points (document coordinates). */
export function selectionFrame(points, strokeWidth = 3, zoom = 1) {
  const b = bounds(points);
  const pad = strokeWidth / 2 + 6 / zoom;
  const minX = b.minX - pad;
  const minY = b.minY - pad;
  const maxX = b.maxX + pad;
  const maxY = b.maxY + pad;
  const cx = (minX + maxX) / 2;

  return {
    minX,
    minY,
    maxX,
    maxY,
    center: { x: cx, y: (minY + maxY) / 2 },
    corners: {
      nw: pt(minX, minY),
      ne: pt(maxX, minY),
      se: pt(maxX, maxY),
      sw: pt(minX, maxY)
    },
    rotate: pt(cx, minY - ROTATE_OFFSET_PX / zoom)
  };
}

/** Which handle is under `p`? Returns 'nw'|'ne'|'se'|'sw'|'rotate'|null. */
export function hitHandle(frame, p, zoom = 1) {
  const r = (HANDLE_PX + 5) / zoom;
  if (dist(p, frame.rotate) <= r) return 'rotate';
  for (const key of ['nw', 'ne', 'se', 'sw']) {
    if (dist(p, frame.corners[key]) <= r) return key;
  }
  return null;
}

export function oppositeCorner(frame, handle) {
  const map = { nw: 'se', ne: 'sw', se: 'nw', sw: 'ne' };
  return frame.corners[map[handle]];
}

export function drawSelection(ctx, frame, zoom = 1) {
  const r = HANDLE_PX / zoom;
  ctx.save();
  ctx.lineWidth = 1.2 / zoom;
  ctx.strokeStyle = '#2563eb';
  ctx.setLineDash([5 / zoom, 4 / zoom]);
  ctx.strokeRect(
    frame.minX,
    frame.minY,
    frame.maxX - frame.minX,
    frame.maxY - frame.minY
  );
  ctx.setLineDash([]);

  // rotation stem + handle
  ctx.beginPath();
  ctx.moveTo(frame.rotate.x, frame.minY);
  ctx.lineTo(frame.rotate.x, frame.rotate.y);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  for (const key of ['nw', 'ne', 'se', 'sw']) {
    const c = frame.corners[key];
    ctx.beginPath();
    ctx.rect(c.x - r, c.y - r, r * 2, r * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(frame.rotate.x, frame.rotate.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}