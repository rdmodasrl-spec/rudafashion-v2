import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAppStoreInstallationError,
  isAppStoreNativeRuntimeCompatible,
  parseAppStoreStringArray,
  transitionAppStoreInstallation
} from '../src/server/appStoreValidation';

test('App Store metadata accepts only valid JSON string arrays', () => {
  assert.deepEqual(parseAppStoreStringArray('["domain.manage"]'), ['domain.manage']);
  assert.deepEqual(parseAppStoreStringArray('[]'), []);
  assert.equal(parseAppStoreStringArray('{bad json'), null);
  assert.equal(parseAppStoreStringArray('{"permission":"domain.manage"}'), null);
  assert.equal(parseAppStoreStringArray('["domain.manage",1]'), null);
  assert.equal(parseAppStoreStringArray(undefined), null);
});

test('runtime availability includes the registered app version', () => {
  assert.equal(isAppStoreNativeRuntimeCompatible('ruda-business-email', '1.0.0'), true);
  assert.equal(isAppStoreNativeRuntimeCompatible('ruda-business-email', '2.0.0'), false);
  assert.equal(isAppStoreNativeRuntimeCompatible('other-app', '1.0.0'), false);
});

test('only published free apps can create an installation record without checkout', () => {
  assert.equal(
    getAppStoreInstallationError({
      appId: 'ruda-business-email',
      status: 'published',
      pricingType: 'free',
      version: '1.0.0'
    }, true),
    null
  );
  assert.equal(
    getAppStoreInstallationError({ status: 'published', pricingType: 'subscription' }),
    'APP_STORE_PURCHASE_REQUIRED'
  );
  assert.equal(
    getAppStoreInstallationError({ status: 'published', pricingType: 'one-time' }),
    'APP_STORE_PURCHASE_REQUIRED'
  );
});

test('missing and unpublished apps cannot be installed', () => {
  assert.equal(getAppStoreInstallationError(null), 'APP_STORE_APP_NOT_AVAILABLE');
  assert.equal(
    getAppStoreInstallationError({ status: 'draft', pricingType: 'free' }),
    'APP_STORE_APP_NOT_AVAILABLE'
  );
  assert.equal(
    getAppStoreInstallationError({ status: 'hidden', pricingType: 'free' }),
    'APP_STORE_APP_NOT_AVAILABLE'
  );
});

test('only registered native runtimes with a compatible version can activate', () => {
  assert.equal(
    getAppStoreInstallationError({
      appId: 'third-party-plugin',
      status: 'published',
      pricingType: 'free',
      version: '1.0.0'
    }, true),
    'APP_STORE_RUNTIME_UNAVAILABLE'
  );
  assert.equal(
    getAppStoreInstallationError({
      appId: 'ruda-business-email',
      status: 'published',
      pricingType: 'free',
      version: '2.0.0'
    }, true),
    'APP_STORE_RUNTIME_VERSION_UNSUPPORTED'
  );
});

test('installation lifecycle distinguishes installed, active, and disabled states', () => {
  assert.equal(transitionAppStoreInstallation('installed', 'enable'), 'active');
  assert.equal(transitionAppStoreInstallation('active', 'enable'), 'active');
  assert.equal(transitionAppStoreInstallation('active', 'disable'), 'disabled');
  assert.equal(transitionAppStoreInstallation('disabled', 'disable'), 'disabled');
  assert.equal(transitionAppStoreInstallation('installed', 'disable'), 'disabled');
  assert.equal(transitionAppStoreInstallation('disabled', 'enable'), 'active');
  assert.equal(transitionAppStoreInstallation('failed', 'enable'), null);
});