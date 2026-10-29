import assert from 'node:assert/strict';
import test from 'node:test';
import { recolorMaskedPixels, recolorMaskedPixelsAsync } from '../src/shared/garmentRecolor';

test('recolors only selected pixels and preserves source alpha', () => {
  const source = new Uint8ClampedArray([
    40, 80, 200, 255,
    80, 160, 200, 255,
    30, 50, 70, 0
  ]);
  const output = recolorMaskedPixels(source, new Uint8ClampedArray([255, 0, 255]), '#ef4444');

  assert.notDeepEqual(Array.from(output.slice(0, 3)), Array.from(source.slice(0, 3)));
  assert.deepEqual(Array.from(output.slice(4, 8)), Array.from(source.slice(4, 8)));
  assert.deepEqual(Array.from(output.slice(8, 12)), Array.from(source.slice(8, 12)));
});

test('supports feathered mask coverage without changing untouched pixels', () => {
  const source = new Uint8ClampedArray([40, 80, 200, 255, 80, 160, 200, 255]);
  const output = recolorMaskedPixels(source, new Uint8ClampedArray([128, 0]), '#ef4444');

  assert.notDeepEqual(Array.from(output.slice(0, 3)), Array.from(source.slice(0, 3)));
  assert.deepEqual(Array.from(output.slice(4, 8)), Array.from(source.slice(4, 8)));
});

test('maps the requested shade while retaining garment highlights and shadows', () => {
  const source = new Uint8ClampedArray([
    128, 128, 128, 255,
    40, 40, 40, 255,
    220, 220, 220, 255
  ]);
  const output = recolorMaskedPixels(source, new Uint8ClampedArray([255, 255, 255]), '#ef4444');
  const lightness = (pixels: Uint8ClampedArray) => {
    const maximum = Math.max(pixels[0], pixels[1], pixels[2]);
    const minimum = Math.min(pixels[0], pixels[1], pixels[2]);
    return (maximum + minimum) / 2;
  };

  assert.ok(Math.abs(lightness(output) / 255 - 0.602) < 0.01);
  assert.ok(lightness(output.slice(8, 12)) > lightness(output.slice(4, 8)));
});

test('neutral target colors remove garment tint instead of forcing saturation', () => {
  const output = recolorMaskedPixels(
    new Uint8ClampedArray([40, 80, 200, 255]),
    new Uint8ClampedArray([255]),
    '#252525'
  );

  assert.equal(output[0], output[1]);
  assert.equal(output[1], output[2]);
});

test('chunked recoloring matches the synchronous output and yields between chunks', async () => {
  const source = new Uint8ClampedArray([
    40, 80, 200, 255,
    80, 160, 200, 255,
    30, 50, 70, 0
  ]);
  const mask = new Uint8ClampedArray([255, 128, 255]);
  let yields = 0;
  const output = await recolorMaskedPixelsAsync(source, mask, '#286447', 1, async () => { yields += 1; });

  assert.deepEqual(output, recolorMaskedPixels(source, mask, '#286447'));
  assert.equal(yields, 2);
  assert.deepEqual(Array.from(source), [40, 80, 200, 255, 80, 160, 200, 255, 30, 50, 70, 0]);
});

test('rejects mismatched image data and malformed target colors', () => {
  assert.throws(
    () => recolorMaskedPixels(new Uint8ClampedArray([1, 2, 3]), new Uint8ClampedArray(), '#ef4444'),
    { message: 'GARMENT_RECOLOR_IMAGE_INVALID' }
  );
  assert.throws(
    () => recolorMaskedPixels(new Uint8ClampedArray([1, 2, 3, 255]), new Uint8ClampedArray([255]), 'red'),
    { message: 'GARMENT_RECOLOR_COLOR_INVALID' }
  );
  assert.rejects(
    () => recolorMaskedPixelsAsync(new Uint8ClampedArray([1, 2, 3, 255]), new Uint8ClampedArray([255]), '#ef4444', 0),
    { message: 'GARMENT_RECOLOR_CHUNK_SIZE_INVALID' }
  );
});
