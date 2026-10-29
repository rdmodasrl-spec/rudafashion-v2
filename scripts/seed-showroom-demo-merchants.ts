import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  {
    zone: 'iolo',
    label: '生产商',
    labelIt: 'Produttore',
    names: ['Prato Atelier', 'Luna Moda Lab', 'Forma Toscana', 'Linea Viva', 'Studio Tessile'],
    cities: ['Prato', 'Florence', 'Bologna', 'Milan', 'Verona'],
    specialties: ['成衣制造', '女装系列', '意大利面料']
  },
  {
    zone: 'tavoro',
    label: '批发商',
    labelIt: 'Grossista',
    names: ['Milano Stock House', 'Moda Pronta Hub', 'Vogue Wholesale', 'Italia Stock Room', 'Urban Moda Trade'],
    cities: ['Milan', 'Prato', 'Rome', 'Turin', 'Bologna'],
    specialties: ['现货批发', '快速补货', '精品店配货']
  },
  {
    zone: 'boutique_department',
    label: '零售商',
    labelIt: 'Boutique',
    names: ['Casa Boutique', 'The Edit Milano', 'Studio Roma', 'Bellavista Store', 'Via Moda Boutique'],
    cities: ['Milan', 'Rome', 'Florence', 'Venice', 'Naples'],
    specialties: ['精品零售', '城市门店', '精选时尚']
  }
] as const;

const banners = [
  'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop'
];

async function main() {
  if (process.env.ALLOW_PUBLIC_DEMO_MERCHANTS !== '1') {
    throw new Error('Set ALLOW_PUBLIC_DEMO_MERCHANTS=1 to create public demo merchants.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to create showroom demo merchants.');
  }

  const records = categories.flatMap(category => category.names.map((brandName, index) => {
    const id = `demo-showroom-${category.zone}-${String(index + 1).padStart(2, '0')}`;
    const slug = `demo-showroom-${category.zone}-${String(index + 1).padStart(2, '0')}`;
    const banner = banners[(index + categories.indexOf(category)) % banners.length];
    const name = `DEMO · ${brandName} ${String(index + 1).padStart(2, '0')}`;

    return {
      id,
      storeSlug: slug,
      code: slug.toUpperCase(),
      merchantZone: category.zone,
      industry: category.zone === 'iolo' ? 'FASHION_COMPANY' : category.zone === 'tavoro' ? 'FASHION_WHOLESALE' : 'RETAIL_STORE',
      name,
      companyLegalName: `${name} · TEST`,
      businessType: category.zone === 'iolo' ? 'brand_supplier' : category.zone === 'tavoro' ? 'wholesaler' : 'retailer',
      country: 'Italia',
      country_it: 'Italia',
      country_zh: '意大利',
      city: category.cities[index],
      city_it: category.cities[index],
      city_zh: category.cities[index],
      showroomAddress: `Demo Fashion District, ${category.cities[index]}`,
      showroomArea: `${420 + index * 35} m²`,
      showroomArea_it: `${420 + index * 35} m² showroom`,
      showroomArea_zh: `${420 + index * 35} m² 演示展厅`,
      showroomImage: banner,
      showroomPanoramicImages: JSON.stringify([banner]),
      logo: banner,
      banner,
      tagline: `演示商家 · ${category.label} · 仅用于页面效果测试`,
      tagline_it: `Demo · ${category.labelIt} · solo test visivo`,
      tagline_zh: `演示商家 · ${category.label} · 仅用于页面效果测试`,
      description: `RUDA 公开展示用测试商家，不代表真实经营主体。分类：${category.label}。`,
      description_it: `Profilo demo pubblico RUDA per test visivo. Non rappresenta un'attività reale. Categoria: ${category.labelIt}.`,
      description_zh: `RUDA 公开展示用测试商家，不代表真实经营主体。分类：${category.label}。`,
      specialties: JSON.stringify(category.specialties),
      foundedYear: 2020 + index,
      contactPerson: 'RUDA Demo',
      contactPhone: '+39 000 000 0000',
      contactEmail: `${slug}@example.invalid`,
      isVerified: true,
      rating: 4.8,
      publicProductsCount: 0,
      protectedVaultCount: 0
    };
  }));

  const existingRecords = await prisma.merchant.findMany({
    where: { id: { in: records.map(record => record.id) } },
    select: { id: true, name: true, merchantZone: true, tagline: true }
  });
  const expectedById = new Map(records.map(record => [record.id, record]));
  const conflicts = existingRecords.filter(existing => {
    const expected = expectedById.get(existing.id);
    return !expected || existing.name !== expected.name || existing.merchantZone !== expected.merchantZone || !existing.tagline.includes('演示商家');
  });
  if (conflicts.length > 0) {
    throw new Error(`Refusing to overwrite non-demo merchant records: ${conflicts.map(record => record.id).join(', ')}`);
  }

  await prisma.$transaction(records.map(record => prisma.merchant.upsert({
    where: { id: record.id },
    update: {},
    create: record
  })));

  const counts = await prisma.merchant.groupBy({
    by: ['merchantZone'],
    where: { id: { startsWith: 'demo-showroom-' } },
    _count: { _all: true }
  });
  console.log(JSON.stringify({
    demoMerchants: records.length,
    byCategory: Object.fromEntries(counts.map(row => [row.merchantZone, row._count._all]))
  }));
}

main()
  .catch(error => {
    console.error('[seed-showroom-demo-merchants] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
