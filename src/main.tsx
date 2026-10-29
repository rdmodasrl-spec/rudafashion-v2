import { getRudaAppManifestPath, resolveRudaAppTarget, type RudaAppTarget } from './apps/appTarget';

type AppReleaseManifest = {
  target: RudaAppTarget;
  releaseId: string;
  entry: string;
  stylesheet: string;
};

const devEntries: Record<RudaAppTarget, () => Promise<unknown>> = {
  'frontend-web': () => import('./apps/frontend-web/main'),
  'frontend-mobile': () => import('./apps/frontend-mobile/main'),
  'merchant-admin-web': () => import('./apps/merchant-admin-web/main'),
  'merchant-admin-mobile': () => import('./apps/merchant-admin-mobile/main'),
  'platform-admin-web': () => import('./apps/platform-admin-web/main'),
  'platform-admin-mobile': () => import('./apps/platform-admin-mobile/main')
};

function showStartupError(error: unknown) {
  console.error('[app-startup] failed:', error);
  const root = document.getElementById('root');
  if (!root) throw new Error('RUDA_APP_ROOT_MISSING');
  root.innerHTML = '';
  const message = document.createElement('div');
  message.className = 'ruda-startup-error';
  message.setAttribute('role', 'alert');
  message.textContent = '页面暂时无法加载，请刷新重试；如果问题持续，请联系 RUDA 客服。';
  root.appendChild(message);
}

function setAppManifest(target: RudaAppTarget) {
  let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    document.head.appendChild(manifestLink);
  }
  manifestLink.href = getRudaAppManifestPath(target, window.location.hostname, window.location.pathname);
}

async function loadProductionApp(target: RudaAppTarget) {
  const response = await fetch(`/apps/${target}/current.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`RUDA_APP_RELEASE_UNAVAILABLE:${target}:${response.status}`);
  const release = await response.json() as AppReleaseManifest;
  const releasePrefix = `/apps/${target}/releases/${encodeURIComponent(release.releaseId)}/`;
  if (
    release.target !== target
    || !/^[0-9]{17}-[a-f0-9]{8}$/.test(release.releaseId)
    || release.entry !== `${releasePrefix}app.js`
    || typeof release.stylesheet !== 'string'
    || !release.stylesheet.startsWith(releasePrefix)
    || !release.stylesheet.endsWith('.css')
    || release.stylesheet.includes('..')
  ) {
    throw new Error(`RUDA_APP_RELEASE_INVALID:${target}`);
  }

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.dataset.rudaRelease = release.releaseId;
  await new Promise<void>((resolve, reject) => {
    stylesheet.addEventListener('load', () => resolve(), { once: true });
    stylesheet.addEventListener('error', () => reject(new Error(`RUDA_APP_STYLESHEET_FAILED:${target}`)), { once: true });
    stylesheet.href = release.stylesheet;
    document.head.appendChild(stylesheet);
  });
  await import(/* @vite-ignore */ release.entry);
}

async function startApp() {
  const target = resolveRudaAppTarget({
    host: window.location.hostname,
    pathname: window.location.pathname,
    isMobileViewport: window.matchMedia('(max-width: 767px)').matches,
    requestedTarget: new URLSearchParams(window.location.search).get('ruda-app')
  });
  document.documentElement.dataset.rudaApp = target;
  document.title = target.startsWith('platform-admin')
    ? 'RUDA 平台管理'
    : target.startsWith('merchant-admin')
      ? 'RUDA 商家管理'
      : document.title;
  setAppManifest(target);

  if (import.meta.env.DEV) {
    await devEntries[target]();
    return;
  }

  await loadProductionApp(target);
}

void startApp().catch(showStartupError);
