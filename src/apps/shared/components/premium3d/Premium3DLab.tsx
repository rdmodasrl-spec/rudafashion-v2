/**
 * RUDA Premium UI Lab —— 3D 组件的真实预览页。
 *
 * 只在 URL 带 `?premiumLab=1` 时接管渲染，noindex，不进入任何生产导航。
 * 全部组件使用真实商品数据（与店铺模板同一数据出口 useStorefrontData），
 * 不使用静态图片冒充 3D，也不使用假商品。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useStorefrontData } from '../storefront/useStorefrontData';
import {
  BrandWordmark3D,
  FluidBackdrop3D,
  GalleryArc3D,
  ImmersiveHeroStage3D,
  INDUSTRY_PREMIUM_3D,
  MaterialStudy3D,
  ParticleField3D,
  ProductDepthHover3D,
  ProductFlipTransition3D,
  ProductTurntable3D,
  ScrollProductStage3D,
  getIndustryPremium3DPlan,
  type MaterialPreset
} from '.';

/**
 * 实验室默认商家：选一个「公开商品」的行业演示账号，
 * 这样未登录访问者也能看到真实商品驱动的 3D；
 * 箱包行业商品是批发可见性，需要买家登录，可用 ?merchant=demo-industry-bags-wholesale 指定。
 */
const DEMO_MERCHANT = 'demo-industry-general-retail';

function Section({ id, index, title, note, children }: { id: string; index: number; title: string; note: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-neutral-200 py-14">
      <div className="mb-8 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className="text-xs tabular-nums text-neutral-400">{String(index).padStart(2, '0')}</span>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-neutral-500">{note}</p>
      </div>
      {children}
    </section>
  );
}

export const Premium3DLab: React.FC = () => {
  const params = useMemo(() => (typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)), []);
  const merchantId = params.get('merchant') || DEMO_MERCHANT;
  const data = useStorefrontData(merchantId);
  const [material, setMaterial] = useState<MaterialPreset>('leather');
  const [fps, setFps] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow';
    document.head.appendChild(meta);
    document.title = 'RUDA Premium UI Lab · 3D 组件预览';
    return () => { meta.remove(); };
  }, []);

  const products = data.products;
  const withImages = useMemo(() => products.filter(product => product.images.length > 0), [products]);
  const primary = withImages[0];
  const secondary = withImages[1] || primary;

  const galleryItems = withImages.slice(0, 8).map(product => ({ id: product.id, image: product.images[0], title: product.name }));

  return (
    <div className="min-h-screen bg-[#fbfaf8] text-neutral-950">
      <header className="border-b border-neutral-200">
        <div className="mx-auto max-w-[1240px] px-5 py-10 sm:px-8">
          <p className="text-xs uppercase tracking-[0.32em] text-neutral-500">RUDA Premium UI Library</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Premium 3D 组件实验室</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">
            10 个可复用的 Three.js / WebGL 组件，全部使用真实商家商品数据（当前：{data.merchant?.name || '未找到商家'}，
            {' '}{products.length} 款商品）。WebGL 不可用或系统开启「减少动态效果」时自动回落静态图。
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {[
              { id: 'demo-industry-general-retail', label: '综合零售（公开商品）' },
              { id: 'demo-industry-department-chain-retail', label: '百货连锁' },
              { id: 'demo-industry-bags-wholesale', label: '箱包批发（需买家登录）' }
            ].map(item => (
              <a
                key={item.id}
                href={`?premiumLab=1&merchant=${item.id}`}
                className={`border px-2.5 py-1.5 ${item.id === merchantId ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 text-neutral-700 hover:border-neutral-950'}`}
              >
                {item.label}
              </a>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setEnabled(value => !value)}
              aria-pressed={!enabled}
              className="border border-neutral-300 px-3 py-1.5 hover:border-neutral-950"
            >
              {enabled ? '关闭 3D（查看降级效果）' : '开启 3D'}
            </button>
            <span className="text-neutral-500">实时帧率：{fps ? `${Math.round(fps)} fps` : '测量中'}</span>
            <a href="/?storefrontPreview=bags_editorial&merchant=demo-industry-bags-wholesale" className="text-neutral-600 underline underline-offset-4">看模板里的实际接入 →</a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-5 pb-24 sm:px-8">
        {!primary && (
          <p className="py-16 text-sm text-neutral-600">该商家没有可展示商品图，3D 组件需要真实商品图作为纹理。</p>
        )}

        {primary && (
          <>
            <Section index={1} id="hero-stage" title="沉浸式品牌首屏" note="商品立于展厅舞台，缓慢环绕 + 灯光呼吸">
              <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
                <ImmersiveHeroStage3D image={primary.images[0]} alt={primary.name} caption={`${data.merchant?.name} · ${primary.name}`} enabled={enabled} />
                <div className="self-center text-sm leading-7 text-neutral-600">
                  <p>用于行业官网首屏。环绕幅度 0.16 rad、周期约 28 秒，视觉存在感来自留白与光，而不是转速。</p>
                  <p className="mt-3">商品图按真实比例入画，不做裁切放大；没有商品图时显示中性底，不出现假 3D 模型。</p>
                </div>
              </div>
            </Section>

            <Section index={2} id="turntable" title="3D 商品转台" note="拖拽旋转、跨图切换、悬停减速">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {withImages.slice(0, 3).map(product => (
                  <ProductTurntable3D
                    key={product.id}
                    images={product.images}
                    productName={product.name}
                    productCode={product.styleNo}
                    enabled={enabled}
                    quality="high"
                  />
                ))}
              </div>
            </Section>

            <Section index={3} id="fluid" title="流体 Shader 背景" note="程序化噪声流动，取 RUDA 暖中性色">
              <div className="grid gap-6 lg:grid-cols-2">
                <FluidBackdrop3D enabled={enabled} ratio="16 / 9" />
                <FluidBackdrop3D enabled={enabled} ratio="16 / 9" tint="#dcd3c6" speed={1.8} />
              </div>
            </Section>

            <Section index={4} id="particles" title="动态粒子场" note="2 400 个 GPU 点，离屏自动停止">
              <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <ParticleField3D enabled={enabled} ratio="16 / 8" />
                <div className="self-center text-sm leading-7 text-neutral-600">
                  粒子数按 quality 档位变化（low 900 / high 2400），滚动出视口即停止渲染循环，页面隐藏时同样暂停。
                </div>
              </div>
            </Section>

            <Section index={5} id="depth-hover" title="图片悬停景深" note="指针驱动视差与伪景深，不改动商品卡点击区域">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {withImages.slice(0, 4).map(product => (
                  <ProductDepthHover3D key={product.id} image={product.images[0]} alt={product.name} enabled={enabled} />
                ))}
              </div>
            </Section>

            <Section index={6} id="flip" title="3D 商品转场" note="两张真实商品图翻面切换">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <ProductFlipTransition3D frontImage={primary.images[0]} backImage={secondary.images[0]} frontLabel={primary.name} backLabel={secondary.name} enabled={enabled} />
                <ProductFlipTransition3D frontImage={secondary.images[0]} backImage={primary.images[0]} frontLabel={secondary.name} backLabel={primary.name} intervalMs={4200} enabled={enabled} />
              </div>
            </Section>

            <Section index={7} id="gallery-arc" title="弧面商品画廊" note="商品沿弧线排布，可拖拽旋转">
              <GalleryArc3D items={galleryItems} enabled={enabled} />
            </Section>

            <Section index={8} id="scroll-stage" title="滚动驱动舞台" note="滚动进度推动相机与商品队列">
              <ScrollProductStage3D images={withImages.slice(0, 4).map(product => product.images[0])} titles={withImages.slice(0, 4).map(product => product.name)} enabled={enabled} />
            </Section>

            <Section index={9} id="material" title="材质研究台" note="PBR 光照演示皮革 / 金属 / 哑光 / 玻璃">
              <div className="mb-5 flex flex-wrap gap-2">
                {(['leather', 'metal', 'matte', 'glass'] as MaterialPreset[]).map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMaterial(preset)}
                    aria-pressed={material === preset}
                    className={`border px-3 py-1.5 text-xs ${material === preset ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 text-neutral-700 hover:border-neutral-950'}`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <MaterialStudy3D preset={material} enabled={enabled} />
                <div className="sm:col-span-2 lg:col-span-3 self-center text-sm leading-7 text-neutral-600">
                  程序化环境反射（无外部 HDR 依赖）。皮革用于箱包、金属用于珠宝、玻璃用于美妆，
                  参数是设计演示，不代表商家真实工艺，线上文案不得据此编造材质。
                </div>
              </div>
            </Section>

            <Section index={10} id="wordmark" title="动态品牌字标" note="商家名称采样为粒子字标">
              <BrandWordmark3D text={data.merchant?.name || 'RUDA'} subline="Pelletteria italiana" enabled={enabled} onFps={setFps} />
            </Section>
          </>
        )}

        <section className="border-t border-neutral-200 py-14">
          <h2 className="text-xl font-semibold tracking-tight">七行业应用策略</h2>
          <p className="mt-2 text-sm text-neutral-600">同一套组件，按行业业务特征选择位置与数量；每套模板最多两个 3D 区块。</p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-[0.12em] text-neutral-500">
                  <th className="py-2 pr-4">行业</th>
                  <th className="py-2 pr-4">首屏</th>
                  <th className="py-2 pr-4">商品检视</th>
                  <th className="py-2 pr-4">材质</th>
                  <th className="py-2 pr-4">氛围</th>
                  <th className="py-2">说明</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(INDUSTRY_PREMIUM_3D) as Array<keyof typeof INDUSTRY_PREMIUM_3D>).map(industry => {
                  const plan = getIndustryPremium3DPlan(industry);
                  return (
                    <tr key={industry} className="border-b border-neutral-200 align-top">
                      <td className="py-3 pr-4 font-medium">{industry}</td>
                      <td className="py-3 pr-4 text-neutral-700">{plan.hero}</td>
                      <td className="py-3 pr-4 text-neutral-700">{plan.inspect}</td>
                      <td className="py-3 pr-4 text-neutral-700">{plan.material || '—'}</td>
                      <td className="py-3 pr-4 text-neutral-700">{plan.ambient || '—'}</td>
                      <td className="py-3 text-neutral-600">{plan.rationale}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};
