export const buyerAvatarOptions = Array.from({ length: 9 }, (_, index) => ({
  id: `avatar-${index + 1}`,
  url: `/buyer-avatars/avatar-${index + 1}.webp`
}));

export function isBuyerAvatarUrl(value: unknown): value is string {
  return typeof value === 'string' && buyerAvatarOptions.some(option => option.url === value);
}
