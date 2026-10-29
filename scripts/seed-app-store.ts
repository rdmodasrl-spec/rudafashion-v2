
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding App Store data...');

  // 1. Create Categories
  const categories = [
    { name: 'Communication', slug: 'communication', icon: 'Mail', sortOrder: 1 },
    { name: 'AI Tools', slug: 'ai-tools', icon: 'Bot', sortOrder: 2 },
    { name: 'Sales & CRM', slug: 'sales-crm', icon: 'Users', sortOrder: 3 },
    { name: 'Products', slug: 'products', icon: 'Package', sortOrder: 4 },
    { name: 'Inventory', slug: 'inventory', icon: 'Warehouse', sortOrder: 5 },
    { name: 'Orders', slug: 'orders', icon: 'ShoppingCart', sortOrder: 6 },
    { name: 'Marketing', slug: 'marketing', icon: 'Megaphone', sortOrder: 7 },
    { name: 'Analytics', slug: 'analytics', icon: 'BarChart3', sortOrder: 8 },
    { name: '生产制造', slug: 'manufacturing', icon: 'Factory', sortOrder: 9 },
  ];

  for (const cat of categories) {
    await prisma.appCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  const communicationCat = await prisma.appCategory.findUnique({ where: { slug: 'communication' } });

  if (!communicationCat) throw new Error('Category not found');

  // 2. Create the domain ownership verification app; mailbox hosting is not included.
  await prisma.app.upsert({
    where: { appId: 'ruda-business-email' },
    update: {},
    create: {
      appId: 'ruda-business-email',
      name: '邮箱域名配置',
      slug: 'ruda-business-email',
      description: '免费添加域名并验证所有权；不提供邮箱账户或邮件收发。',
      detailedIntro: '使用 DNS TXT 记录验证企业域名所有权。RUDA 尚未连接邮箱托管服务，因此不提供邮箱账户、Webmail、IMAP/SMTP 或邮件收发。',
      icon: 'Mail',
      categoryId: communicationCat.id,
      version: '1.0.0',
      status: 'published',
      pricingType: 'free',
      pricePlan: {},
      developer: 'RUDA FASHION',
      permissions: JSON.stringify(['domain.manage']),
      features: JSON.stringify(['域名添加', 'DNS TXT 所有权验证']),
    },
  });

  // 3. 智能生产链：免费原生应用，商家在应用商店自主安装后才可用。
  const manufacturingCat = await prisma.appCategory.findUnique({ where: { slug: 'manufacturing' } });
  if (!manufacturingCat) throw new Error('Manufacturing category not found');

  await prisma.app.upsert({
    where: { appId: 'ruda-production-chain' },
    update: {},
    create: {
      appId: 'ruda-production-chain',
      name: '智能生产链',
      slug: 'ruda-production-chain',
      description: '连接服装企业与加工厂，实现生产跟踪、物料管理、质量验收和在线对账。',
      detailedIntro: '从商品选择、颜色尺码数量、加工厂邀请，到面辅料发料与工厂签收、进度汇报、分批交货验收、合格成衣入库、加工费对账与付款记录，全部围绕同一张生产单追溯，并复用 RUDA 现有商品、SKU、物料与库存数据。',
      icon: 'Factory',
      categoryId: manufacturingCat.id,
      version: '1.0.0',
      status: 'published',
      pricingType: 'free',
      pricePlan: {},
      developer: 'RUDA FASHION',
      permissions: JSON.stringify(['production.view', 'production.manage']),
      features: JSON.stringify([
        '外发生产单',
        '加工厂协同',
        '面辅料交接',
        '生产进度跟踪',
        '分批交货及质检',
        '加工费对账',
        '成衣入库'
      ]),
    },
  });

  console.log('App Store seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
