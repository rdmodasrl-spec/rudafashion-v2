import { access, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { build } from 'vite';
import { RUDA_APP_TARGETS, isRudaAppTarget, type RudaAppTarget } from '../src/apps/appTarget';

type AppReleaseManifest = {
  target: RudaAppTarget;
  releaseId: string;
  entry: string;
  stylesheet: string;
  createdAt: string;
};

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  }));
  return nested.flat();
}

async function buildApp(target: RudaAppTarget) {
  const releaseId = `${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${randomUUID().slice(0, 8)}`;
  const appDirectory = path.resolve('dist', 'apps', target);
  const releaseDirectory = path.join(appDirectory, 'releases', releaseId);
  const releaseBase = `/apps/${target}/releases/${releaseId}/`;

  await mkdir(releaseDirectory, { recursive: true });
  await build({
    configFile: path.resolve('vite.config.ts'),
    base: releaseBase,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production')
    },
    build: {
      outDir: releaseDirectory,
      emptyOutDir: false,
      copyPublicDir: false,
      cssCodeSplit: false,
      lib: {
        entry: path.resolve('src', 'apps', target, 'main.tsx'),
        formats: ['es'],
        fileName: 'app',
        cssFileName: 'app'
      },
      rollupOptions: {
        output: {
          entryFileNames: 'app.js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    }
  });

  const builtFiles = await listFiles(releaseDirectory);
  const stylesheetPaths = builtFiles.filter(filePath => filePath.endsWith('.css'));
  if (!await fileExists(path.join(releaseDirectory, 'app.js')) || stylesheetPaths.length !== 1) {
    throw new Error(`App build did not produce the expected JavaScript and CSS files: ${target}`);
  }

  const stylesheetRelativePath = path.relative(releaseDirectory, stylesheetPaths[0]).split(path.sep).join('/');
  const manifest: AppReleaseManifest = {
    target,
    releaseId,
    entry: `${releaseBase}app.js`,
    stylesheet: `${releaseBase}${stylesheetRelativePath}`,
    createdAt: new Date().toISOString()
  };
  console.log(`${target}: built release ${releaseId}`);
  return manifest;
}

async function activateRelease(manifest: AppReleaseManifest) {
  const appDirectory = path.resolve('dist', 'apps', manifest.target);
  const currentPath = path.join(appDirectory, 'current.json');
  const previousPath = path.join(appDirectory, 'current.previous.json');
  if (await fileExists(currentPath)) {
    const current = await readFile(currentPath, 'utf8');
    const previousTemp = `${previousPath}.${process.pid}.tmp`;
    await writeFile(previousTemp, current, 'utf8');
    await rename(previousTemp, previousPath);
  }
  const currentTemp = `${currentPath}.${process.pid}.tmp`;
  await writeFile(currentTemp, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await rename(currentTemp, currentPath);
  console.log(`${manifest.target}: activated ${manifest.releaseId}`);
}

const requestedTarget = process.argv[2] ?? null;
if (requestedTarget === 'all') {
  const releases: AppReleaseManifest[] = [];
  for (const target of RUDA_APP_TARGETS) releases.push(await buildApp(target));
  for (const release of releases) await activateRelease(release);
} else if (isRudaAppTarget(requestedTarget)) {
  await buildApp(requestedTarget);
} else {
  throw new Error(`Usage: tsx scripts/build-app.ts <${RUDA_APP_TARGETS.join('|')}|all>`);
}
