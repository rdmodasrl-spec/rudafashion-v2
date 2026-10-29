import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const rows = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND (
    (table_name = 'SalesQuoteItem' AND column_name = 'pricingSnapshot')
    OR (table_name = 'MerchantStore' AND column_name IN ('accessUsername','accessPasswordHash'))
    OR (table_name = 'FashionPost' AND column_name = 'productId')
  ) ORDER BY table_name, column_name`;
console.log(rows);
const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
  SELECT table_name FROM information_schema.tables WHERE table_schema='public'
  AND table_name IN ('StoreAccessCredential','MerchantStoreAccessCredential')`;
console.log(tables);
await prisma.$disconnect();
