import { timingSafeEqual } from 'node:crypto';

export function isValidGoogleSignInCsrf(cookieToken: unknown, submittedToken: unknown): boolean {
  if (typeof cookieToken !== 'string' || typeof submittedToken !== 'string' || !cookieToken || !submittedToken) {
    return false;
  }

  const cookieBytes = Buffer.from(cookieToken);
  const submittedBytes = Buffer.from(submittedToken);
  return cookieBytes.length === submittedBytes.length && timingSafeEqual(cookieBytes, submittedBytes);
}
