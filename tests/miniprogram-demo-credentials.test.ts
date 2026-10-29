import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMiniProgramDemoCredentials,
  MINI_PROGRAM_DEMO_ACCOUNTS,
  PUBLIC_DEMO_MERCHANT_MARKER
} from '../src/server/miniprogramDemo';

const isolatedDemoMerchant = {
  id: 'ruda-demo-merchant-03',
  code: 'RUDA-DEMO-03',
  storeSlug: 'ruda-demo-03',
  industrySource: 'ADMIN',
  settings: JSON.stringify({ rudaDemoSeed: PUBLIC_DEMO_MERCHANT_MARKER }),
  storefrontSeoTitle: 'RUDA DEMO · Atelier Alba'
};

test('demo credentials stay disabled unless explicitly enabled with a marked demo merchant', () => {
  assert.deepEqual(getMiniProgramDemoCredentials(false, 'long-demo-password', isolatedDemoMerchant), {
    enabled: false
  });
  assert.deepEqual(getMiniProgramDemoCredentials(true, 'short', isolatedDemoMerchant), {
    enabled: false
  });
  assert.deepEqual(getMiniProgramDemoCredentials(true, 'long-demo-password', {
    ...isolatedDemoMerchant,
    id: 'real-merchant'
  }), { enabled: false });
  assert.deepEqual(getMiniProgramDemoCredentials(true, 'long-demo-password', null), {
    enabled: false
  });
});

test('enabled demo credentials expose only the isolated demo account set', () => {
  const response = getMiniProgramDemoCredentials(true, 'long-demo-password', isolatedDemoMerchant);
  assert.deepEqual(response, {
    enabled: true,
    password: 'long-demo-password',
    partnerUrl: 'https://modaui.com/partner',
    accounts: [
      { type: 'merchant', ...MINI_PROGRAM_DEMO_ACCOUNTS.merchant },
      { type: 'employee', ...MINI_PROGRAM_DEMO_ACCOUNTS.employee },
      { type: 'partner', ...MINI_PROGRAM_DEMO_ACCOUNTS.partner }
    ]
  });
});
