export const normalizeFashionHashtags = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length > 8) return null;
  const normalized: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return null;
    const tag = entry.trim().replace(/^#+/, '');
    if (!tag) continue;
    if (!/^[\p{L}\p{N}_-]{1,30}$/u.test(tag)) return null;
    const uniqueTag = tag.toLocaleLowerCase();
    if (!normalized.some(existing => existing.toLocaleLowerCase() === uniqueTag)) normalized.push(tag);
  }
  return normalized;
};
