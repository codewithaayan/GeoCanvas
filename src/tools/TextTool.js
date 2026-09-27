export class TextTool {
  static createText(
    x,
    y,
    text = 'Math Note',
    options = {}
  ) {
    return {
      id:
        'text_' +
        Date.now() +
        '_' +
        Math.random()
          .toString(36)
          .slice(2, 7),

      type: 'text',

      x,
      y,

      text,

      fontSize:
        options.fontSize || 18,

      color:
        options.color ||
        '#1e3a8a',

      fontFamily:
        options.fontFamily ||
        'Inter, Arial, sans-serif'
    };
  }

  static measure(
    ctx,
    textObj
  ) {
    if (!textObj) {
      return {
        width: 0,
        height: 0
      };
    }

    const fontSize =
      textObj.fontSize || 18;

    ctx.font =
      `${fontSize}px ${
        textObj.fontFamily ||
        'Inter, Arial, sans-serif'
      }`;

    const lines =
      String(
        textObj.text || ''
      ).split('\n');

    const width =
      Math.max(
        0,
        ...lines.map(
          line =>
            ctx.measureText(
              line
            ).width
        )
      );

    const lineHeight =
      fontSize * 1.3;

    return {
      width,
      height:
        lines.length *
        lineHeight
    };
  }

  static hitTest(
    textObj,
    point,
    ctx
  ) {
    if (
      !textObj ||
      !ctx
    ) {
      return null;
    }

    const size =
      TextTool.measure(
        ctx,
        textObj
      );

    const padding = 8;

    if (
      point.x >=
        textObj.x -
          padding &&
      point.x <=
        textObj.x +
          size.width +
          padding &&
      point.y >=
        textObj.y -
          padding &&
      point.y <=
        textObj.y +
          size.height +
          padding
    ) {
      return {
        part: 'body'
      };
    }

    return null;
  }

  static drawText(
    ctx,
    textObj,
    isSelected = false
  ) {
    if (
      !textObj ||
      !textObj.text
    ) {
      return;
    }

    ctx.save();

    const fontSize =
      textObj.fontSize || 18;

    ctx.font =
      `${fontSize}px ${
        textObj.fontFamily ||
        'Inter, Arial, sans-serif'
      }`;

    ctx.fillStyle =
      textObj.color ||
      '#1e3a8a';

    ctx.textBaseline =
      'top';

    ctx.textAlign =
      'left';

    const lines =
      String(
        textObj.text
      ).split('\n');

    const lineHeight =
      fontSize * 1.3;

    lines.forEach(
      (line, index) => {
        ctx.fillText(
          line,
          textObj.x,
          textObj.y +
            index *
              lineHeight
        );
      }
    );

    if (isSelected) {
      const size =
        TextTool.measure(
          ctx,
          textObj
        );

      ctx.strokeStyle =
        '#2563eb';

      ctx.lineWidth = 1;

      ctx.setLineDash([
        4,
        3
      ]);

      ctx.strokeRect(
        textObj.x - 5,
        textObj.y - 5,
        size.width + 10,
        size.height + 10
      );

      ctx.setLineDash([]);
    }

    ctx.restore();
  }
}