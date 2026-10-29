export function getFeedWindowBounds(totalItems: number, activeIndex: number, before = 2, after = 5) {
  const total = Number.isFinite(totalItems) ? Math.max(0, Math.floor(totalItems)) : 0;
  if (total === 0) return { start: 0, end: 0 };

  const active = Number.isFinite(activeIndex)
    ? Math.min(total - 1, Math.max(0, Math.floor(activeIndex)))
    : 0;
  const start = Math.max(0, active - Math.max(0, Math.floor(before)));
  const end = Math.min(total, active + Math.max(1, Math.floor(after)));
  return { start, end };
}
