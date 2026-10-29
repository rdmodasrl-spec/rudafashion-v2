import { normalizeIpAddress } from './adminIpAllowlist';

/**
 * Resolves the client IP Express derived from the socket and trusted proxy hops.
 * Express may report IPv4-mapped IPv6 (`::ffff:203.0.113.8`) or a bracketed
 * address; both are normalised so allowlist and audit output stay consistent.
 */
export function getClientIp(request: { ip?: string; socket?: { remoteAddress?: string } }): string {
  const raw = request.ip || request.socket?.remoteAddress || '127.0.0.1';
  return normalizeIpAddress(raw) || '127.0.0.1';
}
