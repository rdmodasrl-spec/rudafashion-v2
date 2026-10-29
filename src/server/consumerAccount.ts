/**
 * Consumer retail account domain rules (single source of truth).
 *
 * Addresses live on `Consumer.addresses` (JSON). These helpers keep validation
 * and normalization in one place so every route and test agrees on what a
 * valid consumer address looks like. Shop/order/promotion rules are NOT
 * re-implemented here: retail reads reuse the public product serializer and the
 * shared promotion calculator.
 */

export const CONSUMER_ADDRESS_LIMIT = 10;

export const CONSUMER_PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'phone',
  'country',
  'currency',
  'preferredLang',
  'newsletterOptIn'
] as const;

export type ConsumerProfileField = typeof CONSUMER_PROFILE_FIELDS[number];

export type ConsumerAddress = {
  id: string;
  label?: string;
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  city: string;
  country: string;
  zip: string;
  isDefault?: boolean;
};

export class ConsumerAddressError extends Error {
  constructor(public readonly code: 'CONSUMER_ADDRESS_INVALID' | 'CONSUMER_ADDRESS_NOT_FOUND' | 'CONSUMER_ADDRESS_LIMIT_REACHED') {
    super(code);
    this.name = 'ConsumerAddressError';
  }
}

const MAX_FIELD_LENGTH = 160;

const readText = (value: unknown, maxLength = MAX_FIELD_LENGTH): string => (
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
);

const joinNonEmpty = (parts: unknown[], separator: string): string => (
  parts.map(part => readText(part)).filter(Boolean).join(separator)
);

export const parseConsumerAddresses = (raw: unknown): ConsumerAddress[] => {
  const parsed = typeof raw === 'string'
    ? (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    })()
    : raw;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map(entry => ({
      id: readText(entry.id, 64),
      label: readText(entry.label, 40) || undefined,
      firstName: readText(entry.firstName),
      lastName: readText(entry.lastName),
      phone: readText(entry.phone, 40),
      street: readText(entry.street) || joinNonEmpty([entry.line1, entry.line2], ', '),
      city: readText(entry.city),
      country: readText(entry.country, 80),
      zip: readText(entry.zip, 20) || readText(entry.postalCode, 20),
      isDefault: entry.isDefault === true
    }))
    .filter(entry => entry.id && entry.firstName && entry.lastName && entry.street && entry.city && entry.country && entry.zip);
};

export const normalizeConsumerAddressInput = (
  input: unknown,
  fallbackId?: string
): ConsumerAddress => {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const address: ConsumerAddress = {
    id: readText(body.id, 64) || fallbackId || '',
    label: readText(body.label, 40) || undefined,
    firstName: readText(body.firstName),
    lastName: readText(body.lastName),
    phone: readText(body.phone, 40),
    street: readText(body.street) || joinNonEmpty([body.line1, body.line2], ', '),
    city: readText(body.city),
    country: readText(body.country, 80),
    zip: readText(body.zip, 20) || readText(body.postalCode, 20),
    isDefault: body.isDefault === true
  };
  const missing = (['firstName', 'lastName', 'phone', 'street', 'city', 'country', 'zip'] as const)
    .filter(field => !address[field]);
  if (missing.length) throw new ConsumerAddressError('CONSUMER_ADDRESS_INVALID');
  return address;
};

export const upsertConsumerAddress = (
  addresses: ConsumerAddress[],
  address: ConsumerAddress
): ConsumerAddress[] => {
  const existingIndex = addresses.findIndex(entry => entry.id === address.id);
  if (existingIndex < 0 && addresses.length >= CONSUMER_ADDRESS_LIMIT) {
    throw new ConsumerAddressError('CONSUMER_ADDRESS_LIMIT_REACHED');
  }
  const next = existingIndex < 0
    ? [...addresses, address]
    : addresses.map((entry, index) => (index === existingIndex ? address : entry));
  if (!address.isDefault) return next;
  return next.map(entry => (entry.id === address.id ? entry : ({ ...entry, isDefault: false })));
};

export const removeConsumerAddress = (addresses: ConsumerAddress[], id: string): ConsumerAddress[] => {
  const next = addresses.filter(entry => entry.id !== id);
  if (next.length === addresses.length) throw new ConsumerAddressError('CONSUMER_ADDRESS_NOT_FOUND');
  return next;
};

export type ConsumerProfilePatch = {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  country?: string | null;
  currency?: string;
  preferredLang?: string | null;
  newsletterOptIn?: boolean;
};

export const pickConsumerProfilePatch = (input: unknown): ConsumerProfilePatch => {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const patch: ConsumerProfilePatch = {};
  if (typeof body.firstName === 'string' && body.firstName.trim()) patch.firstName = readText(body.firstName, 80);
  if (typeof body.lastName === 'string' && body.lastName.trim()) patch.lastName = readText(body.lastName, 80);
  if (body.phone !== undefined) patch.phone = readText(body.phone, 40) || null;
  if (body.country !== undefined) patch.country = readText(body.country, 80) || null;
  if (typeof body.currency === 'string') {
    const currency = readText(body.currency, 8);
    if (/^[A-Za-z]{3}$/.test(currency)) patch.currency = currency.toUpperCase();
  }
  if (body.preferredLang !== undefined) {
    const lang = readText(body.preferredLang, 8).toLowerCase();
    patch.preferredLang = lang || null;
  }
  if (typeof body.newsletterOptIn === 'boolean') patch.newsletterOptIn = body.newsletterOptIn;
  return patch;
};

export const CONSUMER_WISHLIST_LIMIT = 200;
