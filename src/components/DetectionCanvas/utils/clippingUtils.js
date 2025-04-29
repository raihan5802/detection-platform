/**
 * Utility functions for clipping shapes to image boundaries
 */

import { isPartiallyOutside, isOutsideImage, shapeBoundingBox } from './shapeUtils';

/**
 * Clip an annotation to the image boundaries
 */
export function clipAnnotationToBoundary(ann, w, h) {
  if (!isPartiallyOutside(ann, w, h)) {
    return ann;
  }

  if (ann.type === 'bbox') {
    return clampBoundingBox(ann, w, h);
  } else if (ann.type === 'polygon') {
    const clipped = clipPolygonToRect(ann.points, w, h);
    return clipped.length < 3 ? null : { ...ann, points: clipped };
  } else if (ann.type === 'polyline') {
    const clippedLine = clipPolylineToRect(ann.points, w, h);
    return clippedLine.length < 2 ? null : { ...ann, points: clippedLine };
  } else if (ann.type === 'ellipse') {
    return clampEllipse(ann, w, h);
  }
  return null;
}

/**
 * Clamp a bounding box to an image
 */
export function clampBoundingBox(bbox, w, h) {
  let { x, y, width, height } = bbox;

  // Make sure width and height are positive
  if (width < 0) {
    x = x + width;
    width = Math.abs(width);
  }
  if (height < 0) {
    y = y + height;
    height = Math.abs(height);
  }

  // Clamp to image boundaries
  if (x < 0) {
    width += x;
    x = 0;
  }
  if (y < 0) {
    height += y;
    y = 0;
  }
  if (x + width > w) {
    width = w - x;
  }
  if (y + height > h) {
    height = h - y;
  }

  // Ensure we have a valid box
  if (width <= 0 || height <= 0) return null;
  return { ...bbox, x, y, width, height };
}

/**
 * Clamp an ellipse to an image
 */
export function clampEllipse(ellipse, w, h) {
  const { x, y, radiusX, radiusY } = ellipse;
  let newRx = Math.abs(radiusX);
  let newRy = Math.abs(radiusY);

  // Check and adjust left edge
  const left = x - newRx;
  if (left < 0) {
    const exceed = -left;
    newRx = Math.max(0, newRx - exceed);
  }
  
  // Check and adjust right edge
  const right = x + newRx;
  if (right > w) {
    const exceed = right - w;
    newRx = Math.max(0, newRx - exceed);
  }
  
  // Check and adjust top edge
  const top = y - newRy;
  if (top < 0) {
    const exceed = -top;
    newRy = Math.max(0, newRy - exceed);
  }
  
  // Check and adjust bottom edge
  const bottom = y + newRy;
  if (bottom > h) {
    const exceed = bottom - h;
    newRy = Math.max(0, newRy - exceed);
  }

  // Ensure we have a valid ellipse
  if (newRx < 1 || newRy < 1) {
    return null;
  }

  return {
    ...ellipse,
    radiusX: newRx,
    radiusY: newRy,
  };
}

/**
 * Cohen-Sutherland line clipping algorithm to clip a polyline to a rectangle
 */
export function clipPolylineToRect(points, w, h) {
  const resultSegments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const clippedSeg = clipSegmentToRect(p1, p2, w, h);
    if (clippedSeg && clippedSeg.length === 2) {
      if (
        resultSegments.length > 0 &&
        samePoint(resultSegments[resultSegments.length - 1], clippedSeg[0])
      ) {
        resultSegments.push(clippedSeg[1]);
      } else {
        resultSegments.push(clippedSeg[0], clippedSeg[1]);
      }
    }
  }
  
  // Remove duplicate consecutive points
  const cleaned = [];
  for (let i = 0; i < resultSegments.length; i++) {
    if (i === 0 || !samePoint(resultSegments[i], resultSegments[i - 1])) {
      cleaned.push(resultSegments[i]);
    }
  }
  return cleaned;

  // Helper to check if two points are the same
  function samePoint(a, b) {
    return Math.abs(a.x - b.x) < 1e-8 && Math.abs(a.y - b.y) < 1e-8;
  }
}

/**
 * Clip a line segment to a rectangle
 */
export function clipSegmentToRect(p1, p2, w, h) {
  let [x1, y1, x2, y2] = [p1.x, p1.y, p2.x, p2.y];
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;

  function clip(p, q) {
    if (Math.abs(p) < 1e-8) {
      return q >= 0;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  }

  if (!clip(-dx, x1)) return null;
  if (!clip(dx, w - x1)) return null;
  if (!clip(-dy, y1)) return null;
  if (!clip(dy, h - y1)) return null;

  if (t1 < t0) return null;

  const nx1 = x1 + t0 * dx;
  const ny1 = y1 + t0 * dy;
  const nx2 = x1 + t1 * dx;
  const ny2 = y1 + t1 * dy;

  return [
    { x: nx1, y: ny1 },
    { x: nx2, y: ny2 },
  ];
}

/**
 * Sutherland-Hodgman polygon clipping algorithm
 */
export function clipPolygonToRect(points, w, h) {
  const clipRectEdges = [
    { side: 'left', x: 0 },
    { side: 'right', x: w },
    { side: 'top', y: 0 },
    { side: 'bottom', y: h },
  ];

  let outputList = points;

  clipRectEdges.forEach((edge) => {
    const inputList = outputList;
    outputList = [];
    if (inputList.length === 0) return;

    for (let i = 0; i < inputList.length; i++) {
      const current = inputList[i];
      const prev = inputList[(i + inputList.length - 1) % inputList.length];

      const currentInside = isInside(current, edge);
      const prevInside = isInside(prev, edge);

      if (prevInside && currentInside) {
        outputList.push(current);
      } else if (prevInside && !currentInside) {
        const inter = computeIntersection(prev, current, edge);
        if (inter) outputList.push(inter);
      } else if (!prevInside && currentInside) {
        const inter = computeIntersection(prev, current, edge);
        if (inter) outputList.push(inter);
        outputList.push(current);
      }
    }
  });

  return outputList;

  // Helper to check if a point is inside an edge
  function isInside(pt, edge) {
    if (edge.side === 'left') return pt.x >= edge.x;
    if (edge.side === 'right') return pt.x <= edge.x;
    if (edge.side === 'top') return pt.y >= edge.y;
    if (edge.side === 'bottom') return pt.y <= edge.y;
    return true;
  }

  // Helper to compute intersection of a line and an edge
  function computeIntersection(a, b, edge) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let t;
    if (edge.side === 'left' || edge.side === 'right') {
      if (Math.abs(dx) < 1e-8) return null;
      t = (edge.x - a.x) / dx;
      const y = a.y + t * dy;
      return { x: edge.x, y };
    } else {
      if (Math.abs(dy) < 1e-8) return null;
      t = (edge.y - a.y) / dy;
      const x = a.x + t * dx;
      return { x, y: edge.y };
    }
  }
}