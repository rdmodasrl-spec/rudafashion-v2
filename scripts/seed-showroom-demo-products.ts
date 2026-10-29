import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const productStyles = [
  { category: 'women', subCategory: 'Dress', nameZh: '流线剪裁连衣裙', nameIt: 'Abito dal taglio fluido', regularPrice: 24, retailPrice: 78, status: 'new' },
  { category: 'women', subCategory: 'Knitwear', nameZh: '轻柔针织上衣', nameIt: 'Maglia in morbida maglia', regularPrice: 19, retailPrice: 62, status: 'hot' },
  { category: 'women', subCategory: 'Blazer', nameZh: '利落廓形西装', nameIt: 'Blazer dalla linea sartoriale', regularPrice: 32, retailPrice: 105, status: 'new' },
  { category: 'men', subCategory: 'Outerwear', nameZh: '都市轻量夹克', nameIt: 'Giacca leggera urbana', regularPrice: 36, retailPrice: 118, status: 'new' },
  { category: 'women', subCategory: 'Dress', nameZh: '季末印花连衣裙', nameIt: 'Abito stampato di fine stagione', regularPrice: 16, retailPrice: 69, status: 'clearance' },
  { category: 'women', subCategory: 'Knitwear', nameZh: '特惠罗纹针织衫', nameIt: 'Maglia a coste in promozione', regularPrice: 13, retailPrice: 54, status: 'clearance' },
  { category: 'women', subCategory: 'Blazer', nameZh: '折扣修身西装外套', nameIt: 'Blazer slim in saldo', regularPrice: 22, retailPrice: 89, status: 'clearance' },
  { category: 'men', subCategory: 'Outerwear', nameZh: '特价经典休闲夹克', nameIt: 'Giacca casual classica in saldo', regularPrice: 25, retailPrice: 96, status: 'clearance' },
  { category: 'bags', subCategory: 'Tote bag', nameZh: '意式通勤托特包', nameIt: 'Borsa tote da lavoro italiana', regularPrice: 29, retailPrice: 92, status: 'new' },
  { category: 'bags', subCategory: 'Shoulder bag', nameZh: '简约肩背包', nameIt: 'Borsa a spalla essenziale', regularPrice: 26, retailPrice: 84, status: 'hot' },
  { category: 'accessories', subCategory: 'Scarf', nameZh: '印花丝巾', nameIt: 'Foulard stampato', regularPrice: 11, retailPrice: 38, status: 'new' },
  { category: 'accessories', subCategory: 'Belt', nameZh: '皮革腰带', nameIt: 'Cintura in pelle', regularPrice: 14, retailPrice: 46, status: 'new' }
] as const;

const productImages = [
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=85&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=85&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?q=85&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1551028719-00167b16eac5?q=85&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=85&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=85&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?q=85&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=85&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?q=85&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=85&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?q=85&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=85&w=1200&auto=format&fit=crop'
];

async function main() {
  if (process.env.ALLOW_PUBLIC_DEMO_PRODUCTS !== '1') {
    throw new Error('Set ALLOW_PUBLIC_DEMO_PRODUCTS=1 to create publicly visible demo products.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to create showroom demo products.');
  }

  const merchants = await prisma.merchant.findMany({
    where: { isVerified: true },
    select: { id: true, storeSlug: true, name: true, city: true },
    orderBy: { id: 'asc' }
  });
  if (merchants.length === 0) {
    throw new Error('No verified merchants were found.');
  }

  const products = merchants.flatMap(merchant => productStyles.map((style, index) => {
    const id = `demo-showroom-product-${merchant.storeSlug}-${String(index + 1).padStart(2, '0')}`;
    const styleNo = `DEMO-${merchant.storeSlug.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${String(index + 1).padStart(2, '0')}`;
    const image = productImages[index];
    const demoLabel = `【演示商品】${style.nameZh}`;
    const descriptionZh = `页面效果演示商品，关联店铺：${merchant.name}。此为虚构测试货品，不代表商家真实库存或销售报价，请勿用于实际采购。`;
    const descriptionIt = `Articolo dimostrativo per la visualizzazione, associato allo showroom ${merchant.name}. Prodotto e disponibilità sono fittizi: non utilizzare per ordini reali.`;

    return {
      id,
      styleNo,
      name: `DEMO · ${style.nameIt}`,
      name_it: `DEMO · ${style.nameIt}`,
      name_zh: demoLabel,
      category: style.category,
      subCategory: style.subCategory,
      brand: `RUDA DEMO · ${merchant.name}`,
      season: 'DEMO 2026',
      images: JSON.stringify([image]),
      media: JSON.stringify([{ id: `${id}-image`, type: 'image', url: image }]),
      wholesalePrice: style.regularPrice,
      rrpPrice: style.retailPrice,
      moq: 3,
      packSize: 3,
      status: style.status,
      inventoryStatus: 'coming_soon',
      origin: 'Demo content · not for sale',
      origin_it: 'Contenuto demo · non in vendita',
      origin_zh: '演示内容 · 非实际销售商品',
      fabric: 'Demo content',
      fabric_it: 'Contenuto demo',
      fabric_zh: '演示商品',
      composition: '演示商品，无实际材质信息。',
      weight: '0',
      packaging: '演示商品，无实际包装信息。',
      washCare: '演示商品，无实际护理信息。',
      description: descriptionZh,
      description_it: descriptionIt,
      description_zh: descriptionZh,
      skus: JSON.stringify([{
        sku: `${styleNo}-01`,
        color: 'Demo',
        colorCode: '#777777',
        size: 'One Size',
        stockCentral: 0,
        stockMestre: 0,
        stockMilano: 0
      }]),
      merchantId: merchant.id,
      merchantName: merchant.name,
      isExclusiveProtected: false,
      protectionLevel: 'public',
      visibility: 'public',
      lifecycleStatus: 'published',
      featuredOnHome: false
    };
  }));

  const existing = await prisma.product.findMany({
    where: { id: { in: products.map(product => product.id) } },
    select: { id: true }
  });
  if (existing.length > 0) {
    throw new Error(`Demo product IDs already exist; refusing to modify them (${existing.length} conflicts).`);
  }

  await prisma.$transaction(async tx => {
    await tx.product.createMany({ data: products });
    for (const merchant of merchants) {
      const publicProductCount = await tx.product.count({
        where: {
          merchantId: merchant.id,
          lifecycleStatus: 'published',
          visibility: { not: 'private' },
          isExclusiveProtected: false
        }
      });
      await tx.merchant.update({
        where: { id: merchant.id },
        data: { publicProductsCount: publicProductCount }
      });
    }
  });

  const counts = await prisma.product.groupBy({
    by: ['status', 'category'],
    where: { id: { startsWith: 'demo-showroom-product-' } },
    _count: { _all: true }
  });
  console.log(JSON.stringify({
    merchants: merchants.length,
    productsAdded: products.length,
    byType: Object.fromEntries(counts.map(row => [`${row.status}:${row.category}`, row._count._all]))
  }));
}

main()
  .catch(error => {
    console.error('[seed-showroom-demo-products] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
