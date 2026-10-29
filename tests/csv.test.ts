import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCsvRecords } from '../src/utils/csv';

test('parses quoted commas, escaped quotes, and embedded newlines', () => {
  assert.deepEqual(parseCsvRecords('Company,Address,Note\r\nBoutique,"Milan, Italy","Line one\nLine ""two"""'), [
    ['Company', 'Address', 'Note'],
    ['Boutique', 'Milan, Italy', 'Line one\nLine "two"']
  ]);
});

test('parses BOM, CRLF rows, and trailing empty cells', () => {
  assert.deepEqual(parseCsvRecords('\uFEFFCompany,Email,\r\nBoutique,buyer@example.com,'), [
    ['Company', 'Email', ''],
    ['Boutique', 'buyer@example.com', '']
  ]);
});

test('rejects unclosed quoted fields', () => {
  assert.throws(() => parseCsvRecords('Company,Address\nBoutique,"Milan'), {
    message: 'CSV_UNCLOSED_QUOTE'
  });
});
