import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { scanWxmlSource } from '../scripts/check-wxml-directives.mjs';

/**
 * P1 广告策划：三端界面契约的机械检查。
 *
 * 只断言能被证伪的事实（接口、持久化路径、禁用态文案、小程序页面注册），
 * 不冒充视觉验收；真实页面仍需桌面/手机/小程序实机确认。
 */

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const planner = read('src/apps/merchant-admin-common/components/merchant/ModaUiAdPlanner.tsx');

test('shared planner talks only to the real MODAUI ad endpoints', () => {
  for (const endpoint of [
    '/api/merchant/products',
    '/api/merchant/ai-tools',
    '/api/merchant/ai-ad/products/',
    '/api/merchant/ai-ad/concepts',
    '/api/merchant/ai-ad/projects'
  ]) {
    assert.ok(planner.includes(endpoint), `缺少真实接口 ${endpoint}`);
  }
  // 项目与版本必须走服务端，不允许本地缓存冒充数据库。
  assert.equal(/localStorage\.(?:set|get)Item|sessionStorage\.(?:set|get)Item/.test(planner), false);
  assert.ok(planner.includes('apiPatch'), '保存分镜必须调用服务端 PATCH');
});

test('generation entry is rendered disabled with an honest label', () => {
  assert.ok(planner.includes('开始生成视频（暂未接通）'));
  const disabledBlock = planner.slice(
    planner.indexOf('aria-describedby="modaui-ad-generation-unavailable"') - 200,
    planner.indexOf('aria-describedby="modaui-ad-generation-unavailable"')
  );
  assert.ok(/disabled/.test(disabledBlock), '未接通的生成按钮必须禁用而不是可点击');
  assert.equal(/onClick=\{\(\)\s*=>\s*\{?\s*void\s*generateVideo/.test(planner), false);
});

test('missing product data is surfaced instead of defaulted', () => {
  assert.ok(planner.includes('brief.missing'));
  for (const field of ['price', 'images', 'skus', 'colors', 'material', 'description', 'sellingPoints']) {
    assert.ok(planner.includes(field), `缺失资料标签漏了 ${field}`);
  }
  assert.ok(planner.includes('未配置价格'));
});

test('desktop and mobile web mount the same shared planner', () => {
  const web = read('src/apps/merchant-admin-web/MerchantPortal.tsx');
  assert.ok(web.includes("import { ModaUiAdPlanner }"));
  assert.ok(web.includes("{activeTab === 'ad_planner'"));
  assert.ok(web.includes('<ModaUiAdPlanner />'));
  assert.ok(web.includes('merchant-tab-ad-planner'));

  const mobile = read('src/apps/merchant-admin-mobile/MerchantMobileApp.tsx');
  assert.ok(mobile.includes('<ModaUiAdPlanner compact />'));
  assert.ok(mobile.includes("case 'ad_planner':"));
});

test('merchant miniprogram registers the page and mirrors the same contract', () => {
  const appJson = JSON.parse(read('merchant-miniprogram/app.json'));
  assert.ok(appJson.pages.includes('pages/ad-planner/index'));

  const page = read('merchant-miniprogram/pages/ad-planner/index.js');
  for (const endpoint of [
    '/api/merchant/products',
    '/api/merchant/ai-tools',
    '/api/merchant/ai-ad/concepts',
    '/api/merchant/ai-ad/projects'
  ]) {
    assert.ok(page.includes(endpoint), `小程序缺少接口 ${endpoint}`);
  }
  assert.ok(page.includes('persistShots'), '分镜保存必须落到服务端');
  // 小程序不得用本地存储假装保存项目或版本。
  assert.equal(/wx\.setStorageSync/.test(page), false);

  const wxml = read('merchant-miniprogram/pages/ad-planner/index.wxml');
  assert.ok(wxml.includes('开始生成视频（暂未接通）'));
  assert.equal(scanWxmlSource(wxml, 'ad-planner/index.wxml').length, 0);
});

test('P1 UI contract is documented before implementation', () => {
  const doc = read('docs/engineering/modules/modaui-ai-advertising.md');
  assert.ok(doc.includes('## 23. P1 商家端四屏'));
  for (const section of ['第 1 屏', '第 2 屏', '第 3 屏', '第 4 屏']) {
    assert.ok(doc.includes(section), `文档缺少${section}`);
  }
});

test('P3 merchant flow hides technical modes and exposes business choices', () => {
  const wxml = read('merchant-miniprogram/pages/ad-planner/index.wxml');
  const page = read('merchant-miniprogram/pages/ad-planner/index.js');
  // 快速/专业技术模式与「专业参数」下拉必须从商家界面彻底消失
  for (const [name, source] of [['电脑端', planner], ['小程序', page], ['小程序 WXML', wxml]] as const) {
    for (const removed of ['快速制作', '专业制作', '专业参数']) {
      assert.equal(source.includes(removed), false, `${name} 仍暴露 ${removed}`);
    }
  }
  // 商家只做商业选择：用途 + 平台
  for (const label of ['商品宣传', '数字人介绍', '促销广告', '品牌视频']) {
    assert.ok(planner.includes(label), `电脑端缺少用途 ${label}`);
    assert.ok(page.includes(label), `小程序缺少用途 ${label}`);
  }
  for (const label of ['抖音', '小红书', '官网 / 独立站', '电商主图视频']) {
    assert.ok(planner.includes(label), `电脑端缺少平台 ${label}`);
    assert.ok(page.includes(label), `小程序缺少平台 ${label}`);
  }
  // 小程序按 data 渲染，必须绑定同一份用途/平台数据
  assert.ok(wxml.includes('{{purposeOptions}}'), '小程序用途必须由 data 渲染');
  assert.ok(wxml.includes('{{platformOptions}}'), '小程序平台必须由 data 渲染');
  // 数字人未接通：电脑端禁用，小程序标注未接通
  assert.ok(/id: 'creator_ugc'[\s\S]{0,200}ready: false/.test(planner), '电脑端必须把数字人用途标记为未接通');
  assert.ok(/creator_ugc[\s\S]{0,120}ready: false/.test(page), '小程序必须把数字人用途标记为未接通');
  assert.ok(wxml.includes('chip-disabled'), '小程序未接通用途必须有禁用样式');
  assert.ok(wxml.includes('平台发布尚未接通'), '必须写明发布能力未接通');

  // 两端都必须调用同一个镜头修改接口，不得另起一套本地「重写」逻辑。
  for (const source of [planner, page]) {
    assert.ok(source.includes('/shots/'), '缺少真实镜头修改端点');
    assert.ok(source.includes('/edit'), '缺少镜头修改动作');
  }
  // 预设 id 必须与 server/modauiAdShotEdit 一致
  for (const preset of ['premium', 'product_clarity', 'background', 'natural_person', 'faster', 'redesign']) {
    assert.ok(planner.includes(`'${preset}'`), `电脑端缺少预设 ${preset}`);
    assert.ok(page.includes(`'${preset}'`), `小程序缺少预设 ${preset}`);
  }
});

test('P3 technical shot fields are opt-in, not default', () => {
  const wxml = read('merchant-miniprogram/pages/ad-planner/index.wxml');
  assert.ok(wxml.includes('专业精修（可选）'), '小程序专业层必须标明可选');
  assert.ok(wxml.includes('wx:if="{{shotProOpen}}"'), '小程序技术字段必须默认折叠');
  assert.equal(wxml.includes("mode === 'professional'"), false, '小程序不得保留模式判断');
  assert.ok(planner.includes('专业精修（可选）'), '电脑端专业层必须标明可选');
  assert.ok(planner.includes("useState<EditorLayer>('simple')"), '电脑端必须默认进入简单层');
  const page = read('merchant-miniprogram/pages/ad-planner/index.js');
  assert.ok(page.includes('shotProOpen: false'), '小程序专业层必须默认关闭');
  assert.equal(/setMode|onParamPick/.test(page), false, '小程序不得保留模式或参数下拉处理器');
});

test('P2 generation-required edits stay honest on all three ends', () => {
  assert.ok(planner.includes('requiresGeneration'));
  const page = read('merchant-miniprogram/pages/ad-planner/index.js');
  assert.ok(page.includes('requiresGeneration'));
  const wxml = read('merchant-miniprogram/pages/ad-planner/index.wxml');
  assert.ok(wxml.includes('需要真实画面生成后才能看到效果'));
  // 重新生成画面仍未接通，按钮必须禁用
  assert.ok(wxml.includes('重新生成画面（暂未接通）'));
  assert.ok(/<button class="btn btn-disabled" disabled="true">重新生成画面/.test(wxml));
});

test('P2 storyboard edits autosave to the server on web and miniprogram', () => {
  // 1500ms 防抖，内容哈希/签名相同不重复落库
  assert.ok(planner.includes('1500'), '电脑端自动保存缺少防抖间隔');
  const page = read('merchant-miniprogram/pages/ad-planner/index.js');
  assert.ok(page.includes('1500'), '小程序自动保存缺少防抖间隔');
  assert.ok(page.includes('method: ' + "'PATCH'"), '小程序保存分镜必须走 PATCH');
  assert.ok(page.includes('lastSavedSignature'), '小程序自动保存必须做内容比对');
  for (const source of [planner, page]) {
    assert.equal(/wx\.setStorageSync|localStorage\.setItem/.test(source), false, '不得用本地存储冒充保存');
  }
});

test('P2 ad studio contract is documented before implementation', () => {
  const doc = read('docs/engineering/modules/modaui-ai-advertising.md');
  assert.ok(doc.includes('## 24. P2 广告工作室'));
  for (const section of ['快速模式', '专业模式', '自然语言']) {
    assert.ok(doc.includes(section), `文档缺少${section}说明`);
  }
  const matrix = read('docs/engineering/modules/merchant-three-end-matrix.md');
  assert.ok(matrix.includes('广告'), '三端矩阵缺少广告模块行');
});

test('P3 ad studio contract is documented before implementation', () => {
  const doc = read('docs/engineering/modules/modaui-ai-advertising.md');
  assert.ok(doc.includes('## 25. P3 商家端收敛'));
  for (const section of ['25.2 商家可见操作', '25.3 用途与平台映射', '25.4 复杂度归属']) {
    assert.ok(doc.includes(section), `文档缺少${section}`);
  }
  const matrix = read('docs/engineering/modules/merchant-three-end-matrix.md');
  assert.ok(matrix.includes('广告'), '三端矩阵缺少广告模块行');
});
