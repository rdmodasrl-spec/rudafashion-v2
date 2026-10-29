export const MINIMUM_PASSWORD_LENGTH = 12;

export function meetsMinimumPasswordLength(password: string): boolean {
  return password.length >= MINIMUM_PASSWORD_LENGTH && password.trim().length >= MINIMUM_PASSWORD_LENGTH;
}