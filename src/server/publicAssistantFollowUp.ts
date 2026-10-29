import { searchPublicProducts } from '../utils/publicProductSearch';
import type { PublicAssistantTurn } from './merchantSupportAi';

const productFollowUpPattern = /更便宜|便宜一点|再便宜|价格低一点|还有吗|还有没有|类似的|同类的|换个颜色|换一个款|换成|改到|再找一些|再看看|cheaper|lower price|anything similar|more like this|another color|piu economico|più economico|ne hai altri|un altro colore/i;

const locationAliases = [
  'italy', 'italia', '意大利', 'greece', 'grecia', '希腊', '希臘', 'france', 'francia', '法国',
  'germany', 'deutschland', 'germania', '德国', 'spain', 'espana', '西班牙', 'portugal',
  'portogallo', '葡萄牙', 'poland', 'polonia', '波兰', 'milan', 'milano', '米兰', 'rome',
  'roma', '罗马', 'prato', '普拉托', 'florence', 'firenze', '佛罗伦萨', 'athens', 'athina',
  '雅典', 'thessaloniki', 'salonicco', '塞萨洛尼基'
];

function removeLocations(query: string): string {
  return locationAliases.reduce((result, alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return result.replace(new RegExp(escaped, 'gi'), ' ');
  }, query);
}

function mostRecentProductSearch(history: PublicAssistantTurn[]): string | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const turn = history[index];
    if (turn.role !== 'user') continue;
    return searchPublicProducts([], turn.text).isSearchRequest ? turn.text : null;
  }
  return null;
}

export function resolveProductFollowUpQuery(
  message: string,
  history: PublicAssistantTurn[]
): string | null {
  if (!productFollowUpPattern.test(message)) return null;
  const previousSearch = mostRecentProductSearch(history);
  if (!previousSearch) return null;

  const hasNewLocation = locationAliases.some(alias => message.toLocaleLowerCase().includes(alias.toLocaleLowerCase()));
  const hasNewPrice = /(?:€\s*\d|\d\s*(?:€|eur|欧元|欧))/i.test(message);
  let baseQuery = previousSearch;
  if (hasNewLocation) baseQuery = removeLocations(baseQuery);
  if (hasNewPrice) baseQuery = baseQuery.replace(/(?:€\s*\d+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?\s*(?:€|eur(?:os?)?|欧元|欧))/gi, ' ');

  return `${baseQuery} ${message}`.trim();
}
