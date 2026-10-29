import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const MOBILE_TARGETS = [
  'frontend-mobile',
  'merchant-admin-mobile',
  'platform-admin-mobile'
];

test('mobile targets share one shape token set imported by every mobile target', () => {
  const base = source('src/index.css');
  const shared = source('src/apps/shared/mobile-design-system.css');

  for (const token of ['control', 'card', 'input', 'modal', 'tag']) {
    assert.match(base, new RegExp(`--radius-ruda-${token}:\\s*2px`), `Web keeps the 2px default for ${token}`);
    assert.match(shared, new RegExp(`--radius-ruda-${token}:\\s*(6|8|10|4)px`), `mobile overrides ${token}`);
  }

  for (const target of MOBILE_TARGETS) {
    assert.match(shared, new RegExp(`html\\[data-ruda-app="${target}"\\]`), `${target} is covered by the shared rules`);
    assert.match(
      source(`src/apps/${target}/styles.css`),
      /@import "\.\.\/(shared|platform-admin-common)\.css"|@import "\.\.\/shared\/mobile-design-system\.css"/,
      `${target} imports the shared mobile layer`
    );
  }

  assert.match(shared, /\.rounded-3xl[\s\S]*?border-radius:\s*var\(--radius-ruda-card\)/, 'large card radii are normalized');
  assert.match(shared, /\.ruda-modal[\s\S]*?border-radius:\s*var\(--radius-ruda-modal\)/, 'modals use the modal token');
  assert.match(shared, /--ruda-mobile-card-padding:\s*12px/, 'cards share a 12px padding token');
  assert.match(shared, /\.ruda-home-search[\s\S]*?border-radius:\s*var\(--radius-ruda-input\)/, 'search surfaces use the input token');
});

test('merchant mobile component classes no longer invent button radii or pill buttons', () => {
  const styles = source('src/apps/merchant-admin-mobile/styles.css');
  assert.match(styles, /\.ruda-btn-primary\s*{[^}]*h-\[40px\][^}]*rounded-\[6px\]/);
  assert.match(styles, /\.ruda-btn-secondary\s*{[^}]*h-\[36px\][^}]*rounded-\[6px\]/);
  assert.match(styles, /\.ruda-card\s*{[^}]*rounded-\[8px\][^}]*p-3/);
  assert.match(styles, /\.ruda-input\s*{[^}]*rounded-\[6px\]/);
  assert.match(styles, /\.ruda-tag\s*{[^}]*h-\[22px\][^}]*rounded-\[4px\]/);
  assert.doesNotMatch(styles, /\.ruda-(?:btn-icon|tab-pill)[^}]*rounded-full/);
});

test('merchant mobile pages do not use full-width utility actions for compact controls', () => {
  const app = source('src/apps/merchant-admin-mobile/MerchantMobileApp.tsx');
  const createForm = source('src/apps/merchant-admin-mobile/MerchantMobileProductCreateForm.tsx');
  const platform = source('src/apps/platform-admin-mobile/PlatformAdminMobile.tsx');

  assert.doesNotMatch(app, /min-h-12 w-full[^>]*退出登录/, 'logout is not a full-width 48px bar');
  assert.doesNotMatch(app, /className="[^"]*h-\[44px\][^"]*"/, 'mobile actions do not keep legacy 44px heights');
  assert.doesNotMatch(app, /onClick=\{runProductSmartAssistant\}[\s\S]{0,240}?w-full/, 'AI assistant action is not stretched across the modal');
  assert.match(app, /onClick=\{runProductSmartAssistant\}[\s\S]{0,240}?inline-flex h-9/, 'AI assistant uses a compact 36px action');
  assert.doesNotMatch(createForm, /className="[^"]*h-11[^"]*flex-\[?[12]\]?[^"]*"/, 'product wizard buttons use the 40px control height');
  assert.match(createForm, /ruda-action-bar[\s\S]*?h-10/, 'product wizard footer shares the action-bar height');

  for (const tag of platform.match(/<button\b[\s\S]*?>/g) ?? []) {
    assert.doesNotMatch(tag, /className="[^"]*w-full/, 'platform mobile avoids full-width compact buttons');
  }
});

test('mobile icon sizes are centralized instead of per-page overrides', () => {
  const shared = source('src/apps/shared/mobile-design-system.css');
  assert.match(shared, /svg\.lucide[\s\S]*?width:\s*18px !important/, 'standard mobile icon is 18px');
  assert.match(shared, /#mobile-app-bottom-nav svg\.lucide[\s\S]*?width:\s*22px !important/, 'storefront bottom navigation is 22px');
  assert.match(shared, /\.ruda-bottom-nav svg\.lucide[\s\S]*?width:\s*20px !important/, 'merchant bottom navigation is 20px');
});
