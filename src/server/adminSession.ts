export function isAdminSessionCurrent(
  credentialVersion: unknown,
  issuedAt: unknown,
  accountUpdatedAt: Date
): boolean {
  if (typeof credentialVersion === 'number' && Number.isFinite(credentialVersion)) {
    return credentialVersion === accountUpdatedAt.getTime();
  }
  return typeof issuedAt === 'number'
    && Number.isFinite(issuedAt)
    && issuedAt * 1000 >= accountUpdatedAt.getTime();
}