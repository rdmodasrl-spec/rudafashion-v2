import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const growthScriptPath = new URL('../scripts/test-ai-growth-p0-isolated.sh', import.meta.url);
const e2eScriptPath = new URL('../scripts/test-pos-e2e-isolated.sh', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('isolated PostgreSQL scripts clean the environment and verify owned container IDs', async () => {
  const scripts = await Promise.all([
    readFile(growthScriptPath, 'utf8'),
    readFile(e2eScriptPath, 'utf8')
  ]);

  for (const source of scripts) {
    assert.match(source, /set -euo pipefail/);
    assert.match(source, /env -i/);
    assert.match(source, /--cidfile "\$cid_file"/);
    assert.match(source, /--label "com\.ruda\.test-run=\$run_id"/);
    assert.match(source, /RUDA_ISOLATED_POSTGRES_CONTAINER_ID="\$container_id"/);
    assert.match(source, /RUDA_ISOLATED_POSTGRES_RUN_ID="\$run_id"/);
    assert.match(source, /docker_local inspect --format/);
    assert.match(source, /docker_local rm --force "\$candidate_id"/);
    assert.doesNotMatch(source, /docker(?:_local)? rm --force "\$container_name"/);
    assert.match(source, /127\\\.0\\\.0\\\.1:/);
    assert.match(source, /ownership.*container ownership check failed/s);
    assert.match(source, /if ! docker_local run/);
    assert.match(source, /if \[\[ "\$ready" != true \]\]/);
  }
});

test('package PostgreSQL and E2E commands route through isolated container scripts', async () => {
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
    scripts: Record<string, string>;
  };
  for (const name of [
    'test:billing:integration',
    'test:modagpt:integration',
    'test:modagpt:industries:integration',
    'test:modagpt:brain:integration',
    'test:p0:integration'
  ]) {
    assert.match(packageJson.scripts[name], /^bash scripts\/test-ai-growth-p0-isolated\.sh/);
  }
  assert.equal(packageJson.scripts['test:e2e'], 'bash scripts/test-pos-e2e-isolated.sh');
  assert.equal(packageJson.scripts['test:e2e:seed'], 'bash scripts/test-pos-e2e-isolated.sh --seed-only');
});
