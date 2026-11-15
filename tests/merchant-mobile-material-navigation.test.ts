import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const mobile = readFileSync(path.join(root, 'src/apps/merchant-admin-mobile/MerchantMobileApp.tsx'), 'utf8');

test('mobile material navigation scrolls into view and reuses the shared menu entry', () => {
  assert.match(
    mobile,
    /if \(showMaterialManager && activeTab === 'dashboard'\)[\s\S]*?factoryOperationsRef\.current\?\.scrollIntoView\(\{ block: 'start' \}\)[\s\S]*?\}, \[activeTab, showMaterialManager\]\);/,
    'switching back to the dashboard must re-run the scroll when the material manager was already open'
  );
  assert.match(
    mobile,
    /onClick=\{\(\) => openMoreItem\('materials'\)\}[\s\S]{0,300}打开物料台账与入库管理/,
    'the production-workspace CTA must reuse the materials menu navigation and title'
  );
});
