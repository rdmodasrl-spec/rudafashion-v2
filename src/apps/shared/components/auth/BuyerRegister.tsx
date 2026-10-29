import React, { useState } from 'react';
import { FileText, Lock, Mail, Building2, User, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { PasswordInput } from '../common/PasswordInput';
import { formatInternationalPhoneNumber, PhoneNumberInput } from '../common/PhoneNumberInput';
import { buyerAvatarOptions } from '../../../../utils/buyerAvatars';

export const BuyerRegister: React.FC<{ onBackToLogin: () => void }> = ({ onBackToLogin }) => {
  const { registerBuyer, t, lang, localizeCopy } = useB2B();
  const [form, setForm] = useState({
    companyLegalName: '',
    vatNumber: '',
    contactPerson: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    country: 'Italy',
    city: 'Milan',
    businessType: '城市批发商',
  });
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [thirdPartyMarketingConsent, setThirdPartyMarketingConsent] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(buyerAvatarOptions[0].url);
  const isZh = lang === 'zh';

  const up = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setOk('');
    if (!acceptedTerms || !acceptedPrivacy) {
      setErr(localizeCopy("请先阅读并同意销售和使用条款及隐私政策", "Accetta i Termini di Uso e Vendita e l'Informativa Privacy per continuare"));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setErr(localizeCopy("两次输入的密码不一致", "Passwords do not match"));
      return;
    }
    if (form.password.length < 6) {
      setErr(localizeCopy("密码至少 6 位", "Password must be at least 6 chars"));
      return;
    }
    setLoading(true);
    try {
      const r = await registerBuyer({
        ...form,
        phone: formatInternationalPhoneNumber(form.country, form.phone),
        avatarUrl,
        acceptedTerms,
        acceptedPrivacy,
        marketingConsent,
        thirdPartyMarketingConsent
      });
      if (r) {
        setOk(localizeCopy("✅ 资质申请已提交，审核通过后即可登录", "✅ Application submitted, pending review"));
      } else {
        setErr(localizeCopy("申请失败，请稍后重试", "Application failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-10 bg-gradient-to-br from-neutral-50 to-neutral-200/50">
      <div className="w-full max-w-2xl">
        <button type="button" onClick={onBackToLogin} className="mb-4 text-xs text-neutral-600 hover:text-black flex items-center gap-1.5 font-medium">
          <ArrowLeft className="w-3.5 h-3.5" /> {localizeCopy("返回登录", "Back to Login")}
        </button>

        <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
          <div className="bg-black text-white p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-10 h-10 text-neutral-300" />
              <div>
                <div className="font-black text-xl tracking-wider font-serif">{t('wholesaleRegisterTitle')}</div>
                <div className="text-[11px] uppercase tracking-widest text-neutral-400">
                  {localizeCopy("批发商资质审核", "Wholesaler accreditation")}
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handle} className="p-6 sm:p-8 space-y-5">
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-neutral-700">
                {localizeCopy("选择你的头像", "Scegli il tuo avatar")}
              </legend>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {buyerAvatarOptions.map((avatar, index) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setAvatarUrl(avatar.url)}
                    aria-pressed={avatarUrl === avatar.url}
                    aria-label={localizeCopy(`选择头像 ${index + 1}`, `Scegli avatar ${index + 1}`)}
                    className={`relative mx-auto h-20 w-20 overflow-hidden rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 ${
                      avatarUrl === avatar.url
                        ? 'border-neutral-900 ring-2 ring-neutral-900/10'
                        : 'border-neutral-200 hover:border-neutral-500'
                    }`}
                  >
                    <img
                      src={avatar.url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {avatarUrl === avatar.url && (
                      <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-white ring-2 ring-white" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-neutral-500">
                {localizeCopy("从 9 个头像中任选一个，用作买家资料头像。", "Scegli uno dei 9 avatar da associare al tuo profilo acquirente.")}
              </p>
            </fieldset>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">{localizeCopy("公司名称（营业执照）*", "Company Legal Name *")}</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input value={form.companyLegalName} onChange={(e) => up('companyLegalName', e.target.value)} required className="w-full pl-10 pr-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">{localizeCopy("税号 *", "Partita IVA / Codice fiscale *")}</label>
                <input value={form.vatNumber} onChange={(e) => up('vatNumber', e.target.value)} required className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">{localizeCopy("联系人 *", "Contact Person *")}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input value={form.contactPerson} onChange={(e) => up('contactPerson', e.target.value)} required className="w-full pl-10 pr-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">{localizeCopy("联系电话", "Phone")}</label>
                <PhoneNumberInput
                  country={form.country}
                  onCountryChange={country => up('country', country)}
                  value={form.phone}
                  onChange={phone => up('phone', phone)}
                  className="w-full"
                  inputClassName="focus:ring-black"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">{localizeCopy("登录邮箱 *", "Email *")}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input type="email" value={form.email} onChange={(e) => up('email', e.target.value)} required className="w-full pl-10 pr-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">{localizeCopy("业务类型", "Business Type")}</label>
                <select value={form.businessType} onChange={(e) => up('businessType', e.target.value)} className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all text-sm bg-white">
                  <option value="城市批发商">{localizeCopy("城市批发商", "Grossista cittadino")}</option>
                  <option value="裁剪公司">{localizeCopy("裁剪公司", "Azienda di taglio")}</option>
                  <option value="百货公司">{localizeCopy("百货公司", "Grande magazzino")}</option>
                  <option value="皮具批发">{localizeCopy("皮具批发", "Ingrosso pelletteria")}</option>
                  <option value="百货批发">{localizeCopy("百货批发", "Ingrosso articoli vari")}</option>
                  <option value="服装批发">{localizeCopy("服装批发", "Ingrosso abbigliamento")}</option>
                  <option value="服装店">{localizeCopy("服装店", "Negozio di abbigliamento")}</option>
                  <option value="连锁店">{localizeCopy("连锁店", "Catena di negozi")}</option>
                  <option value="零售店">{localizeCopy("零售店", "Negozio al dettaglio")}</option>
                  <option value="货行">{localizeCopy("货行", "Commerciante all’ingrosso")}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">{localizeCopy("登录密码 *", "Password *")}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <PasswordInput value={form.password} onChange={(e) => up('password', e.target.value)} required className="w-full pl-10 pr-10 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">{localizeCopy("确认密码 *", "Confirm Password *")}</label>
                <PasswordInput value={form.confirmPassword} onChange={(e) => up('confirmPassword', e.target.value)} required className="w-full pr-10 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all text-sm" />
              </div>
            </div>

            <div className="space-y-3 border-t border-neutral-200 pt-5 text-[11px] leading-5 text-neutral-600">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-black" />
                <span>{isZh ? <><strong className="text-red-600">*</strong> 我声明我已阅读并接受 <a href="/requirements" target="_blank" rel="noreferrer" className="font-semibold text-neutral-900 underline">销售和使用条款</a>。</> : <><strong className="text-red-600">*</strong> Dichiaro di aver letto e accettato i <a href="/requirements" target="_blank" rel="noreferrer" className="font-semibold text-neutral-900 underline">Termini e Condizioni di Uso e Vendita</a>.</>}</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={acceptedPrivacy} onChange={event => setAcceptedPrivacy(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-black" />
                <span>{isZh ? <><strong className="text-red-600">*</strong> 根据欧洲个人数据保护条例 679/16（经第 101/18 号法令更新），我接受并同意数据控制者 <strong>RUDA ITALIA S.R.L.</strong> 按照<a href="/about" target="_blank" rel="noreferrer" className="font-semibold text-neutral-900 underline">隐私政策</a>中规定的目的处理我的个人数据。</> : <><strong className="text-red-600">*</strong> Ai sensi del GDPR e della normativa italiana applicabile, acconsento al trattamento dei miei dati personali da parte di <strong>RUDA ITALIA S.R.L.</strong> secondo quanto indicato nell'<a href="/about" target="_blank" rel="noreferrer" className="font-semibold text-neutral-900 underline">Informativa Privacy</a>.</>}</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={marketingConsent} onChange={event => setMarketingConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-black" />
                <span>{localizeCopy("我同意 ruda.fashion 向我发送用于营销目的的广告材料、新闻通讯、促销和商业通讯。", "Acconsento a ricevere da ruda.fashion materiale pubblicitario, newsletter, promozioni e comunicazioni commerciali per finalita di marketing.")}</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={thirdPartyMarketingConsent} onChange={event => setThirdPartyMarketingConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-black" />
                <span>{localizeCopy("我接受并同意第三方公司出于营销目的处理我的个人数据。", "Accetto che societa terze trattino i miei dati personali per finalita di marketing.")}</span>
              </label>
            </div>

            {ok && <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{ok}</div>}
            {err && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</div>}

            <button
              type="submit"
              disabled={loading || !acceptedTerms || !acceptedPrivacy}
              className="w-full bg-black text-white py-3 rounded-lg font-semibold text-sm hover:bg-neutral-800 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              {loading ? (localizeCopy("提交中...", "Submitting...")) : (localizeCopy("提交资质申请（免费）", "Submit Application (Free)"))}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
