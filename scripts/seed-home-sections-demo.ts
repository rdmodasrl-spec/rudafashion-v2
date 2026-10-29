import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const images = [
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=1200&auto=format&fit=crop'
];

const sections = [
  { key: 'new', label: '新款演示', visibility: 'public', status: 'new', protected: false },
  { key: 'custom', label: '授权订做演示', visibility: 'private', status: 'new', protected: true },
  { key: 'clearance', label: '特价演示', visibility: 'public', status: 'clearance', protected: false }
] as const;

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled in production. Use real approved products instead.');
  }
  const merchants = await prisma.merchant.findMany({
    where: { id: { startsWith: 'demo-' }, isVerified: true },
    orderBy: { id: 'asc' },
    take: 20
  });
  if (merchants.length < 6) throw new Error('Run db:seed-demo-zones before seeding home sections');

  for (const section of sections) {
    for (let index = 0; index < 6; index += 1) {
      const merchant = merchants[(index + (section.key === 'custom' ? 6 : 0)) % merchants.length];
      const productId = `demo-home-${section.key}-${index + 1}`;
      const styleNo = `HOME-${section.key.toUpperCase()}-${String(index + 1).padStart(2, '0')}`;
      const price = section.key === 'clearance' ? 10 + index * 2 : 22 + index * 4;
      const image = images[index];
      await prisma.product.upsert({
        where: { id: productId },
        update: {
          merchantId: merchant.id,
          merchantName: merchant.name,
          status: section.status,
          visibility: section.visibility,
          isExclusiveProtected: section.protected,
          protectionLevel: section.protected ? 'exclusive_vault' : 'public',
          lifecycleStatus: 'published',
          featuredOnHome: true,
          wholesalePrice: price,
          rrpPrice: price * 3
        },
        create: {
          id: productId,
          styleNo,
          name: `${merchant.name} ${section.label} ${index + 1}`,
          name_it: `${merchant.name} ${section.label} ${index + 1}`,
          name_zh: `${merchant.name} · ${section.label} ${index + 1}`,
          category: section.key === 'clearance' ? 'accessories' : 'women',
          subCategory: section.key === 'custom' ? '授权订做' : section.key === 'clearance' ? '特价精选' : '新款',
          brand: merchant.name,
          season: '2026/27 FW',
          images: JSON.stringify([image]),
          media: JSON.stringify([{ id: `${productId}-image`, type: 'image', url: image }]),
          wholesalePrice: price,
          rrpPrice: price * 3,
          moq: section.key === 'clearance' ? 3 : 6,
          packSize: section.key === 'clearance' ? 3 : 6,
          status: section.status,
          inventoryStatus: 'in_stock',
          origin: `Made in Italy · ${merchant.city}`,
          origin_it: `Made in Italy · ${merchant.city}`,
          origin_zh: `意大利制造 · ${merchant.city}`,
          fabric: 'Selected Italian fabric',
          fabric_it: 'Tessuto italiano selezionato',
          fabric_zh: '精选意大利面料',
          composition: '精选材质，适合精品店采购',
          weight: '0.45 kg / pz',
          packaging: '独立包装 + 外箱',
          washCare: '按产品护理标签保养',
          description: section.protected ? '授权订做演示款，需获得商家 Private Collection 授权后查看完整资料。' : `${section.label}，来自 ${merchant.name}，现货可采购。`,
          description_it: section.protected ? 'Modello su ordinazione autorizzata, visibile ai buyer approvati.' : `Articolo ${section.label} di ${merchant.name}, pronto per l’acquisto.`,
          description_zh: section.protected ? '授权订做演示款，需获得商家 Private Collection 授权后查看完整资料。' : `${section.label}，来自 ${merchant.name}，现货可采购。`,
          skus: JSON.stringify([{ sku: `${styleNo}-01`, color: 'Black', colorCode: '#111111', size: 'One Size', stockCentral: 36, stockMestre: 18, stockMilano: 18 }]),
          merchantId: merchant.id,
          merchantName: merchant.name,
          isExclusiveProtected: section.protected,
          protectionLevel: section.protected ? 'exclusive_vault' : 'public',
          visibility: section.visibility,
          lifecycleStatus: 'published',
          featuredOnHome: true
        }
      });
    }
  }
  console.log('Home sections ready: 6 new, 6 authorized custom, 6 clearance products.');
}

main()
  .catch(error => {
    console.error('[seed-home-sections-demo] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
