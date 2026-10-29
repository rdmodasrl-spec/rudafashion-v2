import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const plans = await prisma.modaGptBillingPlan.findMany({
  orderBy: [{ interval: 'asc' }, { monthlyPriceMinor: 'asc' }],
  select: {
    id: true,
    interval: true,
    status: true,
    purchaseEnabled: true,
    monthlyPriceMinor: true,
    currency: true,
    _count: { select: { modaGptBillingSubscription: true } }
  }
});
console.log('PLANS');
for (const plan of plans) {
  console.log(JSON.stringify({
    id: plan.id,
    interval: plan.interval,
    status: plan.status,
    purchaseEnabled: plan.purchaseEnabled,
    price: plan.monthlyPriceMinor,
    currency: plan.currency,
    subscriptions: plan._count.modaGptBillingSubscription
  }));
}

const annualSubscriptions = await prisma.modaGptBillingSubscription.groupBy({
  by: ['planId', 'status'],
  where: { planId: { in: ['PLUS_YEAR', 'PRO_YEAR', 'BUSINESS_YEAR'] } },
  _count: { _all: true }
});
console.log('ANNUAL_SUBSCRIPTIONS');
console.log(JSON.stringify(annualSubscriptions));

const migrations = await prisma.$queryRaw<Array<{
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}>>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 8`;
console.log('MIGRATIONS');
for (const migration of migrations) {
  console.log(JSON.stringify({
    name: migration.migration_name,
    finished: Boolean(migration.finished_at),
    rolledBack: Boolean(migration.rolled_back_at)
  }));
}

await prisma.$disconnect();
