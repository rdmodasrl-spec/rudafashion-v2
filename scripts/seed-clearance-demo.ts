import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sampleImages = [
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop'
];

const clearanceStyles = [
  { name: '春季轻盈风衣', category: 'women', subCategory: '外套', basePrice: 12 },
  { name: '法式针织上衣', category: 'women', subCategory: '针织', basePrice: 9 },
  { name: '精选皮革托特包', category: 'bags', subCategory: '托特包', basePrice: 25 },
  { name: '精品丝巾礼盒', category: 'accessories', subCategory: '配饰', basePrice: 7 }
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled in production. Use real approved clearance products instead.');
  }
  const merchants = await prisma.merchant.findMany({
    where: {
      id: { startsWith: 'demo-' },
      isVerified: true,
      merchantZone: { in: ['iolo', 'tavoro', 'leather', 'boutique_department'] }
    },
    orderBy: [{ merchantZone: 'asc' }, { id: 'asc' }]
  });

  if (merchants.length < 4) {
    throw new Error('At least one demo merchant per zone is required before seeding clearance products');
  }

  let created = 0;
  for (let index = 0; index < 12; index += 1) {
    const merchant = merchants[index % merchants.length];
    const style = clearanceStyles[index % clearanceStyles.length];
    const productId = `demo-clearance-${index + 1}`;
    const styleNo = `SALE-${String(index + 1).padStart(3, '0')}`;
    const image = sampleImages[index % sampleImages.length];
    const salePrice = style.basePrice + (index % 3) * 2;

    await prisma.product.upsert({
      where: { id: productId },
      update: {
        merchantId: merchant.id,
        merchantName: merchant.name,
        wholesalePrice: salePrice,
        rrpPrice: salePrice * 3,
        status: 'clearance',
        inventoryStatus: 'in_stock',
        visibility: 'public',
        lifecycleStatus: 'published',
        featuredOnHome: index < 4
      },
      create: {
        id: productId,
        styleNo,
        name: `${merchant.name} ${style.name}`,
        name_it: `${merchant.name} ${style.name}`,
        name_zh: `${merchant.name} · ${style.name}`,
        category: style.category,
        subCategory: style.subCategory,
        brand: merchant.name,
        season: '2026 SS',
        images: JSON.stringify([image]),
        media: JSON.stringify([{ id: `${productId}-image`, type: 'image', url: image }]),
        wholesalePrice: salePrice,
        rrpPrice: salePrice * 3,
        moq: 3,
        packSize: 3,
        status: 'clearance',
        inventoryStatus: 'in_stock',
        origin: `Made in Italy · ${merchant.city}`,
        origin_it: `Made in Italy · ${merchant.city}`,
        origin_zh: `意大利制造 · ${merchant.city}`,
        fabric: style.category === 'bags' ? '100% Italian leather' : 'Selected Italian fabric',
        fabric_it: style.category === 'bags' ? '100% pelle italiana' : 'Tessuto italiano selezionato',
        fabric_zh: style.category === 'bags' ? '100% 意大利头层皮' : '精选意大利面料',
        composition: '精选材质，适合特价市场快速补货',
        weight: '0.45 kg / pz',
        packaging: '独立包装 + 外箱',
        washCare: '按产品护理标签保养',
        description: `特价市场演示货品，来自 ${merchant.name}，库存充足，支持快速配货。`,
        description_it: `Articolo demo in saldo di ${merchant.name}, pronto per la spedizione rapida.`,
        description_zh: `特价市场演示货品，来自 ${merchant.name}，库存充足，支持快速配货。`,
        skus: JSON.stringify([{ sku: `${styleNo}-01`, color: 'Black', colorCode: '#111111', size: 'One Size', stockCentral: 60, stockMestre: 30, stockMilano: 30 }]),
        merchantId: merchant.id,
        merchantName: merchant.name,
        isExclusiveProtected: false,
        protectionLevel: 'public',
        visibility: 'public',
        lifecycleStatus: 'published',
        featuredOnHome: index < 4
      }
    });
    created += 1;
  }

  console.log(`Clearance demo ready: ${created} products.`);
}

main()
  .catch(error => {
    console.error('[seed-clearance-demo] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
