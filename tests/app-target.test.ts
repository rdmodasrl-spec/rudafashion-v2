import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { getRudaAppManifestPath, resolveRudaAppTarget, RUDA_APP_TARGETS } from '../src/apps/appTarget';

test('each application build target is unique and has one source entry', () => {
  assert.equal(new Set(RUDA_APP_TARGETS).size, RUDA_APP_TARGETS.length);

  for (const target of RUDA_APP_TARGETS) {
    assert.ok(
      existsSync(new URL(`../src/apps/${target}/main.tsx`, import.meta.url)),
      `${target} must have a source entry`
    );
  }
});

test('public web entry follows the viewport', () => {
  assert.equal(resolveRudaAppTarget({
    host: 'modaui.com',
    pathname: '/',
    isMobileViewport: false
  }), 'frontend-web');
  assert.equal(resolveRudaAppTarget({
    host: 'modaui.com',
    pathname: '/',
    isMobileViewport: true
  }), 'frontend-mobile');
});

test('merchant management uses separate desktop and mobile targets', () => {
  assert.equal(resolveRudaAppTarget({
    host: 'ruda.fashion',
    pathname: '/merchant',
    isMobileViewport: false
  }), 'merchant-admin-web');
  assert.equal(resolveRudaAppTarget({
    host: 'ruda.fashion',
    pathname: '/merchant',
    isMobileViewport: true
  }), 'merchant-admin-mobile');
});

test('merchant mobile portal hosts and employee routes remain mobile', () => {
  assert.equal(resolveRudaAppTarget({
    host: 'shop.ruda.fashion',
    pathname: '/',
    isMobileViewport: false
  }), 'merchant-admin-mobile');
  assert.equal(resolveRudaAppTarget({
    host: 'a.ruda.fashion',
    pathname: '/',
    isMobileViewport: false
  }), 'merchant-admin-mobile');
  assert.equal(resolveRudaAppTarget({
    host: 'ruda.fashion',
    pathname: '/employee/orders',
    isMobileViewport: false
  }), 'merchant-admin-mobile');
});

test('platform administration gets separate desktop and mobile targets', () => {
  assert.equal(resolveRudaAppTarget({
    host: 'admin.ruda.fashion',
    pathname: '/',
    isMobileViewport: false
  }), 'platform-admin-web');
  assert.equal(resolveRudaAppTarget({
    host: 'admin.ruda.fashion',
    pathname: '/',
    isMobileViewport: true
  }), 'platform-admin-mobile');
});

test('valid explicit targets support stable same-URL view switching', () => {
  assert.equal(resolveRudaAppTarget({
    host: 'ruda.fashion',
    pathname: '/merchant',
    isMobileViewport: false,
    requestedTarget: 'merchant-admin-mobile'
  }), 'merchant-admin-mobile');
  assert.equal(resolveRudaAppTarget({
    host: 'ruda.fashion',
    pathname: '/merchant',
    isMobileViewport: false,
    requestedTarget: 'unknown-app'
  }), 'merchant-admin-web');
});

test('employee mobile routes keep their employee PWA start URL', () => {
  assert.equal(getRudaAppManifestPath('merchant-admin-mobile', 'a.ruda.fashion', '/'), '/manifest.json');
  assert.equal(getRudaAppManifestPath('merchant-admin-mobile', 'ruda.fashion', '/employee'), '/apps/merchant-admin-mobile/employee-manifest.webmanifest');
});
