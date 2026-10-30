import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  detectWorkbenchCapability,
  extractWorkbenchColor,
  extractWorkbenchConstraints,
  planModaWorkbenchTask,
  type WorkbenchPlanInput
} from '../src/apps/merchant-admin-common/components/merchant/modaui/modaWorkbenchPlan';
import {
  WORKBENCH_CAPABILITIES,
  resolveWorkbenchAvailability,
  type WorkbenchEntitlementSnapshot
} from '../src/apps/merchant-admin-common/components/merchant/modaui/modaWorkbenchCapabilities';

const root = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

const entitled: WorkbenchEntitlementSnapshot = {
  plan: 'pro',
  imageGeneration: true,
  tryOn: true,
  imageProvider: 'fal'
};

const plan = (input: Partial<WorkbenchPlanInput>) => planModaWorkbenchTask({
  text: '',
  capability: null,
  assets: {},
  entitlements: entitled,
  ...input
});

test('workbench intent detection stays on the five real capabilities', () => {
  assert.equal(detectWorkbenchCapability('设计一件双面羊绒大衣'), 'design');
  assert.equal(detectWorkbenchCapability('把这件大衣试穿到模特身上'), 'tryon');
  assert.equal(detectWorkbenchCapability('改成驼色，保留版型和纽扣'), 'recolor');
  assert.equal(detectWorkbenchCapability('做高级品牌电商主图'), 'studio');
  assert.equal(detectWorkbenchCapability('给这个造型做一段走秀视频'), 'video');
  assert.equal(detectWorkbenchCapability(''), 'design');
});

test('workbench reads target colour and keeps explicit硬约束', () => {
  assert.equal(extractWorkbenchColor('把这件大衣改成驼色，保留原版型和纽扣'), '驼色');
  assert.equal(extractWorkbenchColor('change the colour to camel'), 'camel');
  assert.equal(extractWorkbenchColor('做一个高级主图'), null);

  const constraints = extractWorkbenchConstraints('改成驼色，保留原版型，不要改纽扣', 'recolor');
  assert.ok(constraints.includes('保留原版型'));
  assert.ok(constraints.includes('不要改纽扣'));
  assert.ok(constraints.includes('保留纹理与褶皱'), '换色默认硬约束必须始终带上纹理');
});

test('combined recolor and studio request runs recolor and exposes the未接入 studio step', () => {
  const result = plan({
    text: '把这件大衣换成驼色，做高级品牌电商主图',
    assets: { garment: 'data:image/webp;base64,AAAA' }
  });

  assert.equal(result.capability, 'recolor');
  assert.deepEqual(result.steps.map(step => step.capability), ['recolor', 'studio']);
  assert.equal(result.steps[0].status, 'ready');
  assert.equal(result.steps[1].status, 'blocked');
  assert.equal(result.steps[1].reason, 'not_integrated');
  assert.equal(result.blocked, null, '第一步可执行时不得整体阻塞');
  assert.ok(result.notice, '必须如实说明后续棚拍步骤未接入');
  assert.match(result.notice!.zh, /图生图/);
});

test('video requests never create a runnable step', () => {
  const result = plan({ text: '把这个造型做成走秀视频' });

  assert.equal(result.capability, 'video');
  assert.equal(result.blocked, 'not_integrated');
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].status, 'blocked');
  assert.equal(result.steps[0].execution, 'unavailable');
  assert.match(result.notice!.zh, /未接入视频引擎/);
});

test('try-on asks only for the missing assets', () => {
  const empty = plan({ text: '试穿一下', capability: 'tryon' });
  assert.deepEqual(empty.missing, ['person', 'garment']);

  const halfDone = plan({ text: '试穿一下', capability: 'tryon', assets: { person: 'data:image/webp;base64,AAAA' } });
  assert.deepEqual(halfDone.missing, ['garment']);

  const ready = plan({
    text: '试穿一下',
    capability: 'tryon',
    assets: { person: 'data:image/webp;base64,AAAA', garment: 'data:image/webp;base64,BBBB' }
  });
  assert.deepEqual(ready.missing, []);
  assert.equal(ready.blocked, null);
});

test('studio requests that point at an uploaded product photo are blocked honestly', () => {
  const withPhoto = plan({
    text: '把这张商品图做成品牌主图',
    assets: { garment: 'data:image/webp;base64,AAAA' }
  });
  assert.equal(withPhoto.capability, 'studio');
  assert.equal(withPhoto.blocked, 'not_integrated');
  assert.ok(withPhoto.question, '必须让用户改用文字描述，而不是静默生成无关图片');

  const textOnly = plan({ text: '做一个米色大衣的高级电商主图' });
  assert.equal(textOnly.capability, 'studio');
  assert.equal(textOnly.blocked, null);
  assert.equal(textOnly.steps[0].status, 'ready');
});

test('design followed by try-on keeps both real steps and reports the missing person', () => {
  const result = plan({
    text: '设计一件短款风衣，然后试穿到模特身上',
    assets: { garment: 'data:image/webp;base64,AAAA' }
  });
  assert.deepEqual(result.steps.map(step => step.capability), ['design', 'tryon']);
  assert.equal(result.steps[0].status, 'ready');
  assert.deepEqual(result.missing, [], '第一步已有文字需求，不应阻塞');
  assert.deepEqual(result.laterMissing, ['person'], '第二步试穿仍缺人物照片，必须提前告知');
});

test('capability availability never assumes an engine that the server does not report', () => {
  assert.deepEqual(resolveWorkbenchAvailability('video', entitled), { available: false, reason: 'not_integrated' });
  assert.deepEqual(resolveWorkbenchAvailability('recolor', null), { available: true });
  assert.deepEqual(resolveWorkbenchAvailability('design', null), { available: false, reason: 'engine_unavailable' });
  assert.deepEqual(
    resolveWorkbenchAvailability('tryon', { ...entitled, imageProvider: 'automatic1111' }),
    { available: false, reason: 'engine_unavailable' }
  );
  assert.deepEqual(
    resolveWorkbenchAvailability('studio', { ...entitled, plan: 'plus' }),
    { available: false, reason: 'plan_required' }
  );
  assert.deepEqual(resolveWorkbenchAvailability('studio', entitled), { available: true });
});

test('workbench keeps exactly five creative entries and removes the card landing page', () => {
  assert.deepEqual(
    WORKBENCH_CAPABILITIES.map(item => item.id),
    ['design', 'tryon', 'recolor', 'studio', 'video']
  );

  const portal = read('src/apps/merchant-admin-web/MerchantPortal.tsx');
  assert.match(portal, /activeTab === 'modagpt' \|\| activeTab === 'fashion_studio'/);
  assert.match(portal, /<ModaUIWorkbench/);
  assert.doesNotMatch(portal, /setFashionStudioInitialMode\(mode\)/, '旧的四卡片落地页必须删除');
});

test('workbench only executes real endpoints and never fabricates progress', () => {
  const workbench = read('src/apps/merchant-admin-common/components/merchant/modaui/ModaUIWorkbench.tsx');

  assert.match(workbench, /requestModaGptImage\(/);
  assert.match(workbench, /task: 'imageGeneration'/);
  assert.match(workbench, /task: 'tryOn'/);
  assert.match(workbench, /privacyConsent: true/);
  assert.match(workbench, /\/api\/merchant\/modagpt\/designs/);
  assert.match(workbench, /\/api\/merchant\/modagpt\/entitlements/);
  // 图片生成是同步接口：工作台不得再轮询不存在的异步任务路由，也不得伪造恢复。
  assert.doesNotMatch(workbench, /images\/tasks\//);
  assert.doesNotMatch(workbench, /recoverModaGptImageTask/);
  assert.doesNotMatch(workbench, /Math\.random\(\)\s*\*\s*100/, '不得用随机数伪造进度');
  assert.doesNotMatch(workbench, /progress:\s*\d+\s*,/, '不得写死百分比');
  assert.match(workbench, /<ModaCoreAnchor kind="hero"/);
  assert.doesNotMatch(workbench, /digital-?life[^\n]*<img/i, 'DigitalLife 不得用静态图片替代');
});

test('workbench business tasks reuse authenticated merchant APIs with explicit procurement inputs', () => {
  const workbench = read('src/apps/merchant-admin-common/components/merchant/modaui/ModaUIWorkbench.tsx');

  assert.match(workbench, /\/api\/merchant\/modagpt\/task\/preview/);
  assert.match(workbench, /\/api\/merchant\/modagpt\/task'/);
  assert.match(workbench, /\/api\/merchant\/modagpt\/task\/\$\{encodeURIComponent\(taskId\)\}/);
  assert.match(workbench, /'Idempotency-Key': idempotencyKey/);
  assert.match(workbench, /create_procurement_draft:/);
  assert.match(workbench, /\/api\/merchant\/products/);
  assert.match(workbench, /taskDraft\.unitCost\.trim\(\)/);
  assert.match(workbench, /任务仍在处理中，任务编号/);
  assert.match(workbench, /当前员工没有采购管理权限/);
});
