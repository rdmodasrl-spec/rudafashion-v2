import React, { useEffect, useState } from 'react';
import { useB2B } from '../../../context/B2BContext';
import { apiGet } from '../../../api/client';
import { LanguagePicker } from './common/LanguagePicker';
import { useModuleAvailability } from '../moduleAvailability';

type FooterConfig = {
  companyName: string;
  phone: string;
  address: string;
  email: string;
  instagram: string;
  brandName: string;
  descriptionZh: string;
  descriptionIt: string;
  complianceZh: string;
  complianceIt: string;
  sectionCatalogZh: string;
  sectionCatalogIt: string;
  sectionShowroomsZh: string;
  sectionShowroomsIt: string;
  sectionFashionZh: string;
  sectionFashionIt: string;
  sectionAboutZh: string;
  sectionAboutIt: string;
};

const defaultFooterConfig: FooterConfig = {
  companyName: 'RUDA ITALIA S.R.L.',
  phone: '+39 333 252 8756',
  address: 'VIA PIEMONTE 24, 59100 PRATO',
  email: 'rdmodasrl@gmail.com',
  instagram: 'rd.ruda',
  brandName: 'RUDA',
  descriptionZh: 'RUDA Fashion 是面向欧洲 B2B 零售商与品牌商的意大利时尚采购平台，专注于现货快时尚、服装配货与供应链协同管理。',
  descriptionIt: 'RUDA Fashion è la piattaforma B2B italiana dedicata all’acquisto di moda pronta, accessori e collezioni wholesale per rivenditori, brand e boutique europee.',
  complianceZh: '企业资质核验 · 欧盟合规开票',
  complianceIt: 'Accreditamento societario · Fatturazione UE',
  sectionCatalogZh: 'RUDA 特价展厅',
  sectionCatalogIt: 'Prezzi speciali',
  sectionShowroomsZh: '官方品牌展厅',
  sectionShowroomsIt: 'Showroom ufficiali',
  sectionFashionZh: '时尚灵感',
  sectionFashionIt: 'Fashion Editorial',
  sectionAboutZh: '关于 RUDA',
  sectionAboutIt: 'Chi siamo',
};

export const Footer: React.FC = () => {
  const { setCurrentView, lang, localizeCopy } = useB2B();
  const { fashionEnabled } = useModuleAvailability();
  const [footerConfig, setFooterConfig] = useState<FooterConfig>(defaultFooterConfig);

  useEffect(() => {
    void apiGet<{ success: boolean; config: Partial<FooterConfig> }>('/api/footer-config')
      .then(result => setFooterConfig({ ...defaultFooterConfig, ...result.config }))
      .catch(error => console.error('[footer-config]', error));
  }, []);

  const isIt = lang === 'it';
  const sectionLinks = [
    { label: isIt ? footerConfig.sectionCatalogIt : footerConfig.sectionCatalogZh, view: 'catalog' as const },
    { label: isIt ? footerConfig.sectionShowroomsIt : footerConfig.sectionShowroomsZh, view: 'showrooms' as const },
    { label: isIt ? footerConfig.sectionFashionIt : footerConfig.sectionFashionZh, view: 'fashion_trends' as const },
    { label: isIt ? footerConfig.sectionAboutIt : footerConfig.sectionAboutZh, view: 'about' as const },
  ].filter(link => fashionEnabled || link.view !== 'fashion_trends');
  const navigateSection = (view: Parameters<typeof setCurrentView>[0]) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="app-footer border-t border-neutral-800 bg-neutral-950 text-neutral-400">
      <div className="mx-auto max-w-7xl px-5 pb-7 pt-10 sm:px-8 sm:pt-14">
        <div className="grid gap-8 border-b border-neutral-800 pb-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-12">
          <section>
            <button type="button" onClick={() => navigateSection('home')} className="text-left">
              <span className="block font-serif text-2xl font-medium tracking-[0.08em] text-white">{footerConfig.brandName}</span>
              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.34em] text-neutral-500">FASHION · ITALIA</span>
            </button>
            <div className="mt-3 text-[10px] leading-5 text-neutral-500">
              <span>{isIt ? footerConfig.complianceIt : footerConfig.complianceZh}</span>
            </div>
          </section>
        </div>

        <div className="grid gap-8 border-b border-neutral-800 py-7 sm:grid-cols-[1fr_auto] sm:items-start sm:py-8">
          <nav aria-label={localizeCopy('RUDA 网站导航', 'Navigazione RUDA')}>
            <h2 className="text-[9px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              {localizeCopy('探索 RUDA', 'Esplora RUDA')}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
              {sectionLinks.map(link => (
                <li key={link.view}>
                  <button
                    type="button"
                    onClick={() => navigateSection(link.view)}
                    className="text-xs text-neutral-300 transition-colors hover:text-white"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <address className="not-italic sm:max-w-sm sm:text-right">
            <h2 className="text-[9px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              {localizeCopy('联系我们', 'Contatti')}
            </h2>
            <div className="mt-4 flex flex-col gap-2 text-xs sm:items-end">
              <a href={`mailto:${footerConfig.email}`} className="transition-colors hover:text-white">
                {footerConfig.email}
              </a>
              <a href={`tel:${footerConfig.phone.replace(/\s+/g, '')}`} className="transition-colors hover:text-white">
                {footerConfig.phone}
              </a>
              <span className="text-neutral-500 sm:text-right">
                {footerConfig.address}
              </span>
              <a
                href={`https://www.instagram.com/${footerConfig.instagram.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                {footerConfig.instagram}
              </a>
            </div>
          </address>
        </div>

        <div className="flex flex-col gap-3 pt-5 text-[10px] text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {footerConfig.companyName} · P.IVA IT 09482710293</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a href="/about#privacy" className="transition-colors hover:text-white">{localizeCopy('隐私政策', 'Privacy')}</a>
            <a href="/about#cookies" className="transition-colors hover:text-white">{localizeCopy('Cookie 政策', 'Cookie')}</a>
            <a href="/about#terms" className="transition-colors hover:text-white">{localizeCopy('服务条款', 'Termini')}</a>
            <a href="/about#shipping" className="transition-colors hover:text-white">{localizeCopy('配送政策', 'Spedizioni')}</a>
            <a href="/about#returns" className="transition-colors hover:text-white">{localizeCopy('退换货政策', 'Resi')}</a>
            <LanguagePicker placement="top" align="right" />
          </div>
        </div>
      </div>
    </footer>
  );
};
