import { matchesAiEmployeeResponseLanguage } from './aiEmployeeLanguage';

export type AiEmployeeReplyVerificationOptions = {
  message: string;
  facts: unknown;
  invalidErrorCode: string;
  ungroundedErrorCode: string;
  maxLength?: number;
};

function extractNumbers(value: string): number[] {
  return [...value.matchAll(/\d[\d,.]*/g)]
    .map(([number]) => Number(number.replace(/[,.]/g, '')))
    .filter(Number.isFinite);
}

export function verifyAiEmployeeReply(
  candidate: unknown,
  options: AiEmployeeReplyVerificationOptions
): string {
  if (
    typeof candidate !== 'string'
    || !candidate.trim()
    || candidate.length > (options.maxLength ?? 1500)
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(candidate)
    || !matchesAiEmployeeResponseLanguage(options.message, candidate)
  ) throw new Error(options.invalidErrorCode);

  const sourceNumbers = new Set(extractNumbers(JSON.stringify(options.facts)));
  if (extractNumbers(candidate).some(number => !sourceNumbers.has(number))) {
    throw new Error(options.ungroundedErrorCode);
  }
  return candidate.trim();
}
