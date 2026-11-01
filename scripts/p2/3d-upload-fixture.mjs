/**
 * RUDA 3D 上传闭环验收夹具（隔离库专用）。
 *
 * 目的：在**隔离数据库**里复刻一个可通过 industry demo login 登录的箱包商家 +
 * 一个带图片媒体的商品，用来真实走完「登录 → 上传 GLB → 保存 → 审核 → 买家展示」。
 *
 * 安全护栏：DATABASE_URL 必须包含 ruda_p2_3d，且必须是隔离库，否则直接退出。
 * 不写生产库、不改生产商品。
 *
 * 用法：
 *   DATABASE_URL='postgresql://.../ruda_p2_3d' node scripts/p2/3d-upload-fixture.mjs
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

if (!/ruda_p2_3d/.test(process.env.DATABASE_URL || '')) {
  console.error('拒绝执行：DATABASE_URL 必须指向隔离库 ruda_p2_3d');
  process.exit(1);
}

const prisma = new PrismaClient();
const DEMO_MERCHANT = 'demo-industry-bags-wholesale';

const merchantBase = {
  name: 'DEMO · 箱包批发商',
  companyLegalName: 'DEMO · 箱包批发商 · 演示数据',
  code: DEMO_MERCHANT.toUpperCase(),
  storeLookupCode: '900001',
  storeSlug: DEMO_MERCHANT,
  country: 'Italia',
  city: 'Firenze',
  showroomAddress: 'Via dei Conciatori 8',
  showroomArea: 'Toscana',
  showroomImage: 'https://modaui.com/demo-products/category-bags.jpg',
  logo: 'https://modaui.com/demo-products/category-bags.jpg',
  banner: 'https://modaui.com/demo-products/category-bags.jpg',
  tagline: 'Pelletteria italiana',
  description: '隔离库验收用演示商家，不代表真实商家。',
  specialties: 'bags',
  foundedYear: 2000,
  contactPerson: 'QA',
  contactPhone: '+3900000000',
  contactEmail: 'qa-bags@ruda.test',
  vatNumber: 'IT00000000000',
  isVerified: true,
  storefrontEnabled: true,
  industry: 'LEATHER_GOODS',
  industryTemplate: 'bags_wholesale',
  // 商品编辑锁默认关闭；隔离夹具需要它开启才能测更新/替换路径
  settings: JSON.stringify({ productEditingEnabled: true })
};

await prisma.product.deleteMany({ where: { merchantId: DEMO_MERCHANT } });
await prisma.authAccount.deleteMany({ where: { merchantId: DEMO_MERCHANT } });
await prisma.merchant.deleteMany({ where: { id: DEMO_MERCHANT } });

await prisma.merchant.create({ data: { id: DEMO_MERCHANT, ...merchantBase } });

// 管理员账号：带 products.review 权限（用于真实审核接口测试）
await prisma.authAccount.deleteMany({ where: { username: { in: ['qa-reviewer', 'qa-no-perm'] } } });
await prisma.authAccount.createMany({
  data: [
    {
      id: randomUUID(),
      role: 'admin',
      username: 'qa-reviewer',
      passwordHash: 'qa-reviewer-hash',
      permissions: JSON.stringify(['products.review'])
    },
    {
      id: randomUUID(),
      role: 'admin',
      username: 'qa-no-perm',
      passwordHash: 'qa-no-perm-hash',
      permissions: JSON.stringify(['settings.ai_support'])
    }
  ]
});

// demo login 要求该商家恰好有一个 merchant 账号
await prisma.authAccount.create({
  data: {
    id: randomUUID(),
    role: 'merchant',
    merchantId: DEMO_MERCHANT,
    merchantCode: DEMO_MERCHANT.toUpperCase(),
    passwordHash: 'demo-fixture-no-login'
  }
});

// 一个带图片媒体的商品（用于验证上传/删除模型不会破坏图片）
await prisma.product.create({
  data: {
    id: `qa-3d-upload-${Date.now()}`,
    styleNo: 'QA-3D-001',
    name: 'QA 上传验收包',
    category: 'bags',
    subCategory: 'tote',
    brand: 'RUDA QA',
    season: 'SS26',
    images: JSON.stringify(['https://modaui.com/demo-products/category-bags.jpg']),
    media: JSON.stringify([
      {
        id: `qa-3d-upload-main-${Date.now()}`,
        type: 'image',
        url: 'https://modaui.com/demo-products/category-bags.jpg',
        role: 'main',
        source: 'merchant-upload'
      }
    ]),
    wholesalePrice: '58.00',
    rrpPrice: '99.00',
    status: 'active',
    inventoryStatus: 'in_stock',
    origin: 'Italia',
    fabric: 'calf leather',
    composition: '100% calf leather',
    weight: '0.4kg',
    packaging: 'dust bag',
    washCare: 'dry clean',
    description: '隔离库验收商品',
    skus: JSON.stringify([{ sku: 'QA-3D-001-BLK', color: 'Black', size: 'One', stockCentral: 30, cost: '10.00' }]),
    merchantId: DEMO_MERCHANT,
    merchantName: merchantBase.name,
    lifecycleStatus: 'published',
    visibility: 'public'
  }
});

const merchant = await prisma.merchant.findUnique({ where: { id: DEMO_MERCHANT }, select: { id: true, code: true } });
const accounts = await prisma.authAccount.count({ where: { merchantId: DEMO_MERCHANT } });
const product = await prisma.product.findFirst({ where: { merchantId: DEMO_MERCHANT }, select: { id: true, media: true } });
const admins = await prisma.authAccount.findMany({ where: { role: 'admin', username: { in: ['qa-reviewer', 'qa-no-perm'] } }, select: { username: true, permissions: true } });
console.log('merchant', merchant, 'accounts', accounts, 'admins', JSON.stringify(admins));
console.log('product media', product?.media);
await prisma.$disconnect();
