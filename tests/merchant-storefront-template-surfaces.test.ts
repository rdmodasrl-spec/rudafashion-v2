import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const miniRoot = new URL('../merchant-miniprogram/', import.meta.url);
const workspaceSource = readFileSync(new URL('pages/workspace/index.js', miniRoot), 'utf8');
const workspaceMarkup = readFileSync(new URL('pages/workspace/index.wxml', miniRoot), 'utf8');

type MockMerchantProfile = {
  name: string;
  storefrontTemplate?: string;
  industryTemplate?: string;
  storefrontTemplateOptions?: Array<{ id: string; name: string; positioning: string }>;
};

function createWorkspacePage(merchantProfile: MockMerchantProfile = {
  name: 'Test merchant',
  storefrontTemplate: 'luxury_black_gold'
}) {
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
            return { settings: {}, merchant: merchantProfile };
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
        selectedTemplate: { id: 'fashion_monochrome', label: '时尚版 · 黑白', description: '', unsupported: false },
        templates: [
          { id: 'fashion_monochrome', label: '时尚版 · 黑白', description: '', unsupported: false },
          { id: 'luxury_black_gold', label: '豪华版 · 黑金', description: '', unsupported: false },
          { id: 'ecommerce_standard', label: '标准版 · 电商', description: '', unsupported: false }
        ],
        templateUnsupported: false,
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

test('mini program uses server-provided industry templates without replacing the saved choice', async () => {
  const options = [
    { id: 'bags_editorial', name: '意大利编辑版', positioning: '品牌官网与系列画册' },
    { id: 'bags_catalogue', name: '产品目录版', positioning: '商品分类与筛选' },
    { id: 'bags_wholesale', name: '批发电商版', positioning: '规格矩阵与批发订货' }
  ];
  const page = createWorkspacePage({
    name: 'Test merchant',
    industryTemplate: 'bags_wholesale',
    storefrontTemplate: 'bags_editorial',
    storefrontTemplateOptions: options
  });
  await page.loadModuleData({ response: { merchant: { storefrontTemplate: 'bags_editorial' } } });

  assert.equal(page.data.storefrontDraft.template, 'bags_editorial');
  assert.equal(page.data.storefrontDraft.selectedTemplate.label, '意大利编辑版');
  assert.deepEqual(
    page.data.storefrontDraft.templates.map((template: { id: string }) => template.id),
    ['bags_editorial', 'bags_catalogue', 'bags_wholesale']
  );
  assert.equal(page.data.storefrontDraft.templateUnsupported, false);
});

test('mini program preserves an unrecognized saved template instead of silently switching it', async () => {
  const page = createWorkspacePage({
    name: 'Test merchant',
    industryTemplate: 'bags_wholesale',
    storefrontTemplate: 'future_template_id',
    storefrontTemplateOptions: [
      { id: 'bags_editorial', name: '意大利编辑版', positioning: '品牌官网与系列画册' }
    ]
  });
  await page.loadModuleData({ response: { merchant: { storefrontTemplate: 'future_template_id' } } });

  assert.equal(page.data.storefrontDraft.template, 'future_template_id');
  assert.equal(page.data.storefrontDraft.templateUnsupported, true);
  assert.equal(page.data.storefrontDraft.selectedTemplate.unsupported, true);
});

test('mini program content saves do not overwrite an unrecognized saved template', async () => {
  const page = createWorkspacePage({
    name: 'Test merchant',
    industryTemplate: 'bags_wholesale',
    storefrontTemplate: 'future_template_id',
    storefrontTemplateOptions: [
      { id: 'bags_editorial', name: '意大利编辑版', positioning: '品牌官网与系列画册' }
    ]
  });
  await page.loadModuleData({ response: { merchant: { storefrontTemplate: 'future_template_id' } } });
  await page.saveStorefront();

  const save = page.requests.find(call => call.path === '/api/merchant/storefront');
  assert.ok(save);
  assert.equal((save.options.data as Record<string, unknown>).storefrontTemplate, undefined);
});

test('mini program storefront form exposes all templates and the one-click apply action', () => {
  assert.match(workspaceMarkup, /range="\{\{storefrontDraft\.templates\}\}"/);
  assert.match(workspaceMarkup, /一键应用到商家网站/);
  assert.match(workspaceMarkup, /disabled="\{\{storefrontDraft\.templateUnsupported\}\}"/);
});
