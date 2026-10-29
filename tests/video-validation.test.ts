import assert from 'node:assert/strict';
import test from 'node:test';
import { getVideoDurationSeconds, validateVideoDuration } from '../src/server/videoValidation';

const mp4Box = (type: string, payload: Buffer) => {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + 8, 0);
  header.write(type, 4, 'ascii');
  return Buffer.concat([header, payload]);
};

const makeMp4 = (durationSeconds: number, trackDurationSeconds = durationSeconds) => {
  const ftyp = mp4Box('ftyp', Buffer.from('isom0000isom', 'ascii'));
  const makeHeader = (seconds: number) => {
    const payload = Buffer.alloc(20);
    payload.writeUInt32BE(1_000, 12);
    payload.writeUInt32BE(seconds * 1_000, 16);
    return payload;
  };
  const track = mp4Box('trak', mp4Box('mdia', mp4Box('mdhd', makeHeader(trackDurationSeconds))));
  const moov = mp4Box('moov', Buffer.concat([mp4Box('mvhd', makeHeader(durationSeconds)), track]));
  return Buffer.concat([ftyp, moov]);
};

const ebmlElement = (id: Buffer, payload: Buffer) => {
  assert.ok(payload.length < 127);
  return Buffer.concat([id, Buffer.from([0x80 | payload.length]), payload]);
};

const makeWebm = (durationMs: number) => {
  const header = ebmlElement(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from([0x42, 0x86, 0x81, 0x01]));
  const timecodeScale = ebmlElement(Buffer.from([0x2a, 0xd7, 0xb1]), Buffer.from([0x0f, 0x42, 0x40]));
  const duration = Buffer.alloc(8);
  duration.writeDoubleBE(durationMs, 0);
  const info = ebmlElement(Buffer.from([0x15, 0x49, 0xa9, 0x66]), Buffer.concat([
    timecodeScale,
    ebmlElement(Buffer.from([0x44, 0x89]), duration)
  ]));
  const segment = ebmlElement(Buffer.from([0x18, 0x53, 0x80, 0x67]), info);
  return Buffer.concat([header, segment]);
};

test('validates MP4 and QuickTime duration at the server-side limit', () => {
  const accepted = makeMp4(180);
  assert.equal(getVideoDurationSeconds(accepted, 'video/mp4'), 180);
  assert.equal(validateVideoDuration(accepted, 'video/mp4'), true);
  assert.equal(validateVideoDuration(accepted, 'video/quicktime'), true);
  assert.equal(validateVideoDuration(makeMp4(181), 'video/mp4'), false);
  assert.equal(validateVideoDuration(makeMp4(60, 181), 'video/mp4'), false);
});

test('validates WebM duration and rejects missing or malformed metadata', () => {
  const accepted = makeWebm(65_000);
  assert.equal(getVideoDurationSeconds(accepted, 'video/webm'), 65);
  assert.equal(validateVideoDuration(accepted, 'video/webm'), true);
  assert.equal(validateVideoDuration(makeWebm(181_000), 'video/webm'), false);
  assert.equal(validateVideoDuration(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), 'video/webm'), false);
});
