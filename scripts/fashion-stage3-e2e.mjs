import 'dotenv/config';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const secret = crypto.createHmac('sha256', process.env.JWT_BUYER_SECRET || '')
  .update('ruda-fashion-account-v1')
  .digest('hex');
const base = 'http://127.0.0.1:3011';
const tokenFor = (accountId) => jwt.sign({ role: 'fashion_account', accountId }, secret, { expiresIn: '1h' });
const call = async (path, accountId, init = {}) => {
  const headers = { 'content-type': 'application/json', ...(init.headers || {}) };
  if (accountId) headers.cookie = `ruda_fashion_account_jwt=${tokenFor(accountId)}`;
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non json */ }
  return { status: response.status, json };
};
const results = [];
const check = (name, ok, detail = '') => {
  results.push([name, ok, detail]);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
};

const run = async () => {
  const suffix = Date.now().toString(36);
  const creator = await prisma.fashionAccount.create({ data: { displayName: `验收创作者${suffix}` } });
  const viewer = await prisma.fashionAccount.create({ data: { displayName: `验收观众${suffix}` } });
  const postId = `fashion-post-e2e-${suffix}`;
  await prisma.fashionCommunityPost.create({
    data: {
      id: postId,
      image: '/fashion/imgi_59_00016-prada-fall-2023-ready-to-w.jpg',
      merchantId: 'public-fashion',
      merchantName: 'RUDA Fashion Community',
      createdAt: new Date(),
      title: `阶段三验收作品 ${suffix}`,
      caption: '端到端验收内容',
      category: '女装趋势',
      mediaType: 'image',
      publicationStatus: 'approved',
      creatorAccountId: creator.id,
      hashtags: [`验收${suffix}`]
    }
  });

  try {
    const like = await call(`/api/fashion/social/${postId}/reaction`, viewer.id, { method: 'POST', body: JSON.stringify({ reaction: 'like' }) });
    check('点赞写入成功', like.status === 200 && like.json?.liked === true, `status=${like.status}`);

    const comment = await call(`/api/fashion/social/${postId}/comments`, viewer.id, { method: 'POST', body: JSON.stringify({ text: '这条作品的剪裁很好' }) });
    check('评论写入成功', comment.status === 201 && Boolean(comment.json?.comment?.id), `status=${comment.status}`);
    const commentId = comment.json?.comment?.id;

    const reply = await call(`/api/fashion/social/${postId}/comments`, creator.id, { method: 'POST', body: JSON.stringify({ text: '谢谢，面料来自意大利', parentId: commentId }) });
    check('评论回复写入成功', reply.status === 201 && reply.json?.comment?.parentId === commentId, `status=${reply.status}`);

    const follow = await call(`/api/fashion/social/${creator.id}/follow`, viewer.id, { method: 'POST', body: '{}' });
    check('关注写入成功', follow.status === 200 && follow.json?.following === true, `status=${follow.status}`);

    const followers = await call(`/api/fashion/creators/${creator.id}/followers`, viewer.id);
    check('粉丝列表包含关注者', followers.status === 200 && (followers.json?.accounts || []).some((item) => item.id === viewer.id), `count=${followers.json?.accounts?.length}`);

    const notifications = await call('/api/fashion/notifications?limit=20', creator.id);
    const types = new Set((notifications.json?.notifications || []).map((item) => item.type));
    check('创作者收到点赞/评论/关注通知', notifications.status === 200 && types.has('like') && types.has('comment') && types.has('follow'), `types=${[...types].join(',')}`);
    check('未读计数正确', Number(notifications.json?.unreadCount) >= 3, `unread=${notifications.json?.unreadCount}`);

    const readAll = await call('/api/fashion/notifications/read', creator.id, { method: 'POST', body: JSON.stringify({ all: true }) });
    check('全部已读生效', readAll.status === 200 && readAll.json?.unreadCount === 0, `unread=${readAll.json?.unreadCount}`);

    const viewerReplyNotifications = await call('/api/fashion/notifications?limit=20', viewer.id);
    check('回复通知发给评论作者', (viewerReplyNotifications.json?.notifications || []).some((item) => item.type === 'reply'), '');

    const draftCreate = await call('/api/fashion/drafts', viewer.id, {
      method: 'POST',
      body: JSON.stringify({ title: '草稿验收', caption: '草稿内容', hashtags: ['草稿'], category: '女装趋势', mediaItems: [] })
    });
    check('草稿创建成功', draftCreate.status === 201 && Boolean(draftCreate.json?.draft?.id), `status=${draftCreate.status}`);
    const draftId = draftCreate.json?.draft?.id;

    const draftList = await call('/api/fashion/drafts', viewer.id);
    check('草稿列表可读取', (draftList.json?.drafts || []).some((item) => item.id === draftId), '');

    const draftPatch = await call(`/api/fashion/drafts/${draftId}`, viewer.id, { method: 'PATCH', body: JSON.stringify({ title: '草稿验收已更新', caption: '更新', hashtags: [], mediaItems: [] }) });
    check('草稿更新成功', draftPatch.status === 200 && draftPatch.json?.draft?.title === '草稿验收已更新', `status=${draftPatch.status}`);

    const draftDelete = await call(`/api/fashion/drafts/${draftId}`, viewer.id, { method: 'DELETE' });
    check('草稿删除成功', draftDelete.status === 200, `status=${draftDelete.status}`);

    const hide = await call(`/api/fashion/posts/${postId}/hide`, viewer.id, { method: 'POST', body: '{}' });
    check('不感兴趣写入成功', hide.status === 200 && hide.json?.hidden === true, `status=${hide.status}`);
    const feedAfterHide = await call('/api/fashion/posts?limit=50&sort=latest', viewer.id);
    check('信息流排除不感兴趣作品', !(feedAfterHide.json?.posts || []).some((item) => item.id === postId), '');

    const unhide = await call(`/api/fashion/posts/${postId}/hide`, viewer.id, { method: 'DELETE' });
    check('取消不感兴趣成功', unhide.status === 200 && unhide.json?.hidden === false, `status=${unhide.status}`);

    const block = await call('/api/fashion/blocks', viewer.id, { method: 'POST', body: JSON.stringify({ accountId: creator.id }) });
    check('屏蔽创作者成功', block.status === 200 && block.json?.blocked === true, `status=${block.status}`);
    const feedAfterBlock = await call('/api/fashion/posts?limit=50&sort=latest', viewer.id);
    check('信息流排除被屏蔽创作者', !(feedAfterBlock.json?.posts || []).some((item) => item.creatorAccountId === creator.id), '');
    const blocks = await call('/api/fashion/blocks', viewer.id);
    check('屏蔽列表可读取', (blocks.json?.blocks || []).some((item) => item.accountId === creator.id), '');
    const unblock = await call(`/api/fashion/blocks/${creator.id}`, viewer.id, { method: 'DELETE' });
    check('取消屏蔽成功', unblock.status === 200 && unblock.json?.blocked === false, `status=${unblock.status}`);

    const analytics = await call('/api/fashion/account/analytics', creator.id);
    check('创作者数据可读取', analytics.status === 200 && analytics.json?.totals?.posts >= 1 && analytics.json?.totals?.likes >= 1, `status=${analytics.status}`);

    const tags = await call('/api/fashion/tags', null);
    check('标签接口返回真实标签', tags.status === 200 && (tags.json?.tags || []).some((item) => item.tag === `验收${suffix}`), `tags=${(tags.json?.tags || []).length}`);

    const search = await call(`/api/fashion/search?q=${encodeURIComponent(suffix)}`, null);
    check('搜索接口找到作品', search.status === 200 && (search.json?.posts || []).some((item) => item.id === postId), '');

    const remove = await call(`/api/fashion/posts/${postId}`, creator.id, { method: 'DELETE' });
    check('作者可删除自己的作品', remove.status === 200 && remove.json?.deleted === true, `status=${remove.status}`);
    const feedAfterDelete = await call('/api/fashion/posts?limit=50&sort=latest', null);
    check('删除后作品不再公开', !(feedAfterDelete.json?.posts || []).some((item) => item.id === postId), '');
  } finally {
    await prisma.fashionCommunityBlock.deleteMany({ where: { OR: [{ blockerId: viewer.id }, { blockedId: viewer.id }] } }).catch(() => undefined);
    await prisma.fashionCommunityHiddenPost.deleteMany({ where: { accountId: viewer.id } }).catch(() => undefined);
    await prisma.fashionCommunityDraft.deleteMany({ where: { accountId: viewer.id } }).catch(() => undefined);
    await prisma.fashionCommunityNotification.deleteMany({ where: { OR: [{ recipientAccountId: creator.id }, { recipientAccountId: viewer.id }] } }).catch(() => undefined);
    await prisma.fashionCommunityFollow.deleteMany({ where: { OR: [{ creatorId: creator.id }, { viewerId: viewer.id }] } }).catch(() => undefined);
    await prisma.fashionCommunityPost.deleteMany({ where: { id: postId } }).catch(() => undefined);
    await prisma.fashionAccount.deleteMany({ where: { id: { in: [creator.id, viewer.id] } } }).catch(() => undefined);
    await prisma.$disconnect();
  }

  const failed = results.filter(([, ok]) => !ok);
  console.log(`\nSUMMARY ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
};

await run();
