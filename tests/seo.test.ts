import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  canonicalPublicUrl,
  getLocalizedSeo,
  getMerchantSeo,
  getProductSeo,
  localizedPath,
  parseLocalizedPath,
  primaryRootRedirect,
  SEO_LANGUAGES,
  SEO_PUBLIC_PAGES
} from '../src/shared/seo';
import {
  isExpectedPrimaryRootRedirect,
  validateLocalizedSeoHtml
} from '../src/shared/seoSmoke';

test('builds and parses stable localized routes for all supported languages', () => {
  for (const language of SEO_LANGUAGES) {
    const localizedHome = localizedPath('/', language);
    assert.equal(localizedHome, `/${language}/`);
    assert.deepEqual(parseLocalizedPath(localizedHome), { language, pathname: '/' });
    assert.equal(localizedPath('/it/catalog/', language), `/${language}/catalog`);
    assert.equal(canonicalPublicUrl('/shop/example', language), `https://modaui.com/${language}/shop/example`);
  }
});

test('leaves non-locale path segments intact and recognizes locale prefixes case-insensitively', () => {
  assert.deepEqual(parseLocalizedPath('/trends/it'), { language: null, pathname: '/trends/it' });
  assert.deepEqual(parseLocalizedPath('/IT/catalog'), { language: 'it', pathname: '/catalog' });
});

test('routes primary and merchant domain roots before static index handling', () => {
  assert.equal(primaryRootRedirect('modaui.com'), '/it/');
  assert.equal(primaryRootRedirect('WWW.MODAUI.COM'), '/it/');
  assert.equal(primaryRootRedirect('ruda.fashion'), '/merchant');
  assert.equal(primaryRootRedirect('www.ruda.fashion'), null);
  assert.equal(primaryRootRedirect('merchant.ruda.fashion'), null);
  assert.equal(primaryRootRedirect('xs.ruda.fashion'), null);
  assert.equal(primaryRootRedirect('ruda.example'), null);

  const serverSource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const redirectPosition = serverSource.indexOf("app.get('/', (req, res, next) => {");
  const staticPosition = serverSource.indexOf('app.use(express.static(distPath, {');
  const wildcardPosition = serverSource.indexOf("app.get('*', async (req, res) => {");
  assert.ok(redirectPosition >= 0 && staticPosition > redirectPosition);
  assert.ok(wildcardPosition > staticPosition);
  assert.match(serverSource.slice(staticPosition, wildcardPosition), /index:\s*false/);
});

test('post-deploy SEO validation catches wrong locale HTML and missing alternate URLs', () => {
  const origin = 'https://ruda.fashion';
  const english = getLocalizedSeo('home', 'en');
  const html = `<html lang="en"><head><title>${english.title}</title><meta property="og:locale" content="${english.ogLocale}"><link rel="canonical" href="${origin}/en/">${SEO_LANGUAGES
    .map(language => `<link rel="alternate" hreflang="${language}" href="${origin}/${language}/">`)
    .join('')}</head></html>`;
  assert.deepEqual(validateLocalizedSeoHtml({
    html,
    language: 'en',
    pathname: '/',
    origin
  }), []);
  const italian = getLocalizedSeo('home', 'it');
  assert.deepEqual(validateLocalizedSeoHtml({
    html: html
      .replace('lang="en"', 'lang="it"')
      .replace(`<title>${english.title}</title>`, `<title>${italian.title}</title>`)
      .replace(`content="${english.ogLocale}"`, `content="${italian.ogLocale}"`)
      .replace('href="https://ruda.fashion/fr/"', 'href="https://ruda.fashion/it/'),
    language: 'en',
    pathname: '/',
    origin
  }), ['language', 'title', 'og:locale', 'hreflang:fr']);
  assert.equal(isExpectedPrimaryRootRedirect(302, '/it/'), true);
  assert.equal(isExpectedPrimaryRootRedirect(200, null), false);

  const catalog = getLocalizedSeo('catalog', 'en');
  const catalogHtml = SEO_LANGUAGES.reduce((source, language) =>
    source.replaceAll(`${origin}/${language}/`, `${origin}/${language}/catalog`),
  html).replace(`<title>${english.title}</title>`, `<title>${catalog.title}</title>`);
  assert.deepEqual(validateLocalizedSeoHtml({
    html: catalogHtml,
    language: 'en',
    pathname: '/catalog',
    origin,
    page: 'catalog'
  }), []);
});

test('covers every public localized page in the deployment SEO smoke matrix', () => {
  const origin = 'https://ruda.fashion';
  assert.equal(SEO_PUBLIC_PAGES.length, 5);
  assert.equal(SEO_LANGUAGES.length * SEO_PUBLIC_PAGES.length, 60);

  for (const language of SEO_LANGUAGES) {
    for (const { page, pathname } of SEO_PUBLIC_PAGES) {
      const metadata = getLocalizedSeo(page, language);
      const html = `<html lang="${language}"><head><title>${metadata.title}</title><meta property="og:locale" content="${metadata.ogLocale}"><link rel="canonical" href="${origin}${localizedPath(pathname, language)}">${SEO_LANGUAGES
        .map(alternateLanguage => `<link rel="alternate" hreflang="${alternateLanguage}" href="${origin}${localizedPath(pathname, alternateLanguage)}">`)
        .join('')}</head></html>`;

      assert.deepEqual(validateLocalizedSeoHtml({
        html,
        language,
        pathname,
        origin,
        page
      }), [], `${language} ${page}`);
    }
  }
});

test('provides localized static and merchant SEO metadata without mixing Chinese into Italian', () => {
  const italian = getLocalizedSeo('home', 'it');
  const english = getLocalizedSeo('home', 'en');
  assert.match(italian.title, /Ingrosso/);
  assert.match(english.title, /Wholesale/);
  assert.doesNotMatch(italian.description, /欧洲/);
  assert.equal(italian.ogLocale, 'it_IT');
  assert.equal(english.ogLocale, 'en_GB');

  const merchant = getMerchantSeo({ name: 'Moda Studio', city: 'Milano' }, 'fr');
  assert.match(merchant.title, /Showroom officiel/);
  assert.match(merchant.description, /Moda Studio/);
});

test('uses real product identifiers in localized SEO and avoids untranslated source descriptions', () => {
  const italian = getProductSeo({
    name: 'Abito nero',
    styleNo: 'RU-42',
    description: 'Descrizione originale italiana'
  }, 'it');
  const french = getProductSeo({
    name: 'Abito nero',
    styleNo: 'RU-42',
    description: 'Descrizione originale italiana'
  }, 'fr');

  assert.match(italian.title, /RU-42/);
  assert.match(italian.description, /Descrizione originale italiana/);
  assert.match(french.description, /fournisseur vérifié/);
  assert.doesNotMatch(french.description, /Descrizione originale italiana/);
});

test('publishes valid agent discovery manifests and an actionable llms.txt', () => {
  const manifestPaths = [
    new URL('../public/ai-catalog.json', import.meta.url),
    new URL('../public/.well-known/ard.json', import.meta.url),
    new URL('../public/.well-known/ai-catalog.json', import.meta.url)
  ];
  for (const manifestPath of manifestPaths) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      entries: Array<Record<string, unknown>>;
    };
    assert.equal(manifest.entries.length, 1);
    const [entry] = manifest.entries;
    assert.equal(typeof entry.identifier, 'string');
    assert.equal(typeof entry.displayName, 'string');
    assert.equal(typeof entry.type, 'string');
    assert.equal(typeof entry.url, 'string');
    assert.equal('data' in entry, false);
    assert.ok(Array.isArray(entry.representativeQueries));
    assert.ok((entry.representativeQueries as string[]).length >= 2);
  }

  const llms = readFileSync(new URL('../public/llms.txt', import.meta.url), 'utf8');
  assert.match(llms, /^# RUDA Fashion B2B/m);
  assert.match(llms, /\[[^\]]+\]\(https:\/\//);
});
