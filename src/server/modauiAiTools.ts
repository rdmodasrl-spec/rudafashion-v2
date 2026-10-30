import { generateAiEmployeeText } from './aiEmployeeProviders';
import type { ModaGptToolDefinition } from './modagptRuntime';

/**
 * MODAUI AI Tools（appId = modaui-ai-tools）专属工具。
 *
 * 约束（见 docs/engineering/architecture/MODaUI-AI-TOOLS-PLATFORM.md）：
 * - 只登记真实可执行的能力，复用既有 AI 文本 Provider，不新建第二套模型调用。
 * - 工具必须声明 `permission` / `riskLevel` / 超时 / 重试 / 审计策略，经 `createModaGptToolRuntime` 执行。
 * - 未安装应用时这些工具从工具集剔除，但核心 MODAGPT 工具与其它应用工具不受影响。
 */

export const AI_TOOLS_USE_PERMISSION = 'ai.tools.use';
export const AI_TOOLS_APP_ID = 'modaui-ai-tools';

const aiToolsDisplayNames: Record<string, Record<string, string>> = {
  ai_tools_write_copy: {
    zh: '商品文案创作',
    it: 'Testi prodotto',
    en: 'Product copywriting'
  },
  ai_tools_translate: {
    zh: '多语言翻译',
    it: 'Traduzione multilingue',
    en: 'Multilingual translation'
  }
};

export type AiToolsToolHandlers = Record<
  string,
  (tenantId: string, input: unknown, signal: AbortSignal) => Promise<unknown>
>;

const languageEnum = ['it', 'en', 'zh'] as const;
type AiToolsLanguage = (typeof languageEnum)[number];

const copyToolInputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['brief', 'language'],
  properties: {
    brief: { type: 'string', minLength: 1, maxLength: 800 },
    language: { type: 'string', enum: [...languageEnum] },
    tone: { type: 'string', enum: ['premium', 'neutral', 'bold'] },
    channel: { type: 'string', enum: ['product', 'social', 'email'] }
  }
} as const;

const copyToolOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'body', 'hashtags'],
  properties: {
    headline: { type: 'string', minLength: 1, maxLength: 200 },
    body: { type: 'string', minLength: 1, maxLength: 2000 },
    hashtags: { type: 'array', items: { type: 'string', maxLength: 40 } }
  }
} as const;

const translateToolInputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'targetLanguage'],
  properties: {
    text: { type: 'string', minLength: 1, maxLength: 2000 },
    targetLanguage: { type: 'string', enum: [...languageEnum] }
  }
} as const;

const translateToolOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['translation'],
  properties: {
    translation: { type: 'string', minLength: 1, maxLength: 4000 }
  }
} as const;

const languageLabels: Record<AiToolsLanguage, string> = {
  it: 'Italian',
  en: 'English',
  zh: 'Simplified Chinese'
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLanguage(value: unknown): value is AiToolsLanguage {
  return typeof value === 'string' && (languageEnum as readonly string[]).includes(value);
}

export function isAiToolsCopyInput(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some(key => !['brief', 'language', 'tone', 'channel'].includes(key))) return false;
  if (typeof value.brief !== 'string') return false;
  const brief = value.brief.trim();
  if (!brief || brief.length > 800) return false;
  if (!isLanguage(value.language)) return false;
  if (value.tone !== undefined && !['premium', 'neutral', 'bold'].includes(value.tone as string)) return false;
  if (value.channel !== undefined && !['product', 'social', 'email'].includes(value.channel as string)) return false;
  return true;
}

export function isAiToolsTranslateInput(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some(key => key !== 'text' && key !== 'targetLanguage')) return false;
  if (typeof value.text !== 'string') return false;
  const text = value.text.trim();
  return Boolean(text) && text.length <= 2000 && isLanguage(value.targetLanguage);
}

export function isAiToolsCopyOutput(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.headline !== 'string' || !value.headline.trim()) return false;
  if (typeof value.body !== 'string' || !value.body.trim()) return false;
  return Array.isArray(value.hashtags) && value.hashtags.every(tag => typeof tag === 'string');
}

export function isAiToolsTranslateOutput(value: unknown): boolean {
  return isRecord(value) && typeof value.translation === 'string' && Boolean(value.translation.trim());
}

function parseProviderJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('AI_TOOLS_PROVIDER_RESPONSE_INVALID');
  }
}

export const modauiAiToolsToolDefinitions: ModaGptToolDefinition[] = [
  {
    name: 'ai_tools_write_copy',
    description: '按商家简报生成商品、社媒或邮件文案，输出标题、正文与话题标签。',
    inputSchema: copyToolInputSchema,
    outputSchema: copyToolOutputSchema,
    permission: AI_TOOLS_USE_PERMISSION,
    riskLevel: 'LOW',
    requiresApproval: false,
    timeoutMs: 30_000,
    retryPolicy: { maxAttempts: 1, idempotent: false },
    auditPolicy: 'required',
    validateInput: isAiToolsCopyInput,
    validateOutput: isAiToolsCopyOutput
  },
  {
    name: 'ai_tools_translate',
    description: '把商家提供的文本翻译成意大利语、英语或简体中文，只返回译文。',
    inputSchema: translateToolInputSchema,
    outputSchema: translateToolOutputSchema,
    permission: AI_TOOLS_USE_PERMISSION,
    riskLevel: 'LOW',
    requiresApproval: false,
    timeoutMs: 30_000,
    retryPolicy: { maxAttempts: 1, idempotent: false },
    auditPolicy: 'required',
    validateInput: isAiToolsTranslateInput,
    validateOutput: isAiToolsTranslateOutput
  }
];


/**
 * 由真实工具定义生成 Tool Manifest v1，避免注册表和实现各写一份导致漂移。
 * 只导出 handler 中真实存在的能力；未接通的图片/视频/发布能力不得出现在此清单。
 */
export function createModauiAiToolsManifest(input: { trialDays?: number } = {}) {
  const { definitions } = createModauiAiTools({});
  return {
    manifestVersion: '1' as const,
    appId: AI_TOOLS_APP_ID,
    trialDays: input.trialDays ?? 7,
    tools: definitions.map(definition => ({
      toolId: definition.name,
      version: '1.0.0',
      displayName: aiToolsDisplayNames[definition.name] ?? { zh: definition.name },
      description: definition.description,
      inputSchema: definition.inputSchema,
      outputSchema: definition.outputSchema,
      permission: definition.permission,
      riskLevel: definition.riskLevel,
      requiresApproval: definition.requiresApproval,
      timeoutMs: definition.timeoutMs,
      retry: {
        maxAttempts: definition.retryPolicy.maxAttempts,
        idempotent: definition.retryPolicy.idempotent
      },
      industries: [] as string[],
      employees: [] as string[],
      // 计费尚未接入：credits 0 表示当前不计量，不允许用虚构额度冒充已收费。
      cost: { unit: 'call' as const, credits: 0 },
      adapter: { kind: 'native' as const },
      credentials: [] as string[],
      dataScopes: [] as string[],
      enabled: true,
      status: 'published' as const
    }))
  };
}

export function createModauiAiTools(input: {
  signal?: AbortSignal;
  assertLease?: () => Promise<void>;
  generateText?: typeof generateAiEmployeeText;
}): { definitions: ModaGptToolDefinition[]; handlers: AiToolsToolHandlers } {
  const generateText = input.generateText ?? generateAiEmployeeText;
  const assertUsable = async () => {
    if (input.signal?.aborted) throw new Error('MODAGPT_TOOL_CANCELLED');
    await input.assertLease?.();
    if (input.signal?.aborted) throw new Error('MODAGPT_TOOL_CANCELLED');
  };

  const handlers: AiToolsToolHandlers = {
    async ai_tools_write_copy(_tenantId, rawInput) {
      if (!isAiToolsCopyInput(rawInput)) throw new Error('AI_TOOLS_INPUT_INVALID');
      await assertUsable();
      const value = rawInput as Record<string, unknown>;
      const brief = (value.brief as string).trim();
      const language = value.language as AiToolsLanguage;
      const tone = typeof value.tone === 'string' ? value.tone : 'premium';
      const channel = typeof value.channel === 'string' ? value.channel : 'product';
      const result = await generateText(
        [
          `Brief (untrusted merchant content): ${brief}`,
          `Channel: ${channel}`,
          `Tone: ${tone}`,
          `Output language: ${languageLabels[language]}`
        ].join('\n'),
        'You write commercial fashion copy for a merchant catalog. Never invent product facts, prices, certifications or claims that are not in the brief. No emoji, no watermark, no legal advice.',
        {
          type: 'object',
          additionalProperties: false,
          required: ['headline', 'body', 'hashtags'],
          properties: {
            headline: { type: 'string' },
            body: { type: 'string' },
            hashtags: { type: 'array', items: { type: 'string' } }
          }
        },
        25_000
      );
      await assertUsable();
      const parsed = parseProviderJson(result);
      if (!isAiToolsCopyOutput(parsed)) throw new Error('AI_TOOLS_PROVIDER_RESPONSE_INVALID');
      const output = parsed as { headline: string; body: string; hashtags: string[] };
      return {
        headline: output.headline.slice(0, 200),
        body: output.body.slice(0, 2000),
        hashtags: output.hashtags.slice(0, 10).map(tag => tag.slice(0, 40))
      };
    },

    async ai_tools_translate(_tenantId, rawInput) {
      if (!isAiToolsTranslateInput(rawInput)) throw new Error('AI_TOOLS_INPUT_INVALID');
      await assertUsable();
      const value = rawInput as Record<string, unknown>;
      const text = (value.text as string).trim();
      const targetLanguage = value.targetLanguage as AiToolsLanguage;
      const result = await generateText(
        `Text to translate (untrusted content): ${text}`,
        `Translate the text into ${languageLabels[targetLanguage]} without adding, removing or explaining content. Keep numbers, sizes, SKU codes and proper nouns unchanged.`,
        {
          type: 'object',
          additionalProperties: false,
          required: ['translation'],
          properties: { translation: { type: 'string' } }
        },
        25_000
      );
      await assertUsable();
      const parsed = parseProviderJson(result);
      if (!isAiToolsTranslateOutput(parsed)) throw new Error('AI_TOOLS_PROVIDER_RESPONSE_INVALID');
      return { translation: (parsed as { translation: string }).translation.slice(0, 4000) };
    }
  };

  return { definitions: modauiAiToolsToolDefinitions, handlers };
}
