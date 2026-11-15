import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getMissingMerchantStudioStorageMigration,
  isMissingMerchantStudioProjectStorage
} from '../src/server/merchantStudioProjectStorage';

test('recognizes only missing shared Studio project tables', () => {
  for (const [modelName, table] of [
    ['MerchantStudioProject', 'public.MerchantStudioProject'],
    ['MerchantStudioProjectVersion', 'public.MerchantStudioProjectVersion'],
    ['MerchantStudioProjectFile', 'public.MerchantStudioProjectFile']
  ]) {
    assert.equal(isMissingMerchantStudioProjectStorage({
      code: 'P2021',
      meta: { modelName, table }
    }), true);
  }
  assert.equal(isMissingMerchantStudioProjectStorage({
    code: 'P2022',
    meta: { modelName: 'ModaGptTask', column: 'projectId' }
  }), true);
  assert.equal(getMissingMerchantStudioStorageMigration({
    code: 'P2021',
    meta: { modelName: 'MerchantStudioProjectFile', table: 'public.MerchantStudioProjectFile' }
  }), '20261115120000_studio_private_files_and_job_projects');
});

test('does not classify unrelated or malformed database errors as project migrations', () => {
  for (const error of [
    { code: 'P2021', meta: { modelName: 'MerchantStudioEntitlement', table: 'public.MerchantStudioEntitlement' } },
    { code: 'P2021', meta: { modelName: 'MerchantStudioProject', table: 'public.OtherTable' } },
    { code: 'P2021', meta: { modelName: 'MerchantStudioProject', table: 'public.MerchantStudioProjectBackup' } },
    { code: 'P2022', meta: { modelName: 'MerchantStudioProject', table: 'public.MerchantStudioProject' } },
    { code: 'P2022', meta: { modelName: 'ModaGptTask', column: 'payload' } },
    { code: 'P2021', meta: { modelName: 'MerchantStudioProject' } },
    null
  ]) {
    assert.equal(isMissingMerchantStudioProjectStorage(error), false);
  }
});
