const MAX_GENERATED_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PROVIDER_RESPONSE_BYTES = 12 * 1024 * 1024;

export type AiEmployeeCreativeRequest = {
  prompt: string;
  productId?: string;
};

export function parseAiEmployeeCreativeRequest(input: unknown): AiEmployeeCreativeRequest | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const body = input as Record<string, unknown>;
  const keys = Object.keys(body);
  if (
    keys.some(key => key !== 'prompt' && key !== 'productId')
    || !Object.hasOwn(body, 'prompt')
    || typeof body.prompt !== 'string'
    || (Object.hasOwn(body, 'productId') && typeof body.productId !== 'string')
  ) return null;
  const prompt = body.prompt.trim();
  const productId = typeof body.productId === 'string' ? body.productId.trim() : undefined;
  if (
    !prompt
    || prompt.length > 800
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(prompt)
    || (productId !== undefined && (!productId || productId.length > 120))
  ) return null;
  return { prompt, ...(productId ? { productId } : {}) };
}

export function getLocalImageGenerationUrl(configured = process.env.LOCAL_IMAGE_GENERATION_URL): URL {
  const url = new URL(configured?.trim() || 'http://127.0.0.1:7860');
  if (
    url.protocol !== 'http:'
    || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash
  ) throw new Error('AI_EMPLOYEE_IMAGE_PROVIDER_MUST_USE_LOOPBACK');
  return url;
}

export function parseLocalImageResponse(raw: string): Buffer {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('AI_EMPLOYEE_IMAGE_PROVIDER_RESPONSE_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI_EMPLOYEE_IMAGE_PROVIDER_RESPONSE_INVALID');
  }
  const images = (parsed as { images?: unknown }).images;
  if (!Array.isArray(images) || typeof images[0] !== 'string') {
    throw new Error('AI_EMPLOYEE_IMAGE_PROVIDER_RESPONSE_INVALID');
  }
  const base64 = images[0].replace(/^data:image\/(?:png|jpeg|webp);base64,/, '');
  if (
    !base64
    || base64.length > Math.ceil(MAX_GENERATED_IMAGE_BYTES * 4 / 3) + 4
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)
  ) throw new Error('AI_EMPLOYEE_IMAGE_PROVIDER_IMAGE_INVALID');
  const image = Buffer.from(base64, 'base64');
  if (!image.length || image.length > MAX_GENERATED_IMAGE_BYTES || image.toString('base64') !== base64) {
    throw new Error('AI_EMPLOYEE_IMAGE_PROVIDER_IMAGE_INVALID');
  }
  return image;
}

async function readBoundedResponse(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new Error('AI_EMPLOYEE_IMAGE_PROVIDER_RESPONSE_TOO_LARGE');
  }
  if (!response.body) throw new Error('AI_EMPLOYEE_IMAGE_PROVIDER_RESPONSE_INVALID');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_PROVIDER_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('AI_EMPLOYEE_IMAGE_PROVIDER_RESPONSE_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, byteLength).toString('utf8');
}

export async function generateLocalCreativeImage(
  prompt: string,
  fetcher: typeof fetch = fetch,
  configuredUrl = process.env.LOCAL_IMAGE_GENERATION_URL,
  timeoutMs = 120_000
): Promise<Buffer> {
  const baseUrl = getLocalImageGenerationUrl(configuredUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(new URL('/sdapi/v1/txt2img', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        prompt: `Original commercial fashion product photography. No text, logo, or watermark. ${prompt}`,
        negative_prompt: 'text, watermark, logo, low resolution, distorted product, extra limbs',
        width: 1024,
        height: 1024,
        steps: 25,
        cfg_scale: 6.5,
        batch_size: 1,
        n_iter: 1,
        save_images: false
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`AI_EMPLOYEE_IMAGE_PROVIDER_HTTP_${response.status}`);
    return parseLocalImageResponse(await readBoundedResponse(response));
  } finally {
    clearTimeout(timeout);
  }
}
