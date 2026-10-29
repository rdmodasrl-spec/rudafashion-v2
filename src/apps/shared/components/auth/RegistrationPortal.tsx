import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Check, Factory, Store, Tag, Truck } from 'lucide-react';
import { apiGet, apiPost } from '../../../../api/client';
import { GoogleSignInButton } from './GoogleSignInButton';
import { countryOptions, getCityOptions } from '../../../../constants/countries';
import { PasswordInput } from '../common/PasswordInput';
import { formatInternationalPhoneNumber, PhoneNumberInput } from '../common/PhoneNumberInput';
import { AuthLanguageSelector } from './AuthShell';
import { useB2B } from '../../../../context/B2BContext';
import { DEFAULT_MERCHANT_INDUSTRY_TEMPLATE_ID, merchantIndustryTemplates } from '../../../../constants/merchantIndustryTemplates';

type BusinessRole = 'PRODUCER' | 'WHOLESALER' | 'RETAILER';

const roleOptions: Array<{ id: BusinessRole; icon: React.ElementType; zh: string; it: string; descriptionZh: string; descriptionIt: string }> = [
  { id: 'PRODUCER', icon: Factory, zh: '生产商', it: 'Produttore', descriptionZh: '生产或拥有自己的品牌商品', descriptionIt: 'Produci o possiedi un marchio' },
  { id: 'WHOLESALER', icon: Truck, zh: '批发商', it: 'Grossista', descriptionZh: '采购商品并批发给零售商', descriptionIt: 'Acquisti e rivendi ai negozi' },
  { id: 'RETAILER', icon: Store, zh: '零售商', it: 'Rivenditore', descriptionZh: '为自己的门店或零售业务采购', descriptionIt: 'Acquisti per il tuo negozio' }
];
const categoryOptions = [
  { id: 'WOMENSWEAR', label: '女装 / Womenswear' },
  { id: 'MENSWEAR', label: '男装 / Menswear' },
  { id: 'KIDSWEAR', label: '童装 / Kidswear' },
  { id: 'BABYWEAR', label: '婴童用品 / Babywear' },
  { id: 'CLOTHING', label: '服装 / Clothing' },
  { id: 'LINGERIE', label: '内衣家居服 / Lingerie' },
  { id: 'SPORTSWEAR', label: '运动服 / Sportswear' },
  { id: 'OUTERWEAR', label: '外套皮衣 / Outerwear' },
  { id: 'DENIM', label: '牛仔 / Denim' },
  { id: 'BAGS', label: '皮包 / Bags' },
  { id: 'SHOES', label: '鞋类 / Shoes' },
  { id: 'JEWELRY', label: '珠宝首饰 / Jewelry' },
  { id: 'WATCHES', label: '手表 / Watches' },
  { id: 'ACCESSORIES', label: '时尚配饰 / Accessories' },
  { id: 'LEATHER_GOODS', label: '皮具 / Leather goods' },
  { id: 'TEXTILES', label: '面料纺织 / Textiles' },
  { id: 'FABRICS_TRIMS', label: '辅料及饰品 / Trims' },
  { id: 'BEAUTY_COSMETICS', label: '美妆护肤 / Beauty' },
  { id: 'PERFUME', label: '香水 / Perfume' },
  { id: 'HOME_LIFESTYLE', label: '家居生活 / Lifestyle' },
  { id: 'HOME_DECOR', label: '家居装饰 / Home decor' },
  { id: 'GIFT_STATIONERY', label: '礼品文具 / Gifts' },
  { id: 'LUGGAGE_TRAVEL', label: '箱包旅行 / Travel' },
  { id: 'PET_PRODUCTS', label: '宠物用品 / Pet products' },
  { id: 'OTHER', label: '其他 / Other' }
];

export const RegistrationPortal: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { lang, localizeCopy } = useB2B();
  const isZh = lang === 'zh';
  const [step, setStep] = useState(1);
  const [roles, setRoles] = useState<BusinessRole[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [industry, setIndustry] = useState(DEFAULT_MERCHANT_INDUSTRY_TEMPLATE_ID);
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'phone'>('email');
  const [phoneCountry, setPhoneCountry] = useState('Italy');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationCooldown, setVerificationCooldown] = useState(0);
  const [form, setForm] = useState({
    email: '', password: '', displayName: '', legalName: '', vatNumber: '',
    country: 'Italy', city: 'Milan', phone: '', acceptedTerms: false, acceptedPrivacy: false
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [merchantLoginAvailable, setMerchantLoginAvailable] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [companyStatus, setCompanyStatus] = useState('VERIFICATION_PENDING');
  const [accountIdentityReviewRequired, setAccountIdentityReviewRequired] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const patch = (key: keyof typeof form, value: string | boolean) => setForm(previous => ({ ...previous, [key]: value }));
  const selectRole = (role: BusinessRole) => setRoles([role]);
  const toggleCategory = (category: string) => setCategories(previous => previous.includes(category) ? previous.filter(item => item !== category) : [...previous, category]);
  const verificationDestination = verificationMethod === 'email'
    ? form.email.trim().toLowerCase()
    : formatInternationalPhoneNumber(phoneCountry, form.phone);
  const requestVerification = async () => {
    setError('');
    if (verificationMethod === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verificationDestination)) {
      setError(localizeCopy("请输入有效邮箱后获取验证码", "Inserisci un indirizzo email valido.")); return;
    }
    if (verificationMethod === 'phone' && !/^\+[1-9]\d{7,14}$/.test(verificationDestination)) {
      setError(localizeCopy("手机号请使用国际格式，例如 +393331234567", "Inserisci il numero con prefisso internazionale, ad esempio +393331234567.")); return;
    }
    setVerificationBusy(true);
    try {
      const result = await apiPost<{ retryAfter?: number }>('/api/auth/register/company/request-verification', { channel: verificationMethod, destination: verificationDestination });
      setVerificationSent(true);
      setVerificationCooldown(result.retryAfter || 60);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (localizeCopy("验证码发送失败，请稍后重试", "Invio del codice non riuscito. Riprova.")));
    } finally {
      setVerificationBusy(false);
    }
  };
  React.useEffect(() => {
    if (verificationCooldown <= 0) return;
    const timer = window.setInterval(() => setVerificationCooldown(previous => Math.max(0, previous - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [verificationCooldown]);
  const verifyContact = async () => {
    setError('');
    setVerificationBusy(true);
    try {
      const result = await apiPost<{ success: true; verificationToken: string }>('/api/auth/register/company/verify', { channel: verificationMethod, destination: verificationDestination, code: verificationCode });
      setVerificationToken(result.verificationToken);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (localizeCopy("验证码无效或已过期", "Codice non valido o scaduto.")));
    } finally {
      setVerificationBusy(false);
    }
  };
  const next = () => {
    setError('');
    if (step === 1 && ((!form.email && !form.phone) || form.password.length < 8)) {
      setError(localizeCopy("请输入邮箱或手机号，并设置至少 8 位密码", "Inserisci un’email o un telefono e una password di almeno 8 caratteri.")); return;
    }
    if (step === 1 && !verificationToken) { setError(localizeCopy("请先完成联系方式验证", "Verifica prima il tuo contatto.")); return; }
    if (step === 2 && (!form.displayName || !form.country || !form.city)) {
      setError(localizeCopy("请选择国家和城市，并填写企业名称", "Inserisci il nome dell’azienda e seleziona paese e città.")); return;
    }
    if (step === 3 && roles.length !== 1) { setError(localizeCopy("请选择一个业务类型", "Seleziona un tipo di attività.")); return; }
    if (step === 3 && categories.length === 0) { setError(localizeCopy("请选择至少一个主营品类", "Seleziona almeno una categoria.")); return; }
    if (step === 3 && !industry) { setError(localizeCopy("请选择企业所属行业", "Seleziona il settore aziendale.")); return; }
    setStep(value => Math.min(4, value + 1));
  };
  const submit = async () => {
    setError('');
    if (!form.acceptedTerms || !form.acceptedPrivacy) { setError(localizeCopy("请同意服务协议和隐私政策", "Accetta i Termini di servizio e l’Informativa sulla privacy.")); return; }
    setBusy(true);
    try {
      const result = await apiPost<{
        success: true;
        companyId: string;
        merchantId?: string | null;
        merchantLoginAvailable?: boolean;
        workspace?: { workspaceNameZh?: string | null; workspaceNameIt?: string | null } | null;
        status?: string;
        accountIdentityReviewRequired?: boolean;
      }>('/api/auth/register/company', {
        ...form,
        phone: formatInternationalPhoneNumber(phoneCountry, form.phone),
        legalName: form.legalName || form.displayName,
        roles,
        categories,
        industryTemplate: industry,
        verificationToken
      });
      setCompanyId(result.companyId);
      setMerchantId(result.merchantId || '');
      setMerchantLoginAvailable(Boolean(result.merchantLoginAvailable));
      setWorkspaceName(isZh ? result.workspace?.workspaceNameZh || '' : result.workspace?.workspaceNameIt || result.workspace?.workspaceNameZh || '');
      setCompanyStatus(result.status || 'VERIFICATION_PENDING');
      setAccountIdentityReviewRequired(Boolean(result.accountIdentityReviewRequired));
      setStep(5);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (localizeCopy("注册失败，请稍后重试", "Registrazione non riuscita. Riprova.")));
    } finally {
      setBusy(false);
    }
  };
  const refreshStatus = async () => {
    setRefreshing(true);
    try {
      const result = await apiGet<{ success: true; company: { status: string } }>('/api/auth/me/company');
      setCompanyStatus(result.company.status);
    } finally {
      setRefreshing(false);
    }
  };
  const industryLabel = merchantIndustryTemplates.find(item => item.id === industry);

  if (step === 5) {
    return <div className="min-h-[85vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-5 flex justify-end"><AuthLanguageSelector /></div>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check /></div>
        <h1 className="mt-5 text-2xl font-bold">{merchantLoginAvailable
          ? localizeCopy("行业商家后台已开通", "Backoffice di settore aperto")
          : (isZh
            ? `${roleOptions.find(role => role.id === roles[0])?.zh || '企业'}账户已创建`
            : `${roleOptions.find(role => role.id === roles[0])?.it || 'Azienda'}: account creato`)}</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">{merchantLoginAvailable
          ? localizeCopy("系统已按你选择的行业创建独立商家后台。企业资料可继续完善，但不会阻止你进入后台配置商品、库存和订单。", "Il sistema ha creato il backoffice del settore scelto. Puoi completare i dati aziendali senza bloccare l’accesso al backoffice.")
          : localizeCopy("企业账户已创建，请继续检查资料状态。", "Account aziendale creato; controlla lo stato dei dati.")}</p>
        <div className={`mt-5 rounded-lg border p-4 text-left text-sm ${merchantLoginAvailable || companyStatus === 'ACTIVE' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <strong>{merchantLoginAvailable
            ? (workspaceName || localizeCopy("商家后台可用", "Backoffice disponibile"))
            : companyStatus === 'ACTIVE' ? (localizeCopy("企业已激活", "Azienda attivata")) : (localizeCopy("企业资料待完善", "Dati aziendali da completare"))}</strong>
          <div className="mt-1 text-xs text-neutral-600">{localizeCopy("状态", "Stato")}: {companyStatus}</div>
          {merchantId && <div className="mt-1 break-all text-xs text-neutral-600">Merchant ID: {merchantId}</div>}
        </div>
        {accountIdentityReviewRequired && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-left text-xs leading-5 text-amber-900">
            {localizeCopy("邮箱已验证，但已有账号信息需要核实。企业申请已提交，请等待管理员确认后使用统一账号登录。", "Email verificata, ma i dati dell’account esistente richiedono un controllo. La richiesta è stata inviata; attendi la verifica prima di accedere.")}
          </div>
        )}
        <p className="mt-4 break-all rounded-lg bg-neutral-50 p-3 font-mono text-[11px] text-neutral-500">{localizeCopy("申请编号", "Numero richiesta")}: {companyId}</p>
        <button type="button" disabled={refreshing} onClick={() => void refreshStatus()} className="mt-4 rounded-lg border border-neutral-300 px-4 py-2 text-xs font-bold disabled:opacity-50">{refreshing ? (localizeCopy("查询中…", "Controllo…")) : (localizeCopy("刷新企业状态", "Aggiorna stato"))}</button>
        <a href="/merchant" className="mt-6 inline-flex rounded-lg bg-black px-5 py-2.5 text-sm font-bold text-white">{merchantLoginAvailable ? localizeCopy("进入商家后台", "Entra nel backoffice") : localizeCopy("前往商家登录", "Accesso merchant")}</a>
      </div>
    </div>;
  }

  return <div className="min-h-[85vh] bg-neutral-50 px-4 py-10">
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs text-neutral-600"><ArrowLeft className="h-4 w-4" /> {localizeCopy("返回", "Indietro")}</button>
        <AuthLanguageSelector />
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 flex items-center gap-3"><Building2 className="h-9 w-9" /><div><h1 className="text-2xl font-bold">{localizeCopy("创建企业账户", "Crea un account aziendale")}</h1></div></div>
        {step === 1 && <GoogleSignInButton role="company" />}
        <div className="mb-8 flex gap-2">{[1, 2, 3, 4].map(item => <div key={item} className={`h-1.5 flex-1 rounded-full ${item <= step ? 'bg-black' : 'bg-neutral-200'}`} />)}</div>

        {step === 1 && <div className="space-y-4">
          <h2 className="text-lg font-bold">{localizeCopy("验证联系方式", "Verifica i tuoi contatti")}</h2>
          {verificationMethod === 'email' && <input type="email" value={form.email} onChange={e => { patch('email', e.target.value); setVerificationToken(''); setVerificationSent(false); }} placeholder={localizeCopy("企业邮箱", "Email aziendale")} className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" />}
          <PasswordInput value={form.password} onChange={e => patch('password', e.target.value)} placeholder={localizeCopy("密码（至少 8 位）", "Password (almeno 8 caratteri)")} className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 pr-10 text-sm" />
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-neutral-100 p-1 text-xs font-bold">
            {(['email', 'phone'] as const).map(method => <button type="button" key={method} onClick={() => { setVerificationMethod(method); setVerificationToken(''); setVerificationSent(false); }} className={`rounded-lg px-3 py-2 ${verificationMethod === method ? 'bg-white shadow-sm' : 'text-neutral-500'}`}>{method === 'email' ? (localizeCopy("邮箱", "Email")) : (localizeCopy("手机号", "Telefono"))}</button>)}
          </div>
          {verificationMethod === 'phone' && <PhoneNumberInput
            country={phoneCountry}
            onCountryChange={country => { setPhoneCountry(country); setVerificationToken(''); setVerificationSent(false); }}
            value={form.phone}
            onChange={phone => { patch('phone', phone); setVerificationToken(''); setVerificationSent(false); }}
            className="w-full"
            placeholder="333 1234567"
          />}
          {!verificationToken && <div className="flex gap-2">
            <input value={verificationCode} onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={localizeCopy("6 位验证码", "Codice a 6 cifre")} className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" />
            <button type="button" onClick={() => void (verificationSent ? verifyContact() : requestVerification())} disabled={verificationBusy || (!verificationSent && verificationCooldown > 0)} className="rounded-lg bg-black px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{verificationSent ? (localizeCopy("验证", "Verifica")) : verificationCooldown > 0 ? `${verificationCooldown}s` : (localizeCopy("发送验证码", "Invia codice"))}</button>
            {verificationSent && <button type="button" onClick={() => void requestVerification()} disabled={verificationBusy || verificationCooldown > 0} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-700 disabled:opacity-50">{verificationCooldown > 0 ? `${verificationCooldown}s` : (localizeCopy("重新发送", "Invia di nuovo"))}</button>}
          </div>}
          {verificationToken && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{localizeCopy("联系方式已验证", "Contatto verificato")}</p>}
        </div>}
        {step === 2 && <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">{localizeCopy("填写账户信息", "Dati dell’account")}</h2>
            <p className="mt-1 text-sm text-neutral-500">{localizeCopy("先创建账户，法定资料可稍后补充。", "Crea l’account ora; potrai aggiungere i dati legali in seguito.")}</p>
          </div>
          <input
            value={form.displayName}
            onChange={e => patch('displayName', e.target.value)}
            placeholder={localizeCopy("店铺或品牌名称", "Nome del negozio o del marchio")}
            autoComplete="organization"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-neutral-600">
              {localizeCopy("国家", "Paese")}
              <select
                value={form.country}
                onChange={e => {
                  const country = e.target.value;
                  patch('country', country);
                  patch('city', getCityOptions(country)[0] || 'Other');
                }}
                className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal text-neutral-900"
              >
                {countryOptions.map(country => <option key={country} value={country}>{country}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-neutral-600">
              {localizeCopy("城市", "Città")}
              <select
                value={form.city}
                onChange={e => patch('city', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal text-neutral-900"
              >
                {getCityOptions(form.country).map(city => <option key={city} value={city}>{city}</option>)}
              </select>
            </label>
          </div>
          <input value={form.vatNumber} onChange={e => patch('vatNumber', e.target.value)} placeholder={localizeCopy("VAT / 税号（可稍后补充）", "Partita IVA (facoltativa, puoi aggiungerla dopo)")} className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" />
          <p className="text-[11px] text-neutral-500">{localizeCopy("账户名称默认使用店铺或品牌名称，之后可修改。", "Il nome dell’account è quello del negozio o del marchio; potrai modificarlo.")}</p>
        </div>}
        {step === 3 && <div>
          <h2 className="text-lg font-bold">{localizeCopy("选择业务类型", "Scegli il tipo di attività")}</h2>
          <p className="mt-1 text-sm text-neutral-500">{localizeCopy("选择一个主要业务身份，其他类型可在账户开通后申请。", "Scegli l’attività principale. Potrai richiedere altri profili in seguito.")}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">{roleOptions.map(option => { const Icon = option.icon; const selected = roles.includes(option.id); return <button type="button" key={option.id} onClick={() => selectRole(option.id)} className={`min-h-36 rounded-xl border p-4 text-left transition ${selected ? 'border-black bg-neutral-950 text-white shadow-lg' : 'border-neutral-200 bg-white hover:-translate-y-0.5 hover:border-neutral-500'}`}><Icon className="h-6 w-6" /><strong className="mt-4 block text-sm">{isZh ? option.zh : option.it}</strong><small className={`mt-2 block text-xs leading-5 ${selected ? 'text-neutral-300' : 'text-neutral-500'}`}>{isZh ? option.descriptionZh : option.descriptionIt}</small>{selected && <Check className="mt-3 h-5 w-5" />}</button>; })}</div>
          <div className="mt-7 flex items-center gap-2 text-sm font-bold"><Tag className="h-4 w-4" />{localizeCopy("主营商品品类", "Categorie principali")}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{categoryOptions.map(option => { const selected = categories.includes(option.id); const label = option.label.split(' / '); return <button type="button" key={option.id} onClick={() => toggleCategory(option.id)} className={`rounded-lg border px-3 py-2.5 text-left text-xs font-semibold ${selected ? 'border-black bg-neutral-950 text-white' : 'border-neutral-200 text-neutral-700 hover:border-neutral-400'}`}>{isZh ? label[0] : label[label.length - 1]}{selected && <Check className="float-right h-3.5 w-3.5" />}</button>; })}</div>
          <label className="mt-6 block text-xs font-semibold text-neutral-700">
            {localizeCopy("企业所属行业（必选）", "Settore aziendale (obbligatorio)")}
            <select value={industry} onChange={event => setIndustry(event.target.value as typeof industry)} required className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal text-neutral-900">
              <option value="">{localizeCopy("请选择经营类型", "Seleziona un tipo")}</option>
              {merchantIndustryTemplates.map(template => (
                <option key={template.id} value={template.id} disabled={template.status !== 'open'}>
                  {localizeCopy(template.zh, template.it)}{template.status === 'open' ? '' : localizeCopy('（即将开放）', ' (presto)')}
                </option>
              ))}
            </select>
          </label>
        </div>}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">{localizeCopy("确认并提交", "Conferma e invia")}</h2>
            <div className="rounded-lg bg-neutral-50 p-4 text-sm leading-7">
              <div>{localizeCopy("企业", "Azienda")}: {form.displayName}</div>
              <div>{localizeCopy("国家", "Paese")}: {form.country} · {form.city}</div>
              <div>{localizeCopy("业务类型", "Attività")}: {roles.map(role => {
                const item = roleOptions.find(option => option.id === role);
                return isZh ? item?.zh : item?.it;
              }).join(', ')}</div>
              <div>{localizeCopy("所属行业", "Settore")}: {industryLabel ? localizeCopy(industryLabel.zh, industryLabel.it) : industry}</div>
              <div>{localizeCopy("品类", "Categorie")}: {categories.map(category => {
                const item = categoryOptions.find(option => option.id === category)?.label.split(' / ');
                return isZh ? item?.[0] : item?.[item.length - 1];
              }).join(', ')}</div>
            </div>
            <p className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
              {localizeCopy("系统会按所选行业直接创建对应后台；其他行业后台彼此隔离，可稍后另行授权。", "Il sistema crea subito il backoffice del settore scelto; gli altri backoffice restano isolati e potranno essere autorizzati in seguito.")}
            </p>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[11px] leading-5 text-neutral-600">
              {localizeCopy(
                "个人信息说明：你提交的联系人及企业资料将由 RUDA ITALIA S.R.L. 按隐私政策用于账号联系与验证、企业入驻审核、订单履行和必要的客户支持。",
                "Informativa: i dati di contatto e aziendali saranno trattati da RUDA ITALIA S.R.L. secondo l’informativa privacy per verifiche, gestione dell’account, ordini e assistenza."
              )}
            </div>
            <label className="flex items-start gap-2 text-[11px] leading-5 text-neutral-600">
              <input className="mt-0.5 shrink-0" type="checkbox" checked={form.acceptedTerms} onChange={e => patch('acceptedTerms', e.target.checked)} />
              <span>{localizeCopy("我已阅读并同意", "Ho letto e accetto")} <a href="/about#terms" target="_blank" rel="noreferrer" className="font-semibold text-neutral-900 underline">{localizeCopy("RUDA 服务协议", "i Termini di servizio RUDA")}</a></span>
            </label>
            <label className="flex items-start gap-2 text-[11px] leading-5 text-neutral-600">
              <input className="mt-0.5 shrink-0" type="checkbox" checked={form.acceptedPrivacy} onChange={e => patch('acceptedPrivacy', e.target.checked)} />
              <span>{localizeCopy("我已阅读并同意", "Ho letto e accetto")} <a href="/about#privacy" target="_blank" rel="noreferrer" className="font-semibold text-neutral-900 underline">{localizeCopy("隐私政策", "l’Informativa sulla privacy")}</a></span>
            </label>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-8 flex justify-between"><button type="button" disabled={step === 1 || busy} onClick={() => setStep(value => value - 1)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm disabled:invisible">{localizeCopy("上一步", "Indietro")}</button>{step < 4 ? <button type="button" onClick={next} className="inline-flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-bold text-white">{localizeCopy("下一步", "Avanti")} <ArrowRight className="h-4 w-4" /></button> : <button type="button" disabled={busy} onClick={() => void submit()} className="rounded-lg bg-black px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? (localizeCopy("提交中…", "Invio…")) : (localizeCopy("创建账户", "Crea account"))}</button>}</div>
      </div>
    </div>
  </div>;
};
