interface E2EDatabaseOptions {
  nodeEnv?: string;
  testDatabaseUrl?: string;
  applicationDatabaseUrl?: string;
  allowRemoteDatabase?: string;
}

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function databaseEndpoint(url: URL): string {
  const hostname = url.hostname.toLowerCase();
  const normalizedHostname = loopbackHosts.has(hostname) ? 'loopback' : hostname;
  return `${normalizedHostname}:${url.port || '5432'}`;
}

export function getIsolatedE2ETestDatabaseUrl(options: E2EDatabaseOptions): string {
  if (options.nodeEnv !== 'test' || !options.testDatabaseUrl) {
    throw new Error('E2E_TEST_DATABASE_URL_AND_NODE_ENV_TEST_REQUIRED');
  }

  let testUrl: URL;
  try {
    testUrl = new URL(options.testDatabaseUrl);
  } catch {
    throw new Error('E2E_TEST_DATABASE_URL_INVALID');
  }
  if (!['postgres:', 'postgresql:'].includes(testUrl.protocol)) {
    throw new Error('E2E_TEST_DATABASE_URL_MUST_USE_POSTGRESQL');
  }

  const databaseName = decodeURIComponent(testUrl.pathname.replace(/^\/+/, '').split('/')[0] || '');
  if (!/(^|[-_])(test|e2e)([-_]|$)/i.test(databaseName)) {
    throw new Error('E2E_TEST_DATABASE_NAME_MUST_INCLUDE_TEST_OR_E2E');
  }

  if (options.applicationDatabaseUrl) {
    let applicationUrl: URL;
    try {
      applicationUrl = new URL(options.applicationDatabaseUrl);
    } catch {
      throw new Error('E2E_APPLICATION_DATABASE_URL_INVALID');
    }
    const applicationDatabaseName = decodeURIComponent(
      applicationUrl.pathname.replace(/^\/+/, '').split('/')[0] || ''
    );
    if (
      databaseEndpoint(testUrl) === databaseEndpoint(applicationUrl)
      && databaseName.toLowerCase() === applicationDatabaseName.toLowerCase()
    ) {
      throw new Error('E2E_TEST_DATABASE_MUST_NOT_MATCH_APPLICATION_DATABASE');
    }
  }

  if (!loopbackHosts.has(testUrl.hostname.toLowerCase()) && options.allowRemoteDatabase !== 'true') {
    throw new Error('E2E_REMOTE_TEST_DATABASE_REQUIRES_E2E_ALLOW_REMOTE_DATABASE');
  }

  return testUrl.toString();
}
