interface IsolatedPostgresTestDatabaseOptions {
  nodeEnv?: string;
  testDatabaseUrl?: string;
  applicationDatabaseUrl?: string;
  runId?: string;
  containerId?: string;
}

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function parsePostgresUrl(value: string, invalidError: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(invalidError);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('POSTGRES_TEST_DATABASE_URL_MUST_USE_POSTGRESQL');
  }
  return url;
}

function databaseName(url: URL): string {
  try {
    return decodeURIComponent(url.pathname.replace(/^\/+/, '').split('/')[0] || '');
  } catch {
    throw new Error('POSTGRES_TEST_DATABASE_URL_INVALID');
  }
}

function endpoint(url: URL): string {
  const hostname = url.hostname.toLowerCase();
  const normalizedHost = loopbackHosts.has(hostname) ? 'loopback' : hostname;
  return `${normalizedHost}:${url.port || '5432'}`;
}

export function getIsolatedPostgresTestDatabaseUrl(
  options: IsolatedPostgresTestDatabaseOptions
): string {
  if (options.nodeEnv !== 'test' || !options.testDatabaseUrl) {
    throw new Error('POSTGRES_TEST_DATABASE_URL_AND_NODE_ENV_TEST_REQUIRED');
  }
  if (!/^[a-f0-9]{32}$/i.test(options.runId || '') || !/^[a-f0-9]{64}$/i.test(options.containerId || '')) {
    throw new Error('POSTGRES_TEST_CONTAINER_OWNERSHIP_REQUIRED');
  }

  const testUrl = parsePostgresUrl(options.testDatabaseUrl, 'POSTGRES_TEST_DATABASE_URL_INVALID');
  const testDatabaseName = databaseName(testUrl);
  if (!/(^|[-_])(test|e2e)([-_]|$)/i.test(testDatabaseName)) {
    throw new Error('POSTGRES_TEST_DATABASE_NAME_MUST_INCLUDE_TEST_OR_E2E');
  }
  if (!testDatabaseName.toLowerCase().endsWith(`_${options.runId?.toLowerCase()}_test`)) {
    throw new Error('POSTGRES_TEST_DATABASE_NAME_MUST_MATCH_ISOLATED_RUN');
  }
  if (!loopbackHosts.has(testUrl.hostname.toLowerCase())) {
    throw new Error('POSTGRES_TEST_DATABASE_MUST_BE_LOOPBACK');
  }

  if (options.applicationDatabaseUrl) {
    const applicationUrl = parsePostgresUrl(
      options.applicationDatabaseUrl,
      'POSTGRES_APPLICATION_DATABASE_URL_INVALID'
    );
    if (
      endpoint(testUrl) === endpoint(applicationUrl)
      && testDatabaseName.toLowerCase() === databaseName(applicationUrl).toLowerCase()
    ) {
      throw new Error('POSTGRES_TEST_DATABASE_MUST_NOT_MATCH_APPLICATION_DATABASE');
    }
  }

  return testUrl.toString();
}
