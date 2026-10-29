import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildMerchantFeatureFlagPayload,
  buildPublicFeatureFlagPayload,
  createFeatureFlagStore,
  FASHION_ENABLED_KEY,
  FeatureFlagError,
  isMerchantMiniprogramRequest,
  MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY,
  MODAUI_ENABLED_KEY
} from '../src/server/featureFlags';

async function createTempStore(options: { reloadIntervalMs?: number } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ruda-feature-flags-'));
  const filePath = path.join(directory, 'feature-flags.json');
  return {
    filePath,
    store: createFeatureFlagStore({ filePath, reloadIntervalMs: options.reloadIntervalMs ?? 0 })
  };
}

test('merchant miniprogram ModaUI flag defaults to closed when no config exists', async () => {
  const { store } = await createTempStore();
  await store.refresh();
  const snapshot = store.list()[0];

  assert.equal(snapshot.key, MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY);
  assert.equal(snapshot.name, 'ModaUI 智能创作');
  assert.equal(snapshot.terminal, '商家小程序');
  assert.equal(snapshot.enabled, false);
  assert.equal(snapshot.updatedAt, null);
  assert.equal(store.isEnabled(MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY), false);
  assert.equal(store.getLoadError(), null);
});

test('updating a flag persists to disk and survives a fresh server process', async () => {
  const { filePath, store } = await createTempStore();
  const result = await store.set({
    key: MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY,
    enabled: true,
    actor: 'superadmin'
  });

  assert.equal(result.previous.enabled, false);
  assert.equal(result.next.enabled, true);
  assert.equal(result.next.updatedBy, 'superadmin');

  const persisted = JSON.parse(await readFile(filePath, 'utf8')) as {
    flags: Record<string, { enabled: boolean; updatedBy: string }>;
  };
  assert.equal(persisted.flags[MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY].enabled, true);
  assert.equal(persisted.flags[MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY].updatedBy, 'superadmin');

  const restarted = createFeatureFlagStore({ filePath });
  await restarted.refresh();
  assert.equal(restarted.isEnabled(MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY), true);
  assert.equal(restarted.get(MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY).updatedBy, 'superadmin');
});

test('unknown keys are rejected instead of being written', async () => {
  const { store } = await createTempStore();
  await assert.rejects(
    () => store.set({ key: 'unknown_flag', enabled: true, actor: 'superadmin' }),
    (error: unknown) => error instanceof FeatureFlagError && error.code === 'FEATURE_FLAG_UNKNOWN'
  );
});

test('stale expectedUpdatedAt is rejected as a version conflict', async () => {
  const { store } = await createTempStore();
  const initial = store.get(MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY);
  await store.set({ key: MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY, enabled: true, actor: 'superadmin' });

  await assert.rejects(
    () => store.set({
      key: MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY,
      enabled: false,
      actor: 'superadmin',
      expectedUpdatedAt: initial.updatedAt
    }),
    (error: unknown) => error instanceof FeatureFlagError && error.code === 'FEATURE_FLAG_VERSION_CONFLICT'
  );
  assert.equal(store.isEnabled(MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY), true);
});

test('corrupt config falls back to closed and reports the load error', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ruda-feature-flags-corrupt-'));
  const filePath = path.join(directory, 'feature-flags.json');
  await writeFile(filePath, '{ not json', 'utf8');
  const store = createFeatureFlagStore({ filePath, reloadIntervalMs: 0 });
  await store.refresh();

  assert.equal(store.isEnabled(MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY), false);
  assert.equal(store.getLoadError(), 'FEATURE_FLAG_FILE_CORRUPT');
});

test('external config changes are picked up on refresh', async () => {
  const { filePath, store } = await createTempStore({ reloadIntervalMs: 0 });
  const writer = createFeatureFlagStore({ filePath, reloadIntervalMs: 0 });
  await store.refresh();
  await writer.refresh();
  await writer.set({ key: MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY, enabled: true, actor: 'superadmin' });

  await store.refresh();
  assert.equal(store.isEnabled(MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY), true);
});

test('removing the config file returns to the closed default', async () => {
  const { filePath, store } = await createTempStore({ reloadIntervalMs: 0 });
  await store.set({ key: MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY, enabled: true, actor: 'superadmin' });
  assert.equal(store.isEnabled(MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY), true);

  await rm(filePath, { force: true });
  await store.refresh();

  assert.equal(store.isEnabled(MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY), false);
  assert.equal(store.getLoadError(), null);
});

test('merchant payload exposes merchant flag plus global switches without the operator', async () => {
  const { store } = await createTempStore();
  await store.set({ key: MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY, enabled: true, actor: 'superadmin' });
  const payload = buildMerchantFeatureFlagPayload(store);

  assert.deepEqual(
    Object.keys(payload.flags).sort(),
    [FASHION_ENABLED_KEY, MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY, MODAUI_ENABLED_KEY].sort()
  );
  assert.equal(payload.flags[MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY], true);
  assert.equal(payload.flags[FASHION_ENABLED_KEY], true);
  assert.equal(payload.flags[MODAUI_ENABLED_KEY], true);
  assert.equal(JSON.stringify(payload).includes('superadmin'), false);
  assert.equal(typeof payload.version, 'string');
});

test('global module switches default to enabled and toggle independently', async () => {
  const { store } = await createTempStore();
  await store.refresh();

  assert.equal(store.isEnabled(FASHION_ENABLED_KEY), true);
  assert.equal(store.isEnabled(MODAUI_ENABLED_KEY), true);

  await store.set({ key: FASHION_ENABLED_KEY, enabled: false, actor: 'superadmin' });
  assert.equal(store.isEnabled(FASHION_ENABLED_KEY), false);
  assert.equal(store.isEnabled(MODAUI_ENABLED_KEY), true);

  await store.set({ key: MODAUI_ENABLED_KEY, enabled: false, actor: 'superadmin' });
  await store.set({ key: FASHION_ENABLED_KEY, enabled: true, actor: 'superadmin' });
  assert.equal(store.isEnabled(FASHION_ENABLED_KEY), true);
  assert.equal(store.isEnabled(MODAUI_ENABLED_KEY), false);
});

test('public payload exposes only the two global switches', async () => {
  const { store } = await createTempStore();
  await store.set({ key: FASHION_ENABLED_KEY, enabled: false, actor: 'superadmin' });
  const payload = buildPublicFeatureFlagPayload(store);

  assert.deepEqual(Object.keys(payload.flags).sort(), [FASHION_ENABLED_KEY, MODAUI_ENABLED_KEY].sort());
  assert.equal(payload.flags[FASHION_ENABLED_KEY], false);
  assert.equal(payload.flags[MODAUI_ENABLED_KEY], true);
  assert.equal(JSON.stringify(payload).includes('superadmin'), false);
});

test('corrupt flag file makes the public payload fail closed', async () => {
  const { filePath, store } = await createTempStore();
  await writeFile(filePath, '{not-json', 'utf8');
  await store.refresh();

  assert.equal(store.getLoadError(), 'FEATURE_FLAG_FILE_CORRUPT');
  const payload = buildPublicFeatureFlagPayload(store);
  assert.equal(payload.flags[FASHION_ENABLED_KEY], false);
  assert.equal(payload.flags[MODAUI_ENABLED_KEY], false);
});

test('only the merchant mini program client header is treated as mini program traffic', () => {
  const withHeader = (value?: string) => ({
    get(name: string) {
      return name.toLowerCase() === 'x-ruda-client' ? value : undefined;
    }
  });

  assert.equal(isMerchantMiniprogramRequest(withHeader('merchant-miniprogram')), true);
  assert.equal(isMerchantMiniprogramRequest(withHeader('Merchant-MiniProgram ')), true);
  assert.equal(isMerchantMiniprogramRequest(withHeader('merchant-admin-web')), false);
  assert.equal(isMerchantMiniprogramRequest(withHeader(undefined)), false);
  assert.equal(isMerchantMiniprogramRequest({ get() { throw new Error('no headers'); } }), false);
});
