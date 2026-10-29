import 'dotenv/config';
import {
  isExpectedPrimaryRootRedirect,
  validateLocalizedSeoHtml
} from '../src/shared/seoSmoke';
import { SEO_LANGUAGES, SEO_PUBLIC_PAGES } from '../src/shared/seo';

const baseURL = (process.env.SMOKE_BASE_URL || process.env.APP_URL || '').replace(/\/+$/, '');
if (!baseURL) {
  throw new Error('SMOKE_BASE_URL_OR_APP_URL_REQUIRED');
}

async function check(path: string, validate: (payload: unknown) => boolean) {
  const response = await fetch(new URL(path, `${baseURL}/`), {
    redirect: 'error',
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`POST_DEPLOY_SMOKE_HTTP_${response.status}_${path.replaceAll('/', '_')}`);
  const payload: unknown = await response.json();
  if (!validate(payload)) throw new Error(`POST_DEPLOY_SMOKE_RESPONSE_INVALID_${path.replaceAll('/', '_')}`);
}

async function checkPublicSeo() {
  const root = await fetch(new URL('/', `${baseURL}/`), {
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000)
  });
  if (!isExpectedPrimaryRootRedirect(root.status, root.headers.get('location'))) {
    throw new Error(`POST_DEPLOY_SMOKE_ROOT_REDIRECT_INVALID_${root.status}_${root.headers.get('location') || 'missing'}`);
  }

  const localeChecks = SEO_LANGUAGES.flatMap(language =>
    SEO_PUBLIC_PAGES.map(({ page, pathname }) => ({ language, page, pathname }))
  );
  for (let index = 0; index < localeChecks.length; index += 10) {
    await Promise.all(localeChecks.slice(index, index + 10).map(async ({ language, page, pathname }) => {
      const response = await fetch(new URL(`/${language}${pathname === '/' ? '/' : pathname}`, `${baseURL}/`), {
        redirect: 'error',
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
        throw new Error(`POST_DEPLOY_SMOKE_LOCALE_HTTP_INVALID_${language}_${page}_${response.status}`);
      }
      const html = await response.text();
      const errors = validateLocalizedSeoHtml({ html, language, pathname, origin: baseURL, page });
      if (errors.length) {
        throw new Error(`POST_DEPLOY_SMOKE_LOCALE_SEO_INVALID_${language}_${page}_${errors.join(',')}`);
      }
    }));
  }

  const publicFiles = [
    { path: '/sitemap.xml', contentType: 'application/xml', marker: '<urlset' },
    { path: '/robots.txt', contentType: 'text/plain', marker: 'Sitemap:' },
    { path: '/llms.txt', contentType: 'text/plain', marker: '# RUDA Fashion B2B' },
    { path: '/.well-known/ard.json', contentType: 'application/json', marker: '"entries"' },
    { path: '/ai-catalog.json', contentType: 'application/json', marker: '"entries"' }
  ];
  for (const file of publicFiles) {
    const response = await fetch(new URL(file.path, `${baseURL}/`), {
      redirect: 'error',
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok || !response.headers.get('content-type')?.includes(file.contentType)) {
      throw new Error(`POST_DEPLOY_SMOKE_PUBLIC_FILE_INVALID_${file.path.replaceAll('/', '_')}`);
    }
    if (!(await response.text()).includes(file.marker)) {
      throw new Error(`POST_DEPLOY_SMOKE_PUBLIC_FILE_BODY_INVALID_${file.path.replaceAll('/', '_')}`);
    }
  }
}

async function checkAdminApiRouting() {
  const adminOrigin = 'https://admin.ruda.fashion';
  const corsResponse = await fetch(new URL('/api/health', `${baseURL}/`), {
    headers: { Origin: adminOrigin },
    signal: AbortSignal.timeout(10_000)
  });
  if (
    !corsResponse.ok
    || corsResponse.headers.get('access-control-allow-origin') !== adminOrigin
    || corsResponse.headers.get('access-control-allow-credentials') !== 'true'
  ) {
    throw new Error('POST_DEPLOY_SMOKE_ADMIN_CORS_INVALID');
  }

  const adminHealthResponse = await fetch(new URL('/api/admin/health', `${baseURL}/`), {
    headers: { Origin: adminOrigin, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000)
  });
  const contentType = adminHealthResponse.headers.get('content-type') || '';
  const payload: unknown = await adminHealthResponse.json().catch(() => null);
  if (
    ![401, 403].includes(adminHealthResponse.status)
    || !contentType.includes('application/json')
    || !payload
    || typeof payload !== 'object'
    || !('success' in payload)
    || payload.success !== false
  ) {
    throw new Error('POST_DEPLOY_SMOKE_ADMIN_API_ROUTE_INVALID');
  }
}

async function checkMerchantRegistrationRoute() {
  const response = await fetch(new URL('/api/auth/register/merchant/quick', `${baseURL}/`), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(10_000)
  });
  const contentType = response.headers.get('content-type') || '';
  const payload: unknown = await response.json().catch(() => null);
  if (
    response.status !== 400
    || !contentType.includes('application/json')
    || !payload
    || typeof payload !== 'object'
    || !('error' in payload)
    || payload.error !== 'MISSING_FIELDS'
  ) {
    throw new Error('POST_DEPLOY_SMOKE_MERCHANT_REGISTRATION_ROUTE_INVALID');
  }
}

async function checkMiniProgramHomepageVideo() {
  const response = await fetch(new URL(`/videos/ruda-home-hero.mp4?v=${Date.now()}`, `${baseURL}/`), {
    method: 'HEAD',
    signal: AbortSignal.timeout(10_000)
  });
  if (
    !response.ok
    || !response.headers.get('content-type')?.includes('video/mp4')
    || response.headers.get('cross-origin-resource-policy') !== 'cross-origin'
  ) {
    throw new Error('POST_DEPLOY_SMOKE_MINIPROGRAM_HOMEPAGE_VIDEO_INVALID');
  }
}

async function main() {
  const deadline = Date.now() + 60_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await check('/api/health', payload =>
        Boolean(payload && typeof payload === 'object' && (payload as { status?: unknown }).status === 'ok')
      );
      await check('/api/health/ready', payload =>
        Boolean(payload && typeof payload === 'object' && (payload as { status?: unknown }).status === 'ready')
      );
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 2_000));
    }
  }
  if (lastError) throw lastError instanceof Error ? lastError : new Error('POST_DEPLOY_SMOKE_TIMEOUT');
  await checkMerchantRegistrationRoute();
  await checkAdminApiRouting();
  await checkMiniProgramHomepageVideo();
  await checkPublicSeo();
  console.log('Post-deploy smoke passed: health, database readiness, merchant registration route, admin API route/CORS, mini program video CORS policy, all 60 localized public pages, root redirect, and public discovery files.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'POST_DEPLOY_SMOKE_FAILED');
  process.exitCode = 1;
});
