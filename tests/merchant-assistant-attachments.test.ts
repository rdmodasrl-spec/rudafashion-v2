import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMerchantAssistantAttachments } from '../src/server/merchantAssistantAttachments';

function attachment(name: string, mime: string, contents: Buffer) {
  return { name, dataUrl: `data:${mime};base64,${contents.toString('base64')}` };
}

test('accepts no attachments and extracts bounded UTF-8 text files', async () => {
  assert.deepEqual(await parseMerchantAssistantAttachments(undefined), { images: [], documents: [] });
  assert.deepEqual(
    await parseMerchantAssistantAttachments([attachment('brief.txt', 'text/plain', Buffer.from('Linen jacket, spring palette.'))]),
    {
      images: [],
      documents: [{ name: 'brief.txt', text: 'Linen jacket, spring palette.' }]
    }
  );
});

test('accepts image bytes only when the MIME type matches the image signature', async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const result = await parseMerchantAssistantAttachments([attachment('look.png', 'image/png', png)]);
  assert.equal(result.images[0]?.name, 'look.png');
  assert.deepEqual(result.images[0]?.bytes, png);
  await assert.rejects(
    parseMerchantAssistantAttachments([attachment('look.jpg', 'image/jpeg', png)]),
    /MODAGPT_ATTACHMENT_INVALID/
  );
});

test('rejects unsupported document types, invalid file names, and oversized attachment batches', async () => {
  await assert.rejects(
    parseMerchantAssistantAttachments([attachment('catalog.xlsx', 'text/plain', Buffer.from('SKU,Name'))]),
    /MODAGPT_ATTACHMENT_INVALID/
  );
  await assert.rejects(
    parseMerchantAssistantAttachments([attachment('../brief.txt', 'text/plain', Buffer.from('text'))]),
    /MODAGPT_ATTACHMENT_INVALID/
  );
  await assert.rejects(
    parseMerchantAssistantAttachments(Array.from({ length: 5 }, (_, index) =>
      attachment(`${index}.txt`, 'text/plain', Buffer.from('text'))
    )),
    /MODAGPT_ATTACHMENT_INVALID/
  );
});
