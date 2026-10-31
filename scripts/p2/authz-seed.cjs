/**
 * P2 授权四态测试夹具（写入隔离库，禁止指向生产库）。
 *
 * 用法：
 *   DATABASE_URL='postgresql://.../ruda_p2_authz' node scripts/p2/authz-seed.cjs
 *
 * 安全护栏：DATABASE_URL 必须包含 `ruda_p2_authz`，否则直接退出，
 * 避免误在生产库创建/删除夹具数据。
 */
const { PrismaClient } = require('@prisma/client');

if (!/ruda_p2_authz/.test(process.env.DATABASE_URL || '')) {
  console.error('拒绝执行：DATABASE_URL 必须指向隔离库 ruda_p2_authz');
  process.exit(1);
}

const p = new PrismaClient();

const MERCHANT = 'p2-authz-merchant';
const IMG = 'http://127.0.0.1:4101/demo-products/category-bags.jpg';
const IMG2 = 'http://127.0.0.1:4101/demo-products/category-wallets.jpg';

const base = {
  merchantId: MERCHANT,
  merchantName: 'P2 AUTHZ',
  category: 'bags',
  subCategory: 'tote',
  brand: 'P2',
  season: 'SS26',
  images: JSON.stringify([IMG]),
  wholesalePrice: '50.00',
  wholesalePrice100: '45.00',
  rrpPrice: '99.00',
  status: 'active',
  inventoryStatus: 'in_stock',
  origin: 'Italy',
  fabric: 'calf leather',
  composition: '100% calf leather',
  weight: '0.8kg',
  packaging: 'dust bag',
  washCare: 'dry clean',
  description: 'P2 authz fixture',
  skus: JSON.stringify([
    { sku: 'P2-BLK', color: 'Black', size: 'One', stockCentral: 20, cost: '10.00' }
  ]),
  lifecycleStatus: 'published'
};

(async () => {
  await p.$executeRawUnsafe(`DELETE FROM "Product" WHERE "merchantId" = '${MERCHANT}'`);
  await p.$executeRawUnsafe(`DELETE FROM "Merchant" WHERE "id" = '${MERCHANT}'`);
  await p.$executeRawUnsafe(`DELETE FROM "VaultAccessRequest"`);
  await p.$executeRawUnsafe(`DELETE FROM "Customer" WHERE "id" LIKE 'p2-authz-%'`);

  await p.merchant.create({
    data: {
      id: MERCHANT,
      name: 'P2 AUTHZ',
      companyLegalName: 'P2 AUTHZ SRL',
      code: 'P2AUTHZ',
      storeSlug: MERCHANT,
      storefrontEnabled: true,
      isVerified: true,
      businessType: 'wholesale',
      industry: 'LEATHER_GOODS',
      country: 'Italy',
      city: 'Firenze',
      showroomAddress: 'Via Test 1',
      showroomArea: 'Toscana',
      showroomImage: IMG,
      logo: IMG,
      banner: IMG,
      tagline: 'P2 authz fixture',
      description: 'P2 authz fixture merchant',
      specialties: 'bags',
      foundedYear: 2000,
      contactPerson: 'Test',
      contactPhone: '+390000000',
      contactEmail: 'authz@p2.test',
      vatNumber: 'IT00000000000'
    }
  });

  const mk = async (id, visibility, extra = {}) =>
    p.product.create({
      data: { ...base, id, styleNo: id.toUpperCase(), name: id, visibility, ...extra }
    });

  await mk('p2-authz-public', 'public', {
    name: 'Tote 手提袋 · 植鞣牛皮',
    name_zh: 'Tote 手提袋 · 植鞣牛皮',
    fabric: '植鞣牛皮',
    fabric_zh: '植鞣牛皮',
    origin: '意大利',
    origin_zh: '意大利',
    description: '整张植鞣牛皮裁切，手工缝线，内衬棉麻。',
    description_zh: '整张植鞣牛皮裁切，手工缝线，内衬棉麻。',
    subCategory: 'tote',
    images: JSON.stringify([IMG])
  });
  await mk('p2-authz-wholesale', 'wholesale', {
    name: 'Shoulder 单肩包 · 小牛皮',
    name_zh: 'Shoulder 单肩包 · 小牛皮',
    fabric: '小牛皮',
    fabric_zh: '小牛皮',
    origin: '意大利',
    origin_zh: '意大利',
    description: '小牛皮包身，可调节肩带，磁吸开合。',
    description_zh: '小牛皮包身，可调节肩带，磁吸开合。',
    subCategory: 'shoulder',
    images: JSON.stringify([IMG])
  });
  await mk('p2-authz-private', 'private', {
    name: 'Vault 链条包 · 限量',
    name_zh: 'Vault 链条包 · 限量',
    fabric: '山羊皮',
    fabric_zh: '山羊皮',
    origin: '意大利',
    origin_zh: '意大利',
    description: '限量配色，仅对授权买手开放。',
    description_zh: '限量配色，仅对授权买手开放。',
    subCategory: 'chain',
    images: JSON.stringify([IMG2])
  });
  await mk('p2-authz-exclusive', 'public', {
    isExclusiveProtected: true,
    protectionLevel: 'exclusive',
    name: 'Exclusive 手拿包 · 独家',
    name_zh: 'Exclusive 手拿包 · 独家',
    fabric: '鳄鱼纹牛皮',
    fabric_zh: '鳄鱼纹牛皮',
    origin: '意大利',
    origin_zh: '意大利',
    description: '独家款式，需授权查看。',
    description_zh: '独家款式，需授权查看。',
    subCategory: 'clutch',
    images: JSON.stringify([IMG2])
  });

  const customerBase = {
    address: 'Via Buyer 1',
    city: 'Milano',
    country: 'Italy',
    contactPerson: 'Buyer',
    phone: '+390000001',
    registrationDate: new Date().toISOString()
  };
  const approved = await p.customer.create({
    data: { ...customerBase, id: 'p2-authz-approved', companyName: 'Approved Buyer', email: 'approved@p2.test', status: 'approved', vatNumber: 'IT11111111111' }
  });
  // 已审核但未获得 Vault 授权的买家（用于区分 S3 / S4）
  const approvedNoVault = await p.customer.create({
    data: { ...customerBase, id: 'p2-authz-approved2', companyName: 'Approved No Vault', email: 'approved2@p2.test', status: 'approved', vatNumber: 'IT33333333333' }
  });
  const pending = await p.customer.create({
    data: { ...customerBase, id: 'p2-authz-pending', companyName: 'Pending Buyer', email: 'pending@p2.test', status: 'pending', vatNumber: 'IT22222222222' }
  });

  await p.vaultAccessRequest.create({
    data: {
      customerId: approved.id,
      merchantId: MERCHANT,
      merchantName: 'P2 AUTHZ',
      companyName: 'Approved Buyer',
      contactPerson: 'Buyer',
      phone: '+390000001',
      businessType: 'Boutique',
      status: 'approved',
      appliedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    }
  });

  const counts = await p.product.groupBy({ by: ['visibility'], where: { merchantId: MERCHANT }, _count: true });
  console.log('merchant=' + MERCHANT, 'customers=' + [approved.id, approvedNoVault.id, pending.id].join(','), JSON.stringify(counts));
  await p.$disconnect();
})().catch(e => { console.error('SEED_FAIL', e.message); process.exit(1); });
