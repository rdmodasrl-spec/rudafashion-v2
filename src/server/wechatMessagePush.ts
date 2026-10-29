import { createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';

export interface WechatMessagePushConfig {
  token: string;
  appId: string;
  encryptionMode: string;
  encodingAesKey?: string;
}

export type WechatMessagePushVerification =
  | { valid: true; response: string }
  | { valid: false; statusCode: 400 | 403 | 503; error: string };

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function isValidWechatMessagePushConfig(config: WechatMessagePushConfig): boolean {
  return /^[A-Za-z0-9]{3,32}$/.test(config.token)
    && Boolean(config.appId)
    && ['plaintext', 'compatibility', 'secure'].includes(config.encryptionMode)
    && (config.encryptionMode !== 'secure' || Boolean(config.encodingAesKey))
    && (!config.encodingAesKey || /^[A-Za-z0-9+/]{43}$/.test(config.encodingAesKey));
}

export function isValidWechatMessagePushSignature(
  token: string,
  timestamp: string,
  nonce: string,
  signature: string,
  encryptedMessage?: string
): boolean {
  if (!token || !timestamp || !nonce || !/^[a-f\d]{40}$/i.test(signature)) return false;
  const values = [token, timestamp, nonce, ...(encryptedMessage ? [encryptedMessage] : [])].sort();
  const expected = createHash('sha1').update(values.join('')).digest('hex');
  return constantTimeStringEqual(expected, signature.toLowerCase());
}

export function decryptWechatMessage(
  encryptedMessage: string,
  encodingAesKey: string,
  appId: string
): string {
  let key: Buffer;
  let ciphertext: Buffer;
  try {
    key = Buffer.from(`${encodingAesKey}=`, 'base64');
    ciphertext = Buffer.from(encryptedMessage, 'base64');
  } catch {
    throw new Error('WECHAT_MESSAGE_ENCRYPTION_INVALID');
  }
  if (key.length !== 32 || ciphertext.length === 0 || ciphertext.length % 16 !== 0) {
    throw new Error('WECHAT_MESSAGE_ENCRYPTION_INVALID');
  }

  const decipher = createDecipheriv('aes-256-cbc', key, key.subarray(0, 16));
  decipher.setAutoPadding(false);
  const padded = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const paddingLength = padded[padded.length - 1];
  if (!paddingLength || paddingLength > 32 || paddingLength > padded.length) {
    throw new Error('WECHAT_MESSAGE_ENCRYPTION_INVALID');
  }
  for (let index = padded.length - paddingLength; index < padded.length; index += 1) {
    if (padded[index] !== paddingLength) throw new Error('WECHAT_MESSAGE_ENCRYPTION_INVALID');
  }

  const plaintext = padded.subarray(0, padded.length - paddingLength);
  if (plaintext.length < 20) throw new Error('WECHAT_MESSAGE_ENCRYPTION_INVALID');
  const messageLength = plaintext.readUInt32BE(16);
  const messageEnd = 20 + messageLength;
  if (messageEnd > plaintext.length) throw new Error('WECHAT_MESSAGE_ENCRYPTION_INVALID');

  const message = plaintext.subarray(20, messageEnd);
  const messageAppId = plaintext.subarray(messageEnd).toString('utf8');
  if (!constantTimeStringEqual(messageAppId, appId)) {
    throw new Error('WECHAT_MESSAGE_APP_ID_MISMATCH');
  }
  return message.toString('utf8');
}

export function extractWechatEncryptedMessage(body: string): string | undefined {
  const trimmed = body.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('{')) {
    try {
      const value: unknown = JSON.parse(trimmed);
      if (!value || typeof value !== 'object') return undefined;
      const record = value as Record<string, unknown>;
      const encrypted = record.Encrypt ?? record.encrypt;
      return typeof encrypted === 'string' && encrypted ? encrypted : undefined;
    } catch {
      return undefined;
    }
  }

  const match = trimmed.match(/<Encrypt(?:\s[^>]*)?>(?:\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*|([\s\S]*?))<\/Encrypt\s*>/i);
  const encrypted = (match?.[1] ?? match?.[2] ?? '').trim();
  return encrypted || undefined;
}

export function verifyWechatMessagePushRequest(
  config: WechatMessagePushConfig,
  input: {
    timestamp: string;
    nonce: string;
    signature: string;
    messageSignature?: string;
    echo?: string;
    body?: string;
  }
): WechatMessagePushVerification {
  if (!isValidWechatMessagePushConfig(config)) {
    return { valid: false, statusCode: 503, error: 'WECHAT_MESSAGE_PUSH_NOT_CONFIGURED' };
  }
  if (!input.timestamp || input.timestamp.length > 32 || !input.nonce || input.nonce.length > 128) {
    return { valid: false, statusCode: 400, error: 'WECHAT_MESSAGE_PUSH_PARAMETERS_INVALID' };
  }

  const encryptedMessage = input.echo
    ? input.messageSignature ? input.echo : undefined
    : extractWechatEncryptedMessage(input.body || '');
  const encryptedRequest = Boolean(encryptedMessage);
  if (config.encryptionMode === 'secure' && !encryptedRequest) {
    return { valid: false, statusCode: 403, error: 'WECHAT_MESSAGE_PUSH_ENCRYPTION_REQUIRED' };
  }
  if (config.encryptionMode === 'plaintext' && encryptedRequest) {
    return { valid: false, statusCode: 403, error: 'WECHAT_MESSAGE_PUSH_ENCRYPTION_NOT_CONFIGURED' };
  }

  const signature = encryptedRequest ? input.messageSignature || '' : input.signature;
  if (!isValidWechatMessagePushSignature(
    config.token,
    input.timestamp,
    input.nonce,
    signature,
    encryptedMessage
  )) {
    return { valid: false, statusCode: 403, error: 'WECHAT_MESSAGE_PUSH_SIGNATURE_INVALID' };
  }

  if (!encryptedRequest) {
    return { valid: true, response: input.echo === undefined ? 'success' : input.echo };
  }
  if (!config.encodingAesKey) {
    return { valid: false, statusCode: 503, error: 'WECHAT_MESSAGE_PUSH_AES_KEY_NOT_CONFIGURED' };
  }
  try {
    const decryptedMessage = decryptWechatMessage(encryptedMessage!, config.encodingAesKey, config.appId);
    return {
      valid: true,
      response: input.echo === undefined ? 'success' : decryptedMessage
    };
  } catch {
    return { valid: false, statusCode: 403, error: 'WECHAT_MESSAGE_PUSH_DECRYPT_FAILED' };
  }
}
