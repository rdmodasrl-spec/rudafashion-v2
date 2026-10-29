import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { UI_COPY_CATALOG } from '../src/i18n/uiCopyCatalog';

const root = path.resolve(import.meta.dirname, '..');

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const card = source('src/apps/merchant-admin-common/components/merchant/MerchantBusinessCard.tsx');
const mobile = source('src/apps/merchant-admin-mobile/MerchantMobileApp.tsx');
const portal = source('src/apps/merchant-admin-web/MerchantPortal.tsx');

test('商家名片只读展示调用方传入的当前商家真实数据', () => {
  assert.match(card, /export const MerchantBusinessCard: React\.FC<BusinessCardProps> = \(\{ merchant, onClose \}\)/, '名片组件接收当前商家并由调用方控制关闭');
  assert.match(card, /merchant: MerchantBusinessCardMerchant;/, '名片数据来自 Merchant 模型的真实字段');
  for (const field of [
    'merchant.name',
    'merchant.companyLegalName',
    'merchant.code',
    'merchant.storeLookupCode',
    'merchant.showroomAddress',
    'merchant.contactPerson',
    'merchant.contactPhone',
    'merchant.contactEmail',
    'merchant.wechat'
  ]) {
    assert.ok(card.includes(field), `名片读取 ${field}`);
  }
  assert.doesNotMatch(card, /apiGet|apiPost|fetch\(|axios/, '名片不自建请求，避免形成第二套商家数据源');
  assert.doesNotMatch(card, /mch-prato|merchant\.demo|示例商家|演示数据/, '名片不得写入演示商家数据');
});

test('商家名片的店铺链接与二维码来自当前商家的真实店铺域名', () => {
  assert.match(card, /import \{ merchantStorefrontUrl \} from '\.\.\/\.\.\/\.\.\/\.\.\/shared\/merchantStoreUrl'/, 'reuse the shared storefront URL helper');
  assert.match(card, /const storeUrl = merchant\.storeSlug \? merchantStorefrontUrl\(merchant\.storeSlug, storefrontLanguage\) : ''/, 'store link uses the assigned storeSlug only');
  assert.match(card, /<QRCodeSVG value=\{storeUrl\} size=\{96\} level="M" \/>/, '二维码 encodes the same real storefront URL');
  assert.doesNotMatch(card, /https:\/\/[a-z0-9-]+\.ruda\.fashion/, '不得硬编码任何商家域名');
  assert.match(card, /\{storeUrl && \(/, '缺少 storeSlug 时整块推广信息不渲染');
});

test('商家名片复用现有分享与复制能力并展示真实店铺码', () => {
  assert.match(card, /import \{ shareOrCopy \} from '\.\.\/\.\.\/\.\.\/\.\.\/utils\/share'/, '分享复用统一 shareOrCopy');
  assert.match(card, /await shareOrCopy\(\s*\{[\s\S]*?source: `merchant-\$\{merchant\.id\}`[\s\S]*?\},\s*'native'\s*\)/, '分享带商家来源标识并优先系统分享');
  assert.match(card, /\{merchant\.storeLookupCode && \(/, '店铺码按真实字段条件展示');
  assert.match(card, /merchant\.storeLookupCode\}/, '店铺码直接读取商家真实 storeLookupCode');
  assert.doesNotMatch(card, /storeLookupCode: '\d{6}'|店铺码[:：]\s*\d{6}/, '不得写死店铺码');
  assert.match(card, /授权区商品需客户提交看货申请，经商家审批后可见/, '名片说明现有私密货盘授权流程，不新增授权逻辑');
  assert.doesNotMatch(card, /vaultAccessRequest|vault-requests|approveVaultAccess/, '名片不自行实现授权审批');
});

test('手机端首页顶部商家身份改为可点击入口并打开名片', () => {
  assert.match(mobile, /import \{ MerchantBusinessCard \} from '\.\.\/merchant-admin-common\/components\/merchant\/MerchantBusinessCard'/, '手机端复用共享名片组件');
  assert.match(mobile, /const \[showMerchantStoreQr, setShowMerchantStoreQr\] = useState\(false\);\s*\n\s*const \[showBusinessCard, setShowBusinessCard\] = useState\(false\);/, '名片使用独立开关，不影响既有二维码状态');
  assert.match(
    mobile,
    /onClick=\{\(\) => setShowBusinessCard\(true\)\} aria-label=\{mobileText\('打开商家名片', 'Apri scheda negozio'\)\}/,
    '首页顶部 Logo 与名称可点击打开名片'
  );
  assert.match(mobile, /\{showBusinessCard && currentMerchant && \(\s*<MerchantBusinessCard merchant=\{currentMerchant\} onClose=\{\(\) => setShowBusinessCard\(false\)\} \/>/, '名片只渲染当前会话商家');
  assert.match(mobile, /if \(currentMerchant\?\.storefrontEnabled\) setShowMerchantStoreQr\(true\)/, '“更多”页原有店铺二维码入口保持不变');
});

test('电脑端侧栏商家身份打开同一张名片', () => {
  assert.match(portal, /import \{ MerchantBusinessCard \} from '\.\.\/merchant-admin-common\/components\/merchant\/MerchantBusinessCard'/, '电脑端复用同一组件');
  assert.match(portal, /onClick=\{\(\) => setBusinessCardOpen\(true\)\}/, '侧栏商家身份可点击');
  assert.match(portal, /\{businessCardOpen && \(\s*<MerchantBusinessCard merchant=\{currentMerchant\} onClose=\{\(\) => setBusinessCardOpen\(false\)\} \/>/, '电脑端名片使用当前商家');
  const sidebar = portal.slice(portal.indexOf('onClick={() => setBusinessCardOpen(true)}') - 600, portal.indexOf('onClick={() => setBusinessCardOpen(true)}') + 800);
  assert.match(sidebar, /\{currentMerchant\.name\}/, '侧栏入口展示当前商家名称，而非固定文案');
});

test('商家名片新增文案全部进入统一文案目录', () => {
  const catalog = new Set(UI_COPY_CATALOG.map(copy => `${copy.zh}\u0000${copy.it}`));
  const pairs: Array<[string, string]> = [
    ['打开商家名片', 'Apri scheda negozio'],
    ['商家名片', 'Scheda negozio'],
    ['商家资料', 'Dati negozio'],
    ['公司全称', 'Ragione sociale'],
    ['商家编号', 'ID negozio'],
    ['联系人', 'Referente'],
    ['电话', 'Telefono'],
    ['微信', 'WeChat'],
    ['已验证', 'Verificato'],
    ['店铺链接', 'Link negozio'],
    ['分享', 'Condividi'],
    ['店铺码', 'Codice negozio'],
    ['复制店铺码', 'Copia codice negozio'],
    ['扫码打开店铺', 'Scansiona per aprire il negozio'],
    ['复制链接', 'Copia link'],
    ['关闭', 'Chiudi'],
    ['已复制', 'Copiato']
  ];
  for (const [zh, it] of pairs) {
    assert.ok(catalog.has(`${zh}\u0000${it}`), `文案目录缺少 ${zh} / ${it}`);
  }
});
