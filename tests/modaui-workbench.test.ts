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

test('workbench intent detection covers the six Apparel capabilities without claiming unavailable engines', () => {
  assert.equal(detectWorkbenchCapability('设计一件双面羊绒大衣'), 'design');
  assert.equal(detectWorkbenchCapability('把这件大衣试穿到模特身上'), 'tryon');
  assert.equal(detectWorkbenchCapability('改成驼色，保留版型和纽扣'), 'recolor');
  assert.equal(detectWorkbenchCapability('做高级品牌电商主图'), 'studio');
  assert.equal(detectWorkbenchCapability('给这个造型做一段走秀视频'), 'video');
  assert.equal(detectWorkbenchCapability('识别结构并生成纸样、放码和 DXF'), 'pattern');
  assert.equal(detectWorkbenchCapability(''), 'design');
});

test('all generated concept images are labelled as AI-created and not real product photos', () => {
  const merchantAiHome = read('src/apps/merchant-admin-common/components/merchant/MerchantAiHome.tsx');
  const miniprogramAssistant = read('merchant-miniprogram/pages/assistant/index.js');

  assert.match(merchantAiHome, /AI 创作概念图/);
  assert.match(merchantAiHome, /非实物实拍/);
  assert.match(miniprogramAssistant, /AI 创作概念图/);
  assert.match(miniprogramAssistant, /非实物实拍/);
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

test('combined recolor and studio request runs recolor and image-edit steps', () => {
  const result = plan({
    text: '把这件大衣换成驼色，做高级品牌电商主图',
    assets: { garment: 'data:image/webp;base64,AAAA' }
  });

  assert.equal(result.capability, 'recolor');
  assert.deepEqual(result.steps.map(step => step.capability), ['recolor', 'studio']);
  assert.equal(result.steps[0].status, 'ready');
  assert.equal(result.steps[1].status, 'ready');
  assert.equal(result.steps[1].execution, 'server_image_edit');
  assert.equal(result.blocked, null, '第一步可执行时不得整体阻塞');
  assert.equal(result.notice, null, '图生图步骤已接通时不应误报未接入');
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

test('studio requests that reference a product photo use the fal image-edit path', () => {
  const withPhoto = plan({
    text: '把这张商品图做成品牌主图',
    assets: { garment: 'data:image/webp;base64,AAAA' }
  });
  assert.equal(withPhoto.capability, 'studio');
  assert.equal(withPhoto.blocked, null);
  assert.equal(withPhoto.steps[0].status, 'ready');
  assert.equal(withPhoto.steps[0].execution, 'server_image_edit');
  assert.match(withPhoto.notice!.zh, /发送至 fal\.ai/);

  const textOnly = plan({ text: '做一个米色大衣的高级电商主图' });
  assert.equal(textOnly.capability, 'studio');
  assert.equal(textOnly.blocked, null);
  assert.equal(textOnly.steps[0].status, 'ready');
  assert.equal(textOnly.steps[0].execution, 'server_image_generation');
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
  assert.deepEqual(resolveWorkbenchAvailability('pattern', entitled), { available: false, reason: 'not_integrated' });
  assert.equal(plan({ text: '生成纸样并放码', capability: null }).blocked, 'not_integrated');
  assert.match(plan({ text: '生成纸样并放码', capability: null }).notice?.zh ?? '', /不会创建打版任务或生成生产文件/);
});

test('workbench exposes exactly the six requested creative capabilities and removes the card landing page', () => {
  assert.deepEqual(
    WORKBENCH_CAPABILITIES.map(item => item.id),
    ['tryon', 'design', 'studio', 'recolor', 'video', 'pattern']
  );
  assert.deepEqual(
    WORKBENCH_CAPABILITIES.map(item => item.labelZh),
    ['真人 AI 虚拟试衣', 'AI 服装设计', 'AI 模特棚拍', '高清精调色', 'AI 走秀视频', 'AI 专业智能打版']
  );

  const portal = read('src/apps/merchant-admin-web/MerchantPortal.tsx');
  const entry = read('src/apps/merchant-admin-common/components/merchant/ModaUIEntry.tsx');
  assert.match(portal, /activeTab === 'modagpt' \|\| activeTab === 'fashion_studio'/);
  assert.match(portal, /<ModaUIEntry/);
  assert.match(entry, /<ModaUIWorkbench/, '服装行业继续进入原工作台');
  assert.match(entry, /<MerchantAiHome/, '非服装行业复用现有聊天工作区');
  assert.match(entry, /shouldUseModaUIIndustryChat/, '按服务端提供的行业模板决定工作区');
  assert.doesNotMatch(portal, /setFashionStudioInitialMode\(mode\)/, '旧的四卡片落地页必须删除');
  assert.match(read('src/apps/merchant-admin-common/components/merchant/modaui/ModaUIWorkbench.tsx'), /pattern:\s*Ruler/);
});

test('saved Apparel AI results can only enter Product Center through a confirmed draft', () => {
  const workbench = read('src/apps/merchant-admin-common/components/merchant/modaui/ModaUIWorkbench.tsx');

  assert.match(workbench, /result\.savedDesignId[\s\S]*?openProductDraft\(result\)/);
  assert.match(workbench, /uploadMerchantMedia\(imageBlob,\s*imageBlob\.type\)/);
  assert.match(workbench, /\/api\/merchant\/products/);
  assert.match(workbench, /lifecycleStatus:\s*'draft'/);
  assert.match(workbench, /creationRequestKey:\s*requestKey/);
  assert.match(workbench, /'Idempotency-Key':\s*requestKey/);
  assert.match(workbench, /replaceMerchantProductsFromServer\(merchantId/);
  assert.match(workbench, /图片已加入商品主图；请检查商品资料后再确认发布/);
  assert.doesNotMatch(workbench, /lifecycleStatus:\s*'published'/);
});

test('Apparel and Leather use the shared project API and expose it only to authorized templates', () => {
  const entry = read('src/apps/merchant-admin-common/components/merchant/ModaUIEntry.tsx');
  const merchantAiHome = read('src/apps/merchant-admin-common/components/merchant/MerchantAiHome.tsx');
  const workbench = read('src/apps/merchant-admin-common/components/merchant/modaui/ModaUIWorkbench.tsx');
  const projects = read('src/apps/merchant-admin-common/components/merchant/modaui/ModaUIProjects.tsx');
  const miniLogic = read('merchant-miniprogram/pages/assistant/index.js');
  const miniMarkup = read('merchant-miniprogram/pages/assistant/index.wxml');

  assert.match(entry, /industryTemplateId=\{industryTemplate\.id\}/);
  assert.match(workbench, /industryTemplateId === 'apparel_production_wholesale' \|\| industryTemplateId === 'apparel_wholesale'/);
  assert.match(workbench, /<ModaUIProjects[\s\S]*?onOpenProject=/);
  assert.match(projects, /\/api\/merchant\/studio-projects/);
  assert.match(projects, /query\.set\('industryTemplate', industryTemplateId\)/);
  assert.match(projects, /\.\.\.\(industryTemplateId \? \{ industryTemplate: industryTemplateId \} : \{\}\)/);
  assert.match(projects, /industryTemplate=\$\{encodeURIComponent\(industryTemplateId\)\}/);
  assert.match(projects, /expectedRevision:\s*selectedProject\.revision/);
  assert.match(projects, /'Idempotency-Key':\s*pendingCreateRef\.current\.key/);
  assert.match(projects, /status === 409/);
  assert.match(projects, /studio-files\/\$\{encodeURIComponent\(initialized\.file\.id\)\}\/complete/);
  assert.match(projects, /new URLSearchParams\(\{ limit: '50' \}\)/);
  assert.match(projects, /query\.set\('cursor', cursor\)/);
  assert.match(projects, /loadProjectJobs\(selectedProject\.id, jobsNextCursor, true\)/);
  assert.match(projects, /loadProjectFiles\(selectedProject\.id, filesNextCursor, true\)/);
  assert.match(projects, /fileIds:\s*linkedFileIds/);
  assert.match(projects, /industryTemplateId === 'bags_wholesale'/);
  assert.match(projects, /onOpenProject\?:\s*\(brief: string, capability: string \| null, projectId: string\)/);
  assert.match(projects, /if \(isLeatherStudio\) return;\s*void loadDesigns\(\)/);
  assert.match(projects, /\{!isLeatherStudio && <div className="mt-5">/);
  assert.match(merchantAiHome, /industryTemplateId === 'bags_wholesale'/);
  assert.match(merchantAiHome, /<ModaUIProjects[\s\S]*?industryTemplateId=\{industryTemplateId\}/);
  assert.doesNotMatch(merchantAiHome, /activeStudioProjectIdRef/);
  assert.match(projects, /皮具专属 AI 执行入口尚未接通/);

  assert.match(miniLogic, /apparelStudioEnabled:\s*apparelTemplateIds\.has\(templateId\)/);
  assert.match(miniLogic, /\/api\/merchant\/studio-projects/);
  assert.match(miniLogic, /industryTemplate=\$\{encodeURIComponent\(templateId\)\}/);
  assert.match(miniLogic, /data: \{ title, payload, industryTemplate: this\._industryTemplateId \}/);
  assert.match(miniLogic, /industryTemplate: this\._industryTemplateId/);
  assert.match(miniLogic, /expectedRevision:\s*this\.data\.studioProjectRevision/);
  assert.match(miniLogic, /studio-files\/\$\{encodeURIComponent\(initialized\.file\.id\)\}\/complete/);
  assert.match(miniLogic, /studio-projects\/\$\{encodeURIComponent\(projectId\)\}\/jobs/);
  assert.match(miniLogic, /async loadMoreStudioProjectFiles\(\)/);
  assert.match(miniLogic, /async loadMoreStudioProjectJobs\(\)/);
  assert.match(miniLogic, /studioProjectFilesNextCursor:\s*result\.nextCursor \|\| null/);
  assert.match(miniLogic, /studioProjectJobsNextCursor:\s*result\.nextCursor \|\| null/);
  assert.match(miniLogic, /fileIds:\s*Array\.isArray\(this\.data\.studioProjectLinkedFileIds\)/);
  assert.match(miniLogic, /projectId:\s*this\.data\.studioProjectChatProjectId \|\| undefined/);
  assert.match(read('merchant-miniprogram/utils/studio-files.js'), /method: 'PUT'/);
  assert.match(workbench, /inputs,\s*\.\.\.\(activeProjectId \? \{ projectId: activeProjectId \} : \{\}\)/);
  assert.match(miniLogic, /merchantChanged[\s\S]*?studioProjectPayload:\s*null/);
  assert.match(miniMarkup, /wx:if="\{\{studioProjectsEnabled\}\}" class="menu-row" data-section="projects"/);
  assert.match(miniLogic, /studioProjectsEnabled:\s*apparelTemplateIds\.has\(templateId\) \|\| templateId === 'bags_wholesale'/);
  assert.match(miniLogic, /if \(!this\.data\.leatherStudioEnabled\) void this\.loadStudioProjectDesignOptions\(\)/);
  assert.ok((miniLogic.match(/studioProjectDesignOptions: \[\]/g) || []).length >= 3, 'design options must be cleared on access failure, industry change and merchant change');
  assert.match(miniLogic, /const title = this\.data\.leatherStudioEnabled \? '未命名皮具项目' : '未命名服装项目'/);
  assert.match(miniMarkup, /class="project-file-section"/);
  assert.match(miniMarkup, /bindtap="refreshStudioProjectJobs"/);
  assert.match(miniMarkup, /bindtap="loadMoreStudioProjectFiles"/);
  assert.match(miniMarkup, /bindtap="loadMoreStudioProjectJobs"/);
  assert.match(miniMarkup, /wx:if="\{\{!leatherStudioEnabled\}\}" class="project-secondary-button" bindtap="openStudioBriefInChat"/);
  assert.match(miniMarkup, /wx:if="\{\{!leatherStudioEnabled\}\}" class="project-field"/);
});

test('workbench only executes real endpoints and never fabricates progress', () => {
  const workbench = read('src/apps/merchant-admin-common/components/merchant/modaui/ModaUIWorkbench.tsx');

  assert.match(workbench, /requestModaGptImage\(/);
  assert.match(workbench, /task: 'imageGeneration'/);
  assert.match(workbench, /task: 'imageEdit'/);
  assert.match(workbench, /referenceImage/);
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

test('industry AI business tasks reuse authenticated merchant APIs with explicit procurement inputs', () => {
  const industryChat = read('src/apps/merchant-admin-common/components/merchant/MerchantAiHome.tsx');
  const errorCopy = read('src/apps/merchant-admin-common/components/merchant/modaui/modauiIndustryChat.ts');

  assert.match(industryChat, /\/api\/merchant\/modagpt\/task\/preview/);
  assert.match(industryChat, /\/api\/merchant\/modagpt\/task'/);
  assert.match(industryChat, /\/api\/merchant\/modagpt\/task\/\$\{encodeURIComponent\(taskId\)\}/);
  assert.match(industryChat, /'Idempotency-Key': idempotencyKey/);
  assert.match(industryChat, /create_procurement_draft:/);
  assert.match(industryChat, /\/api\/merchant\/products/);
  assert.match(industryChat, /taskDraft\.unitCost\.trim\(\)/);
  assert.match(industryChat, /任务仍在处理中，任务编号/);
  assert.match(errorCopy, /MODAGPT_TASK_PERMISSION_REQUIRED/);
  assert.match(errorCopy, /当前账号没有执行此任务的权限，任务未执行/);
  assert.doesNotMatch(errorCopy, /当前员工没有采购管理权限/, '权限错误文案不误称所有任务都是采购');
});
