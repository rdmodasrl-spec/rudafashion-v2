export function hasSensitiveOnboardingInformation(message: string): boolean {
  const normalized = message.trim();
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(normalized);
  const iban = /\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]){11,30}\b/i.test(normalized);
  const italianTaxCode = /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/i.test(normalized);
  const labeledTaxNumber = /(?:vat(?:\s+number)?|tax\s*id|tax\s*code|partita\s+iva|codice\s+fiscale|税号|增值税号)\s*[:：#-]?\s*[A-Z0-9 -]{8,20}/i.test(normalized);
  const labeledPhone = /(?:phone|telephone|tel\.?|mobile|whatsapp|telefono|电话|手机)\s*[:：]?\s*\+?[\d\s().-]{7,}/i.test(normalized);
  const internationalPhone = /(?:\+|00)\d[\d\s().-]{7,}\d/.test(normalized);
  const credential = /(?:password|passcode|secret|api[\s_-]?key|otp|one[\s-]?time[\s-]?code)\s*[:：=]\s*\S+|(?:password|passcode|api[\s_-]?key)\s+(?:is|为|是)\s+\S+|(?:密码|口令|验证码|密钥)\s*[:：=]?\s*\S+/i.test(normalized);
  const paymentCard = [...normalized.matchAll(/(?:\d[ -]?){13,19}/g)]
    .some(([candidate]) => passesLuhnCheck(candidate.replace(/\D/g, '')));
  return email || iban || italianTaxCode || labeledTaxNumber || labeledPhone || internationalPhone || credential || paymentCard;
}

function passesLuhnCheck(value: string): boolean {
  let sum = 0;
  let doubleDigit = false;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return value.length >= 13 && value.length <= 19 && sum % 10 === 0;
}
