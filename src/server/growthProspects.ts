/**
 * Growth prospecting domain rules for the platform admin growth module.
 *
 * Keep this module pure (no Prisma client, no Express) so normalisation, dedupe and
 * validation rules can be unit tested without a database. Storage stays in `GrowthProspect`.
 */

export const growthProspectStatuses = ['new', 'contacted', 'negotiating', 'registered', 'onboarded', 'paused'] as const;
export type GrowthProspectStatus = (typeof growthProspectStatuses)[number];

export const growthProspectBusinessTypes = ['wholesaler', 'brand', 'trading', 'other'] as const;
export type GrowthProspectBusinessType = (typeof growthProspectBusinessTypes)[number];

export const growthProspectSources = ['manual', 'import', 'ai_research'] as const;
export type GrowthProspectSource = (typeof growthProspectSources)[number];

export const growthProspectBusinessTypeLabels: Record<GrowthProspectBusinessType, string> = {
  wholesaler: '服装批发商',
  brand: '品牌商',
  trading: '贸易公司',
  other: '其他'
};

export const growthProspectStatusLabels: Record<GrowthProspectStatus, string> = {
  new: '待联系',
  contacted: '已联系',
  negotiating: '洽谈中',
  registered: '已注册',
  onboarded: '已入驻',
  paused: '暂不跟进'
};

const STATUS_TRANSITIONS: Record<GrowthProspectStatus, GrowthProspectStatus[]> = {
  new: ['contacted', 'negotiating', 'registered', 'onboarded', 'paused'],
  contacted: ['negotiating', 'registered', 'onboarded', 'paused'],
  negotiating: ['registered', 'onboarded', 'paused'],
  registered: ['onboarded', 'negotiating', 'paused'],
  onboarded: ['paused'],
  paused: ['contacted', 'negotiating', 'paused']
};

export function canTransitionGrowthProspectStatus(from: GrowthProspectStatus, to: GrowthProspectStatus): boolean {
  if (from === to) return true;
  return STATUS_TRANSITIONS[from].includes(to);
}

export type GrowthProspectInput = {
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  businessType: GrowthProspectBusinessType;
  source: Extract<GrowthProspectSource, 'manual' | 'import'>;
  sourceUrl: string | null;
  sourceNote: string | null;
  nextFollowUpAt: string | null;
};

export type GrowthProspectUpdate = Partial<{
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  businessType: GrowthProspectBusinessType;
  sourceUrl: string | null;
  sourceNote: string | null;
  status: GrowthProspectStatus;
  nextFollowUpAt: string | null;
  lastContactAt: string | null;
  customerId: string | null;
  merchantId: string | null;
}>;

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const IPV4_HOST_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length > maxLength || CONTROL_CHARACTERS.test(trimmed)) {
    throw new Error('GROWTH_PROSPECT_INVALID');
  }
  return trimmed;
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  const cleaned = cleanText(value, maxLength);
  return cleaned ? cleaned : null;
}

export function normalizeProspectWebsite(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || CONTROL_CHARACTERS.test(host)) return null;
  if (host === 'localhost' || IPV4_HOST_PATTERN.test(host)) return host;
  if (!host.includes('.')) return null;
  return host.replace(/^www\./, '');
}

export function buildGrowthProspectDedupeKey(input: {
  companyName: string;
  website?: string | null;
  country?: string | null;
  city?: string | null;
}): string {
  const host = normalizeProspectWebsite(input.website);
  if (host) return `web:${host}`;
  const normalize = (value: string | null | undefined) => (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim();
  return `name:${normalize(input.companyName)}|${normalize(input.country)}|${normalize(input.city)}`;
}

export function validateGrowthProspectInput(value: unknown): GrowthProspectInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('GROWTH_PROSPECT_INVALID');
  }
  const body = value as Record<string, unknown>;
  const companyName = cleanText(body.companyName, 200);
  if (!companyName) throw new Error('GROWTH_PROSPECT_INVALID');
  const email = optionalText(body.email, 200);
  if (email && !EMAIL_PATTERN.test(email)) throw new Error('GROWTH_PROSPECT_INVALID');
  const website = optionalText(body.website, 300);
  if (website && !normalizeProspectWebsite(website)) throw new Error('GROWTH_PROSPECT_INVALID');
  const sourceUrl = optionalText(body.sourceUrl, 600);
  if (sourceUrl && !/^https?:\/\/\S+$/i.test(sourceUrl)) throw new Error('GROWTH_PROSPECT_INVALID');
  const businessType = (body.businessType === undefined || body.businessType === null || body.businessType === ''
    ? 'other'
    : body.businessType) as GrowthProspectBusinessType;
  if (!growthProspectBusinessTypes.includes(businessType)) throw new Error('GROWTH_PROSPECT_INVALID');
  const source = (body.source === undefined || body.source === null || body.source === ''
    ? 'manual'
    : body.source) as GrowthProspectInput['source'];
  if (source !== 'manual' && source !== 'import') throw new Error('GROWTH_PROSPECT_INVALID');
  let nextFollowUpAt: string | null = null;
  if (body.nextFollowUpAt !== undefined && body.nextFollowUpAt !== null && body.nextFollowUpAt !== '') {
    const dueAt = typeof body.nextFollowUpAt === 'string' ? body.nextFollowUpAt : '';
    if (!Number.isFinite(Date.parse(dueAt))) throw new Error('GROWTH_PROSPECT_INVALID');
    nextFollowUpAt = new Date(dueAt).toISOString();
  }
  return {
    companyName,
    contactName: optionalText(body.contactName, 120),
    email,
    phone: optionalText(body.phone, 60),
    website: website ? normalizeProspectWebsite(website) : null,
    country: optionalText(body.country, 80),
    city: optionalText(body.city, 120),
    businessType,
    source,
    sourceUrl,
    sourceNote: optionalText(body.sourceNote, 600),
    nextFollowUpAt
  };
}

export function validateGrowthProspectUpdate(value: unknown): GrowthProspectUpdate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('GROWTH_PROSPECT_UPDATE_INVALID');
  }
  const body = value as Record<string, unknown>;
  const allowedKeys = new Set([
    'companyName', 'contactName', 'email', 'phone', 'website', 'country', 'city',
    'businessType', 'sourceUrl', 'sourceNote', 'status', 'nextFollowUpAt', 'lastContactAt',
    'customerId', 'merchantId'
  ]);
  if (!Object.keys(body).length || Object.keys(body).some(key => !allowedKeys.has(key))) {
    throw new Error('GROWTH_PROSPECT_UPDATE_INVALID');
  }
  const update: GrowthProspectUpdate = {};
  if ('companyName' in body) {
    const companyName = cleanText(body.companyName, 200);
    if (!companyName) throw new Error('GROWTH_PROSPECT_UPDATE_INVALID');
    update.companyName = companyName;
  }
  if ('contactName' in body) update.contactName = optionalText(body.contactName, 120);
  if ('email' in body) {
    const email = optionalText(body.email, 200);
    if (email && !EMAIL_PATTERN.test(email)) throw new Error('GROWTH_PROSPECT_UPDATE_INVALID');
    update.email = email;
  }
  if ('phone' in body) update.phone = optionalText(body.phone, 60);
  if ('website' in body) {
    const website = optionalText(body.website, 300);
    const host = website ? normalizeProspectWebsite(website) : null;
    if (website && !host) throw new Error('GROWTH_PROSPECT_UPDATE_INVALID');
    update.website = host;
  }
  if ('country' in body) update.country = optionalText(body.country, 80);
  if ('city' in body) update.city = optionalText(body.city, 120);
  if ('businessType' in body) {
    if (!growthProspectBusinessTypes.includes(body.businessType as GrowthProspectBusinessType)) {
      throw new Error('GROWTH_PROSPECT_UPDATE_INVALID');
    }
    update.businessType = body.businessType as GrowthProspectBusinessType;
  }
  if ('sourceUrl' in body) {
    const sourceUrl = optionalText(body.sourceUrl, 600);
    if (sourceUrl && !/^https?:\/\/\S+$/i.test(sourceUrl)) throw new Error('GROWTH_PROSPECT_UPDATE_INVALID');
    update.sourceUrl = sourceUrl;
  }
  if ('sourceNote' in body) update.sourceNote = optionalText(body.sourceNote, 600);
  if ('status' in body) {
    if (!growthProspectStatuses.includes(body.status as GrowthProspectStatus)) {
      throw new Error('GROWTH_PROSPECT_UPDATE_INVALID');
    }
    update.status = body.status as GrowthProspectStatus;
  }
  for (const key of ['nextFollowUpAt', 'lastContactAt'] as const) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (raw === null || raw === '') {
      update[key] = null;
      continue;
    }
    if (typeof raw !== 'string' || !Number.isFinite(Date.parse(raw))) {
      throw new Error('GROWTH_PROSPECT_UPDATE_INVALID');
    }
    update[key] = new Date(raw).toISOString();
  }
  for (const key of ['customerId', 'merchantId'] as const) {
    if (!(key in body)) continue;
    const raw = optionalText(body[key], 80);
    if (raw && !/^[A-Za-z0-9_-]{4,80}$/.test(raw)) throw new Error('GROWTH_PROSPECT_UPDATE_INVALID');
    update[key] = raw;
  }
  return update;
}

export function validateGrowthProspectListQuery(query: Record<string, unknown>): {
  status: GrowthProspectStatus | 'all';
  q: string;
  country: string;
  due: 'today' | 'overdue' | 'none';
  limit: number;
  offset: number;
} {
  const rawStatus = typeof query.status === 'string' ? query.status.trim() : 'all';
  if (rawStatus !== 'all' && !growthProspectStatuses.includes(rawStatus as GrowthProspectStatus)) {
    throw new Error('GROWTH_PROSPECT_QUERY_INVALID');
  }
  const rawDue = typeof query.due === 'string' ? query.due.trim() : '';
  if (rawDue && rawDue !== 'today' && rawDue !== 'overdue') throw new Error('GROWTH_PROSPECT_QUERY_INVALID');
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 120) : '';
  const country = typeof query.country === 'string' ? query.country.trim().slice(0, 80) : '';
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 200);
  const offset = Math.max(Number(query.offset) || 0, 0);
  return {
    status: rawStatus as GrowthProspectStatus | 'all',
    q,
    country,
    due: (rawDue || 'none') as 'today' | 'overdue' | 'none',
    limit,
    offset
  };
}

export type GrowthProspectCsvRow = {
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  businessType: string;
  status: string;
  source: string;
  sourceUrl: string | null;
  nextFollowUpAt: Date | null;
  lastContactAt: Date | null;
  createdAt: Date;
  customerId: string | null;
  merchantId: string | null;
};

function csvCell(value: string | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildGrowthProspectCsv(rows: GrowthProspectCsvRow[]): string {
  const header = [
    '企业名称', '联系人', '邮箱', '电话', '官网', '国家', '城市', '企业类型', '状态', '来源',
    '来源链接', '下次跟进', '最近联系', '采集时间', '关联采购商', '关联商家'
  ];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([
      csvCell(row.companyName),
      csvCell(row.contactName),
      csvCell(row.email),
      csvCell(row.phone),
      csvCell(row.website),
      csvCell(row.country),
      csvCell(row.city),
      csvCell(growthProspectBusinessTypeLabels[row.businessType as GrowthProspectBusinessType] || row.businessType),
      csvCell(growthProspectStatusLabels[row.status as GrowthProspectStatus] || row.status),
      csvCell(row.source),
      csvCell(row.sourceUrl),
      csvCell(row.nextFollowUpAt ? row.nextFollowUpAt.toISOString() : ''),
      csvCell(row.lastContactAt ? row.lastContactAt.toISOString() : ''),
      csvCell(row.createdAt.toISOString()),
      csvCell(row.customerId),
      csvCell(row.merchantId)
    ].join(','));
  }
  return lines.join('\r\n');
}

/**
 * Prospect discovery needs a configured web-search provider. RUDA ships no bundled search
 * integration, so the endpoint must report the missing configuration instead of inventing
 * companies. Only Serper is implemented; another provider means adding an adapter here.
 */
export function resolveGrowthProspectSearchProvider(env: NodeJS.ProcessEnv = process.env): {
  provider: 'serper';
  apiKey: string;
} | null {
  const configured = (env.PROSPECT_SEARCH_PROVIDER || '').trim().toLowerCase();
  const serperKey = (env.SERPER_API_KEY || '').trim();
  if (configured === 'serper' && serperKey) return { provider: 'serper', apiKey: serperKey };
  return null;
}

export type GrowthProspectSearchCandidate = {
  companyName: string;
  website: string | null;
  country: string | null;
  sourceUrl: string;
  sourceNote: string;
};

export async function searchGrowthProspectCandidates(input: {
  query: string;
  country?: string;
  limit?: number;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<GrowthProspectSearchCandidate[]> {
  const fetchImpl = input.fetchImpl || fetch;
  const limit = Math.min(Math.max(input.limit || 10, 1), 20);
  const response = await fetchImpl('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': input.apiKey
    },
    body: JSON.stringify({
      q: input.country ? `${input.query} ${input.country}` : input.query,
      num: limit
    })
  });
  if (!response.ok) throw new Error('GROWTH_PROSPECT_SEARCH_PROVIDER_FAILED');
  const payload = await response.json() as { organic?: Array<{ title?: unknown; link?: unknown; snippet?: unknown }> };
  const organic = Array.isArray(payload.organic) ? payload.organic : [];
  const candidates: GrowthProspectSearchCandidate[] = [];
  const seen = new Set<string>();
  for (const item of organic.slice(0, limit)) {
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const link = typeof item.link === 'string' ? item.link.trim() : '';
    if (!title || !/^https?:\/\//i.test(link)) continue;
    const host = normalizeProspectWebsite(link);
    if (!host) continue;
    const companyName = (title.split(/\s+[|\-\u2013\u2014]\s+/)[0].trim() || title).slice(0, 200);
    const key = `${host}:${companyName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      companyName,
      website: host,
      country: input.country ? input.country.slice(0, 80) : null,
      sourceUrl: link.slice(0, 600),
      sourceNote: typeof item.snippet === 'string' ? item.snippet.trim().slice(0, 300) : ''
    });
  }
  return candidates;
}
