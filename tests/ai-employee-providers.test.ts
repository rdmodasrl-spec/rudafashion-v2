import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FAL_VIRTUAL_TRY_ON_MODEL_ID,
  generateAiEmployeeImage,
  generateAiEmployeeAdvancedText,
  generateAiEmployeeText,
  generateAiEmployeeVisionText,
  generateDeepSeekText,
  generateGeminiVisionText,
  generateOpenAiText,
  getDefaultAiEmployeeProviderSettings,
  getAiProviderCircuitSnapshots,
  getAiEmployeeInferenceMetrics,
  getFalImageUrl,
  isValidFalModelId,
  setAiEmployeeProviderSettings,
  testAiEmployeeLocalInference,
  toPublicAiEmployeeProviderSettings,
  validateAiEmployeeProviderSettings
} from '../src/server/aiEmployeeProviders';

test('virtual try-on is pinned to the dedicated FASHN model', () => {
  assert.equal(FAL_VIRTUAL_TRY_ON_MODEL_ID, 'fal-ai/fashn/tryon/v1.6');
});

test('default provider settings remain valid and keep local workflows', () => {
  const settings = getDefaultAiEmployeeProviderSettings();

  assert.equal(validateAiEmployeeProviderSettings(settings), true);
  assert.equal(settings.reasoning.provider, 'ollama');
  assert.equal(settings.vision.provider, 'ollama');
  assert.equal(settings.image.provider, 'automatic1111');
});

test('local model diagnostics execute text and vision inference without sensitive input', async () => {
  const originalFetch = globalThis.fetch;
  const originalOllamaBaseUrl = process.env.OLLAMA_BASE_URL;
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>
    });
    return new Response(JSON.stringify({ message: { content: '{"reply":"local inference passed"}' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const reasoning = await testAiEmployeeLocalInference('reasoning', 'qwen2.5:7b');
    const vision = await testAiEmployeeLocalInference('vision', 'llava:latest');
    assert.deepEqual([reasoning.success, vision.success], [true, true]);
    assert.ok(reasoning.durationMs >= 0 && vision.durationMs >= 0);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].body.model, 'qwen2.5:7b');
    assert.equal(requests[1].body.model, 'llava:latest');
    assert.doesNotMatch(JSON.stringify(requests), /password|customer|sensitive/i);
    const visionMessages = requests[1].body.messages as Array<{ images?: string[] }>;
    assert.equal(visionMessages[1].images?.length, 1);

    globalThis.fetch = async () => new Response(JSON.stringify({ message: { content: 'not JSON' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    const failed = await testAiEmployeeLocalInference('reasoning', 'qwen2.5:7b');
    assert.equal(failed.success, false);
    assert.equal(failed.errorCode, 'AI_EMPLOYEE_LOCAL_INFERENCE_FAILED');
    assert.ok(getAiEmployeeInferenceMetrics()['probe:reasoning:ollama'].failures >= 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOllamaBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = originalOllamaBaseUrl;
  }
});

test('Ollama text and vision requests use the configured models', async () => {
  const settings = getDefaultAiEmployeeProviderSettings();
  settings.reasoning.model = 'qwen2.5:14b';
  settings.vision.model = 'qwen2.5vl:7b';
  setAiEmployeeProviderSettings(settings);
  const originalFetch = globalThis.fetch;
  const originalOllamaBaseUrl = process.env.OLLAMA_BASE_URL;
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>
    });
    return new Response(JSON.stringify({ message: { content: '{"ok":true}' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const format = {
      type: 'object' as const,
      properties: {
        ok: { type: 'boolean' },
        reply: { type: 'string', maxLength: 80 },
        nested: {
          type: 'object',
          properties: { label: { type: 'string', maxLength: 20 } }
        }
      },
      required: ['ok'],
      additionalProperties: false as const
    };
    await generateAiEmployeeText('prompt', 'system', format);
    await generateAiEmployeeVisionText('prompt', 'system', Buffer.from('image'), format);

    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(requests[0].body.model, 'qwen2.5:14b');
    assert.equal(requests[1].body.model, 'qwen2.5vl:7b');
    const normalizedFormat = {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        reply: { type: 'string' },
        nested: { type: 'object', properties: { label: { type: 'string' } } }
      },
      required: ['ok'],
      additionalProperties: false
    };
    assert.deepEqual(requests[0].body.format, normalizedFormat);
    assert.deepEqual(requests[1].body.format, normalizedFormat);
    const messages = requests[1].body.messages as Array<{ role: string; images?: string[] }>;
    assert.deepEqual(messages[1].images, [Buffer.from('image').toString('base64')]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOllamaBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = originalOllamaBaseUrl;
    setAiEmployeeProviderSettings(getDefaultAiEmployeeProviderSettings());
  }
});

test('DeepSeek fallback uses the configured local default model, not the cloud model ID', async () => {
  const settings = getDefaultAiEmployeeProviderSettings();
  settings.reasoning.provider = 'deepseek';
  settings.reasoning.model = 'deepseek-flash';
  settings.reasoning.apiKey = 'deepseek-test-secret';
  settings.reasoning.fallbackToLocal = true;
  setAiEmployeeProviderSettings(settings);
  const originalFetch = globalThis.fetch;
  const originalOllamaBaseUrl = process.env.OLLAMA_BASE_URL;
  const requests: Array<{ url: string; body: Record<string, unknown> | null }> = [];
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null
    });
    if (url === 'https://api.deepseek.com/chat/completions') {
      return new Response('{}', { status: 503 });
    }
    return new Response(JSON.stringify({ message: { content: '{"ok":true}' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const result = await generateAiEmployeeText('prompt', 'system', {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false
    });
    assert.equal(result, '{"ok":true}');
    assert.equal(requests[0].url, 'https://api.deepseek.com/chat/completions');
    assert.equal(requests[1].url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(requests[1].body?.model, getDefaultAiEmployeeProviderSettings().reasoning.model);
    assert.notEqual(requests[1].body?.model, 'deepseek-flash');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOllamaBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = originalOllamaBaseUrl;
    setAiEmployeeProviderSettings(getDefaultAiEmployeeProviderSettings());
  }
});

test('a failing DeepSeek route opens its circuit and keeps configured local fallback available', async () => {
  const settings = getDefaultAiEmployeeProviderSettings();
  settings.reasoning.provider = 'deepseek';
  settings.reasoning.model = 'deepseek-flash';
  settings.reasoning.apiKey = 'deepseek-circuit-test-secret';
  settings.reasoning.fallbackToLocal = true;
  setAiEmployeeProviderSettings(settings);
  const originalFetch = globalThis.fetch;
  const originalOllamaBaseUrl = process.env.OLLAMA_BASE_URL;
  let providerCalls = 0;
  let localCalls = 0;
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
  globalThis.fetch = async input => {
    if (String(input) === 'https://api.deepseek.com/chat/completions') {
      providerCalls += 1;
      return new Response('provider unavailable', { status: 503 });
    }
    localCalls += 1;
    return new Response(JSON.stringify({ message: { content: '{"ok":true}' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const format = {
      type: 'object' as const,
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false as const
    };
    for (let index = 0; index < 4; index += 1) {
      assert.equal(await generateAiEmployeeText('prompt', 'system', format), '{"ok":true}');
    }
    assert.equal(providerCalls, 3);
    assert.equal(localCalls, 4);
    assert.equal(getAiProviderCircuitSnapshots().reasoning_deepseek.state, 'open');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOllamaBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = originalOllamaBaseUrl;
    setAiEmployeeProviderSettings(getDefaultAiEmployeeProviderSettings());
  }
});

test('non-retryable DeepSeek authentication errors do not open the provider circuit', async () => {
  const settings = getDefaultAiEmployeeProviderSettings();
  settings.reasoning.provider = 'deepseek';
  settings.reasoning.model = 'deepseek-flash';
  settings.reasoning.apiKey = 'deepseek-auth-test-secret';
  settings.reasoning.fallbackToLocal = true;
  setAiEmployeeProviderSettings(settings);
  const originalFetch = globalThis.fetch;
  const originalOllamaBaseUrl = process.env.OLLAMA_BASE_URL;
  let providerCalls = 0;
  let localCalls = 0;
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
  globalThis.fetch = async input => {
    if (String(input) === 'https://api.deepseek.com/chat/completions') {
      providerCalls += 1;
      return new Response('invalid credentials', { status: 401 });
    }
    localCalls += 1;
    return new Response(JSON.stringify({ message: { content: '{"ok":true}' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const format = {
      type: 'object' as const,
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false as const
    };
    for (let index = 0; index < 4; index += 1) {
      assert.equal(await generateAiEmployeeText('prompt', 'system', format), '{"ok":true}');
    }
    assert.equal(providerCalls, 4);
    assert.equal(localCalls, 4);
    assert.deepEqual(getAiProviderCircuitSnapshots().reasoning_deepseek, {
      state: 'closed',
      consecutiveFailures: 0,
      retryAfterMs: 0
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOllamaBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = originalOllamaBaseUrl;
    setAiEmployeeProviderSettings(getDefaultAiEmployeeProviderSettings());
  }
});

test('provider circuits count timeout, rate-limit, and server errors but not other client errors', async () => {
  const originalFetch = globalThis.fetch;
  const originalOllamaBaseUrl = process.env.OLLAMA_BASE_URL;
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
  let providerCalls = 0;
  let localCalls = 0;
  let providerStatus = 503;
  globalThis.fetch = async input => {
    if (String(input) === 'https://api.deepseek.com/chat/completions') {
      providerCalls += 1;
      return new Response('provider error', { status: providerStatus });
    }
    localCalls += 1;
    return new Response(JSON.stringify({ message: { content: '{"ok":true}' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const format = {
      type: 'object' as const,
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false as const
    };
    for (const { status, shouldTrip } of [
      { status: 400, shouldTrip: false },
      { status: 408, shouldTrip: true },
      { status: 429, shouldTrip: true },
      { status: 500, shouldTrip: true },
      { status: 599, shouldTrip: true }
    ]) {
      const settings = getDefaultAiEmployeeProviderSettings();
      settings.reasoning.provider = 'deepseek';
      settings.reasoning.model = 'deepseek-flash';
      settings.reasoning.apiKey = 'deepseek-status-test-secret';
      settings.reasoning.fallbackToLocal = true;
      setAiEmployeeProviderSettings(settings);
      providerStatus = status;
      providerCalls = 0;
      localCalls = 0;

      for (let index = 0; index < 4; index += 1) {
        assert.equal(await generateAiEmployeeText('prompt', 'system', format), '{"ok":true}');
      }

      assert.equal(providerCalls, shouldTrip ? 3 : 4, `HTTP ${status} provider call count`);
      assert.equal(localCalls, 4, `HTTP ${status} local fallback count`);
      assert.equal(
        getAiProviderCircuitSnapshots().reasoning_deepseek.state,
        shouldTrip ? 'open' : 'closed',
        `HTTP ${status} circuit state`
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOllamaBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = originalOllamaBaseUrl;
    setAiEmployeeProviderSettings(getDefaultAiEmployeeProviderSettings());
  }
});

test('Gemini vision failure falls back to the local vision model instead of the cloud model ID', async () => {
  const settings = getDefaultAiEmployeeProviderSettings();
  settings.vision.provider = 'gemini';
  settings.vision.model = 'gemini-2.5-flash';
  settings.vision.apiKey = 'gemini-circuit-test-secret';
  settings.vision.fallbackToLocal = true;
  setAiEmployeeProviderSettings(settings);
  const originalFetch = globalThis.fetch;
  const originalOllamaBaseUrl = process.env.OLLAMA_BASE_URL;
  const requests: Array<{ url: string; model?: string }> = [];
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://generativelanguage.googleapis.com/')) {
      requests.push({ url });
      return new Response('provider unavailable', { status: 503 });
    }
    const body = JSON.parse(String(init?.body)) as { model?: string };
    requests.push({ url, model: body.model });
    return new Response(JSON.stringify({ message: { content: '{"ok":true}' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const result = await generateAiEmployeeVisionText(
      'Describe this item',
      'Return JSON only',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
        required: ['ok'],
        additionalProperties: false
      }
    );
    assert.equal(result, '{"ok":true}');
    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /^https:\/\/generativelanguage\.googleapis\.com\//);
    assert.equal(requests[1].url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(requests[1].model, 'llava:latest');
    assert.notEqual(requests[1].model, 'gemini-2.5-flash');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOllamaBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = originalOllamaBaseUrl;
    setAiEmployeeProviderSettings(getDefaultAiEmployeeProviderSettings());
  }
});

test('Fal credentials are omitted from public settings', () => {
  const settings = getDefaultAiEmployeeProviderSettings();
  settings.image.provider = 'fal';
  settings.image.apiKey = 'fal-secret-example';

  const publicSettings = toPublicAiEmployeeProviderSettings(settings);
  const serialized = JSON.stringify(publicSettings);

  assert.equal(publicSettings.falApiKeyConfigured, true);
  assert.equal(serialized.includes('fal-secret-example'), false);
  assert.equal(Object.hasOwn(publicSettings.image, 'apiKey'), false);
});

test('all provider credentials are omitted from public settings', () => {
  const settings = getDefaultAiEmployeeProviderSettings();
  settings.reasoning.provider = 'deepseek';
  settings.reasoning.apiKey = 'deepseek-secret-example';
  settings.advancedReasoning.apiKey = 'openai-secret-example';
  settings.vision.provider = 'gemini';
  settings.vision.apiKey = 'gemini-secret-example';
  settings.image.provider = 'fal';
  settings.image.apiKey = 'fal-secret-example';

  const publicSettings = toPublicAiEmployeeProviderSettings(settings);
  const serialized = JSON.stringify(publicSettings);

  assert.equal(publicSettings.deepseekApiKeyConfigured, true);
  assert.equal(publicSettings.openaiApiKeyConfigured, true);
  assert.equal(publicSettings.geminiApiKeyConfigured, true);
  assert.equal(publicSettings.falApiKeyConfigured, true);
  assert.equal(serialized.includes('secret-example'), false);
  assert.equal(Object.hasOwn(publicSettings.reasoning, 'apiKey'), false);
  assert.equal(Object.hasOwn(publicSettings.advancedReasoning, 'apiKey'), false);
  assert.equal(Object.hasOwn(publicSettings.vision, 'apiKey'), false);
  assert.equal(Object.hasOwn(publicSettings.image, 'apiKey'), false);
});

test('Fal image generation cannot be enabled without a configured key', () => {
  const settings = getDefaultAiEmployeeProviderSettings();
  settings.image.provider = 'fal';

  assert.equal(validateAiEmployeeProviderSettings(settings), false);
});

test('Fal model IDs reject URLs and malformed paths', () => {
  assert.equal(isValidFalModelId('fal-ai/flux/schnell'), true);
  assert.equal(isValidFalModelId('https://fal.ai/api'), false);
  assert.equal(isValidFalModelId('fal-ai//flux'), false);
  assert.equal(isValidFalModelId('../private-endpoint'), false);
});

test('Fal image response URLs are restricted to Fal-owned HTTPS hosts', () => {
  assert.equal(
    getFalImageUrl({ images: [{ url: 'https://v3.fal.media/files/generated.webp' }] }),
    'https://v3.fal.media/files/generated.webp'
  );
  assert.equal(
    getFalImageUrl({ images: [{ url: 'https://cdn.fashn.ai/generated.png' }] }),
    'https://cdn.fashn.ai/generated.png'
  );
  assert.throws(() => getFalImageUrl({ images: [{ url: 'http://127.0.0.1/admin' }] }), /AI_EMPLOYEE_FAL_IMAGE_RESPONSE_INVALID/);
  assert.throws(() => getFalImageUrl({ images: [{ url: 'https://attacker.example/generated.webp' }] }), /AI_EMPLOYEE_FAL_IMAGE_RESPONSE_INVALID/);
  assert.throws(() => getFalImageUrl({ images: [{ url: 'https://cdn.fashn.ai.attacker.example/generated.png' }] }), /AI_EMPLOYEE_FAL_IMAGE_RESPONSE_INVALID/);
  assert.throws(() => getFalImageUrl({ images: [{ url: 'https://fal.media:8443/generated.webp' }] }), /AI_EMPLOYEE_FAL_IMAGE_RESPONSE_INVALID/);
});

test('Fal generation reports missing server-side credentials', async () => {
  const settings = getDefaultAiEmployeeProviderSettings();
  settings.image.provider = 'fal';
  settings.image.fallbackToLocal = false;
  settings.image.apiKey = '';
  setAiEmployeeProviderSettings(settings);

  try {
    await assert.rejects(generateAiEmployeeImage('product photo'), /AI_EMPLOYEE_FAL_KEY_NOT_CONFIGURED/);
  } finally {
    setAiEmployeeProviderSettings(getDefaultAiEmployeeProviderSettings());
  }
});

test('DeepSeek sends the configured model to the fixed OpenAI-compatible endpoint', async () => {
  const settings = getDefaultAiEmployeeProviderSettings().reasoning;
  settings.provider = 'deepseek';
  settings.model = 'deepseek-flash';
  settings.apiKey = 'deepseek-test-secret';
  let requestedUrl = '';
  let requestHeaders: HeadersInit | undefined;
  let requestBody = '';

  const result = await generateDeepSeekText(
    settings,
    'Return the test JSON.',
    'Return JSON only.',
    {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false
    },
    1000,
    async (input, init) => {
      requestedUrl = String(input);
      requestHeaders = init?.headers;
      requestBody = String(init?.body);
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  );

  assert.equal(requestedUrl, 'https://api.deepseek.com/chat/completions');
  assert.equal(new Headers(requestHeaders).get('authorization'), 'Bearer deepseek-test-secret');
  assert.match(requestBody, /"model":"deepseek-flash"/);
  assert.match(requestBody, /"thinking":\{"type":"enabled"\}/);
  assert.match(requestBody, /"reasoning_effort":"high"/);
  assert.equal(result, '{"ok":true}');
});

test('DeepSeek provider errors never include response bodies or credentials', async () => {
  const settings = getDefaultAiEmployeeProviderSettings().reasoning;
  settings.provider = 'deepseek';
  settings.model = 'deepseek-flash';
  settings.apiKey = 'deepseek-test-secret';

  await assert.rejects(
    generateDeepSeekText(
      settings,
      'test',
      'test',
      { type: 'object', properties: {}, required: [], additionalProperties: false },
      1000,
      async () => new Response('sensitive provider response', { status: 401 })
    ),
    error => error instanceof Error
      && error.message === 'AI_EMPLOYEE_DEEPSEEK_HTTP_401'
      && !error.message.includes('deepseek-test-secret')
  );
});

test('OpenAI uses the fixed endpoint and keeps the API key out of the URL and body', async () => {
  const settings = getDefaultAiEmployeeProviderSettings().advancedReasoning;
  settings.apiKey = 'openai-test-secret';
  let requestedUrl = '';
  let requestHeaders: HeadersInit | undefined;
  let requestBody = '';
  const result = await generateOpenAiText(
    settings,
    'Return the test JSON.',
    'Return JSON only.',
    {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false
    },
    1000,
    async (input, init) => {
      requestedUrl = String(input);
      requestHeaders = init?.headers;
      requestBody = String(init?.body);
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  );

  assert.equal(requestedUrl, 'https://api.openai.com/v1/chat/completions');
  assert.equal(new Headers(requestHeaders).get('authorization'), 'Bearer openai-test-secret');
  assert.match(requestBody, /"model":"gpt-4\.1-mini"/);
  assert.doesNotMatch(requestedUrl + requestBody, /openai-test-secret/);
  assert.equal(result, '{"ok":true}');
});

test('OpenAI errors never expose provider response bodies or credentials', async () => {
  const settings = getDefaultAiEmployeeProviderSettings().advancedReasoning;
  settings.apiKey = 'openai-test-secret';

  await assert.rejects(
    generateOpenAiText(
      settings,
      'test',
      'test',
      { type: 'object', properties: {}, required: [], additionalProperties: false },
      1000,
      async () => new Response('provider echoed openai-test-secret', { status: 401 })
    ),
    error => error instanceof Error
      && error.message === 'AI_EMPLOYEE_OPENAI_HTTP_401'
      && !error.message.includes('openai-test-secret')
  );
});

test('Gemini sends image bytes and Gemini-compatible response schema without exposing its key', async () => {
  const settings = getDefaultAiEmployeeProviderSettings().vision;
  settings.provider = 'gemini';
  settings.model = 'gemini-2.5-flash';
  settings.apiKey = 'gemini-test-secret';
  let requestedUrl = '';
  let requestHeaders: HeadersInit | undefined;
  let requestBody: Record<string, unknown> = {};
  const result = await generateGeminiVisionText(
    settings,
    'Describe the image.',
    'Return JSON only.',
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    {
      type: 'object',
      properties: {
        description: { type: 'string', maxLength: 80 },
        labels: { type: 'array', items: { type: 'string' } }
      },
      required: ['description'],
      additionalProperties: false
    },
    1000,
    async (input, init) => {
      requestedUrl = String(input);
      requestHeaders = init?.headers;
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"description":"red dress","labels":["dress"]}' }] } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  );

  assert.equal(requestedUrl, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
  assert.equal(new Headers(requestHeaders).get('x-goog-api-key'), 'gemini-test-secret');
  assert.doesNotMatch(requestedUrl, /gemini-test-secret/);
  const contents = requestBody.contents as Array<{ parts: Array<Record<string, unknown>> }>;
  assert.equal(contents[0].parts[1].inlineData && typeof contents[0].parts[1].inlineData, 'object');
  assert.equal((requestBody.generationConfig as { responseSchema: { type: string; properties: Record<string, { type: string }> } }).responseSchema.type, 'OBJECT');
  assert.equal((requestBody.generationConfig as { responseSchema: { properties: Record<string, { type: string }> } }).responseSchema.properties.labels.type, 'ARRAY');
  assert.equal(result, '{"description":"red dress","labels":["dress"]}');
});

test('advanced planning falls back to the primary provider when OpenAI is not configured', async () => {
  const settings = getDefaultAiEmployeeProviderSettings();
  settings.advancedReasoning.apiKey = '';
  settings.advancedReasoning.fallbackToLocal = true;
  setAiEmployeeProviderSettings(settings);
  const originalFetch = globalThis.fetch;
  const originalOllamaBaseUrl = process.env.OLLAMA_BASE_URL;
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
  globalThis.fetch = async () => new Response(JSON.stringify({ message: { content: '{"ok":true}' } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
  try {
    const result = await generateAiEmployeeAdvancedText('prompt', 'system', {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false
    });
    assert.equal(result, '{"ok":true}');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOllamaBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = originalOllamaBaseUrl;
    setAiEmployeeProviderSettings(getDefaultAiEmployeeProviderSettings());
  }
});
