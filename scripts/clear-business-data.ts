import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ override: true });

const prisma = new PrismaClient();
const shouldExecute = process.argv.includes('--execute');

const deletionOrder = [
  'ProductionReport', 'ProductionWorkOrder', 'InventoryMovement', 'InventoryBalance',
  'MaterialInventoryMovement', 'MaterialInventoryBalance', 'ProductBomItem', 'Material',
  'Supplier', 'MerchantPayoutAllocation', 'OrderInvoice', 'ReturnRequest',
  'FulfillmentShipment', 'RefundTransaction', 'PaymentTransaction', 'StockReservation',
  'CreditLedgerEntry', 'OrderItem', 'Order', 'Product', 'ProductVariant', 'StockMovement',
  'StockTransfer', 'MerchantPayout', 'VaultAccessRequest', 'Appointment',
  'PaymentWebhookEvent', 'NotificationEvent', 'AuditLog', 'MerchantBankAccount',
  'MerchantStoreCategory'
] as const;

type TableRow = { table_name: string };
type CountRow = { count: number };

async function getExistingBusinessTables() {
  const rows = await prisma.$queryRaw<TableRow[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `;
  const existing = new Set(rows.map(row => row.table_name));
  return deletionOrder.filter(table => existing.has(table));
}

async function getCounts(tables: readonly string[]) {
  const counts = await Promise.all(tables.map(async table => {
    const result = await prisma.$queryRawUnsafe<CountRow[]>(
      `SELECT COUNT(*)::int AS count FROM "${table}"`
    );
    return [table, result[0]?.count ?? 0] as const;
  }));
  return Object.fromEntries(counts);
}

async function clearBusinessData(tables: readonly string[]) {
  await prisma.$transaction(async tx => {
    for (const table of tables) {
      await tx.$executeRawUnsafe(`DELETE FROM "${table}"`);
    }

    if (tables.length > 0) {
      await tx.$executeRawUnsafe(
        'UPDATE "Customer" SET "ordersCount" = 0, "totalSpent" = 0, "usedCredit" = 0'
      );
    }

    const retainedDataTables = await tx.$queryRaw<TableRow[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('AuthAccount', 'WarehouseLocation', 'Merchant', 'Customer', 'Showroom')
    `;
    const retainedTableNames = new Set(retainedDataTables.map(row => row.table_name));

    if (retainedTableNames.has('AuthAccount')) {
      await tx.$executeRawUnsafe(`DELETE FROM "AuthAccount" WHERE role IN ('buyer', 'merchant')`);
    }
    if (retainedTableNames.has('WarehouseLocation')) {
      await tx.$executeRawUnsafe(`DELETE FROM "WarehouseLocation"`);
    }
    if (retainedTableNames.has('Merchant')) {
      await tx.$executeRawUnsafe(`DELETE FROM "Merchant"`);
    }
    if (retainedTableNames.has('Customer')) {
      await tx.$executeRawUnsafe(`DELETE FROM "Customer"`);
    }
    if (retainedTableNames.has('Showroom')) {
      await tx.$executeRawUnsafe(`DELETE FROM "Showroom"`);
    }
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Business data clearing is disabled in production. Use an approved, scoped migration process.');
  }
  const tables = await getExistingBusinessTables();
  const before = await getCounts(tables);
  console.table(before);

  if (!shouldExecute) {
    console.log('Dry run only. Re-run with --execute to clear the listed business data.');
    return;
  }

  await clearBusinessData(tables);
  const after = await getCounts(tables);
  console.table(after);
  console.log('All demo data cleared. Only platform administrator accounts and security settings were retained.');
}

main()
  .catch(error => {
    console.error('Unable to clear business data:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
