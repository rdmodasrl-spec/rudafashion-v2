import { access, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isRudaAppTarget, type RudaAppTarget } from '../src/apps/appTarget';

type AppReleaseManifest = {
  target: RudaAppTarget;
  releaseId: string;
  entry: string;
  stylesheet: string;
};

const target = process.argv[2];
if (!isRudaAppTarget(target ?? null)) {
  throw new Error('Usage: tsx scripts/rollback-app.ts <app-target>');
}

const appDirectory = path.resolve('dist', 'apps', target);
const currentPath = path.join(appDirectory, 'current.json');
const previousPath = path.join(appDirectory, 'current.previous.json');
const current = JSON.parse(await readFile(currentPath, 'utf8')) as AppReleaseManifest;
const previous = JSON.parse(await readFile(previousPath, 'utf8')) as AppReleaseManifest;
if (
  current.target !== target
  || previous.target !== target
  || !/^[0-9]{17}-[a-f0-9]{8}$/.test(current.releaseId)
  || !/^[0-9]{17}-[a-f0-9]{8}$/.test(previous.releaseId)
  || current.entry !== `/apps/${target}/releases/${current.releaseId}/app.js`
  || previous.entry !== `/apps/${target}/releases/${previous.releaseId}/app.js`
  || !current.stylesheet.startsWith(`/apps/${target}/releases/${current.releaseId}/`)
  || !previous.stylesheet.startsWith(`/apps/${target}/releases/${previous.releaseId}/`)
) {
  throw new Error(`Release target mismatch for ${target}`);
}
await access(path.resolve('dist', previous.entry.slice(1)));
await access(path.resolve('dist', previous.stylesheet.slice(1)));

const previousTempPath = `${previousPath}.${process.pid}.tmp`;
const currentTempPath = `${currentPath}.${process.pid}.tmp`;
await writeFile(previousTempPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
await writeFile(currentTempPath, `${JSON.stringify(previous, null, 2)}\n`, 'utf8');
await rename(previousTempPath, previousPath);
await rename(currentTempPath, currentPath);
console.log(`${target}: rolled back to ${previous.releaseId}`);
