import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../merchant-miniprogram/', import.meta.url));

// 2026-10-29 微信开发者工具真实报错：./pages/industry/index.wxml:84:11:
// expect end-tag `view`, near `block` —— 手工改 `<block wx:else>` 时闭合标签错位，
// 模拟器整页报编译失败，而当时的单测全绿。这里对全部 wxml 做标签配对校验。
const VOID_TAGS = new Set(['image', 'input', 'icon', 'import', 'include', 'wxs']);

function listWxml(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) listWxml(path, out);
    else if (name.endsWith('.wxml')) out.push(path);
  }
  return out;
}

function checkBalance(source) {
  const clean = source.replace(/<!--[\s\S]*?-->/g, '');
  const pattern = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  const stack = [];
  const problems = [];
  let match;
  while ((match = pattern.exec(clean))) {
    const [, closing, tag, , selfClosing] = match;
    const line = clean.slice(0, match.index).split('\n').length;
    if (closing) {
      const open = stack.pop();
      if (!open || open.tag !== tag) {
        problems.push(`第 ${line} 行 </${tag}> 与 <${open ? `${open.tag}>（第 ${open.line} 行` : '空栈'}> 不匹配`);
        return problems;
      }
      continue;
    }
    if (selfClosing) continue;
    if (VOID_TAGS.has(tag)) continue;
    stack.push({ tag, line });
  }
  if (stack.length) {
    problems.push(...stack.map(item => `<${item.tag}>（第 ${item.line} 行）未闭合`));
  }
  return problems;
}

test('所有商家小程序 wxml 标签闭合正确（开发者工具编译前置条件）', () => {
  const files = listWxml(root);
  assert.ok(files.length >= 15, `expected the mini program wxml pages, got ${files.length}`);
  const failures = [];
  for (const file of files) {
    for (const problem of checkBalance(readFileSync(file, 'utf8'))) {
      failures.push(`${file.replace(root, '')}: ${problem}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('标签闭合校验能识别错位的 block 结尾', () => {
  const broken = '<view wx:else>\n  <view wx:for="{{list}}">\n    <text>{{item}}</text>\n  </view>\n</view>';
  const valid = checkBalance(broken);
  assert.deepEqual(valid, []);
  const mismatched = checkBalance('<view>\n  <block wx:else>\n    <view>x</view>\n  </view>\n</block>');
  assert.equal(mismatched.length, 1);
  assert.match(mismatched[0], /不匹配/);
});

test('冷启动未登录时不请求要求鉴权的功能开关接口', () => {
  const source = readFileSync(join(root, 'utils/feature-flags.js'), 'utf8');
  assert.match(source, /const \{ AUTH_STORAGE_KEY \} = require\('\.\/constants'\)/);
  assert.match(source, /function readSessionToken\(\)/);
  // 守卫必须出现在发起请求之前，否则依旧会在登录页打出一条 401。
  const guardIndex = source.indexOf('if (!readSessionToken())');
  const requestIndex = source.indexOf("request('/api/merchant/feature-flags')");
  assert.ok(guardIndex > 0 && requestIndex > guardIndex, 'token guard must run before the request');
  assert.match(source, /if \(!readSessionToken\(\)\) \{\s*const stored = readCache\(\);\s*return Promise\.resolve\(stored \? stored\.flags : \{\}\);/);
});

test('登录成功后按新令牌刷新功能开关', () => {
  const source = readFileSync(join(root, 'pages/login/index.js'), 'utf8');
  assert.match(source, /const \{ refreshFeatureFlags \} = require\('\.\.\/\.\.\/utils\/feature-flags'\)/);
  assert.match(source, /saveSession\(role, response\);[\s\S]{0,240}refreshFeatureFlags\(\{ force: true \}\)\.catch\(\(\) => \{\}\);/);
  // 登录后必须重新拉取行业上下文，不能用上一个账号的缓存。
  assert.match(source, /clearIndustryContext\(\);/);
});
