/**
 * 审核凭证判定规则 —— 真实行为测试。
 *
 * 核心命题：缺凭证 = 未审核。数据库里 `reviewStatus: 'approved'` 本身不构成任何授权，
 * 必须同时具备「真实管理员 ID + 有效时间 + decision=approved」的凭证。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidModelReviewCredential,
  isModelPubliclyVisible,
  stripUnapprovedModels
} from '../src/shared/modelReviewCredential.ts';

const REVIEWER_ID = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const NOW = Date.parse('2026-11-01T00:00:00.000Z');
const credential = (overrides: Record<string, unknown> = {}) => ({
  reviewerId: REVIEWER_ID,
  reviewerUsername: 'qa-reviewer',
  reviewedAt: '2026-10-31T23:00:00.000Z',
  decision: 'approved',
  ...overrides
});
const modelItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'model-1',
  type: 'model',
  url: '/models/x.glb',
  reviewStatus: 'approved',
  modelReview: credential(),
  ...overrides
});

test('完整合法的凭证通过', () => {
  assert.equal(isValidModelReviewCredential(credential(), NOW), true);
});

test('缺少凭证 → 不通过（旧脚本写入的 approved 一律按未审核）', () => {
  assert.equal(isValidModelReviewCredential(undefined, NOW), false);
  assert.equal(isValidModelReviewCredential(null, NOW), false);
});

test('凭证缺 reviewerId → 不通过', () => {
  assert.equal(isValidModelReviewCredential(credential({ reviewerId: undefined }), NOW), false);
  assert.equal(isValidModelReviewCredential(credential({ reviewerId: '' }), NOW), false);
});

test('reviewerId 用用户名冒充（非 uuid）→ 不通过', () => {
  assert.equal(isValidModelReviewCredential(credential({ reviewerId: 'qa-reviewer' }), NOW), false);
  assert.equal(isValidModelReviewCredential(credential({ reviewerId: 'admin' }), NOW), false);
});

test('decision 不是 approved → 不通过', () => {
  assert.equal(isValidModelReviewCredential(credential({ decision: 'rejected' }), NOW), false);
  assert.equal(isValidModelReviewCredential(credential({ decision: 'pending' }), NOW), false);
  assert.equal(isValidModelReviewCredential(credential({ decision: undefined }), NOW), false);
});

test('reviewedAt 无效或格式错误 → 不通过', () => {
  assert.equal(isValidModelReviewCredential(credential({ reviewedAt: 'not-a-date' }), NOW), false);
  assert.equal(isValidModelReviewCredential(credential({ reviewedAt: '' }), NOW), false);
  assert.equal(isValidModelReviewCredential(credential({ reviewedAt: 12345 }), NOW), false);
});

test('reviewedAt 在未来（超过时钟偏差）→ 不通过', () => {
  assert.equal(isValidModelReviewCredential(credential({ reviewedAt: '2027-01-01T00:00:00.000Z' }), NOW), false);
});

test('凭证不是对象（字符串/数组）→ 不通过', () => {
  assert.equal(isValidModelReviewCredential('approved', NOW), false);
  assert.equal(isValidModelReviewCredential(['approved'], NOW), false);
});

test('合法凭证 + approved + model 才算公开可见', () => {
  assert.equal(isModelPubliclyVisible(modelItem(), NOW), true);
});

test('旧数据：approved 但没有 modelReview → 买家不可见', () => {
  assert.equal(isModelPubliclyVisible(modelItem({ modelReview: undefined }), NOW), false);
});

test('reviewStatus 不是 approved → 不可见（即使凭证完整）', () => {
  assert.equal(isModelPubliclyVisible(modelItem({ reviewStatus: 'pending' }), NOW), false);
});

test('图片条目永远不受模型凭证规则影响', () => {
  const media = [
    { id: 'img-1', type: 'image', url: '/a.jpg', reviewStatus: 'approved' },
    modelItem({ modelReview: undefined })
  ];
  const filtered = stripUnapprovedModels(media, NOW) as Array<{ id: string }>;
  assert.deepEqual(filtered.map(item => item.id), ['img-1']);
});

test('strip 只剔除不可公开的模型，保留合法模型与图片', () => {
  const media = [
    { id: 'img-1', type: 'image', url: '/a.jpg' },
    modelItem({ id: 'model-legit' }),
    modelItem({ id: 'model-legacy', modelReview: undefined }),
    { id: 'video-1', type: 'video', url: '/v.mp4' }
  ];
  const filtered = stripUnapprovedModels(media, NOW) as Array<{ id: string }>;
  assert.deepEqual(filtered.map(item => item.id), ['img-1', 'model-legit', 'video-1']);
});
