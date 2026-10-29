export const aiEmployeeMemoryCategories = ['preference', 'brand_voice', 'operating_rule'] as const;
export type AiEmployeeMemoryCategory = (typeof aiEmployeeMemoryCategories)[number];

export type AiEmployeeMemoryInput = {
  category: AiEmployeeMemoryCategory;
  content: string;
};

export function parseAiEmployeeMemoryInput(input: unknown): AiEmployeeMemoryInput | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const body = input as Record<string, unknown>;
  if (
    Object.keys(body).length !== 2
    || !Object.hasOwn(body, 'category')
    || !Object.hasOwn(body, 'content')
    || typeof body.category !== 'string'
    || !aiEmployeeMemoryCategories.includes(body.category as AiEmployeeMemoryCategory)
    || typeof body.content !== 'string'
  ) return null;
  const content = body.content.trim();
  if (
    !content
    || content.length > 500
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(content)
  ) return null;
  return { category: body.category as AiEmployeeMemoryCategory, content };
}

export function serializeAiEmployeeMemories(
  memories: Array<{ category: string; content: string }>
): string[] {
  return memories
    .filter(memory => aiEmployeeMemoryCategories.includes(memory.category as AiEmployeeMemoryCategory))
    .slice(0, 30)
    .map(memory => `[${memory.category}] ${memory.content.slice(0, 500)}`);
}
