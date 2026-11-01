/**
 * 平台管理员权限目录守卫。
 *
 * 目录是权限键的唯一事实来源：服务端 `requireAdminPermission('...')` 用到的键
 * 必须全部登记在这里，反之也不允许登记没人用的幽灵权限。
 * 这条测试保证「代码加了新权限但界面分配不到」或「界面能勾选但服务端不认」都不会发生。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_GROUPS,
  ADMIN_SUPER_PERMISSION,
  findAdminPermission,
  getAdminPermissionGroupLabel,
  isKnownAdminPermission
} from '../src/shared/adminPermissions.ts';

const server = readFileSync('server.ts', 'utf8');

function serverPermissionKeys(): string[] {
  const keys = new Set<string>();
  for (const match of server.matchAll(/requireAdminPermission\('([^']+)'\)/g)) keys.add(match[1]);
  for (const match of server.matchAll(/requireAnyAdminPermission\(\[([^\]]+)\]\)/g)) {
    for (const part of match[1].split(',')) {
      const key = part.trim().replace(/^['"]|['"]$/g, '');
      if (key) keys.add(key);
    }
  }
  return Array.from(keys).sort();
}

test('权限目录与 server.ts 实际使用的权限键完全一致', () => {
  assert.deepEqual(ADMIN_PERMISSIONS, serverPermissionKeys());
});

test('权限目录不提供通配符，通配符只作为服务端语义存在', () => {
  assert.equal(ADMIN_SUPER_PERMISSION, '*');
  assert.equal(isKnownAdminPermission('*'), false);
  assert.ok(!ADMIN_PERMISSIONS.includes('*'));
});

test('每条权限定义都有中文标签、说明和风险等级，且键唯一', () => {
  const seen = new Set<string>();
  for (const group of ADMIN_PERMISSION_GROUPS) {
    assert.match(group.label, /\S/, '分组必须有中文名');
    assert.ok(group.permissions.length > 0, `${group.key} 分组不能为空`);
    for (const permission of group.permissions) {
      assert.ok(!seen.has(permission.key), `${permission.key} 重复登记`);
      seen.add(permission.key);
      assert.match(permission.label, /[\u4e00-\u9fff]/, `${permission.key} 需要中文标签`);
      assert.ok(permission.description.length >= 6, `${permission.key} 说明过短`);
      assert.ok(['normal', 'sensitive'].includes(permission.risk), `${permission.key} 风险等级非法`);
      assert.equal(findAdminPermission(permission.key)?.key, permission.key);
      assert.equal(getAdminPermissionGroupLabel(permission.key), group.label);
    }
  }
});

test('能改变买家可见内容或资金的权限标记为 sensitive', () => {
  for (const key of ['products.review', 'merchants.review', 'finance.payouts', 'finance.refunds', 'accounts.manage']) {
    assert.equal(findAdminPermission(key)?.risk, 'sensitive', `${key} 必须是 sensitive`);
  }
  assert.equal(findAdminPermission('content.gallery')?.risk, 'normal');
});

test('未知权限键不会被当成合法权限', () => {
  for (const key of ['', 'products.approve', 'PRODUCTS.REVIEW', '*', 'products.review ']) {
    assert.equal(isKnownAdminPermission(key), false, `${JSON.stringify(key)} 不应通过`);
  }
  assert.equal(isKnownAdminPermission('products.review'), true);
});
