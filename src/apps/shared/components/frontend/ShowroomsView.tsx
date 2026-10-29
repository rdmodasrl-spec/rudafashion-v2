import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Globe, LockKeyhole, MapPin, Phone, UnlockKeyhole } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { getLocalizedMerchantName } from '../../../../i18n/translations';
import { Merchant } from '../../../../types/b2b';
import { merchantIndustries, type MerchantIndustry } from '../../../../constants/merchantIndustries';
import { merchantStorefrontUrl } from '../../../../shared/merchantStoreUrl';
import { buildMerchantMapUrl } from '../../../../shared/merchantMapUrl';
import { normalizeMerchantWebsiteUrl } from '../../../../shared/merchantWebsiteUrl';
import { ShareButton } from '../common/ShareButton';
import { MerchantFinder } from './MerchantFinder';

const normalizeFilterValue = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const isPlaceholderMerchantText = (value?: string) =>
  !value?.trim() || /demo|example|RUDA\s*演示店|演示商家|演示内容不代表真实商家|占位内容|示例内容/i.test(value);
const ShowroomImage: React.FC<{
  src?: string;
  alt: string;
  fallbackText: string;
  className: string;
  imageClassName?: string;
}> = ({ src, alt, fallbackText, className, imageClassName = '' }) => (
  <div className={`relative isolate flex items-center justify-center overflow-hidden bg-neutral-100 ${className}`}>
    <span aria-hidden="true" className="line-clamp-2 select-none px-3 text-center font-serif text-xl tracking-[0.12em] text-neutral-400">
      {fallbackText}
    </span>
    {src && (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={event => { event.currentTarget.style.opacity = '1'; }}
        onError={event => { event.currentTarget.style.opacity = '0'; }}
        className={`absolute inset-0 h-full w-full object-cover opacity-0 transition duration-700 ${imageClassName}`}
      />
    )}
  </div>
);
const getMerchantCategory = (merchant: Merchant) => {
  const businessType = normalizeFilterValue(merchant.businessType || '').replace(/[\s_-]/g, '');
  if (/leather|leathergoods|pelletteria|皮包|皮具/.test(businessType)) return 'leather';
  if (/producer|brandsupplier|manufacturer|atelier|生产商|品牌商|工厂|produttor|manifattur/.test(businessType)) return 'iolo';
  if (/wholesaler|wholesale|distributor|批发商|分销商|代理|grossist|distribut/.test(businessType)) return 'tavoro';
  if (/retailer|retail|boutique|零售商|零售店|rivenditor/.test(businessType)) return 'boutique_department';

  if (merchant.merchantZone === 'iolo' || merchant.merchantZone === 'tavoro' || merchant.merchantZone === 'leather' || merchant.merchantZone === 'boutique_department') {
    return merchant.merchantZone;
  }
  return null;
};
type BusinessIndustryFilter = MerchantIndustry;
const getBusinessIndustry = (merchant: Merchant): BusinessIndustryFilter | null => {
  const industry = (merchant.industry || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const matchingIndustry = merchantIndustries.find(value => value.id === industry);
  if (matchingIndustry) return matchingIndustry.id;
  if (industry === 'FASHION_WHOLESALE' || industry === 'WHOLESALE_COMPANY') return 'FASHION_COMPANY';
  const businessType = normalizeFilterValue(merchant.businessType || '').replace(/[\s_-]/g, '');
  if (/restaurant|takeaway|takeout|餐馆|餐饮|外卖|ristorant|asporto/.test(businessType)) return 'RESTAURANT';
  if (/departmentstore|百货/.test(businessType)) return 'DEPARTMENT_STORE';
  if (/tradingcompany|贸易公司/.test(businessType)) return 'TRADING_COMPANY';
  if (/leather|leathergoods|pelletteria|皮包|皮具/.test(businessType) || merchant.merchantZone === 'leather') return 'LEATHER_GOODS';
  if (/retailer|retail|boutique|零售商|零售店|rivenditor/.test(businessType) || merchant.merchantZone === 'boutique_department') return 'RETAIL_STORE';
  if (/fashioncompany|wholesale|wholesaler|distributor|服装公司|批发商|批发公司/.test(businessType)
    || merchant.merchantZone === 'iolo'
    || merchant.merchantZone === 'tavoro') return 'FASHION_COMPANY';
  return null;
};
const countryAliases: Record<string, string> = {
  italia: 'italy',
  italy: 'italy',
  意大利: 'italy',
  it: 'italy',
  francia: 'france',
  france: 'france',
  法国: 'france',
  spagna: 'spain',
  spain: 'spain',
  西班牙: 'spain',
  grecia: 'greece',
  greece: 'greece',
  希腊: 'greece',
  polonia: 'poland',
  poland: 'poland',
  波兰: 'poland',
  germania: 'germany',
  germany: 'germany',
  deutschland: 'germany',
  德国: 'germany',
  de: 'germany',
  'paesi bassi': 'netherlands',
  netherlands: 'netherlands',
  nederland: 'netherlands',
  olanda: 'netherlands',
  荷兰: 'netherlands',
  nl: 'netherlands',
  belgio: 'belgium',
  belgium: 'belgium',
  belgië: 'belgium',
  比利时: 'belgium',
  be: 'belgium',
  portogallo: 'portugal',
  portugal: 'portugal',
  葡萄牙: 'portugal',
  austria: 'austria',
  奥地利: 'austria',
  at: 'austria',
  svizzera: 'switzerland',
  switzerland: 'switzerland',
  schweiz: 'switzerland',
  suisse: 'switzerland',
  瑞士: 'switzerland',
  ch: 'switzerland',
  'regno unito': 'united kingdom',
  'united kingdom': 'united kingdom',
  uk: 'united kingdom',
  britain: 'united kingdom',
  '大不列颠': 'united kingdom',
  英国: 'united kingdom'
};
const europeanCountryOptions = [
  { key: 'italy', zh: '意大利', it: 'Italia' },
  { key: 'france', zh: '法国', it: 'Francia' },
  { key: 'spain', zh: '西班牙', it: 'Spagna' },
  { key: 'germany', zh: '德国', it: 'Germania' },
  { key: 'netherlands', zh: '荷兰', it: 'Paesi Bassi' },
  { key: 'belgium', zh: '比利时', it: 'Belgio' },
  { key: 'portugal', zh: '葡萄牙', it: 'Portogallo' },
  { key: 'greece', zh: '希腊', it: 'Grecia' },
  { key: 'poland', zh: '波兰', it: 'Polonia' },
  { key: 'austria', zh: '奥地利', it: 'Austria' },
  { key: 'switzerland', zh: '瑞士', it: 'Svizzera' },
  { key: 'united kingdom', zh: '英国', it: 'Regno Unito' }
];
const getCountryKey = (merchant: Merchant) => {
  const value = normalizeFilterValue(merchant.country || merchant.country_it || merchant.country_zh || '');
  return value ? countryAliases[value] || value : 'unknown';
};
const getCityKey = (merchant: Merchant) => {
  const value = normalizeFilterValue(merchant.city || merchant.city_it || merchant.city_zh || '');
  return value || 'unknown';
};

export const ShowroomsView: React.FC = () => {
  const {
    merchants,
    products,
    lang, localizeCopy, getVaultStatus
  } = useB2B();

  const isIt = lang === 'it';
  const businessTypeToZone: Record<string, string> = {
    producer: 'iolo',
    wholesaler: 'tavoro',
    retailer: 'boutique_department'
  };
  const zoneToBusinessType: Record<string, string> = {
    iolo: 'producer',
    tavoro: 'wholesaler',
    boutique_department: 'retailer'
  };
  const zoneToPath: Record<string, string> = {
    iolo: '/producers',
    tavoro: '/wholesalers',
    boutique_department: '/retailers'
  };
  const initialParams = new URLSearchParams(window.location.search);
  const pathBusinessType = window.location.pathname === '/producers'
    ? 'producer'
    : window.location.pathname === '/wholesalers'
      ? 'wholesaler'
      : window.location.pathname === '/retailers'
        ? 'retailer'
        : null;
  const [selectedZone, setSelectedZone] = useState<string>(() => {
    const businessType = initialParams.get('businessType');
    return pathBusinessType
      ? businessTypeToZone[pathBusinessType]
      : (businessType && businessTypeToZone[businessType]) || initialParams.get('showroomZone') || 'all';
  });
  const [selectedCountry, setSelectedCountry] = useState(() => {
    const country = new URLSearchParams(window.location.search).get('wholesaleCountry');
    if (!country) return 'all';
    const normalized = normalizeFilterValue(country);
    return countryAliases[normalized] || normalized;
  });
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedIndustry, setSelectedIndustry] = useState('all');
  const [selectedBusinessIndustry, setSelectedBusinessIndustry] = useState<BusinessIndustryFilter | 'all'>(() => {
    const requestedIndustry = initialParams.get('businessIndustry');
    return merchantIndustries.find(industry => industry.id === requestedIndustry)?.id || 'all';
  });
  useEffect(() => {
    const syncBusinessIndustry = () => {
      const requestedIndustry = new URLSearchParams(window.location.search).get('businessIndustry');
      setSelectedBusinessIndustry(merchantIndustries.find(industry => industry.id === requestedIndustry)?.id || 'all');
      setSelectedZone('all');
      setSelectedCountry('all');
      setSelectedCity('all');
      setSelectedIndustry('all');
    };
    window.addEventListener('ruda:directory-navigation', syncBusinessIndustry);
    window.addEventListener('popstate', syncBusinessIndustry);
    return () => {
      window.removeEventListener('ruda:directory-navigation', syncBusinessIndustry);
      window.removeEventListener('popstate', syncBusinessIndustry);
    };
  }, []);
  const merchantListRef = useRef<HTMLDivElement>(null);
  const zoneLabels: Record<string, string> = {
    iolo: localizeCopy('生产商', 'Produttori'),
    tavoro: localizeCopy('批发商', 'Grossisti'),
    leather: localizeCopy('精品皮包区', 'Pelletteria premium'),
    boutique_department: localizeCopy('零售商', 'Rivenditori')
  };
  const getCountryLabel = (merchant: Merchant) => {
    const matchedCountry = europeanCountryOptions.find(option => option.key === getCountryKey(merchant));
    if (matchedCountry) return localizeCopy(matchedCountry.zh, matchedCountry.it);
    const country = lang === 'zh'
      ? (merchant.country_zh || merchant.country)
      : (merchant.country_it || merchant.country);
    if (country) return country;
    if (getCountryKey(merchant) === 'unknown') return localizeCopy('国家未填写', 'Paese non specificato');
    return merchant.country;
  };
  const getCityLabel = (merchant: Merchant) => {
    const city = lang === 'zh'
      ? (merchant.city_zh || merchant.city)
      : (merchant.city_it || merchant.city);
    return city && !['待完善', '未填写', '待补充'].includes(city.trim())
      ? city
      : localizeCopy('城市未填写', 'Città non specificata');
  };
  const getIndustryValues = (merchant: Merchant) => {
    const values = [merchant.specialtyCategory, ...(merchant.specialties || [])]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(value => value.trim());
    return values.length > 0 ? [...new Set(values)] : [zoneLabels[merchant.merchantZone || ''] || localizeCopy('时尚行业', 'Settore moda')];
  };
  const merchantsInZone = useMemo(
    () => merchants.filter(merchant => selectedZone === 'all' || getMerchantCategory(merchant) === selectedZone),
    [merchants, selectedZone]
  );
  const countryOptions = useMemo(() => {
    const options = new Map<string, string>();
    europeanCountryOptions.forEach(country => {
      options.set(country.key, localizeCopy(country.zh, country.it));
    });
    merchantsInZone.forEach(merchant => {
      const key = getCountryKey(merchant);
      if (!options.has(key)) options.set(key, getCountryLabel(merchant));
    });
    return [...options.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [merchantsInZone, isIt, lang, localizeCopy]);
  const cityOptions = useMemo(() => {
    const options = new Map<string, string>();
    merchantsInZone
      .filter(merchant => selectedCountry === 'all' || getCountryKey(merchant) === selectedCountry)
      .forEach(merchant => options.set(getCityKey(merchant), getCityLabel(merchant)));
    return [...options.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [merchantsInZone, selectedCountry, lang, localizeCopy]);
  const industryOptions = useMemo(() => {
    const options = new Map<string, string>();
    merchantsInZone.forEach(merchant => getIndustryValues(merchant).forEach(value => options.set(normalizeFilterValue(value), value)));
    return [...options.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [merchantsInZone, lang, localizeCopy]);
  const industryFilteredMerchants = useMemo(
    () => selectedBusinessIndustry === 'all'
      ? merchantsInZone
      : merchantsInZone.filter(merchant => getBusinessIndustry(merchant) === selectedBusinessIndustry),
    [merchantsInZone, selectedBusinessIndustry]
  );
  const filteredMerchants = useMemo(() => industryFilteredMerchants.filter(merchant =>
    (selectedCountry === 'all' || getCountryKey(merchant) === selectedCountry) &&
    (selectedCity === 'all' || getCityKey(merchant) === selectedCity) &&
    (selectedIndustry === 'all' || getIndustryValues(merchant).some(value => normalizeFilterValue(value) === selectedIndustry))
  ), [industryFilteredMerchants, selectedCountry, selectedCity, selectedIndustry, isIt]);
  const handleBusinessIndustrySelect = (industry: BusinessIndustryFilter | 'all') => {
    setSelectedZone('all');
    setSelectedBusinessIndustry(industry);
    setSelectedCountry('all');
    setSelectedCity('all');
    setSelectedIndustry('all');
    const params = new URLSearchParams(window.location.search);
    params.delete('businessType');
    params.delete('showroomZone');
    params.delete('wholesaleCountry');
    if (industry === 'all') params.delete('businessIndustry');
    else params.set('businessIndustry', industry);
    window.history.replaceState({}, '', `/showrooms${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`);
    window.setTimeout(() => {
      merchantListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };
  const handleCountrySelect = (countryKey: string) => {
    setSelectedCountry(countryKey);
    setSelectedCity('all');
    const params = new URLSearchParams(window.location.search);
    if (countryKey === 'all') params.delete('wholesaleCountry');
    else params.set('wholesaleCountry', countryKey);
    if (selectedZone !== 'all') params.set('businessType', zoneToBusinessType[selectedZone]);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
  };
  const clearDirectoryFilters = () => {
    setSelectedCountry('all');
    setSelectedCity('all');
    setSelectedIndustry('all');
    setSelectedBusinessIndustry('all');
    const params = new URLSearchParams(window.location.search);
    params.delete('wholesaleCountry');
    params.delete('businessIndustry');
    window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`);
  };

  const businessCards = [
    ...merchantIndustries.map(industry => ({
      key: industry.id,
      label: localizeCopy(industry.zh, industry.it)
    }))
  ];
  return (
    <div className="mx-auto w-full max-w-7xl space-y-2 bg-[#F5F5F5] px-3 py-1 sm:px-6 sm:py-3 lg:px-8">
      <MerchantFinder />
      <details className="group w-fit max-w-full rounded-lg border border-neutral-200 bg-white">
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-6 px-3 text-[11px] font-medium text-neutral-600">
          <span>{localizeCopy('筛选商家', 'Filtra partner')}</span>
          <span className="text-base leading-none text-neutral-400 transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <nav
          aria-label={localizeCopy('商家分类目录', 'Categorie showroom')}
          className="overflow-x-auto border-t border-neutral-100 px-3 py-3"
        >
          <div className="flex min-w-max items-center gap-2">
            {[
              { key: 'all' as const, label: localizeCopy('全部商家', 'Tutti i partner'), count: merchants.length },
              ...businessCards.map(card => ({
                ...card,
                count: merchants.filter(merchant => getBusinessIndustry(merchant) === card.key).length
              }))
            ].map(item => {
              const legacyIndustry = selectedZone === 'iolo' || selectedZone === 'tavoro'
                ? 'FASHION_COMPANY'
                : selectedZone === 'leather'
                  ? 'LEATHER_GOODS'
                  : selectedZone === 'boutique_department'
                    ? 'RETAIL_STORE'
                    : 'all';
              const isSelected = (selectedBusinessIndustry === 'all' ? legacyIndustry : selectedBusinessIndustry) === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleBusinessIndustrySelect(item.key)}
                  aria-pressed={isSelected}
                  className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                    isSelected ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-500 hover:text-neutral-950'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`text-[11px] font-normal ${isSelected ? 'text-white/65' : 'text-neutral-400'}`}>{item.count}</span>
                </button>
              );
            })}
          </div>
        </nav>
        <section aria-label={localizeCopy('商家目录筛选', 'Filtri showroom')} className="grid grid-cols-1 gap-3 border-t border-neutral-100 p-3 sm:grid-cols-3">
        <label className="flex min-w-0 flex-col gap-1.5 text-[11px] font-medium text-neutral-600">
          {localizeCopy('国家 / Paese', 'Paese')}
          <select
            value={selectedCountry}
            onChange={event => handleCountrySelect(event.target.value)}
            className="h-10 w-full min-w-0 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-xs text-neutral-900 outline-none focus:border-neutral-950"
          >
            <option value="all">{localizeCopy('全部国家', 'Tutti i paesi')}</option>
            {countryOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-[11px] font-medium text-neutral-600">
          {localizeCopy('城市 / Città', 'Città')}
          <select
            value={selectedCity}
            onChange={event => setSelectedCity(event.target.value)}
            className="h-10 w-full min-w-0 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-xs text-neutral-900 outline-none focus:border-neutral-950"
          >
            <option value="all">{localizeCopy('全部城市', 'Tutte le città')}</option>
            {cityOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-[11px] font-medium text-neutral-600">
          <span className="flex items-center justify-between gap-2">
            <span>{localizeCopy('行业 / 主营', 'Settore / specialità')}</span>
            <button
              type="button"
              onClick={clearDirectoryFilters}
              disabled={selectedCountry === 'all' && selectedCity === 'all' && selectedIndustry === 'all' && selectedBusinessIndustry === 'all'}
              className="text-[11px] font-medium normal-case tracking-normal text-neutral-500 underline underline-offset-2 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {localizeCopy('清除', 'Azzera')}
            </button>
          </span>
          <select
            value={selectedIndustry}
            onChange={event => setSelectedIndustry(event.target.value)}
            className="h-10 w-full min-w-0 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-xs text-neutral-900 outline-none focus:border-neutral-950"
          >
            <option value="all">{localizeCopy('全部行业', 'Tutti i settori')}</option>
            {industryOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
        </section>
      </details>
      {/* Merchant Cards Grid */}
      <div ref={merchantListRef} className="scroll-mt-4">
        {filteredMerchants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
            {localizeCopy('该分区暂时没有批发商。', 'Nessun produttore in questa zona.')}
          </div>
        ) : (
      <div className="flex flex-col gap-2.5">
        {filteredMerchants.map(merchant => {
          const merchantName = getLocalizedMerchantName(merchant, lang);
          const merchantCity = getCityLabel(merchant);
          const merchantCountry = getCountryLabel(merchant);
          const merchantProducts = products.filter(product =>
            product.merchantId === merchant.id
            && !product.isPrivateVault
            && !product.isLockedForBuyer
            && !product.isExclusiveProtected
            && product.visibility !== 'private'
            && (product.visibility === undefined || product.visibility === 'public')
            && (product.lifecycleStatus || 'published') === 'published'
            && product.images?.some(image => Boolean(image?.trim()))
          ).slice(0, 3);
          const heroProduct = merchantProducts[0];
          const businessIndustry = merchantIndustries.find(industry => industry.id === getBusinessIndustry(merchant));
          const specialtyCategory = isPlaceholderMerchantText(merchant.specialtyCategory) ? '' : merchant.specialtyCategory;
          const categoryName = businessIndustry
            ? specialtyCategory || localizeCopy(businessIndustry.zh, businessIndustry.it)
            : specialtyCategory || localizeCopy('时装品牌', 'Moda');
          const specialties = merchant.specialties?.filter(value => !isPlaceholderMerchantText(value)).slice(0, 2) || [];
          const taglineCandidate = lang === 'zh'
            ? merchant.tagline_zh || merchant.tagline || merchant.description_zh || merchant.description
            : merchant.tagline_it || merchant.tagline || merchant.description_it || merchant.description;
          const tagline = isPlaceholderMerchantText(taglineCandidate) ? '' : taglineCandidate;
          const productRange = tagline || specialties.join('、') || categoryName;
          const cityLabel = [merchantCity, merchantCountry]
            .filter(value => !/未填写|non specificat[oa]/i.test(value))
            .join(' · ');
          const websiteUrl = normalizeMerchantWebsiteUrl(merchant.websiteUrl);
          const storeUrl = merchantStorefrontUrl(merchant.storeSlug || merchant.slug || merchant.id, lang);
          const vaultStatus = getVaultStatus(merchant.id);
          const shareUrl = merchantStorefrontUrl(
            merchant.storeSlug || merchant.slug || merchant.id,
            lang,
            `merchantId=${encodeURIComponent(merchant.id)}`
          );
          const accessUrl = merchantStorefrontUrl(
            merchant.storeSlug || merchant.slug || merchant.id,
            lang,
            'tab=custom&requestAccess=1'
          );
          const heroImage = heroProduct?.images.find(image => Boolean(image?.trim()))
            || merchant.bannerImage
            || merchant.banner
            || merchant.showroomImage
            || merchant.logo;
          const isKnownLocation = (value?: string) =>
            typeof value === 'string'
            && value.trim().length > 0
            && !/待完善|未填写|待补充|待填写|未提供|未填写|demo|example|non specificat[oa]|not provided|unknown|n\/a/i.test(value);
          const streetAddress = isKnownLocation(merchant.showroomAddress)
            ? merchant.showroomAddress.trim()
            : '';
          const address = [streetAddress, merchant.city, merchant.country]
            .filter(isKnownLocation)
            .join(', ');
          const phoneCandidate = [merchant.contactPhone, merchant.phone]
            .map(value => value?.trim() || '')
            .find(value => {
              const digits = value.replace(/\D/g, '');
              return digits.length >= 7 && !/demo|example/i.test(value);
            }) || '';
          const phoneDigits = phoneCandidate.replace(/\D/g, '');
          const phone = phoneDigits.length >= 7 ? phoneCandidate : '';
          const phoneHref = phone ? `${phone.startsWith('+') ? '+' : ''}${phoneDigits}` : '';
          const mapDestination = buildMerchantMapUrl({
            name: merchantName,
            streetAddress,
            city: merchant.city_it || merchant.city,
            country: merchant.country_it || merchant.country,
            latitude: merchant.mapLatitude,
            longitude: merchant.mapLongitude
          });
          const locationLabel = address || cityLabel;
          return (
            <article key={merchant.id} className="group relative rounded-xl border border-[#E5E5E5] bg-white p-3 text-left">
              {vaultStatus === 'approved' ? (
                <a
                  href={storeUrl}
                  aria-label={localizeCopy('已获授权，进入店铺看货', 'Autorizzato · Apri il negozio')}
                  title={localizeCopy('已获授权，进入店铺看货', 'Autorizzato · Apri il negozio')}
                  className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[#9a7c5c]/70 transition-colors hover:bg-neutral-950 hover:text-white"
                >
                  <UnlockKeyhole className="h-3.5 w-3.5" />
                </a>
              ) : vaultStatus === 'pending' ? (
                <span
                  aria-label={localizeCopy('看货申请审核中', 'Richiesta di accesso in revisione')}
                  title={localizeCopy('看货申请审核中', 'Richiesta di accesso in revisione')}
                  className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-neutral-400/70"
                >
                  <Clock3 className="h-3.5 w-3.5" />
                </span>
              ) : (
                <a
                  href={accessUrl}
                  aria-label={vaultStatus === 'rejected'
                    ? localizeCopy('看货申请未通过，点击重新申请', 'Richiesta rifiutata · Clicca per riprovare')
                    : localizeCopy('申请授权后查看商品', 'Accesso ai prodotti su autorizzazione')}
                  title={vaultStatus === 'rejected'
                    ? localizeCopy('申请未通过，点击重新申请', 'Richiesta rifiutata · Riprova')
                    : localizeCopy('授权后查看商品', 'Accesso ai prodotti su autorizzazione')}
                  className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-neutral-400/70 transition-colors hover:bg-neutral-950 hover:text-white"
                >
                  <LockKeyhole className="h-3.5 w-3.5" />
                </a>
              )}
              <div className="grid grid-cols-[100px_minmax(0,1fr)] items-start gap-2.5">
                <a href={storeUrl} aria-label={localizeCopy(`打开${merchantName}商家店铺`, `Apri il negozio ${merchantName}`)} className="h-[120px] w-[100px] overflow-hidden rounded-[3px]">
                  <ShowroomImage src={heroImage} alt={merchantName} fallbackText={merchantName} className="h-full w-full" />
                </a>

                <div className="flex min-w-0 flex-col gap-1.5">
                  <a href={storeUrl} className="pr-5 font-sans text-[17px] font-semibold leading-tight text-[#111111]">
                    {merchantName}
                  </a>
                  <p className="text-[11px] leading-4 text-[#666666]">{categoryName}</p>
                  <p className="line-clamp-2 text-[11px] leading-4 text-[#555555]">{productRange}</p>
                  <div aria-label={localizeCopy('地址', 'Indirizzo')} className="flex min-w-0 items-start gap-1.5 text-[11px] leading-[17px] text-[#222222]">
                    <MapPin className="mt-0.5 h-[13px] w-[13px] shrink-0 text-[#222222]" />
                    {locationLabel
                      ? <span className="min-w-0">{locationLabel}</span>
                      : <span className="text-neutral-400">{localizeCopy('商家未提供', 'Non fornito')}</span>}
                  </div>
                  <div aria-label={localizeCopy('电话', 'Telefono')} className="flex min-w-0 items-start gap-1.5 text-[11px] leading-[17px] text-[#222222]">
                    <Phone className="mt-0.5 h-[13px] w-[13px] shrink-0 text-[#222222]" />
                    {phone
                      ? <a href={`tel:${phoneHref}`} className="min-w-0 break-all">{phone}</a>
                      : <span className="text-neutral-400">{localizeCopy('商家未提供', 'Non fornito')}</span>}
                  </div>
                  <div className="flex min-w-0 items-start gap-1.5 text-[11px] leading-[17px] text-[#222222]">
                    {websiteUrl
                      ? <a
                        href={websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={localizeCopy(`打开官方网站：${websiteUrl}`, `Apri il sito ufficiale: ${websiteUrl}`)}
                        title={localizeCopy('打开官方网站', 'Apri il sito ufficiale')}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#222222] transition-colors hover:bg-neutral-950 hover:text-white"
                      >
                        <Globe className="h-[14px] w-[14px]" />
                      </a>
                      : <span
                        aria-label={localizeCopy('商家未提供官方网站', 'Sito ufficiale non fornito')}
                        title={localizeCopy('商家未提供官方网站', 'Sito ufficiale non fornito')}
                        className="inline-flex h-5 w-5 items-center justify-center text-neutral-400"
                      >
                        <Globe className="h-[14px] w-[14px]" />
                      </span>}
                  </div>
                </div>
              </div>
              <div className="mt-2.5 border-t border-[#EAEAEA] pt-2.5">
                <div className="grid grid-cols-3 gap-1.5">
                  {mapDestination.url ? (
                    <a
                      href={mapDestination.url}
                      aria-label={mapDestination.hasExactLocation
                        ? localizeCopy('在 Google 地图中开始导航', 'Avvia la navigazione in Google Maps')
                        : localizeCopy('在 Google 地图中查看商家位置', 'Visualizza la posizione su Google Maps')}
                      className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-lg border border-[#DDDDDD] bg-white px-1 text-[10px] text-[#222222] transition-colors hover:border-neutral-950 hover:bg-neutral-950 hover:text-white"
                    >
                      <MapPin className="h-3 w-3 shrink-0" />
                      {mapDestination.hasExactLocation
                        ? localizeCopy('导航', 'Naviga')
                        : localizeCopy('地图', 'Mappa')}
                    </a>
                  ) : (
                    <span aria-disabled="true" className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-lg border border-[#DDDDDD] bg-white px-1 text-[10px] text-neutral-400">
                      <MapPin className="h-3 w-3 shrink-0" />{localizeCopy('导航', 'Naviga')}
                    </span>
                  )}
                  <ShareButton
                    title={`${merchantName}｜${categoryName}`}
                    text={`${merchantName} · ${categoryName} · ${productRange}`}
                    path={shareUrl}
                    source={`merchant-${merchant.id}`}
                    className="!h-8 !min-h-8 min-w-0 justify-center gap-1 !rounded-lg border-[#DDDDDD] px-1 text-[10px] font-normal text-[#222222] transition-colors hover:border-neutral-950 hover:bg-neutral-950 hover:text-white"
                  />
                  {phone ? (
                    <a href={`tel:${phoneHref}`} className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-lg border border-[#DDDDDD] bg-white px-1 text-[10px] text-[#222222] transition-colors hover:border-neutral-950 hover:bg-neutral-950 hover:text-white">
                      <Phone className="h-3 w-3 shrink-0" />{localizeCopy('联系商家', 'Contatta')}
                    </a>
                  ) : (
                    <span aria-disabled="true" className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-lg border border-[#DDDDDD] bg-white px-1 text-[10px] text-neutral-400">
                      <Phone className="h-3 w-3 shrink-0" />{localizeCopy('联系商家', 'Contatta')}
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
        )}
      </div>
    </div>
  );
};
