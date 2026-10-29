export type ParsedIpAllowlist = { entries: { ip: string; cidr?: string }[]; hasAny: boolean };

export type IpAllowanceOptions = { allowPrivate?: boolean };

type IpVersion = 4 | 6;
type ParsedIp = { version: IpVersion; value: number | bigint };

const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

function ipv4ToNumber(ip: string): number | null {
  if (!IPV4_PATTERN.test(ip)) return null;
  const octets = ip.split('.').map(Number);
  if (octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
  return octets.reduce((acc, octet) => (acc << 8) + octet, 0) >>> 0;
}

function ipv6ToBigInt(ip: string): bigint | null {
  if (!ip.includes(':')) return null;
  let value = ip;
  if (value.includes('.')) {
    const lastColon = value.lastIndexOf(':');
    if (lastColon < 0) return null;
    const ipv4 = ipv4ToNumber(value.slice(lastColon + 1));
    if (ipv4 === null) return null;
    value = `${value.slice(0, lastColon + 1)}${(ipv4 >>> 16).toString(16)}:${(ipv4 & 0xffff).toString(16)}`;
  }
  const sections = value.split('::');
  if (sections.length > 2) return null;
  const head = sections[0] ? sections[0].split(':') : [];
  const tail = sections.length === 2 && sections[1] ? sections[1].split(':') : [];
  if (sections.length === 1 && head.length !== 8) return null;
  if (sections.length === 2 && head.length + tail.length > 7) return null;
  const groups = sections.length === 2
    ? [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail]
    : head;
  if (groups.length !== 8) return null;
  let result = 0n;
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    result = (result << 16n) + BigInt(Number.parseInt(group, 16));
  }
  return result;
}

/**
 * Normalises addresses from Express, sockets or forwarded headers. IPv4-mapped
 * IPv6 (`::ffff:203.0.113.8`) is reduced to IPv4, brackets and scope ids are
 * stripped, and invalid input returns `null` so callers fail closed.
 */
export function normalizeIpAddress(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;
  let value = raw.trim();
  if (!value) return null;
  if (value.startsWith('[') && value.includes(']')) value = value.slice(1, value.indexOf(']'));
  const zoneIndex = value.indexOf('%');
  if (zoneIndex >= 0) value = value.slice(0, zoneIndex);
  value = value.toLowerCase();
  if (value.startsWith('::ffff:') && IPV4_PATTERN.test(value.slice(7))) return value.slice(7);
  if (ipv4ToNumber(value) !== null) return value;
  return ipv6ToBigInt(value) === null ? null : value;
}

function parseIp(raw: string): ParsedIp | null {
  const version: IpVersion = raw.includes(':') ? 6 : 4;
  if (version === 4) {
    const value = ipv4ToNumber(raw);
    return value === null ? null : { version, value };
  }
  const value = ipv6ToBigInt(raw);
  return value === null ? null : { version, value };
}

function cidrBits(cidr: string | undefined, version: IpVersion): number {
  const max = version === 4 ? 32 : 128;
  if (!cidr) return max;
  const bits = Number(cidr.slice(1));
  return Number.isInteger(bits) && bits >= 0 && bits <= max ? bits : max;
}

function networkMask(bits: number, version: IpVersion): number | bigint {
  if (version === 4) return bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
  return bits === 0 ? 0n : ((1n << BigInt(bits)) - 1n) << BigInt(128 - bits);
}

export function parseAdminIpAllowlist(raw: string | undefined): ParsedIpAllowlist {
  if (!raw) return { entries: [], hasAny: false };
  const entries: { ip: string; cidr?: string }[] = [];
  for (const part of String(raw).split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [rawIp, rawCidr, ...rest] = trimmed.split('/');
    if (!rawIp || rest.length > 0) continue;
    const ip = normalizeIpAddress(rawIp);
    if (!ip) continue;
    const version: IpVersion = ip.includes(':') ? 6 : 4;
    if (rawCidr !== undefined) {
      const bits = Number(rawCidr.trim());
      if (!Number.isInteger(bits) || bits < 0 || bits > (version === 4 ? 32 : 128)) continue;
      entries.push({ ip, cidr: `/${bits}` });
      continue;
    }
    entries.push({ ip });
  }
  return { entries, hasAny: entries.length > 0 };
}

/** Private (RFC1918/IPv6 ULA) and loopback ranges that can only originate from the host or its LAN. */
const PRIVATE_IPV4_RANGES = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'];
const PRIVATE_IPV6_RANGES = ['::1/128', 'fc00::/7', 'fe80::/10'];

function matchesRange(ip: ParsedIp, range: string): boolean {
  const [network, bits] = range.split('/');
  const parsedNetwork = parseIp(network);
  if (!parsedNetwork || parsedNetwork.version !== ip.version) return false;
  const mask = networkMask(cidrBits(`/${bits}`, ip.version), ip.version);
  if (ip.version === 4) {
    return ((ip.value as number) & (mask as number)) === ((parsedNetwork.value as number) & (mask as number));
  }
  return ((ip.value as bigint) & (mask as bigint)) === ((parsedNetwork.value as bigint) & (mask as bigint));
}

export function isPrivateOrLoopbackIp(ip: string | undefined): boolean {
  const normalized = normalizeIpAddress(ip);
  if (!normalized) return false;
  const parsed = parseIp(normalized);
  if (!parsed) return false;
  const ranges = parsed.version === 4 ? PRIVATE_IPV4_RANGES : PRIVATE_IPV6_RANGES;
  return ranges.some(range => matchesRange(parsed, range));
}

export function isIpAllowed(ip: string | undefined, list: ParsedIpAllowlist, options?: IpAllowanceOptions): boolean {
  const normalized = normalizeIpAddress(ip);
  if (!normalized) return false;
  const parsed = parseIp(normalized);
  if (!parsed) return false;
  if (options?.allowPrivate === true && isPrivateOrLoopbackIp(normalized)) return true;
  if (!list.hasAny) return false;
  return list.entries.some(entry => {
    const parsedEntry = parseIp(entry.ip);
    if (!parsedEntry || parsedEntry.version !== parsed.version) return false;
    const mask = networkMask(cidrBits(entry.cidr, parsed.version), parsed.version);
    if (parsed.version === 4) {
      return ((parsed.value as number) & (mask as number)) === ((parsedEntry.value as number) & (mask as number));
    }
    return ((parsed.value as bigint) & (mask as bigint)) === ((parsedEntry.value as bigint) & (mask as bigint));
  });
}
