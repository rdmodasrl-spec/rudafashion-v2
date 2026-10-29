const PASSTHROUGH_ENVIRONMENT_NAMES = [
  'PATH',
  'HOME',
  'TMPDIR',
  'TEMP',
  'TMP',
  'LANG',
  'LANGUAGE',
  'LC_ALL',
  'LC_CTYPE',
  'SHELL',
  'USER',
  'LOGNAME',
  'TERM',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR'
];

export function getPostgresToolEnvironment(connectionString: string): { environment: NodeJS.ProcessEnv; databaseName: string } {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL_MUST_USE_POSTGRESQL');
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!databaseName) throw new Error('POSTGRES_DATABASE_NAME_REQUIRED');
  if (!url.hostname) throw new Error('POSTGRES_HOST_REQUIRED');

  // Start from a scrubbed environment: inherited PG*/DATABASE_URL targets must never leak into a tool process.
  const environment: NodeJS.ProcessEnv = {};
  for (const name of PASSTHROUGH_ENVIRONMENT_NAMES) {
    const value = process.env[name];
    if (value !== undefined) environment[name] = value;
  }
  environment.PGHOST = url.hostname;
  if (url.port) environment.PGPORT = url.port;
  if (url.username) environment.PGUSER = decodeURIComponent(url.username);
  if (url.password) environment.PGPASSWORD = decodeURIComponent(url.password);
  environment.PGDATABASE = databaseName;

  const queryEnvNames = new Map([
    ['sslmode', 'PGSSLMODE'],
    ['sslcert', 'PGSSLCERT'],
    ['sslkey', 'PGSSLKEY'],
    ['sslrootcert', 'PGSSLROOTCERT'],
    ['sslcrl', 'PGSSLCRL'],
    ['application_name', 'PGAPPNAME'],
    ['connect_timeout', 'PGCONNECT_TIMEOUT'],
    ['options', 'PGOPTIONS'],
    ['target_session_attrs', 'PGTARGETSESSIONATTRS'],
    ['keepalives', 'PGKEEPALIVES'],
    ['keepalives_idle', 'PGKEEPALIVESIDLE'],
    ['keepalives_interval', 'PGKEEPALIVESINTERVAL'],
    ['keepalives_count', 'PGKEEPALIVESCOUNT'],
    ['tcp_user_timeout', 'PGTCPUSER_TIMEOUT']
  ]);
  for (const [key, value] of url.searchParams) {
    if (key === 'schema') continue;
    const environmentName = queryEnvNames.get(key);
    if (!environmentName) throw new Error(`DATABASE_URL_PARAMETER_UNSUPPORTED_${key}`);
    environment[environmentName] = value;
  }
  return { environment, databaseName };
}
