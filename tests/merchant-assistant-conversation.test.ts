import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  assistantReplyFrameInterval,
  buildAssistantReplyFrames,
  splitAssistantReplySegments
} from '../src/shared/assistantReplyReveal';
import {
  merchantOperationsAssistantInstruction,
  merchantOperationsConversationRules
} from '../src/server/merchantSupportAi';

const root = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

const portal = read('src/apps/merchant-admin-web/MerchantPortal.tsx');
const aiHome = read('src/apps/merchant-admin-common/components/merchant/MerchantAiHome.tsx');
const actions = read('src/apps/merchant-admin-common/components/merchant/AssistantReplyActions.tsx');
const miniWxml = read('merchant-miniprogram/pages/assistant/index.wxml');
const miniPage = read('merchant-miniprogram/pages/assistant/index.js');
const server = read('server.ts');

test('回复分段只切位置，拼接后与真实回复完全一致', () => {
  const reply = '近 30 天成交 12 单，GMV €4,820。库存里黑色 M 码只剩 3 件，建议今天补货。\n\n需要我按销量给出补货数量吗？';
  const segments = splitAssistantReplySegments(reply);
  assert.ok(segments.length > 1, '长句必须分段呈现');
  assert.equal(segments.join(''), reply, '分段不得改写、增删或重排原文');
  assert.ok(segments.every(segment => segment.length > 0), '不产生空片段');
  assert.ok(segments[0].endsWith('。'), '优先在句末标点后断开');
});

 test('超长句按自然长度切分，帧偏移始终前进且不跳字', () => {
  const longSentence = `这一季的连衣裙在门店和线上都卖得比预期快，${'尤其是黑色和米白色两个色系，'.repeat(12)}建议先把补货单做出来。`;
  const segments = splitAssistantReplySegments(longSentence);
  assert.ok(segments.length > 1, '超长句必须切分');
  assert.equal(segments.join(''), longSentence);
  assert.ok(segments.every(segment => segment.length <= 43), '单段不超过合理长度');
  const frames = buildAssistantReplyFrames(longSentence);
  let previous = 0;
  for (const frame of frames) {
    assert.ok(frame.end > previous, '每帧必须前进');
    assert.equal(frame.delta, frame.end - previous);
    previous = frame.end;
  }
  assert.equal(frames[frames.length - 1].end, longSentence.length);
  assert.equal(assistantReplyFrameInterval(longSentence) < 34, true, '长回复整体加快，减少等待');
});

 test('空回复不会产生动画帧', () => {
  assert.deepEqual(splitAssistantReplySegments(''), []);
  assert.deepEqual(buildAssistantReplyFrames(''), []);
});

 test('经营助理提示词要求自然短回复，并禁止输出系统说明', () => {
  const rules = merchantOperationsConversationRules;
  assert.match(rules, /1–3 句/);
  assert.match(rules, /先说结论/);
  assert.match(rules, /不要默认加标题/);
  assert.match(rules, /不要附加数据来源清单/);
  assert.match(rules, /数字、时间范围、状态、风险和失败原因不能为了简短而省略/);
  assert.match(merchantOperationsAssistantInstruction, /默认短回复/);
  assert.match(merchantOperationsAssistantInstruction, /1–3 句/);
  assert.doesNotMatch(merchantOperationsAssistantInstruction, /数据依据/);
});

 test('电脑端聊天不再展示系统说明，操作行收敛为共享组件', () => {
  assert.doesNotMatch(portal, /数据依据：/);
  assert.doesNotMatch(portal, /按钮仅打开页面/);
  assert.doesNotMatch(portal, /重新生成/);
  assert.doesNotMatch(portal, /执行任务/);
  assert.match(portal, /<AssistantReplyActions/);
  assert.match(portal, /messageId: string;/);
  assert.match(portal, /assistant\/query/);
  assert.match(portal, /revealAssistantAnswer\(result\.messageId, reply/);
});

 test('手机网页端使用同一操作组件与同一分段规则', () => {
  assert.doesNotMatch(aiHome, /dataBasis/);
  assert.doesNotMatch(aiHome, /重新生成/);
  assert.match(aiHome, /<AssistantReplyActions/);
  assert.match(aiHome, /buildAssistantReplyFrames/);
  assert.match(aiHome, /localizeCopy\('任务模式'/);
});

 test('共享操作组件：复制反馈短暂、删除走真实接口并只移除目标消息', () => {
  assert.ok(actions.includes('apiDelete<{ success: true; messageId: string }>('), '删除必须等待真实接口结果');
  assert.ok(actions.includes('/api/merchant/assistant/messages/'), '删除走消息级接口');
  assert.ok(actions.includes('ASSISTANT_MESSAGE_NOT_FOUND'), '服务端已删除时界面与真实状态一致');
  assert.ok(actions.includes('1600'), '复制反馈短暂显示');
  assert.ok(actions.includes('window.confirm'), '删除前按现有确认习惯确认');
  assert.ok(actions.includes('navigator.share'), '仅在支持时提供分享');
});

test('服务端提供单条 AI 回复删除接口，按商家与操作者隔离', () => {
  const route = server.slice(server.indexOf("app.delete('/api/merchant/assistant/messages/:id'"));
  assert.ok(route.length > 0, '缺少消息删除路由');
  const body = route.slice(0, 1600);
  assert.match(body, /requireMerchantTenant/);
  assert.match(body, /conversation: \{ merchantId, actorId \}/);
  assert.match(body, /role: 'assistant'/);
  assert.match(body, /modaGptBrainFeedback\.deleteMany/);
  assert.match(body, /ASSISTANT_MESSAGE_NOT_FOUND/);
});

 test('小程序对话同样是复制与删除两个图标，且不再展示数据依据', () => {
  assert.match(miniWxml, /class="reply-actions"/);
  assert.match(miniWxml, /bindtap="copyReply"/);
  assert.match(miniWxml, /bindtap="deleteReply"/);
  assert.doesNotMatch(miniWxml, /data-basis|feedback-actions/);
  assert.match(miniPage, /wx\.setClipboardData/);
  assert.ok(miniPage.includes('/api/merchant/assistant/messages/'), '小程序删除走同一接口');
  assert.ok(miniPage.includes("method: 'DELETE'"), '小程序删除使用 DELETE');
  assert.match(miniPage, /wx\.showModal/);
});
