const MAX_ATTACHMENT_COUNT = 4;
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_LENGTH = 16_000;

export type MerchantAssistantImageAttachment = {
  name: string;
  mime: string;
  bytes: Buffer;
};

export type MerchantAssistantDocumentAttachment = {
  name: string;
  text: string;
};

export type MerchantAssistantAttachments = {
  images: MerchantAssistantImageAttachment[];
  documents: MerchantAssistantDocumentAttachment[];
};

function invalidAttachment(): never {
  throw new Error('MODAGPT_ATTACHMENT_INVALID');
}

function readDataUrl(value: unknown): { mime: string; bytes: Buffer } {
  if (typeof value !== 'string' || value.length > MAX_ATTACHMENT_BYTES * 1.4) return invalidAttachment();
  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) return invalidAttachment();
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES || bytes.toString('base64') !== match[2]) {
    return invalidAttachment();
  }
  return { mime: match[1].toLowerCase(), bytes };
}

function hasImageSignature(mime: string, bytes: Buffer): boolean {
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return mime === 'image/webp'
    && bytes.length >= 12
    && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP';
}

function safeAttachmentName(value: unknown): string {
  if (
    typeof value !== 'string'
    || !value.trim()
    || value.length > 160
    || /[\\/\u0000-\u001f\u007f]/.test(value)
  ) {
    return invalidAttachment();
  }
  return value.trim();
}

function extractTextDocument(mime: string, bytes: Buffer, extension: string): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return invalidAttachment();
  }
  if (mime !== 'text/plain' && mime !== 'text/markdown' && mime !== 'text/csv' && mime !== 'application/vnd.ms-excel') {
    return invalidAttachment();
  }
  if (!['.txt', '.md', '.csv'].includes(extension) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    return invalidAttachment();
  }
  return text.trim().slice(0, MAX_EXTRACTED_TEXT_LENGTH);
}

async function extractPdfText(bytes: Buffer): Promise<string> {
  if (bytes.length < 5 || bytes.toString('ascii', 0, 5) !== '%PDF-') return invalidAttachment();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
  const document = await loadingTask.promise;
  try {
    if (document.numPages > 20) throw new Error('MODAGPT_ATTACHMENT_TOO_MANY_PAGES');
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const text = await page.getTextContent();
      pages.push(text.items.flatMap(item =>
        'str' in item && typeof item.str === 'string' ? [item.str] : []
      ).join(' '));
    }
    const extracted = pages.join('\n').trim().slice(0, MAX_EXTRACTED_TEXT_LENGTH);
    if (!extracted) throw new Error('MODAGPT_ATTACHMENT_NO_TEXT');
    return extracted;
  } finally {
    await loadingTask.destroy();
  }
}

export async function parseMerchantAssistantAttachments(input: unknown): Promise<MerchantAssistantAttachments> {
  if (input === undefined) return { images: [], documents: [] };
  if (!Array.isArray(input) || input.length > MAX_ATTACHMENT_COUNT) return invalidAttachment();

  const images: MerchantAssistantImageAttachment[] = [];
  const documents: MerchantAssistantDocumentAttachment[] = [];
  let totalBytes = 0;
  let extractedTextLength = 0;

  for (const item of input) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return invalidAttachment();
    const attachment = item as Record<string, unknown>;
    const name = safeAttachmentName(attachment.name);
    const extension = name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
    const { mime, bytes } = readDataUrl(attachment.dataUrl);
    totalBytes += bytes.length;
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) return invalidAttachment();

    if (mime.startsWith('image/')) {
      const extensionMatchesMime = mime === 'image/jpeg'
        ? ['.jpg', '.jpeg'].includes(extension)
        : mime === 'image/png'
          ? extension === '.png'
          : mime === 'image/webp' && extension === '.webp';
      if (!extensionMatchesMime || !hasImageSignature(mime, bytes) || images.length >= 3) return invalidAttachment();
      images.push({ name, mime, bytes });
      continue;
    }

    if (extension === '.pdf' && mime === 'application/pdf') {
      const text = await extractPdfText(bytes);
      extractedTextLength += text.length;
      documents.push({ name, text });
    } else {
      const text = extractTextDocument(mime, bytes, extension);
      if (!text) throw new Error('MODAGPT_ATTACHMENT_NO_TEXT');
      extractedTextLength += text.length;
      documents.push({ name, text });
    }

    if (documents.length > 2 || extractedTextLength > MAX_EXTRACTED_TEXT_LENGTH) {
      return invalidAttachment();
    }
  }
  return { images, documents };
}
