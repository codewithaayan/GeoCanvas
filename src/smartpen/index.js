export { SmartPenInput } from './smartpeninput.js';
export { StrokeManager } from './strokemanager.js';
export { smoothStroke } from './strokesmoother.js';
export { recognizeStroke, SHAPE_LABELS } from './shaperecognizer.js';
export {
  correctGeometry,
  specToPoints,
  transformSpec,
  isClosedSpec,
  SNAP_CONFIG
} from './geometrycorrector.js';
export * as ShapeRenderer from './shaperenderer.js';
export { SmartPenController, CONFIDENCE, MORPH_DURATION } from './smartpencontroller.js';