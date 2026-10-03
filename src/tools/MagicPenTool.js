/**
 * MagicPenTool - compatibility wrapper.
 *
 * The real implementation now lives in the modular `smartpen/` folder
 * (SmartPenInput, StrokeManager, StrokeSmoother, ShapeRecognizer,
 * GeometryCorrector, ShapeRenderer, SmartPenController).
 * This wrapper keeps the old `autoCorrectStroke(stroke)` API working.
 */

import { SmartPenController } from '../smartpen/smartpencontroller.JS';

const controller = new SmartPenController();

export class MagicPenTool {
  /** Returns the corrected stroke when a shape is recognised, else the stroke. */
  static autoCorrectStroke(stroke, { unit = 1 } = {}) {
    if (!stroke || !stroke.points || stroke.points.length < 3) return stroke;
    const result = controller.analyze(stroke, { unit });
    return result.corrected || stroke;
  }
}