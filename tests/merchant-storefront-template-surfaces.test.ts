import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const miniRoot = new URL('../merchant-miniprogram/', import.meta.url);
const workspaceSource = readFileSync(new URL('pages/workspace/index.js', miniRoot), 'utf8');
const workspaceMarkup = readFileSync(new URL('pages/workspace/index.wxml', miniRoot), 'utf8');

function createWorkspacePage() {
  let definition: Record<string, any> | undefined;
  const requests: Array<{ path: string; options: Record<string, unknown> }> = [];
  const toasts: Array<Record<string, unknown>> = [];
  runInNewContext(workspaceSource, {
    Page: (page: Record<string, any>) => { definition = page; },
    require: (specifier: string) => {
      if (specifier === '../../utils/api') return {
        request: async (path: string, options: Record<string, unknown> = {}) => {
          requests.push({ path, options });
          if (path === '/api/merchant/settings') {
            return { settings: {}, merchant: { name: 'Test merchant', storefrontTemplate: 'luxury_black_gold' } };
          }
          if (path === '/api/merchant/store-categories') return { categories: [] };
          return {};
        }
      };
      if (specifier === '../../utils/page-auth') return { requireMerchantSession: async () => ({}) };
      if (specifier === '../../utils/permissions') return { canAccessWorkspace: () => true };
      if (specifier === '../../utils/constants') return { PUBLIC_SITE_URL: 'https://ruda.fashion' };
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx: { showToast: (options: Record<string, unknown>) => toasts.push(options) }
  });
  assert.ok(definition);
  return Object.assign({}, definition, {
    data: {
      id: 'store',
      storefrontDraft: {
        template: 'luxury_black_gold',
        templateIndex: 0,
        selectedTemplate: null,
        templates: [],
        shippingPolicy: '',
        returnsPolicy: '',
        seoTitle: '',
        seoDescription: '',
        tagline: '',
        description: ''
      }
    },
    requests,
    toasts,
    setData(update: Record<string, unknown>) { Object.assign(this.data, update); },
    async loadWorkspace() {}
  });
}

test('mini program can select and one-click apply the storefront theme', async () => {
  const page = createWorkspacePage();
  page.onStorefrontTemplateChange({ detail: { value: '1' } });
  assert.equal(page.data.storefrontDraft.template, 'luxury_black_gold');
  await page.applyStorefrontTemplate();

  assert.equal(page.requests.length, 1);
  assert.equal(page.requests[0].path, '/api/merchant/storefront');
  assert.deepEqual(JSON.parse(JSON.stringify(page.requests[0].options)), {
    method: 'PUT',
    data: { storefrontTemplate: 'luxury_black_gold' }
  });
  assert.equal(page.toasts[0].title, '网站模板已一键应用');
});

test('mini program reads the saved storefront theme before presenting template choices', async () => {
  const page = createWorkspacePage();
  await page.loadModuleData({ response: { merchant: { storefrontTemplate: 'fashion_monochrome' } } });

  assert.equal(page.data.storefrontDraft.template, 'luxury_black_gold');
  assert.equal((page.data.storefrontDraft.selectedTemplate as { id?: string } | null)?.id, 'luxury_black_gold');
  assert.equal(page.data.storefrontDraft.templateIndex, 1);
});

test('mini program storefront form exposes all templates and the one-click apply action', () => {
  assert.match(workspaceMarkup, /range="\{\{storefrontDraft\.templates\}\}"/);
  assert.match(workspaceMarkup, /一键应用到商家网站/);
});
