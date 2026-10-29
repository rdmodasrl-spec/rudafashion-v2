import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../miniprogram/${path}`, import.meta.url), 'utf8');

const pageJs = read('pages/fashion/index.js');
const pageWxml = read('pages/fashion/index.wxml');
const pageWxss = read('pages/fashion/index.wxss');
const apiJs = read('utils/api.js');
const tabBarWxml = read('custom-tab-bar/index.wxml');

test('fashion tab is controlled by the platform switch and its disabled fallback is not a blank page', () => {
  // 入口可见性来自服务端全局开关（fashion_enabled），不再保留编译期常量。
  assert.match(read('custom-tab-bar/index.js'), /isFashionEnabled\(\)/);
  assert.match(read('utils/module-flags.js'), /fashion_enabled/);
  assert.match(pageWxml, /<view wx:if="\{\{featureEnabled\}\}"/);
  assert.match(pageWxml, /<view wx:else class="fashion-disabled"/);
  assert.match(pageWxml, /goHomeFromDisabled/);
});

test('fashion feed is an immersive vertical full-screen flow', () => {
  assert.match(pageWxml, /<swiper class="feed-swiper"[^>]*vertical="true"/);
  assert.match(pageWxml, /class="media-stage"/);
  assert.match(pageWxml, /<video[^>]*object-fit="cover"/);
  assert.match(pageWxml, /class="action-rail"/);
  assert.match(pageWxml, /class="creator-overlay"/);
  assert.match(pageWxss, /\.feed-swiper \{ width: 100%; height: 100%;/);
  assert.match(pageWxss, /env\(safe-area-inset-bottom\)/);
  assert.match(pageWxss, /\.media-stage[^}]*height: 100%/);
});

test('fashion interactions are wired to the real social and composer handlers', () => {
  for (const handler of [
    'catchtap="toggleLike"',
    'catchtap="toggleFollow"',
    'catchtap="toggleSave"',
    'catchtap="openComments"',
    'bindtap="openComposer"',
    'catchtap="openCreator"',
    'catchtap="retryActiveVideo"',
    'catchtap="retryMediaImage"'
  ]) {
    assert.ok(pageWxml.includes(handler), `${handler} must be present in the fashion feed`);
  }
  for (const method of [
    'toggleLike(',
    'toggleFollow(',
    'toggleSave(',
    'openComments(',
    'openComposer(',
    'retryMediaImage(',
    'retryActiveVideo('
  ]) {
    assert.ok(pageJs.includes(method), `${method} must be implemented`);
  }
  assert.match(pageWxml, /open-type="share"/);
});

test('fashion publish path uses the authoritative fashion APIs with upload progress', () => {
  for (const endpoint of [
    '/api/fashion/posts',
    '/api/fashion/posts/mixed',
    '/api/fashion/posts/mixed/assets',
    '/api/fashion/social',
    '/api/fashion/editorial',
    '/api/fashion/merchants'
  ]) {
    assert.ok(apiJs.includes(endpoint), `${endpoint} must stay in the shared mini-program api client`);
  }
  assert.match(pageJs, /uploadFashionPostAsset/);
  assert.match(pageJs, /submitFashionMixedPost/);
  assert.match(pageJs, /uploadProgress/);
  assert.match(pageJs, /FASHION_DRAFT_STORAGE_KEY/);
});

test('fashion page keeps real empty, error and media failure states', () => {
  assert.match(pageWxml, /class="state-box"/);
  assert.match(pageWxml, /这里还没有内容/);
  assert.match(pageWxml, /class="retry-button" bindtap="onRetry"/);
  assert.match(pageWxml, /class="media-error"/);
  assert.match(pageWxml, /图片加载失败/);
  assert.match(pageJs, /时尚内容暂时无法加载/);
});

test('fashion page ships no fabricated demo content', () => {
  const sources: Array<[string, string]> = [
    ['pages/fashion/index.js', pageJs],
    ['pages/fashion/index.wxml', pageWxml],
    ['pages/fashion/index.wxss', pageWxss],
    ['custom-tab-bar/index.wxml', tabBarWxml]
  ];
  const forbidden = [
    'demo-fashion-',
    'DEMO_IMAGE_URL',
    'DEMO_POST_IMAGES',
    'demoInboxThreads',
    'demoLive',
    'fashion-demo',
    '界面演示',
    '16.5万',
    '4258'
  ];
  for (const [name, source] of sources) {
    for (const token of forbidden) {
      assert.equal(source.includes(token), false, `${name} must not contain ${token}`);
    }
  }
  assert.equal(tabBarWxml.includes('收件箱'), false, 'the demo inbox tab must stay removed');
  assert.match(tabBarWxml, /data-key="friends"/);
  assert.match(tabBarWxml, /data-key="create"/);
});

test('every fashion page handler referenced by the template exists in the page logic', () => {
  const handlers = new Set<string>();
  for (const match of pageWxml.matchAll(/\b(?:bind|catch)[a-z]+="([A-Za-z_][A-Za-z0-9_]*)"/g)) {
    handlers.add(match[1]);
  }
  assert.ok(handlers.size > 20, 'fashion template must keep its interaction handlers');
  const missing = [...handlers].filter(name => !new RegExp(`\\n\\s+(?:async )?${name}\\(`).test(pageJs));
  assert.deepEqual(missing, [], `fashion template references handlers missing from index.js: ${missing.join(', ')}`);
});

test('fashion feed mirrors the mobile web feature set', () => {
  assert.match(pageWxml, /bindtimeupdate="onVideoTimeUpdate"/);
  assert.match(pageWxml, /class="video-progress-fill" style="width: \{\{videoProgress \* 100\}\}%"/);
  assert.match(pageJs, /onVideoTimeUpdate\(event\)/);
  assert.match(pageWxml, /catchtap="translatePost"/);
  assert.match(pageJs, /translateFashionText\(\{ text, language: 'it' \}\)/);
  assert.match(pageWxml, /class="feed-translation"/);
  assert.match(pageJs, /wx\.previewImage\(\{ current, urls: images \}\)/);
  assert.match(pageJs, /wx\.saveVideoToPhotosAlbum/);
  assert.match(pageJs, /wx\.saveImageToPhotosAlbum/);
  assert.match(pageJs, /wx\.setClipboardData/);
  assert.match(pageWxml, /catchtap="savePostMedia"/);
  assert.match(pageWxml, /catchtap="copyPostLink"/);
  assert.match(pageWxml, /catchtap="previewPostMedia"/);
  assert.match(pageJs, /FASHION_DISMISSED_STORAGE_PREFIX/);
  assert.match(pageWxml, /catchtap="dismissPost"/);
  assert.match(pageWxml, /不感兴趣/);
});

test('fashion season vocabulary and filter stay aligned across server, web and mini program', () => {
  const serverTs = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const webTs = readFileSync(new URL('../src/apps/shared/components/frontend/FashionTrendsView.tsx', import.meta.url), 'utf8');
  const readSeasons = (source: string, pattern: RegExp) => {
    const block = pattern.exec(source)?.[1] || '';
    return [...block.matchAll(/'([^']+)'/g)].map(match => match[1]);
  };
  const serverSeasons = readSeasons(serverTs, /const fashionCommunitySeasons = \[([^\]]+)\]/);
  const webSeasons = readSeasons(webTs, /const fashionSeasons = \[([^\]]+)\]/);
  const miniSeasons = readSeasons(pageJs, /const fashionSeasons = \[([^\]]+)\]/);
  assert.deepEqual(serverSeasons, ['春季', '夏季', '秋季', '冬季']);
  assert.deepEqual(webSeasons, serverSeasons, 'web season list must match the server vocabulary');
  assert.deepEqual(miniSeasons, serverSeasons, 'mini program season list must match the server vocabulary');
  assert.match(pageJs, /const seasonOptions = \['不限季节'\]\.concat\(fashionSeasons\)/);

  // Feed filter: server validates and filters, both clients send the same query parameter.
  assert.match(serverTs, /FASHION_POST_SEASON_INVALID/);
  assert.match(serverTs, /req\.query\.season/);
  assert.match(serverTs, /post\.season === req\.query\.season/);
  assert.match(pageJs, /season: this\.data\.seasonIndex > 0 \? fashionSeasons\[this\.data\.seasonIndex - 1\] : undefined/);
  assert.match(webTs, /&season=\$\{encodeURIComponent\(feedSeason\)\}/);
  assert.match(pageWxml, /bindtap="onSeasonFilterChange"/);

  // Composer: the resolved season is submitted on publish and restored from drafts.
  assert.match(pageWxml, /bindchange="onPostSeasonChange"/);
  assert.match(pageWxml, /range="\{\{seasonOptions\}\}"/);
  assert.match(pageJs, /season: this\.data\.postSeasonIndex > 0 \? fashionSeasons\[this\.data\.postSeasonIndex - 1\] : ''/);
  assert.match(pageJs, /onPostSeasonChange\(event\)/);
  assert.match(pageJs, /postSeasonIndex/);
  assert.match(webTs, /form\.set\('season', postSeason\)/);
});

test('fashion publish categories stay aligned with the server list', () => {
  const serverTs = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const serverBlock = /const fashionCommunityCategories = \[([^\]]+)\]/.exec(serverTs)?.[1] || '';
  const serverCategories = [...serverBlock.matchAll(/'([^']+)'/g)].map(match => match[1]);
  const pageBlock = /const fashionCategories = \[([^\]]+)\]/.exec(pageJs)?.[1] || '';
  const pageCategories = [...pageBlock.matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.ok(serverCategories.length >= 6, 'server fashion categories must be discoverable');
  assert.deepEqual(pageCategories, serverCategories);
  assert.match(pageJs, /const postCategories = fashionCategories\.slice\(\)/);
  assert.match(pageJs, /const categories = \['全部'\]\.concat\(fashionCategories\)/);
});

