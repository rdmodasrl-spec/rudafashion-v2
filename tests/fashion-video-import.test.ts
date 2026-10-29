import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FashionVideoImportError,
  normalizeSocialVideoUrl
} from '../src/server/fashionVideoImport';

test('normalizes supported TikTok, Instagram, YouTube, and Facebook links', () => {
  assert.equal(
    normalizeSocialVideoUrl('https://www.tiktok.com/@ruda/video/123?share=1#video'),
    'https://www.tiktok.com/@ruda/video/123?share=1'
  );
  assert.equal(
    normalizeSocialVideoUrl('https://vm.tiktok.com/ZMabc123/'),
    'https://vm.tiktok.com/ZMabc123/'
  );
  assert.equal(
    normalizeSocialVideoUrl('https://vt.tiktok.com/ZSabc123/'),
    'https://vt.tiktok.com/ZSabc123/'
  );
  assert.equal(
    normalizeSocialVideoUrl('https://www.instagram.com/reel/abc123/'),
    'https://www.instagram.com/reel/abc123/'
  );
  assert.equal(
    normalizeSocialVideoUrl('https://youtu.be/abcdefghijk?t=10'),
    'https://youtu.be/abcdefghijk?t=10'
  );
  assert.equal(
    normalizeSocialVideoUrl('https://www.facebook.com/share/v/abc123/'),
    'https://www.facebook.com/share/v/abc123/'
  );
});

test('accepts direct media URLs when the file extension is supported', () => {
  assert.equal(
    normalizeSocialVideoUrl('https://cdn.example.com/brand/hero-clip.mp4?download=1'),
    'https://cdn.example.com/brand/hero-clip.mp4?download=1'
  );
  assert.equal(
    normalizeSocialVideoUrl('https://storage.example.com/media/fashion-preview.webm#chapter'),
    'https://storage.example.com/media/fashion-preview.webm'
  );
});

test('rejects unsupported platforms, insecure, and malformed links', () => {
  for (const input of [
    'http://www.tiktok.com/@ruda/video/123',
    'https://tiktok.com.example.org/@ruda/video/123',
    'https://evil.tiktok.com/@ruda/video/123',
    'https://m.instagram.com.evil.example/reel/123',
    'https://example.com/@ruda/video/123',
    'https://example.com/fashion-story',
    'https://user:password@www.tiktok.com/@ruda/video/123',
    'https://www.tiktok.com:8443/@ruda/video/123',
    'https://www.tiktok.com/',
    'not a URL',
    'x'.repeat(2049)
  ]) {
    assert.throws(
      () => normalizeSocialVideoUrl(input),
      (error: unknown) => error instanceof FashionVideoImportError && error.code === 'FASHION_SOCIAL_VIDEO_URL_INVALID'
    );
  }
});
