import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const miniProgramRoot = new URL('../miniprogram/', import.meta.url);
const app = JSON.parse(readFileSync(new URL('app.json', miniProgramRoot), 'utf8'));

test('mini program bottom navigation matches the five RUDA mobile app sections', () => {
  assert.deepEqual(
    app.tabBar.list.map((item: { text: string }) => item.text),
    ['首页', '商家', 'ModaUI', '时尚', '我的']
  );
  assert.deepEqual(
    app.tabBar.list.map((item: { pagePath: string }) => item.pagePath),
    [
      'pages/home/index',
      'pages/merchants/index',
      'pages/modagpt/index',
      'pages/fashion/index',
      'pages/profile/index'
    ]
  );
  assert.equal(app.tabBar.color, '#8a8580');
  assert.equal(app.tabBar.selectedColor, '#1d1b19');
  assert.equal(app.tabBar.backgroundColor, '#ffffff');
  assert.equal(app.tabBar.custom, true);
});

test('every mini program tab has registered page files', () => {
  for (const tab of app.tabBar.list as Array<{ pagePath: string }>) {
    const pageDirectory = new URL(`${tab.pagePath.replace(/\/index$/, '')}/`, miniProgramRoot);
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      assert.equal(
        existsSync(new URL(`index.${extension}`, pageDirectory)),
        true,
        `${tab.pagePath} must include index.${extension}`
      );
    }
  }
});

test('every registered mini program page has all required source files', () => {
  for (const pagePath of app.pages as string[]) {
    const pageDirectory = new URL(`${pagePath.replace(/\/index$/, '')}/`, miniProgramRoot);
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      assert.equal(
        existsSync(new URL(`index.${extension}`, pageDirectory)),
        true,
        `${pagePath} must include index.${extension}`
      );
    }
  }
});
