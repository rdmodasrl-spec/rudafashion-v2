import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectPreferredBrowserLanguage,
  getLocalizedMerchantName,
  getIntlLocale,
  getLocalizedColor,
  getLocalizedProductName,
  getOpenGraphLocale,
  isLanguage,
  interpolateUiCopy,
  LANGUAGE_OPTIONS,
  TRANSLATIONS,
  translate
} from '../src/i18n/translations';

function withBrowserLanguages(languages: string[], run: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { languages, language: languages[0] || '' }
  });
  try {
    run();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
}

test('supports the configured twelve language codes', () => {
  assert.equal(LANGUAGE_OPTIONS.length, 12);
  for (const { code } of LANGUAGE_OPTIONS) assert.equal(isLanguage(code), true);
  assert.equal(isLanguage('sv'), false);
});

test('auto-detection respects browser language priority and regional tags', () => {
  withBrowserLanguages(['fr-CA', 'zh-CN', 'it-IT'], () => {
    assert.equal(detectPreferredBrowserLanguage(), 'fr');
  });
  withBrowserLanguages(['de_DE', 'en-GB'], () => {
    assert.equal(detectPreferredBrowserLanguage(), 'de');
  });
  withBrowserLanguages(['sv-SE', 'pt-BR'], () => {
    assert.equal(detectPreferredBrowserLanguage(), 'pt');
  });
});

test('auto-detection falls back to English when no browser language is supported', () => {
  withBrowserLanguages(['sv-SE', 'da-DK'], () => {
    assert.equal(detectPreferredBrowserLanguage(), 'en');
  });
});

test('Italian and Chinese base dictionaries have matching, non-empty keys', () => {
  assert.deepEqual(Object.keys(TRANSLATIONS.it).sort(), Object.keys(TRANSLATIONS.zh).sort());
  for (const key of Object.keys(TRANSLATIONS.it) as Array<keyof typeof TRANSLATIONS.it>) {
    assert.ok(TRANSLATIONS.it[key].trim(), `Italian translation missing for ${key}`);
    assert.ok(TRANSLATIONS.zh[key].trim(), `Chinese translation missing for ${key}`);
  }
});

test('primary navigation and merchant registration copy stay compact', () => {
  const navigationKeys = [
    'navBuyer', 'navMerchant', 'navPlatform', 'navTerms', 'navShowrooms',
    'navReorder', 'navMyBusiness', 'navCatalog', 'navCart', 'navOrders'
  ] as const;
  for (const key of navigationKeys) {
    assert.ok(TRANSLATIONS.it[key].length <= 12, `${key} is too long in Italian`);
    assert.ok(TRANSLATIONS.zh[key].length <= 8, `${key} is too long in Chinese`);
  }
  assert.ok(TRANSLATIONS.it.authMerchantRegisterTitle.length <= 18);
  assert.ok(TRANSLATIONS.it.authMerchantRegisterSubtitle.length <= 40);
  assert.ok(TRANSLATIONS.it.analyticsMessage.length <= 140);
  assert.ok(TRANSLATIONS.it.catalogSyncFailedMessage.length <= 110);
});

test('unsupported static-copy languages use one consistent Italian fallback', () => {
  assert.equal(translate('brandLocation', 'it'), TRANSLATIONS.it.brandLocation);
  assert.equal(translate('brandLocation', 'zh'), TRANSLATIONS.zh.brandLocation);
  assert.equal(translate('brandLocation', 'fr'), TRANSLATIONS.it.brandLocation);
});

test('Open Graph locale maps every supported language correctly', () => {
  const locales = LANGUAGE_OPTIONS.map(({ code }) => getOpenGraphLocale(code));
  assert.deepEqual(locales, [
    'en_GB', 'it_IT', 'zh_CN', 'fr_FR', 'de_DE', 'es_ES',
    'pt_PT', 'nl_NL', 'pl_PL', 'ro_RO', 'tr_TR', 'ar_SA'
  ]);
  assert.deepEqual(LANGUAGE_OPTIONS.map(({ code }) => getIntlLocale(code)), [
    'en-GB', 'it-IT', 'zh-CN', 'fr-FR', 'de-DE', 'es-ES',
    'pt-PT', 'nl-NL', 'pl-PL', 'ro-RO', 'tr-TR', 'ar-SA'
  ]);
});

test('non-Chinese locales do not leak Chinese-only product labels', () => {
  for (const { code } of LANGUAGE_OPTIONS.filter(language => language.code !== 'zh')) {
    const name = getLocalizedProductName({ name: '连衣裙', name_zh: '连衣裙', name_it: 'Abito' }, code);
    const color = getLocalizedColor('Nero 黑色', code);
    assert.equal(/\p{Script=Han}/u.test(name), false, `Chinese product label leaked into ${code}`);
    assert.equal(/\p{Script=Han}/u.test(color), false, `Chinese color leaked into ${code}`);
  }
  assert.equal(getLocalizedProductName({ name: '连衣裙', name_zh: '连衣裙' }, 'fr'), 'Articolo RUDA');
  assert.equal(getLocalizedColor('黑色', 'de'), 'Colore');
});

test('merchant names prefer stored Italian outside Chinese without translating business identity', () => {
  const merchant = {
    name: 'RUDA Atelier',
    name_it: 'Atelier RUDA',
    name_zh: '如达工作室'
  };
  assert.equal(getLocalizedMerchantName(merchant, 'fr'), 'Atelier RUDA');
  assert.equal(getLocalizedMerchantName(merchant, 'zh'), '如达工作室');
  assert.equal(getLocalizedMerchantName({ name: 'Brand Name', name_zh: '品牌名称' }, 'de'), 'Brand Name');
});

test('localized templates restore runtime values only after translation', () => {
  assert.equal(
    interpolateUiCopy('Totale: {{RUDA_ARG_0}} {{RUDA_ARG_1}}', [12, 'articoli']),
    'Totale: 12 articoli'
  );
  assert.equal(interpolateUiCopy('Salva {{RUDA_ARG_0}}', []), 'Salva {{RUDA_ARG_0}}');
});
