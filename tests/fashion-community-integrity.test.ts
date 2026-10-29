import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

const serverSource = read('server.ts');
const webSource = read('src/apps/shared/components/frontend/FashionTrendsView.tsx');
const miniApiSource = read('miniprogram/utils/api.js');
const miniPageSource = read('miniprogram/pages/fashion/index.js');
const schema = read('prisma/schema.prisma');

const sliceBetween = (source: string, startMarker: string, endMarker: string) => {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing marker ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `missing marker ${endMarker}`);
  return source.slice(start, end);
};

test('web fashion feed no longer injects hard-coded demo posts', () => {
  assert.doesNotMatch(webSource, /fashionDemoStories/);
  assert.doesNotMatch(webSource, /fashionDemoVideos/);
  assert.doesNotMatch(webSource, /fashion-demo-\$\{/);
  assert.match(webSource, /fashionHeroImage/);
});

test('fashion social writes never trust a client supplied viewer id', () => {
  assert.doesNotMatch(serverSource, /req\.body\?\.viewerId/);
  assert.doesNotMatch(serverSource, /req\.query\.viewerId/);
  assert.match(serverSource, /const resolveFashionViewer = async/);
  assert.match(serverSource, /const fashionViewerCookieName = 'ruda_fashion_viewer'/);
});

test('fashion comments require an authenticated account and are rate limited', () => {
  const handler = sliceBetween(
    serverSource,
    "app.post('/api/fashion/social/:id/comments'",
    "app.post('/api/fashion/posts/:id/view'"
  );
  assert.match(handler, /if \(!viewer\.account\) return sendAuthenticationError\(res, 'FASHION_ACCOUNT_AUTH_REQUIRED'\)/);
  assert.match(handler, /consumeFashionRateLimit\(`fashion-comment:/);
  assert.doesNotMatch(handler, /viewerId\.slice\(0, 4\)/);
});

test('view tracking is persisted with a dedupe bucket and validated input', () => {
  assert.match(schema, /model FashionCommunityView \{/);
  assert.match(schema, /@@unique\(\[postId, viewerId, bucket\]\)/);
  const handler = sliceBetween(
    serverSource,
    "app.post('/api/fashion/posts/:id/view'",
    "app.get('/api/fashion/posts/:id'"
  );
  assert.match(handler, /Math\.min\(3_600_000, Math\.max\(0, Math\.round\(requestedWatchedMs\)\)\)/);
  assert.match(handler, /posts\/:id\/view/);
  assert.match(handler, /postId_viewerId_bucket/);
});

test('miniprogram uses the shared view endpoint and stops sending viewer ids', () => {
  assert.match(miniApiSource, /function recordFashionPostView/);
  assert.match(miniApiSource, /\/api\/fashion\/posts\/\$\{encodeURIComponent\(id\)\}\/view/);
  assert.doesNotMatch(miniApiSource, /data: \{ viewerId, reaction \}/);
  assert.doesNotMatch(miniApiSource, /toQuery\(\{ ids: ids\.join\(','\), viewerId \}\)/);
  assert.match(miniPageSource, /recordFashionPostView\(postId/);
  assert.match(miniPageSource, /if \(!\(await this\.ensureAccount\(\)\)\) return;\s*\n\s*this\.setData\(\{ commentSubmitting: true \}\);/);
});

test('feed ranking uses real engagement, view and completion signals', () => {
  const handler = sliceBetween(
    serverSource,
    "app.get('/api/fashion/posts'",
    "app.get('/api/fashion/merchants'"
  );
  assert.match(handler, /prisma\.fashionCommunityView\.groupBy/);
  assert.match(handler, /completionRate \* 20/);
  assert.match(handler, /freshness \* 18/);
  assert.match(handler, /categoryAffinity/);
  assert.match(handler, /followingOnly/);
  assert.match(handler, /requestedPostId/);
  assert.match(handler, /category: \{ contains: requestedQuery/);
});

test('post detail, creator profile and search endpoints are registered', () => {
  assert.match(serverSource, /app\.get\('\/api\/fashion\/posts\/:id', async/);
  assert.match(serverSource, /app\.get\('\/api\/fashion\/creators\/:id', async/);
  assert.match(serverSource, /app\.get\('\/api\/fashion\/search', async/);
});

test('following feed is a real content feed backed by the server', () => {
  assert.match(webSource, /const followingQuery = mode === 'following' \? '&following=true' : ''/);
  assert.match(webSource, /mode === 'latest' \|\| mode === 'following' \? 'latest' : 'recommended'/);
  // The merchant carousel is isolated in its own mode instead of masquerading as "following".
  assert.match(webSource, /feedMode === 'stores' \? \(/);
  assert.match(webSource, /feedMode === 'stores' \? 'flex snap-x/);
  const feed = sliceBetween(serverSource, "app.get('/api/fashion/posts'", "app.get('/api/fashion/merchants'");
  assert.match(feed, /followingCreatorIds/);
  assert.match(feed, /fashionCommunityFollow\.findMany/);
});

test('comment replies, deletion and pagination are implemented server-side', () => {
  assert.match(schema, /parentId\s+String\?/);
  assert.match(schema, /status\s+String\s+@default\("visible"\)/);
  const comments = sliceBetween(
    serverSource,
    "app.get('/api/fashion/social/:id/comments'",
    "app.post('/api/fashion/posts/:id/view'"
  );
  assert.match(comments, /parentId: null/);
  assert.match(comments, /commentsCount/);
  assert.match(comments, /replies: \(repliesByParent\.get\(comment\.id\) \|\| \[\]\)/);
  assert.match(comments, /FASHION_COMMENT_REPLY_DEPTH_LIMIT/);
  assert.match(comments, /comment\.viewerId !== account\.id/);
  assert.match(comments, /FASHION_COMMENT_FORBIDDEN/);
});

test('product links are authorized against the merchant that owns the product', () => {
  assert.match(schema, /model FashionCommunityPostProduct \{/);
  assert.match(schema, /@@unique\(\[postId, productId\]\)/);
  assert.match(serverSource, /const resolveFashionAccountMerchantIds = async/);
  assert.match(serverSource, /role: 'merchant'/);
  assert.match(serverSource, /merchantId: \{ in: \[\.\.\.merchantIds\] \}/);
  assert.match(serverSource, /FASHION_POST_PRODUCT_NOT_AUTHORIZED/);
  // Public feed/detail only expose publicly purchasable products.
  assert.match(serverSource, /product\.visibility !== 'public'/);
  assert.match(serverSource, /product\.isExclusiveProtected/);
  assert.match(serverSource, /PUBLIC_PRODUCT_VISIBILITY_FILTER/);
  assert.match(serverSource, /products: products\.get\(post\.id\) \|\| \[\]/);
});

test('reports, moderation and appeals form a closed loop', () => {
  assert.match(schema, /model FashionCommunityReport \{/);
  assert.match(schema, /model FashionCommunityAppeal \{/);
  assert.match(serverSource, /app\.post\('\/api\/fashion\/reports'/);
  assert.match(serverSource, /app\.post\('\/api\/fashion\/appeals'/);
  assert.match(serverSource, /app\.get\('\/api\/admin\/fashion\/reports'/);
  assert.match(serverSource, /app\.patch\('\/api\/admin\/fashion\/reports\/:id'/);
  assert.match(serverSource, /app\.get\('\/api\/admin\/fashion\/appeals'/);
  assert.match(serverSource, /app\.patch\('\/api\/admin\/fashion\/appeals\/:id'/);
  const update = sliceBetween(
    serverSource,
    "app.patch('/api/admin/fashion/reports/:id'",
    "app.get('/api/admin/fashion/appeals'"
  );
  assert.match(update, /requireAdminPermission\('content\.gallery'\)/);
  assert.match(update, /publicationStatus: 'unpublished'|publicationStatus: \{ not: 'unpublished' \}/);
  assert.match(update, /FASHION_REPORT_HANDLED/);
  assert.match(update, /logAudit/);
});

test('mini program composer uses token uploads and owner-scoped product search', () => {
  assert.match(serverSource, /app\.post\('\/api\/fashion\/posts\/mixed\/assets'/);
  assert.match(serverSource, /const createFashionPostFromUploadTokens = async/);
  assert.match(serverSource, /role: 'fashion_upload'/);
  assert.match(miniApiSource, /function searchFashionCreatorProducts/);
  assert.match(miniApiSource, /function reportFashionContent/);
  assert.match(miniApiSource, /function deleteFashionComment/);
  assert.match(miniPageSource, /searchFashionCreatorProducts\(query\)/);
  assert.match(miniPageSource, /productIds: this\.data\.selectedProduct \? \[this\.data\.selectedProduct\.id\] : \[\]/);
  assert.doesNotMatch(miniPageSource, /productId: this\.data\.selectedProduct \? /);
  assert.match(miniPageSource, /addFashionComment\(post\.id, this\.data\.viewerId, text, this\.data\.replyTarget/);
});

test('likes, comments, replies and follows create owner notifications', () => {
  assert.match(schema, /model FashionCommunityNotification \{/);
  assert.match(schema, /@@index\(\[recipientAccountId, readAt\]\)/);
  assert.match(serverSource, /const pushFashionNotification = async/);
  const reaction = sliceBetween(
    serverSource,
    "app.post('/api/fashion/social/:id/reaction'",
    "app.post('/api/fashion/social/:id/follow'"
  );
  assert.match(reaction, /type: 'like'/);
  assert.match(reaction, /recipientAccountId: post\?\.creatorAccountId/);
  const follow = sliceBetween(
    serverSource,
    "app.post('/api/fashion/social/:id/follow'",
    "app.get('/api/fashion/social/:id/comments'"
  );
  assert.match(follow, /type: 'follow'/);
  assert.match(follow, /FASHION_CREATOR_NOT_FOUND/);
  const comment = sliceBetween(
    serverSource,
    "app.post('/api/fashion/social/:id/comments'",
    "app.delete('/api/fashion/social/:id/comments/:commentId'"
  );
  assert.match(comment, /type: parentId \? 'reply' : 'comment'/);
  assert.match(serverSource, /app\.get\('\/api\/fashion\/notifications'/);
  assert.match(serverSource, /app\.post\('\/api\/fashion\/notifications\/read'/);
  assert.match(webSource, /openNotifications/);
  assert.match(miniApiSource, /function getFashionNotifications/);
  assert.match(miniPageSource, /openFashionNotifications/);
});

test('server-side drafts survive reloads and keep media upload tokens', () => {
  assert.match(schema, /model FashionCommunityDraft \{/);
  assert.match(schema, /productIds String\[\] @default\(\[\]\)/);
  assert.match(serverSource, /app\.get\('\/api\/fashion\/drafts'/);
  assert.match(serverSource, /app\.post\('\/api\/fashion\/drafts'/);
  assert.match(serverSource, /app\.patch\('\/api\/fashion\/drafts\/:id'/);
  assert.match(serverSource, /app\.delete\('\/api\/fashion\/drafts\/:id'/);
  assert.match(serverSource, /where: \{ id: req\.params\.id, accountId: account\.id \}/);
  assert.match(serverSource, /req\.body\?\.draft === 'true' \? '30d' : '6h'/);
  assert.match(webSource, /const saveDraft = async/);
  assert.match(webSource, /apiPost\('\/api\/fashion\/drafts', payload\)/);
  assert.match(webSource, /resumeDraft/);
});

test('blocked creators and hidden posts are excluded server-side', () => {
  assert.match(schema, /model FashionCommunityBlock \{/);
  assert.match(schema, /model FashionCommunityHiddenPost \{/);
  assert.match(serverSource, /app\.post\('\/api\/fashion\/blocks'/);
  assert.match(serverSource, /app\.delete\('\/api\/fashion\/blocks\/:accountId'/);
  assert.match(serverSource, /app\.post\('\/api\/fashion\/posts\/:id\/hide'/);
  assert.match(serverSource, /app\.delete\('\/api\/fashion\/posts\/:id\/hide'/);
  const feed = sliceBetween(
    serverSource,
    "app.get('/api/fashion/posts'",
    "app.get('/api/fashion/merchants'"
  );
  assert.match(feed, /blockedCreatorIds/);
  assert.match(feed, /hiddenPostIds/);
  assert.match(feed, /fashionCommunityHiddenPost\.findMany/);
});

test('creator connections, tags and analytics are real read endpoints', () => {
  assert.match(serverSource, /app\.get\('\/api\/fashion\/creators\/:id\/followers'/);
  assert.match(serverSource, /app\.get\('\/api\/fashion\/creators\/:id\/following'/);
  assert.match(serverSource, /app\.get\('\/api\/fashion\/tags'/);
  assert.match(serverSource, /app\.get\('\/api\/fashion\/account\/analytics'/);
  const analytics = sliceBetween(
    serverSource,
    "app.get('/api/fashion/account/analytics'",
    "app.get('/api/fashion/posts/:id/manage'"
  );
  assert.match(analytics, /fashionCommunityProductClick\.groupBy/);
  assert.match(analytics, /fashionCommunityView\.groupBy/);
  assert.match(analytics, /productClicks/);
  assert.match(webSource, /openConnectionList\('followers'\)/);
  assert.match(webSource, /openAnalytics/);
  assert.match(webSource, /runFeedSearch/);
  assert.match(webSource, /\/api\/fashion\/search\?q=/);
  assert.match(serverSource, /app\.delete\('\/api\/fashion\/posts\/:id'/);
  assert.match(webSource, /deleteOwnPost/);
});

test('miniprogram cloud drafts, block actions and analytics use the shared APIs', () => {
  const api = read('miniprogram/utils/api.js');
  const page = read('miniprogram/pages/fashion/index.js');
  assert.match(api, /function getFashionDrafts/);
  assert.match(api, /function createFashionDraft/);
  assert.match(api, /function updateFashionDraft/);
  assert.match(api, /function deleteFashionDraft/);
  assert.match(api, /function hideFashionPost/);
  assert.match(api, /function blockFashionCreator/);
  assert.match(api, /function unblockFashionCreator/);
  assert.match(api, /function getFashionAnalytics/);
  assert.match(api, /function deleteFashionPost/);
  assert.match(page, /loadServerDrafts/);
  assert.match(page, /restoreServerDraft/);
  assert.match(page, /buildServerDraftPayload/);
  assert.match(page, /createFashionDraft\(payload\)/);
  assert.match(page, /updateFashionDraft\(draftId, payload\)/);
  assert.match(page, /deleteFashionDraft\(/);
  assert.match(page, /hideFashionPost\(item\.id\)/);
  assert.match(page, /blockFashionCreator\(creator\.id\)/);
  assert.match(page, /unblockFashionCreator\(creator\.id\)/);
  assert.match(page, /getFashionAnalytics\(\)/);
  assert.match(page, /deleteFashionPost\(postId\)/);
  assert.match(page, /uploadFashionPostAsset\(media\.filePath, \{[\s\S]*?draft: true/);
});

test('analytics returns real completion metrics and creator profile exposes block state', () => {
  const analytics = sliceBetween(
    serverSource,
    "app.get('/api/fashion/account/analytics'",
    "app.get('/api/fashion/posts/:id/manage'"
  );
  assert.match(analytics, /completionRows/);
  assert.match(analytics, /avgWatchedMs/);
  assert.match(analytics, /completionRate/);
  assert.match(serverSource, /blocked: Boolean\(block\)/);
  assert.match(webSource, /completionRate/);
});

test('web feed gallery supports arrows, keyboard and swipe navigation', () => {
  assert.match(webSource, /data-feed-gallery=\{item\.id\}/);
  assert.match(webSource, /const scrollFeedGallery = \(itemId: string, delta: number\)/);
  assert.match(webSource, /event\.key !== 'ArrowRight' && event\.key !== 'ArrowLeft'/);
  assert.match(webSource, /const stepLightbox = \(delta: number\)/);
  assert.match(webSource, /const openMediaLightbox = \(item: FeedItem, imageIndex = 0\)/);
});

test('season is a validated, persisted field on every fashion publish path', () => {
  assert.match(schema, /model FashionCommunityPost \{[\s\S]*?season\s+String\?/);
  assert.match(schema, /model FashionCommunityDraft \{[\s\S]*?season\s+String\?/);

  const singlePost = sliceBetween(
    serverSource,
    "app.post('/api/fashion/posts', requireFashionAccount",
    "app.post('/api/fashion/posts/mixed/assets'"
  );
  assert.match(singlePost, /const season = typeof requestedSeason === 'string' && requestedSeason \? requestedSeason : undefined/);
  assert.match(singlePost, /FASHION_POST_SEASON_INVALID/);
  assert.match(singlePost, /\.\.\.\(season \? \{ season \} : \{\}\)/);

  const mixedPost = sliceBetween(
    serverSource,
    "app.post('/api/fashion/posts/mixed', requireFashionAccount",
    "app.get('/api/admin/fashion/community'"
  );
  assert.match(mixedPost, /FASHION_POST_SEASON_INVALID/);
  assert.match(mixedPost, /\.\.\.\(typeof requestedSeason === 'string' && requestedSeason \? \{ season: requestedSeason \} : \{\}\)/);

  const drafts = sliceBetween(
    serverSource,
    "app.post('/api/fashion/drafts'",
    "app.patch('/api/fashion/drafts/:id'"
  );
  assert.match(drafts, /season: draft\.season \|\| null/);
  assert.match(serverSource, /const payload = \(body \|\| \{\}\) as Record<string, unknown>;[\s\S]*?fashionCommunitySeasons\.includes\(text\(payload\.season, 12\)/);

  const feed = sliceBetween(
    serverSource,
    "app.get('/api/fashion/posts', async (req, res) => {",
    "app.get('/api/fashion/posts/:id/image'"
  );
  assert.match(feed, /FASHION_POST_SEASON_INVALID/);
  assert.match(feed, /post\.season === req\.query\.season/);
  assert.match(feed, /season: post\.season/);

  assert.match(webSource, /const fashionSeasons = \['春季', '夏季', '秋季', '冬季'\] as const/);
  assert.match(miniPageSource, /const fashionSeasons = \['春季', '夏季', '秋季', '冬季'\]/);
});


