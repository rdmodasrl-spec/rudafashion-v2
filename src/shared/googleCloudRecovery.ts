export const GOOGLE_CLOUD_RECOVERY_COST_WARNING =
  'Creates a separate Cloud SQL instance matching the source MySQL or PostgreSQL engine, tier, and disk size. Google Cloud charges apply while it exists; restore duration and data size affect cost. No public IPv4 is enabled. Only Cloud SQL backup runs are used; application .dump files are not used.';

export function getGoogleCloudDatabaseEngine(databaseVersion: string): 'MySQL' | 'PostgreSQL' | undefined {
  if (/^MYSQL_[0-9]+_[0-9]+$/.test(databaseVersion)) return 'MySQL';
  if (/^POSTGRES_[0-9]+$/.test(databaseVersion)) return 'PostgreSQL';
  return undefined;
}
