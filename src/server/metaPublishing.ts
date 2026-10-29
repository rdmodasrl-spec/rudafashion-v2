import { isIP } from 'node:net';

const publishablePageTasks = new Set([
  'CREATE_CONTENT',
  'MANAGE',
  'MODERATE',
  'PROFILE_PLUS_FULL_CONTROL',
  'PROFILE_PLUS_CREATE_CONTENT',
  'PROFILE_PLUS_MODERATE'
]);

export function hasMetaPublishingTask(tasks: unknown): tasks is string[] {
  return Array.isArray(tasks) &&
    tasks.every(task => typeof task === 'string') &&
    tasks.some(task => publishablePageTasks.has(task));
}

export function canPublishToMetaChannel(tasks: unknown, channel: 'instagram' | 'facebook'): boolean {
  if (!Array.isArray(tasks) || !tasks.every(task => typeof task === 'string')) return false;
  const taskSet = new Set(tasks);
  if (taskSet.has('PROFILE_PLUS_FULL_CONTROL')) return true;
  if (channel === 'instagram') {
    return taskSet.has('MANAGE') || taskSet.has('CREATE_CONTENT') ||
      taskSet.has('PROFILE_PLUS_CREATE_CONTENT');
  }
  return ['CREATE_CONTENT', 'MANAGE', 'MODERATE'].every(task => taskSet.has(task));
}

export function isPublicHttpsMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (url.protocol !== 'https:' || url.username || url.password || !host ||
        ['localhost', 'localhost.localdomain'].includes(host) ||
        /\.(local|localhost|internal|test)$/.test(host)) return false;
    const ipVersion = isIP(host);
    if (ipVersion === 4) {
      const [first, second] = host.split('.').map(Number);
      if (first === 0 || first === 10 || first === 127 || first >= 224 ||
          (first === 169 && second === 254) ||
          (first === 172 && second >= 16 && second <= 31) ||
          (first === 192 && second === 168) ||
          (first === 198 && [18, 19].includes(second))) return false;
    } else if (ipVersion === 6 && (host === '::' || host === '::1' || host.startsWith('fc') || host.startsWith('fd') ||
      /^fe[89ab]/.test(host) || host.startsWith('::ffff:'))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
