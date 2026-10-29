export interface R2EnvironmentConfig {
  active: boolean;
  endpoint: string;
  region: string;
  bucket: string;
  privateBucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  forcePathStyle: false;
}

type Environment = Record<string, string | undefined>;

const read = (environment: Environment, key: string) => environment[key]?.trim() || '';

function normalizeEndpoint(endpoint: string, bucket: string) {
  if (!endpoint) return '';
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return '';
    if (parsed.hostname.endsWith('.r2.cloudflarestorage.com')) {
      if (bucket && parsed.pathname.replace(/\/+$/, '') === `/${bucket}`) parsed.pathname = '';
      if (parsed.pathname && parsed.pathname !== '/') return '';
      return parsed.origin;
    }
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
}

export function resolveR2Environment(environment: Environment = process.env): R2EnvironmentConfig {
  const active = [
    'R2_ACCOUNT_ID',
    'R2_ENDPOINT',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PRIVATE_BUCKET_NAME',
    'R2_PUBLIC_URL'
  ].some(key => Boolean(read(environment, key)));
  const accountId = read(environment, 'R2_ACCOUNT_ID');
  const bucket = read(environment, 'R2_BUCKET_NAME');
  const endpointInput = read(environment, 'R2_ENDPOINT')
    || (/^[a-f0-9]{32}$/i.test(accountId) ? `https://${accountId}.r2.cloudflarestorage.com` : '');
  const endpoint = normalizeEndpoint(endpointInput, bucket);

  return {
    active,
    endpoint,
    region: 'auto',
    bucket,
    privateBucket: read(environment, 'R2_PRIVATE_BUCKET_NAME'),
    accessKeyId: read(environment, 'R2_ACCESS_KEY_ID'),
    secretAccessKey: read(environment, 'R2_SECRET_ACCESS_KEY'),
    publicBaseUrl: read(environment, 'R2_PUBLIC_URL').replace(/\/+$/, ''),
    forcePathStyle: false
  };
}
