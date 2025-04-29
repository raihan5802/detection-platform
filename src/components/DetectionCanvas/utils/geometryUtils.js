/**
 * Utility functions for geometry operations with optimized performance
 */

/**
 * Convert an array of points to a flat array for Konva
 * @param {Array} pts - Array of points with x, y properties
 * @returns {Array} - Flat array [x1, y1, x2, y2, ...]
 */
export function flattenPoints(pts) {
  // Pre-allocate for better performance
  const result = new Array(pts.length * 2);
  for (let i = 0; i < pts.length; i++) {
    result[i * 2] = pts[i].x;
    result[i * 2 + 1] = pts[i].y;
  }
  return result;
}

/**
 * Generate an SVG path for a polygon with holes (optimized)
 * @param {Array} outer - Array of points for the outer shape
 * @param {Array} holes - Array of arrays of points for any holes
 * @returns {String} - SVG path string
 */
export function polygonToPath(outer, holes) {
  if (!outer || outer.length === 0) return '';
  
  // Pre-estimate the path string length for better performance
  const pointCount = outer.length + (holes ? holes.reduce((acc, h) => acc + h.length, 0) : 0);
  const estimatedLength = pointCount * 10; // Estimate 10 chars per point
  
  // Use array joining instead of string concatenation for better performance
  const pathParts = [];
  
  // Add outer path
  pathParts.push('M ', outer[0].x, ' ', outer[0].y, ' ');
  for (let i = 1; i < outer.length; i++) {
    pathParts.push('L ', outer[i].x, ' ', outer[i].y, ' ');
  }
  pathParts.push('Z ');
  
  // Add holes
  if (holes && holes.length > 0) {
    for (let h = 0; h < holes.length; h++) {
      const hole = holes[h];
      if (hole.length > 0) {
        pathParts.push('M ', hole[0].x, ' ', hole[0].y, ' ');
        for (let i = 1; i < hole.length; i++) {
          pathParts.push('L ', hole[i].x, ' ', hole[i].y, ' ');
        }
        pathParts.push('Z ');
      }
    }
  }
  
  return pathParts.join('');
}

/**
 * Calculate distance between two points
 * @param {Object} p1 - First point with x, y properties
 * @param {Object} p2 - Second point with x, y properties
 * @returns {Number} - Distance
 */
export function getDistance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate squared distance between two points (faster than getDistance)
 * @param {Object} p1 - First point with x, y properties
 * @param {Object} p2 - Second point with x, y properties
 * @returns {Number} - Squared distance
 */
export function getDistanceSquared(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return dx * dx + dy * dy;
}

/**
 * Reduce the number of points in a shape based on minimum distance
 * Simple Douglas-Peucker algorithm implementation
 * @param {Array} points - Array of points to reduce
 * @param {Number} epsilon - Maximum distance threshold
 * @returns {Array} - Reduced array of points
 */
export function reducePoints(points, epsilon = 10) {
  if (points.length <= 3) return points;
  
  // For small point sets, use simpler distance-based reduction
  if (points.length < 50) {
    return reducePointsByDistance(points, epsilon);
  }
  
  // For larger sets, use Douglas-Peucker algorithm
  return douglasPeucker(points, epsilon);
}

/**
 * Simple point reduction by removing points that are too close to each other
 * @param {Array} points - Array of points to reduce
 * @param {Number} threshold - Minimum distance threshold
 * @returns {Array} - Reduced array of points
 */
function reducePointsByDistance(points, threshold) {
  if (points.length <= 3) return points;
  
  const result = [points[0]]; // Always keep the first point
  const thresholdSquared = threshold * threshold; // Compare squared distances for better performance
  
  for (let i = 1; i < points.length; i++) {
    const prevPoint = result[result.length - 1];
    const currentPoint = points[i];
    
    // Only add point if it's far enough from the previous one
    if (getDistanceSquared(prevPoint, currentPoint) >= thresholdSquared) {
      result.push(currentPoint);
    }
  }
  
  // Ensure we have at least 3 points for polygon
  if (result.length < 3) {
    return points.filter((_, index) => index % Math.floor(points.length / 3) === 0);
  }
  
  return result;
}

/**
 * Douglas-Peucker algorithm for better point reduction
 * @param {Array} points - Array of points to reduce
 * @param {Number} epsilon - Maximum distance threshold
 * @returns {Array} - Reduced array of points
 */
function douglasPeucker(points, epsilon) {
  if (points.length <= 2) return points;
  
  // Find the point with the maximum distance from the line segment
  let maxDistance = 0;
  let maxIndex = 0;
  
  const start = points[0];
  const end = points[points.length - 1];
  
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], start, end);
    
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }
  
  // If the maximum distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    const firstSegment = douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
    const secondSegment = douglasPeucker(points.slice(maxIndex), epsilon);
    
    // Combine the results (removing duplicate point)
    return firstSegment.slice(0, -1).concat(secondSegment);
  } else {
    // All points in this segment are within epsilon distance from the line
    return [points[0], points[points.length - 1]];
  }
}

/**
 * Calculate the perpendicular distance from a point to a line segment
 * @param {Object} point - The point
 * @param {Object} lineStart - Start point of the line
 * @param {Object} lineEnd - End point of the line
 * @returns {Number} - Distance
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  // Line length squared
  const lineLengthSquared = dx * dx + dy * dy;
  
  // If line length is zero, return distance to the start point
  if (lineLengthSquared === 0) {
    return getDistance(point, lineStart);
  }
  
  // Calculate projection
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSquared;
  
  if (t < 0) {
    // Point is beyond the lineStart end of the segment
    return getDistance(point, lineStart);
  }
  if (t > 1) {
    // Point is beyond the lineEnd end of the segment
    return getDistance(point, lineEnd);
  }
  
  // Point projects onto the line segment
  const projectionX = lineStart.x + t * dx;
  const projectionY = lineStart.y + t * dy;
  
  return getDistance(point, { x: projectionX, y: projectionY });
}

/**
 * Compute a bounding box from polygon points (optimized)
 * @param {Array} points - Array of points with x, y properties
 * @returns {Object} - Bounding box {x1, y1, x2, y2}
 */
export function computeBoundingBox(points) {
  if (!points || points.length === 0) return null;
  
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  // Single loop for better performance
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }
  
  return { x1: minX, y1: minY, x2: maxX, y2: maxY };
}

/**
 * Calculate the area of a polygon
 * @param {Array} points - Array of points with x, y properties
 * @returns {Number} - Area of polygon
 */
export function calculatePolygonArea(points) {
  let area = 0;
  const n = points.length;
  
  // Optimized version with fewer array lookups
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p1 = points[i];
    const p2 = points[j];
    area += p1.x * p2.y;
    area -= p2.x * p1.y;
  }
  
  return Math.abs(area / 2);
}

/**
 * Calculate the perimeter of a polygon
 * @param {Array} points - Array of points with x, y properties
 * @returns {Number} - Perimeter length
 */
export function calculatePolygonPerimeter(points) {
  let perimeter = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    perimeter += getDistance(points[i], points[j]);
  }
  
  return perimeter;
}

/**
 * Shade a hex color by a given amount
 * @param {String} col - Hex color string
 * @param {Number} amt - Amount to shade (-255 to 255)
 * @returns {String} - Shaded hex color
 */
export function shadeColor(col, amt) {
  let usePound = false;
  let color = col;
  
  if (color[0] === '#') {
    color = color.slice(1);
    usePound = true;
  }
  
  // Parse color more efficiently
  const num = parseInt(color, 16);
  let R = (num >> 16) & 255;
  let G = (num >> 8) & 255;
  let B = num & 255;
  
  R = Math.min(255, Math.max(0, R + amt));
  G = Math.min(255, Math.max(0, G + amt));
  B = Math.min(255, Math.max(0, B + amt));
  
  // Construct result more efficiently using bitwise operations
  const result = (R << 16) | (G << 8) | B;
  
  // Convert to hex string with padding
  return (usePound ? '#' : '') + result.toString(16).padStart(6, '0');
}