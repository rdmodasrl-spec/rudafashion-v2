import assert from 'node:assert/strict';
import test from 'node:test';
import { recordShare, shareOrCopy } from '../src/utils/share';

test('WeChat share copies the tracked share text and URL instead of opening native share', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  const clipboardWrites: string[] = [];
  let nativeShareCalled = false;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'https://ruda.fashion' } }
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      share: async () => { nativeShareCalled = true; },
      clipboard: { writeText: async (value: string) => { clipboardWrites.push(value); } }
    }
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    }
  });

  try {
    const result = await shareOrCopy({
      title: 'Showroom',
      text: 'Visit this showroom',
      path: '/it/showrooms/example',
      source: 'merchant-example'
    }, 'wechat');

    assert.equal(result, 'copied');
    assert.equal(nativeShareCalled, false);
    assert.equal(clipboardWrites.length, 1);
    assert.match(clipboardWrites[0], /^Visit this showroom\nhttps:\/\/ruda\.fashion\/it\/showrooms\/example\?/);
    assert.equal(JSON.parse(values.get('ruda_share_events') || '[]')[0].channel, 'wechat');
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('share tracking storage failures do not interrupt the share action', () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalConsoleError = console.error;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => { throw new Error('STORAGE_BLOCKED'); },
      setItem: () => { throw new Error('STORAGE_BLOCKED'); }
    }
  });
  console.error = () => {};

  try {
    assert.doesNotThrow(() => recordShare('merchant-example', 'wechat'));
  } finally {
    console.error = originalConsoleError;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('legacy clipboard fallback reports failure instead of claiming a copied link', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let removed = false;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'https://ruda.fashion' } }
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: undefined }
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => ({
        value: '',
        style: {},
        setAttribute: () => {},
        select: () => {},
        remove: () => { removed = true; }
      }),
      body: { appendChild: () => {} },
      execCommand: () => false
    }
  });

  try {
    await assert.rejects(
      shareOrCopy({ title: 'Showroom', text: 'Visit this showroom' }, 'wechat'),
      { message: 'SHARE_COPY_FAILED' }
    );
    assert.equal(removed, true);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
