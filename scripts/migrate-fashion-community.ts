import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path, { resolve, sep } from 'node:path';
import dotenv from 'dotenv';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

dotenv.config({ quiet: true });

type LegacyPost = {
  id: string;
  image: string;
  merchantId: string;
  merchantName: string;
  createdAt: string;
  featured?: boolean;
  title?: string;
  caption?: string;
  category?: string;
  mediaType?: string;
  videoUrl?: string;
  videoStorageKey?: string;
  imageStorageKey?: string;
  posterStorageKey?: string;
  rightsStatus?: string;
  publicationStatus?: string;
};

type LegacyComment = {
  id: string;
  viewerId: string;
  displayName: string;
  text: string;
  createdAt: string;
};

type LegacySocial = {
  likes?: string[];
  saves?: string[];
  followers?: string[];
  comments?: LegacyComment[];
};

const prisma = new PrismaClient();
const root = process.cwd();
const postsPath = path.join(root, 'logs', 'shared-gallery.json');
const socialPath = path.join(root, 'logs', 'fashion-social.json');
const apply = process.argv.includes('--apply');
const sourceCheckOnly = process.argv.includes('--source-check');
const storageEndpoint = process.env.OBJECT_STORAGE_ENDPOINT;
const storageBucket = process.env.OBJECT_STORAGE_BUCKET;
const storagePublicBaseUrl = process.env.OBJECT_STORAGE_PUBLIC_BASE_URL?.replace(/\/+$/, '');
const storageClient = storageEndpoint && process.env.OBJECT_STORAGE_ACCESS_KEY_ID && process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY
  ? new S3Client({
    region: process.env.OBJECT_STORAGE_REGION || 'auto',
    endpoint: storageEndpoint,
    forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY
    }
  })
  : null;
const uploadedKeys: string[] = [];
async function cleanupUploadedMedia() {
  if (!storageClient || !storageBucket) return;
  const keys = uploadedKeys.splice(0);
  await Promise.all(keys.map(async key => {
    try {
      await storageClient.send(new DeleteObjectCommand({ Bucket: storageBucket, Key: key }));
    } catch (error) {
      console.error('[fashion-community-media-cleanup]', key, error);
    }
  }));
}

function requireDate(value: string, source: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid date in ${source}`);
  return date;
}

async function migrateLegacyMedia(value: string | undefined, mediaType: 'image' | 'video') {
  if (!value || (!value.startsWith('data:') && !value.startsWith('/uploads/'))) return undefined;
  if (!storageClient || !storageBucket || !storagePublicBaseUrl) {
    throw new Error('Migrating embedded or local community media requires configured object storage and a public CDN URL');
  }

  let bytes: Buffer;
  let contentType: string;
  let extension: string;
  const dataUrlMatch = mediaType === 'image'
    ? /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i.exec(value)
    : null;
  if (dataUrlMatch) {
    contentType = dataUrlMatch[1].toLowerCase();
    bytes = Buffer.from(dataUrlMatch[2], 'base64');
    if (!bytes.length || bytes.toString('base64') !== dataUrlMatch[2]) throw new Error('Invalid embedded community image data');
    extension = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
  } else if (/^\/uploads\/fashion\/[a-f0-9-]+\.(mp4|webm|mov|jpg|jpeg|png|webp)$/i.test(value)) {
    const publicDirectory = resolve(root, 'public');
    const filePath = resolve(publicDirectory, value.slice(1));
    if (!filePath.startsWith(`${publicDirectory}${sep}`)) throw new Error('Invalid local media path in community source');
    bytes = await readFile(filePath);
    extension = path.extname(filePath).slice(1).toLowerCase();
    contentType = extension === 'webm' ? 'video/webm'
      : extension === 'mov' ? 'video/quicktime'
        : extension === 'mp4' ? 'video/mp4'
          : extension === 'png' ? 'image/png'
            : extension === 'webp' ? 'image/webp'
              : 'image/jpeg';
    if ((mediaType === 'video') !== contentType.startsWith('video/')) {
      throw new Error(`Media type mismatch for local asset ${path.basename(filePath)}`);
    }
  } else {
    throw new Error('Unsupported embedded or local media reference in community source');
  }

  const key = `fashion/community/migration/${randomUUID()}.${extension}`;
  await storageClient.send(new PutObjectCommand({
    Bucket: storageBucket,
    Key: key,
    Body: bytes,
    ContentType: contentType,
    CacheControl: 'public,max-age=31536000,immutable'
  }));
  uploadedKeys.push(key);
  return { url: `${storagePublicBaseUrl}/${key}`, key };
}

async function readJson<T>(filePath: string, allowMissing = false): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if (allowMissing && error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {} as T;
    }
    throw error;
  }
}

async function main() {
  const legacyPosts = await readJson<unknown>(postsPath);
  const legacySocial = await readJson<Record<string, LegacySocial>>(socialPath, true);
  if (!Array.isArray(legacyPosts)) throw new Error('shared-gallery.json must contain an array');

  const posts = (legacyPosts as LegacyPost[]).filter(post => post?.merchantId === 'public-fashion');
  const postIds = new Set<string>();
  for (const post of posts) {
    if (!post || typeof post.id !== 'string' || !post.id || typeof post.image !== 'string'
      || typeof post.merchantName !== 'string' || typeof post.createdAt !== 'string') {
      throw new Error('A community post is missing a required field');
    }
    if (postIds.has(post.id)) throw new Error(`Duplicate community post id: ${post.id}`);
    postIds.add(post.id);
    requireDate(post.createdAt, `post ${post.id}`);
  }

  const reactions: Array<{ id: string; contentId: string; postId: string | null; viewerId: string; reaction: string }> = [];
  const follows: Array<{ id: string; creatorId: string; viewerId: string }> = [];
  const followKeys = new Set<string>();
  const comments: Array<{ id: string; contentId: string; postId: string | null; viewerId: string; displayName: string; text: string; createdAt: Date }> = [];
  for (const [socialId, state] of Object.entries(legacySocial || {})) {
    const isCommunityPost = postIds.has(socialId);
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(socialId)) throw new Error(`Invalid social content id: ${socialId}`);
    if (!state || typeof state !== 'object') throw new Error(`Invalid social data for post: ${socialId}`);
    for (const [reaction, viewers] of [['like', state.likes || []], ['save', state.saves || []]] as const) {
      if (!Array.isArray(viewers)) throw new Error(`Invalid ${reaction} list for post: ${socialId}`);
      for (const viewerId of viewers) {
        if (typeof viewerId !== 'string' || !/^[a-f0-9-]{36}$/i.test(viewerId)) {
          throw new Error(`Invalid viewer id in ${reaction} list for post: ${socialId}`);
        }
        reactions.push({ id: randomUUID(), contentId: socialId, postId: isCommunityPost ? socialId : null, viewerId, reaction });
      }
    }
    if (!Array.isArray(state.followers || [])) throw new Error(`Invalid followers list for post: ${socialId}`);
    for (const viewerId of state.followers || []) {
      if (typeof viewerId !== 'string' || !/^[a-f0-9-]{36}$/i.test(viewerId)) {
        throw new Error(`Invalid viewer id in followers list for post: ${socialId}`);
      }
      const creatorId = isCommunityPost ? 'creator-ruda-community' : socialId;
      const key = `${creatorId}:${viewerId}`;
      if (!followKeys.has(key)) {
        follows.push({ id: randomUUID(), creatorId, viewerId });
        followKeys.add(key);
      }
    }
    if (!Array.isArray(state.comments || [])) throw new Error(`Invalid comments list for post: ${socialId}`);
    for (const comment of state.comments || []) {
      if (!comment || typeof comment.id !== 'string' || typeof comment.viewerId !== 'string'
        || typeof comment.displayName !== 'string' || typeof comment.text !== 'string'
        || typeof comment.createdAt !== 'string' || !/^[a-f0-9-]{36}$/i.test(comment.viewerId)) {
        throw new Error(`Invalid comment in legacy social data for post: ${socialId}`);
      }
      comments.push({ ...comment, contentId: socialId, postId: isCommunityPost ? socialId : null, createdAt: requireDate(comment.createdAt, `comment ${comment.id}`) });
    }
  }

  const expected = { posts: posts.length, reactions: reactions.length, follows: follows.length, comments: comments.length };
  const mediaReferences = {
    localUploads: posts.filter(post => [post.image, post.videoUrl || ''].some(url => url.startsWith('/uploads/'))).length,
    embeddedImages: posts.filter(post => post.image.startsWith('data:image/')).length
  };
  if (sourceCheckOnly) {
    console.log(JSON.stringify({ mode: 'source-check-only', expected, mediaReferences }, null, 2));
    return;
  }
  if (!apply) {
    const existing = {
      posts: await prisma.fashionCommunityPost.count(),
      reactions: await prisma.fashionCommunityReaction.count(),
      follows: await prisma.fashionCommunityFollow.count(),
      comments: await prisma.fashionCommunityComment.count()
    };
    console.log(JSON.stringify({ mode: 'check-only', expected, existing }, null, 2));
    return;
  }

  const existingCounts = await Promise.all([
    prisma.fashionCommunityPost.count(),
    prisma.fashionCommunityReaction.count(),
    prisma.fashionCommunityFollow.count(),
    prisma.fashionCommunityComment.count()
  ]);
  if (existingCounts.some(count => count !== 0)) {
    throw new Error('Import requires empty Fashion Community tables; refusing to overwrite production data');
  }

  let migratedPosts: LegacyPost[];
  try {
    migratedPosts = [];
    for (const post of posts) {
      const migratedImage = await migrateLegacyMedia(post.image, 'image');
      const migratedVideo = await migrateLegacyMedia(post.videoUrl, 'video');
      migratedPosts.push({
        ...post,
        image: migratedImage?.url || post.image,
        ...(migratedImage ? post.mediaType === 'video'
          ? { posterStorageKey: migratedImage.key }
          : { imageStorageKey: migratedImage.key } : {}),
        ...(migratedVideo ? { videoUrl: migratedVideo.url, videoStorageKey: migratedVideo.key } : {})
      });
    }
  } catch (error) {
    await cleanupUploadedMedia();
    throw error;
  }

  let imported: { posts: number; reactions: number; follows: number; comments: number };
  try {
    imported = await prisma.$transaction(async transaction => {
      const transactionCounts = await Promise.all([
        transaction.fashionCommunityPost.count(),
        transaction.fashionCommunityReaction.count(),
        transaction.fashionCommunityFollow.count(),
        transaction.fashionCommunityComment.count()
      ]);
      if (transactionCounts.some(count => count !== 0)) {
        throw new Error('Import requires empty Fashion Community tables; refusing to overwrite production data');
      }
      if (migratedPosts.length) {
        await transaction.fashionCommunityPost.createMany({
          data: migratedPosts.map(post => ({
          id: post.id,
          image: post.image,
          merchantId: post.merchantId,
          merchantName: post.merchantName,
          createdAt: requireDate(post.createdAt, `post ${post.id}`),
          featured: Boolean(post.featured),
          title: post.title ?? null,
          caption: post.caption ?? null,
          category: post.category ?? null,
          mediaType: post.mediaType || 'image',
          videoUrl: post.videoUrl ?? null,
          videoStorageKey: post.videoStorageKey ?? null,
          imageStorageKey: post.imageStorageKey ?? null,
          posterStorageKey: post.posterStorageKey ?? null,
          rightsStatus: post.rightsStatus || 'authorized',
          publicationStatus: post.publicationStatus || 'approved',
          engagementScore: (legacySocial[post.id]?.likes?.length || 0) * 2
            + (legacySocial[post.id]?.comments?.length || 0) * 3
            + (legacySocial[post.id]?.saves?.length || 0) * 4,
          updatedAt: new Date()
          }))
        });
      }
      if (reactions.length) await transaction.fashionCommunityReaction.createMany({ data: reactions });
      if (follows.length) await transaction.fashionCommunityFollow.createMany({ data: follows });
      if (comments.length) await transaction.fashionCommunityComment.createMany({ data: comments });

      return {
        posts: await transaction.fashionCommunityPost.count(),
        reactions: await transaction.fashionCommunityReaction.count(),
        follows: await transaction.fashionCommunityFollow.count(),
        comments: await transaction.fashionCommunityComment.count()
      };
    });
  } catch (error) {
    await cleanupUploadedMedia();
    throw error;
  }
  if (JSON.stringify(imported) !== JSON.stringify(expected)) {
    throw new Error(`Post-import verification mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(imported)}`);
  }
  console.log(JSON.stringify({ mode: 'imported-and-verified', imported }, null, 2));
}

main()
  .catch(error => {
    console.error('[fashion-community-migration]', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
