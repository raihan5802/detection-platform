# CVAT-like Image Annotation Tool

This tool supports:
- **Bounding Box & Polygon** annotations
- **Escape key** to cancel current in-progress annotation
- Keyboard shortcuts:
  - **M** = Move
  - **B** = Bounding Box
  - **P** = Polygon
  - **S** = Save
  - **Esc** = Cancel in-progress shape
  - **ArrowRight** = Next image
  - **ArrowLeft** = Prev image
- Preview only the **first 5** selected images
- **Fill** shapes with label color (semi-transparent)
- **Export** to COCO, YOLO, **Pascal VOC**, etc.

## Quick Start

```bash
cd annotation-tool
npm install
npm start      # React dev server at http://localhost:3000
node server.js # Express server at http://localhost:4000
```

Then go to [http://localhost:3000](http://localhost:3000).  
Enjoy!
