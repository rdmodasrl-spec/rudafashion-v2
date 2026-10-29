import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const requireFromTest = createRequire(import.meta.url);
const merchantConstants = requireFromTest('../merchant-miniprogram/utils/constants.js');

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

test('mini-program project configs stay valid JSON with the registered AppIDs', () => {
  const root = readJson('project.config.json');
  const buyer = readJson('miniprogram/project.config.json');
  const merchant = readJson('merchant-miniprogram/project.config.json');
  assert.equal(root.appid, 'wx6b3419072f3934d2');
  assert.equal(buyer.appid, 'wx6b3419072f3934d2');
  assert.equal(merchant.appid, 'wx18abf078e13f9f0a');
});

test('merchant mini-program API base URL is HTTPS and matches the documented host', () => {
  const baseUrl = new URL(merchantConstants.API_BASE_URL as string);
  assert.equal(baseUrl.protocol, 'https:');
  const readme = readFileSync(new URL('../merchant-miniprogram/README.md', import.meta.url), 'utf8');
  assert.match(readme, /request 合法域名/, 'README must document the request allowlist requirement');
  assert.ok(readme.includes(`https://${baseUrl.host}`), 'README must document the API host configured in constants.js');
});
