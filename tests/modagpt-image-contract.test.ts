import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFashionDesignConceptPrompt,
  buildModelStudioPrompt,
  maximumModaGptImagePromptLength
} from '../src/shared/modagptImageContract';
import {
  buildModaGptStudioImageEditPrompt as buildServerModaGptStudioImageEditPrompt,
  parseModaGptImageRequest,
  resolveModaGptStudioImagePolicy
} from '../src/server/modagptEntitlements';

test('model studio prompts stay within the image API limit', () => {
  const prompt = buildModelStudioPrompt('春夏系列'.repeat(500), 2, 'three-quarter view');

  assert.ok(prompt.length <= maximumModaGptImagePromptLength);
  assert.ok(prompt.startsWith('Create a commercial fashion image from this brief: 春夏系列'));
  assert.ok(prompt.endsWith('Do not add logos, text, or watermarks.'));
  assert.deepEqual(parseModaGptImageRequest({ task: 'imageGeneration', prompt }), {
    task: 'imageGeneration',
    prompt
  });
  assert.equal(parseModaGptImageRequest({
    task: 'imageGeneration',
    prompt: `${prompt}x`
  }), null);
});

test('model studio prompt truncation does not split a Unicode character', () => {
  const prompt = buildModelStudioPrompt('🧵'.repeat(500), 1, 'front view');

  assert.ok(prompt.length <= maximumModaGptImagePromptLength);
  assert.ok(!/[\uD800-\uDBFF]$/.test(prompt));
  assert.ok(!/^[\uDC00-\uDFFF]/.test(prompt));
});

test('model studio prompt rejects invalid view metadata', () => {
  assert.throws(() => buildModelStudioPrompt('brief', 0, 'front view'), {
    message: 'MODAGPT_MODEL_STUDIO_PROMPT_INVALID'
  });
  assert.throws(() => buildModelStudioPrompt('brief', 1, ' '), {
    message: 'MODAGPT_MODEL_STUDIO_PROMPT_INVALID'
  });
});

test('fashion design concepts use distinct directions and stay within the image API limit', () => {
  const brief = '春夏通勤女装，海盐蓝棉麻，宽松廓形，加入不对称门襟。'.repeat(100);
  const concepts = [1, 2, 3, 4].map(index => buildFashionDesignConceptPrompt(brief, index));
  const emojiPrompt = buildFashionDesignConceptPrompt('🧵'.repeat(500), 1);

  assert.equal(new Set(concepts).size, concepts.length);
  for (const prompt of concepts) {
    assert.ok(prompt.length <= maximumModaGptImagePromptLength);
    assert.ok(prompt.includes('Design brief:'));
    assert.ok(prompt.includes('do not invent fiber-content claims'));
  }
  assert.ok(emojiPrompt.length <= maximumModaGptImagePromptLength);
  assert.ok(!/[\uD800-\uDBFF]$/.test(emojiPrompt));
  assert.ok(concepts[0].includes('commercially wearable'));
  assert.ok(concepts[1].includes('different silhouette'));
});

test('fashion design prompt rejects empty briefs and invalid concept numbers', () => {
  assert.throws(
    () => buildFashionDesignConceptPrompt(' ', 1),
    { message: 'MODAGPT_FASHION_DESIGN_PROMPT_INVALID' }
  );
  assert.throws(
    () => buildFashionDesignConceptPrompt('A coat', 5),
    { message: 'MODAGPT_FASHION_DESIGN_PROMPT_INVALID' }
  );
});

test('image edit accepts only a bounded inline reference image and known request fields', () => {
  const image = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64')}`;
  assert.deepEqual(parseModaGptImageRequest({ task: 'imageEdit', prompt: 'Replace the background', referenceImage: image }), {
    task: 'imageEdit',
    prompt: 'Replace the background',
    referenceImage: image
  });
  assert.equal(parseModaGptImageRequest({
    task: 'imageEdit',
    prompt: 'Edit',
    referenceImage: image,
    imageUrl: 'https://example.com/image.png'
  }), null);
  assert.equal(parseModaGptImageRequest({
    task: 'imageEdit',
    prompt: 'Edit',
    referenceImage: 'https://example.com/image.png'
  }), null);
});

test('image edit policy is industry-scoped and preserves source identity', () => {
  const restaurantPolicy = resolveModaGptStudioImagePolicy('restaurant_ordering', 'imageEdit');
  const leatherPolicy = resolveModaGptStudioImagePolicy('bags_wholesale', 'imageEdit');

  assert.ok(restaurantPolicy);
  assert.ok(leatherPolicy);
  assert.equal(resolveModaGptStudioImagePolicy('restaurant_ordering', 'tryOn'), null);
  const prompt = buildServerModaGptStudioImageEditPrompt(restaurantPolicy!, 'Change the background to a dining table');
  assert.match(prompt, /Edit the supplied product image/);
  assert.match(prompt, /Preserve the product identity/);
  assert.match(prompt, /Industry restaurant/);
  assert.match(prompt, /Change the background/);
});
