const TRUST_PROXY_HOPS_MIN = 1;
const TRUST_PROXY_HOPS_MAX = 5;
const TRUST_PROXY_HOPS_DEFAULT = 1;

/**
 * Parses the number of reverse-proxy hops that may be trusted when resolving the client IP.
 * Only the configured hops are trusted, so a spoofed `X-Forwarded-For` header cannot decide the admin IP check.
 */
export function parseTrustProxyHops(raw: string | undefined): { hops: number; invalid: string | null } {
  if (raw === undefined || raw.trim() === '') return { hops: TRUST_PROXY_HOPS_DEFAULT, invalid: null };
  const hops = Number(raw.trim());
  if (!Number.isInteger(hops) || hops < TRUST_PROXY_HOPS_MIN || hops > TRUST_PROXY_HOPS_MAX) {
    return { hops: TRUST_PROXY_HOPS_DEFAULT, invalid: raw };
  }
  return { hops, invalid: null };
}
