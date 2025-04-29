/**
 * Utility functions for working with shapes
 */

/**
 * Calculate the bounding box of a shape
 * @param {Object} ann - Annotation object
 * @returns {Object|null} - Bounding box {x1, y1, x2, y2} or null
 */
export function shapeBoundingBox(ann) {
  if (ann.type === 'bbox') {
    return {
      x1: ann.x,
      y1: ann.y,
      x2: ann.x + ann.width,
      y2: ann.y + ann.height,
    };
  } else if (ann.type === 'ellipse') {
    return {
      x1: ann.x - ann.radiusX,
      y1: ann.y - ann.radiusY,
      x2: ann.x + ann.radiusX,
      y2: ann.y + ann.radiusY,
    };
  } else if (ann.type === 'polygon' || ann.type === 'polyline') {
    if (!ann.points || ann.points.length === 0) return null;
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    ann.points.forEach(pt => {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    });
    
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
  }
  
  return null;
}

/**
 * Check if annotation is completely outside the image
 * @param {Object} ann - Annotation object
 * @param {Number} w - Image width
 * @param {Number} h - Image height
 * @returns {Boolean} - True if outside
 */
export function isOutsideImage(ann, w, h) {
  const box = shapeBoundingBox(ann);
  if (!box) return false;
  
  const { x1, y1, x2, y2 } = box;
  if (x2 < 0 || x1 > w || y2 < 0 || y1 > h) {
    return true;
  }
  
  return false;
}

/**
 * Check if annotation is partially outside the image
 * @param {Object} ann - Annotation object
 * @param {Number} w - Image width
 * @param {Number} h - Image height
 * @returns {Boolean} - True if partially outside
 */
export function isPartiallyOutside(ann, w, h) {
  const box = shapeBoundingBox(ann);
  if (!box) return false;
  
  const { x1, y1, x2, y2 } = box;
  if (x1 < 0 || x2 > w || y1 < 0 || y2 > h) {
    return true;
  }
  
  return false;
}

/**
 * Convert an ellipse to a polygon
 * @param {Object} ellipse - Ellipse object
 * @param {Number} numPoints - Number of points (default: 20)
 * @returns {Object} - Polygon object
 */
export function convertEllipseToPolygon(ellipse, numPoints = 20) {
  const { x, y, radiusX, radiusY, label, color, opacity } = ellipse;
  const points = [];

  // Generate points along the ellipse's perimeter
  for (let i = 0; i < numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    const px = x + radiusX * Math.cos(angle);
    const py = y + radiusY * Math.sin(angle);
    points.push({ x: px, y: py });
  }

  return {
    type: 'polygon',
    points,
    label,
    color,
    opacity: opacity !== undefined ? opacity : 0.55,
  };
}

/**
 * Generate a polygon to represent the image background with holes for other annotations
 * @param {Number} imageWidth - Image width
 * @param {Number} imageHeight - Image height
 * @param {Array} shapes - Array of existing annotations
 * @param {Array} labelClasses - Array of label classes
 * @returns {Object} - Background polygon annotation
 */
export function computeBackgroundPolygon(imageWidth, imageHeight, shapes, labelClasses) {
  const outer = [
    { x: 0, y: 0 },
    { x: imageWidth, y: 0 },
    { x: imageWidth, y: imageHeight },
    { x: 0, y: imageHeight },
  ];
  
  const holes = [];
  
  shapes.forEach(ann => {
    if (ann.label.toLowerCase() === 'background') return;
    
    if (ann.type === 'bbox') {
      const hole = [
        { x: ann.x, y: ann.y },
        { x: ann.x + ann.width, y: ann.y },
        { x: ann.x + ann.width, y: ann.y + ann.height },
        { x: ann.x, y: ann.y + ann.height },
      ];
      holes.push(hole);
    } else if (ann.type === 'polygon') {
      holes.push(ann.points);
    } else if (ann.type === 'ellipse') {
      const convertedPolygon = convertEllipseToPolygon(ann);
      holes.push(convertedPolygon.points);
    }
  });
  
  // Find a unique background color
  let bgColor = '#000000';
  if (
    labelClasses &&
    labelClasses.some(
      (lc) =>
        lc.color.toLowerCase() === '#000000' &&
        lc.name.toLowerCase() !== 'background'
    )
  ) {
    bgColor = '#010101';
  }
  
  return {
    type: 'polygon',
    points: outer,
    holes: holes,
    label: 'background',
    color: bgColor,
    opacity: 0.5,
  };
}

/**
 * Create a deep copy of an annotation
 * @param {Object} annotation - Annotation object
 * @returns {Object} - Clone of the annotation
 */
export function cloneAnnotation(annotation) {
  const clone = { ...annotation };
  
  if (annotation.points) {
    clone.points = annotation.points.map(pt => ({ ...pt }));
  }
  
  if (annotation.holes) {
    clone.holes = annotation.holes.map(hole => 
      hole.map(pt => ({ ...pt }))
    );
  }
  
  return clone;
}

/**
 * Check if a point is inside a polygon
 * @param {Object} point - Point {x, y}
 * @param {Array} polygon - Array of points
 * @returns {Boolean} - True if point is inside
 */
export function isPointInPolygon(point, polygon) {
  const { x, y } = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    
    const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Find the nearest point in a polygon to a given point
 * @param {Object} point - Reference point {x, y}
 * @param {Array} polygon - Array of points
 * @returns {Object} - { index, distance }
 */
export function findNearestPointInPolygon(point, polygon) {
  let minDistance = Infinity;
  let nearestIndex = -1;
  
  polygon.forEach((pt, index) => {
    const dx = pt.x - point.x;
    const dy = pt.y - point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestIndex = index;
    }
  });
  
  return { index: nearestIndex, distance: minDistance };
}

/**
 * Determines if a shape is within or intersects with a selection rectangle
 * @param {Array} shapes - Array of annotation objects
 * @param {Object} region - Selection region {x1, y1, x2, y2}
 * @returns {Array} - Array of indices of shapes that are in the region
 */
export function findShapesInRegion(shapes, region) {
  if (!shapes || shapes.length === 0) return [];
  
  const selectedIndices = [];
  const { x1, y1, x2, y2 } = region;
  
  shapes.forEach((shape, index) => {
    let isInRegion = false;
    
    if (shape.type === 'bbox') {
      // Check if the bbox overlaps with the region
      const boxX2 = shape.x + shape.width;
      const boxY2 = shape.y + shape.height;
      
      isInRegion = !(boxX2 < x1 || shape.x > x2 || boxY2 < y1 || shape.y > y2);
    } else if (shape.type === 'ellipse') {
      // Check if the ellipse's bounding box overlaps with the region
      const ellipseX1 = shape.x - shape.radiusX;
      const ellipseY1 = shape.y - shape.radiusY;
      const ellipseX2 = shape.x + shape.radiusX;
      const ellipseY2 = shape.y + shape.radiusY;
      
      isInRegion = !(ellipseX2 < x1 || ellipseX1 > x2 || ellipseY2 < y1 || ellipseY1 > y2);
    } else if (shape.type === 'polygon' || shape.type === 'polyline') {
      // Check if any point is inside the region
      if (shape.points && shape.points.length > 0) {
        isInRegion = shape.points.some(pt => 
          pt.x >= x1 && pt.x <= x2 && pt.y >= y1 && pt.y <= y2
        );
        
        // If no points are inside, check if any line segment crosses the region
        if (!isInRegion && shape.points.length > 1) {
          for (let i = 0; i < shape.points.length - 1; i++) {
            const p1 = shape.points[i];
            const p2 = shape.points[i + 1];
            
            // Check if the line segment intersects any of the region's edges
            if (
              lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x1, y1, x2, y1) || // Top edge
              lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x1, y1, x1, y2) || // Left edge
              lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x2, y1, x2, y2) || // Right edge
              lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x1, y2, x2, y2)    // Bottom edge
            ) {
              isInRegion = true;
              break;
            }
          }
          
          // If it's a polygon, check the last segment too
          if (!isInRegion && shape.type === 'polygon' && shape.points.length > 2) {
            const p1 = shape.points[shape.points.length - 1];
            const p2 = shape.points[0];
            
            isInRegion = (
              lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x1, y1, x2, y1) ||
              lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x1, y1, x1, y2) ||
              lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x2, y1, x2, y2) ||
              lineIntersectsLine(p1.x, p1.y, p2.x, p2.y, x1, y2, x2, y2)
            );
          }
        }
      }
    }
    
    if (isInRegion) {
      selectedIndices.push(index);
    }
  });
  
  return selectedIndices;
}

/**
 * Check if two line segments intersect
 * @param {Number} x1 - First line's first point x
 * @param {Number} y1 - First line's first point y
 * @param {Number} x2 - First line's second point x
 * @param {Number} y2 - First line's second point y
 * @param {Number} x3 - Second line's first point x
 * @param {Number} y3 - Second line's first point y
 * @param {Number} x4 - Second line's second point x
 * @param {Number} y4 - Second line's second point y
 * @returns {Boolean} - True if lines intersect
 */
function lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
  // Calculate the direction of the lines
  const denominator = ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
  
  // If the denominator is 0, the lines are parallel
  if (denominator === 0) return false;
  
  const uA = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / denominator;
  const uB = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / denominator;
  
  // If uA and uB are between 0-1, lines are colliding
  return (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1);
}