import { getIntlLocale } from '../../../../i18n/translations';
import type { Language } from '../../../../i18n/translations';
import React, { useEffect, useState } from 'react';
import { Database, HardDrive, Activity, RefreshCw, DownloadCloud, Trash2, ShieldAlert, ShieldCheck, Save, Cloud, RotateCw, BadgeCheck, Clock3 } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { apiGet, apiPost, apiPut, apiDelete, resolveApiUrl } from '../../../../api/client';
import { PasswordInput } from '../../../shared/components/common/PasswordInput';
import type {
  GoogleCloudDatabaseOverview,
  GoogleCloudRecoveryDrill,
  GoogleCloudSuccessfulBackup
} from '../../../../server/googleCloudDatabase';
import { getGoogleCloudDatabaseEngine, GOOGLE_CLOUD_RECOVERY_COST_WARNING } from '../../../../shared/googleCloudRecovery';
import type { MediaBackupRun } from '../../../../shared/mediaBackup';

type DatabaseTableStat = { name: string; rowEstimate: number; sizeBytes: number };
type DatabaseMigrationStatus = { applied: string[]; pending: string[]; failed: string[] };
type DatabaseOverview = {
  status: 'connected' | 'degraded';
  latencyMs: number;
  databaseName: string;
  serverVersion: string;
  sizeBytes: number;
  tableCount: number;
  topTables: DatabaseTableStat[];
  activeConnections: number;
  maxConnections: number;
  backupDiskTotalBytes: number;
  backupDiskAvailableBytes: number;
  slowQueriesAvailable: boolean;
  slowQueries: { query: string; calls: number; meanMs: number }[];
  migrations: DatabaseMigrationStatus;
  checkedAt: string;
};
type BackupProviderStatus = {
  status: 'disabled' | 'pending' | 'synced' | 'failed';
  syncedAt?: string;
  remoteId?: string;
  error?: string;
};
type DatabaseBackupSyncStatus = { s3: BackupProviderStatus; googleDrive: BackupProviderStatus };
type DatabaseBackupInfo = {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  checksumSha256?: string;
  verifiedAt?: string;
  verificationStatus: 'verified' | 'unverified' | 'failed';
  sync?: DatabaseBackupSyncStatus;
};
type DatabaseBackupPolicy = {
  enabled: boolean;
  hour: number;
  minute: number;
  timezone: string;
  retentionCount: number;
};
type BackupSyncSettings = {
  s3: {
    enabled: boolean;
    configured: boolean;
    endpoint: string;
    region: string;
    bucket: string;
    prefix: string;
    forcePathStyle: boolean;
    accessKeyIdConfigured: boolean;
    secretAccessKeyConfigured: boolean;
    dedicatedCredentialsEnabled: boolean;
    credentialsIsolation: 'dedicated' | 'shared-legacy' | 'unconfigured';
  };
  googleDrive: { enabled: boolean; configured: boolean; folderId: string; serviceAccountConfigured: boolean };
};
type GoogleCloudDatabaseSettings = {
  enabled: boolean;
  projectId: string;
  serviceAccountConfigured: boolean;
  recoveryServiceAccountConfigured: boolean;
};
type GoogleCloudRecoveryDrillResponse = { drill: GoogleCloudRecoveryDrill };
type DatabaseSection = 'overview' | 'backups' | 'sync' | 'policy' | 'googleCloud' | 'media';

const databaseSectionLabels: Record<DatabaseSection, string> = {
  overview: '数据库概览',
  backups: '数据库备份',
  sync: '云端备份同步',
  policy: '备份计划',
  googleCloud: 'Google Cloud 设置',
  media: '媒体备份状态'
};

const emptyGoogleCloudSettings: GoogleCloudDatabaseSettings = {
  enabled: false,
  projectId: '',
  serviceAccountConfigured: false,
  recoveryServiceAccountConfigured: false
};

function recoveryDrillStatusLabel(status: GoogleCloudRecoveryDrill['status']): string {
  const labels: Record<GoogleCloudRecoveryDrill['status'], string> = {
    CREATING: '创建隔离实例中',
    RESTORING: '恢复备份中',
    VERIFYING: '验证恢复结果',
    CLEANUP_PENDING: '清理待重试',
    SUCCEEDED: '演练成功并已清理',
    FAILED: '演练失败'
  };
  return labels[status];
}

function isRecoveryDrillActive(status: GoogleCloudRecoveryDrill['status']): boolean {
  return ['CREATING', 'RESTORING', 'VERIFYING'].includes(status);
}

function syncStatusLabel(provider: BackupProviderStatus | undefined, enabled = false, lang: Language): string {
  if (!provider) return '尚未同步';
  if (provider.status === 'synced') return `已同步${provider.syncedAt ? ` · ${new Date(provider.syncedAt).toLocaleString(getIntlLocale(lang))}` : ''}`;
  if (provider.status === 'pending') return '同步中';
  if (provider.status === 'failed') return `失败：${provider.error || '请重试'}`;
  return enabled ? '尚未同步' : '未启用';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export const AdminDatabaseCenter: React.FC = () => {
  const { lang } = useB2B();
  const [overview, setOverview] = useState<DatabaseOverview | null>(null);
  const [backups, setBackups] = useState<DatabaseBackupInfo[]>([]);
  const [canDeleteBackups, setCanDeleteBackups] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState<Record<DatabaseSection, boolean>>({
    overview: true,
    backups: true,
    sync: true,
    policy: true,
    googleCloud: true,
    media: true
  });
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<DatabaseSection, string>>>({});
  const [backingUp, setBackingUp] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [syncSettings, setSyncSettings] = useState<BackupSyncSettings | null>(null);
  const [s3AccessKeyId, setS3AccessKeyId] = useState('');
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState('');
  const [backupPolicy, setBackupPolicy] = useState<DatabaseBackupPolicy | null>(null);
  const [googleCloudSettings, setGoogleCloudSettings] = useState<GoogleCloudDatabaseSettings>(emptyGoogleCloudSettings);
  const [googleCloudSettingsLoaded, setGoogleCloudSettingsLoaded] = useState(false);
  const [googleCloudOverview, setGoogleCloudOverview] = useState<GoogleCloudDatabaseOverview | null>(null);
  const [googleCloudCredentialsJson, setGoogleCloudCredentialsJson] = useState('');
  const [googleCloudRecoveryCredentialsJson, setGoogleCloudRecoveryCredentialsJson] = useState('');
  const [savingGoogleCloudSettings, setSavingGoogleCloudSettings] = useState(false);
  const [loadingGoogleCloudOverview, setLoadingGoogleCloudOverview] = useState(false);
  const [testingGoogleCloud, setTestingGoogleCloud] = useState(false);
  const [selectedRecoverySource, setSelectedRecoverySource] = useState('');
  const [recoveryBackups, setRecoveryBackups] = useState<GoogleCloudSuccessfulBackup[]>([]);
  const [loadingRecoveryBackups, setLoadingRecoveryBackups] = useState(false);
  const [recoveryDrills, setRecoveryDrills] = useState<GoogleCloudRecoveryDrill[]>([]);
  const [loadingRecoveryDrills, setLoadingRecoveryDrills] = useState(false);
  const [launchingRecoveryDrill, setLaunchingRecoveryDrill] = useState(false);
  const [cleaningRecoveryDrill, setCleaningRecoveryDrill] = useState<string | null>(null);
  const [acknowledgeRecoveryCost, setAcknowledgeRecoveryCost] = useState(false);
  const [googleDriveServiceAccountJson, setGoogleDriveServiceAccountJson] = useState('');
  const [savingSyncSettings, setSavingSyncSettings] = useState(false);
  const [savingBackupPolicy, setSavingBackupPolicy] = useState(false);
  const [testingSyncProvider, setTestingSyncProvider] = useState<'s3' | 'googleDrive' | null>(null);
  const [syncingFile, setSyncingFile] = useState<string | null>(null);
  const [verifyingFile, setVerifyingFile] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mediaBackupSettings, setMediaBackupSettings] = useState<{
    enabled: boolean;
    configured: boolean;
    bucket: string;
    runs: MediaBackupRun[];
  } | null>(null);

  const loadSection = async (section: DatabaseSection) => {
    setSectionLoading(current => ({ ...current, [section]: true }));
    setSectionErrors(current => ({ ...current, [section]: undefined }));
    try {
      switch (section) {
        case 'overview': {
          const result = await apiGet<{ overview: DatabaseOverview }>('/api/admin/database/overview');
          setOverview(result.overview);
          break;
        }
        case 'backups': {
          const result = await apiGet<{ backups: DatabaseBackupInfo[]; canDeleteBackups: boolean }>('/api/admin/database/backups');
          setBackups(result.backups);
          setCanDeleteBackups(result.canDeleteBackups);
          break;
        }
        case 'sync': {
          const result = await apiGet<{ settings: BackupSyncSettings }>('/api/admin/database/backup-sync');
          setSyncSettings(result.settings);
          break;
        }
        case 'policy': {
          const result = await apiGet<{ policy: DatabaseBackupPolicy }>('/api/admin/database/backup-policy');
          setBackupPolicy(result.policy);
          break;
        }
        case 'googleCloud': {
          const result = await apiGet<{ settings: GoogleCloudDatabaseSettings }>('/api/admin/database/google-cloud/settings');
          setGoogleCloudSettings(result.settings);
          setGoogleCloudSettingsLoaded(true);
          break;
        }
        case 'media': {
          const result = await apiGet<{
            objectStorage?: {
              mediaBackup?: { enabled?: boolean; configured?: boolean; bucket?: string };
              mediaBackupRuns?: MediaBackupRun[];
            };
          }>('/api/admin/settings/integrations');
          setMediaBackupSettings({
            enabled: result.objectStorage?.mediaBackup?.enabled ?? false,
            configured: result.objectStorage?.mediaBackup?.configured ?? false,
            bucket: result.objectStorage?.mediaBackup?.bucket ?? '',
            runs: result.objectStorage?.mediaBackupRuns ?? []
          });
          break;
        }
      }
    } catch (loadError) {
      setSectionErrors(current => ({
        ...current,
        [section]: loadError instanceof Error ? loadError.message : `${databaseSectionLabels[section]}读取失败`
      }));
    } finally {
      setSectionLoading(current => ({ ...current, [section]: false }));
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    await Promise.all((Object.keys(databaseSectionLabels) as DatabaseSection[]).map(loadSection));
    setLoading(false);
  };

  const saveBackupPolicy = async () => {
    if (!backupPolicy) return;
    setSavingBackupPolicy(true);
    setError('');
    setNotice('');
    try {
      await apiPut('/api/admin/database/backup-policy', backupPolicy);
      setNotice('自动备份计划和本地保留策略已保存。');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '备份计划保存失败，请检查时区和保留数量。');
    } finally {
      setSavingBackupPolicy(false);
    }
  };

  const saveGoogleCloudSettings = async () => {
    if (!googleCloudSettings) return;
    setSavingGoogleCloudSettings(true);
    setError('');
    setNotice('');
    try {
      const result = await apiPut<{ settings: GoogleCloudDatabaseSettings }>(
        '/api/admin/database/google-cloud/settings',
        {
          ...googleCloudSettings,
          serviceAccountJson: googleCloudCredentialsJson,
          recoveryServiceAccountJson: googleCloudRecoveryCredentialsJson
        }
      );
      setGoogleCloudSettings(result.settings);
      setGoogleCloudCredentialsJson('');
      setGoogleCloudRecoveryCredentialsJson('');
      setGoogleCloudOverview(null);
      setNotice('Google Cloud Project ID、只读账号及单独的恢复演练账号设置已加密保存。');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Google Cloud 设置保存失败。');
    } finally {
      setSavingGoogleCloudSettings(false);
    }
  };

  const testGoogleCloudConnection = async () => {
    setTestingGoogleCloud(true);
    setError('');
    setNotice('');
    try {
      await apiPost('/api/admin/database/google-cloud/test', {});
      setNotice('Google Cloud 凭据有效，Cloud SQL 只读访问测试成功。');
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'Google Cloud 连接测试失败。');
    } finally {
      setTestingGoogleCloud(false);
    }
  };

  const loadGoogleCloudOverview = async () => {
    setLoadingGoogleCloudOverview(true);
    setError('');
    setNotice('');
    try {
      const result = await apiGet<{ overview: GoogleCloudDatabaseOverview }>('/api/admin/database/google-cloud/overview');
      setGoogleCloudOverview(result.overview);
      const failures = [
        !result.overview.cloudSql.available && result.overview.cloudSql.error,
        !result.overview.cloudStorage.available && result.overview.cloudStorage.error
      ].filter(Boolean);
      if (failures.length) {
        setError(`Google Cloud 部分资源读取失败：${failures.join('；')}`);
      } else {
        setNotice('Google Cloud 数据库与存储资源状态已刷新。');
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Google Cloud 资源读取失败。');
    } finally {
      setLoadingGoogleCloudOverview(false);
    }
  };

  const loadRecoveryDrills = async () => {
    setLoadingRecoveryDrills(true);
    try {
      const result = await apiGet<{ drills: GoogleCloudRecoveryDrill[] }>(
        '/api/admin/database/google-cloud/recovery-drills'
      );
      setRecoveryDrills(result.drills);
    } catch (drillError) {
      setError(drillError instanceof Error ? drillError.message : '恢复演练记录读取失败。');
    } finally {
      setLoadingRecoveryDrills(false);
    }
  };

  const loadRecoveryBackups = async (instanceId: string) => {
    setSelectedRecoverySource(instanceId);
    setRecoveryBackups([]);
    setAcknowledgeRecoveryCost(false);
    if (!instanceId) return;
    setLoadingRecoveryBackups(true);
    setError('');
    try {
      const result = await apiGet<{
        backups: GoogleCloudSuccessfulBackup[];
        source: { databaseEngine: 'MySQL' | 'PostgreSQL' };
      }>(
        `/api/admin/database/google-cloud/instances/${encodeURIComponent(instanceId)}/backups`
      );
      setRecoveryBackups(result.backups);
      if (!result.backups.length) setNotice(`此 ${result.source.databaseEngine} 实例目前没有可用于恢复演练的成功 Cloud SQL 备份。`);
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : 'Cloud SQL 成功备份读取失败。');
    } finally {
      setLoadingRecoveryBackups(false);
    }
  };

  const launchRecoveryDrill = async (backupRunId: string) => {
    if (!selectedRecoverySource || !acknowledgeRecoveryCost) return;
    const confirmation = window.prompt(
      `费用与资源确认：${GOOGLE_CLOUD_RECOVERY_COST_WARNING}\n\n请输入“创建隔离实例”继续：`
    );
    if (confirmation !== '创建隔离实例') return;
    setLaunchingRecoveryDrill(true);
    setError('');
    setNotice('');
    try {
      const result = await apiPost<GoogleCloudRecoveryDrillResponse>(
        '/api/admin/database/google-cloud/recovery-drills',
        { sourceInstanceId: selectedRecoverySource, backupRunId, acknowledgeCost: true },
        30_000
      );
      setRecoveryDrills(current => [result.drill, ...current.filter(drill => drill.id !== result.drill.id)]);
      setNotice(`已开始恢复演练：${result.drill.targetInstanceId}。系统会等待恢复、验证数据库并自动清理临时实例。`);
    } catch (launchError) {
      setError(launchError instanceof Error ? launchError.message : '隔离恢复演练启动失败。');
    } finally {
      setLaunchingRecoveryDrill(false);
    }
  };

  const retryRecoveryCleanup = async (drillId: string) => {
    setCleaningRecoveryDrill(drillId);
    setError('');
    setNotice('');
    try {
      const result = await apiPost<GoogleCloudRecoveryDrillResponse>(
        `/api/admin/database/google-cloud/recovery-drills/${encodeURIComponent(drillId)}/cleanup`,
        {}
      );
      setRecoveryDrills(current => current.map(drill => drill.id === drillId ? result.drill : drill));
      setNotice(`临时恢复实例清理状态：${recoveryDrillStatusLabel(result.drill.status)}。`);
    } catch (cleanupError) {
      setError(cleanupError instanceof Error ? cleanupError.message : '临时实例清理失败，请查看云端权限并重试。');
    } finally {
      setCleaningRecoveryDrill(null);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!googleCloudSettings?.enabled || !googleCloudSettings.recoveryServiceAccountConfigured) return;
    void loadRecoveryDrills();
  }, [googleCloudSettings?.enabled, googleCloudSettings?.recoveryServiceAccountConfigured]);

  useEffect(() => {
    if (!recoveryDrills.some(drill => isRecoveryDrillActive(drill.status))) return;
    const timer = window.setInterval(() => void loadRecoveryDrills(), 5_000);
    return () => window.clearInterval(timer);
  }, [recoveryDrills]);

  const runBackup = async () => {
    setBackingUp(true);
    setError('');
    setNotice('');
    try {
      const result = await apiPost<{ backup: DatabaseBackupInfo }>('/api/admin/database/backups', {}, 30 * 60 * 1000);
      setBackups(current => [result.backup, ...current]);
      setNotice(`备份成功：${result.backup.filename}（${formatBytes(result.backup.sizeBytes)}）${result.backup.sync ? `；S3 ${syncStatusLabel(result.backup.sync.s3, false, lang)}；Google Drive ${syncStatusLabel(result.backup.sync.googleDrive, false, lang)}` : ''}`);
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : '备份失败，请检查服务器磁盘和数据库连接。');
    } finally {
      setBackingUp(false);
    }
  };

  const saveSyncSettings = async () => {
    if (!syncSettings) return;
    setSavingSyncSettings(true);
    setError('');
    setNotice('');
    try {
      await apiPut('/api/admin/database/backup-sync', {
        s3Enabled: syncSettings.s3.enabled,
        s3Dedicated: syncSettings.s3.dedicatedCredentialsEnabled,
        s3Prefix: syncSettings.s3.prefix,
        s3Endpoint: syncSettings.s3.endpoint,
        s3Region: syncSettings.s3.region,
        s3Bucket: syncSettings.s3.bucket,
        s3AccessKeyId,
        s3SecretAccessKey,
        s3ForcePathStyle: syncSettings.s3.forcePathStyle,
        googleDriveEnabled: syncSettings.googleDrive.enabled,
        googleDriveFolderId: syncSettings.googleDrive.folderId,
        googleDriveServiceAccountJson
      });
      setS3AccessKeyId('');
      setS3SecretAccessKey('');
      setGoogleDriveServiceAccountJson('');
      setNotice('云端备份同步设置已加密保存。');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '同步设置保存失败，请重试。');
    } finally {
      setSavingSyncSettings(false);
    }
  };

  const testSyncProvider = async (provider: 's3' | 'googleDrive') => {
    setTestingSyncProvider(provider);
    setError('');
    setNotice('');
    try {
      await apiPost('/api/admin/database/backup-sync/test', {
        provider,
        ...(provider === 'googleDrive' && syncSettings ? {
          googleDriveServiceAccountJson,
          googleDriveFolderId: syncSettings.googleDrive.folderId
        } : {})
      }, 60_000);
      setNotice(`${provider === 's3' ? 'S3 对象存储' : 'Google Drive'}连接测试成功。`);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : '云存储连接测试失败。');
    } finally {
      setTestingSyncProvider(null);
    }
  };

  const syncBackup = async (filename: string) => {
    setSyncingFile(filename);
    setError('');
    setNotice('');
    try {
      const result = await apiPost<{ sync: DatabaseBackupSyncStatus }>(
        `/api/admin/database/backups/${encodeURIComponent(filename)}/sync`,
        {},
        30 * 60 * 1000
      );
      setBackups(current => current.map(item => item.filename === filename ? { ...item, sync: result.sync } : item));
      setNotice(`${filename}同步结果：S3 ${syncStatusLabel(result.sync.s3, false, lang)}；Google Drive ${syncStatusLabel(result.sync.googleDrive, false, lang)}`);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : '备份同步失败，请重试。');
    } finally {
      setSyncingFile(null);
    }
  };

  const verifyBackup = async (filename: string) => {
    setVerifyingFile(filename);
    setError('');
    setNotice('');
    try {
      const result = await apiPost<{ verification: { checksumSha256: string; verifiedAt: string } }>(
        `/api/admin/database/backups/${encodeURIComponent(filename)}/verify`,
        {},
        5 * 60 * 1000
      );
      setBackups(current => current.map(item => item.filename === filename
        ? { ...item, checksumSha256: result.verification.checksumSha256, verifiedAt: result.verification.verifiedAt, verificationStatus: 'verified' }
        : item));
      setNotice(`备份完整性验证通过：SHA-256 ${result.verification.checksumSha256}`);
    } catch (verificationError) {
      setBackups(current => current.map(item => item.filename === filename ? { ...item, verificationStatus: 'failed' } : item));
      setError(verificationError instanceof Error ? verificationError.message : '备份完整性验证失败，请勿用于恢复。');
    } finally {
      setVerifyingFile(null);
    }
  };

  const downloadBackup = (filename: string) => {
    window.open(resolveApiUrl(`/api/admin/database/backups/${encodeURIComponent(filename)}/download`), '_blank');
  };

  const deleteBackup = async (filename: string) => {
    if (window.prompt(`高风险操作：此操作只删除本机备份，不会删除云端副本。\n请输入完整文件名以确认删除：\n${filename}`) !== filename) return;
    setDeletingFile(filename);
    setError('');
    setNotice('');
    try {
      await apiDelete(`/api/admin/database/backups/${encodeURIComponent(filename)}`);
      setBackups(current => current.filter(item => item.filename !== filename));
      setNotice(`已删除备份 ${filename}`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败，请重试。');
    } finally {
      setDeletingFile(null);
    }
  };

  const hasPendingMigrations = (overview?.migrations.pending.length ?? 0) > 0;
  const hasFailedMigrations = (overview?.migrations.failed.length ?? 0) > 0;
  const databaseConnectionPercent = overview?.maxConnections
    ? Math.min(100, Math.round((overview.activeConnections / overview.maxConnections) * 100))
    : 0;
  const backupDiskUsedBytes = overview
    ? Math.max(0, overview.backupDiskTotalBytes - overview.backupDiskAvailableBytes)
    : 0;
  const backupDiskUsedPercent = overview?.backupDiskTotalBytes
    ? Math.min(100, Math.round((backupDiskUsedBytes / overview.backupDiskTotalBytes) * 100))
    : 0;
  const latestBackup = backups[0];
  const cloudRecoveryInstances = googleCloudOverview?.cloudSql.available
    ? googleCloudOverview.cloudSql.instances.filter(instance => getGoogleCloudDatabaseEngine(instance.databaseVersion) !== undefined)
    : [];
  const latestMediaBackup = mediaBackupSettings?.runs[0];
  const latestRecoveryDrill = recoveryDrills[0];
  const latestBackupAgeHours = latestBackup
    ? Math.max(0, (Date.now() - new Date(latestBackup.createdAt).getTime()) / (60 * 60 * 1000))
    : null;
  const latestRecoveryDrillMinutes = latestRecoveryDrill?.status === 'SUCCEEDED'
    ? Math.max(0, Math.round((new Date(latestRecoveryDrill.updatedAt).getTime() - new Date(latestRecoveryDrill.createdAt).getTime()) / 60_000))
    : null;
  const recoveryChecks = [
    {
      label: '最近数据库备份已创建并通过归档校验',
      complete: Boolean(latestBackup && latestBackup.verificationStatus === 'verified' && latestBackupAgeHours !== null && latestBackupAgeHours <= 24)
    },
    {
      label: '数据库备份至少有一个已确认的异地副本',
      complete: Boolean(latestBackup?.sync && [latestBackup.sync.s3, latestBackup.sync.googleDrive].some(provider => provider?.status === 'synced'))
    },
    {
      label: '媒体对象备份已启用且最近快照成功',
      complete: Boolean(mediaBackupSettings?.enabled && latestMediaBackup?.status === 'SUCCEEDED')
    },
    {
      label: '最近一次 Cloud SQL 恢复演练成功并清理',
      complete: Boolean(latestRecoveryDrill?.status === 'SUCCEEDED')
    }
  ];

  return (
    <section className="space-y-5" aria-labelledby="database-center-title">
      <header className="rounded-xl bg-neutral-950 p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400"><Database className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider">平台数据库</span></div>
            <h2 id="database-center-title" className="mt-2 text-xl font-bold">数据备份</h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-neutral-400">
              监控数据库健康、连接、迁移与慢查询；通过可验证的本地备份及异地副本降低数据恢复风险。
            </p>
            <p className="mt-1 text-[11px] leading-5 text-neutral-500">
              生产数据库地址和权限由部署环境管理；本中心只读监控 PostgreSQL，不提供在线切换数据库连接。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />刷新
          </button>
        </div>
      </header>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">{notice}</div>}
      {Object.entries(sectionErrors).map(([section, sectionError]) => sectionError && (
        <div key={section} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <span><strong>{databaseSectionLabels[section as DatabaseSection]}：</strong>{sectionError}</span>
          <button
            type="button"
            onClick={() => void loadSection(section as DatabaseSection)}
            disabled={sectionLoading[section as DatabaseSection]}
            className="rounded border border-amber-300 bg-white px-2.5 py-1.5 font-semibold disabled:opacity-50"
          >
            {sectionLoading[section as DatabaseSection] ? '重试中…' : '重试此区块'}
          </button>
        </div>
      ))}

      <section className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-950"><ShieldCheck className="h-4 w-4 text-emerald-700" />备份与灾难恢复状态</h3>
            <p className="mt-1 text-[11px] leading-5 text-neutral-500">统一查看数据库、异地副本、媒体对象和恢复演练。RPO/RTO 为运营目标，不代表已验证的实际恢复能力。</p>
          </div>
          <button
            type="button"
            onClick={() => void Promise.all([
              loadSection('backups'),
              loadSection('sync'),
              loadSection('media'),
              googleCloudSettings.enabled && googleCloudSettings.recoveryServiceAccountConfigured
                ? loadRecoveryDrills()
                : Promise.resolve()
            ])}
            disabled={sectionLoading.backups || sectionLoading.sync || sectionLoading.media || loadingRecoveryDrills}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-[11px] font-semibold text-neutral-700 disabled:opacity-50"
          >
            刷新恢复状态
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-[10px] font-semibold text-neutral-500">最近数据库备份</div>
            <div className="mt-1 text-xs font-bold text-neutral-900">{latestBackup ? new Date(latestBackup.createdAt).toLocaleString(getIntlLocale(lang)) : '暂无备份记录'}</div>
            <div className={`mt-1 text-[10px] ${latestBackup?.verificationStatus === 'verified' ? 'text-emerald-700' : 'text-amber-700'}`}>
              {latestBackup ? `${latestBackup.verificationStatus === 'verified' ? '校验通过' : latestBackup.verificationStatus === 'failed' ? '校验失败' : '尚未校验'}${latestBackupAgeHours !== null && latestBackupAgeHours > 24 ? ` · 已超过 ${Math.floor(latestBackupAgeHours)} 小时` : ''}` : '请创建首份数据库备份'}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-[10px] font-semibold text-neutral-500">数据库异地副本</div>
            <div className="mt-1 text-xs font-bold text-neutral-900">
              S3：{syncStatusLabel(latestBackup?.sync?.s3, syncSettings?.s3.enabled, lang)}
            </div>
            <div className="mt-1 text-xs font-bold text-neutral-900">
              Google Drive：{syncStatusLabel(latestBackup?.sync?.googleDrive, syncSettings?.googleDrive.enabled, lang)}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-[10px] font-semibold text-neutral-500">媒体对象副本</div>
            <div className="mt-1 text-xs font-bold text-neutral-900">
              {latestMediaBackup
                ? `${latestMediaBackup.status === 'SUCCEEDED' ? '最近快照成功' : latestMediaBackup.status === 'RUNNING' ? '快照进行中' : `快照${latestMediaBackup.status === 'FAILED' ? '失败' : '中断'}`} · ${new Date(latestMediaBackup.startedAt).toLocaleString(getIntlLocale(lang))}`
                : mediaBackupSettings?.enabled ? '尚无媒体快照记录' : '媒体备份尚未启用'}
            </div>
            <div className="mt-1 text-[10px] text-neutral-500">
              {mediaBackupSettings?.configured ? `目标 Bucket：${mediaBackupSettings.bucket || '已配置'}` : '需在平台设置中配置独立媒体备份目标'}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-[10px] font-semibold text-neutral-500">恢复演练</div>
            <div className="mt-1 text-xs font-bold text-neutral-900">
              {latestRecoveryDrill ? recoveryDrillStatusLabel(latestRecoveryDrill.status) : '暂无演练记录'}
            </div>
            {latestRecoveryDrill && <div className="mt-1 text-[10px] text-neutral-500">更新于 {new Date(latestRecoveryDrill.updatedAt).toLocaleString(getIntlLocale(lang))}</div>}
            {latestRecoveryDrillMinutes !== null && <div className="mt-1 text-[10px] text-neutral-500">演练总耗时约 {latestRecoveryDrillMinutes} 分钟（含清理）</div>}
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="rounded-lg border border-neutral-200 p-3">
            <div className="text-[11px] font-bold text-neutral-800">恢复就绪检查清单</div>
            <ul className="mt-2 grid gap-1.5 text-[10px] sm:grid-cols-2">
              {recoveryChecks.map(check => (
                <li key={check.label} className={check.complete ? 'text-emerald-700' : 'text-amber-800'}>
                  {check.complete ? '✓' : '○'} {check.label}
                </li>
              ))}
            </ul>
              <ol className="mt-3 space-y-1.5 border-t border-neutral-200 pt-3 text-[10px] leading-4 text-neutral-600">
                <li><strong>1.</strong> 选择最近一份 SHA-256/归档验证通过的数据库备份；未验证备份不得用于恢复。</li>
                <li><strong>2.</strong> 先恢复到隔离目标（Cloud SQL 演练或受控临时库），不要直接覆盖生产数据库。</li>
                <li><strong>3.</strong> 对比关键表数量、订单/库存抽样及应用健康检查，并记录实际恢复耗时。</li>
                <li><strong>4.</strong> 从成功的媒体 manifest 只补回缺失对象；不要覆盖目标中已有的媒体文件。</li>
                <li><strong>5.</strong> 业务负责人批准后再安排生产切换；保留原库、回滚方案和变更审计记录。</li>
              </ol>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:min-w-56 lg:grid-cols-1">
            <div className="rounded-lg bg-sky-50 px-3 py-2">
              <div className="text-[10px] text-sky-700">RPO 目标</div>
              <div className="text-sm font-bold text-sky-900">≤ 24 小时</div>
              <div className="text-[9px] text-sky-700">每日备份目标；以最近成功备份时间核对</div>
            </div>
            <div className="rounded-lg bg-violet-50 px-3 py-2">
              <div className="text-[10px] text-violet-700">RTO 目标</div>
              <div className="text-sm font-bold text-violet-900">≤ 4 小时</div>
              <div className="text-[9px] text-violet-700">{latestRecoveryDrillMinutes !== null ? `最近演练 ${latestRecoveryDrillMinutes} 分钟；目标值需持续验证` : '目标值；需通过定期恢复演练验证'}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-[11px] text-neutral-500">连接状态</div>
          <div className={`mt-1 text-lg font-bold ${overview?.status === 'connected' ? 'text-emerald-600' : 'text-amber-600'}`}>
            {overview ? (overview.status === 'connected' ? '正常连接' : '连接异常') : '--'}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-[11px] text-neutral-500">查询延迟</div>
          <div className="mt-1 text-lg font-bold text-neutral-900">{overview ? `${overview.latencyMs} ms` : '--'}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-[11px] text-neutral-500">当前数据库大小</div>
          <div className="mt-1 text-lg font-bold text-neutral-900">{overview ? formatBytes(overview.sizeBytes) : '--'}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-[11px] text-neutral-500">数据表数量</div>
          <div className="mt-1 text-lg font-bold text-neutral-900">{overview ? overview.tableCount : '--'}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-[11px] text-neutral-500">活跃连接</div>
          <div className={`mt-1 text-lg font-bold ${databaseConnectionPercent >= 85 ? 'text-rose-700' : 'text-neutral-900'}`}>
            {overview ? `${overview.activeConnections} / ${overview.maxConnections}` : '--'}
          </div>
          {overview && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className={`h-full ${databaseConnectionPercent >= 85 ? 'bg-rose-500' : databaseConnectionPercent >= 65 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${databaseConnectionPercent}%` }} /></div>}
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-[11px] text-neutral-500">PostgreSQL 版本</div>
          <div className="mt-1 text-lg font-bold text-neutral-900">{overview?.serverVersion || '--'}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-[11px] text-neutral-500">当前数据库</div>
          <div className="mt-1 truncate text-lg font-bold text-neutral-900" title={overview?.databaseName}>{overview?.databaseName || '--'}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-[11px] text-neutral-500">备份磁盘已用 / 可用</div>
          <div className={`mt-1 text-lg font-bold ${backupDiskUsedPercent >= 90 ? 'text-rose-700' : 'text-neutral-900'}`}>
            {overview ? `${formatBytes(backupDiskUsedBytes)} / ${formatBytes(overview.backupDiskAvailableBytes)}` : '--'}
          </div>
          {overview && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className={`h-full ${backupDiskUsedPercent >= 90 ? 'bg-rose-500' : backupDiskUsedPercent >= 75 ? 'bg-amber-500' : 'bg-sky-500'}`} style={{ width: `${backupDiskUsedPercent}%` }} /></div>}
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-[11px] text-neutral-500">迁移状态</div>
          <div className={`mt-1 text-lg font-bold ${hasFailedMigrations ? 'text-rose-600' : hasPendingMigrations ? 'text-amber-600' : 'text-emerald-600'}`}>
            {overview ? (hasFailedMigrations ? '有失败迁移' : hasPendingMigrations ? `${overview.migrations.pending.length} 项待应用` : '全部已应用') : '--'}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-[11px] text-neutral-500">慢查询监控</div>
          <div className="mt-1 text-lg font-bold text-neutral-900">{overview ? (overview.slowQueriesAvailable ? '已启用' : '未启用') : '--'}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-[11px] text-neutral-500">备份数量</div>
          <div className="mt-1 text-lg font-bold text-neutral-900">{backups.length}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-[11px] text-neutral-500">已验证备份</div>
          <div className="mt-1 text-lg font-bold text-emerald-700">{backups.filter(backup => backup.verificationStatus === 'verified').length} / {backups.length}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-[11px] text-neutral-500">自动备份计划</div>
          <div className="mt-1 text-lg font-bold text-neutral-900">
            {backupPolicy?.enabled ? `${String(backupPolicy.hour).padStart(2, '0')}:${String(backupPolicy.minute).padStart(2, '0')}` : '已暂停'}
          </div>
        </div>
      </section>

      {(hasPendingMigrations || hasFailedMigrations) && overview && (
        <div className={`rounded-xl border p-4 ${hasFailedMigrations ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
            <ShieldAlert className={`h-4 w-4 ${hasFailedMigrations ? 'text-rose-600' : 'text-amber-600'}`} />
            {hasFailedMigrations ? '存在失败的数据库迁移，请立即处理' : '有数据库迁移尚未应用到生产环境'}
          </div>
          {hasPendingMigrations && (
            <ul className="mt-2 space-y-1 text-xs text-neutral-700">
              {overview.migrations.pending.map(name => <li key={name} className="font-mono">{name}</li>)}
            </ul>
          )}
          {hasFailedMigrations && (
            <ul className="mt-2 space-y-1 text-xs text-rose-700">
              {overview.migrations.failed.map(name => <li key={name} className="font-mono">{name}</li>)}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-neutral-600">在服务器上运行 <code className="rounded bg-white/60 px-1 py-0.5">npx prisma migrate deploy</code> 应用待处理迁移。</p>
        </div>
      )}

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-neutral-950"><Cloud className="h-4 w-4" />Google Cloud 数据库与存储</div>
            <p className="mt-2 max-w-4xl text-[11px] leading-5 text-neutral-500">
              使用独立 Google Cloud 服务账号进行只读盘点，不复用 Drive 备份密钥。请启用 Cloud SQL Admin API 与 Cloud Storage API，并授予 Cloud SQL Viewer、Storage Viewer（或等效最小只读权限）。密钥在服务器端加密保存，不会回显。
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${googleCloudSettings?.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
            {googleCloudSettings?.enabled ? '集成已启用' : '集成未启用'}
          </span>
        </div>
        {googleCloudSettings && (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-[11px] font-semibold text-neutral-700">
                Google Cloud Project ID
                <input
                  value={googleCloudSettings.projectId}
                  onChange={event => setGoogleCloudSettings(current => current ? { ...current, projectId: event.target.value.trim() } : current)}
                  maxLength={30}
                  autoComplete="off"
                  placeholder="my-production-project"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-normal"
                />
                <span className="mt-1 block font-normal leading-5 text-neutral-500">
                  Cloud SQL 连接名称格式为 Project ID:区域:实例名；这里只填第一个冒号前的 Project ID，不填公网 IP 或数据库密码。
                </span>
              </label>
              <label className="flex items-center gap-2 self-end rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-800">
                <input
                  type="checkbox"
                  checked={googleCloudSettings.enabled}
                  disabled={!googleCloudSettingsLoaded}
                  onChange={event => setGoogleCloudSettings(current => current ? { ...current, enabled: event.target.checked } : current)}
                  className="h-4 w-4 accent-neutral-900"
                />
                启用 Google Cloud 只读监控
              </label>
              <label className="text-[11px] font-semibold text-neutral-700 md:col-span-2">
                服务账号 JSON {googleCloudSettings.serviceAccountConfigured && <span className="font-normal text-emerald-700">（凭据已加密保存；留空保留现有密钥）</span>}
                <textarea
                  value={googleCloudCredentialsJson}
                  onChange={event => setGoogleCloudCredentialsJson(event.target.value)}
                  rows={4}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder='{"client_email":"...@...iam.gserviceaccount.com","private_key":"..."}'
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-mono font-normal"
                />
              </label>
              <label className="text-[11px] font-semibold text-neutral-700 md:col-span-2">
                灾难恢复演练专用服务账号 JSON {googleCloudSettings.recoveryServiceAccountConfigured && <span className="font-normal text-emerald-700">（独立凭据已加密保存；留空保留现有密钥）</span>}
                <textarea
                  value={googleCloudRecoveryCredentialsJson}
                  onChange={event => setGoogleCloudRecoveryCredentialsJson(event.target.value)}
                  rows={4}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder='{"client_email":"recovery-operator@...iam.gserviceaccount.com","private_key":"..."}'
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-mono font-normal"
                />
                <span className="mt-1 block font-normal leading-5 text-amber-700">
                  此账号仅供创建并清理临时恢复目标，权限高于只读监控账号；请单独创建并按 Cloud SQL 恢复所需操作授予最小权限。不要复用 Drive 上传密钥或生产应用数据库密码。
                </span>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveGoogleCloudSettings()}
                disabled={savingGoogleCloudSettings || !googleCloudSettingsLoaded}
                className="rounded-lg bg-neutral-950 px-3.5 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {savingGoogleCloudSettings ? '保存中…' : !googleCloudSettingsLoaded ? '设置读取后可保存' : '保存 Google Cloud 设置'}
              </button>
              <button
                type="button"
                onClick={() => void testGoogleCloudConnection()}
                disabled={!googleCloudSettings.enabled || !googleCloudSettings.serviceAccountConfigured || testingGoogleCloud}
                className="rounded-lg border border-neutral-300 px-3.5 py-2 text-[11px] font-semibold text-neutral-700 disabled:opacity-50"
              >
                {testingGoogleCloud ? '测试中…' : '测试 Cloud SQL 只读连接'}
              </button>
              <button
                type="button"
                onClick={() => void loadGoogleCloudOverview()}
                disabled={!googleCloudSettings.enabled || !googleCloudSettings.serviceAccountConfigured || loadingGoogleCloudOverview}
                className="rounded-lg border border-neutral-300 px-3.5 py-2 text-[11px] font-semibold text-neutral-700 disabled:opacity-50"
              >
                {loadingGoogleCloudOverview ? '读取中…' : '读取 Cloud SQL / Storage 状态'}
              </button>
            </div>
          </>
        )}

        {googleCloudOverview && (
          <div className="mt-4 space-y-4 border-t border-neutral-100 pt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-neutral-50 p-3">
                <div className="text-[10px] text-neutral-500">Cloud SQL 实例</div>
                <div className="mt-1 text-lg font-bold text-neutral-900">
                  {googleCloudOverview.cloudSql.available ? googleCloudOverview.cloudSql.instances.length : '读取失败'}
                </div>
              </div>
              <div className="rounded-lg bg-neutral-50 p-3">
                <div className="text-[10px] text-neutral-500">启用 PITR 实例</div>
                <div className="mt-1 text-lg font-bold text-neutral-900">
                  {googleCloudOverview.cloudSql.available
                    ? `${googleCloudOverview.cloudSql.instances.filter(instance => instance.pointInTimeRecoveryEnabled).length} / ${googleCloudOverview.cloudSql.instances.length}`
                    : '--'}
                </div>
              </div>
              <div className="rounded-lg bg-neutral-50 p-3">
                <div className="text-[10px] text-neutral-500">Cloud Storage 存储桶</div>
                <div className="mt-1 text-lg font-bold text-neutral-900">
                  {googleCloudOverview.cloudStorage.available ? googleCloudOverview.cloudStorage.buckets.length : '读取失败'}
                </div>
              </div>
            </div>

            {googleCloudOverview.cloudSql.available && googleCloudOverview.cloudSql.instances.some(instance => !instance.automatedBackupsEnabled || !instance.pointInTimeRecoveryEnabled) && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
                <strong>备份保护未完整：</strong>
                {googleCloudOverview.cloudSql.instances
                  .filter(instance => !instance.automatedBackupsEnabled || !instance.pointInTimeRecoveryEnabled)
                  .map(instance => `${instance.name}（${[
                    !instance.automatedBackupsEnabled ? '自动备份关闭' : '',
                    !instance.pointInTimeRecoveryEnabled ? 'PITR 关闭' : ''
                  ].filter(Boolean).join('、')}）`)
                  .join('；')}
                。请在 Google Cloud 控制台评估并启用所需保护；本页面为只读检查，不会变更实例设置。尚无成功备份时无法进行恢复演练。
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold text-neutral-900">Cloud SQL 备份与恢复能力</h3>
              {!googleCloudOverview.cloudSql.available ? (
                <p className="mt-2 text-[11px] text-rose-700">{googleCloudOverview.cloudSql.error}</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[900px] text-[11px]">
                    <thead><tr className="text-left text-neutral-500">
                      <th className="pb-2 pr-3">实例</th><th className="pb-2 pr-3">区域 / 引擎</th><th className="pb-2 pr-3">状态</th>
                      <th className="pb-2 pr-3">自动备份</th><th className="pb-2 pr-3">PITR</th><th className="pb-2 pr-3">保留数 / 日志天数</th><th className="pb-2">最近备份</th>
                    </tr></thead>
                    <tbody>
                      {googleCloudOverview.cloudSql.instances.map(instance => (
                        <tr key={instance.name} className="border-t border-neutral-100 align-top">
                          <td className="py-2 pr-3 font-mono text-neutral-800">{instance.name}</td>
                          <td className="py-2 pr-3 text-neutral-600">{instance.region || '--'}<div>{instance.databaseVersion || '--'}</div></td>
                          <td className="py-2 pr-3 text-neutral-700">{instance.state}</td>
                          <td className={`py-2 pr-3 font-semibold ${instance.automatedBackupsEnabled ? 'text-emerald-700' : 'text-rose-700'}`}>{instance.automatedBackupsEnabled ? '已启用' : '未启用'}</td>
                          <td className={`py-2 pr-3 font-semibold ${instance.pointInTimeRecoveryEnabled ? 'text-emerald-700' : 'text-amber-700'}`}>{instance.pointInTimeRecoveryEnabled ? '已启用' : '未启用'}</td>
                          <td className="py-2 pr-3 text-neutral-600">
                            {instance.retainedBackups ?? '--'} / {instance.transactionLogRetentionDays ?? '--'}
                          </td>
                          <td className="py-2 text-neutral-600">
                            {instance.backupError
                              ? `读取失败：${instance.backupError}`
                              : instance.latestBackup
                                ? `${instance.latestBackup.status || '状态未知'} · ${instance.latestBackup.startTime ? new Date(instance.latestBackup.startTime).toLocaleString(getIntlLocale(lang)) : '时间未知'}`
                                : '暂无备份记录'}
                          </td>
                        </tr>
                      ))}
                      {!googleCloudOverview.cloudSql.instances.length && <tr><td colSpan={7} className="py-3 text-center text-neutral-400">项目中未发现 Cloud SQL 实例</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold text-neutral-900">Cloud Storage 保护配置</h3>
              {!googleCloudOverview.cloudStorage.available ? (
                <p className="mt-2 text-[11px] text-rose-700">{googleCloudOverview.cloudStorage.error}</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[650px] text-[11px]">
                    <thead><tr className="text-left text-neutral-500">
                      <th className="pb-2 pr-3">Bucket</th><th className="pb-2 pr-3">区域 / 存储级别</th>
                      <th className="pb-2 pr-3">对象版本控制</th><th className="pb-2 pr-3">保留策略</th><th className="pb-2">统一 Bucket 级访问</th>
                    </tr></thead>
                    <tbody>
                      {googleCloudOverview.cloudStorage.buckets.map(bucket => (
                        <tr key={bucket.name} className="border-t border-neutral-100">
                          <td className="py-2 pr-3 font-mono text-neutral-800">{bucket.name}</td>
                          <td className="py-2 pr-3 text-neutral-600">{bucket.location || '--'} / {bucket.storageClass || '--'}</td>
                          <td className={`py-2 pr-3 font-semibold ${bucket.versioningEnabled ? 'text-emerald-700' : 'text-amber-700'}`}>{bucket.versioningEnabled ? '已启用' : '未启用'}</td>
                          <td className="py-2 pr-3 text-neutral-600">{bucket.retentionPeriodSeconds ? `${Math.ceil(bucket.retentionPeriodSeconds / 86400)} 天` : '未配置'}</td>
                          <td className="py-2 text-neutral-600">{bucket.uniformBucketLevelAccess ? '已启用' : '未启用'}</td>
                        </tr>
                      ))}
                      {!googleCloudOverview.cloudStorage.buckets.length && <tr><td colSpan={5} className="py-3 text-center text-neutral-400">项目中未发现 Cloud Storage Bucket</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-neutral-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-neutral-900">Cloud SQL 隔离恢复演练</h3>
                  <p className="mt-1 max-w-4xl text-[11px] leading-5 text-neutral-600">
                    仅可将 Cloud SQL 的 SUCCESSFUL MySQL/PostgreSQL 备份恢复到新建的随机命名临时实例；不会读取本机 PostgreSQL .dump，也绝不覆盖源实例。演练实例禁用公网 IPv4，验证完成后自动删除；创建和运行期间会产生 Google Cloud 费用。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadRecoveryDrills()}
                  disabled={loadingRecoveryDrills}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-[11px] font-semibold text-neutral-700 disabled:opacity-50"
                >
                  {loadingRecoveryDrills ? '刷新中…' : '刷新演练记录'}
                </button>
              </div>

              {!googleCloudSettings.recoveryServiceAccountConfigured && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
                  请先在上方填写并保存“灾难恢复演练专用服务账号 JSON”。该账号仅供 Cloud SQL 创建、恢复、检查及删除临时实例；请与只读账号和 Drive 上传账号隔离，并按最小权限配置 IAM。
                </div>
              )}

              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto] md:items-end">
                <label className="text-[11px] font-semibold text-neutral-700">
                  选择 Google Cloud MySQL/PostgreSQL 源实例
                  <select
                    value={selectedRecoverySource}
                    onChange={event => void loadRecoveryBackups(event.target.value)}
                    disabled={!googleCloudSettings.enabled || !googleCloudSettings.serviceAccountConfigured || !cloudRecoveryInstances.length || loadingRecoveryBackups}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs disabled:opacity-50"
                  >
                    <option value="">请选择实例</option>
                    {cloudRecoveryInstances.map(instance => (
                      <option key={instance.name} value={instance.name}>
                        {instance.name} · {getGoogleCloudDatabaseEngine(instance.databaseVersion)} · {instance.region} · {instance.databaseVersion}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="text-[10px] text-neutral-500">
                  {selectedRecoverySource
                    ? `项目：${googleCloudOverview.projectId} · 仅使用 Cloud SQL 服务端备份`
                    : '需先读取 Cloud SQL / Storage 状态'}
                </span>
              </div>

              {selectedRecoverySource && (
                <div className="mt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-[11px] font-bold text-neutral-800">可用成功备份</h4>
                    <button
                      type="button"
                      onClick={() => void loadRecoveryBackups(selectedRecoverySource)}
                      disabled={loadingRecoveryBackups}
                      className="text-[10px] font-semibold text-neutral-700 underline disabled:opacity-50"
                    >
                      {loadingRecoveryBackups ? '读取中…' : '重新读取备份'}
                    </button>
                  </div>
                  {loadingRecoveryBackups ? (
                    <p className="mt-2 text-[11px] text-neutral-500">正在从 Cloud SQL 读取成功备份…</p>
                  ) : recoveryBackups.length ? (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[560px] text-[11px]">
                        <thead><tr className="text-left text-neutral-500">
                          <th className="pb-2 pr-3">备份 ID</th><th className="pb-2 pr-3">完成时间</th><th className="pb-2 pr-3">类型</th><th className="pb-2">操作</th>
                        </tr></thead>
                        <tbody>
                          {recoveryBackups.map(backup => (
                            <tr key={backup.id} className="border-t border-neutral-100">
                              <td className="py-2 pr-3 font-mono">{backup.id}</td>
                              <td className="py-2 pr-3">{backup.startTime ? new Date(backup.startTime).toLocaleString(getIntlLocale(lang)) : '时间未知'}</td>
                              <td className="py-2 pr-3">{backup.type || '自动备份'}</td>
                              <td className="py-2">
                                <button
                                  type="button"
                                  onClick={() => void launchRecoveryDrill(backup.id)}
                                  disabled={!acknowledgeRecoveryCost || launchingRecoveryDrill || !googleCloudSettings.recoveryServiceAccountConfigured}
                                  className="rounded bg-neutral-950 px-2.5 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
                                >
                                  {launchingRecoveryDrill ? '启动中…' : '恢复到隔离实例'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-neutral-500">没有可选的成功备份。先在 Google Cloud 完成实例创建，并启用自动备份/PITR 或创建一次备份；本地 PostgreSQL .dump 不能用于 Cloud SQL 原生备份恢复。</p>
                  )}
                </div>
              )}

              <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">
                <input
                  type="checkbox"
                  checked={acknowledgeRecoveryCost}
                  onChange={event => setAcknowledgeRecoveryCost(event.target.checked)}
                  disabled={!selectedRecoverySource || !recoveryBackups.length}
                  className="mt-0.5 h-4 w-4 accent-amber-700"
                />
                <span>我确认此次操作会创建新的临时 Cloud SQL 实例并产生云费用；演练只从所选成功备份恢复到新目标，绝不覆盖源实例。目标实例需保留创建期间的费用，系统将在验证完成后自动删除。</span>
              </label>

              <div className="mt-4">
                <h4 className="text-[11px] font-bold text-neutral-800">恢复演练审计与清理记录</h4>
                {!recoveryDrills.length ? (
                  <p className="mt-2 text-[11px] text-neutral-500">{loadingRecoveryDrills ? '正在读取…' : '暂无恢复演练记录。'}</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {recoveryDrills.map(drill => (
                      <div key={drill.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-[11px]">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 font-semibold text-neutral-900">
                            <span>{recoveryDrillStatusLabel(drill.status)}</span>
                            <span className="font-mono text-neutral-500">{drill.targetInstanceId}</span>
                          </div>
                          <div className="mt-1 text-neutral-600">
                            源实例 {drill.sourceInstanceId} · 备份 {drill.backupRunId} · {new Date(drill.createdAt).toLocaleString(getIntlLocale(lang))}
                          </div>
                          {drill.error && <div className="mt-1 text-rose-700">状态详情：{drill.error}</div>}
                          <div className="mt-1 text-neutral-500">恢复验证：{drill.recoveryVerified ? '通过' : '未通过'} · 临时实例清理：{drill.cleanupComplete ? '完成' : '待完成'}</div>
                        </div>
                        {!drill.cleanupComplete && !isRecoveryDrillActive(drill.status) && (
                          <button
                            type="button"
                            onClick={() => void retryRecoveryCleanup(drill.id)}
                            disabled={cleaningRecoveryDrill === drill.id}
                            className="rounded-lg border border-rose-300 px-3 py-2 font-semibold text-rose-700 disabled:opacity-50"
                          >
                            {cleaningRecoveryDrill === drill.id ? '清理中…' : '重试清理临时实例'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-neutral-950"><Clock3 className="h-4 w-4" />备份计划与保留策略</div>
        <p className="mt-2 text-[11px] leading-5 text-neutral-500">
          计划使用所选时区执行；服务重启后会补跑当天已到期的备份计划。每份新备份会先由 pg_restore 验证归档并计算 SHA-256，再纳入保留策略。
        </p>
        {backupPolicy && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-800">
              <input
                type="checkbox"
                checked={backupPolicy.enabled}
                onChange={event => setBackupPolicy(current => current ? { ...current, enabled: event.target.checked } : current)}
                className="h-4 w-4 accent-neutral-900"
              />
              启用每日自动备份
            </label>
            <label className="text-[11px] font-semibold text-neutral-700">
              备份时间
              <input
                type="time"
                value={`${String(backupPolicy.hour).padStart(2, '0')}:${String(backupPolicy.minute).padStart(2, '0')}`}
                onChange={event => {
                  const [hour, minute] = event.target.value.split(':').map(Number);
                  setBackupPolicy(current => current ? { ...current, hour, minute } : current);
                }}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
              />
            </label>
            <label className="text-[11px] font-semibold text-neutral-700">
              时区
              <input
                value={backupPolicy.timezone}
                onChange={event => setBackupPolicy(current => current ? { ...current, timezone: event.target.value } : current)}
                maxLength={100}
                placeholder="Europe/Rome"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
              />
            </label>
            <label className="text-[11px] font-semibold text-neutral-700">
              本地保留份数（1–365）
              <input
                type="number"
                min={1}
                max={365}
                step={1}
                value={backupPolicy.retentionCount}
                onChange={event => setBackupPolicy(current => current ? { ...current, retentionCount: Number(event.target.value) } : current)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void saveBackupPolicy()}
                disabled={savingBackupPolicy}
                className="w-full rounded-lg bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {savingBackupPolicy ? '保存中…' : '保存备份策略'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-neutral-950"><HardDrive className="h-4 w-4" />数据表占用（Top 12）</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="pb-2 font-semibold">表名</th>
                <th className="pb-2 font-semibold">行数估算</th>
                <th className="pb-2 font-semibold">占用空间</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.topTables ?? []).map(table => (
                <tr key={table.name} className="border-t border-neutral-100">
                  <td className="py-1.5 font-mono text-neutral-800">{table.name}</td>
                  <td className="py-1.5 text-neutral-600">{table.rowEstimate.toLocaleString()}</td>
                  <td className="py-1.5 text-neutral-600">{formatBytes(table.sizeBytes)}</td>
                </tr>
              ))}
              {!overview?.topTables.length && (
                <tr><td colSpan={3} className="py-3 text-center text-neutral-400">{loading ? '加载中…' : '暂无数据'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {overview?.slowQueriesAvailable && overview.slowQueries.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-neutral-950"><Activity className="h-4 w-4" />慢查询 Top 8（按平均耗时）</div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="pb-2 font-semibold">SQL</th>
                  <th className="pb-2 font-semibold">调用次数</th>
                  <th className="pb-2 font-semibold">平均耗时</th>
                </tr>
              </thead>
              <tbody>
                {overview.slowQueries.map((query, index) => (
                  <tr key={index} className="border-t border-neutral-100">
                    <td className="py-1.5 max-w-md truncate font-mono text-neutral-800" title={query.query}>{query.query}</td>
                    <td className="py-1.5 text-neutral-600">{query.calls.toLocaleString()}</td>
                    <td className="py-1.5 text-neutral-600">{query.meanMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-neutral-950"><Cloud className="h-4 w-4" />异地备份同步</div>
        <p className="mt-2 text-[11px] leading-5 text-neutral-500">
          每次手动或每日自动生成备份后，会同步到已启用的目标；可同时启用 S3 和 Google Drive。云端副本独立于本机 30 份保留策略，远端清理请使用对象存储生命周期规则。
        </p>
        {syncSettings && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-3">
              <label className="flex items-center justify-between gap-3 text-xs font-semibold text-neutral-800">
                <span>S3 兼容对象存储 / Cloud Storage HMAC</span>
                <input
                  type="checkbox"
                  checked={syncSettings.s3.enabled}
                  onChange={event => setSyncSettings(current => current ? { ...current, s3: { ...current.s3, enabled: event.target.checked } } : current)}
                  className="h-4 w-4 accent-neutral-900"
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-neutral-700">
                <input
                  type="checkbox"
                  checked={syncSettings.s3.dedicatedCredentialsEnabled}
                  disabled={syncSettings.s3.credentialsIsolation === 'dedicated'}
                  onChange={event => setSyncSettings(current => current ? { ...current, s3: { ...current.s3, dedicatedCredentialsEnabled: event.target.checked } } : current)}
                  className="h-4 w-4 accent-neutral-900"
                />
                为数据库备份使用独立 S3 凭据（建议；与媒体存储权限隔离）
              </label>
              <div className="mt-2 text-[11px] text-neutral-500">
                {syncSettings.s3.credentialsIsolation === 'dedicated'
                  ? '数据库备份使用独立的 S3 凭据，与商品图片/视频媒体存储隔离。'
                  : syncSettings.s3.credentialsIsolation === 'shared-legacy'
                    ? '当前沿用旧版媒体存储凭据。为隔离权限，请填写专用备份 Access Key 和 Secret Key 后保存迁移。'
                    : '请为备份专门创建受限的 S3 凭据；媒体存储密钥不会在这里回显。'}
                {' '}原生 Google Cloud Storage 可使用 Cloud Storage Interoperability HMAC 密钥；Google Drive 凭据需单独配置。
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-[11px] font-semibold text-neutral-700">
                  S3 兼容 Endpoint
                  <input
                    value={syncSettings.s3.endpoint}
                    onChange={event => setSyncSettings(current => current ? { ...current, s3: { ...current.s3, endpoint: event.target.value } } : current)}
                    maxLength={2048}
                    placeholder="https://s3.eu-west-1.amazonaws.com"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-normal"
                  />
                </label>
                <label className="text-[11px] font-semibold text-neutral-700">
                  Region
                  <input
                    value={syncSettings.s3.region}
                    onChange={event => setSyncSettings(current => current ? { ...current, s3: { ...current.s3, region: event.target.value } } : current)}
                    maxLength={63}
                    placeholder="eu-west-1"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-normal"
                  />
                </label>
                <label className="text-[11px] font-semibold text-neutral-700 sm:col-span-2">
                  独立备份 Bucket
                  <input
                    value={syncSettings.s3.bucket}
                    onChange={event => setSyncSettings(current => current ? { ...current, s3: { ...current.s3, bucket: event.target.value } } : current)}
                    maxLength={63}
                    placeholder="ruda-database-backups"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-normal"
                  />
                </label>
                <label className="text-[11px] font-semibold text-neutral-700">
                  专用 Access Key ID {syncSettings.s3.accessKeyIdConfigured && <span className="font-normal text-emerald-700">（已保存）</span>}
                  <input
                    value={s3AccessKeyId}
                    onChange={event => setS3AccessKeyId(event.target.value)}
                    autoComplete="new-password"
                    placeholder="留空则保留已保存密钥"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-normal"
                  />
                </label>
                <label className="text-[11px] font-semibold text-neutral-700">
                  专用 Secret Access Key {syncSettings.s3.secretAccessKeyConfigured && <span className="font-normal text-emerald-700">（已保存）</span>}
                  <PasswordInput
                    value={s3SecretAccessKey}
                    onChange={event => setS3SecretAccessKey(event.target.value)}
                    autoComplete="new-password"
                    placeholder="留空则保留已保存密钥"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 pr-10 text-xs font-normal"
                  />
                </label>
              </div>
              <label className="mt-3 block text-[11px] font-semibold text-neutral-700">
                对象键目录前缀
                <input
                  value={syncSettings.s3.prefix}
                  onChange={event => setSyncSettings(current => current ? { ...current, s3: { ...current.s3, prefix: event.target.value } } : current)}
                  maxLength={200}
                  placeholder="database-backups"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-normal"
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-neutral-700">
                <input
                  type="checkbox"
                  checked={syncSettings.s3.forcePathStyle}
                  onChange={event => setSyncSettings(current => current ? { ...current, s3: { ...current.s3, forcePathStyle: event.target.checked } } : current)}
                  className="h-4 w-4 accent-neutral-900"
                />
                Path-style（MinIO、自建 S3 兼容服务）
              </label>
              <button
                type="button"
                onClick={() => void testSyncProvider('s3')}
                disabled={!syncSettings.s3.configured || testingSyncProvider !== null}
                className="mt-3 rounded-lg border border-neutral-300 px-3 py-2 text-[11px] font-semibold text-neutral-700 disabled:opacity-50"
              >
                {testingSyncProvider === 's3' ? '测试中…' : '测试 S3 备份上传'}
              </button>
            </div>

            <div className="rounded-lg border border-neutral-200 p-3">
              <label className="flex items-center justify-between gap-3 text-xs font-semibold text-neutral-800">
                <span>同步到 Google Drive</span>
                <input
                  type="checkbox"
                  checked={syncSettings.googleDrive.enabled}
                  onChange={event => setSyncSettings(current => current ? { ...current, googleDrive: { ...current.googleDrive, enabled: event.target.checked } } : current)}
                  className="h-4 w-4 accent-neutral-900"
                />
              </label>
              <div className="mt-2 text-[11px] text-neutral-500">
                {syncSettings.googleDrive.serviceAccountConfigured ? '服务账号凭据已加密保存；留空不会覆盖已保存凭据。' : '请输入 Google Cloud 服务账号 JSON 密钥。'}
              </div>
              <textarea
                value={googleDriveServiceAccountJson}
                onChange={event => setGoogleDriveServiceAccountJson(event.target.value)}
                rows={3}
                autoComplete="off"
                spellCheck={false}
                placeholder='{"client_email":"...","private_key":"..."}'
                className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-mono"
              />
              <label className="mt-2 block text-[11px] font-semibold text-neutral-700">
                Drive 文件夹 ID（留空使用服务账号的“我的云端硬盘”）
                <input
                  value={syncSettings.googleDrive.folderId}
                  onChange={event => setSyncSettings(current => current ? { ...current, googleDrive: { ...current.googleDrive, folderId: event.target.value } } : current)}
                  maxLength={200}
                  placeholder="文件夹 ID"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-normal"
                />
              </label>
              <button
                type="button"
                onClick={() => void testSyncProvider('googleDrive')}
                disabled={(!syncSettings.googleDrive.serviceAccountConfigured && !googleDriveServiceAccountJson.trim()) || testingSyncProvider !== null}
                className="mt-3 rounded-lg border border-neutral-300 px-3 py-2 text-[11px] font-semibold text-neutral-700 disabled:opacity-50"
              >
                {testingSyncProvider === 'googleDrive' ? '测试中…' : '测试 Drive 凭据和文件夹'}
              </button>
            </div>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void saveSyncSettings()}
            disabled={!syncSettings || savingSyncSettings}
            className="rounded-lg bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {savingSyncSettings ? '保存中…' : '保存同步设置'}
          </button>
          <span className="text-[11px] text-neutral-500">Drive 服务账号需对目标文件夹具有编辑权限；密钥只写入服务器并加密保存，不会回显。</span>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-neutral-950"><ShieldCheck className="h-4 w-4" />数据库备份</div>
          <button
            type="button"
            onClick={() => void runBackup()}
            disabled={backingUp}
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />{backingUp ? '备份中…' : '立即备份'}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-neutral-500">
          自动任务按上方时区和计划运行，本机保留最近 {backupPolicy?.retentionCount ?? 30} 份；创建后自动校验归档并计算 SHA-256。最近备份：{latestBackup ? `${latestBackup.filename} · ${new Date(latestBackup.createdAt).toLocaleString(getIntlLocale(lang))}` : '暂无'}。云端目标支持单份重试。
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="pb-2 font-semibold">文件名</th>
                <th className="pb-2 font-semibold">大小</th>
                <th className="pb-2 font-semibold">创建时间</th>
                <th className="pb-2 font-semibold">完整性</th>
                <th className="pb-2 font-semibold">云端同步状态</th>
                <th className="pb-2 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {backups.map(backup => (
                <tr key={backup.filename} className="border-t border-neutral-100">
                  <td className="py-1.5 font-mono text-neutral-800">{backup.filename}</td>
                  <td className="py-1.5 text-neutral-600">{formatBytes(backup.sizeBytes)}</td>
                  <td className="py-1.5 text-neutral-600">{new Date(backup.createdAt).toLocaleString(getIntlLocale(lang))}</td>
                  <td className="py-1.5 text-[10px]">
                    <div className={`inline-flex items-center gap-1 font-semibold ${backup.verificationStatus === 'verified' ? 'text-emerald-700' : backup.verificationStatus === 'failed' ? 'text-rose-700' : 'text-amber-700'}`}>
                      <BadgeCheck className="h-3 w-3" />
                      {backup.verificationStatus === 'verified' ? '已验证' : backup.verificationStatus === 'failed' ? '验证失败' : '待验证'}
                    </div>
                    {backup.checksumSha256 && <div className="mt-1 font-mono text-neutral-500" title={backup.checksumSha256}>{backup.checksumSha256.slice(0, 12)}…</div>}
                  </td>
                  <td className="py-1.5 text-[10px]">
                    <div className={backup.sync?.s3.status === 'failed' ? 'text-rose-700' : 'text-neutral-600'}>S3：{syncStatusLabel(backup.sync?.s3, Boolean(syncSettings?.s3.enabled), lang)}</div>
                    <div className={`mt-1 ${backup.sync?.googleDrive.status === 'failed' ? 'text-rose-700' : 'text-neutral-600'}`}>Drive：{syncStatusLabel(backup.sync?.googleDrive, Boolean(syncSettings?.googleDrive.enabled), lang)}</div>
                  </td>
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => void verifyBackup(backup.filename)}
                          disabled={verifyingFile === backup.filename}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          <BadgeCheck className={`h-3 w-3 ${verifyingFile === backup.filename ? 'animate-pulse' : ''}`} />{verifyingFile === backup.filename ? '校验中…' : '校验'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void syncBackup(backup.filename)}
                          disabled={syncingFile === backup.filename}
                          className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-50 disabled:opacity-50"
                        >
                          <RotateCw className={`h-3 w-3 ${syncingFile === backup.filename ? 'animate-spin' : ''}`} />{syncingFile === backup.filename ? '同步中…' : '同步'}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadBackup(backup.filename)}
                        className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1 text-[11px] font-semibold text-neutral-800 hover:bg-neutral-50"
                      >
                        <DownloadCloud className="h-3 w-3" />下载
                      </button>
                      {canDeleteBackups && (
                        <button
                          type="button"
                          onClick={() => void deleteBackup(backup.filename)}
                          disabled={deletingFile === backup.filename || syncingFile === backup.filename || verifyingFile === backup.filename}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />{deletingFile === backup.filename ? '删除中…' : '删除本机副本'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!backups.length && (
                <tr><td colSpan={6} className="py-3 text-center text-neutral-400">{loading ? '加载中…' : '暂无备份，点击"立即备份"创建第一份。'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
};

export default AdminDatabaseCenter;
