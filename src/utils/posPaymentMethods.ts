export const posPaymentMethods = [
  'cash',
  'alipay',
  'wechat_pay',
  'credit_card',
  'bank_transfer',
  'net_30'
] as const;

export type PosPaymentMethod = typeof posPaymentMethods[number];

export const posDirectPaymentMethods = ['cash', 'alipay', 'wechat_pay', 'credit_card'] as const;

export function isPosPaymentMethod(value: string): value is PosPaymentMethod {
  return (posPaymentMethods as readonly string[]).includes(value);
}

export function requiresPosPaymentConfirmation(value: string): boolean {
  return (posDirectPaymentMethods as readonly string[]).includes(value);
}
