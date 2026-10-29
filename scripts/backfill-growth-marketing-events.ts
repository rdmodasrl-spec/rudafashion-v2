import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  prepareMarketingEventBackfill,
  validateMarketingEventBackfillDatabaseUrl
} from '../src/server/marketingEventBackfill';

async function main() {
  const args = process.argv.slice(2);
  if (args.some(argument => argument !== '--apply') || args.filter(argument => argument === '--apply').length > 1) {
    throw new Error('USAGE: tsx scripts/backfill-growth-marketing-events.ts [--apply]');
  }

  const legacyPath = path.join(process.cwd(), 'logs', 'marketing-events.json');
  const legacyText = await readFile(legacyPath, 'utf8');
  const { records, skipped } = prepareMarketingEventBackfill(JSON.parse(legacyText));
  const apply = args.includes('--apply');

  if (!apply) {
    console.log(`Dry run: ${records.length} legacy consented events are eligible; ${skipped} records would be skipped. No database writes performed. Re-run with --apply after deploying the GrowthMarketingEvent migration.`);
    return;
  }

  const databaseUrl = validateMarketingEventBackfillDatabaseUrl(process.env.GROWTH_MARKETING_BACKFILL_DATABASE_URL);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    let inserted = 0;
    for (let offset = 0; offset < records.length; offset += 1_000) {
      const result = await prisma.growthMarketingEvent.createMany({
        data: records.slice(offset, offset + 1_000),
        skipDuplicates: true
      });
      inserted += result.count;
    }
    console.log(`Backfill complete: inserted ${inserted} events; ${records.length - inserted} already existed; ${skipped} records skipped.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'GROWTH_MARKETING_EVENT_BACKFILL_FAILED');
  process.exitCode = 1;
});
