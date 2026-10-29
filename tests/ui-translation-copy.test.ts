import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { getUiCopyId, isUiTranslationText } from '../src/i18n/translations';
import { UI_COPY_CATALOG } from '../src/i18n/uiCopyCatalog';
import {
  parseUiCopyInputs,
  preservesUiCopyPlaceholders
} from '../src/server/uiTranslations';

const makeCopy = (zh: string, it: string) => ({
  id: getUiCopyId(zh, it),
  zh,
  it
});
const approvedCopy = UI_COPY_CATALOG.find(copy => copy.zh === '保存' && copy.it === 'Salva')
  || UI_COPY_CATALOG[0]!;

function listTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listTsxFiles(path);
    return entry.isFile() && path.endsWith('.tsx') ? [path] : [];
  });
}

function getStaticCopyArgument(node: ts.Expression | undefined): string | null {
  if (node && ts.isStringLiteral(node)) return node.text;
  if (node && ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

test('UI copy catalog has unique IDs and covers all literal localization calls', () => {
  const byPair = new Set(UI_COPY_CATALOG.map(copy => `${copy.zh}\u0000${copy.it}`));
  const byId = new Set(UI_COPY_CATALOG.map(copy => copy.id));
  assert.equal(byPair.size, UI_COPY_CATALOG.length);
  const duplicateIds = UI_COPY_CATALOG.filter((copy, index, copies) =>
    copies.some((other, otherIndex) => otherIndex !== index && other.id === copy.id)
  );
  if (duplicateIds.length > 0) {
    assert.fail(`Duplicate UI copy IDs: ${JSON.stringify(duplicateIds.map(({ id, zh, it }) => ({ id, zh, it })))}`);
  }
  assert.equal(byId.size, UI_COPY_CATALOG.length);
  for (const copy of UI_COPY_CATALOG) {
    assert.equal(copy.id, getUiCopyId(copy.zh, copy.it));
  }

  const sourceFiles = listTsxFiles(join(process.cwd(), 'src/apps'));
  const catalog = new Set(UI_COPY_CATALOG.map(copy => `${copy.zh}\u0000${copy.it}`));
  const missing: string[] = [];
  for (const fileName of sourceFiles) {
    const source = ts.createSourceFile(fileName, readFileSync(fileName, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node)
        && ts.isIdentifier(node.expression)
        && (node.expression.text === 'localizeCopy' || node.expression.text === 'mobileText')
      ) {
        const zh = getStaticCopyArgument(node.arguments[0]);
        const it = getStaticCopyArgument(node.arguments[1]);
        if (zh !== null && it !== null && !catalog.has(`${zh}\u0000${it}`)) {
          const location = source.getLineAndCharacterOfPosition(node.getStart(source));
          missing.push(`${fileName}:${location.line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(missing, []);
});

test('UI copy identifiers are stable and include both source languages', () => {
  assert.equal(getUiCopyId('保存', 'Salva'), getUiCopyId('保存', 'Salva'));
  assert.notEqual(getUiCopyId('保存', 'Salva'), getUiCopyId('确认', 'Salva'));
  assert.notEqual(getUiCopyId('保存', 'Salva'), getUiCopyId('保存', 'Conferma'));
});

test('homepage country and merchant category labels are approved for dynamic localization', () => {
  const expected = [
    ['城市未填写', 'Città non specificata'],
    ['希腊', 'Grecia'],
    ['西班牙', 'Spagna'],
    ['法国', 'Francia'],
    ['意大利', 'Italia'],
    ['波兰', 'Polonia'],
    ['葡萄牙', 'Portogallo'],
    ['德国', 'Germania'],
    ['荷兰', 'Paesi Bassi'],
    ['比利时', 'Belgio'],
    ['奥地利', 'Austria'],
    ['瑞士', 'Svizzera'],
    ['英国', 'Regno Unito'],
    ['时尚行业', 'Settore moda'],
    ['品牌生产商', 'Partner showroom'],
    ['面向专业零售商的精选商品与现货服务。', 'Collezioni selezionate per rivenditori professionali.'],
    ['品牌/生产商', 'Brand / produttore'],
    ['生产厂家', 'Produttore'],
    ['设计工作室', 'Atelier'],
    ['批发商', 'Grossista'],
    ['分销商', 'Distributore'],
    ['精品店', 'Boutique']
  ];
  for (const [zh, it] of expected) {
    assert.ok(UI_COPY_CATALOG.some(copy => copy.zh === zh && copy.it === it), `${zh} / ${it}`);
  }
});

test('high-traffic UI copy uses short labels and concise descriptions', () => {
  const expected = [
    ['购物车为空。去商品目录选款，或载入已保存草稿。', 'Carrello vuoto. Sfoglia il catalogo o carica una bozza.'],
    ['浏览认证商家与批发系列。', 'Fornitori e collezioni B2B.'],
    ['连接意大利供应商与欧洲买家。', 'Fornitori italiani, buyer europei.'],
    ['采购意大利女装现货与配饰，直达欧洲买家。', 'Moda pronta e accessori italiani per buyer europei.'],
    ['定制与限定款需获授权后查看，包含要求、起订量和报价。', 'Modelli esclusivi su autorizzazione; requisiti, minimo e prezzo.']
  ];
  for (const [zh, it] of expected) {
    const entry = UI_COPY_CATALOG.find(copy => copy.zh === zh && copy.it === it);
    assert.ok(entry, `${zh} / ${it} is missing from the shared catalog`);
    assert.ok(zh.length <= 40, `${zh} is too long`);
    assert.ok(it.length <= 70, `${it} is too long`);
  }
});

test('fashion trend category labels are approved for dynamic localization', () => {
  const expected = [
    ['女装趋势', 'Moda donna'],
    ['男装趋势', 'Moda uomo'],
    ['鞋履趋势', 'Calzature'],
    ['包袋配饰', 'Borse e accessori'],
    ['面料与针织', 'Tessuti e maglieria'],
    ['秀场街拍', 'Sfilate e street style']
  ];
  for (const [zh, it] of expected) {
    assert.ok(UI_COPY_CATALOG.some(copy => copy.zh === zh && copy.it === it), `${zh} / ${it}`);
  }
});

test('UI copy translation requests accept only small, correctly identified batches', () => {
  assert.deepEqual(parseUiCopyInputs([approvedCopy]), [approvedCopy]);
  assert.equal(parseUiCopyInputs([]), null);
  assert.equal(parseUiCopyInputs(Array.from({ length: 25 }, (_, index) => makeCopy(`中文${index}`, `Italiano ${index}`))), null);
  assert.equal(parseUiCopyInputs([{ ...makeCopy('保存', 'Salva'), id: 'copy_invalid' }]), null);
  assert.equal(parseUiCopyInputs([makeCopy('中'.repeat(2001), 'Salva')]), null);
  assert.equal(parseUiCopyInputs(Array.from({ length: 11 }, (_, index) => makeCopy('中'.repeat(1000), `it${index}`.padEnd(1000, 'x')))), null);
  assert.equal(parseUiCopyInputs([makeCopy('任意攻击者文本', 'Testo arbitrario')]), null);
});

test('UI copy translation request deduplicates repeated messages', () => {
  const copy = approvedCopy;
  assert.deepEqual(parseUiCopyInputs([copy, copy]), [copy]);
});

test('non-Chinese machine translations reject Han text to prevent mixed-language UI', () => {
  assert.equal(isUiTranslationText('Elegante e pratico', 'fr', 1000), true);
  assert.equal(isUiTranslationText('Elegant 连衣裙', 'fr', 1000), false);
  assert.equal(isUiTranslationText('连衣裙', 'zh', 1000), true);
  assert.equal(isUiTranslationText('   ', 'de', 1000), false);
  assert.equal(isUiTranslationText('x'.repeat(11), 'de', 10), false);
});

test('template translations preserve dynamic placeholder tokens without sending values', () => {
  const copy = UI_COPY_CATALOG.find(entry => entry.zh.includes('{{RUDA_ARG_0}}') && entry.it.includes('{{RUDA_ARG_0}}'));
  assert.ok(copy);
  assert.ok(parseUiCopyInputs([copy]));
  assert.equal(preservesUiCopyPlaceholders(copy.it, 'Totale: {{RUDA_ARG_0}} articoli'), true);
  assert.equal(preservesUiCopyPlaceholders(copy.it, 'Totale: 12 articoli'), false);
  assert.equal(parseUiCopyInputs([{ ...copy, it: 'Nessun valore dinamico', id: getUiCopyId(copy.zh, 'Nessun valore dinamico') }]), null);
});
