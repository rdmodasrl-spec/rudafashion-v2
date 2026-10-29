import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { scanWxmlDirs, scanWxmlSource } from '../scripts/check-wxml-directives.mjs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// 微信开发者工具（lib 3.x）遇到 `wx:else` 找不到紧邻的 `wx:if` 时会直接编译失败：
// Bad attr `wx:else` ... wx:if not found。该错误只在开发者工具出现，网页与测试运行时不复现，
// 所以用 scripts/check-wxml-directives.mjs 做机械检查，防止注释、文本或漏写条件再次切断条件链。

test('checker flags an orphan wx:else', () => {
  const problems = scanWxmlSource('<view class="a"></view>\n<view wx:else>b</view>');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /wx:else 缺少紧邻的 wx:if/);
});

test('checker flags a comment that cuts an if/else chain', () => {
  const problems = scanWxmlSource('<view wx:if="{{a}}"></view>\n<!-- 说明 -->\n<view wx:else>b</view>');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /夹了注释/);
});

test('checker flags wx:if used together with wx:for on one element', () => {
  const problems = scanWxmlSource('<view wx:for="{{list}}" wx:if="{{item.ok}}"></view>');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /同时使用 wx:if 与 wx:for/);
});

test('all user and merchant mini-program WXML keep if/elif/else chains adjacent', () => {
  const { files, problems } = scanWxmlDirs(['miniprogram', 'merchant-miniprogram']);
  assert.ok(files.length >= 30, `scanned only ${files.length} wxml files`);
  assert.equal(problems.length, 0, problems.join('\n'));
});

test('merchant order page keeps the shipment sheet on explicit wx:if conditions', () => {
  const markup = read('merchant-miniprogram/pages/orders/index.wxml');
  assert.doesNotMatch(markup, /wx:else/);
  assert.doesNotMatch(markup, /wx:elif/);
  assert.match(markup, /<view wx:if="\{\{orderSummary\}\}"/);
  assert.match(markup, /<view wx:if="\{\{!orderSummary && loading\}\}"/);
  assert.match(markup, /<block wx:if="\{\{!shipmentLoading\}\}">/);
  assert.match(markup, /<text wx:if="\{\{!\(item\.remaining > 0\)\}\}"/);
});

test('merchant products empty-state comment stays inside the elif element', () => {
  const markup = read('merchant-miniprogram/pages/products/index.wxml');
  const chainStart = markup.indexOf('wx:elif="{{!loading && !visibleProducts.length}}"');
  const comment = markup.indexOf('<!-- 空状态 -->');
  assert.ok(chainStart > 0 && comment > chainStart, 'comment must sit after the wx:elif opening tag');
});
