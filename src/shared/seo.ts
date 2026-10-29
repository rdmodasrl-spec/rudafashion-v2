import { PORTAL_DOMAINS } from './portalDomains';

export const SEO_LANGUAGES = [
  'en', 'it', 'zh', 'fr', 'de', 'es', 'pt', 'nl', 'pl', 'ro', 'tr', 'ar'
] as const;

export type SeoLanguage = (typeof SEO_LANGUAGES)[number];
export type SeoPage = 'home' | 'catalog' | 'showrooms' | 'trends' | 'about';

export const SEO_PUBLIC_PAGES = [
  { page: 'home', pathname: '/' },
  { page: 'catalog', pathname: '/catalog' },
  { page: 'showrooms', pathname: '/showrooms' },
  { page: 'trends', pathname: '/trends' },
  { page: 'about', pathname: '/about' }
] as const satisfies ReadonlyArray<{ page: SeoPage; pathname: string }>;

export type SeoMetadata = {
  title: string;
  description: string;
  ogLocale: string;
};

const locales: Record<SeoLanguage, string> = {
  en: 'en_GB',
  it: 'it_IT',
  zh: 'zh_CN',
  fr: 'fr_FR',
  de: 'de_DE',
  es: 'es_ES',
  pt: 'pt_PT',
  nl: 'nl_NL',
  pl: 'pl_PL',
  ro: 'ro_RO',
  tr: 'tr_TR',
  ar: 'ar_SA'
};

const pages: Record<SeoLanguage, Record<SeoPage, Omit<SeoMetadata, 'ogLocale'>>> = {
  en: {
    home: { title: 'RUDA Fashion B2B | European Wholesale Fashion Marketplace', description: 'Discover ready-to-wear fashion, verified suppliers and independent showrooms for professional buyers across Europe.' },
    catalog: { title: 'Wholesale Fashion Catalogue | RUDA Fashion B2B', description: 'Browse wholesale women’s and men’s clothing, accessories and ready-to-wear collections from European suppliers.' },
    showrooms: { title: 'Fashion Suppliers and Showrooms | RUDA Fashion B2B', description: 'Connect with verified fashion manufacturers, wholesalers and independent B2B showrooms in Europe.' },
    trends: { title: 'Fashion Trends and Style Inspiration | RUDA', description: 'Explore fashion trends, silhouettes, fabrics and styling inspiration selected by RUDA Fashion.' },
    about: { title: 'About RUDA Fashion | European B2B Wholesale', description: 'RUDA connects verified fashion suppliers, independent showrooms and professional buyers through a European B2B marketplace.' }
  },
  it: {
    home: { title: 'RUDA Fashion B2B | Ingrosso Moda Pronta in Europa', description: 'Scopri moda pronta all’ingrosso, fornitori verificati e showroom indipendenti per buyer professionali in Europa.' },
    catalog: { title: 'Catalogo Abbigliamento all’Ingrosso | RUDA Fashion', description: 'Esplora abbigliamento donna e uomo, accessori e collezioni moda pronta dai fornitori europei.' },
    showrooms: { title: 'Fornitori Moda e Showroom | RUDA Fashion B2B', description: 'Trova produttori, grossisti e showroom B2B verificati di moda e abbigliamento in Europa.' },
    trends: { title: 'Tendenze Moda e Ispirazioni | RUDA Fashion', description: 'Scopri tendenze, silhouette, tessuti e idee di stile selezionate da RUDA Fashion.' },
    about: { title: 'Chi è RUDA Fashion | Ingrosso B2B in Europa', description: 'RUDA collega fornitori di moda verificati, showroom indipendenti e buyer professionali attraverso un marketplace B2B europeo.' }
  },
  zh: {
    home: { title: 'RUDA Fashion B2B｜欧洲时尚批发平台', description: '连接欧洲认证时尚供应商、独立展厅与专业买家，浏览现货服装及配饰批发货盘。' },
    catalog: { title: '欧洲服装批发目录｜RUDA Fashion B2B', description: '浏览欧洲女装、男装、配饰与现货系列，按品牌、品类和款号查找批发商品。' },
    showrooms: { title: '欧洲时尚供应商与品牌展厅｜RUDA', description: '发现欧洲认证服装生产商、批发商与独立 B2B 品牌展厅。' },
    trends: { title: '时尚趋势与穿搭灵感｜RUDA Fashion', description: '浏览 RUDA Fashion 精选的时尚趋势、廓形、面料与穿搭灵感。' },
    about: { title: '关于 RUDA Fashion｜欧洲 B2B 时尚批发', description: 'RUDA 通过欧洲 B2B 平台连接认证时尚供应商、独立展厅与专业买家。' }
  },
  fr: {
    home: { title: 'RUDA Fashion B2B | Mode en gros en Europe', description: 'Découvrez la mode en gros, des fournisseurs vérifiés et des showrooms indépendants pour les acheteurs professionnels en Europe.' },
    catalog: { title: 'Catalogue de vêtements en gros | RUDA Fashion', description: 'Parcourez des vêtements femme et homme, accessoires et collections de prêt-à-porter de fournisseurs européens.' },
    showrooms: { title: 'Fournisseurs de mode et showrooms | RUDA', description: 'Trouvez des fabricants, grossistes et showrooms B2B vérifiés dans le secteur de la mode en Europe.' },
    trends: { title: 'Tendances mode et inspirations | RUDA Fashion', description: 'Explorez les tendances, silhouettes, tissus et inspirations de style sélectionnés par RUDA Fashion.' },
    about: { title: 'À propos de RUDA Fashion | Mode B2B en Europe', description: 'RUDA met en relation fournisseurs de mode vérifiés, showrooms indépendants et acheteurs professionnels en Europe.' }
  },
  de: {
    home: { title: 'RUDA Fashion B2B | Mode-Großhandel in Europa', description: 'Entdecken Sie sofort verfügbare Mode, geprüfte Lieferanten und unabhängige Showrooms für gewerbliche Einkäufer in Europa.' },
    catalog: { title: 'Großhandelskatalog für Mode | RUDA Fashion', description: 'Entdecken Sie Damen- und Herrenbekleidung, Accessoires und sofort verfügbare Kollektionen europäischer Lieferanten.' },
    showrooms: { title: 'Modeanbieter und Showrooms | RUDA Fashion B2B', description: 'Finden Sie geprüfte Modehersteller, Großhändler und unabhängige B2B-Showrooms in Europa.' },
    trends: { title: 'Modetrends und Inspiration | RUDA Fashion', description: 'Entdecken Sie von RUDA Fashion ausgewählte Trends, Silhouetten, Stoffe und Styling-Ideen.' },
    about: { title: 'Über RUDA Fashion | B2B-Modegroßhandel in Europa', description: 'RUDA verbindet geprüfte Modeanbieter, unabhängige Showrooms und professionelle Einkäufer über einen europäischen B2B-Marktplatz.' }
  },
  es: {
    home: { title: 'RUDA Fashion B2B | Moda al por mayor en Europa', description: 'Descubre moda pronta al por mayor, proveedores verificados y showrooms independientes para compradores profesionales en Europa.' },
    catalog: { title: 'Catálogo de ropa al por mayor | RUDA Fashion', description: 'Explora ropa de mujer y hombre, accesorios y colecciones de moda pronta de proveedores europeos.' },
    showrooms: { title: 'Proveedores de moda y showrooms | RUDA', description: 'Encuentra fabricantes, mayoristas y showrooms B2B verificados de moda y confección en Europa.' },
    trends: { title: 'Tendencias de moda e inspiración | RUDA', description: 'Explora tendencias, siluetas, tejidos e ideas de estilo seleccionadas por RUDA Fashion.' },
    about: { title: 'Sobre RUDA Fashion | Moda B2B al por mayor', description: 'RUDA conecta proveedores de moda verificados, showrooms independientes y compradores profesionales en Europa.' }
  },
  pt: {
    home: { title: 'RUDA Fashion B2B | Moda por grosso na Europa', description: 'Descubra moda pronta por grosso, fornecedores verificados e showrooms independentes para compradores profissionais na Europa.' },
    catalog: { title: 'Catálogo de Moda por Grosso | RUDA Fashion', description: 'Explore vestuário de senhora e homem, acessórios e coleções de moda pronta de fornecedores europeus.' },
    showrooms: { title: 'Fornecedores de Moda e Showrooms | RUDA', description: 'Encontre fabricantes, grossistas e showrooms B2B verificados de moda na Europa.' },
    trends: { title: 'Tendências de Moda e Inspiração | RUDA', description: 'Descubra tendências, silhuetas, tecidos e ideias de estilo selecionadas pela RUDA Fashion.' },
    about: { title: 'Sobre a RUDA Fashion | Moda B2B na Europa', description: 'A RUDA liga fornecedores de moda verificados, showrooms independentes e compradores profissionais num marketplace B2B europeu.' }
  },
  nl: {
    home: { title: 'RUDA Fashion B2B | Groothandel in mode in Europa', description: 'Ontdek direct leverbare mode, gecontroleerde leveranciers en onafhankelijke showrooms voor zakelijke kopers in Europa.' },
    catalog: { title: 'Groothandelcatalogus mode | RUDA Fashion', description: 'Bekijk dames- en herenkleding, accessoires en collecties van Europese modeleveranciers.' },
    showrooms: { title: 'Modeleveranciers en showrooms | RUDA Fashion', description: 'Vind gecontroleerde fabrikanten, groothandels en onafhankelijke B2B-showrooms in Europa.' },
    trends: { title: 'Modetrends en inspiratie | RUDA Fashion', description: 'Ontdek trends, silhouetten, stoffen en stylingideeën geselecteerd door RUDA Fashion.' },
    about: { title: 'Over RUDA Fashion | Europese B2B-modegroothandel', description: 'RUDA verbindt gecontroleerde modeleveranciers, onafhankelijke showrooms en professionele inkopers in Europa.' }
  },
  pl: {
    home: { title: 'RUDA Fashion B2B | Hurtownia mody w Europie', description: 'Odkryj odzież hurtową, sprawdzonych dostawców i niezależne showroomy dla profesjonalnych kupców w Europie.' },
    catalog: { title: 'Katalog odzieży hurtowej | RUDA Fashion', description: 'Przeglądaj odzież damską i męską, akcesoria oraz kolekcje europejskich dostawców.' },
    showrooms: { title: 'Dostawcy mody i showroomy | RUDA Fashion', description: 'Znajdź sprawdzonych producentów, hurtowników i niezależne showroomy B2B w Europie.' },
    trends: { title: 'Trendy w modzie i inspiracje | RUDA Fashion', description: 'Poznaj trendy, fasony, tkaniny i inspiracje modowe wybrane przez RUDA Fashion.' },
    about: { title: 'O RUDA Fashion | Europejska moda hurtowa B2B', description: 'RUDA łączy sprawdzonych dostawców mody, niezależne showroomy i profesjonalnych kupców w europejskim marketplace B2B.' }
  },
  ro: {
    home: { title: 'RUDA Fashion B2B | Modă en-gros în Europa', description: 'Descoperă modă en-gros, furnizori verificați și showroom-uri independente pentru cumpărători profesioniști din Europa.' },
    catalog: { title: 'Catalog de îmbrăcăminte en-gros | RUDA', description: 'Explorează haine pentru femei și bărbați, accesorii și colecții de la furnizori europeni.' },
    showrooms: { title: 'Furnizori de modă și showroom-uri | RUDA', description: 'Găsește producători, distribuitori și showroom-uri B2B verificate în Europa.' },
    trends: { title: 'Tendințe în modă și inspirație | RUDA', description: 'Descoperă tendințe, croieli, materiale și idei de stil selectate de RUDA Fashion.' },
    about: { title: 'Despre RUDA Fashion | Modă B2B en-gros', description: 'RUDA conectează furnizori de modă verificați, showroom-uri independente și cumpărători profesioniști din Europa.' }
  },
  tr: {
    home: { title: 'RUDA Fashion B2B | Avrupa Toptan Moda', description: 'Avrupa’daki profesyonel alıcılar için toptan hazır giyim, doğrulanmış tedarikçiler ve bağımsız showroom’ları keşfedin.' },
    catalog: { title: 'Toptan Giyim Kataloğu | RUDA Fashion', description: 'Avrupalı tedarikçilerin kadın ve erkek giyim, aksesuar ve hazır moda koleksiyonlarını inceleyin.' },
    showrooms: { title: 'Moda Tedarikçileri ve Showroom’lar | RUDA', description: 'Avrupa’da doğrulanmış moda üreticilerini, toptancıları ve bağımsız B2B showroom’ları bulun.' },
    trends: { title: 'Moda Trendleri ve Stil Önerileri | RUDA', description: 'RUDA Fashion tarafından seçilen trendleri, siluetleri, kumaşları ve stil fikirlerini keşfedin.' },
    about: { title: 'RUDA Fashion Hakkında | Avrupa B2B Toptan Moda', description: 'RUDA, doğrulanmış moda tedarikçilerini, bağımsız showroom’ları ve profesyonel alıcıları Avrupa’da buluşturur.' }
  },
  ar: {
    home: { title: 'RUDA Fashion B2B | الأزياء بالجملة في أوروبا', description: 'اكتشف الأزياء الجاهزة بالجملة والموردين المعتمدين وصالات العرض المستقلة للمشترين المحترفين في أوروبا.' },
    catalog: { title: 'كتالوج الأزياء بالجملة | RUDA Fashion', description: 'تصفح ملابس النساء والرجال والإكسسوارات ومجموعات الأزياء من الموردين الأوروبيين.' },
    showrooms: { title: 'موردو الأزياء وصالات العرض | RUDA', description: 'اعثر على مصنّعين وتجار جملة وصالات عرض B2B معتمدة في أوروبا.' },
    trends: { title: 'اتجاهات الموضة والإلهام | RUDA Fashion', description: 'اكتشف اتجاهات الموضة والتصاميم والأقمشة وأفكار التنسيق التي تختارها RUDA Fashion.' },
    about: { title: 'عن RUDA Fashion | تجارة أزياء B2B في أوروبا', description: 'تربط RUDA موردي الأزياء المعتمدين وصالات العرض المستقلة والمشترين المحترفين عبر سوق B2B أوروبي.' }
  }
};

const languagePhrases: Record<SeoLanguage, {
  product: string;
  shop: string;
  productDescription: (name: string, styleNo: string) => string;
  shopDescription: (name: string, city?: string | null) => string;
}> = {
  en: {
    product: 'Wholesale fashion',
    shop: 'Official wholesale showroom',
    productDescription: (name, styleNo) => `${name} (${styleNo}) is available wholesale from a verified supplier on RUDA Fashion B2B.`,
    shopDescription: (name, city) => `Discover the verified fashion collection from ${name}${city ? ` in ${city}` : ''} on RUDA Fashion B2B.`
  },
  it: {
    product: 'Moda all’ingrosso',
    shop: 'Showroom ufficiale all’ingrosso',
    productDescription: (name, styleNo) => `${name} (${styleNo}) è disponibile all’ingrosso da un fornitore verificato su RUDA Fashion B2B.`,
    shopDescription: (name, city) => `Scopri la collezione moda verificata di ${name}${city ? ` a ${city}` : ''} su RUDA Fashion B2B.`
  },
  zh: {
    product: '时尚批发商品',
    shop: '官方批发店铺',
    productDescription: (name, styleNo) => `${name}（款号 ${styleNo}）由 RUDA Fashion B2B 认证供应商提供批发。`,
    shopDescription: (name, city) => `在 RUDA Fashion B2B 浏览${name}${city ? `（${city}）` : ''}的认证时尚商品系列。`
  },
  fr: {
    product: 'Mode en gros',
    shop: 'Showroom officiel de mode',
    productDescription: (name, styleNo) => `${name} (${styleNo}) est proposé en gros par un fournisseur vérifié sur RUDA Fashion B2B.`,
    shopDescription: (name, city) => `Découvrez la collection de mode vérifiée de ${name}${city ? ` à ${city}` : ''} sur RUDA Fashion B2B.`
  },
  de: {
    product: 'Mode im Großhandel',
    shop: 'Offizieller Mode-Showroom',
    productDescription: (name, styleNo) => `${name} (${styleNo}) ist bei einem geprüften Anbieter auf RUDA Fashion B2B im Großhandel erhältlich.`,
    shopDescription: (name, city) => `Entdecken Sie die geprüfte Modekollektion von ${name}${city ? ` in ${city}` : ''} auf RUDA Fashion B2B.`
  },
  es: {
    product: 'Moda al por mayor',
    shop: 'Showroom oficial de moda',
    productDescription: (name, styleNo) => `${name} (${styleNo}) está disponible al por mayor de un proveedor verificado en RUDA Fashion B2B.`,
    shopDescription: (name, city) => `Descubre la colección de moda verificada de ${name}${city ? ` en ${city}` : ''} en RUDA Fashion B2B.`
  },
  pt: {
    product: 'Moda por grosso',
    shop: 'Showroom oficial de moda',
    productDescription: (name, styleNo) => `${name} (${styleNo}) está disponível por grosso através de um fornecedor verificado na RUDA Fashion B2B.`,
    shopDescription: (name, city) => `Descubra a coleção de moda verificada de ${name}${city ? ` em ${city}` : ''} na RUDA Fashion B2B.`
  },
  nl: {
    product: 'Modegroothandel',
    shop: 'Officiële modeshowroom',
    productDescription: (name, styleNo) => `${name} (${styleNo}) is als groothandel verkrijgbaar bij een gecontroleerde leverancier op RUDA Fashion B2B.`,
    shopDescription: (name, city) => `Ontdek de gecontroleerde modecollectie van ${name}${city ? ` in ${city}` : ''} op RUDA Fashion B2B.`
  },
  pl: {
    product: 'Moda hurtowa',
    shop: 'Oficjalny showroom mody',
    productDescription: (name, styleNo) => `${name} (${styleNo}) jest dostępny w sprzedaży hurtowej u sprawdzonego dostawcy na RUDA Fashion B2B.`,
    shopDescription: (name, city) => `Odkryj sprawdzoną kolekcję mody marki ${name}${city ? ` w ${city}` : ''} na RUDA Fashion B2B.`
  },
  ro: {
    product: 'Modă en-gros',
    shop: 'Showroom oficial de modă',
    productDescription: (name, styleNo) => `${name} (${styleNo}) este disponibil en-gros de la un furnizor verificat pe RUDA Fashion B2B.`,
    shopDescription: (name, city) => `Descoperă colecția de modă verificată a showroom-ului ${name}${city ? ` din ${city}` : ''} pe RUDA Fashion B2B.`
  },
  tr: {
    product: 'Toptan moda',
    shop: 'Resmî moda showroom’u',
    productDescription: (name, styleNo) => `${name} (${styleNo}), RUDA Fashion B2B’de doğrulanmış bir tedarikçiden toptan sunulur.`,
    shopDescription: (name, city) => `RUDA Fashion B2B’de ${name}${city ? ` (${city})` : ''} için doğrulanmış moda koleksiyonunu keşfedin.`
  },
  ar: {
    product: 'الأزياء بالجملة',
    shop: 'صالة عرض الأزياء الرسمية',
    productDescription: (name, styleNo) => `يتوفر ${name} (${styleNo}) بالجملة من مورد معتمد على RUDA Fashion B2B.`,
    shopDescription: (name, city) => `اكتشف مجموعة الأزياء المعتمدة لدى ${name}${city ? ` في ${city}` : ''} على RUDA Fashion B2B.`
  }
};

export function isSeoLanguage(value: string): value is SeoLanguage {
  return (SEO_LANGUAGES as readonly string[]).includes(value);
}

export function primaryRootRedirect(hostname: string): string | null {
  const normalizedHostname = hostname.trim().toLowerCase();
  if (normalizedHostname === PORTAL_DOMAINS.public || normalizedHostname === PORTAL_DOMAINS.www) {
    return '/it/';
  }
  return normalizedHostname === PORTAL_DOMAINS.merchant ? '/merchant' : null;
}

export function localizedPath(pathname: string, language: SeoLanguage): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const stripped = normalized.replace(new RegExp(`^/(?:${SEO_LANGUAGES.join('|')})(?=/|$)`, 'i'), '') || '/';
  const clean = stripped === '/' ? '/' : stripped.replace(/\/+$/, '');
  return clean === '/' ? `/${language}/` : `/${language}${clean}`;
}

export function parseLocalizedPath(pathname: string): { language: SeoLanguage | null; pathname: string } {
  const match = pathname.match(new RegExp(`^/(${SEO_LANGUAGES.join('|')})(?=/|$)`, 'i'));
  if (!match) return { language: null, pathname: pathname || '/' };
  const language = match[1].toLowerCase() as SeoLanguage;
  const stripped = pathname.slice(match[0].length) || '/';
  return { language, pathname: stripped.startsWith('/') ? stripped : `/${stripped}` };
}

export function getLocalizedSeo(page: SeoPage, language: SeoLanguage): SeoMetadata {
  return { ...pages[language][page], ogLocale: locales[language] };
}

export function getProductSeo(input: {
  name: string;
  styleNo: string;
  description?: string | null;
}, language: SeoLanguage): SeoMetadata {
  const phrase = languagePhrases[language].product;
  return {
    title: `${input.name} · ${input.styleNo} | RUDA Fashion B2B`,
    description: (language === 'it' || language === 'zh') && input.description?.trim()
      ? `${input.description.trim().slice(0, 210)} ${phrase}.`
      : languagePhrases[language].productDescription(input.name, input.styleNo),
    ogLocale: locales[language]
  };
}

export function getMerchantSeo(input: {
  name: string;
  description?: string | null;
  city?: string | null;
}, language: SeoLanguage): SeoMetadata {
  const phrase = languagePhrases[language].shop;
  return {
    title: `${input.name} | ${phrase} · RUDA Fashion`,
    description: (language === 'it' || language === 'zh') && input.description?.trim()
      ? `${input.description.trim().slice(0, 210)} ${phrase}.`
      : languagePhrases[language].shopDescription(input.name, input.city),
    ogLocale: locales[language]
  };
}

export function localizedAlternates(pathname: string, origin = `https://${PORTAL_DOMAINS.public}`): string {
  const links = SEO_LANGUAGES.map(language =>
    `<link rel="alternate" hreflang="${language}" href="${origin}${localizedPath(pathname, language)}">`
  );
  links.push(`<link rel="alternate" hreflang="x-default" href="${origin}/">`);
  return links.join('');
}

export function canonicalPublicUrl(pathname: string, language: SeoLanguage, origin = `https://${PORTAL_DOMAINS.public}`): string {
  return new URL(localizedPath(pathname, language), origin).toString();
}
