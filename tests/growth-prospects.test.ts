import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGrowthProspectCsv,
  buildGrowthProspectDedupeKey,
  canTransitionGrowthProspectStatus,
  normalizeProspectWebsite,
  resolveGrowthProspectSearchProvider,
  searchGrowthProspectCandidates,
  validateGrowthProspectInput,
  validateGrowthProspectListQuery,
  validateGrowthProspectUpdate
} from '../src/server/growthProspects';

test('website normalisation strips scheme, www and path', () => {
  assert.equal(normalizeProspectWebsite('https://www.Example.com/path?x=1'), 'example.com');
  assert.equal(normalizeProspectWebsite('example.com'), 'example.com');
  assert.equal(normalizeProspectWebsite('ftp://example.com'), null);
  assert.equal(normalizeProspectWebsite('not a domain'), null);
  assert.equal(normalizeProspectWebsite(''), null);
});

test('dedupe key prefers the website host and falls back to name plus market', () => {
  assert.equal(
    buildGrowthProspectDedupeKey({ companyName: 'Alpha Srl', website: 'https://www.alpha.it/contatti', country: 'Italy', city: 'Milano' }),
    'web:alpha.it'
  );
  assert.equal(
    buildGrowthProspectDedupeKey({ companyName: 'Alpha  Srl.', website: null, country: 'Italy', city: 'Milano' }),
    'name:alpha srl|italy|milano'
  );
  assert.notEqual(
    buildGrowthProspectDedupeKey({ companyName: 'Alpha Srl', country: 'Italy', city: 'Milano' }),
    buildGrowthProspectDedupeKey({ companyName: 'Alpha Srl', country: 'Italy', city: 'Roma' })
  );
});

test('prospect input validation normalises fields and rejects bad values', () => {
  const parsed = validateGrowthProspectInput({
    companyName: '  Alpha Srl  ',
    email: 'sales@alpha.it',
    website: 'www.alpha.it',
    businessType: 'wholesaler',
    source: 'import',
    nextFollowUpAt: '2026-11-01T09:00:00.000Z'
  });
  assert.equal(parsed.companyName, 'Alpha Srl');
  assert.equal(parsed.website, 'alpha.it');
  assert.equal(parsed.businessType, 'wholesaler');
  assert.equal(parsed.source, 'import');
  assert.equal(parsed.nextFollowUpAt, '2026-11-01T09:00:00.000Z');

  assert.throws(() => validateGrowthProspectInput({ companyName: '' }), /GROWTH_PROSPECT_INVALID/);
  assert.throws(() => validateGrowthProspectInput({ companyName: 'A', email: 'nope' }), /GROWTH_PROSPECT_INVALID/);
  assert.throws(() => validateGrowthProspectInput({ companyName: 'A', businessType: 'retail' }), /GROWTH_PROSPECT_INVALID/);
  assert.throws(() => validateGrowthProspectInput({ companyName: 'A', source: 'ai_research' }), /GROWTH_PROSPECT_INVALID/);
  assert.throws(() => validateGrowthProspectInput({ companyName: 'A', sourceUrl: 'javascript:alert(1)' }), /GROWTH_PROSPECT_INVALID/);
});

test('prospect update validation only accepts known keys and enums', () => {
  const update = validateGrowthProspectUpdate({ status: 'contacted', nextFollowUpAt: '2026-11-02T08:00:00.000Z' });
  assert.equal(update.status, 'contacted');
  assert.equal(update.nextFollowUpAt, '2026-11-02T08:00:00.000Z');

  assert.throws(() => validateGrowthProspectUpdate({}), /GROWTH_PROSPECT_UPDATE_INVALID/);
  assert.throws(() => validateGrowthProspectUpdate({ status: 'won' }), /GROWTH_PROSPECT_UPDATE_INVALID/);
  assert.throws(() => validateGrowthProspectUpdate({ dedupeKey: 'x' }), /GROWTH_PROSPECT_UPDATE_INVALID/);
  assert.equal(validateGrowthProspectUpdate({ nextFollowUpAt: null }).nextFollowUpAt, null);
});

test('prospect status transitions follow the documented state machine', () => {
  assert.equal(canTransitionGrowthProspectStatus('new', 'contacted'), true);
  assert.equal(canTransitionGrowthProspectStatus('contacted', 'negotiating'), true);
  assert.equal(canTransitionGrowthProspectStatus('negotiating', 'onboarded'), true);
  assert.equal(canTransitionGrowthProspectStatus('onboarded', 'new'), false);
  assert.equal(canTransitionGrowthProspectStatus('paused', 'contacted'), true);
});

test('list query validation clamps paging and rejects unknown filters', () => {
  assert.deepEqual(validateGrowthProspectListQuery({ status: 'new', due: 'today', limit: '500', offset: '-3' }), {
    status: 'new', q: '', country: '', due: 'today', limit: 200, offset: 0
  });
  assert.throws(() => validateGrowthProspectListQuery({ status: 'lead' }), /GROWTH_PROSPECT_QUERY_INVALID/);
  assert.throws(() => validateGrowthProspectListQuery({ due: 'tomorrow' }), /GROWTH_PROSPECT_QUERY_INVALID/);
});

test('csv export quotes separators and maps labels', () => {
  const csv = buildGrowthProspectCsv([{
    companyName: 'Alpha, Srl',
    contactName: 'Mario "Rossi"',
    email: 'sales@alpha.it',
    phone: null,
    website: 'alpha.it',
    country: 'Italy',
    city: 'Milano',
    businessType: 'wholesaler',
    status: 'contacted',
    source: 'manual',
    sourceUrl: 'https://alpha.it',
    nextFollowUpAt: null,
    lastContactAt: null,
    createdAt: new Date('2026-10-26T00:00:00.000Z'),
    customerId: null,
    merchantId: null
  }]);
  const [, row] = csv.split('\r\n');
  assert.match(csv, /^企业名称,联系人/);
  assert.match(row, /^"Alpha, Srl","Mario ""Rossi"""/);
  assert.match(row, /服装批发商/);
  assert.match(row, /已联系/);
});

test('search provider resolution is explicit and fails closed', () => {
  assert.equal(resolveGrowthProspectSearchProvider({}), null);
  assert.equal(resolveGrowthProspectSearchProvider({ PROSPECT_SEARCH_PROVIDER: 'serper' }), null);
  assert.deepEqual(
    resolveGrowthProspectSearchProvider({ PROSPECT_SEARCH_PROVIDER: 'serper', SERPER_API_KEY: 'key-1' }),
    { provider: 'serper', apiKey: 'key-1' }
  );
});

test('search adapter maps provider results to sourced candidates', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init || {} });
    return new Response(JSON.stringify({
      organic: [
        { title: 'Alpha Srl | Wholesale fashion', link: 'https://www.alpha.it/en', snippet: 'Milano wholesaler' },
        { title: 'Alpha Srl | Wholesale fashion', link: 'https://alpha.it/en', snippet: 'duplicate host' },
        { title: 'No link entry' },
        { title: 'Beta Trading - B2B', link: 'https://beta.example.com', snippet: 'Trading company' }
      ]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;

  const candidates = await searchGrowthProspectCandidates({
    query: 'fashion wholesaler',
    country: 'Italy',
    limit: 10,
    apiKey: 'key-1',
    fetchImpl
  });

  assert.equal(calls.length, 1);
  assert.match(String(calls[0].init.body), /fashion wholesaler Italy/);
  assert.deepEqual(candidates.map(item => item.companyName), ['Alpha Srl', 'Beta Trading']);
  assert.equal(candidates[0].website, 'alpha.it');
  assert.equal(candidates[0].sourceUrl, 'https://www.alpha.it/en');
});

test('search adapter surfaces provider failures instead of returning empty data', async () => {
  const fetchImpl = (async () => new Response('denied', { status: 401 })) as unknown as typeof fetch;
  await assert.rejects(
    () => searchGrowthProspectCandidates({ query: 'x', apiKey: 'key', fetchImpl }),
    /GROWTH_PROSPECT_SEARCH_PROVIDER_FAILED/
  );
});


