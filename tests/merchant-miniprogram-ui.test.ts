import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, 'merchant-miniprogram', relativePath), 'utf8');

test('merchant tabs share the black-and-white UI primitives', () => {
  const appStyles = read('app.wxss');
  assert.match(appStyles, /button\.ui-button--primary[\s\S]*?background:\s*linear-gradient/);
  assert.match(appStyles, /button\.ui-button--secondary[\s\S]*?background:\s*linear-gradient/);
  assert.match(appStyles, /ui-button-pressed/);
  assert.match(appStyles, /button\.ui-button\[disabled\]/);
  assert.match(appStyles, /ui-status/);

  const expectedClasses: Record<string, RegExp[]> = {
    dashboard: [/ui-button--quiet/, /ui-card/, /ui-list-row/],
    products: [/ui-button--primary/, /ui-button--secondary/, /ui-status/, /ui-list-row/, /ui-chip/],
    orders: [/ui-button--primary/, /ui-button--secondary/, /ui-status/, /ui-card/, /ui-chip/],
    assistant: [/message-list/, /composer/, /feature-row/],
    more: [/ui-button--secondary/, /ui-card/, /ui-row-pressed/],
  };

  for (const [page, patterns] of Object.entries(expectedClasses)) {
    const markup = read(`pages/${page}/index.wxml`);
    for (const pattern of patterns) {
      assert.match(markup, pattern, `${page} should use ${pattern}`);
    }
  }
});

test('More provides a privacy guide page for the merchant mini program', () => {
  const more = read('pages/more/index.wxml');
  const moreLogic = read('pages/more/index.js');
  const app = JSON.parse(read('app.json'));
  const privacyPage = read('pages/privacy/index.wxml');

  assert.match(more, /隐私指引/);
  assert.match(moreLogic, /openPrivacyGuide[\s\S]*?pages\/privacy\/index/);
  assert.ok(app.pages.includes('pages/privacy/index'));
  assert.match(privacyPage, /账号与登录信息/);
  assert.match(privacyPage, /商家、员工及经营资料/);
  assert.doesNotMatch(privacyPage, /AI 虚拟试衣/);
  assert.doesNotMatch(privacyPage, /ModaUI/);
  assert.match(privacyPage, /不使用微信手机号快捷授权接口，也不会仅因登录而向微信读取手机号、头像、昵称或定位/);
});

test('More section and child-page names use four Chinese characters', () => {
  const moreLogic = read('pages/more/index.js');
  const moreMarkup = read('pages/more/index.wxml');
  const workspaceLogic = read('pages/workspace/index.js');
  const menuItems = moreLogic.match(/const groups = \[([\s\S]*?)\n\];/)?.[1] || '';
  const workspaceTitles = workspaceLogic.match(/const titles = \{([\s\S]*?)\n\};/)?.[1] || '';
  const subtitles = Array.from(menuItems.matchAll(/description: '([^']+)'/g), match => match[1]);
  const labels = [
    ...Array.from(menuItems.matchAll(/title: '([^']+)'/g), match => match[1]),
    ...Array.from(workspaceTitles.matchAll(/:\s*'([^']+)'/g), match => match[1]),
  ];

  assert.ok(labels.length > 0);
  for (const label of labels) {
    assert.equal(Array.from(label.matchAll(/\p{Script=Han}/gu)).length, 4, `${label} should use four Chinese characters`);
  }
  assert.ok(subtitles.length > 0);
  for (const subtitle of subtitles) {
    assert.equal(Array.from(subtitle.matchAll(/\p{Script=Han}/gu)).length, 8, `${subtitle} should use eight Chinese characters`);
  }
  assert.match(moreMarkup, /<text class="module-label">隐私指引<\/text>/);
  assert.match(moreMarkup, /<text class="module-desc">信息收集使用说明<\/text>/);
});

test('More child pages use distinct black-and-white layouts for their real business workflows', () => {
  const workspace = read('pages/workspace/index.wxml');
  const workspaceStyles = read('pages/workspace/index.wxss');
  const counterparties = read('pages/counterparties/index.wxml');
  const counterpartiesStyles = read('pages/counterparties/index.wxss');
  const tryon = read('pages/tryon/index.wxml');
  const tryonStyles = read('pages/tryon/index.wxss');
  const businessCard = read('pages/business-card/index.wxml');
  const businessCardStyles = read('pages/business-card/index.wxss');
  const privacyStyles = read('pages/privacy/index.wxss');

  assert.match(workspace, /class="screen workspace-page workspace-page--\{\{id\}\}"/);
  assert.match(workspace, /class="list-card workspace-record workspace-record--\{\{id\}\}"/);
  assert.match(workspace, /class="form-section-title">企业资料/);
  assert.match(workspace, /class="form-section-title">通知偏好/);
  assert.match(workspace, /class="preference-row"><text>订单通知<\/text><switch/);
  assert.match(workspace, /class="pos-total"/);
  assert.match(workspace, /class="record-filters"/);
  assert.match(workspace, /class="purchase-detail-overlay"/);
  assert.match(workspace, /class="notification-row"/);
  assert.doesNotMatch(workspace, /<text>(采购订单|SKU 库存|员工与操作记录|通知记录)<\/text>/);
  assert.match(workspace, /metrics\.length && id !== 'notifications'/);
  assert.match(workspace, /id === 'store'.*class="secondary-button employee-create-trigger".*toggleStorefrontEditor/);
  assert.match(workspace, /showStorefrontEditor[\s\S]*?class="storefront-template-picker"/);
  assert.match(workspace, /class="storefront-overview"/);
  assert.match(workspace, /merchantSettings\.name && !showSettingsEditor/);
  assert.match(workspace, /class="primary-button settings-preference-save" bindtap="saveMerchantSettings"/);
  assert.match(workspace, /id === 'settings' && merchantSettings\.name && showSettingsEditor/);
  assert.match(workspaceStyles, /\.workspace-page--finance/);
  assert.match(workspaceStyles, /\.workspace-page--procurement/);
  assert.match(workspaceStyles, /\.workspace-page--production/);
  assert.match(workspaceStyles, /\.workspace-page \.pos-card/);
  assert.match(workspaceStyles, /\.workspace-page \.list-card\.workspace-record/);
  assert.match(workspaceStyles, /\.workspace-list-panel/);
  assert.match(workspaceStyles, /\.workspace-page--notifications \.notification-mark/);
  assert.match(workspaceStyles, /\.workspace-page--store \.storefront-overview/);
  assert.match(workspaceStyles, /\.workspace-page--settings \.settings-preferences/);

  assert.match(counterparties, /class="record-list"/);
  assert.match(counterparties, /customerStats\.total/);
  assert.match(counterparties, /class="record-avatar"/);
  assert.match(counterparties, /class="detail-info-list"/);
  assert.match(counterparties, /class="editor-sheet"/);
  assert.match(counterparties, /class="detail-sheet"/);
  assert.match(counterpartiesStyles, /\.counterparty-page \.record-list/);
  assert.match(counterpartiesStyles, /\.counterparty-page \.error-card/);

  assert.match(tryon, /class="tryon-frame" data-field="person"/);
  assert.match(tryon, /class="tryon-frame" data-field="garment"/);
  assert.match(tryon, /class="category-picker"/);
  assert.match(tryon, /class="consent-row"/);
  assert.match(tryonStyles, /\.tryon-frame/);
  assert.match(tryonStyles, /\.tryon-page \.tryon-submit/);

  assert.match(businessCard, /class="contact-list"/);
  assert.match(businessCard, /open-type="share"/);
  assert.doesNotMatch(businessCard, /FASHION WHOLESALE|ITALIAN STYLE/);
  assert.match(businessCardStyles, /\.contact-value[\s\S]*?font-size:\s*20rpx/);
  assert.match(privacyStyles, /\.privacy-section[\s\S]*?border-bottom:\s*1rpx solid/);
  const privacySectionStyles = privacyStyles.match(/\.privacy-section\s*\{([^}]*)\}/)?.[1] || '';
  assert.doesNotMatch(privacySectionStyles, /box-shadow:/);
});

test('visual refresh preserves page geometry and business interactions', () => {
  const dashboard = read('pages/dashboard/index.wxml');
  const dashboardStyles = read('pages/dashboard/index.wxss');
  const products = read('pages/products/index.wxml');
  const productStyles = read('pages/products/index.wxss');
  const orders = read('pages/orders/index.wxml');
  const orderStyles = read('pages/orders/index.wxss');
  const assistant = read('pages/assistant/index.wxml');
  const assistantWelcome = assistant.split('<view wx:else class="message-list">')[0];
  const assistantLogic = read('pages/assistant/index.js');
  const assistantStyles = read('pages/assistant/index.wxss');
  assert.match(assistantStyles, /\.menu-panel\s*\{[^}]*position:\s*absolute[^}]*max-height:\s*70vh/);
  assert.match(assistantStyles, /\.menu-row\s*\{[^}]*min-height:\s*68rpx/);
  assert.match(assistantStyles, /\.quick-actions\s*\{[^}]*display:\s*flex/);
  assert.match(assistant, /class="quick-actions"/);
  assert.match(assistant, /wx:for="\{\{quickModes\}\}"[^>]*data-mode="\{\{item\.id\}\}"[^>]*bindtap="selectMode"/);
  assert.match(assistantStyles, /\.nav-handle\s*\{[^}]*height:\s*64rpx[^}]*justify-content:\s*center/);
  assert.match(assistantStyles, /\.nav-handle-bar--open\s*\{[^}]*background:\s*#737373/);
  assert.doesNotMatch(assistant, /class="drawer menu-drawer"|menu-feature-grid|menu-quota-card|menu-glyph|title-pill/);
  assert.doesNotMatch(assistantStyles, /\.menu-feature|\.menu-quota|\.menu-drawer|\.menu-glyph|\.title-pill/);
  const assistantMenu = assistant.split('<view wx:if="{{menuOpen}}" class="menu-backdrop"')[1]?.split('<view wx:if="{{selectedKnowledgeDocument}}"')[0] || '';
  assert.match(assistantMenu, /<view class="menu-group-label">对话<\/view>/);
  assert.match(assistantMenu, /<view class="menu-group-label">创作工具<\/view>/);
  assert.match(assistantMenu, /<view class="menu-group-label">其他<\/view>/);
  assert.match(assistantMenu, /bindtap="startNewConversation"/);
  assert.match(assistantMenu, /bindtap="toggleHistory"/);
  assert.match(assistantMenu, /data-section="create" bindtap="openSection"/);
  assert.match(assistantMenu, /data-section="designs" bindtap="openSection"/);
  assert.match(assistantMenu, /data-mode="edit" bindtap="selectMode"/);
  assert.match(assistantMenu, /data-mode="productLaunch" bindtap="selectMode"/);
  assert.match(assistantMenu, /data-section="knowledge" bindtap="openSection"/);
  assert.match(assistantMenu, /bindtap="showPricing"/);
  assert.match(assistantMenu, /bindtap="logout"/);
  assert.doesNotMatch(assistantMenu, /menu-note/);
  assert.match(assistant, /class="overlay" bindtap="closeOverlays"/);
  assert.match(assistant, /bindtap="startNewConversation"/);
  assert.match(assistant, /class="nav-handle" bindtap="toggleNavigation"/);
  assert.match(assistant, /class="nav-handle-bar \{\{navigationOpen \? 'nav-handle-bar--open' : ''\}\}"/);
  assert.match(assistant, /bindtouchstart="onNavTouchStart"/);
  assert.match(assistantLogic, /onNavTouchStart\(event\)\s*\{/);
  assert.match(assistantLogic, /onNavTouchEnd\(event\)\s*\{[\s\S]{0,700}setNavigationOpen\(delta > 0\)/);
  assert.match(assistant, /wx:if="\{\{!taskMode && !activeMode && !toolsOpen\}\}" class="quick-actions"/);
  assert.match(assistant, /aria-label="\{\{navigationOpen \? '收起商家导航' : '展开商家导航'\}\}"/);
  assert.match(assistantLogic, /navigationAvailable:\s*typeof this\.getTabBar === 'function'/);
  assert.match(assistantLogic, /toggleNavigation\(\)\s*\{[\s\S]*?tabBar\.setHidden\(false\)/);
  assert.match(assistantLogic, /hideTabBar\(\)\s*\{[\s\S]*?tabBar\.setHidden\(true\)/);
  assert.match(assistantLogic, /onShow\(\)\s*\{[\s\S]*?this\.hideTabBar\(\)/);
  assert.match(assistantLogic, /onUnload\(\)\s*\{[\s\S]*?this\.showTabBar\(\)/);
  const knowledgeStyles = assistantStyles.match(/\.knowledge-form\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(knowledgeStyles, /display:\s*flex/);
  assert.match(knowledgeStyles, /border-radius:\s*18rpx/);
  assert.match(assistantStyles, /\.knowledge-input,\s*\.knowledge-format,\s*\.knowledge-textarea\s*\{/);
  assert.match(assistantStyles, /\.knowledge-document\s*\{/);
  assert.match(assistantStyles, /\.knowledge-chunk\s*\{[^}]*white-space:\s*pre-wrap;[^}]*word-break:\s*break-all/);
  assert.match(assistantLogic, /MODAGPT_BRAIN_DISABLED/);
  assert.match(assistantLogic, /店铺智库服务尚未启用/);
  assert.match(assistant, /wx:if="\{\{!knowledgeFeatureDisabled\}\}" class="knowledge-form"/);
  assert.match(assistant, /wx:if="\{\{!knowledgeFeatureDisabled\}\}" class="retry-button"/);
  const more = read('pages/more/index.wxml');
  const moreStyles = read('pages/more/index.wxss');

  assert.match(dashboard, /bindtap="openProductShortcut"/);
  assert.match(dashboard, /bindtap="openTab"/);
  assert.match(dashboardStyles, /\.shortcut-row\s*\{[^}]*display:\s*flex/);
  assert.match(dashboardStyles, /\.metric-row\s*\{[^}]*display:\s*flex/);

  assert.match(products, /bindtap="createProduct"/);
  assert.match(products, /bindtap="openProduct"/);
  assert.match(products, /bindtap="handleProductMenuAction"/);
  assert.match(productStyles, /\.product-card\s*\{[^}]*min-height:\s*216rpx/);
  assert.match(productStyles, /\.product-card\s*\{[^}]*padding:\s*12rpx 0/);
  assert.match(productStyles, /\.product-image\s*\{[^}]*width:\s*128rpx; height:\s*152rpx/);

  assert.match(orders, /bindtap="advanceOrder"/);
  assert.match(orders, /bindtap="submitPartialShipment"/);
  assert.match(orderStyles, /\.order-card\s*\{[^}]*padding:\s*24rpx/);
  assert.match(orderStyles, /\.order-card\s*\{[^}]*background:\s*linear-gradient/);
  assert.match(orderStyles, /\.access-item\s*\{[^}]*height:\s*104rpx/);
  assert.match(orderStyles, /\.access-item\s*\{[^}]*box-shadow:\s*0 4rpx 12rpx/);
  assert.match(orderStyles, /\.order-list-screen \.btn--primary\s*\{[^}]*background:\s*linear-gradient/);
  assert.match(orderStyles, /\.order-list-screen \.btn--secondary\s*\{[^}]*box-shadow:/);
  assert.match(orderStyles, /\.order-list-screen \.btn\.ui-button-pressed\s*\{[^}]*transform:\s*translateY\(2rpx\)/);
  assert.match(orderStyles, /\.order-summary-card\s*\{[^}]*background:\s*linear-gradient/);
  assert.match(orderStyles, /\.order-card \.status-pending\s*\{[^}]*background:\s*#f8f0e4/);
  assert.match(orderStyles, /\.order-card \.status-cancelled,[\s\S]*\.order-card \.status-return_requested/);
  assert.match(orderStyles, /\.modern-search:focus-within\s*\{[^}]*box-shadow:/);
  assert.match(orderStyles, /\.order-total \.amount\s*\{[^}]*color:\s*#1d1b19/);
  assert.match(orderStyles, /\.modal-header\s*\{[^}]*box-shadow:/);
  assert.match(orderStyles, /\.shipment-item-row \.item-name\s*\{[^}]*font-weight:\s*600/);
  assert.match(orderStyles, /\.qty-input\s*\{[^}]*background:\s*linear-gradient/);
  assert.match(orderStyles, /\.shipment-shipping-info \.ruda-input:focus\s*\{[^}]*box-shadow:/);
  assert.match(orderStyles, /\.history-row\s*\{[^}]*border-bottom:\s*1rpx solid #eeece8/);
  assert.match(orderStyles, /\.modal-close:active\s*\{[^}]*transform:\s*scale\(\.94\)/);

  assert.match(assistant, /class="[^"]*\bmessage-list\b/);
  assert.match(assistant, /bindtap="sendMessage"/);
  assert.match(assistant, /aria-label="\{\{taskMode \? '预览业务任务' : '发送消息'\}\}"/);
  assert.match(assistant, /class="send-button \{\{canSend && !loading \? 'send-button-active' : ''\}\}"/);
  assert.match(assistant, /class="voice-glyph"/);
  assert.match(assistant, /class="composer-plus">＋<\/text>/);
  assert.match(assistant, /询问 ModaUI/);
  assert.match(assistant, /data-section="designs"/);
  assert.match(assistant, /wx:for="{{visibleHomeModes}}"/);
  assert.match(assistant, /<text class="feature-chat-text">\{\{item\.welcomeText\}\}<\/text>/);
  assert.doesNotMatch(assistantWelcome, /class="feature-title"|class="feature-description"/);
  assert.match(assistant, /bindtap="selectMode"/);
  assert.match(assistant, /bindtap="toggleHistory"/);
  assert.match(assistant, /bindtap="copyReply"/);
  assert.match(assistant, /bindtap="deleteReply"/);
  assert.doesNotMatch(assistant, /feedback-actions|data-basis/);
  assert.match(assistant, /class="topbar" style="padding-top: \{\{statusBarHeight\}\}px;"/);
  assert.match(assistant, /class="topbar-content"/);
  assert.match(assistant, /class="topbar-side"/);
  assert.match(assistant, /class="topbar-center"/);
  assert.match(assistant, /class="topbar-action back-action" bindtap="goBack"/);
  assert.match(assistant, /class="topbar-center"><text class="topbar-title">/);
  assert.match(assistant, /class="topbar-side topbar-side-right"/);
  assert.match(assistant, /class="topbar-action" bindtap="toggleMenu"/);
  assert.match(assistant, /class="more-glyph"><view><\/view><view><\/view><view><\/view><\/view>/);
  assert.match(assistant, /aria-label="更多操作"/);
  assert.match(assistant, /id="modaui-core"/);
  assert.match(assistant, /你好，/);
  assert.match(assistant, /我是 MODAUI。/);
  assert.doesNotMatch(assistant, /今天想做什么/);
  assert.doesNotMatch(assistant, /请勿发送个人身份|银行卡或密码/);
  assert.match(read('pages/assistant/index.json'), /"navigationStyle":\s*"custom"/);
  assert.match(read('pages/assistant/index.json'), /"navigationBarTitleText":\s*""/);
  assert.match(assistantLogic, /onLoad\(\)\s*\{[\s\S]*statusBarHeight/);
  assert.match(assistantLogic, /this\.data\.messages\.slice\(\)\.reverse\(\)/);
  assert.doesNotMatch(assistantLogic, /\[\.\.\.this\.data\.messages\]/);
  assert.match(assistantLogic, /const welcomeLines = \[/);
  const welcomeLineBlock = assistantLogic.match(/const welcomeLines = \[([\s\S]*?)\];/)?.[1] || '';
  for (const label of ["'AI 真人试衣'", "'精准换色'", "'AI 秀场视频'", "'模特设计'"]) {
    assert.ok(welcomeLineBlock.includes(label), `welcome rows should include ${label}`);
  }
  assert.equal((welcomeLineBlock.match(/^\s+'[^']+',?$/gm) || []).length, 4);
  assert.match(assistantLogic, /}, 5000\)/);
  assert.match(assistantLogic, /onHide\(\)\s*\{[\s\S]*stopWelcomeSequence/);
  assert.match(assistantStyles, /\.feature-row\s*\{[^}]*border-radius:\s*999rpx/);
  assert.doesNotMatch(assistantStyles, /\.feature-row\s*\{[^}]*border-bottom/);
  assert.match(assistantStyles, /\.topbar-content\s*\{[^}]*display:\s*flex/);
  assert.match(assistantStyles, /\.topbar-side\s*\{[^}]*flex:\s*0 0 72rpx/);
  assert.match(assistantStyles, /\.topbar-center\s*\{[^}]*justify-content:\s*center/);
  assert.match(assistantStyles, /\.topbar-side-right\s*\{[^}]*justify-content:\s*flex-end/);
  assert.match(assistantStyles, /\.feature-list\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column/);
  assert.match(assistantStyles, /\.feature-row\s*\{[^}]*margin-bottom:\s*22rpx;[^}]*padding:\s*6rpx 18rpx;[^}]*border-radius:\s*999rpx/);
  assert.match(assistantStyles, /\.feature-chat-text\s*\{[^}]*line-height:\s*1\.4;[^}]*white-space:\s*nowrap/);
  assert.match(assistantStyles, /\.chat-scroll\s*\{[^}]*padding-bottom:\s*2rpx/);
  assert.match(assistantStyles, /\.welcome\s*\{[^}]*padding:\s*100rpx 0 0/);
  assert.match(assistantStyles, /\.composer-dock\s*\{[^}]*padding:\s*12rpx 30rpx/);
  assert.match(assistantStyles, /\.composer-dock\s*\{[^}]*background:\s*#fff/);
  assert.match(assistantStyles, /\.feature-row:active\s*\{[^}]*transform:\s*scale\(\.98\)/);
  assert.match(assistantStyles, /\.composer\s*\{[^}]*border-radius:\s*999rpx/);
  assert.match(assistantStyles, /\.composer:focus-within\s*\{[^}]*box-shadow:/);
  assert.match(assistantStyles, /\.composer-tool-active \.composer-plus\s*\{[^}]*transform:\s*rotate\(45deg\)/);
  assert.match(assistantStyles, /\.voice-head\s*\{[^}]*height:\s*25rpx/);
  assert.match(assistantStyles, /\.send-button-active\s*\{[^}]*background:\s*#171717/);
  assert.match(assistantStyles, /\.modaui-page button\s*\{[^}]*-webkit-tap-highlight-color:\s*transparent/);
  assert.match(assistantStyles, /\.modaui-page button:active\s*\{[^}]*transform:\s*translateY\(1rpx\) scale\(\.97\)/);
  assert.match(assistantStyles, /@keyframes thinking-pulse/);
  assert.match(assistantStyles, /@keyframes drawer-enter/);
  assert.doesNotMatch(assistantStyles, /\.privacy-note/);
  assert.doesNotMatch(assistantStyles, /clip-path|feature-type-in/);
  assert.match(assistant, /class="generated-image"[^>]*mode="aspectFit"/);
  assert.match(assistantStyles, /\.generated-image\s*\{[^}]*width:\s*88%;[^}]*height:\s*440rpx/);
  assert.match(assistantStyles, /\.chat-scroll\s*,\s*\.section-scroll\s*\{[^}]*flex:\s*1/);
  assert.match(assistantStyles, /\.composer-dock\s*\{[^}]*position:\s*relative/);
  assert.match(assistantStyles, /\.feature-icon image\s*\{[^}]*width:\s*24rpx/);

  assert.match(more, /bindtap="openModule"/);
  assert.match(more, /bindtap="logout"/);
  assert.match(moreStyles, /\.module-row\s*\{[^}]*min-height:\s*112rpx/);
  assert.match(moreStyles, /\.module-item\s*\{[^}]*background:\s*linear-gradient/);
  assert.match(moreStyles, /\.module-item\.ui-row-pressed\s*\{[^}]*transform:\s*translateY\(1rpx\)/);
  assert.match(moreStyles, /\.module-icon-box\s*\{[^}]*box-shadow:/);
  assert.match(moreStyles, /\.logout-btn\s*\{[^}]*background:\s*linear-gradient/);
  assert.match(moreStyles, /\.profile-section\s*\{[^}]*background:\s*linear-gradient/);
  assert.match(moreStyles, /\.profile-section:active\s*\{[^}]*transform:\s*scale\(\.99\)/);
  assert.match(moreStyles, /\.group-header\s*\{[^}]*text-shadow:/);
  assert.match(moreStyles, /\.module-badge\s*\{[^}]*background:\s*linear-gradient/);
  assert.match(moreStyles, /\.status-notice\s*\{[^}]*box-shadow:/);
  assert.match(moreStyles, /\.status-notice\.error\s*\{[^}]*border-color:/);
  assert.match(moreStyles, /\.retry-btn\s*\{[^}]*background:\s*linear-gradient/);
  assert.match(moreStyles, /\.empty-view\s*\{[^}]*background:\s*linear-gradient/);
  assert.match(moreStyles, /\.footer-branding\s*\{[^}]*opacity:\s*\.88/);
  assert.doesNotMatch(moreStyles, /#(?:b99a5d|9b7d42)/i);
});

test('merchant mini-program icon assets are high-resolution PNGs', () => {
  const markup = [
    read('custom-tab-bar/index.wxml'),
    read('pages/dashboard/index.wxml'),
    read('pages/products/index.wxml'),
    read('pages/orders/index.wxml'),
    read('pages/assistant/index.wxml'),
    read('pages/more/index.wxml'),
  ].join('\n');
  const icons = new Set(Array.from(markup.matchAll(/\/assets\/icons\/([a-z0-9_]+)\.png/g), match => match[1]));
  for (const id of ['dashboard', 'products', 'orders', 'assistant', 'more']) {
    icons.add(`${id}_muted`);
  }
  for (const id of [
    'counterparties', 'procurement', 'finance', 'vault', 'materials', 'growth', 'production',
    'store', 'domains', 'site_content', 'ai_home', 'tryon', 'ai_employees', 'team',
    'notifications', 'settings', 'support', 'module',
  ]) {
    icons.add(id);
  }

  for (const name of icons) {
    const icon = readFileSync(path.join(root, 'merchant-miniprogram', 'assets', 'icons', `${name}.png`));
    assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${name} should be a PNG`);
    assert.equal(icon.readUInt32BE(16), 128, `${name} should be 128px wide`);
    assert.equal(icon.readUInt32BE(20), 128, `${name} should be 128px high`);
  }
});

test('merchant mini-program sources do not emit unsupported spread-runtime dependencies', () => {
  for (const page of ['assistant', 'more', 'product-form', 'business-card']) {
    const source = read(`pages/${page}/index.js`);
    assert.doesNotMatch(source, /\.\.\.\s*(?:[A-Za-z_$]|\{|\[)/, `${page} must avoid spread syntax that can require the missing SWC runtime`);
  }
});

test('merchant assistant task mode uses the protected ModaUI task API and current session', () => {
  const assistantLogic = read('pages/assistant/index.js');
  const assistant = read('pages/assistant/index.wxml');
  const api = read('utils/api.js');

  assert.match(assistantLogic, /requireMerchantSession\(this\)/);
  assert.match(assistantLogic, /\/api\/merchant\/modagpt\/task\/preview/);
  assert.match(assistantLogic, /\/api\/merchant\/modagpt\/task'/);
  assert.match(assistantLogic, /\/api\/merchant\/modagpt\/task\/\$\{encodeURIComponent\(taskId\)\}/);
  assert.match(assistantLogic, /'Idempotency-Key': this\._pendingTaskRequestKey/);
  assert.match(assistantLogic, /create_procurement_draft:/);
  assert.match(assistantLogic, /latest\.runtimeStatus/);
  assert.match(assistant, /bindtap="toggleTaskMode"/);
  assert.match(assistant, /bindtap="confirmMerchantTask"/);
  assert.match(assistant, /bindtap="retryMerchantTaskStatus"/);
  assert.match(api, /headers\.Authorization = `Bearer \$\{session\.token\}`/);
  assert.match(api, /X-Ruda-Client/);
  assert.doesNotMatch(assistantLogic, /\/api\/modagpt\/public\/chat/);
});
