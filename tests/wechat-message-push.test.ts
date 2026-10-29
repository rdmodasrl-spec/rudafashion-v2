import assert from 'node:assert/strict';
import { createCipheriv, createHash } from 'node:crypto';
import test from 'node:test';
import {
  extractWechatEncryptedMessage,
  isValidWechatMessagePushSignature,
  verifyWechatMessagePushRequest
} from '../src/server/wechatMessagePush';

const token = 'AAAAA';
const timestamp = '1714037059';
const nonce = '486452656';
const appId = 'wx18abf078e13f9f0a';

function signature(...values: string[]): string {
  return createHash('sha1').update(values.sort().join('')).digest('hex');
}

function encryptMessage(message: string, encodingAesKey: string, messageAppId = appId): string {
  const key = Buffer.from(`${encodingAesKey}=`, 'base64');
  const messageBytes = Buffer.from(message);
  const appIdBytes = Buffer.from(messageAppId);
  const plaintext = Buffer.alloc(16 + 4 + messageBytes.length + appIdBytes.length);
  plaintext.fill(0x5a, 0, 16);
  plaintext.writeUInt32BE(messageBytes.length, 16);
  messageBytes.copy(plaintext, 20);
  appIdBytes.copy(plaintext, 20 + messageBytes.length);

  const paddingLength = 32 - plaintext.length % 32;
  const padded = Buffer.concat([plaintext, Buffer.alloc(paddingLength, paddingLength)]);
  const cipher = createCipheriv('aes-256-cbc', key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded), cipher.final()]).toString('base64');
}

test('WeChat URL verification follows the documented SHA-1 signature and echoes echostr', () => {
  assert.equal(
    isValidWechatMessagePushSignature('AAAAA', '1714036504', '1514711492', 'f464b24fc39322e44b38aa78f5edd27bd1441696'),
    true
  );
  const result = verifyWechatMessagePushRequest({
    token,
    appId,
    encryptionMode: 'plaintext'
  }, {
    timestamp,
    nonce,
    signature: signature(token, timestamp, nonce),
    echo: 'wechat-challenge'
  });
  assert.deepEqual(result, { valid: true, response: 'wechat-challenge' });
});

test('invalid signatures and incomplete configuration are rejected', () => {
  const config = { token, appId, encryptionMode: 'plaintext' };
  assert.deepEqual(verifyWechatMessagePushRequest(config, {
    timestamp,
    nonce,
    signature: '0'.repeat(40),
    echo: 'challenge'
  }), { valid: false, statusCode: 403, error: 'WECHAT_MESSAGE_PUSH_SIGNATURE_INVALID' });
  assert.deepEqual(verifyWechatMessagePushRequest({
    ...config,
    token: ''
  }, {
    timestamp,
    nonce,
    signature: '',
    echo: 'challenge'
  }), { valid: false, statusCode: 503, error: 'WECHAT_MESSAGE_PUSH_NOT_CONFIGURED' });
});

test('signed plaintext JSON and XML pushes are acknowledged', () => {
  const config = { token, appId, encryptionMode: 'plaintext' };
  const signed = signature(token, timestamp, nonce);
  for (const body of [
    JSON.stringify({ MsgType: 'event', Event: 'debug_demo' }),
    '<xml><MsgType><![CDATA[event]]></MsgType></xml>'
  ]) {
    assert.deepEqual(verifyWechatMessagePushRequest(config, {
      timestamp,
      nonce,
      signature: signed,
      body
    }), { valid: true, response: 'success' });
  }
});

test('encrypted JSON and XML envelopes are extracted and authenticated', () => {
  const encrypted = 'encrypted-payload';
  assert.equal(extractWechatEncryptedMessage(JSON.stringify({ Encrypt: encrypted })), encrypted);
  assert.equal(extractWechatEncryptedMessage(`<xml><Encrypt><![CDATA[${encrypted}]]></Encrypt></xml>`), encrypted);
  assert.equal(
    isValidWechatMessagePushSignature(token, timestamp, nonce, signature(token, timestamp, nonce, encrypted), encrypted),
    true
  );
});

test('secure-mode posts decrypt the message and verify the embedded AppID', () => {
  const encodingAesKey = Buffer.alloc(32, 7).toString('base64').replace(/=$/, '');
  const message = JSON.stringify({ MsgType: 'event', Event: 'debug_demo' });
  const encryptedEcho = encryptMessage('url-check-ok', encodingAesKey);
  const echoResult = verifyWechatMessagePushRequest({
    token,
    appId,
    encryptionMode: 'secure',
    encodingAesKey
  }, {
    timestamp,
    nonce,
    signature: '',
    messageSignature: signature(token, timestamp, nonce, encryptedEcho),
    echo: encryptedEcho
  });
  assert.deepEqual(echoResult, { valid: true, response: 'url-check-ok' });

  const encrypted = encryptMessage(message, encodingAesKey);
  const result = verifyWechatMessagePushRequest({
    token,
    appId,
    encryptionMode: 'secure',
    encodingAesKey
  }, {
    timestamp,
    nonce,
    signature: '',
    messageSignature: signature(token, timestamp, nonce, encrypted),
    body: JSON.stringify({ Encrypt: encrypted })
  });
  assert.deepEqual(result, { valid: true, response: 'success' });

  const wrongAppIdCiphertext = encryptMessage(message, encodingAesKey, 'wx-wrong-app');
  const rejected = verifyWechatMessagePushRequest({
    token,
    appId,
    encryptionMode: 'secure',
    encodingAesKey
  }, {
    timestamp,
    nonce,
    signature: '',
    messageSignature: signature(token, timestamp, nonce, wrongAppIdCiphertext),
    body: JSON.stringify({ Encrypt: wrongAppIdCiphertext })
  });
  assert.deepEqual(rejected, {
    valid: false,
    statusCode: 403,
    error: 'WECHAT_MESSAGE_PUSH_DECRYPT_FAILED'
  });
});
