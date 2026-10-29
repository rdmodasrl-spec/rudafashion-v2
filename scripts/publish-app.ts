import { access, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isRudaAppTarget, type RudaAppTarget } from '../src/apps/appTarget';

type AppReleaseManifest = {
  target: RudaAppTarget;
  releaseId: string;
  entry: string;
  stylesheet: string;
  createdAt: string;
};

const target = process.argv[2] ?? null;
const releaseId = process.argv[3] ?? '';
if (!isRudaAppTarget(target) || !/^[0-9]{17}-[a-f0-9]{8}$/.test(releaseId)) {
  throw new Error('Usage: tsx scripts/publish-app.ts <app-target> <release-id>');
}

const appDirectory = path.resolve('dist', 'apps', target);
const releaseDirectory = path.join(appDirectory, 'releases', releaseId);
await access(path.join(releaseDirectory, 'app.js'));

async function findCss(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? findCss(entryPath) : entry.name.endsWith('.css') ? [entryPath] : [];
  }));
  return nested.flat();
}

const foundCss = await findCss(releaseDirectory);
if (foundCss.length !== 1) throw new Error(`Expected exactly one stylesheet for ${target}/${releaseId}`);
const manifest: AppReleaseManifest = {
  target,
  releaseId,
  entry: `/apps/${target}/releases/${releaseId}/app.js`,
  stylesheet: `/apps/${target}/releases/${releaseId}/${path.relative(releaseDirectory, foundCss[0]).split(path.sep).join('/')}`,
  createdAt: new Date().toISOString()
};

await mkdir(appDirectory, { recursive: true });
const currentPath = path.join(appDirectory, 'current.json');
const previousPath = path.join(appDirectory, 'current.previous.json');
try {
  const current = await readFile(currentPath, 'utf8');
  const previousTemp = `${previousPath}.${process.pid}.tmp`;
  await writeFile(previousTemp, current, 'utf8');
  await rename(previousTemp, previousPath);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const currentTemp = `${currentPath}.${process.pid}.tmp`;
await writeFile(currentTemp, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
await rename(currentTemp, currentPath);
console.log(`${target}: published ${releaseId}`);
