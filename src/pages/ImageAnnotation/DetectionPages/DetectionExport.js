// src/pages/DetectionExport.js
import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { create } from 'xmlbuilder2';
import './DetectionExport.css';

/* --------------------- Helper Functions --------------------- */

// Compute bounding box from an array of points (used for polygon to bbox conversion)
const getBoundingBox = (points) => {
  if (!points || points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

// Calculate polygon area using the shoelace formula (for accurate area in COCO)
const calculatePolygonArea = (points) => {
  if (!points || points.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += (points[i].x * points[j].y - points[j].x * points[i].y);
  }

  return Math.abs(area / 2);
};

// Convert polygon to RLE (Run Length Encoding) for COCO segmentation
const polygonToRLE = (polygon, width, height) => {
  // This is a simplified implementation - for production, use a proper RLE library
  // or implement the full algorithm for polygon rasterization to RLE
  return {
    counts: [], // Would contain actual RLE encoding
    size: [height, width]
  };
};

// Load image dimensions from a URL (returns { width, height })
const loadImageDimension = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = url;
  });

// Normalize coordinates to 0-1 range for YOLO formats
const normalizeCoordinate = (value, dimension) => {
  if (dimension <= 0) return 0;
  const normalized = value / dimension;
  return Math.max(0, Math.min(1, normalized)); // Clamp between 0 and 1
};

// Format number with consistent precision for export
const formatNumber = (num, precision = 6) => {
  return parseFloat(num.toFixed(precision));
};

/* ------------------- Export Format Generators ------------------- */

// Standard COCO export (bounding boxes and segmentation)
const generateCOCO = (annotations, filesList, dimensions, labelClasses) => {
  const images = filesList.map((file, index) => ({
    id: index + 1,
    file_name: file.originalname,
    width: dimensions[file.url]?.width || 0,
    height: dimensions[file.url]?.height || 0,
  }));

  const categories = labelClasses.map((lc, index) => ({
    id: index + 1,
    name: lc.name,
    supercategory: lc.supercategory || "none"
  }));

  const annotationsList = [];
  let annId = 1;

  filesList.forEach((file, imgIndex) => {
    const imgId = imgIndex + 1;
    const shapes = annotations[file.url] || [];
    const imgDims = dimensions[file.url] || { width: 1, height: 1 };

    shapes.forEach((shape) => {
      // Skip shapes without a valid label match
      const categoryId = categories.find(c => c.name === shape.label)?.id;
      if (!categoryId) return;

      if (shape.type === 'bbox') {
        // Ensure coordinates are valid numbers
        const x = Math.max(0, shape.x || 0);
        const y = Math.max(0, shape.y || 0);
        const width = Math.max(0, shape.width || 0);
        const height = Math.max(0, shape.height || 0);

        annotationsList.push({
          id: annId++,
          image_id: imgId,
          category_id: categoryId,
          bbox: [x, y, width, height],
          area: width * height,
          segmentation: [],  // No segmentation for pure bbox
          iscrowd: 0,
        });
      } else if (shape.type === 'polygon' && shape.points && shape.points.length >= 3) {
        const segPoints = shape.points.flatMap(p => [p.x, p.y]);
        const bbox = getBoundingBox(shape.points);
        const area = calculatePolygonArea(shape.points);

        annotationsList.push({
          id: annId++,
          image_id: imgId,
          category_id: categoryId,
          segmentation: [segPoints],
          area: area,
          bbox: [bbox.x, bbox.y, bbox.width, bbox.height],
          iscrowd: 0,
        });
      }
    });
  });

  return {
    info: {
      description: 'Annotations exported in COCO format',
      date_created: new Date().toISOString()
    },
    licenses: [{ id: 1, name: "Unknown", url: "" }],
    images,
    annotations: annotationsList,
    categories,
  };
};

// Generate COCO instance segmentation format (with RLE option)
const generateCOCOSegmentation = (annotations, filesList, dimensions, labelClasses, useRLE = false) => {
  const cocoData = generateCOCO(annotations, filesList, dimensions, labelClasses);

  // If using RLE, convert polygon segmentations to RLE format
  if (useRLE) {
    cocoData.annotations.forEach((ann, index) => {
      if (ann.segmentation && ann.segmentation.length > 0) {
        const imgId = ann.image_id;
        const imgFile = filesList[imgId - 1];
        const imgDim = dimensions[imgFile.url] || { width: 1, height: 1 };

        ann.segmentation = polygonToRLE(ann.segmentation[0], imgDim.width, imgDim.height);
        ann.iscrowd = 1; // RLE is used for crowd annotations
      }
    });
  }

  return cocoData;
};

// Generate Pascal VOC XML files (one XML per image)
const generatePascalVOC = (annotations, filesList, dimensions) => {
  return filesList.map(file => {
    const shapes = annotations[file.url] || [];
    const imgDim = dimensions[file.url] || { width: 0, height: 0 };

    const xmlDoc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('annotation')
      .ele('folder').txt('images').up()
      .ele('filename').txt(file.originalname).up()
      .ele('path').txt(file.originalname).up()
      .ele('source')
      .ele('database').txt('Unknown').up()
      .up()
      .ele('size')
      .ele('width').txt(imgDim.width.toString()).up()
      .ele('height').txt(imgDim.height.toString()).up()
      .ele('depth').txt('3').up()
      .up()
      .ele('segmented').txt('0').up();

    shapes.forEach(shape => {
      if (shape.type !== 'bbox' && shape.type !== 'polygon') return;

      const object = xmlDoc.ele('object');
      object.ele('name').txt(shape.label).up();
      object.ele('pose').txt('Unspecified').up();
      object.ele('truncated').txt('0').up();
      object.ele('difficult').txt('0').up();

      let bbox;
      if (shape.type === 'bbox') {
        bbox = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
      } else if (shape.type === 'polygon') {
        bbox = getBoundingBox(shape.points);
      }

      // Ensure all values are valid numbers and within image bounds
      const xmin = Math.max(0, Math.min(imgDim.width, bbox.x));
      const ymin = Math.max(0, Math.min(imgDim.height, bbox.y));
      const xmax = Math.max(0, Math.min(imgDim.width, bbox.x + bbox.width));
      const ymax = Math.max(0, Math.min(imgDim.height, bbox.y + bbox.height));

      const bndbox = object.ele('bndbox');
      bndbox.ele('xmin').txt(Math.round(xmin).toString()).up();
      bndbox.ele('ymin').txt(Math.round(ymin).toString()).up();
      bndbox.ele('xmax').txt(Math.round(xmax).toString()).up();
      bndbox.ele('ymax').txt(Math.round(ymax).toString()).up();
      object.up();
    });

    return {
      name: file.originalname.replace(/\.[^/.]+$/, '') + '.xml',
      content: xmlDoc.end({ prettyPrint: true }),
    };
  });
};

// Generate YOLO bounding box format files (one .txt per image)
const generateYOLOBBox = (annotations, filesList, dimensions, labelClasses) => {
  const txtFiles = filesList.map(file => {
    const shapes = annotations[file.url] || [];
    const imgDim = dimensions[file.url] || { width: 1, height: 1 };

    const lines = shapes.map(shape => {
      // Find the class ID
      const classId = labelClasses.findIndex(lc => lc.name === shape.label);
      if (classId === -1) return null;

      let bbox;
      if (shape.type === 'bbox') {
        bbox = {
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height
        };
      } else if (shape.type === 'polygon' && shape.points && shape.points.length >= 3) {
        bbox = getBoundingBox(shape.points);
      } else {
        return null;
      }

      // YOLO format requires center x, center y, width, height - all normalized
      const cx = normalizeCoordinate(bbox.x + bbox.width / 2, imgDim.width);
      const cy = normalizeCoordinate(bbox.y + bbox.height / 2, imgDim.height);
      const w = normalizeCoordinate(bbox.width, imgDim.width);
      const h = normalizeCoordinate(bbox.height, imgDim.height);

      // Format with consistent precision
      return `${classId} ${formatNumber(cx)} ${formatNumber(cy)} ${formatNumber(w)} ${formatNumber(h)}`;
    }).filter(Boolean);

    return {
      name: file.originalname.replace(/\.[^/.]+$/, '') + '.txt',
      content: lines.join('\n'),
    };
  });

  return txtFiles;
};

// Generate YOLO segmentation format files (each line: class_id + polygon points normalized)
const generateYOLOSeg = (annotations, filesList, dimensions, labelClasses) => {
  const txtFiles = filesList.map(file => {
    const shapes = annotations[file.url] || [];
    const imgDim = dimensions[file.url] || { width: 1, height: 1 };

    const lines = shapes.map(shape => {
      const classId = labelClasses.findIndex(lc => lc.name === shape.label);
      if (classId === -1) return null;

      let points;
      if (shape.type === 'polygon' && shape.points && shape.points.length >= 3) {
        points = shape.points;
      } else if (shape.type === 'bbox') {
        // Convert bbox to 4-point polygon (clockwise)
        points = [
          { x: shape.x, y: shape.y },
          { x: shape.x + shape.width, y: shape.y },
          { x: shape.x + shape.width, y: shape.y + shape.height },
          { x: shape.x, y: shape.y + shape.height },
        ];
      } else {
        return null;
      }

      // Normalize coordinates to 0-1 range
      const normalized = points.flatMap(p => [
        formatNumber(normalizeCoordinate(p.x, imgDim.width)),
        formatNumber(normalizeCoordinate(p.y, imgDim.height))
      ]);

      return `${classId} ${normalized.join(' ')}`;
    }).filter(Boolean);

    return {
      name: file.originalname.replace(/\.[^/.]+$/, '') + '.txt',
      content: lines.join('\n'),
    };
  });

  return txtFiles;
};

// Generate labelme format (one JSON per image)
const generateLabelMe = (annotations, filesList, dimensions) => {
  return filesList.map(file => {
    const shapes = annotations[file.url] || [];
    const imgDim = dimensions[file.url] || { width: 0, height: 0 };

    const labelmeData = {
      version: "5.1.1",
      flags: {},
      shapes: [],
      imagePath: file.originalname,
      imageData: null,
      imageHeight: imgDim.height,
      imageWidth: imgDim.width
    };

    shapes.forEach(shape => {
      let labelmeShape = {
        label: shape.label,
        points: [],
        group_id: null,
        description: "",
        shape_type: "",
        flags: {}
      };

      if (shape.type === 'bbox') {
        labelmeShape.shape_type = "rectangle";
        labelmeShape.points = [
          [shape.x, shape.y],
          [shape.x + shape.width, shape.y + shape.height]
        ];
      } else if (shape.type === 'polygon' && shape.points && shape.points.length >= 3) {
        labelmeShape.shape_type = "polygon";
        labelmeShape.points = shape.points.map(p => [p.x, p.y]);
      } else {
        return; // Skip unsupported shapes
      }

      labelmeData.shapes.push(labelmeShape);
    });

    return {
      name: file.originalname.replace(/\.[^/.]+$/, '') + '.json',
      content: JSON.stringify(labelmeData, null, 2),
    };
  });
};

// Generate CreateML format (single JSON with all annotations)
const generateCreateML = (annotations, filesList, dimensions) => {
  const createMLData = filesList.map(file => {
    const shapes = annotations[file.url] || [];
    const imgDim = dimensions[file.url] || { width: 0, height: 0 };

    const annotation = {
      image: file.originalname,
      annotations: []
    };

    shapes.forEach(shape => {
      if (shape.type === 'bbox') {
        annotation.annotations.push({
          label: shape.label,
          coordinates: {
            x: shape.x + shape.width / 2,
            y: shape.y + shape.height / 2,
            width: shape.width,
            height: shape.height
          }
        });
      } else if (shape.type === 'polygon' && shape.points && shape.points.length >= 3) {
        const bbox = getBoundingBox(shape.points);
        annotation.annotations.push({
          label: shape.label,
          coordinates: {
            x: bbox.x + bbox.width / 2,
            y: bbox.y + bbox.height / 2,
            width: bbox.width,
            height: bbox.height
          }
        });
      }
    });

    return annotation;
  });

  return [{
    name: 'annotations.json',
    content: JSON.stringify(createMLData, null, 2)
  }];
};

// Generate Tensorflow Object Detection API format
const generateTFObjDet = (annotations, filesList, dimensions, labelClasses) => {
  // Create a map of label ID to label name
  const labelMap = {};
  labelClasses.forEach((lc, index) => {
    labelMap[index + 1] = lc.name;
  });

  // Create label map file
  const labelMapContent = Object.entries(labelMap)
    .map(([id, name]) =>
      `item {\n  id: ${id}\n  name: "${name}"\n}`
    ).join('\n\n');

  // Create TF Record data (placeholder - actual TFRecord creation requires specialized libraries)
  const tfRecordInfo = {
    name: 'README.txt',
    content: 'To create TFRecord files, run the provided Python script with these annotations.\n\n' +
      'This export provides the label map and annotation information needed for TFRecord creation.'
  };

  // Create annotation data in CSV format (to be processed to TFRecord)
  const csvRows = ['filename,width,height,class,xmin,ymin,xmax,ymax'];

  filesList.forEach(file => {
    const shapes = annotations[file.url] || [];
    const imgDim = dimensions[file.url] || { width: 1, height: 1 };

    shapes.forEach(shape => {
      const labelIndex = labelClasses.findIndex(lc => lc.name === shape.label);
      if (labelIndex === -1) return;

      const className = shape.label;
      let bbox;

      if (shape.type === 'bbox') {
        bbox = {
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height
        };
      } else if (shape.type === 'polygon') {
        bbox = getBoundingBox(shape.points);
      } else {
        return; // Skip unsupported shapes
      }

      const xmin = Math.max(0, bbox.x);
      const ymin = Math.max(0, bbox.y);
      const xmax = Math.min(imgDim.width, bbox.x + bbox.width);
      const ymax = Math.min(imgDim.height, bbox.y + bbox.height);

      csvRows.push(`${file.originalname},${imgDim.width},${imgDim.height},${className},${xmin},${ymin},${xmax},${ymax}`);
    });
  });

  return [
    {
      name: 'label_map.pbtxt',
      content: labelMapContent
    },
    {
      name: 'annotations.csv',
      content: csvRows.join('\n')
    },
    tfRecordInfo
  ];
};

// Generate custom JSON format (with normalized coordinates option)
const generateCustomJSON = (annotations, filesList, dimensions, labelClasses, normalized = false) => {
  const customData = {
    metadata: {
      format: "Custom JSON annotation format",
      normalized: normalized,
      labels: labelClasses.map(lc => ({
        id: labelClasses.indexOf(lc),
        name: lc.name,
        color: lc.color
      })),
      date_created: new Date().toISOString()
    },
    images: []
  };

  filesList.forEach(file => {
    const shapes = annotations[file.url] || [];
    const imgDim = dimensions[file.url] || { width: 1, height: 1 };

    const imageData = {
      file_name: file.originalname,
      width: imgDim.width,
      height: imgDim.height,
      annotations: []
    };

    shapes.forEach(shape => {
      const labelId = labelClasses.findIndex(lc => lc.name === shape.label);
      if (labelId === -1) return;

      let annData = {
        label: shape.label,
        label_id: labelId,
        type: shape.type
      };

      if (shape.type === 'bbox') {
        if (normalized) {
          annData.bbox = [
            formatNumber(normalizeCoordinate(shape.x, imgDim.width)),
            formatNumber(normalizeCoordinate(shape.y, imgDim.height)),
            formatNumber(normalizeCoordinate(shape.width, imgDim.width)),
            formatNumber(normalizeCoordinate(shape.height, imgDim.height))
          ];
        } else {
          annData.bbox = [shape.x, shape.y, shape.width, shape.height];
        }
      } else if (shape.type === 'polygon' && shape.points && shape.points.length >= 3) {
        if (normalized) {
          annData.points = shape.points.map(p => [
            formatNumber(normalizeCoordinate(p.x, imgDim.width)),
            formatNumber(normalizeCoordinate(p.y, imgDim.height))
          ]);
        } else {
          annData.points = shape.points.map(p => [p.x, p.y]);
        }

        // Also include bounding box for convenience
        const bbox = getBoundingBox(shape.points);
        if (normalized) {
          annData.bbox = [
            formatNumber(normalizeCoordinate(bbox.x, imgDim.width)),
            formatNumber(normalizeCoordinate(bbox.y, imgDim.height)),
            formatNumber(normalizeCoordinate(bbox.width, imgDim.width)),
            formatNumber(normalizeCoordinate(bbox.height, imgDim.height))
          ];
        } else {
          annData.bbox = [bbox.x, bbox.y, bbox.width, bbox.height];
        }
      } else {
        return; // Skip unsupported shapes
      }

      imageData.annotations.push(annData);
    });

    if (imageData.annotations.length > 0) {
      customData.images.push(imageData);
    }
  });

  return [{
    name: normalized ? 'annotations_normalized.json' : 'annotations.json',
    content: JSON.stringify(customData, null, 2)
  }];
};

/* --------------------- Main Export Component --------------------- */

export default function DetectionExport({
  annotations,
  filesList,
  imageDimensions,
  localLabelClasses,
  handleSave,
  showHelper,
  isSaving,
  setIsSaving,
  triggerExportModal,
}) {
  const [showModal, setShowModal] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('coco');
  const [normalizeCoords, setNormalizeCoords] = useState(true);
  const [exportInProgress, setExportInProgress] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Open export modal when triggerExportModal is true
  useEffect(() => {
    if (triggerExportModal) {
      setShowModal(true);
    }
  }, [triggerExportModal]);

  // Ensure every image has valid dimensions; if missing, load them.
  const loadDimensions = async () => {
    const dimensions = { ...imageDimensions };
    const filesToProcess = filesList.filter(file =>
      !dimensions[file.url] || !dimensions[file.url].width || !dimensions[file.url].height
    );

    if (filesToProcess.length > 0) {
      let processed = 0;

      await Promise.all(filesToProcess.map(async (file) => {
        try {
          const dims = await loadImageDimension(file.url);
          dimensions[file.url] = dims;
          processed++;
          setExportProgress(Math.floor((processed / filesToProcess.length) * 50)); // Use first 50% for loading dimensions
        } catch (error) {
          console.error(`Failed to load dimensions for ${file.url}:`, error);
          dimensions[file.url] = { width: 0, height: 0 };
        }
      }));
    } else {
      setExportProgress(50); // Skip to 50% if all dimensions are already loaded
    }

    return dimensions;
  };

  const handleExport = async () => {
    if (!filesList.length) {
      showHelper('No images available for export.');
      setShowModal(false);
      return;
    }

    if (!Object.values(annotations).some(arr => arr && arr.length > 0)) {
      showHelper('No annotations to export.');
      setShowModal(false);
      return;
    }

    setExportInProgress(true);
    setExportProgress(0);

    try {
      // Save annotations first to ensure all data is up to date
      if (handleSave) {
        setIsSaving(true);
        await handleSave();
        setIsSaving(false);
      }

      // Load image dimensions
      const dimensions = await loadDimensions();

      let exportFiles = [];
      let exportFilename = `annotations_${selectedFormat}.zip`;

      setExportProgress(60); // After dimensions loaded, set to 60%

      // Generate the appropriate format
      switch (selectedFormat) {
        case 'coco':
          const cocoData = generateCOCO(annotations, filesList, dimensions, localLabelClasses);
          exportFiles = [{ name: 'annotations.json', content: JSON.stringify(cocoData, null, 2) }];
          break;

        case 'coco_seg':
          const cocoSegData = generateCOCOSegmentation(annotations, filesList, dimensions, localLabelClasses);
          exportFiles = [{ name: 'coco_segmentation.json', content: JSON.stringify(cocoSegData, null, 2) }];
          break;

        case 'pascal_voc':
          exportFiles = generatePascalVOC(annotations, filesList, dimensions);
          exportFilename = 'pascal_voc_annotations.zip';
          break;

        case 'yolo_bbox':
          exportFiles = generateYOLOBBox(annotations, filesList, dimensions, localLabelClasses);
          // Add classes.txt file
          exportFiles.push({
            name: 'classes.txt',
            content: localLabelClasses.map(lc => lc.name).join('\n')
          });
          exportFilename = 'yolo_bbox_annotations.zip';
          break;

        case 'yolo_seg':
          exportFiles = generateYOLOSeg(annotations, filesList, dimensions, localLabelClasses);
          // Add classes.txt file
          exportFiles.push({
            name: 'classes.txt',
            content: localLabelClasses.map(lc => lc.name).join('\n')
          });
          // Add dataset.yaml file
          exportFiles.push({
            name: 'dataset.yaml',
            content: `# YOLO Segmentation Dataset\n\nnames:\n${localLabelClasses.map((lc, i) => `  ${i}: ${lc.name}`).join('\n')}`
          });
          exportFilename = 'yolo_segmentation_annotations.zip';
          break;

        case 'labelme':
          exportFiles = generateLabelMe(annotations, filesList, dimensions);
          exportFilename = 'labelme_annotations.zip';
          break;

        case 'createml':
          exportFiles = generateCreateML(annotations, filesList, dimensions);
          exportFilename = 'createml_annotations.zip';
          break;

        case 'tf_obj_det':
          exportFiles = generateTFObjDet(annotations, filesList, dimensions, localLabelClasses);
          exportFilename = 'tf_object_detection_annotations.zip';
          break;

        case 'custom_json':
          exportFiles = generateCustomJSON(
            annotations,
            filesList,
            dimensions,
            localLabelClasses,
            normalizeCoords
          );
          exportFilename = 'custom_json_annotations.zip';
          break;

        default:
          exportFiles = [{
            name: 'error.txt',
            content: 'Unknown export format selected.'
          }];
      }

      setExportProgress(80); // Format generated, set to 80%

      // Create ZIP file with all export files
      const zip = new JSZip();

      // Add README file
      zip.file('README.txt',
        `Annotation Export - ${new Date().toISOString()}\n` +
        `Format: ${selectedFormat}\n` +
        `Total Images: ${filesList.length}\n` +
        `Total Annotations: ${Object.values(annotations).reduce((sum, arr) => sum + (arr ? arr.length : 0), 0)}\n` +
        `Label Classes: ${localLabelClasses.map(lc => lc.name).join(', ')}\n`
      );

      // Add each export file to the ZIP
      exportFiles.forEach(file => {
        if (file.name.includes('/')) {
          // Handle nested paths
          const parts = file.name.split('/');
          const fileName = parts.pop();
          let folder = zip;

          parts.forEach(part => {
            folder = folder.folder(part);
          });

          folder.file(fileName, file.content);
        } else {
          zip.file(file.name, file.content);
        }
      });

      setExportProgress(90); // Files added to ZIP, set to 90%

      // Generate and save the ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, exportFilename);

      setExportProgress(100); // Export complete
      showHelper('Export completed successfully');
    } catch (error) {
      console.error('Error exporting annotations:', error);
      showHelper('Error during export: ' + error.message);
    } finally {
      setExportInProgress(false);
      setShowModal(false);
    }
  };

  // Group export formats for better organization in the UI
  const exportFormats = [
    {
      id: 'common',
      title: 'Common Formats',
      formats: [
        { id: 'coco', name: 'COCO Detection' },
        { id: 'coco_seg', name: 'COCO Segmentation' },
        { id: 'pascal_voc', name: 'Pascal VOC' },
        { id: 'custom_json', name: 'Custom JSON' }
      ]
    },
    {
      id: 'yolo',
      title: 'YOLO Formats',
      formats: [
        { id: 'yolo_bbox', name: 'YOLO Detection (bbox)' },
        { id: 'yolo_seg', name: 'YOLO Segmentation' },
      ]
    },
    {
      id: 'other',
      title: 'Other Formats',
      formats: [
        { id: 'labelme', name: 'LabelMe' },
        { id: 'createml', name: 'CreateML' },
        { id: 'tf_obj_det', name: 'TensorFlow Object Detection API' }
      ]
    }
  ];

  return (
    <>
      {showModal && (
        <div className="modal-backdrop">
          <div className="export-modal">
            <div className="export-modal-header">
              <h3>Export Annotations</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="export-modal-body">
              <div className="export-format-selection">
                {exportFormats.map(group => (
                  <div key={group.id} className="format-group">
                    <h4>{group.title}</h4>
                    <div className="format-options">
                      {group.formats.map(format => (
                        <div key={format.id} className="format-option">
                          <input
                            type="radio"
                            id={`format-${format.id}`}
                            name="format"
                            value={format.id}
                            checked={selectedFormat === format.id}
                            onChange={() => setSelectedFormat(format.id)}
                          />
                          <label htmlFor={`format-${format.id}`}>
                            {format.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {selectedFormat === 'custom_json' && (
                <div className="export-options">
                  <div className="option-item">
                    <input
                      type="checkbox"
                      id="normalize-coords"
                      checked={normalizeCoords}
                      onChange={(e) => setNormalizeCoords(e.target.checked)}
                    />
                    <label htmlFor="normalize-coords">
                      Normalize coordinates (0-1 range)
                    </label>
                  </div>
                </div>
              )}

              <div className="export-summary">
                <h4>Export Summary</h4>
                <div className="export-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Images:</span>
                    <span className="stat-value">{filesList.length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Total Annotations:</span>
                    <span className="stat-value">
                      {Object.values(annotations).reduce((sum, arr) => sum + (arr ? arr.length : 0), 0)}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Labels:</span>
                    <span className="stat-value">{localLabelClasses.length}</span>
                  </div>
                </div>

                <div className="format-description">
                  {selectedFormat === 'coco' && (
                    <p>COCO format is widely used for object detection. Exports bounding boxes and polygons in JSON format.</p>
                  )}
                  {selectedFormat === 'coco_seg' && (
                    <p>COCO Segmentation format specifically for instance segmentation. Exports polygons as segmentation masks.</p>
                  )}
                  {selectedFormat === 'pascal_voc' && (
                    <p>Pascal VOC format exports XML files for each image with bounding box annotations.</p>
                  )}
                  {selectedFormat === 'yolo_bbox' && (
                    <p>YOLO Detection format exports normalized bounding box coordinates in .txt files (one per image).</p>
                  )}
                  {selectedFormat === 'yolo_seg' && (
                    <p>YOLO Segmentation format exports normalized polygon coordinates in .txt files.</p>
                  )}
                  {selectedFormat === 'labelme' && (
                    <p>LabelMe format exports JSON files compatible with the LabelMe annotation tool.</p>
                  )}
                  {selectedFormat === 'createml' && (
                    <p>CreateML format for training object detection models using Apple's CreateML.</p>
                  )}
                  {selectedFormat === 'tf_obj_det' && (
                    <p>TensorFlow Object Detection API format includes label map and annotations data.</p>
                  )}
                  {selectedFormat === 'custom_json' && (
                    <p>Custom JSON format with all annotation data in a structured format. Includes bounding boxes and polygons.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="export-modal-footer">
              {exportInProgress ? (
                <div className="export-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${exportProgress}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">
                    {exportProgress < 100 ? 'Exporting...' : 'Export complete!'}
                  </span>
                </div>
              ) : (
                <div className="modal-buttons">
                  <button onClick={() => setShowModal(false)} className="secondary-btn">
                    Cancel
                  </button>
                  <button
                    onClick={handleExport}
                    className="primary-btn"
                    disabled={isSaving || exportInProgress}
                  >
                    {isSaving ? 'Saving...' : 'Export'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}