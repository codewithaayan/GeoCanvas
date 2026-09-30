/**
 * GeoCanvas - Magic Pen & Shape Recognition Engine
 * Automatically detects and straightens lines, circles, triangles, rectangles,
 * and smooths hand-drawn strokes like iPad / Zoom / GoodNotes.
 */

// Distance between two points
function dist(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

// Perpendicular distance from point p to line segment (a, b)
function perpendicularDistance(p, a, b) {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
}

// Ramer-Douglas-Peucker polygon simplification
function ramerDouglasPeucker(points, epsilon) {
  if (points.length <= 2) return points;

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const recResults1 = ramerDouglasPeucker(points.slice(0, index + 1), epsilon);
    const recResults2 = ramerDouglasPeucker(points.slice(index), epsilon);
    return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
  } else {
    return [points[0], points[end]];
  }
}

// Total length along points path
function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += dist(points[i - 1], points[i]);
  }
  return len;
}

// Chaikin smoothing algorithm
function chaikinSmooth(points, iterations = 2) {
  if (points.length <= 2) return points;
  let current = points;

  for (let it = 0; it < iterations; it++) {
    const next = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const p0 = current[i];
      const p1 = current[i + 1];
      next.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
        pressure: (p0.pressure || 0.5) * 0.75 + (p1.pressure || 0.5) * 0.25
      });
      next.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
        pressure: (p0.pressure || 0.5) * 0.25 + (p1.pressure || 0.5) * 0.75
      });
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

export class MagicPenTool {
  /**
   * Process a hand-drawn stroke and recognize/auto-correct its shape.
   * If recognized as a line, triangle, rectangle, or circle, returns the clean geometric shape.
   * Otherwise, returns a smoothly filtered stroke.
   */
  static autoCorrectStroke(stroke) {
    if (!stroke || !stroke.points || stroke.points.length < 3) {
      return stroke;
    }

    const points = stroke.points;
    const n = points.length;
    const start = points[0];
    const end = points[n - 1];

    const totalLen = pathLength(points);
    const directDist = dist(start, end);
    const isClosed = directDist < Math.max(25, totalLen * 0.2);

    // -------------------------------------------------------------
    // 1. STRAIGHT LINE DETECTION
    // If start and end are far apart and path deviation is very small
    // -------------------------------------------------------------
    if (!isClosed && directDist > 20) {
      const lineRatio = totalLen / directDist;
      let maxDev = 0;
      for (const p of points) {
        const d = perpendicularDistance(p, start, end);
        if (d > maxDev) maxDev = d;
      }

      // If length ratio is close to 1 and deviation is small, it's a straight line
      if (lineRatio < 1.15 && maxDev < Math.max(14, directDist * 0.12)) {
        // Optional: snap to horizontal, vertical, or 45 degrees if close
        let endX = end.x;
        let endY = end.y;
        const dx = endX - start.x;
        const dy = endY - start.y;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

        const snapAngles = [0, 45, 90, 135, 180, -45, -90, -135, -180];
        for (const snap of snapAngles) {
          if (Math.abs(angle - snap) < 5) {
            const rad = (snap * Math.PI) / 180;
            endX = start.x + Math.cos(rad) * directDist;
            endY = start.y + Math.sin(rad) * directDist;
            break;
          }
        }

        return {
          ...stroke,
          shapeRecognized: 'line',
          points: [
            { x: start.x, y: start.y, pressure: start.pressure || 0.5 },
            { x: endX, y: endY, pressure: end.pressure || 0.5 }
          ]
        };
      }
    }

    // -------------------------------------------------------------
    // 2. CIRCLE / ELLIPSE DETECTION
    // If stroke is closed and variance in distance from centroid is small
    // -------------------------------------------------------------
    if (isClosed && totalLen > 40) {
      let cx = 0;
      let cy = 0;
      for (const p of points) {
        cx += p.x;
        cy += p.y;
      }
      cx /= n;
      cy /= n;

      let avgRadius = 0;
      const radii = [];
      for (const p of points) {
        const r = dist(p, { x: cx, y: cy });
        radii.push(r);
        avgRadius += r;
      }
      avgRadius /= n;

      let variance = 0;
      for (const r of radii) {
        variance += (r - avgRadius) ** 2;
      }
      const stdDev = Math.sqrt(variance / n);

      // Circle test: low standard deviation relative to radius
      if (stdDev / avgRadius < 0.22 && avgRadius > 15) {
        // Generate clean 48-point circle
        const circlePoints = [];
        const steps = 48;
        for (let i = 0; i <= steps; i++) {
          const theta = (i / steps) * Math.PI * 2;
          circlePoints.push({
            x: cx + Math.cos(theta) * avgRadius,
            y: cy + Math.sin(theta) * avgRadius,
            pressure: 0.5
          });
        }

        return {
          ...stroke,
          shapeRecognized: 'circle',
          points: circlePoints
        };
      }
    }

    // -------------------------------------------------------------
    // 3. POLYGON DETECTION (TRIANGLE OR RECTANGLE)
    // Simplify using RDP with adaptive tolerance
    // -------------------------------------------------------------
    if (isClosed && totalLen > 50) {
      const epsilon = Math.max(12, totalLen * 0.045);
      let simplified = ramerDouglasPeucker(points, epsilon);

      // Remove duplicate near-identical start/end if needed
      if (simplified.length > 2 && dist(simplified[0], simplified[simplified.length - 1]) < 20) {
        simplified[simplified.length - 1] = { ...simplified[0] };
      }

      const vertexCount = simplified.length - 1; // Closed polygon has N+1 points

      // TRIANGLE (3 vertices)
      if (vertexCount === 3) {
        return {
          ...stroke,
          shapeRecognized: 'triangle',
          points: [
            simplified[0],
            simplified[1],
            simplified[2],
            { ...simplified[0] }
          ]
        };
      }

      // RECTANGLE / QUADRILATERAL (4 vertices)
      if (vertexCount === 4) {
        // Compute bounding box or keep corners
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of simplified) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }

        // Check if edges are roughly axis-aligned
        const isAxisAligned =
          Math.abs(simplified[0].x - simplified[1].x) < 20 ||
          Math.abs(simplified[0].y - simplified[1].y) < 20;

        if (isAxisAligned) {
          return {
            ...stroke,
            shapeRecognized: 'rectangle',
            points: [
              { x: minX, y: minY, pressure: 0.5 },
              { x: maxX, y: minY, pressure: 0.5 },
              { x: maxX, y: maxY, pressure: 0.5 },
              { x: minX, y: maxY, pressure: 0.5 },
              { x: minX, y: minY, pressure: 0.5 }
            ]
          };
        } else {
          return {
            ...stroke,
            shapeRecognized: 'polygon',
            points: [
              simplified[0],
              simplified[1],
              simplified[2],
              simplified[3],
              { ...simplified[0] }
            ]
          };
        }
      }
    }

    // -------------------------------------------------------------
    // 4. GENERAL SMOOTHING FALLBACK
    // If not a simple primitive, smooth out hand jiggle with Chaikin
    // -------------------------------------------------------------
    const smoothed = chaikinSmooth(points, 2);
    return {
      ...stroke,
      shapeRecognized: 'smoothed',
      points: smoothed
    };
  }
}
