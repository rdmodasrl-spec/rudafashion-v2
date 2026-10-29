import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const schema = readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8');
const migration = readFileSync(
  path.join(root, 'prisma', 'migrations', '20261020130000_merchant_counterparties', 'migration.sql'),
  'utf8'
);

test('counterparty migration backfills legacy roles without matching or merging names', () => {
  assert.match(schema, /model MerchantCounterparty \{[\s\S]*?merchantId\s+String[\s\S]*?companyName\s+String/);
  assert.match(migration, /INSERT INTO "MerchantCounterparty"[\s\S]*?FROM "MerchantCustomerLink"/);
  assert.match(migration, /md5\('merchant-customer-link:' \|\| link\."id"\)/);
  assert.match(migration, /md5\('merchant-supplier:' \|\| supplier\."id"\)/);
  assert.doesNotMatch(migration, /\bDROP TABLE\b|\bDELETE FROM\b|ILIKE|LOWER\s*\(\s*.*companyName/i);
  assert.doesNotMatch(migration, /UPDATE "Order"|UPDATE "MerchantPurchaseOrder"/);
});

test('counterparty foreign keys enforce merchant scope and allow separate role status', () => {
  assert.match(migration, /FOREIGN KEY \("counterpartyId", "merchantId"\)[\s\S]*?REFERENCES "MerchantCounterparty"\("id", "merchantId"\)/);
  assert.match(migration, /ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active'/);
  assert.match(schema, /model MerchantCustomerLink \{[\s\S]*?status\s+String\s+@default\("active"\)[\s\S]*?counterparty\s+MerchantCounterparty\?/);
  assert.match(schema, /model Supplier \{[\s\S]*?status\s+String\s+@default\("active"\)[\s\S]*?counterparty\s+MerchantCounterparty\?/);
});

test('legacy sales and procurement identities are backfilled without changing transaction records', () => {
  assert.match(migration, /FROM "Order"[\s\S]*?UNION[\s\S]*?FROM "VaultAccessRequest"/);
  assert.match(migration, /FROM "Supplier" AS supplier/);
  assert.doesNotMatch(migration, /ALTER TABLE "(Order|MerchantPurchaseOrder)"/);
});
