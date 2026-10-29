# Fashion Community Upgrade — Stage 1

Status: implemented in code, database migration applied manually, production roll-out in progress.
Owner: platform team. Last reviewed: 2026-10-28.

## 1. Problem and goal

The Web fashion feed rendered fourteen posts hard-coded in `FashionTrendsView.tsx`
(`fashion-demo-1…10`, `fashion-demo-video-1…4`). The miniprogram never did, so the two
ends showed different first screens. Production also ran the community with
`FASHION_COMMUNITY_STORAGE` unset, meaning posts, reactions and comments were written to
`logs/shared-gallery.json` / `logs/fashion-social.json` (both absent) instead of PostgreSQL.
Because the Web client invented its own posts, the empty server feed was invisible.

Goal of this stage: one authoritative source of fashion content, trustworthy engagement
identities, real view/completion signals for ranking, working deep links, and stable
creator/search reads — without inventing a second content system.

Non-goals for this stage: video transcoding pipeline, product linkage, report/moderation
workflow, comment replies, live streaming.

## 2. Reused capabilities

| Need | Reused |
| --- | --- |
| Content storage | Existing `FashionCommunityPost` / `Reaction` / `Comment` / `Follow` tables |
| Media upload | Existing fashion upload pipeline, private R2 bucket + signed reads, `requireFashionObjectStorage` guard |
| Identity | Existing `fashion_account` JWT cookie and `/api/fashion/account/*` endpoints |
| Moderation | Existing platform admin fashion community console |
| Miniprogram | Existing `miniprogram/utils/api.js` client and fashion page |

No new upload path, no new auth system, no second feed service.

## 3. Data model

New table (migration `20261028120000_fashion_community_views`):

```
FashionCommunityView(id, postId, viewerId, bucket, watchedMs, completed, createdAt)
  @@unique([postId, viewerId, bucket])
  @@index([postId, createdAt])
  @@index([viewerId, createdAt])
```

`bucket` is `floor(epochMs / 6h)` so a viewer counts once per post per six hours;
repeat events only increase `watchedMs` and can set `completed`. No cached counters are
stored on the post, so there is no counter drift to reconcile: the feed aggregates the
events it needs (7-day window, bounded to the page/post pool).

The production database currently has migration history ahead of this repository
(`store_access_credentials`, `link_fashion_posts_to_products` are applied but absent
locally, `repair_sales_quote_item_pricing_snapshot` is pending). Therefore the table was
created with the idempotent SQL in that migration folder (`CREATE TABLE IF NOT EXISTS`)
and `prisma migrate deploy` was **not** run. `prisma generate` was run for the client types.
## 4. API contracts

All paths are under the existing Express app, same-origin cookies.

### `POST /api/fashion/social/:id/reaction`
- Body: `{ reaction: 'like' | 'save' }`. Client-supplied `viewerId` is ignored.
- Identity: fashion account when signed in; otherwise a server-issued HttpOnly cookie
  `ruda_fashion_viewer` (UUID, 1 year). `save` still requires an account (401
  `FASHION_ACCOUNT_AUTH_REQUIRED`).
- Rate limit: 90 reactions / 60 s / viewer (429 `FASHION_REACTION_RATE_LIMITED`).
- Idempotent toggle via the existing unique constraint `(contentId, viewerId, reaction)`.

### `POST /api/fashion/social/:id/comments`
- Body: `{ text }` (≤300 chars, control characters stripped).
- Requires an authenticated fashion account (401 `FASHION_ACCOUNT_AUTH_REQUIRED`).
- Rate limit: 6 / 60 s / account (429 `FASHION_COMMENT_RATE_LIMITED`).
- Author label is the account `displayName`, not a derived fragment of an id.

### `POST /api/fashion/posts/:id/view`
- Body: `{ watchedMs: number, completed: boolean }`; `watchedMs` clamped to 0…3 600 000.
- Anonymous viewers use the server cookie; no identity is accepted from the body.
- 404 `FASHION_POST_NOT_FOUND` when the post is not an approved public fashion post.
- 429 `FASHION_VIEW_RATE_LIMITED` above 240 events / 10 min / viewer.
- JSON storage mode answers `{ success: true, tracked: false }` (development only).

### `GET /api/fashion/posts`
- `sort=latest | recommended`, `city`, `category`, `saved=true`, `following=true`, `q`, `limit`, `offset`.
- `recommended` scores a bounded candidate pool (newest ≤300 plus top-engagement ≤120) with
  `engagementScore + views*0.35 + completionRate*20 + freshness*18 + categoryAffinity*2`.
  The affinity term is built from the viewer's own likes/saves over 30 days.
- `following=true` requires an account and returns only posts by creators that account follows.
- Response items include `viewsCount`; editorial posts without a creator account are
  labelled `RUDA 编辑精选`.

### `GET /api/fashion/posts/:id`
Post detail with `stats` (`likesCount`, `commentsCount`, `savesCount`, `viewsCount`,
`completionRate`, `liked`, `saved`) and `author` (bio/avatar/follower count).

### `GET /api/fashion/creators/:id`
Creator profile with counts, follow state and the latest 30 approved posts.

### `GET /api/fashion/search?q=`
Approved posts (title/caption/city/category/hashtag), creators (display name) and public
merchants (name/slug/city). Empty query returns empty collections.

## 5. Client behaviour

- Web: demo arrays removed; the feed renders only API posts. Hero backdrop is a static asset.
- Web: view events fire after 2 s on the active card and on video end; the next video is
  preloaded with `preload="metadata"`.
- Web: deep link `?post=<id>` opens the immersive feed at that post and is kept in the URL
  while browsing; share/copy now produce that link instead of a raw media URL.
- Web: comments call account activation first; 401 leads to the existing login entry.
- Miniprogram: `recordFashionPostView` reports views/completion; reaction/comment helpers no
  longer send a viewer id; comments require the existing account gate.

## 6. Security and privacy notes

- Engagement identity can no longer be forged by posting an arbitrary UUID.
- `ruda_fashion_viewer` is HttpOnly, SameSite=Lax, Secure in production; it is only an
  anonymous aggregation key, never an authorization token.
- Rate limits are in-process and reset on restart; they are abuse friction, not billing-grade
  quotas. A shared store is required before horizontal scaling.
- View rows carry no IP address or user agent.

## 7. Rollout and rollback

1. `npm run db:backup:predeploy` (or a verified `pg_dump`) before any schema change.
2. Apply the idempotent SQL above (applied on 2026-10-28).
3. Set `FASHION_COMMUNITY_STORAGE=database` in `.env`; R2 public URL and private bucket are
   already configured, so `requireFashionObjectStorage` is satisfied.
4. Rebuild and restart the single Node process on `127.0.0.1:3011`.
5. Verify: feed count equals the approved DB count, web and miniprogram first screens match,
   forged `viewerId` has no effect, comments without login return 401.

Rollback: unset `FASHION_COMMUNITY_STORAGE`, restart, `npm run rollback:app` for the previous
`dist` build. The view table is additive and can stay in place.

## 8. Verification performed

See the delivery report for the exact commands and results (typecheck, unit tests, HTTP checks).

## 9. Remaining work (not delivered in this stage)

- Following tab UI still shows the merchant carousel; the server-side following feed exists
  and is consumed by other clients.
- Product linkage, collections, reports/moderation queue, comment replies, transcoding and
  CDN variants, and the Web creator profile page are still pending.
- Visual acceptance on desktop/mobile browsers and WeChat devtools is not yet recorded.


---

# Stage 2 (2026-10-28): follow feed, creator page, product links, moderation

Status: **delivered** for Web (desktop + mobile) and server; mini program code updated and build-checked, device acceptance still pending (see §15).

## 10. Data model added in Stage 2

| Model | Purpose | Key constraints |
| --- | --- | --- |
| `FashionCommunityComment.parentId/status` | one-level replies + soft removal by moderation | `@@index([parentId])`, `status` default `visible` |
| `FashionCommunityPostProduct` | post ↔ real product link (max 6 per post enforced in API) | `@@unique([postId, productId])`, cascade on post/product delete |
| `FashionCommunityReport` | user reports for posts/comments | `@@unique([targetType, targetId, reporterViewerId])`, `@@index([status, createdAt])` |
| `FashionCommunityAppeal` | author appeal against a moderation result | `@@index([status, createdAt])`, `@@index([accountId])` |
| `FashionCommunityProductClick` | real product taps, deduped 1h per viewer | `@@index([postId, createdAt])` |

Legacy column `FashionCommunityPost.productId` predates this work; it is kept for schema/DB parity and is **not** used by the API. Migration history was reconciled, see `docs/engineering/migrations-history-reconciliation.md`.

## 11. API contracts (Stage 2)

Public, anonymous allowed unless stated:

| Endpoint | Behaviour |
| --- | --- |
| `GET /api/fashion/posts?following=true` | requires a fashion account (401 otherwise); returns only approved posts by followed creators, newest first, supports city/category/pagination |
| `GET /api/fashion/posts/:id` | single post + real stats + `products[]` + `saved` |
| `GET /api/fashion/creators/:id` | profile, posts, follower/following/post counts, `following`, `isSelf`, optional linked merchant, `products[]` per post |
| `GET /api/fashion/account/saved` | auth required; saved posts ordered by save time, `hasMore`/`nextOffset` |
| `GET /api/fashion/social/:id/comments?limit=&offset=` | top-level comments (newest page) with nested `replies[]`, `mine`, visible count |
| `POST /api/fashion/social/:id/comments` | auth required, rate limit 6/min, optional `parentId` (one level only) |
| `DELETE /api/fashion/social/:id/comments/:commentId` | author only (403 otherwise), cascades replies, returns new count |
| `POST /api/fashion/reports` | target `post`/`comment`, fixed reason enum, `detail` ≤500, dedupe per viewer+target (409) |
| `POST /api/fashion/appeals` | auth required, only own content, one pending appeal per target |
| `GET /api/fashion/appeals/mine` | own appeal history |
| `GET /api/fashion/products/search` | auth required; **only** publicly purchasable products of merchants the account manages |
| `PATCH /api/fashion/posts/:id` | owner edit; content edits on approved posts return to `pending`, product-only edits do not require re-review |
| `GET /api/fashion/posts/:id/manage` | owner edit payload incl. `productIds` |
| `POST /api/fashion/posts/:id/products/:productId/click` | real product click, deduped 1h per viewer |
| `POST /api/fashion/posts/mixed/assets` | mini program asset upload (multipart, 20MB), returns signed 6h `uploadToken` bound to account/type/kind |

Admin (`requireAdminAuth` + `content.gallery`):

| Endpoint | Behaviour |
| --- | --- |
| `GET /api/admin/fashion/reports?status=` | queue with target previews and counts |
| `GET /api/admin/fashion/reports/:id` | detail + all reports for the target + appeals |
| `PATCH /api/admin/fashion/reports/:id` | `reviewing/resolved/rejected`; actions `none/remove_comment/unpublish_post`; writes audit log |
| `GET /api/admin/fashion/appeals?status=` | pending appeals with target |
| `PATCH /api/admin/fashion/appeals/:id` | accept restores own deleted content, reject keeps decision; audit logged |

## 12. Authorisation rules (must not regress)

- `viewerId` is **never** read from request body/query. Anonymous viewers use the HttpOnly `ruda_fashion_viewer` cookie; signed-in users use the fashion account id.
- Product search/linking is scoped by `resolveFashionAccountMerchantIds()` which maps the fashion account to `AuthAccount(role=merchant) -> merchantId`. Client-supplied merchant ids are ignored.
- Attached products must satisfy `lifecycleStatus=published`, `visibility=public`, `isExclusiveProtected=false`, `inventoryStatus != discontinued`, and a public storefront — the same filter as `/api/products/:id`. Private/vault products cannot be reached through post ids, product search or direct product ids.
- Product cards expose only `rrpPrice` (retail); wholesale/cost values are never serialized into fashion content.
- Report creation is rate limited (10/h per viewer); appeal creation 5/day per account; comment creation 6/min; product click 60/10min.
- Only the comment author can delete a comment. Only editors (`content.gallery`) can unpublish content or restore appeals.

## 13. Media pipeline

- Web: images are compressed client-side; videos require a JPEG poster and MP4/WebM/MOV ≤20MB / ≤180s; uploads go through `/api/fashion/posts/mixed` (multipart) with signed asset storage.
- Mini program: `/api/fashion/posts/mixed/assets` stores each asset and returns a signed token; `/api/fashion/posts/mixed` (JSON manifest) validates every token (account, kind, type), enforces ≤8 items and ≤50MB total, then creates the post as `pending`. This closed a real gap: the endpoints used by the mini program composer did not exist before this stage.
- Private R2 objects are served through `/api/fashion/community/:postId/media/:index/:kind`; deleted/unpublished posts stop resolving.
- Video transcoding / multi-bitrate CDN was **not** added. The pipeline preserves the original file; if multi-bitrate is required, evaluate the existing R2 plus a transcoding worker as a separate ADR (cost/egress decision).

## 14. Three-end UI

Web (shared desktop/mobile component):
- 关注 tab renders the real immersive feed (server `following=true`) with empty-state guidance; the merchant carousel moved to its own `stores` mode so it can never masquerade as "following".
- 最新 / 收藏 tabs added; un-saving inside 收藏 removes the card immediately.
- Creator profile overlay: avatar, name, bio, merchant chip, real counts, follow/unfollow, 3-column work grid, deep links `/creators/<id>` and `?creator=<id>`, 404/network states, share-link copy.
- Comments: one-level replies, reply banner, load more, delete own, report; counts refresh from the server after each write.
- Composer: owner-scoped product search, up to 6 products, chips, "account not linked to merchant" guidance.
- Feed/detail: product pill with real name/style/retail price; tap records the click and opens the canonical product detail page.
- Report dialog with fixed reasons and duplicate handling.
- Deep-link bug fixed: the URL-sync effect used to delete `?post=` before the feed opened, so shared links landed on the first item. Verified by asserting the active card id after load.

Mini program:
- Product picker now calls the owner-scoped endpoint and submits `productIds` (previously a single `productId` to an endpoint that did not exist).
- Comments support replies, delete-own, report, load more, and `displayName`/`mine` mapping.
- Following/收藏 modes and creator profile were already present from Stage 1 and now share the same authoritative endpoints.

## 15. Verification performed (2026-10-28)

- `npx tsc --noEmit` → exit 0 (server + Web + admin).
- `node --import tsx --test tests/fashion-community-integrity.test.ts` → **12/12 pass** (following feed, replies, product authorisation, moderation loop, mini token composer).
- `npm run build` → exit 0 (`dist/server.cjs` 3.5MB, all apps built).
- Published `frontend-web` `20261028081921597-7eed2591`, `platform-admin-web` `20261028083054736-2170a303`, `platform-admin-mobile` `20261028083057672-df757b30`; PM2 `ruda-fashion` restarted.
- `npx prisma migrate status` → **Database schema is up to date** (145 migrations).
- API probes (127.0.0.1:3000): feed 200 with `products[]`; `products/search`, `following=true`, `account/saved`, `mixed/assets`, `admin/reports` → 401 unauthenticated; `POST /reports` empty body → 400, valid target → 201; `/trends` 200.
- Playwright (Chromium 1243) at 1440×900 and 390×844 on the production build: 14/14 checks passed — trends page, `?post=` opens the **matching** post, product pill renders, comments sheet opens, report dialog with 7 reasons, creator page loads a real profile, product pill navigates to product detail. Evidence: `/tmp/fashion-shots/*.png` and `report.json`. A temporary approved post + product link + report row were created only for this run and deleted afterwards (`FashionCommunityReport=0`, test post/link=0).
- Console errors during acceptance were only expected anonymous 401s (account-scoped endpoints) and one external media `ERR_FAILED`; no React page errors.

Not verified (honest status):
- Mini program was **not** run in WeChat DevTools/device here. Code compiles (tsc/build) and contracts are covered by tests, but picker/permissions/playback must be re-checked on device before claiming device acceptance.
- Admin moderation UI was built and type-checked but not visually exercised (no admin session/credentials available here).
- Following/收藏/comment publishing were not end-to-end tested with a signed-in account; endpoint 401 boundaries and anonymous UI states were verified.

## 16. Risks and rollback

- Rate limiting is still in-process (`fashionRateLimits` Map): a restart clears it and multiple instances do not share counters. Move to the shared limiter before scaling.
- Product linking requires a merchant identity on the fashion account. The admin API can attach products, but the admin UI does not expose product attachment yet.
- Mini program device acceptance outstanding (see §15).
- Editorial imagery licensing remains a legal check (14 editorial rows predate this stage).
- Rollback: publish the previous frontend release (`npm run rollback:app frontend-web` or `current.previous.json`), restore `dist/server.cjs.bak-20261028-0820`, restart PM2. Stage 2 schema changes are additive (new tables/columns); rolling back code leaves them unused and safe. Do not drop tables without a separate approved plan.
## 17. Stage 3 completeness pass (2026-10-28)

This pass closed the social graph, notification, draft and discovery gaps that Stage 2
left as UI-only or missing. It does not replace the Stage 2 moderation/product work.

### 17.1 New data model (migration `20261028200000_fashion_social_completeness`)

| Model | Purpose | Key constraints |
| --- | --- | --- |
| `FashionCommunityNotification` | In-app activity feed for likes, comments, replies, follows and moderation | recipient-scoped indexes, `readAt`, never created for self-actions |
| `FashionCommunityBlock` | One user blocking another | unique `(blockerId, blockedId)`, removes both follow directions |
| `FashionCommunityDraft` | Server-side drafts that survive reloads/devices | account-scoped, stores media upload tokens and product ids |
| `FashionCommunityHiddenPost` | Persisted "not interested" feedback | unique `(accountId, postId)`, excluded from that viewer's feed |

### 17.2 New API surface

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `GET /api/fashion/notifications` | fashion account | offset pagination, unread count, 50 max |
| `GET /api/fashion/notifications/unread-count` | optional | returns 0 for anonymous visitors |
| `POST /api/fashion/notifications/read` | fashion account | `{ ids }` or `{ all: true }` |
| `DELETE /api/fashion/notifications/:id` | fashion account | recipient-scoped delete |
| `GET /api/fashion/blocks` | fashion account | blocked account cards |
| `POST /api/fashion/blocks` | fashion account | validates target, removes likes? no: removes follows both ways |
| `DELETE /api/fashion/blocks/:accountId` | fashion account | unblock |
| `POST/DELETE /api/fashion/posts/:id/hide` | fashion account | "not interested", feed excludes it server-side |
| `GET /api/fashion/drafts` | fashion account | 30 most recent |
| `POST /api/fashion/drafts` | fashion account | validates category, city, hashtags, product authorisation |
| `PATCH/PUT /api/fashion/drafts/:id` | fashion account | owner only |
| `DELETE /api/fashion/drafts/:id` | fashion account | owner only |
| `GET /api/fashion/creators/:id/followers` | optional | account cards + viewer follow state |
| `GET /api/fashion/creators/:id/following` | optional | same shape |
| `GET /api/fashion/tags` | public | real hashtag counts + category counts |
| `GET /api/fashion/account/analytics` | fashion account | per-post views/likes/comments/saves/product clicks |

### 17.3 Write-path rules

- Notifications are written only after the reaction/follow/comment transaction commits,
  are deduplicated by the action itself, and never notify the actor about their own action.
- Comment replies notify the parent comment author; top-level comments notify the post owner.
- Blocking requires an existing target account and also removes follow edges in both directions.
- Feed queries for a signed-in viewer exclude blocked creators and hidden posts at the SQL
  level, so refreshing or switching client devices cannot bypass the preference.
- Draft media is uploaded through `/api/fashion/posts/mixed/assets` with `draft=true`, which
  extends the upload token to 30 days; publishing a resumed draft reuses those tokens, so
  multi-image/video drafts survive a reload.

### 17.4 Three-end status

| Capability | Web | Mobile web | Mini program | Status |
| --- | --- | --- | --- | --- |
| Notifications list + unread badge | yes | shared component | 消息 drawer | 已完成 |
| Followers / following lists | modal from creator page | shared | creator page (existing) | 已完成（小程序沿用现有创作者页） |
| Server drafts (text/metadata/media tokens) | composer 草稿箱 | shared | 云端草稿列表（恢复/删除/发布后清理） | 已完成（待真机验收） |
| Not interested / block | feed menu + creator page | shared | 服务端 hide + 创作者页屏蔽 | 已完成（待真机验收） |
| Tag discovery | filter panel hot topics | shared | 分类栏话题条 | 已完成 |
| Search (posts/creators/merchants) | real `/api/fashion/search` results | shared | existing search | 已完成 |
| Creator analytics | 作品数据 panel | shared | 作品数据 panel（播放/完播/商品点击） | 已完成（待真机验收） |
| Product links / click tracking | Stage 2 | Stage 2 | Stage 2 | 已完成 |

### 17.5 Verification (this pass)

- `npx tsc --noEmit`: no errors.
- `node --import tsx --test tests/fashion-community-integrity.test.ts`: 20/20 pass (includes the Stage 4 season case, see §18.5).
- `node --check miniprogram/pages/fashion/index.js` and `node --check miniprogram/utils/api.js`: pass.
- `npm run build:app:frontend-web`: pass (release `20261028112720507-1315f72c`, not published).
- `node --import tsx --test tests/miniprogram-fashion-parity.test.ts`: 9/9 pass.
- `node scripts/fashion-stage3-e2e.mjs` against production build on :3011: 25/25 pass,
  covering like/comment/reply/follow notifications, read-all, followers list, draft
  create/list/update/delete, hide/unhide feed filtering, block/unblock feed filtering,
  analytics, tags, search and author soft-delete.
- `FASHION_BASE_URL=http://127.0.0.1:3011 node scripts/fashion-acceptance.mjs`: 8/8 checks,
  screenshots in `docs/engineering/evidence/fashion-stage3`.
- `node scripts/fashion-stage3-ui.mjs`: signed-in browser pass for the notification drawer,
  API-backed search and draft save (screenshots in `docs/engineering/evidence/fashion-stage3`).
- `node --check` on the mini program page/API files and an HTML tag-balance check on the
  fashion WXML both pass. WeChat DevTools/real-device execution is still not available in
  this environment.

### 17.6 Known limits

- Mini program drafts are now server-backed (cloud list/restore/delete/publish cleanup); WeChat
  DevTools/real-device validation is still pending.
- Mini program has block/unhide and an analytics sheet wired to the real API; real-device validation pending.
- Notification delivery is in-app only (no WeChat subscription message / push).
- Tag counts depend on posts actually carrying hashtags; the legacy seeded gallery has none,
  so the tag row is hidden until creators tag posts.
- Rate limiting for the new writes is still in-process (`consumeFashionRateLimit`), same as
  Stage 2; it must move to a shared store before horizontal scaling.
## 18. Stage 4 — season (2026-10-28)

### 18.1 Scope

Adds an optional `season` attribute to community posts and drafts so the Web, mobile web and
mini program can filter the same feed by `春季 / 夏季 / 秋季 / 冬季`. It does not introduce a
second taxonomy: the value is stored verbatim on the existing `FashionCommunityPost` /
`FashionCommunityDraft` rows, and legacy rows keep `null` (visible in the unfiltered feed).

### 18.2 Data model

Migration `20261028210000_fashion_season` adds:

```
FashionCommunityPost.season   String?   -- 春季 | 夏季 | 秋季 | 冬季 | null
FashionCommunityDraft.season  String?   -- same vocabulary, '' means unspecified
```

Verified in the production database:

```
select table_name, column_name from information_schema.columns
  where column_name='season' and table_name like 'FashionCommunity%';
-- FashionCommunityPost|season
-- FashionCommunityDraft|season
```

`prisma generate` was run so `@prisma/client` includes the field (checked in
`node_modules/.prisma/client/schema.prisma`).

### 18.3 API contract

| Endpoint | Change |
| --- | --- |
| `GET /api/fashion/posts` | Optional `season` query. Non-vocabulary value → `400 FASHION_POST_SEASON_INVALID`. Valid value filters `post.season === season` after the existing visibility/block/hide filters, and before pagination. Every post payload now includes `season`. |
| `POST /api/fashion/posts` | Optional `season` in the JSON body; `''` = unspecified; invalid → `400 FASHION_POST_SEASON_INVALID`. |
| `POST /api/fashion/posts/mixed` | Optional `season` form field, same validation and storage. |
| `POST|PATCH /api/fashion/drafts` | `season` normalised through `fashionCommunitySeasons`, blank when unknown; draft list/create/patch responses return `season`. |

Season is additive and optional: clients that never send it keep the previous behaviour, so old
app builds remain compatible during the rollout window.

### 18.4 Client behaviour

- Web `FashionTrendsView.tsx`: filter panel season chips (draft state applied on confirm), an
  active-season chip in the feed toolbar, composer `select`, draft restore, and the publish
  payload/form field. The `season` query is appended to both pagination paths (`offset=0` and
  cursor).
- Mini program `pages/fashion`: season chip row under the category row
  (`seasonOptions = ['不限季节', ...fashionSeasons]`), composer `picker`, publish payload,
  server draft restore and the local draft snapshot (`postSeasonIndex`).
- Both clients keep an explicit "no season" option so existing content is never mislabelled.

### 18.5 Verification (this pass)

- `npx tsc --noEmit` → exit 0, no output.
- `node --check miniprogram/pages/fashion/index.js`, `node --check miniprogram/utils/api.js` → exit 0.
- `node --import tsx --test tests/miniprogram-fashion-parity.test.ts` → 10/10 pass.
- `node --import tsx --test tests/fashion-community-integrity.test.ts` → 20/20 pass
  (new case covers schema fields, all three write paths, feed filter and the shared vocabulary).
- Runtime probe against a `tsx server.ts` instance on `127.0.0.1:3012` (production database,
  read-only requests): baseline `200` with 5 posts, `?season=夏季` `200`, `?season=2026` `400
  FASHION_POST_SEASON_INVALID`.

### 18.6 Deployment (production, 2026-10-28)

- `npm run build` → server bundle `dist/server.cjs` rebuilt (13:42Z) and all six app targets got new
  releases; `dist/apps/<target>/current.json` now points at the new release ids
  (`frontend-web 20261028134234636-3207531a`, `frontend-mobile 20261028134237198-db80650d`,
  `platform-admin-web 20261028134251181-d6987c46`, `platform-admin-mobile 20261028134252889-c60ca84d`).
- Backup before deploy: `/tmp/ruda-rollback-s4/server.cjs.bak` plus every `dist/apps/*/current.json`.
- `pm2 restart ruda-fashion` (`dist/server.cjs`, `PORT=3011`, `NODE_ENV=production`) → online, PID 248062.
- Post-restart probes on the live process:
  `GET /` → 200, `GET /api/fashion/posts?limit=2` → 200,
  `GET /api/fashion/posts?season=夏季&limit=2` → 200,
  `GET /api/fashion/posts?season=2026&limit=2` → `400 {"success":false,"error":"FASHION_POST_SEASON_INVALID"}`.
- Rollback: copy the backed-up `server.cjs` back and restore the five `current.json` files, then
  `pm2 restart ruda-fashion`. The migration only adds nullable columns, so no data rollback is needed.
- Browser acceptance against the live build:
  `FASHION_BASE_URL=http://127.0.0.1:3011 FASHION_SHOT_DIR=docs/engineering/evidence/fashion-stage4 node scripts/fashion-acceptance.mjs`
  → 14/14 checks pass, including the three new season checks on desktop and mobile. Screenshots:
  `docs/engineering/evidence/fashion-stage4/{desktop,mobile}-08-season-filter.png` (season row renders
  `全部季节 / 春季 / 夏季 / 秋季 / 冬季`, 夏季 selected, single line on 390px).
- `.agents/skills/impeccable/scripts/impeccable detect src/apps/shared/components/frontend` → exit 0
  after registering the documented `Inter` design-system exemption in `.impeccable/config.json`;
  no findings in `FashionTrendsView.tsx`.

### 18.7 Known limits

- No production post currently carries a season, so "filter returns rows" has no live data yet; the
  request contract and the empty-result state are verified, the populated-result state is not.
- Mini program season chips/picker are code- and template-checked only; WeChat DevTools and a
  real device were not available in this environment (`待验证`).
- `consumeFashionRateLimit` is still an in-process `Map` (server.ts:21414). The service runs as a
  single PM2 instance, so the limits hold today, but a shared store (Redis/Postgres) is still required
  before running more than one instance — unchanged from §17.6, not delivered in this pass.
- Editorial (`/api/fashion/editorial`) content is served from the configured RSS/feed sources; their
  copyright/licensing status is an external asset question and was not verified here.

## 19. Stage 5 — governance, shared limits, recommendation and rights (2026-10-28)

### 19.1 Scope and reuse

Stage 5 closes the items Stage 3/4 explicitly left open. Nothing existing was rebuilt:

| Area | Reused | Added in Stage 5 |
| --- | --- | --- |
| Moderation | `FashionCommunityReport`, `FashionCommunityAppeal`, `PATCH /api/admin/fashion/reports/:id` | account-level restrictions, account console, notification on decision |
| Categories | static `fashionCommunityCategories`, `/api/fashion/tags` | `FashionTaxonomyTerm`, public taxonomy endpoint, admin CRUD + merge, publish/filter validation |
| Media health | existing upload/poster pipeline, private media route | `FashionMediaEvent`, recording on real failures, retry against object storage |
| Rate limiting | `consumeFashionRateLimit` call sites | PostgreSQL `RateLimitCounter` + atomic upsert (`src/server/fashionRateLimit.ts`) |
| Recommendation | existing feed scoring (views, completion, reactions, follows, diversity) | tag affinity, repeat/skip control, creator page cap, explicit cold start |
| Notifications | `DELETE /api/fashion/notifications/:id` (server only, unused by clients) | Web single-delete, mini program single-delete |
| Editorial | `/api/fashion/editorial` | rights remediation script + evidence file |

### 19.2 Data model (additive)

Migration `prisma/migrations/20261028220000_fashion_governance/migration.sql`:

- `FashionTaxonomyTerm(id, kind[category|tag], name, slug, status[active|disabled|merged], mergedInto, sortOrder, createdBy)` — unique `(kind,name)` and `(kind,slug)`; seeded with the six pre-existing categories.
- `FashionCommunityAccountRestriction(accountId, kind[limited|suspended], reason, reportId, status[active|lifted|expired], scope jsonb, appliedBy, appliedAt, expiresAt, liftedBy/At/Reason)`.
- `FashionMediaEvent(postId, accountId, stage[upload|poster|access|transcode], status[failed|resolved|ignored], code, detail, lastError, attempts, resolvedBy/At)`.
- `RateLimitCounter(key PK, count, windowStart, expiresAt)`.

No column, table or row is dropped; a code-only rollback is safe because the new tables become inert.

### 19.3 API contracts (admin routes require `requireAdminAuth` + `content.gallery`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/fashion/taxonomy` | public; active categories/tags, static fallback when empty |
| GET | `/api/admin/fashion/taxonomy?kind=` | includes per-term usage counts computed from posts |
| POST | `/api/admin/fashion/taxonomy` | `{kind,name,slug?,sortOrder?}`; `409 FASHION_TAXONOMY_TERM_EXISTS` on duplicates |
| PATCH | `/api/admin/fashion/taxonomy/:id` | rename (rewrites posts/hashtags in one transaction), enable/disable, sort |
| POST | `/api/admin/fashion/taxonomy/:id/merge` | `{targetId}`; migrates rows, marks source `merged` |
| GET | `/api/admin/fashion/accounts?query=` | accounts with post/published/open-report counts and active restriction |
| GET | `/api/admin/fashion/accounts/:id` | profile + posts + reports + restriction history + appeals |
| POST | `/api/admin/fashion/accounts/:id/restrictions` | `{kind,reason,days?}`; enforced on later writes, notifies author |
| POST | `/api/admin/fashion/restrictions/:id/lift` | `{reason}`; notifies author |
| GET | `/api/admin/fashion/media-events?status=&stage=` | status counts + linked post |
| POST | `/api/admin/fashion/media-events/:id/retry` | HEAD-checks every storage key; resolves only when all exist |
| POST | `/api/admin/fashion/media-events/:id/ignore` | `{reason}`; keeps the audit trail |

`limited`/`suspended` are enforced at: comment creation, `POST /api/fashion/posts`, `POST /api/fashion/posts/video`,
`POST /api/fashion/posts/mixed/assets`, `POST /api/fashion/posts/mixed`, `PATCH /api/fashion/posts/:id`, and
reaction/follow for `suspended`. Response: `403 FASHION_ACCOUNT_RESTRICTED` with `kind`, `reason`, `expiresAt`.

### 19.4 Shared rate limiting

`consumeSharedRateLimit` performs a single `INSERT … ON CONFLICT DO UPDATE … RETURNING "count"` on
`RateLimitCounter`. Consequences:

- concurrent workers increment the same row, so `limit` is a hard cap across processes;
- counters survive restarts (verified against the production database);
- an expired window restarts at 1 without any cron job;
- expired rows are purged opportunistically (at most once per minute);
- if PostgreSQL is unavailable the caller falls back to the previous in-process Map and logs once, so the API
  degrades instead of failing closed.

All eleven fashion call sites were converted to `await consumeFashionRateLimit(...)`.

### 19.5 Recommendation changes

Only the database-backed feed path changed:

- **Tag affinity** from saved/liked posts (weight 0.5) and recent watches (0.35 × recency), capped at +10.
- **Repeat control**: posts watched in the last 7 days leave the candidate pool while at least two pages of
  candidates remain, so a viewer is not re-served the same videos (and the feed never goes empty).
- **Skip signal**: an incomplete view in the last 7 days applies −15, so abandoned videos rank lower.
- **Creator cap**: at most `max(2, ceil(limit/4))` posts per creator per page, on top of the existing
  “no 3 in a row / no 3 of one category in 5 slots” pass.
- **Cold start**: a viewer with no reactions/views/follows is ranked by
  `engagement×0.4 + views×0.2 + completion×10 + freshness×60` instead of an empty personalisation profile.

### 19.6 Editorial rights remediation

`/api/fashion/editorial` surfaced 14 seeded `fashion-demo-*` posts whose media came from third-party runway
galleries (Vogue), a Getty image and TikTok captures; no commercial licence could be produced.
`scripts/fashion-editorial-rights.ts` (idempotent, run 2026-10-28) therefore:

- replaced the 10 image posts with RUDA-owned typographic covers in `public/fashion/editorial/`
  (`rightsStatus = owned`),
- unpublished the 4 video posts (`rightsStatus = unverified`; rows and original URLs retained),
- returned approved web-collected feed items to `pending`,
- wrote the before/after mapping to `docs/engineering/evidence/fashion-stage5/editorial-rights.json`.

### 19.7 Verification (commands actually run)

- `npx prisma migrate deploy` → `20261028220000_fashion_governance` applied (148 migrations).
- `npx tsx scripts/fashion-rate-limit-check.ts` → `ok: true`; 40 concurrent attempts with `limit=10` allowed
  exactly 10, a fresh Prisma client was still blocked (persistence), a 1 s window reset to allow again.
- `node --import tsx --test tests/fashion-governance.test.ts` → 10/10 pass.
- `node --import tsx --test tests/fashion-community-integrity.test.ts tests/miniprogram-fashion-parity.test.ts`
  → 30/30 pass.
- `npx tsc --noEmit` → exit 0.
- `npx tsx scripts/fashion-editorial-rights.ts` → `{ replaced: 10, withdrawn: 4 }`; `/api/fashion/editorial`
  now returns 10 items pointing at `public/fashion/editorial/ruda-editorial-2026-*.jpg`.
- `FASHION_BASE_URL=http://127.0.0.1:3011 FASHION_SHOT_DIR=docs/engineering/evidence/fashion-stage5 node scripts/fashion-acceptance.mjs`
  → 14/14 checks pass (desktop + mobile, incl. season filter); screenshots `desktop-*.png`, `mobile-*.png`.
- Admin console (`https://admin.ruda.fashion`, real production session):
  `GET /api/admin/fashion/taxonomy` 200, `GET /api/admin/fashion/accounts` 200 (2 accounts),
  `GET /api/admin/fashion/media-events` 200, `POST /api/admin/fashion/taxonomy` 201,
  `PATCH /api/admin/fashion/taxonomy/:id` 200, `POST .../restrictions` 201, `GET .../accounts/:id` 200,
  `POST .../restrictions/:id/lift` 200. The test account/term/notification rows were deleted afterwards.
  Screenshots: `admin-01-governance-reports.png`, `admin-02-taxonomy.png`, `admin-03-users.png`,
  `admin-04-media.png` (taxonomy shows real usage counts 女装趋势 7 / 男装趋势 3 / 包袋配饰 1 / 秀场街拍 3).
- `.agents/skills/impeccable/scripts/impeccable detect src/apps/platform-admin-common/components/admin src/apps/shared/components/frontend`
  → exit 0.
- `git diff --check` → exit 0.
- Full suite `node --import tsx --test tests/*.test.ts` → 1042/1044 pass; the two failures are pre-existing
  (see §19.10), not introduced here.

### 19.8 Known limits (Stage 5)

- Mini program taxonomy and notification-delete changes are code-checked only; WeChat DevTools and a real device
  remain unavailable in this environment (`待验证`).
- The `transcode` media stage exists in the schema, but there is no server-side transcoder yet, so no events are
  written for that stage.
- Retry verifies storage availability; it cannot regenerate a missing poster because posters are client-supplied.
- Commerce attribution (曝光 → 点击 → 店铺 → 询价 → 订单) is **not** implemented in this stage. The existing
  product-click counter and merchant product/permission rules are unchanged; see §19.9 for the follow-up design
  constraint.

### 19.9 Follow-up: commerce attribution (not started)

Current facts (verified in code, 2026-10-28):

- `FashionCommunityProductClick` records a post→product tap, deduplicated per viewer per hour; it is a click
  signal only and must never be reported as an order.
- Product taps go through `POST /api/fashion/posts/:id/products/:productId/click`, which reuses the existing
  product visibility rules; authorisation for attaching products is `validateFashionPostProductIds`.
- Inquiries/quotes live in `SalesQuote`/`SalesQuoteItem` (merchant-created) and `ProductReservationRequest`;
  orders live in `Order`. None of them currently store the originating fashion post.

To close the chain correctly the next stage must:

1. Persist a server-side attribution token (post id + viewer/customer identity + product id + timestamp) when a
   tap happens, instead of trusting a client-supplied `postId` later.
2. Add nullable `sourceFashionPostId` columns to the inquiry/quote and order records, written only after the
   underlying business record is actually created, with the same tenant checks as today.
3. Expose post-level funnel numbers (views, unique clicks, inquiries, paid orders, GMV) to the merchant who owns
   the product and to the platform console, computed by joining those real records — never from client counters.
4. Ship an idempotent migration plus backfill = `NULL` for legacy rows; no existing business data is rewritten.

Until those four items exist, the admin console must not display “orders from posts”.

### 19.10 Pre-existing test debt observed (not introduced by Stage 5)

Running the whole suite surfaced two failures that already exist on `xin2026`:

1. `tests/growth-migrations.test.ts` — two migrations share the timestamp `20261023130000`
   (`app_store_email_domain_scope` and `store_access_credentials`), and **both are already recorded in
   `_prisma_migrations`** in production. Renaming one now would break `prisma migrate deploy`, so it must be
   fixed with a controlled rename + history update, not silently in this stage.
2. `tests/ui-translation-copy.test.ts` — the UI copy catalog is missing 192 `localizeCopy(...)` pairs that
   predate Stage 5 (the Stage 5 additions were added to the catalog and no longer appear in the report).

Neither affects the fashion feature; they are recorded so they are not mistaken for regressions.






