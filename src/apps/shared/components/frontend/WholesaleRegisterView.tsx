import React, { useState } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Lock,
  Tag
} from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { BusinessType } from '../../../../types/b2b';
import { PasswordInput } from '../common/PasswordInput';
import { formatInternationalPhoneNumber, PhoneNumberInput } from '../common/PhoneNumberInput';

export const WholesaleRegisterView: React.FC = () => {
  const { registerWholesaleCustomer, setCurrentView, lang, localizeCopy } = useB2B();
  const isIt = lang === 'it';

  const [companyName, setCompanyName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState(isIt ? 'Italy' : 'France');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('boutique');
  const [websiteOrSocial, setWebsiteOrSocial] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !vatNumber || !contactPerson || !phone || !email) return;

    registerWholesaleCustomer({
      companyName,
      vatNumber,
      address,
      city,
      country,
      contactPerson,
      phone: formatInternationalPhoneNumber(country, phone),
      email,
      businessType,
      websiteOrSocial
    });

    setSubmitted(true);
  };

  const businessTypes = isIt
    ? [
        { key: 'boutique', label: 'Boutique Multibrand' },
        { key: 'retail_store', label: 'Negozio al Dettaglio' },
        { key: 'online_store', label: 'E-commerce Moda' },
        { key: 'distributor', label: 'Distributore / Grossista' },
        { key: 'other', label: 'Altra Attività Commerciale' },
      ]
    : [
        { key: 'boutique', label: '精品零售店' },
        { key: 'retail_store', label: '线下专卖店' },
        { key: 'online_store', label: '电商独立站' },
        { key: 'distributor', label: '区域批发商' },
        { key: 'other', label: '连锁实体 / 其他' },
      ];

  const countries = isIt
    ? [
        { key: 'Italy', label: 'Italia' },
        { key: 'France', label: 'Francia' },
        { key: 'Germany', label: 'Germania' },
        { key: 'Spain', label: 'Spagna' },
        { key: 'Netherlands', label: 'Paesi Bassi' },
        { key: 'Belgium', label: 'Belgio' },
        { key: 'Austria', label: 'Austria' },
        { key: 'Switzerland', label: 'Svizzera' },
        { key: 'United Kingdom', label: 'Regno Unito' },
      ]
    : [
        { key: 'Italy', label: '意大利' },
        { key: 'France', label: '法国' },
        { key: 'Germany', label: '德国' },
        { key: 'Spain', label: '西班牙' },
        { key: 'Netherlands', label: '荷兰' },
        { key: 'Belgium', label: '比利时' },
        { key: 'Austria', label: '奥地利' },
        { key: 'Switzerland', label: '瑞士' },
        { key: 'United Kingdom', label: '英国' },
      ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      {/* Title */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-neutral-900" />
          <span>{localizeCopy('欧洲合规企业批发商准入审核', 'Accesso Riservato Operatori del Settore B2B')}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold font-serif text-neutral-900 tracking-tight">
          {localizeCopy('批发客户企业入驻登记', 'Registrazione Rivenditore Wholesale')}
        </h1>
        <p className="text-neutral-500 text-xs sm:text-sm">
          {localizeCopy('开通 RUDA B2B 批发账户，解锁意大利原厂直供批发底价、30天免息账期及展厅VIP专属预约通道。', 'Attiva l\'account B2B certificato per accedere ai listini riservati, agli ordini di produzione e agli showroom privati.')}
        </p>
      </div>

      {submitted ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 sm:p-12 text-center space-y-6 shadow-2xs">
          <div className="w-16 h-16 bg-neutral-100 text-neutral-900 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-serif text-neutral-900">
              {localizeCopy('企业批发申请已成功递交', 'Richiesta di Registrazione Inviata')}
            </h2>
            <p className="text-neutral-500 text-xs sm:text-sm mt-2 max-w-md mx-auto">
              {localizeCopy("感谢您提交 {{RUDA_ARG_0}} (税号: {{RUDA_ARG_1}}) 的资质资料。我们的业务团队将在 24 小时内完成企业资料核验。", "La richiesta per {{RUDA_ARG_0}} (P.IVA: {{RUDA_ARG_1}}) è stata registrata con successo. Il nostro team commerciale esaminerà i dati entro 24 ore.", [String(companyName), String(vatNumber)])}
            </p>
          </div>

          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 max-w-lg mx-auto text-left text-xs space-y-2">
            <div className="font-bold text-neutral-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-neutral-900" />
              <span>{localizeCopy('零售商资质审核提示:', 'Verifica Partita IVA Comunitaria')}</span>
            </div>
            <p className="text-neutral-500 leading-relaxed">
              {localizeCopy('企业资质提交后系统将核验 VIES 欧盟税号与营业资料。您可在个人中心随时查看审核进度与专属批发折扣。', 'La partita IVA viene verificata tramite registro VIES. Una volta confermato l\'account, riceverai l\'accesso immediato ai listini ingrosso e alle prenotazioni showroom.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCurrentView('catalog')}
              className="px-6 py-2.5 bg-black text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              {localizeCopy('继续浏览商品大厅', 'Esplora il Catalogo Pubblico')}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-10 space-y-6 shadow-2xs">
          <div className="border-b border-neutral-200 pb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
              {localizeCopy('1. 企业资质信息', '1. Dati Aziendali e Fiscali')}
            </h2>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {localizeCopy('请如实填写注册公司或零售商实体商号', 'Inserisci i dati legali dell\'attività commerciale')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                {localizeCopy('公司名称 *', 'Ragione Sociale *')}
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={localizeCopy('例: Boutique Elegance Paris SAS', 'Es: Boutique Milano S.r.l.')}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                {localizeCopy('增值税号 (VAT Number) *', 'Partita IVA / Codice Fiscale *')}
              </label>
              <input
                type="text"
                required
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder={localizeCopy('例: FR 82 123456789', 'Es: IT09876543210')}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                {localizeCopy('公司注册地址 *', 'Indirizzo Sede Legale *')}
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={localizeCopy('例: 12 Rue du Faubourg Saint-Honoré', 'Es: Via Montenapoleone 18')}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                {localizeCopy('城市 *', 'Città *')}
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={localizeCopy('例: Paris, Berlin, Madrid', 'Es: Milano, Roma, Firenze')}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                {localizeCopy('国家 *', 'Nazione *')}
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-900 focus:bg-white focus:outline-none"
              >
                {countries.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-b border-neutral-200 pb-4 pt-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
              {localizeCopy('2. 零售商联系人与账户密码', '2. Referente Commerciale e Credenziali')}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                {localizeCopy('联系人姓名 *', 'Nome e Cognome Referente *')}
              </label>
              <input
                type="text"
                required
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder={localizeCopy('例: Marie Dupont (采购经理)', 'Es: Marco Rossi (Buyer)')}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                {localizeCopy('联系电话 *', 'Telefono Aziendale *')}
              </label>
              <PhoneNumberInput
                country={country}
                value={phone}
                onChange={setPhone}
                required
                placeholder={localizeCopy('例: 1 42 68 55 00', 'Es: 02 889900')}
                className="w-full"
                inputClassName="bg-neutral-50 text-xs focus:bg-white focus:ring-1"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                {localizeCopy('商务登录邮箱 *', 'Email Aziendale di Accesso *')}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={localizeCopy('buyer@elegance-paris.fr', 'buyer@boutique-milano.it')}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                {localizeCopy('设置账户密码 *', 'Password di Accesso *')}
              </label>
              <PasswordInput
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={localizeCopy('至少 8 位包含字母和数字', 'Minimo 8 caratteri')}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 pr-10 text-xs text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>

          <div className="border-b border-neutral-200 pb-4 pt-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
              {localizeCopy('3. 实体门店与经营类型', '3. Tipologia di Attività')}
            </h2>
          </div>

          {/* Business Type */}
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              {businessTypes.map(item => (
                <label
                  key={item.key}
                  className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                    businessType === item.key 
                      ? 'border-black bg-black text-white font-semibold shadow-2xs' 
                      : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="businessType"
                    checked={businessType === item.key}
                    onChange={() => setBusinessType(item.key as any)}
                    className="sr-only"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              {localizeCopy('店铺官网 / Instagram 主页链接', 'Sito Web o Profilo Instagram Aziendale')}
            </label>
            <input
              type="text"
              value={websiteOrSocial}
              onChange={(e) => setWebsiteOrSocial(e.target.value)}
              placeholder={localizeCopy('例: instagram.com/elegance_paris', 'Es: instagram.com/boutique_milano')}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-900 focus:bg-white focus:outline-none"
            />
          </div>

          <button
            id="submit-wholesale-app"
            type="submit"
            className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
          >
            <span>{localizeCopy('提交企业审核申请', 'Invia Richiesta di Registrazione B2B')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
};
