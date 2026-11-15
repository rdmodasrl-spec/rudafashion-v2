function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const studioProjectTables: Record<string, string> = {
  MerchantStudioProject: 'public.MerchantStudioProject',
  MerchantStudioProjectVersion: 'public.MerchantStudioProjectVersion',
  MerchantStudioProjectFile: 'public.MerchantStudioProjectFile'
};

export function getMissingMerchantStudioStorageMigration(error: unknown): string | null {
  if (!isRecord(error) || !isRecord(error.meta)) return null;
  const modelName = error.meta.modelName;
  if (error.code === 'P2021') {
    if (typeof modelName !== 'string' || error.meta.table !== studioProjectTables[modelName]) return null;
    return modelName === 'MerchantStudioProjectFile'
      ? '20261115120000_studio_private_files_and_job_projects'
      : '20261114210000_merchant_studio_projects';
  }
  if (error.code === 'P2022'
    && modelName === 'ModaGptTask'
    && (error.meta.column === 'projectId' || error.meta.column === 'public.ModaGptTask.projectId')) {
    return '20261115120000_studio_private_files_and_job_projects';
  }
  return null;
}

export function isMissingMerchantStudioProjectStorage(error: unknown): boolean {
  return getMissingMerchantStudioStorageMigration(error) !== null;
}
