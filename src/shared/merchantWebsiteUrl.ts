export function normalizeMerchantWebsiteUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const input = value.trim().replace(/[。．]/g, '.');
  if (!input || input.length > 200) return '';
  const candidate = /^https?:\/\//i.test(input) ? input : `https://${input}`;

  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) {
      return '';
    }
    const normalized = url.toString();
    return normalized.length <= 200 ? normalized : '';
  } catch {
    return '';
  }
}
