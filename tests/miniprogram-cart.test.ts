import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const cartSource = readFileSync(new URL('../miniprogram/utils/cart.js', import.meta.url), 'utf8');

function createCartHarness() {
  const storage = new Map<string, unknown>();
  const module = { exports: {} as Record<string, (...args: any[]) => any> };
  runInNewContext(cartSource, {
    module,
    exports: module.exports,
    wx: {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: unknown) => storage.set(key, value),
      removeStorageSync: (key: string) => storage.delete(key)
    }
  });
  return { cart: module.exports, storage };
}

const item = {
  productId: 'product-1',
  sku: 'sku-red-s',
  quantity: 2,
  productName: 'Jacket'
};

test('cart items persist by product and SKU and combine repeated adds', () => {
  const { cart } = createCartHarness();
  cart.addCartItem(item);
  const items = cart.addCartItem({ ...item, quantity: 3 });

  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 5);
  assert.equal(items[0].sku, 'sku-red-s');
});

test('cart updates and removes one SKU without changing another product variant', () => {
  const { cart } = createCartHarness();
  cart.addCartItem(item);
  cart.addCartItem({ ...item, sku: 'sku-blue-m', quantity: 1 });

  cart.updateCartQuantity(item.productId, item.sku, 4);
  let items = cart.readCart();
  assert.equal(items.find((entry: typeof item) => entry.sku === item.sku)?.quantity, 4);
  assert.equal(items.find((entry: typeof item) => entry.sku === 'sku-blue-m')?.quantity, 1);

  cart.removeCartItem(item.productId, item.sku);
  items = cart.readCart();
  assert.equal(items.length, 1);
  assert.equal(items[0].sku, 'sku-blue-m');
});

test('cart rejects malformed additions and clear removes persisted data', () => {
  const { cart, storage } = createCartHarness();
  assert.throws(() => cart.addCartItem({ ...item, quantity: 0 }), /CART_ITEM_INVALID/);
  cart.addCartItem(item);
  cart.clearCart();

  assert.equal(cart.readCart().length, 0);
  assert.equal(storage.has('ruda_mini_cart'), false);
});
