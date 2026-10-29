import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateLocalCreativeImage,
  getLocalImageGenerationUrl,
  parseAiEmployeeCreativeRequest,
  parseLocalImageResponse
} from '../src/server/aiEmployeeCreative';

test('creative generation request accepts only a bounded prompt and optional product ID', () => {
  assert.deepEqual(parseAiEmployeeCreativeRequest({
    prompt: '  Product lifestyle image  ',
    productId: 'product-1'
  }), { prompt: 'Product lifestyle image', productId: 'product-1' });
  assert.deepEqual(parseAiEmployeeCreativeRequest({ prompt: 'Make a clean catalog image' }), {
    prompt: 'Make a clean catalog image'
  });
  assert.equal(parseAiEmployeeCreativeRequest(null), null);
  assert.equal(parseAiEmployeeCreativeRequest({ prompt: '   ' }), null);
  assert.equal(parseAiEmployeeCreativeRequest({ prompt: 'x'.repeat(801) }), null);
  assert.equal(parseAiEmployeeCreativeRequest({ prompt: 'safe', productId: '' }), null);
  assert.equal(parseAiEmployeeCreativeRequest({ prompt: 'safe', extra: true }), null);
});

test('image generation URL is restricted to local HTTP services', () => {
  assert.equal(getLocalImageGenerationUrl(undefined).origin, 'http://127.0.0.1:7860');
  assert.equal(getLocalImageGenerationUrl('http://localhost:7860').hostname, 'localhost');
  assert.throws(() => getLocalImageGenerationUrl('https://127.0.0.1:7860'), /MUST_USE_LOOPBACK/);
  assert.throws(() => getLocalImageGenerationUrl('http://192.168.1.20:7860'), /MUST_USE_LOOPBACK/);
  assert.throws(() => getLocalImageGenerationUrl('http://127.0.0.1:7860/path'), /MUST_USE_LOOPBACK/);
  assert.throws(() => getLocalImageGenerationUrl('http://user:pass@127.0.0.1:7860'), /MUST_USE_LOOPBACK/);
});

test('provider image parser accepts bounded base64 and rejects malformed or oversized data', () => {
  const image = Buffer.from('local-image-data');
  assert.deepEqual(parseLocalImageResponse(JSON.stringify({ images: [image.toString('base64')] })), image);
  assert.throws(() => parseLocalImageResponse('not json'), /RESPONSE_INVALID/);
  assert.throws(() => parseLocalImageResponse(JSON.stringify({ images: ['not-base64!'] })), /IMAGE_INVALID/);
  assert.throws(() => parseLocalImageResponse(JSON.stringify({ images: ['A'.repeat(12 * 1024 * 1024)] })), /IMAGE_INVALID/);
});

test('local image adapter sends fixed generation settings to the local provider', async () => {
  let requestedUrl = '';
  let requestBody: Record<string, unknown> | undefined;
  const image = Buffer.from('provider-image');
  const fakeFetch: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ images: [image.toString('base64')] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  assert.deepEqual(
    await generateLocalCreativeImage('commercial brief', fakeFetch, 'http://127.0.0.1:7860'),
    image
  );
  assert.equal(requestedUrl, 'http://127.0.0.1:7860/sdapi/v1/txt2img');
  assert.equal(requestBody?.width, 1024);
  assert.equal(requestBody?.height, 1024);
  assert.equal(requestBody?.batch_size, 1);
  assert.equal(requestBody?.save_images, false);
  assert.match(String(requestBody?.prompt), /commercial brief/);
});

test('local image adapter surfaces provider HTTP and response errors', async () => {
  const httpErrorFetch: typeof fetch = async () => new Response('unavailable', { status: 503 });
  await assert.rejects(
    generateLocalCreativeImage('brief', httpErrorFetch, 'http://127.0.0.1:7860'),
    /AI_EMPLOYEE_IMAGE_PROVIDER_HTTP_503/
  );

  const invalidResponseFetch: typeof fetch = async () => new Response('invalid', { status: 200 });
  await assert.rejects(
    generateLocalCreativeImage('brief', invalidResponseFetch, 'http://127.0.0.1:7860'),
    /AI_EMPLOYEE_IMAGE_PROVIDER_RESPONSE_INVALID/
  );
});
