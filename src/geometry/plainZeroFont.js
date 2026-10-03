/**
 * Plain-zero numbers on the canvas.
 *
 * Monospace fonts (JetBrains Mono, Consolas, Courier ...) draw a 0 with a dot
 * or slash inside, which looks like an 8 from a distance. Canvas text cannot be
 * styled with CSS, so this patches a 2D context: whenever drawing code sets a
 * monospace `ctx.font`, the font family is swapped for Inter (plain zero).
 * Size and weight are kept. Fonts that are not monospace are left untouched.
 */

const MONOSPACE =
  /jetbrains|consolas|monospace|courier|menlo|monaco|fira|source code|ibm plex mono|roboto mono|space mono|\bmono\b/i;

const PLAIN_FAMILY = 'Inter, Arial, sans-serif';

export function plainZeroFont(font) {
  if (typeof font !== 'string' || !MONOSPACE.test(font)) return font;

  // keep "[style] [weight] <size>[/line-height]" and replace the family list
  return font.replace(
    /(\d+(?:\.\d+)?(?:px|pt|em|rem))(?:\/\S+)?\s+.*$/i,
    `$1 ${PLAIN_FAMILY}`
  );
}

export function usePlainZeroFont(ctx) {
  if (!ctx || ctx.__plainZeroFont) return ctx;

  const descriptor = Object.getOwnPropertyDescriptor(
    CanvasRenderingContext2D.prototype,
    'font'
  );
  if (!descriptor) return ctx;

  Object.defineProperty(ctx, 'font', {
    configurable: true,
    enumerable: true,
    get() {
      return descriptor.get.call(this);
    },
    set(value) {
      descriptor.set.call(this, plainZeroFont(value));
    }
  });

  ctx.__plainZeroFont = true;
  return ctx;
}