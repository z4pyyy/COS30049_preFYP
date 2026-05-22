/**
 * =============================================================================
 *  SFC Digital Park Guide — COCO Class Remapping for Browser Inference
 *  COS30049 Computing Technology Innovation Project
 * =============================================================================
 *
 * PURPOSE:
 *   Maps COCO-80 class detections from the stock YOLOv8n model to the
 *   project's 4-class schema: person, hand, plant, wildlife.
 *
 *   Hands are NOT detected by the COCO model — MediaPipe HandLandmarker
 *   handles hand detection separately.
 *
 * USAGE:
 *   Import this module in your YOLO inference worker or post-processing code.
 *   After running inference, pass raw detections through `remapCocoDetections()`
 *   to filter and translate to your class schema.
 *
 * INTEGRATION:
 *   Replace your current class label lookup with this module.
 *   Your inference pipeline stays the same — only the output mapping changes.
 * =============================================================================
 */

// ---------------------------------------------------------------------------
//  Your project's class schema
// ---------------------------------------------------------------------------

export type SfcClass = "person" | "plant" | "wildlife";

export interface SfcDetection {
  /** Your project class name */
  className: SfcClass;
  /** Original COCO class name (for debugging/logging) */
  cocoClassName: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Bounding box [x1, y1, x2, y2] in pixel coordinates */
  bbox: [number, number, number, number];
}

// ---------------------------------------------------------------------------
//  COCO class ID → SFC class mapping
// ---------------------------------------------------------------------------

/**
 * Maps relevant COCO class IDs to your project's class names.
 * Only classes that map to your schema are included.
 * All other COCO classes (car, chair, laptop, etc.) are ignored.
 */
const COCO_TO_SFC: Record<number, { sfcClass: SfcClass; cocoName: string }> = {
  // Person
  0: { sfcClass: "person", cocoName: "person" },

  // Wildlife — all COCO animal classes
  14: { sfcClass: "wildlife", cocoName: "bird" },
  15: { sfcClass: "wildlife", cocoName: "cat" },
  16: { sfcClass: "wildlife", cocoName: "dog" },
  17: { sfcClass: "wildlife", cocoName: "horse" },
  18: { sfcClass: "wildlife", cocoName: "sheep" },
  19: { sfcClass: "wildlife", cocoName: "cow" },
  20: { sfcClass: "wildlife", cocoName: "elephant" },
  21: { sfcClass: "wildlife", cocoName: "bear" },
  22: { sfcClass: "wildlife", cocoName: "zebra" },
  23: { sfcClass: "wildlife", cocoName: "giraffe" },

  // Plant
  58: { sfcClass: "plant", cocoName: "potted plant" },
};

/**
 * Set of all COCO class IDs we care about.
 * Used for fast filtering during post-processing.
 */
const RELEVANT_CLASS_IDS = new Set(Object.keys(COCO_TO_SFC).map(Number));

// ---------------------------------------------------------------------------
//  Full COCO-80 class names (for reference / debugging)
// ---------------------------------------------------------------------------

export const COCO_CLASS_NAMES: string[] = [
  "person", "bicycle", "car", "motorcycle", "airplane",
  "bus", "train", "truck", "boat", "traffic light",
  "fire hydrant", "stop sign", "parking meter", "bench", "bird",
  "cat", "dog", "horse", "sheep", "cow",
  "elephant", "bear", "zebra", "giraffe", "backpack",
  "umbrella", "handbag", "tie", "suitcase", "frisbee",
  "skis", "snowboard", "sports ball", "kite", "baseball bat",
  "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle",
  "wine glass", "cup", "fork", "knife", "spoon",
  "bowl", "banana", "apple", "sandwich", "orange",
  "broccoli", "carrot", "hot dog", "pizza", "donut",
  "cake", "chair", "couch", "potted plant", "bed",
  "dining table", "toilet", "tv", "laptop", "mouse",
  "remote", "keyboard", "cell phone", "microwave", "oven",
  "toaster", "sink", "refrigerator", "book", "clock",
  "vase", "scissors", "teddy bear", "hair drier", "toothbrush",
];

// ---------------------------------------------------------------------------
//  Remapping functions
// ---------------------------------------------------------------------------

/**
 * Remap a single COCO detection to the SFC schema.
 * Returns null if the COCO class is not relevant to the project.
 */
export function remapSingleDetection(
  cocoClassId: number,
  confidence: number,
  bbox: [number, number, number, number]
): SfcDetection | null {
  const mapping = COCO_TO_SFC[cocoClassId];
  if (!mapping) return null;

  return {
    className: mapping.sfcClass,
    cocoClassName: mapping.cocoName,
    confidence,
    bbox,
  };
}

/**
 * Check if a COCO class ID is relevant to the project.
 * Use this for early filtering before full post-processing.
 */
export function isRelevantClass(cocoClassId: number): boolean {
  return RELEVANT_CLASS_IDS.has(cocoClassId);
}

// ---------------------------------------------------------------------------
//  YOLOv8 output post-processing with COCO remapping
// ---------------------------------------------------------------------------

/**
 * YOLOv8 ONNX output shape: [1, 84, 8400]
 *   - 84 = 4 (bbox: cx, cy, w, h) + 80 (class scores)
 *   - 8400 = number of detection anchors
 *
 * This function:
 *   1. Transposes the output to [8400, 84]
 *   2. For each anchor, finds the best class score
 *   3. Filters by confidence threshold
 *   4. Maps COCO class IDs to SFC schema (ignoring irrelevant classes)
 *   5. Applies NMS to reduce overlapping boxes
 *   6. Returns clean SfcDetection[] array
 */
export function processYolov8Output(
  output: Float32Array,
  confidenceThreshold: number = 0.45,
  iouThreshold: number = 0.5,
  imgWidth: number = 640,
  imgHeight: number = 640
): SfcDetection[] {
  const numClasses = 80;
  const numAnchors = 8400;
  const numFields = 4 + numClasses; // 84

  // ── Step 1: Extract candidate detections ──────────────────────────────

  const candidates: Array<{
    cocoClassId: number;
    confidence: number;
    bbox: [number, number, number, number];
  }> = [];

  for (let i = 0; i < numAnchors; i++) {
    // YOLOv8 output is [1, 84, 8400] — column-major per anchor
    const cx = output[0 * numAnchors + i];
    const cy = output[1 * numAnchors + i];
    const w  = output[2 * numAnchors + i];
    const h  = output[3 * numAnchors + i];

    // Find best class
    let bestClassId = 0;
    let bestScore = 0;

    for (let c = 0; c < numClasses; c++) {
      const score = output[(4 + c) * numAnchors + i];
      if (score > bestScore) {
        bestScore = score;
        bestClassId = c;
      }
    }

    // Filter: confidence threshold AND relevant class
    if (bestScore < confidenceThreshold) continue;
    if (!isRelevantClass(bestClassId)) continue;

    // Convert cx,cy,w,h → x1,y1,x2,y2
    const x1 = cx - w / 2;
    const y1 = cy - h / 2;
    const x2 = cx + w / 2;
    const y2 = cy + h / 2;

    candidates.push({
      cocoClassId: bestClassId,
      confidence: bestScore,
      bbox: [x1, y1, x2, y2],
    });
  }

  // ── Step 2: NMS per SFC class ─────────────────────────────────────────

  // Group by SFC class for per-class NMS
  const byClass = new Map<SfcClass, typeof candidates>();

  for (const det of candidates) {
    const mapping = COCO_TO_SFC[det.cocoClassId]!;
    const group = byClass.get(mapping.sfcClass) || [];
    group.push(det);
    byClass.set(mapping.sfcClass, group);
  }

  const results: SfcDetection[] = [];

  for (const [sfcClass, dets] of byClass) {
    // Sort by confidence descending
    dets.sort((a, b) => b.confidence - a.confidence);

    const keep: boolean[] = new Array(dets.length).fill(true);

    for (let i = 0; i < dets.length; i++) {
      if (!keep[i]) continue;

      for (let j = i + 1; j < dets.length; j++) {
        if (!keep[j]) continue;

        if (computeIoU(dets[i].bbox, dets[j].bbox) > iouThreshold) {
          keep[j] = false;
        }
      }
    }

    for (let i = 0; i < dets.length; i++) {
      if (!keep[i]) continue;

      const mapping = COCO_TO_SFC[dets[i].cocoClassId]!;
      results.push({
        className: sfcClass,
        cocoClassName: mapping.cocoName,
        confidence: dets[i].confidence,
        bbox: dets[i].bbox,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
//  YOLO26 output post-processing (NMS-free model)
// ---------------------------------------------------------------------------

/**
 * YOLO26 end-to-end output shape: [1, N, 6]
 *   - N = number of detections (variable, already NMS-filtered)
 *   - 6 = [x1, y1, x2, y2, confidence, class_id]
 *
 * Much simpler than YOLOv8 — no NMS needed.
 * Uncomment and use this if you switch to yolo26n_coco.onnx
 */
export function processYolo26Output(
  output: Float32Array,
  numDetections: number,
  confidenceThreshold: number = 0.45
): SfcDetection[] {
  const results: SfcDetection[] = [];

  for (let i = 0; i < numDetections; i++) {
    const offset = i * 6;
    const x1 = output[offset + 0];
    const y1 = output[offset + 1];
    const x2 = output[offset + 2];
    const y2 = output[offset + 3];
    const confidence = output[offset + 4];
    const classId = Math.round(output[offset + 5]);

    if (confidence < confidenceThreshold) continue;
    if (!isRelevantClass(classId)) continue;

    const mapping = COCO_TO_SFC[classId]!;
    results.push({
      className: mapping.sfcClass,
      cocoClassName: mapping.cocoName,
      confidence,
      bbox: [x1, y1, x2, y2],
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
//  Utility: IoU calculation for NMS
// ---------------------------------------------------------------------------

function computeIoU(
  a: [number, number, number, number],
  b: [number, number, number, number]
): number {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]);
  const y2 = Math.min(a[3], b[3]);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (intersection === 0) return 0;

  const areaA = (a[2] - a[0]) * (a[3] - a[1]);
  const areaB = (b[2] - b[0]) * (b[3] - b[1]);
  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}

// ---------------------------------------------------------------------------
//  Helper: Get display color for SFC class (matches your existing UI legend)
// ---------------------------------------------------------------------------

export function getSfcClassColor(className: SfcClass): string {
  switch (className) {
    case "person":  return "#F97316"; // orange — matches your UI
    case "plant":   return "#22C55E"; // green
    case "wildlife": return "#EF4444"; // red
    default:        return "#6B7280"; // gray fallback
  }
}

// ---------------------------------------------------------------------------
//  Helper: Get display label for rendering on canvas overlay
// ---------------------------------------------------------------------------

export function getDetectionLabel(det: SfcDetection): string {
  // Show the specific animal/plant type for richer UI
  // e.g., "wildlife (elephant) 87%" instead of just "wildlife 87%"
  const pct = `${Math.round(det.confidence * 100)}%`;

  if (det.className === "wildlife") {
    return `${det.cocoClassName} ${pct}`;
  }

  return `${det.className} ${pct}`;
}