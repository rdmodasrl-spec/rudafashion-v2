import test from 'node:test';
import assert from 'node:assert/strict';
import { createMerchantProductDraft } from '../src/shared/merchantProductCreation';
import {
  createMerchantProductFormPageContext,
  sanitizeMerchantCopilotPageContext
} from '../src/shared/merchantCopilotContext';

test('builds a minimal product-create snapshot without cost or media URLs', () => {
  const draft = createMerchantProductDraft();
  draft.name = '羊毛外套';
  draft.costPrice = 18;

  const context = createMerchantProductFormPageContext(draft, 'quick');

  assert.equal(context.route, 'products');
  assert.equal(context.section, 'create');
  assert.equal(context.task, 'create_product');
  assert.equal(context.form?.mode, 'quick');
  assert.equal(context.form?.fields.name.status, 'filled');
  assert.equal(context.form?.fields.wholesalePrice.status, 'empty');
  assert.equal(context.form?.variants.count, 0);
  assert.deepEqual(context.form?.media, { imageCount: 0, videoCount: 0 });
  assert.doesNotMatch(JSON.stringify(context), /costPrice|mediaUrl|imageUrl/);
});

test('sanitizes only allow-listed, bounded product-create context fields', () => {
  const context = createMerchantProductFormPageContext(createMerchantProductDraft(), 'full');
  const sanitized = sanitizeMerchantCopilotPageContext(context);

  assert.deepEqual(sanitized, context);
  assert.equal(sanitized?.form?.mode, 'full');
  assert.equal(sanitizeMerchantCopilotPageContext({
    ...context,
    form: {
      ...context.form,
      fields: { ...context.form?.fields, costPrice: { status: 'filled', value: 18 } }
    }
  }), null);
  assert.equal(sanitizeMerchantCopilotPageContext({
    ...context,
    form: {
      ...context.form,
      fields: { name: { status: 'filled', value: 'x'.repeat(3_001) } }
    }
  }), null);
});

test('rejects malformed or oversized page context instead of forwarding it', () => {
  const context = createMerchantProductFormPageContext(createMerchantProductDraft(), 'quick');

  assert.equal(sanitizeMerchantCopilotPageContext({ ...context, task: 'delete_product' }), null);
  assert.equal(sanitizeMerchantCopilotPageContext({ ...context, route: 'unknown' }), null);
  assert.equal(sanitizeMerchantCopilotPageContext({
    ...context,
    selectedObjectId: 'x'.repeat(161)
  }), null);
});