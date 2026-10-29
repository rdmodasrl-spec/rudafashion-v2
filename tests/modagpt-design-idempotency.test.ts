import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashModaGptDesignPayload,
  parseModaGptDesignClientRequestId
} from '../src/server/modagptDesignIdempotency';

const payload = {
  title: 'Spring coat',
  prompt: 'A blue spring coat',
  category: 'imageGeneration',
  image: Buffer.from('webp-image')
};

test('design save request IDs are optional but strictly bounded', () => {
  assert.equal(parseModaGptDesignClientRequestId(undefined), null);
  assert.equal(parseModaGptDesignClientRequestId('123e4567-e89b-12d3-a456-426614174000'), '123e4567-e89b-12d3-a456-426614174000');
  assert.equal(parseModaGptDesignClientRequestId('short'), undefined);
  assert.equal(parseModaGptDesignClientRequestId('x'.repeat(129)), undefined);
  assert.equal(parseModaGptDesignClientRequestId({}), undefined);
});

test('design save payload hashes are deterministic and detect changed content', () => {
  const originalHash = hashModaGptDesignPayload(payload);

  assert.equal(hashModaGptDesignPayload(payload), originalHash);
  assert.notEqual(hashModaGptDesignPayload({ ...payload, title: 'Changed title' }), originalHash);
  assert.notEqual(hashModaGptDesignPayload({ ...payload, prompt: 'Changed prompt' }), originalHash);
  assert.notEqual(hashModaGptDesignPayload({ ...payload, category: 'tryOn' }), originalHash);
  assert.notEqual(hashModaGptDesignPayload({ ...payload, image: Buffer.from('different-image') }), originalHash);
});
