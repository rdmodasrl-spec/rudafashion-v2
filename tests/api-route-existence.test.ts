import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

/**
 * 客户端调用的每一个字面 /api 路径都必须在服务端有对应路由。
 *
 * KNOWN_UNIMPLEMENTED 是本仓库当前**已核实**的断链清单（2026-10-29 审计）。
 * 修好一条就把它从这里删掉；新增断链会让测试失败。这样断链既不会悄悄增长，
 * 也不会像过去那样被 stub 掉的测试掩盖。
 * 详细背景见 docs/engineering/modules/consumer-account.md 与 docs/engineering/audit/。
 */
const KNOWN_UNIMPLEMENTED = [
  // 平台后台邮件管理中控：列表统计接口缺失。
  '/api/admin/email/overview',
  // RFQ 询价：无 Prisma 模型、无任何服务端路由，但买家/商家前端入口仍在。
  '/api/buyer/rfq',
  '/api/buyer/rfq/*/accept/*',
  '/api/merchant/rfq',
  '/api/merchant/rfq/*/quote',
  // 商家往来单位（客户/供应商聚合视图）：页面未挂载且接口缺失。
  '/api/merchant/counterparties',
  // 商家小程序：客户停用/启用接口缺失（服务端只有 PUT /customers/:id）。
  '/api/merchant/customers/*/status',
  // 商家推广奖励：组件未挂载且接口缺失；小程序增长面板在 Promise.all 中调用导致整块失败。
  '/api/merchant/growth/referrals',
  // 图片任务异步轮询：服务端 /api/merchant/modagpt/images 为同步返回，无 tasks/:id 路由。
  '/api/merchant/modagpt/images/tasks/*',
  // 商家小程序：通知「标记已处理」接口缺失（服务端只有 /read）。
  '/api/merchant/notifications/*/resolve',
  // 商家小程序：供应商编辑走 PATCH /suppliers/:id，服务端只有 PATCH /:id/status。
  '/api/merchant/suppliers/*',
  // 站内消息线程：服务端只有订单维度 orders/:id/messages，无全局线程接口。
  '/api/messages/threads',
  '/api/messages/threads/*',
  '/api/messages/threads/*/messages',
  // 买家小程序：门店访问码兑换接口缺失。
  '/api/vault/store-access/redeem',
  // 解析歧义（非真实断链）：PWA 用 `/api/${cond ? 'merchant/' : ''}notifications/...` 拼接，
  // 具体路径 /api/notifications/:id/read 与 /api/merchant/notifications/:id/read 均已存在。
  '/api/*notifications/*/read'
];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'release', 'var', 'logs', 'public']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js)$/.test(entry)) out.push(full);
  }
  return out;
}

function normalizeApiPath(raw: string): string {
  let value = raw
    .split('?')[0]
    .replace(/\$\{[^}]*\}/g, '*')
    .replace(/:[A-Za-z_]\w*/g, '*')
    .replace(/\*+/g, '*')
    .replace(/\/$/, '');
  if (value.endsWith('*') && !value.endsWith('/*')) value = value.slice(0, -1);
  return value;
}

/** 从一行代码里取出 /api/... 字面量；`${...}` 折叠成 `*`（含内部引号与嵌套）。 */
function extractApiPaths(line: string): string[] {
  const found: string[] = [];
  let from = 0;
  for (;;) {
    const start = line.indexOf('/api/', from);
    if (start < 0) break;
    let cursor = start;
    let depth = 0;
    let token = '';
    while (cursor < line.length) {
      const char = line[cursor];
      if (char === '$' && line[cursor + 1] === '{') {
        depth += 1;
        token += '*';
        cursor += 2;
        continue;
      }
      if (depth > 0) {
        if (char === '{') depth += 1;
        else if (char === '}') depth -= 1;
        cursor += 1;
        continue;
      }
      if ('`\'" \t),;'.includes(char) || char === '?') break;
      token += char;
      cursor += 1;
    }
    found.push(token);
    from = cursor;
  }
  return found;
}

const CALL_SITE = /\b(?:apiGet|apiPost|apiPut|apiPatch|apiDelete|apiRequest)\s*(?:<[^>]*>)?\(|\brequest\s*\(|\bfetch\s*\(/;

function serverRoutes(): string[] {
  const files = [
    path.join(root, 'server.ts'),
    ...readdirSync(path.join(root, 'src/server'))
      .filter(file => file.endsWith('.ts'))
      .map(file => path.join(root, 'src/server', file))
  ];
  const routes = new Set<string>();
  for (const file of files) {
    for (const match of readFileSync(file, 'utf8').matchAll(/['"`](\/api\/[^'"`\s]*)['"`]/g)) {
      routes.add(normalizeApiPath(match[1]));
    }
  }
  return [...routes];
}

const segmentsMatch = (left: string[], right: string[]) => (
  left.length === right.length
  && left.every((segment, index) => segment === '*' || right[index] === '*' || segment === right[index])
);

test('every literal client API path is served by the backend', () => {
  const routeSegments = serverRoutes().map(route => route.split('/'));
  const unserved = new Map<string, string>();

  for (const file of [...walk(path.join(root, 'src')), ...walk(path.join(root, 'merchant-miniprogram')), ...walk(path.join(root, 'miniprogram'))]) {
    if (file.includes(`${path.sep}tests${path.sep}`)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (!line.includes('/api/') || !CALL_SITE.test(line)) return;
      for (const raw of extractApiPaths(line)) {
        if (!raw.startsWith('/api')) continue;
        const apiPath = normalizeApiPath(raw);
        const clientSegments = apiPath.split('/');
        if (routeSegments.some(route => segmentsMatch(clientSegments, route))) continue;
        if (!unserved.has(apiPath)) unserved.set(apiPath, `${path.relative(root, file)}:${index + 1}`);
      }
    });
  }

  const found = [...unserved.keys()].sort();
  assert.deepEqual(
    found,
    [...KNOWN_UNIMPLEMENTED].sort(),
    `未实现的接口清单发生变化。新增断链：${found.filter(item => !KNOWN_UNIMPLEMENTED.includes(item)).join(', ') || '无'}；` +
    `已修复请从 KNOWN_UNIMPLEMENTED 删除：${KNOWN_UNIMPLEMENTED.filter(item => !found.includes(item)).join(', ') || '无'}`
  );
});

test('consumer account endpoints are never in the unimplemented list', () => {
  const consumerPaths = [
    '/api/consumers/me',
    '/api/consumers/me/addresses',
    '/api/consumers/me/wishlist',
    '/api/consumers/me/orders',
    '/api/promotions/calculate/retail',
    '/api/retail/products'
  ];
  const routes = serverRoutes();
  for (const apiPath of consumerPaths) {
    assert.ok(
      routes.some(route => segmentsMatch(apiPath.split('/'), route.split('/'))),
      `consumer endpoint missing on the server: ${apiPath}`
    );
    assert.ok(!KNOWN_UNIMPLEMENTED.includes(apiPath), `consumer endpoint must not be allowlisted: ${apiPath}`);
  }
});
