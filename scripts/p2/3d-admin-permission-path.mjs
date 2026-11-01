/**
 * 第五轮：平台管理员权限分配路径（隔离库 ruda_p2_3d + 隔离实例）。
 *
 * 证明「最小权限授予路径」真的可用、且真的能收回权限：
 *  1) 有 accounts.manage 的管理员把 products.review 授予另一个管理员 → 200 + 审计
 *  2) 被授权者重新登录后能访问模型审核清单 → 200
 *  3) 收回权限后重新登录 → 403
 *  4) 把自己降权到无法管理权限 → 409 ADMIN_PERMISSION_SELF_LOCKOUT
 *  5) 提交未登记权限键 → 400 ADMIN_PERMISSION_UNKNOWN
 *
 * 前置：隔离实例已按 README 启动在 4105，JWT_ADMIN_SECRET=p2-3d-admin-secret，
 * 且已跑过 scripts/p2/3d-upload-fixture.mjs。
 */
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.P2_BASE || 'http://127.0.0.1:4105';
const SECRET = process.env.P2_ADMIN_SECRET || 'p2-3d-admin-secret';
const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) pass += 1; else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const loadActor = async username => {
  const account = await prisma.authAccount.findFirst({
    where: { role: 'admin', username },
    select: { id: true, username: true, updatedAt: true, permissions: true }
  });
  if (!account) throw new Error(`missing admin ${username}`);
  return account;
};

// token 的权限来自登录时签入的内容，与生产登录路由一致；每次从库读 updatedAt 以满足会话新鲜度
const tokenFor = account => jwt.sign({
  id: `admin-${account.username}`,
  username: account.username,
  name: account.username,
  role: 'admin',
  accountId: account.id,
  permissions: JSON.parse(account.permissions || '[]'),
  credentialVersion: account.updatedAt.getTime(),
  mfaVerified: true
}, SECRET, { expiresIn: '1h' });

const call = async (account, path, init = {}) => {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokenFor(account)}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
};

// 让 qa-reviewer 具备管理权限的能力（隔离库，允许直接写）
await prisma.authAccount.updateMany({
  where: { username: 'qa-reviewer' },
  data: { permissions: JSON.stringify(['products.review', 'accounts.manage']) }
});
await prisma.authAccount.updateMany({
  where: { username: 'qa-no-perm' },
  data: { permissions: JSON.stringify(['settings.ai_support']) }
});

const reviewer = await loadActor('qa-reviewer');
const target = await loadActor('qa-no-perm');

// 1) 授予 products.review（审计计数用增量，脚本可重复运行）
const auditBefore = await prisma.auditLog.count({
  where: { action: 'ADMIN_PERMISSION_UPDATE', entityId: target.id }
});
const grant = await call(reviewer, `/api/admin/accounts/${target.id}/permissions`, {
  method: 'PUT',
  body: JSON.stringify({ permissions: ['settings.ai_support', 'products.review'] })
});
const auditAfter = await prisma.auditLog.count({
  where: { action: 'ADMIN_PERMISSION_UPDATE', entityId: target.id }
});
check('1 授予 products.review → 200 且写审计', grant.status === 200 && auditAfter - auditBefore === 1,
  `status=${grant.status} auditDelta=${auditAfter - auditBefore} requiresRelogin=${grant.json?.requiresRelogin}`);

// 2) 被授权者（重新登录后的新 token）可访问模型审核清单
const granted = await loadActor('qa-no-perm');
const list = await call(granted, '/api/admin/model-reviews?status=all&limit=5');
check('2 被授权者重新登录后可读模型审核清单', list.status === 200 && Array.isArray(list.json?.items),
  `status=${list.status} items=${list.json?.items?.length ?? 'n/a'}`);

// 3) 收回权限后重新登录 → 403
const revoke = await call(reviewer, `/api/admin/accounts/${target.id}/permissions`, {
  method: 'PUT',
  body: JSON.stringify({ permissions: ['settings.ai_support'] })
});
const revoked = await loadActor('qa-no-perm');
const denied = await call(revoked, '/api/admin/model-reviews?status=all&limit=5');
const deniedCode = denied.json?.error?.code || denied.json?.error;
check('3 收回权限后 → 403 ADMIN_PERMISSION_REQUIRED',
  revoke.status === 200 && denied.status === 403 && deniedCode === 'ADMIN_PERMISSION_REQUIRED',
  `revoke=${revoke.status} denied=${denied.status}/${deniedCode}`);

// 4) 自我锁死保护
const selfLock = await call(reviewer, `/api/admin/accounts/${reviewer.id}/permissions`, {
  method: 'PUT',
  body: JSON.stringify({ permissions: ['products.review'] })
});
const reviewerAfter = await loadActor('qa-reviewer');
check('4 自我移除 accounts.manage → 409 且库未变',
  selfLock.status === 409
    && selfLock.json?.error === 'ADMIN_PERMISSION_SELF_LOCKOUT'
    && JSON.parse(reviewerAfter.permissions).includes('accounts.manage'),
  `status=${selfLock.status} db=${reviewerAfter.permissions}`);

// 5) 未登记权限键
const unknown = await call(reviewer, `/api/admin/accounts/${target.id}/permissions`, {
  method: 'PUT',
  body: JSON.stringify({ permissions: ['products.approve'] })
});
check('5 未登记权限键 → 400 ADMIN_PERMISSION_UNKNOWN',
  unknown.status === 400 && unknown.json?.error === 'ADMIN_PERMISSION_UNKNOWN',
  `status=${unknown.status}`);

// 6) 通配符不能通过接口下发
const wildcard = await call(reviewer, `/api/admin/accounts/${target.id}/permissions`, {
  method: 'PUT',
  body: JSON.stringify({ permissions: ['*'] })
});
check('6 通配符不能被直接下发', wildcard.status === 400, `status=${wildcard.status}`);

console.log(`\n汇总：${pass} 通过 / ${fail} 失败`);
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
