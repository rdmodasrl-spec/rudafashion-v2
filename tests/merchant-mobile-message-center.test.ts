import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { merchantMobilePrimaryTabs, merchantMobileMoreGroups } from '../src/apps/merchant-admin-common/components/merchant/merchantMobileNavigation';
import { UI_COPY_CATALOG } from '../src/i18n/uiCopyCatalog';

const root = path.resolve(import.meta.dirname, '..');

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const mobile = source('src/apps/merchant-admin-mobile/MerchantMobileApp.tsx');
const messageCenter = source('src/apps/merchant-admin-common/components/merchant/MerchantMessageCenter.tsx');
const notifications = source('src/apps/merchant-admin-common/components/merchant/merchantNotifications.ts');
const bell = source('src/apps/merchant-admin-common/components/merchant/MerchantNotificationBell.tsx');

test('首页右上角只保留真实消息入口并打开统一消息中心', () => {
  assert.match(
    mobile,
    /aria-label=\{merchantUnreadNotifications > 0 \? mobileText\(`消息中心，\$\{merchantUnreadNotifications\} 条未读`[^)]*\) : mobileText\('消息中心', 'Centro messaggi'\)\}/,
    '消息图标的无障碍名称包含真实未读数'
  );
  assert.match(mobile, /onClick=\{\(\) => setMessageCenterOpen\(true\)\}/, '消息图标打开消息中心');
  assert.doesNotMatch(mobile, /mobileText\('查看订单提醒', 'Avvisi ordini'\)/, '不再把铃铛错误跳转到订单页');
  assert.doesNotMatch(mobile, /setActiveTab\('orders'\)\} className="relative grid h-9 w-9/, '铃铛不再复用订单页跳转');
  assert.doesNotMatch(mobile, /打开 ModaUI 助手|title=\{mobileText\('ModaUI 助手'/, 'AI 图标已从顶部工具栏移除');
  assert.doesNotMatch(mobile, /<Bot /, '顶部不再渲染第二个助手图标');
  const headerBell = mobile.slice(mobile.indexOf("title={mobileText('消息中心', 'Centro messaggi')}"), mobile.indexOf("title={mobileText('消息中心', 'Centro messaggi')}") + 700);
  assert.match(headerBell, /\{merchantUnreadNotifications > 0 && <span/, '未读徽标按接口返回的未读数展示');
  assert.doesNotMatch(headerBell, /orderActionCount/, '徽标不再使用订单待办数');
});

test('消息中心读取真实通知接口、不使用模拟消息', () => {
  assert.match(notifications, /apiGet<MerchantNotificationsResponse>\('\/api\/merchant\/notifications'\)/, '复用商家通知接口');
  assert.match(notifications, /apiPost\(`\/api\/merchant\/notifications\/\$\{encodeURIComponent\(id\)\}\/read`/, '标记已读复用既有接口');
  assert.match(notifications, /setUnread\(Number\.isFinite\(response\.unread\) \? response\.unread : 0\)/, '未读数来自接口响应');
  assert.match(notifications, /export function useMerchantNotifications/, '单一读取实现供铃铛和消息中心复用');
  assert.doesNotMatch(notifications, /mock|demo|模拟|示例消息/, '不得内置模拟通知');
  assert.doesNotMatch(notifications, /\/resolve`/, '后端无 resolve 接口，不调用不存在的路由');
  assert.doesNotMatch(messageCenter, /apiGet|apiPost|fetch\(|axios/, '消息中心不自建请求，只消费共享数据');
  assert.doesNotMatch(messageCenter, /mockNotifications|演示消息|MOCK_NOTIFICATIONS/, '消息中心不使用占位假数据');
  assert.match(bell, /useMerchantNotifications\(\{?\)?/, '铃铛复用同一通知数据实现');
  assert.doesNotMatch(bell, /apiGet|apiPost/, '铃铛不再维护第二套请求逻辑');
});

test('消息中心覆盖系统、订单、库存分类并保留全部/未读/待处理筛选', () => {
  for (const label of ["localizeCopy('订单消息', 'Ordini')", "localizeCopy('库存提醒', 'Scorte')", "localizeCopy('系统通知', 'Sistema')", "localizeCopy('业务通知', 'Attività')"]) {
    assert.ok(messageCenter.includes(label), `消息分类 ${label}`);
  }
  for (const filter of ["localizeCopy('全部', 'Tutte')", "localizeCopy('未读', 'Non lette')", "localizeCopy('待处理', 'Da gestire')"]) {
    assert.ok(messageCenter.includes(filter), `筛选 ${filter}`);
  }
  assert.match(messageCenter, /notification\.businessStatus !== 'resolved'/, '待处理口径与后端业务状态一致');
  assert.match(messageCenter, /notification\.priority === 'high'/, '重要标记来自真实 priority');
  assert.match(messageCenter, /onClick=\{\(\) => \{ if \(unreadMessage\) void onMarkRead\(notification\.id\); \}\}/, '仅未读消息触发已读');
  assert.match(messageCenter, /role="dialog"[\s\S]*?aria-modal="true"/, '消息中心为可关闭的全屏对话框');
});

test('底部导航为五项且 ModaUI 位于中间并渲染统一单页工作台', () => {
  assert.deepEqual(merchantMobilePrimaryTabs.map(tab => tab.id), ['dashboard', 'products', 'ai_home', 'orders', 'more']);
  assert.equal(merchantMobilePrimaryTabs[2]!.zh, 'ModaUI');
  assert.equal(merchantMobileMoreGroups.flatMap(group => group.items.map(item => item.id)).includes('ai_home' as never), false, '更多页不再重复 AI 入口');
  assert.match(mobile, /<div className="grid grid-cols-5 gap-1">/, '底栏渲染 5 个入口');
  assert.match(mobile, /id="merchant-bottom-navigation"[\s\S]{0,900}aria-hidden=\{activeTab === 'ai_home' \? true : undefined\}/, 'AI 页默认隐藏底部导航并同步无障碍状态');
  assert.doesNotMatch(mobile, /aiNavigationOpen/, '不再保留旧 AI 首页的导航开关与拖柄');
  assert.doesNotMatch(mobile, /bottomNavigation=\{\{ open: aiNavigationOpen/, '工作台不再复用旧 AI 首页的拖柄导航');
  assert.doesNotMatch(mobile, /onComposerFocus=\{\(\) => setAiNavigationOpen\(false\)\}/, '工作台不再把键盘状态塞给旧首页');
  assert.match(mobile, /\{activeTab === 'ai_home' && \([\s\S]{0,900}<ModaUIWorkbench/, 'ModaUI 页渲染统一单页工作台');
  assert.match(mobile, /import\('\.\.\/merchant-admin-common\/components\/merchant\/modaui\/ModaUIWorkbench'\)/, '手机端复用同一工作台，而不是旧 AI 首页');
  assert.equal(readdirSync(path.join(root, 'src/apps/merchant-admin-mobile')).some(file => /ModaUiHome|ModaUIHome|AiHomePage/.test(file)), false, '未新增第二套 AI 页面');
  assert.match(mobile, /setActiveTab\(copilotOriginTabRef\.current \|\| 'dashboard'\)/, 'AI 页返回进入前的页签');
});

test('更多页通知中心与顶部消息入口打开同一个消息中心', () => {
  assert.match(mobile, /case 'notifications':\s*setMessageCenterOpen\(true\);\s*break;/, '更多页通知中心不再跳到经营设置');
  assert.doesNotMatch(mobile, /case 'notifications':\s*setSettingsSection\('operations'\)/, '移除错误的设置页跳转');
  assert.match(mobile, /<MerchantMessageCenter\s+open=\{messageCenterOpen\}/, '消息中心由手机端唯一实例渲染');
});

test('消息中心新增文案进入统一文案目录', () => {
  const catalog = new Set(UI_COPY_CATALOG.map(copy => `${copy.zh}\u0000${copy.it}`));
  const pairs: Array<[string, string]> = [
    ['ModaUI', 'ModaUI'],
    ['消息中心', 'Centro messaggi'],
    ['订单消息', 'Ordini'],
    ['库存提醒', 'Scorte'],
    ['系统通知', 'Sistema'],
    ['业务通知', 'Attività'],
    ['未读', 'Non lette'],
    ['待处理', 'Da gestire'],
    ['重要', 'Importante'],
    ['消息加载失败', 'Caricamento messaggi non riuscito'],
    ['暂无消息', 'Nessun messaggio']
  ];
  for (const [zh, it] of pairs) {
    assert.ok(catalog.has(`${zh}\u0000${it}`), `Missing UI copy ${zh} / ${it}`);
  }
});
