import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const supportPageSource = readFileSync(new URL('../miniprogram/pages/support/index.js', import.meta.url), 'utf8');

function createSupportPage() {
  let definition: Record<string, any> | undefined;
  const requests: Array<Record<string, string>> = [];
  const modals: Array<Record<string, any>> = [];
  const removedKeys: string[] = [];
  const context = {
    Page(value: Record<string, any>) {
      definition = value;
    },
    require(specifier: string) {
      if (specifier === '../../utils/api') {
        return {
          createSupportRequest: async (request: Record<string, string>) => {
            requests.push(request);
            return { request: { id: 'support-1' } };
          }
        };
      }
      if (specifier === '../../utils/auth') {
        return { getAuthSession: () => ({ profile: { contactPerson: 'Buyer', email: 'buyer@example.com' } }) };
      }
      throw new Error(`Unexpected module ${specifier}`);
    },
    wx: {
      getStorageSync: () => ({
        subject: '询库存：外套',
        message: '商品：外套\n款号：COAT-1\n已选颜色、尺码和数量：白色 / M：4 件'
      }),
      removeStorageSync(key: string) { removedKeys.push(key); },
      showModal(options: Record<string, any>) { modals.push(options); }
    }
  };
  runInNewContext(supportPageSource, context);
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: { ...definition.data },
    setData(changes: Record<string, any>) { Object.assign(this.data, changes); }
  });
  return { page, requests, modals, removedKeys };
}

test('support page prefills buyer contact and product context then submits the ticket', async () => {
  const { page, requests, modals, removedKeys } = createSupportPage();
  page.onLoad({ source: 'product' });

  assert.equal(page.data.name, 'Buyer');
  assert.equal(page.data.email, 'buyer@example.com');
  assert.equal(page.data.subject, '询库存：外套');
  assert.equal(page.data.message.includes('COAT-1'), true);
  assert.deepEqual(removedKeys, ['rudaProductSupportDraft']);

  await page.submitRequest();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].email, 'buyer@example.com');
  assert.equal(requests[0].message.includes('白色 / M：4 件'), true);
  assert.equal(modals[0].title, '客服留言已提交');
});
