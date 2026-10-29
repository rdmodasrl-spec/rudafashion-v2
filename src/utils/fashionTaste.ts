export type FashionTasteProfile = Record<string, number>;

export type FashionTasteSignal = 'like' | 'save' | 'view' | 'dislike';

const signalWeights: Record<FashionTasteSignal, number> = {
  like: 2,
  save: 3,
  view: 1,
  dislike: -4
};

export function parseFashionDismissedItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string =>
    typeof item === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(item)
  ))].slice(-500);
}

export function parseFashionTasteProfile(value: unknown): FashionTasteProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, number] =>
        typeof entry[0] === 'string'
        && entry[0].length <= 80
        && typeof entry[1] === 'number'
        && Number.isFinite(entry[1])
      )
      .map(([category, score]) => [category, Math.max(-20, Math.min(20, score))])
  );
}

export function updateFashionDismissedItems(items: readonly string[], itemId: string): string[] {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(itemId)) return [...items];
  return [...new Set([...items, itemId])].slice(-500);
}

export function updateFashionTaste(
  profile: FashionTasteProfile,
  category: string | undefined,
  signal: FashionTasteSignal,
  active: boolean
): FashionTasteProfile {
  if (!category?.trim()) return profile;
  const normalizedCategory = category.trim();
  const score = (profile[normalizedCategory] || 0) + signalWeights[signal] * (active ? 1 : -1);
  const boundedScore = Math.max(-20, Math.min(20, score));
  if (boundedScore === 0) {
    const { [normalizedCategory]: _removed, ...remaining } = profile;
    return remaining;
  }
  return { ...profile, [normalizedCategory]: boundedScore };
}

export function rankFashionItems<T extends { category?: string }>(
  items: readonly T[],
  profile: FashionTasteProfile
): T[] {
  const remaining = items
    .map((item, index) => ({ item, index, score: profile[item.category || ''] || 0 }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const ranked: T[] = [];
  let previousCategory: string | undefined;
  let categoryStreak = 0;

  while (remaining.length > 0) {
    let nextIndex = 0;
    const preferredCategory = remaining[0].item.category;
    if (preferredCategory && preferredCategory === previousCategory && categoryStreak >= 2) {
      const diverseIndex = remaining.findIndex(candidate =>
        candidate.item.category !== preferredCategory
        && remaining[0].score - candidate.score <= 2
      );
      if (diverseIndex !== -1) nextIndex = diverseIndex;
    }

    const [next] = remaining.splice(nextIndex, 1);
    ranked.push(next.item);
    if (next.item.category && next.item.category === previousCategory) {
      categoryStreak += 1;
    } else {
      previousCategory = next.item.category;
      categoryStreak = next.item.category ? 1 : 0;
    }
  }

  return ranked;
}
