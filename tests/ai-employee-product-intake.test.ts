import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';
import {
  detectSupplierSourceType,
  extractSupplierProductCandidates,
  parseSupplierCsv,
  parseSupplierProductCandidate
} from '../src/server/aiEmployeeProductIntake';

const candidate = {
  styleNo: 'R-101',
  name: 'Linen shirt',
  brand: 'RUDA',
  category: 'women',
  subCategory: 'shirts',
  season: '',
  fabric: 'linen',
  composition: '',
  description: '',
  wholesalePrice: 18.5,
  rrpPrice: null,
  moq: 6
};

function makeZip(files: Record<string, string>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;
  for (const [filename, value] of Object.entries(files)) {
    const name = Buffer.from(filename);
    const uncompressed = Buffer.from(value);
    const compressed = deflateRawSync(uncompressed);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(uncompressed.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localParts.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(uncompressed.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);
    localOffset += localHeader.length + name.length + compressed.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

test('recognizes only supported supplier document extensions and MIME types', () => {
  assert.equal(detectSupplierSourceType('catalog.jpg', 'image/jpeg'), 'image');
  assert.equal(detectSupplierSourceType('catalog.pdf', 'application/pdf'), 'pdf');
  assert.equal(detectSupplierSourceType('catalog.csv', 'text/csv'), 'csv');
  assert.equal(detectSupplierSourceType('catalog.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'xlsx');
  assert.equal(detectSupplierSourceType('catalog.pdf', 'text/plain'), null);
  assert.equal(detectSupplierSourceType('catalog.exe', 'application/pdf'), null);
});

test('parses quoted CSV cells and bounded rows', () => {
  assert.deepEqual(parseSupplierCsv('SKU,Name,Notes\r\n1,"Linen, shirt","said ""new"""\r\n2,Pants,'),
    [['SKU', 'Name', 'Notes'], ['1', 'Linen, shirt', 'said "new"'], ['2', 'Pants', '']]);
  assert.throws(() => parseSupplierCsv('a,"unterminated'), /AI_EMPLOYEE_IMPORT_CSV_INVALID/);
});

test('validates candidate fields and rejects additional data', () => {
  assert.deepEqual(parseSupplierProductCandidate(candidate), candidate);
  assert.throws(() => parseSupplierProductCandidate({ ...candidate, merchantId: 'other-tenant' }), /AI_EMPLOYEE_IMPORT_CANDIDATE_INVALID/);
  assert.throws(() => parseSupplierProductCandidate({ ...candidate, wholesalePrice: -1 }), /AI_EMPLOYEE_IMPORT_CANDIDATE_INVALID/);
});

test('uses only the local vision adapter for image extraction', async () => {
  const raw = JSON.stringify({ products: [candidate] });
  const products = await extractSupplierProductCandidates(
    'image',
    Buffer.from('image-bytes'),
    async () => { throw new Error('TEXT_MODEL_MUST_NOT_RUN_FOR_IMAGE'); },
    async (_prompt, system, image, format) => {
      assert.match(system, /不可信数据/);
      assert.deepEqual(image, Buffer.from('image-bytes'));
      assert.equal(format.type, 'object');
      return raw;
    }
  );
  assert.deepEqual(products, [candidate]);
});

test('sends parsed supplier CSV to the local text extractor and rejects no-result output', async () => {
  const products = await extractSupplierProductCandidates(
    'csv',
    Buffer.from('Code,Product\nR-101,Linen shirt'),
    async prompt => {
      assert.match(prompt, /R-101/);
      return JSON.stringify({ products: [candidate] });
    }
  );
  assert.deepEqual(products, [candidate]);

  await assert.rejects(
    extractSupplierProductCandidates('csv', Buffer.from('Code,Product\n'), async () => '{"products":[]}'),
    /AI_EMPLOYEE_IMPORT_NO_PRODUCTS_FOUND/
  );
});

test('extracts bounded worksheet text from an XLSX archive and rejects malformed archives', async () => {
  const workbook = makeZip({
    'xl/sharedStrings.xml': '<sst><si><t>Style</t></si><si><t>R-101</t></si><si><t>Product</t></si><si><t>Linen shirt</t></si></sst>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="s"><v>3</v></c></row></sheetData></worksheet>'
  });
  const products = await extractSupplierProductCandidates(
    'xlsx',
    workbook,
    async prompt => {
      assert.match(prompt, /R-101/);
      assert.match(prompt, /Linen shirt/);
      return JSON.stringify({ products: [candidate] });
    }
  );
  assert.deepEqual(products, [candidate]);
  await assert.rejects(
    extractSupplierProductCandidates('xlsx', Buffer.from('PK'), async () => '{"products":[]}'),
    /AI_EMPLOYEE_IMPORT_XLSX_INVALID/
  );
});
