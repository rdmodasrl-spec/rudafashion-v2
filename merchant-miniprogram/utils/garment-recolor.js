function rgbToHsl(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (maximum === r) hue = ((g - b) / delta) % 6;
    else if (maximum === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return { hue, saturation, lightness };
}

function hslToRgb(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const rgb = section < 1
    ? [chroma, secondary, 0]
    : section < 2
      ? [secondary, chroma, 0]
      : section < 3
        ? [0, chroma, secondary]
        : section < 4
          ? [0, secondary, chroma]
          : section < 5
            ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const offset = lightness - chroma / 2;
  return [
    Math.round((rgb[0] + offset) * 255),
    Math.round((rgb[1] + offset) * 255),
    Math.round((rgb[2] + offset) * 255)
  ];
}

function recolorMaskedPixels(source, maskAlpha, targetColor) {
  if (!source.length || source.length % 4 !== 0 || maskAlpha.length !== source.length / 4) {
    throw new Error('GARMENT_RECOLOR_IMAGE_INVALID');
  }
  if (!/^#[0-9a-f]{6}$/i.test(targetColor)) throw new Error('GARMENT_RECOLOR_COLOR_INVALID');
  const target = rgbToHsl(
    Number.parseInt(targetColor.slice(1, 3), 16),
    Number.parseInt(targetColor.slice(3, 5), 16),
    Number.parseInt(targetColor.slice(5, 7), 16)
  );
  const output = new Uint8ClampedArray(source);

  for (let pixel = 0; pixel < maskAlpha.length; pixel += 1) {
    const offset = pixel * 4;
    const amount = maskAlpha[pixel] / 255;
    if (amount === 0 || source[offset + 3] === 0) continue;
    const original = rgbToHsl(source[offset], source[offset + 1], source[offset + 2]);
    const hueDelta = ((target.hue - original.hue + 540) % 360) - 180;
    const mappedLightness = Math.max(0, Math.min(1, target.lightness + (original.lightness - 0.5) * 0.85));
    const rgb = hslToRgb(
      (original.hue + hueDelta * amount + 360) % 360,
      original.saturation + (target.saturation - original.saturation) * amount,
      original.lightness + (mappedLightness - original.lightness) * amount
    );
    output[offset] = rgb[0];
    output[offset + 1] = rgb[1];
    output[offset + 2] = rgb[2];
  }

  return output;
}

module.exports = { recolorMaskedPixels };
