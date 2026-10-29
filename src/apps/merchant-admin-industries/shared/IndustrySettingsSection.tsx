/**
 * 行业设置区段：商家资料、经营类型、语言、商品编辑锁与登出。
 * 写入走既有 /api/merchant/settings 契约，不做本地假保存。
 */
import React, { useEffect, useState } from 'react';
import { LogOut, RefreshCcw, ShieldCheck } from 'lucide-react';
import { apiPut } from '../../../api/client';
import { merchantStorefrontUrl } from '../../../shared/merchantStoreUrl';
import { useB2B } from '../../../context/B2BContext';
import { describeApiError, fetchMerchantSettings, setMerchantProductEditing, updateMerchantStorefront, type MerchantSettingsSnapshot } from './data';
import {
  Button,
  ErrorBanner,
  FormField,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusPill,
  inputClass
} from './kit';

type SettingsForm = {
  moq: string;
  defaultPaymentTerm: string;
  shippingNote: string;
  mobileLanguage: string;
  expectedUpdatedAt: string;
  name: string;
  companyLegalName: string;
  vatNumber: string;
  country: string;
  city: string;
  showroomAddress: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  websiteUrl: string;
  logo: string;
  tagline: string;
  description: string;
};

export const IndustrySettingsSection: React.FC<{
  workspaceName: string;
  templateName: string;
  notify: (type: 'success' | 'info' | 'warning', title: string, message: string) => void;
}> = ({ workspaceName, templateName, notify }) => {
  const context = useB2B() as any;
  const [snapshot, setSnapshot] = useState<MerchantSettingsSnapshot | null>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingBusy, setEditingBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const settings = await fetchMerchantSettings();
      setSnapshot(settings);
      setForm({
        moq: settings.moq,
        defaultPaymentTerm: settings.defaultPaymentTerm,
        shippingNote: settings.shippingNote,
        mobileLanguage: settings.mobileLanguage || 'auto',
        expectedUpdatedAt: settings.updatedAt,
        name: settings.profile?.name || '',
        companyLegalName: settings.profile?.companyLegalName || '',
        vatNumber: settings.profile?.vatNumber || '',
        country: settings.profile?.country || '',
        city: settings.profile?.city || '',
        showroomAddress: settings.profile?.showroomAddress || '',
        contactPerson: settings.profile?.contactPerson || '',
        contactPhone: settings.profile?.contactPhone || '',
        contactEmail: settings.profile?.contactEmail || '',
        websiteUrl: settings.websiteUrl || '',
        logo: settings.storefront?.logo || '',
        tagline: settings.storefront?.tagline || '',
        description: settings.storefront?.description || ''
      });
    } catch (caught) {
      setError(describeApiError(caught, '设置读取失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    setError('');
    try {
      await apiPut('/api/merchant/settings', {
        moq: Number(form.moq) || 6,
        defaultPaymentTerm: form.defaultPaymentTerm,
        shippingNote: form.shippingNote,
        mobileDefaultTab: 'dashboard',
        mobileLanguage: form.mobileLanguage,
        name: form.name,
        companyLegalName: form.companyLegalName,
        vatNumber: form.vatNumber,
        country: form.country,
        city: form.city,
        showroomAddress: form.showroomAddress,
        contactPerson: form.contactPerson,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        websiteUrl: form.websiteUrl.trim(),
        ...(form.expectedUpdatedAt ? { expectedUpdatedAt: form.expectedUpdatedAt } : {})
      });
      notify('success', '资料与设置已保存', '服务端已写入商家资料与经营配置');
      await load();
    } catch (caught) {
      setError(describeApiError(caught, '设置保存失败'));
    } finally {
      setBusy(false);
    }
  };

  const [storefrontBusy, setStorefrontBusy] = useState(false);

  const saveStorefront = async () => {
    if (!form) return;
    setStorefrontBusy(true);
    setError('');
    try {
      await updateMerchantStorefront({
        logo: form.logo.trim(),
        tagline: form.tagline.trim(),
        description: form.description.trim()
      });
      notify('success', '店铺展示已保存', '前台重新加载即显示最新 Logo 与店铺介绍');
      await load();
    } catch (caught) {
      setError(describeApiError(caught, '店铺展示保存失败'));
    } finally {
      setStorefrontBusy(false);
    }
  };

  const toggleStorefront = async () => {
    if (!snapshot?.storefront) return;
    setStorefrontBusy(true);
    setError('');
    try {
      const next = snapshot.storefront.storefrontEnabled !== true;
      await updateMerchantStorefront({ storefrontEnabled: next });
      notify(
        'success',
        next ? '店铺已恢复营业' : '店铺已暂停展示',
        next ? '公开前台重新可以访问本店' : '公开前台不再展示本店，后台数据不受影响'
      );
      await load();
    } catch (caught) {
      setError(describeApiError(caught, '店铺状态更新失败'));
    } finally {
      setStorefrontBusy(false);
    }
  };

  const toggleEditing = async () => {
    if (!snapshot) return;
    setEditingBusy(true);
    setError('');
    try {
      await setMerchantProductEditing(!snapshot.productEditingEnabled);
      notify('success', '商品编辑权限已更新', snapshot.productEditingEnabled ? '已锁定商品编辑' : '已开启商品编辑');
      await load();
    } catch (caught) {
      setError(describeApiError(caught, '商品编辑权限更新失败'));
    } finally {
      setEditingBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="商家资料与账户"
        description={`${workspaceName} · 经营类型 ${templateName}`}
        actions={<Button variant="ghost" onClick={() => void load()}><RefreshCcw className="h-4 w-4" />刷新</Button>}
      />
      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}
      {loading ? <LoadingBlock label="正在读取商家设置" /> : (
        <>
          <SectionCard title="商家资料" description="写入商家主档，其他终端读取同一份服务端资料。">
            {form ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="商家名称" required>
                  <input className={inputClass} maxLength={120} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
                </FormField>
                <FormField label="公司法定名称">
                  <input className={inputClass} maxLength={160} value={form.companyLegalName} onChange={event => setForm({ ...form, companyLegalName: event.target.value })} />
                </FormField>
                <FormField label="VAT 号">
                  <input className={inputClass} maxLength={80} value={form.vatNumber} onChange={event => setForm({ ...form, vatNumber: event.target.value })} />
                </FormField>
                <FormField label="联系人">
                  <input className={inputClass} maxLength={100} value={form.contactPerson} onChange={event => setForm({ ...form, contactPerson: event.target.value })} />
                </FormField>
                <FormField label="联系电话">
                  <input className={inputClass} maxLength={60} value={form.contactPhone} onChange={event => setForm({ ...form, contactPhone: event.target.value })} />
                </FormField>
                <FormField label="联系邮箱" required>
                  <input className={inputClass} type="email" maxLength={160} value={form.contactEmail} onChange={event => setForm({ ...form, contactEmail: event.target.value })} />
                </FormField>
                <FormField label="国家">
                  <input className={inputClass} maxLength={80} value={form.country} onChange={event => setForm({ ...form, country: event.target.value })} />
                </FormField>
                <FormField label="经营城市">
                  <input className={inputClass} maxLength={80} value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="公司地址">
                    <input className={inputClass} maxLength={240} value={form.showroomAddress} onChange={event => setForm({ ...form, showroomAddress: event.target.value })} />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="网站域名">
                    <input className={inputClass} maxLength={300} placeholder="https://shop.example.com" value={form.websiteUrl} onChange={event => setForm({ ...form, websiteUrl: event.target.value })} />
                  </FormField>
                </div>
                <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-neutral-500">保存后其他终端重新读取即显示最新资料；并发修改会返回冲突而不是覆盖。</p>
                  <Button variant="primary" busy={busy} onClick={() => void save()}>保存资料与设置</Button>
                </div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="店铺展示与状态"
            description="Logo、店铺介绍与营业状态写入同一商家主档，公开前台按该状态决定是否展示。"
          >
            {form ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-neutral-50 p-3 text-xs">
                    <span className="text-neutral-500">经营类型</span>
                    <strong className="mt-1 block text-sm">{snapshot?.industry?.code || templateName}</strong>
                    <p className="mt-1 text-neutral-500">模板 {snapshot?.industry?.template || '—'}</p>
                  </div>
                  <div className="rounded-lg bg-neutral-50 p-3 text-xs">
                    <span className="text-neutral-500">店铺状态</span>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusPill tone={snapshot?.storefront?.storefrontEnabled === true ? 'success' : 'warning'}>
                        {snapshot?.storefront?.storefrontEnabled === true ? '营业中' : '已暂停'}
                      </StatusPill>
                      <Button variant={snapshot?.storefront?.storefrontEnabled === true ? 'danger' : 'primary'} busy={storefrontBusy} onClick={() => void toggleStorefront()}>
                        {snapshot?.storefront?.storefrontEnabled === true ? '暂停展示' : '恢复营业'}
                      </Button>
                    </div>
                    <p className="mt-1 text-neutral-500">前台当前{snapshot?.storefront?.publiclyVisible ? '可见' : '不可见'}；暂停只影响展示，不影响后台数据。</p>
                  </div>
                </div>

                {snapshot?.storefront?.storeSlug ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 p-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-900">店铺链接</p>
                      <p className="truncate text-neutral-500">{merchantStorefrontUrl(snapshot.storefront.storeSlug, 'zh')}</p>
                    </div>
                    <a
                      href={merchantStorefrontUrl(snapshot.storefront.storeSlug, 'zh')}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center rounded-lg border border-neutral-300 px-3 font-semibold text-neutral-900 hover:border-neutral-400"
                    >
                      打开前台
                    </a>
                  </div>
                ) : null}

                <FormField label="Logo 图片地址">
                  <input className={inputClass} maxLength={2048} placeholder="https://... 或已上传的图片地址" value={form.logo} onChange={event => setForm({ ...form, logo: event.target.value })} />
                </FormField>
                {form.logo ? (
                  <div className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3">
                    <img src={form.logo} alt="店铺 Logo 预览" className="h-14 w-14 rounded-lg border border-neutral-200 object-contain" />
                    <p className="text-xs text-neutral-500">保存后前台与商家名片使用同一 Logo。</p>
                  </div>
                ) : null}
                <FormField label="店铺标语">
                  <input className={inputClass} maxLength={160} value={form.tagline} onChange={event => setForm({ ...form, tagline: event.target.value })} />
                </FormField>
                <FormField label="店铺简介">
                  <textarea className={`${inputClass} min-h-[90px]`} maxLength={3000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} />
                </FormField>
                <div className="flex justify-end">
                  <Button variant="primary" busy={storefrontBusy} onClick={() => void saveStorefront()}>保存店铺展示</Button>
                </div>
              </div>
            ) : null}
          </SectionCard>

            <SectionCard title="账户与权限">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-neutral-900">商品编辑权限</p>
                    <p className="text-xs text-neutral-500">关闭时上下架、归档与商品编辑会被服务端拒绝。</p>
                  </div>
                  <Button variant={snapshot?.productEditingEnabled ? 'danger' : 'primary'} busy={editingBusy} onClick={() => void toggleEditing()}>
                    {snapshot?.productEditingEnabled ? '锁定编辑' : '开启编辑'}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">当前状态</span>
                  <StatusPill tone={snapshot?.productEditingEnabled ? 'success' : 'warning'}>
                    {snapshot?.productEditingEnabled ? '可编辑' : '已锁定'}
                  </StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">员工与权限</span>
                  <span className="font-medium">在「团队权限」页维护，服务端校验门店归属</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">账户安全</span>
                  <span className="inline-flex items-center gap-1 font-medium"><ShieldCheck className="h-4 w-4" />会话由服务端校验</span>
                </div>
                <Button variant="secondary" onClick={() => context.logout?.()}>
                  <LogOut className="h-4 w-4" />退出登录
                </Button>
              </div>
            </SectionCard>

          <SectionCard title="基础设置">
            {form ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="默认 MOQ"><input className={inputClass} inputMode="numeric" value={form.moq} onChange={event => setForm({ ...form, moq: event.target.value })} /></FormField>
                <FormField label="默认账期">
                  <select className={inputClass} value={form.defaultPaymentTerm} onChange={event => setForm({ ...form, defaultPaymentTerm: event.target.value })}>
                    <option value="prepaid">预付</option>
                    <option value="net_15">15 天</option>
                    <option value="net_30">30 天</option>
                    <option value="net_60">60 天</option>
                  </select>
                </FormField>
                <FormField label="界面语言">
                  <select className={inputClass} value={form.mobileLanguage} onChange={event => setForm({ ...form, mobileLanguage: event.target.value })}>
                    <option value="auto">跟随浏览器</option>
                    <option value="zh">简体中文</option>
                    <option value="it">Italiano</option>
                    <option value="en">English</option>
                  </select>
                </FormField>
                <FormField label="发货说明"><input className={inputClass} value={form.shippingNote} onChange={event => setForm({ ...form, shippingNote: event.target.value })} /></FormField>
                <div className="sm:col-span-2 flex justify-end">
                  <Button variant="primary" busy={busy} onClick={() => void save()}>保存设置</Button>
                </div>
              </div>
            ) : null}
          </SectionCard>
        </>
      )}
    </div>
  );
};

