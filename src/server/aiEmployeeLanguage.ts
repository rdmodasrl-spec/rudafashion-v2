const italianWords = new Set([
  'abbiamo', 'al', 'alla', 'alle', 'anche', 'avere', 'con', 'consigliato', 'disponibile',
  'disponibili', 'della', 'delle', 'degli', 'del', 'di', 'è', 'gli', 'il', 'la', 'le',
  'lo', 'nel', 'nella', 'ordini', 'per', 'pezzi', 'possiamo', 'prodotti', 'quanti', 'quanto',
  'quantità', 'riordinare', 'sono', 'suggerito', 'suggeriti', 'vendite', 'venduti'
]);
const englishWords = new Set([
  'available', 'can', 'for', 'how', 'in', 'is', 'last', 'many', 'of', 'orders', 'quantity',
  'reorder', 'sales', 'stock', 'suggested', 'the', 'units', 'were'
]);

function countKnownWords(value: string, words: ReadonlySet<string>): number {
  return value.toLowerCase().match(/[\p{L}]+/gu)?.filter(word => words.has(word)).length || 0;
}

export function matchesAiEmployeeResponseLanguage(message: string, reply: string): boolean {
  const messageHasChinese = /[\u4e00-\u9fff]/.test(message);
  if (messageHasChinese) return /[\u4e00-\u9fff]/.test(reply);

  const italianSignal = /[àèéìòù]/i.test(message) || countKnownWords(message, italianWords) >= 2;
  if (italianSignal) {
    return /[àèéìòù]/i.test(reply) || countKnownWords(reply, italianWords) > 0;
  }

  const englishSignal = countKnownWords(message, englishWords) >= 2;
  if (englishSignal) {
    return countKnownWords(reply, englishWords) > 0;
  }
  return !/[\u4e00-\u9fff]/.test(reply);
}
