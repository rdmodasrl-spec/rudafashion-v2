import {
  LANGUAGE_OPTIONS,
  TRANSLATIONS,
  getUiCopyId,
  isLanguage,
  isUiTranslationText,
  type Language,
  type TranslationKey,
  type UiCopyInput
} from '../i18n/translations';
import { UI_COPY_CATALOG } from '../i18n/uiCopyCatalog';
import { generateAiEmployeeText } from './aiEmployeeProviders';

type UiTranslationMap = Partial<Record<TranslationKey, string>>;

const translationCache = new Map<Language, Promise<UiTranslationMap>>();
const uiCopyCache = new Map<Language, Map<string, Promise<string>>>();
const uiCopyInFlight = new Map<Language, Set<string>>();
const keysPerRequest = 24;
const maxCachedUiCopiesPerLanguage = 2500;
const uiCopyCatalogById = new Map(UI_COPY_CATALOG.map(copy => [copy.id, copy]));

export function isUiTranslationLanguage(value: unknown): value is Language {
  return isLanguage(value);
}

export function getStaticUiTranslations(language: 'it' | 'zh'): UiTranslationMap {
  return { ...TRANSLATIONS[language] };
}

export function parseUiCopyInputs(value: unknown): UiCopyInput[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > keysPerRequest) return null;
  const copies = new Map<string, UiCopyInput>();
  let totalLength = 0;

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const record = item as Record<string, unknown>;
    if (Object.keys(record).some(key => !['id', 'zh', 'it'].includes(key))) return null;
    if (typeof record.zh !== 'string' || typeof record.it !== 'string') return null;
    const zh = record.zh;
    const it = record.it;
    if (!zh.trim() || !it.trim() || zh.length > 2000 || it.length > 2000) return null;
    if (!preservesUiCopyPlaceholders(zh, it)) return null;
    const id = getUiCopyId(zh, it);
    if (record.id !== id) return null;
    const approvedCopy = uiCopyCatalogById.get(id);
    if (!approvedCopy || approvedCopy.zh !== zh || approvedCopy.it !== it) return null;
    totalLength += zh.length + it.length;
    if (totalLength > 20_000) return null;
    copies.set(id, { id, zh, it });
  }

  return [...copies.values()];
}

export async function getAiUiCopyTranslations(
  language: Language,
  copies: UiCopyInput[]
): Promise<Record<string, string>> {
  if (language === 'it' || language === 'zh') return {};
  if (copies.length === 0 || copies.length > keysPerRequest) {
    throw new Error('UI_COPY_REQUEST_INVALID');
  }
  const cache = uiCopyCache.get(language) || new Map<string, Promise<string>>();
  uiCopyCache.set(language, cache);
  let inFlight = uiCopyInFlight.get(language);
  if (!inFlight) {
    inFlight = new Set<string>();
    uiCopyInFlight.set(language, inFlight);
  }

  for (const copy of copies) {
    const cached = cache.get(copy.id);
    if (cached) {
      cache.delete(copy.id);
      cache.set(copy.id, cached);
    }
  }
  const missing = copies.filter(copy => !cache.has(copy.id));
  if (missing.length > 0) {
    const batchPromise = translateUiCopyBatch(language, missing);
    for (const copy of missing) {
      inFlight.add(copy.id);
      let copyPromise: Promise<string>;
      copyPromise = batchPromise
        .then(translated => {
          const value = translated[copy.id];
          if (!value) throw new Error('UI_COPY_TRANSLATION_MISSING');
          return value;
        })
        .catch(error => {
          if (cache.get(copy.id) === copyPromise) cache.delete(copy.id);
          throw error;
        })
        .finally(() => {
          inFlight!.delete(copy.id);
          trimUiCopyCache(cache, inFlight!);
          if (!inFlight!.size) uiCopyInFlight.delete(language);
        });
      cache.set(copy.id, copyPromise);
    }
  }

  const entries = await Promise.all(copies.map(async copy => [
    copy.id,
    await cache.get(copy.id)!
  ] as const));
  return Object.fromEntries(entries);
}

function trimUiCopyCache(cache: Map<string, Promise<string>>, inFlight: Set<string>): void {
  if (cache.size <= maxCachedUiCopiesPerLanguage) return;
  for (const key of cache.keys()) {
    if (!inFlight.has(key)) cache.delete(key);
    if (cache.size <= maxCachedUiCopiesPerLanguage) return;
  }
}

export function preservesUiCopyPlaceholders(source: string, translated: string): boolean {
  const placeholders = (value: string) => [...value.matchAll(/\{\{RUDA_ARG_\d+\}\}|\{[a-zA-Z][a-zA-Z0-9_]*\}/g)]
    .map(match => match[0])
    .sort();
  return JSON.stringify(placeholders(source)) === JSON.stringify(placeholders(translated));
}

export async function getAiUiTranslations(language: Language): Promise<UiTranslationMap> {
  if (language === 'it' || language === 'zh') return getStaticUiTranslations(language);

  const cached = translationCache.get(language);
  if (cached) return cached;

  const translation = translateUiDictionary(language);
  translationCache.set(language, translation);
  try {
    return await translation;
  } catch (error) {
    translationCache.delete(language);
    throw error;
  }
}

async function translateUiCopyBatch(
  language: Language,
  copies: UiCopyInput[]
): Promise<Record<string, string>> {
  const targetName = LANGUAGE_OPTIONS.find(item => item.code === language)?.deepSeekName;
  if (!targetName) throw new Error('UI_TRANSLATION_LANGUAGE_UNSUPPORTED');

  const source = Object.fromEntries(copies.map(copy => [copy.id, copy.it]));
  const properties = Object.fromEntries(copies.map(copy => [
    copy.id,
    { type: 'string', maxLength: 3000 }
  ]));
  const required = copies.map(copy => copy.id);
  const responseFormat = {
    type: 'object' as const,
    properties,
    required,
    additionalProperties: false as const
  };
  const raw = await generateAiEmployeeText(
    JSON.stringify(source),
    `Translate every Italian interface string into ${targetName}. Use professional European fashion-wholesale and B2B terminology. Interpret "pronto moda" in its fashion-wholesale sense, "ingrosso" as wholesale, and "Partita IVA" as the local business VAT/tax identifier. Return each value only in ${targetName}, never include the Italian or Chinese source. Preserve placeholders, product codes, numbers, currency symbols, URLs, and brand names exactly. Do not invent platform policies, fees, or order promises. Keep the supplied keys unchanged and return no additional keys.`,
    responseFormat,
    45_000
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('UI_TRANSLATION_RESPONSE_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('UI_TRANSLATION_RESPONSE_INVALID');
  }

  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).length !== required.length) {
    throw new Error('UI_TRANSLATION_RESPONSE_INCOMPLETE');
  }

  const translated: Record<string, string> = {};
  for (const key of required) {
    const value = record[key];
    if (!isUiTranslationText(value, language, 3000)) {
      throw new Error('UI_TRANSLATION_RESPONSE_INVALID');
    }
    const normalized = value.trim();
    const copy = copies.find(entry => entry.id === key);
    if (!copy || !preservesUiCopyPlaceholders(copy.it, normalized)) {
      throw new Error('UI_TRANSLATION_PLACEHOLDER_INVALID');
    }
    translated[key] = normalized;
  }
  return translated;
}

async function translateUiDictionary(language: Language): Promise<UiTranslationMap> {
  const targetName = LANGUAGE_OPTIONS.find(item => item.code === language)?.deepSeekName;
  if (!targetName) throw new Error('UI_TRANSLATION_LANGUAGE_UNSUPPORTED');

  const entries = Object.entries(TRANSLATIONS.it) as Array<[TranslationKey, string]>;
  const batches: Array<Array<[TranslationKey, string]>> = [];
  for (let index = 0; index < entries.length; index += keysPerRequest) {
    batches.push(entries.slice(index, index + keysPerRequest));
  }

  const translated: UiTranslationMap = {};
  let nextBatch = 0;
  const worker = async () => {
    while (nextBatch < batches.length) {
      const current = batches[nextBatch++];
      if (!current) return;
      const result = await translateBatch(current, targetName, language);
      Object.assign(translated, result);
    }
  };

  await Promise.all(Array.from({ length: Math.min(3, batches.length) }, worker));
  return translated;
}

async function translateBatch(
  entries: Array<[TranslationKey, string]>,
  targetName: string,
  language: Language
): Promise<UiTranslationMap> {
  const properties = Object.fromEntries(entries.map(([key]) => [
    key,
    { type: 'string', maxLength: 2000 }
  ]));
  const required = entries.map(([key]) => key);
  const responseFormat = {
    type: 'object' as const,
    properties,
    required,
    additionalProperties: false as const
  };
  const source = Object.fromEntries(entries);
  const raw = await generateAiEmployeeText(
    JSON.stringify(source),
    `Translate every value from Italian to ${targetName}. Use professional European fashion-wholesale and B2B terminology. Interpret "pronto moda" in its fashion-wholesale sense, "ingrosso" as wholesale, and "Partita IVA" as the local business VAT/tax identifier. Preserve each key exactly. Do not add, omit, or rename keys. Preserve placeholders, product codes, numbers, currency symbols, and brand names exactly. Do not invent platform policies, fees, or order promises. Return concise, natural interface copy only.`,
    responseFormat,
    45_000
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('UI_TRANSLATION_RESPONSE_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('UI_TRANSLATION_RESPONSE_INVALID');
  }

  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).length !== required.length) {
    throw new Error('UI_TRANSLATION_RESPONSE_INCOMPLETE');
  }

  const translated: UiTranslationMap = {};
  for (const key of required) {
    const value = record[key];
    if (!isUiTranslationText(value, language, 2000)) {
      throw new Error('UI_TRANSLATION_RESPONSE_INVALID');
    }
    const sourceValue = TRANSLATIONS.it[key];
    if (!preservesUiCopyPlaceholders(sourceValue, value)) {
      throw new Error('UI_TRANSLATION_PLACEHOLDER_INVALID');
    }
    translated[key] = value.trim();
  }
  return translated;
}
