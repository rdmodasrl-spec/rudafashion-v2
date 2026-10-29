import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const imageSets = {
  iolo: [
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?q=80&w=1200&auto=format&fit=crop'
  ],
  tavoro: [
    'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1506629905607-d9e7a7b8f4e5?q=80&w=1200&auto=format&fit=crop'
  ],
  leather: [
    'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?q=80&w=1200&auto=format&fit=crop'
  ],
  boutique_department: [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=1200&auto=format&fit=crop'
  ]
} as const;

const zones = [
  {
    key: 'iolo',
    industry: 'FASHION_COMPANY',
    label: '服装现货区',
    category: 'women',
    names: ['Luna Pronto', 'Velvet Avenue', 'Casa Moda', 'Atelier 27', 'Nero Bianco'],
    cities: ['Prato', 'Bologna', 'Milan', 'Verona', 'Turin'],
    styles: ['真丝连衣裙', '针织开衫', '廓形西装']
  },
  {
    key: 'tavoro',
    industry: 'FASHION_WHOLESALE',
    label: '服装订货区',
    category: 'women',
    names: ['Linea Milano', 'Forma Studio', 'Tessuto Lab', 'Maison Forma', 'Studio Contour'],
    cities: ['Milan', 'Paris', 'Florence', 'Barcelona', 'Rome'],
    styles: ['羊绒大衣', '结构风衣', '精裁套装']
  },
  {
    key: 'leather',
    industry: 'FASHION_COMPANY',
    label: '精品皮包区',
    category: 'bags',
    names: ['Firenze Leather', 'Venezia Pelle', 'Nappa Atelier', 'Porta Luxe', 'Arco Bags'],
    cities: ['Florence', 'Venice', 'Milan', 'Bologna', 'Rome'],
    styles: ['托特包', '腋下包', '链条手袋']
  },
  {
    key: 'boutique_department',
    industry: 'DEPARTMENT_STORE',
    label: '精品百货区',
    category: 'accessories',
    names: ['Casa Select', 'Edit Store', 'Mercato 88', 'The Boutique Lab', 'Gallery Goods'],
    cities: ['Milan', 'Paris', 'Madrid', 'Lisbon', 'Naples'],
    styles: ['丝巾礼盒', '精品太阳镜', '设计师配饰']
  }
] as const;

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled in production. Use verified merchant onboarding instead.');
  }
  let merchantCount = 0;
  let productCount = 0;

  for (const zone of zones) {
    const images = imageSets[zone.key];
    for (let index = 0; index < zone.names.length; index += 1) {
      const name = zone.names[index];
      const slug = `demo-${slugify(name)}`;
      const merchantId = `demo-${zone.key}-${index + 1}`;
      const city = zone.cities[index];
      const merchant = await prisma.merchant.upsert({
        where: { id: merchantId },
        update: {
          name,
          merchantZone: zone.key,
          city,
          city_it: city,
          city_zh: city,
          isVerified: true,
          publicProductsCount: 3
        },
        create: {
          id: merchantId,
          storeSlug: slug,
          code: slug,
          merchantZone: zone.key,
          industry: zone.industry,
          name,
          companyLegalName: `${name} Demo S.r.l.`,
          country: 'Italia',
          country_it: 'Italia',
          country_zh: '意大利',
          city,
          city_it: city,
          city_zh: city,
          showroomAddress: `Fashion District, ${city}`,
          showroomArea: '680 m²',
          showroomArea_it: '680 m² showroom',
          showroomArea_zh: '680 m² 精品展厅',
          showroomImage: images[0],
          showroomPanoramicImages: JSON.stringify(images),
          logo: images[1],
          banner: images[0],
          tagline: `${zone.label} · 精选演示店`,
          tagline_it: `${zone.label} · Demo showroom`,
          tagline_zh: `${zone.label} · 精选演示店`,
          description: `RUDA 演示店，展示 ${zone.label} 的精选样品、现货能力与品牌陈列。`,
          description_it: `Demo showroom RUDA dedicato a ${zone.label}.`,
          description_zh: `RUDA 演示店，展示${zone.label}的精选样品、现货能力与品牌陈列。`,
          specialties: JSON.stringify(zone.styles),
          foundedYear: 2020 + index,
          contactPerson: 'RUDA Showroom Team',
          contactPhone: '+39 02 0000 0000',
          contactEmail: `${slug}@ruda.fashion`,
          isVerified: true,
          rating: Number((4.7 + index * 0.05).toFixed(2)),
          publicProductsCount: 3,
          protectedVaultCount: 0
        }
      });
      merchantCount += 1;

      for (let sampleIndex = 0; sampleIndex < 3; sampleIndex += 1) {
        const styleNo = `DEMO-${zone.key.toUpperCase()}-${index + 1}${sampleIndex + 1}`;
        const productId = `demo-product-${zone.key}-${index + 1}-${sampleIndex + 1}`;
        const style = zone.styles[sampleIndex];
        await prisma.product.upsert({
          where: { id: productId },
          update: {
            merchantId: merchant.id,
            merchantName: merchant.name,
            featuredOnHome: sampleIndex === 0,
            visibility: 'public',
            lifecycleStatus: 'published'
          },
          create: {
            id: productId,
            styleNo,
            name: `${name} ${style}`,
            name_it: `${name} ${style}`,
            name_zh: `${name} · ${style}`,
            category: zone.category,
            subCategory: style,
            brand: name,
            season: '2026/27 FW',
            images: JSON.stringify([images[sampleIndex], images[(sampleIndex + 1) % images.length]]),
            media: JSON.stringify([
              { id: `${productId}-image-1`, type: 'image', url: images[sampleIndex] },
              { id: `${productId}-image-2`, type: 'image', url: images[(sampleIndex + 1) % images.length] }
            ]),
            wholesalePrice: 18 + sampleIndex * 7,
            rrpPrice: 59 + sampleIndex * 20,
            moq: zone.key === 'iolo' ? 6 : 3,
            packSize: zone.key === 'iolo' ? 6 : 3,
            status: sampleIndex === 0 ? 'hot' : 'new',
            inventoryStatus: 'in_stock',
            origin: `Made in Italy · ${city}`,
            origin_it: `Made in Italy · ${city}`,
            origin_zh: `意大利制造 · ${city}`,
            fabric: zone.key === 'leather' ? '100% pelle italiana' : '精选意大利面料',
            fabric_it: zone.key === 'leather' ? '100% pelle italiana' : 'Tessuto italiano selezionato',
            fabric_zh: zone.key === 'leather' ? '100% 意大利头层皮' : '精选意大利面料',
            composition: '精选材质，适合精品店陈列与快速补货',
            weight: '0.45 kg / pz',
            packaging: '独立防尘包装 + 外箱',
            washCare: '按产品护理标签保养',
            description: `来自 ${name} 的演示样品，适合欧洲精品店快速选款与补货。`,
            description_it: `Campione demo di ${name}, pronto per boutique e riassortimenti rapidi.`,
            description_zh: `来自 ${name} 的演示样品，适合欧洲精品店快速选款与补货。`,
            skus: JSON.stringify([{ sku: `${styleNo}-01`, color: 'Black', colorCode: '#111111', size: 'One Size', stockCentral: 48, stockMestre: 24, stockMilano: 24 }]),
            merchantId: merchant.id,
            merchantName: merchant.name,
            visibility: 'public',
            lifecycleStatus: 'published',
            featuredOnHome: sampleIndex === 0
          }
        });
        productCount += 1;
      }
    }
  }

  console.log(`Demo zones ready: ${merchantCount} merchants, ${productCount} samples.`);
}

main()
  .catch(error => {
    console.error('[seed-demo-zones] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
