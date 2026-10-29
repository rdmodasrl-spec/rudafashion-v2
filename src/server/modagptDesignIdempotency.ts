import crypto from 'node:crypto';

export type ModaGptDesignPayload = {
  title: string;
  prompt: string;
  category: string;
  image: Buffer;
};

export function parseModaGptDesignClientRequestId(value: unknown): string | null | undefined {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(value)) return undefined;
  return value;
}

export function hashModaGptDesignPayload(payload: ModaGptDesignPayload): string {
  return crypto.createHash('sha256')
    .update(JSON.stringify({
      title: payload.title,
      prompt: payload.prompt,
      category: payload.category
    }))
    .update('\0')
    .update(payload.image)
    .digest('hex');
}
