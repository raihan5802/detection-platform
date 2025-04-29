const path = require('path');
const fs = require('fs');

/**
 * Save annotations for a task
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.saveAnnotations = (req, res) => {
    try {
        const { folderId, taskId, taskName, labelClasses, annotations } = req.body;

        const configDir = path.join(__dirname, '../../uploads', folderId, 'annotation-config', taskId);
        fs.mkdirSync(configDir, { recursive: true });

        const annotationsPath = path.join(configDir, 'annotations.json');

        fs.writeFileSync(annotationsPath, JSON.stringify({
            taskName,
            labelClasses,
            annotations,
            lastUpdated: new Date().toISOString()
        }, null, 2));

        console.log('Annotations saved to', annotationsPath);
        res.json({ message: 'Annotations saved' });
    } catch (error) {
        console.error('Error saving annotations:', error);
        res.status(500).json({ error: 'Failed to save annotations' });
    }
};

/**
 * Get annotations for a task
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAnnotations = (req, res) => {
    try {
        const { folderId, taskId } = req.params;
        const annotationsPath = path.join(__dirname, '../../uploads', folderId, 'annotation-config', taskId, 'annotations.json');

        if (fs.existsSync(annotationsPath)) {
            const data = JSON.parse(fs.readFileSync(annotationsPath, 'utf8'));
            res.json(data);
        } else {
            res.json({ annotations: {} });
        }
    } catch (error) {
        console.error('Error fetching annotations:', error);
        res.status(500).json({ error: 'Failed to fetch annotations' });
    }
};

/**
 * Store keypoints configuration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.saveKeypointsConfig = (req, res) => {
    try {
        const { folderId, taskId, keypointsData } = req.body;

        if (!folderId || !taskId || !keypointsData) {
            return res.status(400).json({ error: 'Missing required data' });
        }

        // Create directory if it doesn't exist
        const configDir = path.join(__dirname, '../../uploads', folderId, 'keypoints-config');
        fs.mkdirSync(configDir, { recursive: true });

        // Create file with task ID as name
        const configFilePath = path.join(configDir, `${taskId}.json`);

        // Save the keypoints configuration
        fs.writeFileSync(configFilePath, JSON.stringify(keypointsData, null, 2));

        res.json({ success: true, message: 'Keypoints configuration saved' });
    } catch (error) {
        console.error('Error saving keypoints configuration:', error);
        res.status(500).json({ error: 'Failed to save keypoints configuration' });
    }
};

/**
 * Retrieve keypoints configuration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getKeypointsConfig = (req, res) => {
    try {
        const { folderId, taskId } = req.params;

        const configFilePath = path.join(__dirname, '../../uploads', folderId, 'keypoints-config', `${taskId}.json`);

        if (!fs.existsSync(configFilePath)) {
            return res.status(404).json({ error: 'Keypoints configuration not found' });
        }

        const configData = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));

        res.json(configData);
    } catch (error) {
        console.error('Error retrieving keypoints configuration:', error);
        res.status(500).json({ error: 'Failed to retrieve keypoints configuration' });
    }
};

/**
 * Delete annotation for a specific image
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteAnnotation = (req, res) => {
    try {
        const { folderId, taskId, imageUrl } = req.params;

        const annotationsPath = path.join(__dirname, '../../uploads', folderId, 'annotation-config', taskId, 'annotations.json');

        if (!fs.existsSync(annotationsPath)) {
            return res.status(404).json({ error: 'Annotations not found' });
        }

        const data = JSON.parse(fs.readFileSync(annotationsPath, 'utf8'));

        if (data.annotations && data.annotations[imageUrl]) {
            // Remove the annotation for this image
            delete data.annotations[imageUrl];

            // Save the updated annotations
            data.lastUpdated = new Date().toISOString();
            fs.writeFileSync(annotationsPath, JSON.stringify(data, null, 2));

            res.json({
                message: 'Annotation deleted successfully',
                imageUrl
            });
        } else {
            res.status(404).json({ error: 'Annotation for this image not found' });
        }
    } catch (error) {
        console.error('Error deleting annotation:', error);
        res.status(500).json({ error: 'Failed to delete annotation' });
    }
};

/**
 * Export annotations in a specific format
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.exportAnnotations = (req, res) => {
    try {
        const { folderId, taskId, format } = req.params;

        const annotationsPath = path.join(__dirname, '../../uploads', folderId, 'annotation-config', taskId, 'annotations.json');

        if (!fs.existsSync(annotationsPath)) {
            return res.status(404).json({ error: 'Annotations not found' });
        }

        const data = JSON.parse(fs.readFileSync(annotationsPath, 'utf8'));

        let exportData;

        // Convert annotations to the requested format
        switch (format) {
            case 'coco':
                exportData = convertToCOCO(data);
                break;
            case 'yolo':
                exportData = convertToYOLO(data);
                break;
            case 'voc':
                exportData = convertToVOC(data);
                break;
            case 'csv':
                exportData = convertToCSV(data);
                break;
            default:
                // Default to JSON format (original)
                exportData = data;
        }

        res.json({
            format,
            data: exportData,
            message: `Annotations exported in ${format} format`
        });
    } catch (error) {
        console.error('Error exporting annotations:', error);
        res.status(500).json({ error: 'Failed to export annotations' });
    }
};

// Helper functions for format conversion
function convertToCOCO(data) {
    // Implementation for COCO format conversion
    const cocoData = {
        info: {
            year: new Date().getFullYear(),
            version: '1.0',
            description: 'Exported from Detection Platform',
            date_created: new Date().toISOString()
        },
        images: [],
        annotations: [],
        categories: []
    };

    // Add categories
    data.labelClasses.forEach((label, index) => {
        cocoData.categories.push({
            id: index + 1,
            name: label.name,
            supercategory: 'none'
        });
    });

    // Add images and annotations
    let annotationId = 1;
    Object.entries(data.annotations).forEach(([imageUrl, annotations], imageIndex) => {
        // Add image
        const imageId = imageIndex + 1;
        const imageFilename = imageUrl.split('/').pop();

        cocoData.images.push({
            id: imageId,
            file_name: imageFilename,
            width: annotations.width || 800, // Default width if not available
            height: annotations.height || 600 // Default height if not available
        });

        // Add annotations
        if (annotations.shapes && Array.isArray(annotations.shapes)) {
            annotations.shapes.forEach(shape => {
                // Find category ID
                const categoryId = data.labelClasses.findIndex(label => label.name === shape.label) + 1;

                // Create COCO annotation
                const cocoAnnotation = {
                    id: annotationId++,
                    image_id: imageId,
                    category_id: categoryId,
                    segmentation: [], // This would need to be converted from points
                    area: 0, // This would need to be calculated
                    bbox: [], // This would need to be converted from points
                    iscrowd: 0
                };

                // Convert polygon/rectangle points to bbox [x,y,width,height]
                if (shape.type === 'polygon' || shape.type === 'rectangle') {
                    // Extract x and y coordinates
                    const xCoords = shape.points.filter((_, i) => i % 2 === 0);
                    const yCoords = shape.points.filter((_, i) => i % 2 === 1);

                    // Calculate bbox
                    const minX = Math.min(...xCoords);
                    const minY = Math.min(...yCoords);
                    const maxX = Math.max(...xCoords);
                    const maxY = Math.max(...yCoords);

                    cocoAnnotation.bbox = [minX, minY, maxX - minX, maxY - minY];
                    cocoAnnotation.area = (maxX - minX) * (maxY - minY);

                    // For polygons, also add segmentation information
                    if (shape.type === 'polygon') {
                        cocoAnnotation.segmentation = [shape.points];
                    }
                }

                cocoData.annotations.push(cocoAnnotation);
            });
        }
    });

    return cocoData;
}

function convertToYOLO(data) {
    // Implementation for YOLO format conversion
    const yoloData = {};

    // Create a map of label name to index
    const labelMap = {};
    data.labelClasses.forEach((label, index) => {
        labelMap[label.name] = index;
    });

    // Process each image
    Object.entries(data.annotations).forEach(([imageUrl, annotations]) => {
        const imageFilename = imageUrl.split('/').pop();
        const imageLines = [];

        // Process shapes for this image
        if (annotations.shapes && Array.isArray(annotations.shapes)) {
            annotations.shapes.forEach(shape => {
                // Get label index
                const labelIndex = labelMap[shape.label];

                // Convert coordinates to YOLO format
                if (shape.type === 'rectangle') {
                    // Extract coordinates
                    const xCoords = shape.points.filter((_, i) => i % 2 === 0);
                    const yCoords = shape.points.filter((_, i) => i % 2 === 1);

                    // Calculate bbox in YOLO format: center_x, center_y, width, height
                    // All values normalized between 0 and 1
                    const minX = Math.min(...xCoords);
                    const minY = Math.min(...yCoords);
                    const maxX = Math.max(...xCoords);
                    const maxY = Math.max(...yCoords);

                    const imageWidth = annotations.width || 800; // Default width if not available
                    const imageHeight = annotations.height || 600; // Default height if not available

                    const centerX = (minX + maxX) / 2 / imageWidth;
                    const centerY = (minY + maxY) / 2 / imageHeight;
                    const width = (maxX - minX) / imageWidth;
                    const height = (maxY - minY) / imageHeight;

                    // Format: <class_id> <center_x> <center_y> <width> <height>
                    imageLines.push(`${labelIndex} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`);
                }
            });
        }

        // Add this image to the YOLO data
        yoloData[imageFilename] = imageLines;
    });

    return yoloData;
}

function convertToVOC(data) {
    // Implementation for VOC format conversion
    const vocData = {};

    // Process each image
    Object.entries(data.annotations).forEach(([imageUrl, annotations]) => {
        const imageFilename = imageUrl.split('/').pop();

        // Create XML structure
        const xmlData = {
            annotation: {
                folder: 'images',
                filename: imageFilename,
                path: imageUrl,
                source: {
                    database: 'Detection Platform'
                },
                size: {
                    width: annotations.width || 800,
                    height: annotations.height || 600,
                    depth: 3
                },
                segmented: 0,
                objects: []
            }
        };

        // Process shapes for this image
        if (annotations.shapes && Array.isArray(annotations.shapes)) {
            annotations.shapes.forEach(shape => {
                // For VOC format, we're only interested in rectangles (bounding boxes)
                if (shape.type === 'rectangle') {
                    // Extract coordinates
                    const xCoords = shape.points.filter((_, i) => i % 2 === 0);
                    const yCoords = shape.points.filter((_, i) => i % 2 === 1);

                    // Calculate bbox
                    const minX = Math.min(...xCoords);
                    const minY = Math.min(...yCoords);
                    const maxX = Math.max(...xCoords);
                    const maxY = Math.max(...yCoords);

                    // Add object to the XML
                    xmlData.annotation.objects.push({
                        name: shape.label,
                        pose: 'Unspecified',
                        truncated: 0,
                        difficult: 0,
                        bndbox: {
                            xmin: Math.round(minX),
                            ymin: Math.round(minY),
                            xmax: Math.round(maxX),
                            ymax: Math.round(maxY)
                        }
                    });
                }
            });
        }

        vocData[imageFilename] = xmlData;
    });

    return vocData;
}

function convertToCSV(data) {
    // Implementation for CSV format conversion
    const csvRows = ['filename,width,height,class,xmin,ymin,xmax,ymax'];

    // Process each image
    Object.entries(data.annotations).forEach(([imageUrl, annotations]) => {
        const imageFilename = imageUrl.split('/').pop();
        const imageWidth = annotations.width || 800;
        const imageHeight = annotations.height || 600;

        // Process shapes for this image
        if (annotations.shapes && Array.isArray(annotations.shapes)) {
            annotations.shapes.forEach(shape => {
                // For CSV format, we're primarily interested in bounding boxes
                if (shape.type === 'rectangle') {
                    // Extract coordinates
                    const xCoords = shape.points.filter((_, i) => i % 2 === 0);
                    const yCoords = shape.points.filter((_, i) => i % 2 === 1);

                    // Calculate bbox
                    const minX = Math.min(...xCoords);
                    const minY = Math.min(...yCoords);
                    const maxX = Math.max(...xCoords);
                    const maxY = Math.max(...yCoords);

                    // Add CSV row: filename,width,height,class,xmin,ymin,xmax,ymax
                    csvRows.push(`${imageFilename},${imageWidth},${imageHeight},${shape.label},${Math.round(minX)},${Math.round(minY)},${Math.round(maxX)},${Math.round(maxY)}`);
                }
            });
        }
    });

    return csvRows.join('\n');
}