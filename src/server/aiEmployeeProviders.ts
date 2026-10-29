import { createFalClient } from '@fal-ai/client';
export const FAL_VIRTUAL_TRY_ON_MODEL_ID = 'fal-ai/fashn/tryon/v1.6';
import {
  generateMerchantAiEmployeeText,
  generateMerchantAiEmployeeVisionText
} from './merchantSupportAi';
import { generateLocalCreativeImage, getLocalImageGenerationUrl } from './aiEmployeeCreative';
import { aiProviderCircuitBreaker } from './aiProviderCircuitBreaker';
import { getAiEmployeeInferenceMetrics, measureAiEmployeeInference } from './aiEmployeeMetrics';

export type AiTextProviderSettings = {
  provider: 'ollama' | 'deepseek' | 'openai' | 'gemini';
  model: string;
  apiKey: string;
  fallbackToLocal: boolean;
};

export type AiAdvancedReasoningProviderSettings = AiTextProviderSettings & {
  provider: 'openai';
};

export type AiImageProviderSettings = {
  provider: 'automatic1111' | 'fal';
  model: string;
  apiKey: string;
  fallbackToLocal: boolean;
};

export type AiEmployeeProviderSettings = {
  reasoning: AiTextProviderSettings;
  advancedReasoning: AiAdvancedReasoningProviderSettings;
  vision: AiTextProviderSettings;
  image: AiImageProviderSettings;
};

const defaultTextProvider: AiTextProviderSettings = {
  provider: 'ollama',
  model: 'qwen2.5:7b',
  apiKey: '',
  fallbackToLocal: true
};

const defaultVisionProvider: AiTextProviderSettings = {
  provider: 'ollama',
  model: 'llava:latest',
  apiKey: '',
  fallbackToLocal: true
};

const defaultAdvancedReasoningProvider: AiAdvancedReasoningProviderSettings = {
  provider: 'openai',
  model: 'gpt-4.1-mini',
  apiKey: '',
  fallbackToLocal: true
};

const defaultImageProvider: AiImageProviderSettings = {
  provider: 'automatic1111',
  model: 'local-stable-diffusion',
  apiKey: '',
  fallbackToLocal: false
};

let runtimeSettings: AiEmployeeProviderSettings = {
  reasoning: { ...defaultTextProvider },
  advancedReasoning: { ...defaultAdvancedReasoningProvider },
  vision: { ...defaultVisionProvider },
  image: { ...defaultImageProvider }
};

export function getDefaultAiEmployeeProviderSettings(): AiEmployeeProviderSettings {
  return {
    reasoning: { ...defaultTextProvider },
    advancedReasoning: { ...defaultAdvancedReasoningProvider },
    vision: { ...defaultVisionProvider },
    image: { ...defaultImageProvider }
  };
}

export type PublicAiEmployeeProviderSettings = {
  deepseekApiKeyConfigured: boolean;
  falApiKeyConfigured: boolean;
  openaiApiKeyConfigured: boolean;
  geminiApiKeyConfigured: boolean;
  reasoning: Omit<AiTextProviderSettings, 'apiKey'>;
  advancedReasoning: Omit<AiAdvancedReasoningProviderSettings, 'apiKey'>;
  vision: Omit<AiTextProviderSettings, 'apiKey'>;
  image: Omit<AiImageProviderSettings, 'apiKey'>;
};

export function toPublicAiEmployeeProviderSettings(
  settings: AiEmployeeProviderSettings
): PublicAiEmployeeProviderSettings {
  const { apiKey: _deepseekKey, ...reasoning } = settings.reasoning;
  const { apiKey: _openaiKey, ...advancedReasoning } = settings.advancedReasoning;
  const { apiKey: _visionKey, ...vision } = settings.vision;
  const { apiKey: _falKey, ...image } = settings.image;
  return {
    deepseekApiKeyConfigured: Boolean(settings.reasoning.apiKey),
    falApiKeyConfigured: Boolean(settings.image.apiKey),
    openaiApiKeyConfigured: Boolean(settings.advancedReasoning.apiKey),
    geminiApiKeyConfigured: Boolean(settings.vision.apiKey),
    reasoning,
    advancedReasoning,
    vision,
    image
  };
}

export function setAiEmployeeProviderSettings(settings: AiEmployeeProviderSettings): void {
  runtimeSettings = {
    reasoning: { ...settings.reasoning },
    advancedReasoning: { ...settings.advancedReasoning },
    vision: { ...settings.vision },
    image: { ...settings.image }
  };
  aiProviderCircuitBreaker.clear();
}

export function getAiEmployeeProviderSettings(): AiEmployeeProviderSettings {
  return {
    reasoning: { ...runtimeSettings.reasoning },
    advancedReasoning: { ...runtimeSettings.advancedReasoning },
    vision: { ...runtimeSettings.vision },
    image: { ...runtimeSettings.image }
  };
}

export function getAiProviderCircuitSnapshots() {
  return aiProviderCircuitBreaker.getSnapshots();
}

function shouldCountProviderFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const httpStatus = error.message.match(/^AI_EMPLOYEE_(?:DEEPSEEK|OPENAI|GEMINI)_HTTP_(\d{3})$/);
  if (httpStatus) {
    const status = Number(httpStatus[1]);
    return status === 408 || status === 429 || (status >= 500 && status < 600);
  }
  return !/^AI_EMPLOYEE_[A-Z_]*(?:NOT_CONFIGURED|MODEL_INVALID|KEY_NOT_CONFIGURED|IMAGE_INVALID)$/.test(error.message);
}

export function isValidFalModelId(value: string): boolean {
  return value.length <= 120
    && /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/.test(value);
}

export function validateAiEmployeeProviderSettings(settings: AiEmployeeProviderSettings): boolean {
  const reasoning = settings.reasoning;
  const advancedReasoning = settings.advancedReasoning;
  const vision = settings.vision;
  if (
    (reasoning.provider !== 'ollama' && reasoning.provider !== 'deepseek')
    || (reasoning.provider === 'deepseek'
      ? !['deepseek-flash', 'deepseek-v4-pro'].includes(reasoning.model) || reasoning.apiKey.length === 0
      : !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(reasoning.model))
    || reasoning.apiKey.length > 4000
    || typeof reasoning.fallbackToLocal !== 'boolean'
    || advancedReasoning.provider !== 'openai'
    || !isValidOpenAiModelId(advancedReasoning.model)
    || advancedReasoning.apiKey.length > 4000
    || typeof advancedReasoning.fallbackToLocal !== 'boolean'
    || (!advancedReasoning.apiKey && !advancedReasoning.fallbackToLocal)
    || (vision.provider !== 'ollama' && vision.provider !== 'gemini')
    || (vision.provider === 'gemini'
      ? !isValidGeminiModelId(vision.model) || vision.apiKey.length === 0
      : !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(vision.model))
    || vision.apiKey.length > 4000
    || typeof vision.fallbackToLocal !== 'boolean'
  ) return false;
  return (
    (settings.image.provider === 'automatic1111' || settings.image.provider === 'fal')
    && (settings.image.provider === 'fal'
      ? isValidFalModelId(settings.image.model)
      : /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(settings.image.model))
    && settings.image.apiKey.length <= 4000
    && (settings.image.provider !== 'fal' || settings.image.apiKey.length > 0)
    && typeof settings.image.fallbackToLocal === 'boolean'
  );
}

export function isValidOpenAiModelId(value: string): boolean {
  return value.length <= 120
    && /^[a-z0-9][a-z0-9._-]*$/.test(value);
}

export function isValidGeminiModelId(value: string): boolean {
  return value.length <= 120
    && /^gemini-[a-z0-9][a-z0-9._-]*$/.test(value);
}

function getSupportedImageMimeType(image: Buffer): string {
  if (image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff) return 'image/jpeg';
  if (
    image.length >= 8
    && image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return 'image/png';
  if (image.length >= 12 && image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  throw new Error('AI_EMPLOYEE_IMAGE_INVALID');
}

function createFal(apiKey: string) {
  if (!apiKey) throw new Error('AI_EMPLOYEE_FAL_KEY_NOT_CONFIGURED');
  return createFalClient({ credentials: apiKey });
}

async function readDeepSeekResponse(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`AI_EMPLOYEE_DEEPSEEK_HTTP_${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('AI_EMPLOYEE_DEEPSEEK_RESPONSE_INVALID');
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > 2 * 1024 * 1024) {
      await reader.cancel();
      throw new Error('AI_EMPLOYEE_DEEPSEEK_RESPONSE_TOO_LARGE');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8')) as unknown;
  } catch {
    throw new Error('AI_EMPLOYEE_DEEPSEEK_RESPONSE_INVALID');
  }
}

export async function generateDeepSeekText(
  settings: AiTextProviderSettings,
  prompt: string,
  systemPrompt: string,
  responseFormat: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false },
  timeoutMs = 30_000,
  fetcher: typeof fetch = fetch
): Promise<string> {
  if (settings.provider !== 'deepseek' || !settings.apiKey) {
    throw new Error('AI_EMPLOYEE_DEEPSEEK_NOT_CONFIGURED');
  }
  if (!['deepseek-flash', 'deepseek-v4-pro'].includes(settings.model)) {
    throw new Error('AI_EMPLOYEE_DEEPSEEK_MODEL_INVALID');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: `${systemPrompt}\n\nReturn a JSON object matching this schema: ${JSON.stringify(responseFormat)}` },
          { role: 'user', content: prompt }
        ],
        thinking: { type: 'enabled' },
        reasoning_effort: 'high',
        max_tokens: 2048,
        response_format: { type: 'json_object' },
        stream: false
      }),
      signal: controller.signal
    });
    const payload = await readDeepSeekResponse(response);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('AI_EMPLOYEE_DEEPSEEK_RESPONSE_INVALID');
    }
    const choices = (payload as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') {
      throw new Error('AI_EMPLOYEE_DEEPSEEK_RESPONSE_INVALID');
    }
    const content = (choices[0] as { message?: { content?: unknown } }).message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('AI_EMPLOYEE_DEEPSEEK_RESPONSE_INVALID');
    }
    return content;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('AI_EMPLOYEE_DEEPSEEK_')) throw error;
    throw new Error('AI_EMPLOYEE_DEEPSEEK_REQUEST_FAILED');
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonProviderResponse(response: Response, provider: 'OPENAI' | 'GEMINI'): Promise<unknown> {
  const prefix = `AI_EMPLOYEE_${provider}`;
  if (!response.ok) throw new Error(`${prefix}_HTTP_${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error(`${prefix}_RESPONSE_INVALID`);
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > 2 * 1024 * 1024) {
      await reader.cancel();
      throw new Error(`${prefix}_RESPONSE_TOO_LARGE`);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8')) as unknown;
  } catch {
    throw new Error(`${prefix}_RESPONSE_INVALID`);
  }
}

function getProviderJsonText(payload: unknown, provider: 'OPENAI' | 'GEMINI'): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`AI_EMPLOYEE_${provider}_RESPONSE_INVALID`);
  }
  let content: unknown;
  if (provider === 'OPENAI') {
    const choices = (payload as { choices?: unknown }).choices;
    if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
      content = (choices[0] as { message?: { content?: unknown } }).message?.content;
    }
  } else {
    const candidates = (payload as { candidates?: unknown }).candidates;
    if (Array.isArray(candidates) && candidates[0] && typeof candidates[0] === 'object') {
      const parts = (candidates[0] as { content?: { parts?: unknown } }).content?.parts;
      if (Array.isArray(parts)) content = parts
        .filter((part): part is { text: string } => Boolean(part) && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string')
        .map(part => part.text)
        .join('');
    }
  }
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error(`AI_EMPLOYEE_${provider}_RESPONSE_INVALID`);
  }
  return content;
}

export async function generateOpenAiText(
  settings: AiTextProviderSettings,
  prompt: string,
  systemPrompt: string,
  responseFormat: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false },
  timeoutMs = 30_000,
  fetcher: typeof fetch = fetch
): Promise<string> {
  if (!settings.apiKey) throw new Error('AI_EMPLOYEE_OPENAI_NOT_CONFIGURED');
  if (!isValidOpenAiModelId(settings.model)) throw new Error('AI_EMPLOYEE_OPENAI_MODEL_INVALID');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: `${systemPrompt}\n\nReturn a JSON object matching this schema: ${JSON.stringify(responseFormat)}` },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 2048,
        response_format: { type: 'json_object' },
        stream: false
      }),
      signal: controller.signal
    });
    return getProviderJsonText(await readJsonProviderResponse(response, 'OPENAI'), 'OPENAI');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('AI_EMPLOYEE_OPENAI_')) throw error;
    throw new Error('AI_EMPLOYEE_OPENAI_REQUEST_FAILED');
  } finally {
    clearTimeout(timeout);
  }
}

function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const rawType = schema.type;
  const types = Array.isArray(rawType) ? rawType.filter((type): type is string => typeof type === 'string') : [];
  const type = typeof rawType === 'string' ? rawType : types.find(value => value !== 'null');
  const mappedType = type ? ({
    object: 'OBJECT',
    array: 'ARRAY',
    string: 'STRING',
    number: 'NUMBER',
    integer: 'INTEGER',
    boolean: 'BOOLEAN'
  } as const)[type as 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean'] : undefined;
  if (!mappedType) throw new Error('AI_EMPLOYEE_GEMINI_SCHEMA_INVALID');
  const converted: Record<string, unknown> = { type: mappedType };
  if (types.includes('null')) converted.nullable = true;
  if (typeof schema.description === 'string') converted.description = schema.description.slice(0, 500);
  if (Array.isArray(schema.enum) && schema.enum.every(value => ['string', 'number', 'boolean'].includes(typeof value))) {
    converted.enum = schema.enum;
  }
  if (typeof schema.maxLength === 'number' && Number.isInteger(schema.maxLength) && schema.maxLength > 0) {
    converted.maxLength = schema.maxLength;
  }
  if (Array.isArray(schema.required) && schema.required.every(value => typeof value === 'string')) {
    converted.required = schema.required;
  }
  if (schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)) {
    converted.items = toGeminiSchema(schema.items as Record<string, unknown>);
  }
  if (schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)) {
    converted.properties = Object.fromEntries(
      Object.entries(schema.properties as Record<string, unknown>).map(([key, value]) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('AI_EMPLOYEE_GEMINI_SCHEMA_INVALID');
        }
        return [key, toGeminiSchema(value as Record<string, unknown>)];
      })
    );
  }
  return converted;
}

export async function generateGeminiVisionText(
  settings: AiTextProviderSettings,
  prompt: string,
  systemPrompt: string,
  image: Buffer,
  responseFormat: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false },
  timeoutMs = 90_000,
  fetcher: typeof fetch = fetch
): Promise<string> {
  if (!settings.apiKey) throw new Error('AI_EMPLOYEE_GEMINI_NOT_CONFIGURED');
  if (!isValidGeminiModelId(settings.model)) throw new Error('AI_EMPLOYEE_GEMINI_MODEL_INVALID');
  const mimeType = getSupportedImageMimeType(image);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:generateContent`, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'x-goog-api-key': settings.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{
          role: 'user',
          parts: [
            { text: `${prompt}\n\nReturn a JSON object matching this schema: ${JSON.stringify(responseFormat)}` },
            { inlineData: { mimeType, data: image.toString('base64') } }
          ]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: toGeminiSchema(responseFormat)
        }
      }),
      signal: controller.signal
    });
    return getProviderJsonText(await readJsonProviderResponse(response, 'GEMINI'), 'GEMINI');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('AI_EMPLOYEE_GEMINI_')) throw error;
    throw new Error('AI_EMPLOYEE_GEMINI_REQUEST_FAILED');
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateAiEmployeeText(
  prompt: string,
  systemPrompt: string,
  responseFormat: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false },
  timeoutMs = 20_000
): Promise<string> {
  const settings = runtimeSettings.reasoning;
  if (settings.provider === 'deepseek') {
    try {
      return await aiProviderCircuitBreaker.execute(
        'reasoning_deepseek',
        () => measureAiEmployeeInference(
          'reasoning:deepseek',
          () => generateDeepSeekText(settings, prompt, systemPrompt, responseFormat, timeoutMs)
        ),
        shouldCountProviderFailure
      );
    } catch (error) {
      if (!settings.fallbackToLocal) throw error;
      console.error('[ai-employee-deepseek-fallback]', error instanceof Error ? error.message : 'unknown error');
    }
  }
  if (settings.provider === 'openai') {
    try {
      return await aiProviderCircuitBreaker.execute(
        'reasoning_openai',
        () => measureAiEmployeeInference(
          'reasoning:openai',
          () => generateOpenAiText(settings, prompt, systemPrompt, responseFormat, timeoutMs)
        ),
        shouldCountProviderFailure
      );
    } catch (error) {
      if (!settings.fallbackToLocal) throw error;
      console.error('[ai-employee-openai-fallback]', error instanceof Error ? error.message : 'unknown error');
    }
  }
  const localModel = settings.provider === 'deepseek' ? defaultTextProvider.model : settings.model;
  return measureAiEmployeeInference(
    'reasoning:ollama',
    () => generateMerchantAiEmployeeText(prompt, systemPrompt, responseFormat, timeoutMs, localModel)
  );
}

export async function generateAiEmployeeAdvancedText(
  prompt: string,
  systemPrompt: string,
  responseFormat: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false },
  timeoutMs = 20_000
): Promise<string> {
  const settings = runtimeSettings.advancedReasoning;
  if (!settings.apiKey) {
    if (!settings.fallbackToLocal) throw new Error('AI_EMPLOYEE_OPENAI_NOT_CONFIGURED');
    return generateAiEmployeeText(prompt, systemPrompt, responseFormat, timeoutMs);
  }
  try {
    return await aiProviderCircuitBreaker.execute(
      'advanced_openai',
      () => measureAiEmployeeInference(
        'advanced-reasoning:openai',
        () => generateOpenAiText(settings, prompt, systemPrompt, responseFormat, timeoutMs)
      ),
      shouldCountProviderFailure
    );
  } catch (error) {
    if (!settings.fallbackToLocal) throw error;
    console.error('[ai-employee-openai-planner-fallback]', error instanceof Error ? error.message : 'unknown error');
    return generateAiEmployeeText(prompt, systemPrompt, responseFormat, timeoutMs);
  }
}

export async function generateAiEmployeeVisionText(
  prompt: string,
  systemPrompt: string,
  image: Buffer,
  responseFormat: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false },
  timeoutMs = 90_000
): Promise<string> {
  const settings = runtimeSettings.vision;
  if (settings.provider === 'gemini') {
    try {
      return await aiProviderCircuitBreaker.execute(
        'vision_gemini',
        () => measureAiEmployeeInference(
          'vision:gemini',
          () => generateGeminiVisionText(settings, prompt, systemPrompt, image, responseFormat, timeoutMs)
        ),
        shouldCountProviderFailure
      );
    } catch (error) {
      if (!settings.fallbackToLocal) throw error;
      console.error('[ai-employee-gemini-fallback]', error instanceof Error ? error.message : 'unknown error');
    }
  }
  const localModel = settings.provider === 'gemini' ? defaultVisionProvider.model : settings.model;
  return measureAiEmployeeInference('vision:ollama', () => generateMerchantAiEmployeeVisionText(
    prompt,
    systemPrompt,
    image,
    responseFormat,
    timeoutMs,
    localModel
  ));
}

export async function testOpenAiConnection(settings: AiAdvancedReasoningProviderSettings): Promise<{ model: string }> {
  await generateOpenAiText(settings, 'Return {"ok":true}.', 'Connection test only. Return JSON with ok true.', {
    type: 'object',
    properties: { ok: { type: 'boolean' } },
    required: ['ok'],
    additionalProperties: false
  }, 20_000);
  return { model: settings.model };
}

export async function testGeminiConnection(settings: AiTextProviderSettings): Promise<{ model: string }> {
  await generateGeminiVisionText(settings, 'Describe this one-pixel test image in one short phrase.', 'Connection test only.', Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/n5sAAAAASUVORK5CYII=',
    'base64'
  ), {
    type: 'object',
    properties: { description: { type: 'string', maxLength: 80 } },
    required: ['description'],
    additionalProperties: false
  }, 30_000);
  return { model: settings.model };
}

export async function testAiEmployeeLocalInference(
  mode: 'reasoning' | 'vision',
  model: string
): Promise<{ success: boolean; durationMs: number; errorCode?: string }> {
  const operation = mode === 'reasoning' ? 'probe:reasoning:ollama' : 'probe:vision:ollama';
  const responseFormat = {
    type: 'object' as const,
    properties: { reply: { type: 'string', maxLength: 80 } },
    required: ['reply'],
    additionalProperties: false as const
  };
  const startedAt = performance.now();
  try {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(model)) {
      throw new Error('AI_EMPLOYEE_LOCAL_MODEL_INVALID');
    }
    await measureAiEmployeeInference(operation, async () => {
      const raw = mode === 'reasoning'
        ? await generateMerchantAiEmployeeText(
          'Return a short JSON reply confirming this local inference test.',
          'This is a local RUDA model self-test. Return a JSON object with a short non-empty reply. Do not include any other text.',
          responseFormat,
          20_000,
          model
        )
        : await generateMerchantAiEmployeeVisionText(
          'Return a short JSON reply confirming this local vision inference test.',
          'This is a local RUDA vision self-test. Return a JSON object with a short non-empty reply. Do not include any other text.',
          Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/n5sAAAAASUVORK5CYII=', 'base64'),
          responseFormat,
          30_000,
          model
        );
      const parsed: unknown = JSON.parse(raw);
      if (
        !parsed || typeof parsed !== 'object' || Array.isArray(parsed)
        || typeof (parsed as { reply?: unknown }).reply !== 'string'
        || !(parsed as { reply: string }).reply.trim()
      ) throw new Error('AI_EMPLOYEE_LOCAL_INFERENCE_INVALID');
    });
    return { success: true, durationMs: Math.round(performance.now() - startedAt) };
  } catch (error) {
    const errorCode = error instanceof Error && /^AI_EMPLOYEE_[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : 'AI_EMPLOYEE_LOCAL_INFERENCE_FAILED';
    return { success: false, durationMs: Math.round(performance.now() - startedAt), errorCode };
  }
}

export { getAiEmployeeInferenceMetrics };

export function getFalImageUrl(data: unknown): string {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('AI_EMPLOYEE_FAL_IMAGE_RESPONSE_INVALID');
  }
  const images = (data as { images?: unknown }).images;
  if (!Array.isArray(images) || !images[0] || typeof images[0] !== 'object') {
    throw new Error('AI_EMPLOYEE_FAL_IMAGE_RESPONSE_INVALID');
  }
  const url = (images[0] as { url?: unknown }).url;
  if (typeof url !== 'string') throw new Error('AI_EMPLOYEE_FAL_IMAGE_RESPONSE_INVALID');
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.port
    || !(
      parsed.hostname === 'cdn.fashn.ai'
      || ['fal.media', 'fal.ai'].some(domain => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`))
    )
  ) throw new Error('AI_EMPLOYEE_FAL_IMAGE_RESPONSE_INVALID');
  return parsed.toString();
}

async function downloadFalImage(url: string): Promise<Buffer> {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!response.ok || !contentType || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    throw new Error('AI_EMPLOYEE_FAL_IMAGE_DOWNLOAD_FAILED');
  }
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 8 * 1024 * 1024) {
    throw new Error('AI_EMPLOYEE_FAL_IMAGE_RESPONSE_TOO_LARGE');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('AI_EMPLOYEE_FAL_IMAGE_DOWNLOAD_FAILED');
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > 8 * 1024 * 1024) {
      await reader.cancel();
      throw new Error('AI_EMPLOYEE_FAL_IMAGE_RESPONSE_TOO_LARGE');
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error('AI_EMPLOYEE_FAL_IMAGE_RESPONSE_TOO_LARGE');
  getSupportedImageMimeType(bytes);
  return bytes;
}

export async function testFalConnection(settings: AiImageProviderSettings): Promise<{ model: string }> {
  if (settings.provider !== 'fal' || !settings.apiKey) {
    throw new Error('AI_EMPLOYEE_FAL_NOT_CONFIGURED');
  }
  if (!isValidFalModelId(settings.model)) {
    throw new Error('AI_EMPLOYEE_FAL_MODEL_INVALID');
  }
  const result = await createFal(settings.apiKey).subscribe(settings.model, {
    input: { prompt: 'a simple red circle on a white background, connection test', image_size: 'square', num_images: 1 },
    startTimeout: 60,
    abortSignal: AbortSignal.timeout(60_000)
  });
  getFalImageUrl(result.data);
  return { model: settings.model };
}

export async function generateAiEmployeeImage(prompt: string): Promise<Buffer> {
  const settings = runtimeSettings.image;
  if (settings.provider === 'automatic1111') {
    getLocalImageGenerationUrl();
    return generateLocalCreativeImage(prompt);
  }
  try {
    return await measureAiEmployeeInference('creative:fal', async () => {
      const result = await aiProviderCircuitBreaker.execute('creative_fal', () =>
        createFal(settings.apiKey).subscribe(settings.model, {
          input: { prompt, image_size: 'square', num_images: 1 },
          startTimeout: 120,
          abortSignal: AbortSignal.timeout(120_000)
        }),
        shouldCountProviderFailure
      );
      return downloadFalImage(getFalImageUrl(result.data));
    });
  } catch (error) {
    if (!settings.fallbackToLocal) {
      throw error instanceof Error && error.message === 'AI_EMPLOYEE_FAL_KEY_NOT_CONFIGURED'
        ? error
        : error instanceof Error && error.message.startsWith('AI_EMPLOYEE_FAL_')
          ? error
          : new Error('AI_EMPLOYEE_FAL_IMAGE_REQUEST_FAILED');
    }
    console.error('[ai-employee-image-fallback]', error instanceof Error ? error.message : 'unknown error');
    return generateLocalCreativeImage(prompt);
  }
}

export async function generateAiEmployeeTryOn(
  personImage: Buffer,
  garmentImage: Buffer,
  category: 'tops' | 'bottoms' | 'one-pieces'
): Promise<Buffer> {
  const settings = runtimeSettings.image;
  if (settings.provider !== 'fal' || !settings.apiKey) {
    throw new Error('AI_EMPLOYEE_FAL_NOT_CONFIGURED');
  }
  const client = createFal(settings.apiKey);
  try {
    return await measureAiEmployeeInference('creative:fal_tryon', async () => {
      const imageUrl = await aiProviderCircuitBreaker.execute('creative_fal_tryon', async () => {
        const personImageUrl = await client.storage.upload(
          new Blob([new Uint8Array(personImage)], { type: getSupportedImageMimeType(personImage) }),
          { lifecycle: { expiresIn: '1d' } }
        );
        const garmentImageUrl = await client.storage.upload(
          new Blob([new Uint8Array(garmentImage)], { type: getSupportedImageMimeType(garmentImage) }),
          { lifecycle: { expiresIn: '1d' } }
        );
        const result = await client.subscribe(FAL_VIRTUAL_TRY_ON_MODEL_ID, {
          input: {
            model_image: personImageUrl,
            garment_image: garmentImageUrl,
            category,
            garment_photo_type: 'auto',
            num_samples: 1
          },
          startTimeout: 120,
          abortSignal: AbortSignal.timeout(120_000)
        });
        return getFalImageUrl(result.data);
      }, shouldCountProviderFailure);
      return downloadFalImage(imageUrl);
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('AI_EMPLOYEE_FAL_')) throw error;
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('AI_EMPLOYEE_FAL_TRYON_TIMEOUT');
    }
    throw new Error('AI_EMPLOYEE_FAL_TRYON_REQUEST_FAILED');
  }
}
