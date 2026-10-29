function rgbToHsl(red: number, green: number, blue: number) {
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

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] = section < 1
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
    Math.round((red + offset) * 255),
    Math.round((green + offset) * 255),
    Math.round((blue + offset) * 255)
  ];
}

function parseHexColor(color: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('GARMENT_RECOLOR_COLOR_INVALID');
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16)
  ];
}

function validateRecolorInput(
  source: Uint8ClampedArray,
  maskAlpha: Uint8ClampedArray,
  targetColor: string
): { target: ReturnType<typeof rgbToHsl> } {
  if (source.length === 0 || source.length % 4 !== 0 || maskAlpha.length !== source.length / 4) {
    throw new Error('GARMENT_RECOLOR_IMAGE_INVALID');
  }
  const [targetRed, targetGreen, targetBlue] = parseHexColor(targetColor);
  return { target: rgbToHsl(targetRed, targetGreen, targetBlue) };
}

function recolorPixelRange(
  source: Uint8ClampedArray,
  maskAlpha: Uint8ClampedArray,
  target: ReturnType<typeof rgbToHsl>,
  output: Uint8ClampedArray,
  startPixel: number,
  endPixel: number
) {
  for (let pixel = startPixel; pixel < endPixel; pixel += 1) {
    const offset = pixel * 4;
    const amount = maskAlpha[pixel] / 255;
    if (amount === 0 || source[offset + 3] === 0) continue;

    const original = rgbToHsl(source[offset], source[offset + 1], source[offset + 2]);
    const hueDelta = ((target.hue - original.hue + 540) % 360) - 180;
    const mappedLightness = Math.max(0, Math.min(1, target.lightness + (original.lightness - 0.5) * 0.85));
    const [red, green, blue] = hslToRgb(
      (original.hue + hueDelta * amount + 360) % 360,
      original.saturation + (target.saturation - original.saturation) * amount,
      original.lightness + (mappedLightness - original.lightness) * amount
    );
    output[offset] = red;
    output[offset + 1] = green;
    output[offset + 2] = blue;
  }
}

export function recolorMaskedPixels(
  source: Uint8ClampedArray,
  maskAlpha: Uint8ClampedArray,
  targetColor: string
): Uint8ClampedArray {
  const { target } = validateRecolorInput(source, maskAlpha, targetColor);
  const output = new Uint8ClampedArray(source);
  recolorPixelRange(source, maskAlpha, target, output, 0, maskAlpha.length);
  return output;
}

export async function recolorMaskedPixelsAsync(
  source: Uint8ClampedArray,
  maskAlpha: Uint8ClampedArray,
  targetColor: string,
  chunkSize = 50_000,
  yieldControl: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 0))
): Promise<Uint8ClampedArray> {
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) {
    throw new Error('GARMENT_RECOLOR_CHUNK_SIZE_INVALID');
  }
  const { target } = validateRecolorInput(source, maskAlpha, targetColor);
  const output = new Uint8ClampedArray(source);
  for (let startPixel = 0; startPixel < maskAlpha.length; startPixel += chunkSize) {
    recolorPixelRange(source, maskAlpha, target, output, startPixel, Math.min(startPixel + chunkSize, maskAlpha.length));
    if (startPixel + chunkSize < maskAlpha.length) await yieldControl();
  }

  return output;
}
