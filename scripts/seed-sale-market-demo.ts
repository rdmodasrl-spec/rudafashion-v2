import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const demoMerchantId = 'demo-sale-market-merchant';
const demoProductPrefix = 'demo-showroom-product-sale-';
const imageDirectory = join(process.cwd(), 'public/fashion');
const categories = [
  { category: 'women', subCategory: '连衣裙', name: '意式剪裁连衣裙', nameIt: 'Abito sartoriale italiano' },
  { category: 'women', subCategory: '针织衫', name: '轻柔针织上衣', nameIt: 'Maglia morbida' },
  { category: 'women', subCategory: '外套', name: '都市轻量外套', nameIt: 'Giacca urbana leggera' },
  { category: 'bags', subCategory: '手提包', name: '日常手提包', nameIt: 'Borsa tote quotidiana' },
  { category: 'accessories', subCategory: '配饰', name: '精选时尚配饰', nameIt: 'Accessorio moda selezionato' }
] as const;
const colors = [
  { name: 'Nero 黑色', code: '#171717' },
  { name: 'Avorio 米白', code: '#e8dfcf' },
  { name: 'Bordeaux 酒红', code: '#722f37' },
  { name: 'Verde 森林绿', code: '#385747' }
] as const;
const clothingSizes = ['S', 'M', 'L', 'XL'] as const;

function makeSkuOptions(styleNo: string, category: string) {
  const sizes: readonly string[] = category === 'bags' || category === 'accessories'
    ? ['One Size']
    : clothingSizes;

  return colors.flatMap((color, colorIndex) => sizes.map(size => ({
    sku: `${styleNo}-C${colorIndex + 1}-${size.replace(/\s+/g, '')}`,
    color: color.name,
    colorCode: color.code,
    size,
    stockCentral: 500,
    stockMestre: 0,
    stockMilano: 0
  })));
}

function getUniqueFashionImages(): string[] {
  const seen = new Set<string>();
  const images: string[] = [];
  const files = readdirSync(imageDirectory)
    .filter(file => /^imgi_\d+_.+\.(?:jpe?g|png|webp)$/i.test(file))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  for (const file of files) {
    const contentHash = createHash('sha256').update(readFileSync(join(imageDirectory, file))).digest('hex');
    if (seen.has(contentHash)) continue;
    seen.add(contentHash);
    images.push(`/fashion/${encodeURIComponent(file)}`);
  }

  if (images.length < 200) throw new Error(`Expected at least 200 unique fashion images for product galleries; found ${images.length}.`);
  return images;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled in production.');
  }
  if (process.env.ALLOW_PUBLIC_DEMO_PRODUCTS !== '1') {
    throw new Error('Set ALLOW_PUBLIC_DEMO_PRODUCTS=1 to create public sale-market showcase products.');
  }

  const images = getUniqueFashionImages();
  const now = new Date();
  await prisma.$transaction(async tx => {
    const merchant = await tx.merchant.upsert({
      where: { id: demoMerchantId },
      update: {
        name: 'RUDA 特价样品展厅',
        tagline: 'RUDA 特价样品展厅 · 多色多尺码',
        tagline_it: 'Campionario RUDA · colori e taglie',
        tagline_zh: 'RUDA 特价样品展厅 · 多色多尺码',
        description: 'RUDA 特价市场样品展示，可体验商品颜色、尺码、配码、价格与采购清单页面。',
        description_it: 'Campionario RUDA per esplorare colori, taglie, combinazioni, prezzi e carrello.',
        description_zh: 'RUDA 特价市场样品展示，可体验商品颜色、尺码、配码、价格与采购清单页面。',
        specialties: JSON.stringify(['特价样品', '多色多尺码']),
        isVerified: true,
        storefrontEnabled: true,
        publicProductsCount: 50,
        updatedAt: now
      },
      create: {
        id: demoMerchantId,
        name: 'RUDA 特价样品展厅',
        companyLegalName: 'RUDA Sale Demo S.r.l.',
        code: 'RUDA-SALE-DEMO',
        country: 'Italia',
        country_it: 'Italia',
        country_zh: '意大利',
        city: 'Prato',
        city_it: 'Prato',
        city_zh: '普拉托',
        showroomAddress: 'Demo showroom · Prato',
        showroomArea: 'Demo',
        showroomArea_it: 'Demo',
        showroomArea_zh: '演示展厅',
        showroomImage: images[0],
        showroomPanoramicImages: JSON.stringify(images.slice(0, 5)),
        logo: images[0],
        banner: images[1],
        tagline: 'RUDA 特价样品展厅 · 多色多尺码',
        tagline_it: 'Campionario RUDA · colori e taglie',
        tagline_zh: 'RUDA 特价样品展厅 · 多色多尺码',
        description: 'RUDA 特价市场样品展示，可体验商品颜色、尺码、配码、价格与采购清单页面。',
        description_it: 'Campionario RUDA per esplorare colori, taglie, combinazioni, prezzi e carrello.',
        description_zh: 'RUDA 特价市场样品展示，可体验商品颜色、尺码、配码、价格与采购清单页面。',
        specialties: JSON.stringify(['特价样品', '多色多尺码']),
        foundedYear: 2026,
        contactPerson: 'RUDA Demo',
        contactPhone: '',
        contactEmail: 'demo-sale-market@ruda.invalid',
        isVerified: true,
        storefrontEnabled: true,
        publicProductsCount: 50,
        protectedVaultCount: 0,
        createdAt: now,
        updatedAt: now,
        storeSlug: 'ruda-sale-market-demo',
        merchantZone: 'iolo',
        businessType: 'brand_supplier',
        industry: 'FASHION_COMPANY',
        industrySource: 'ADMIN'
      }
    });

    const products = Array.from({ length: 50 }, (_, index) => {
      const number = index + 1;
      const id = `${demoProductPrefix}${String(number).padStart(3, '0')}`;
      const styleNo = `SALE-DEMO-${String(number).padStart(3, '0')}`;
      const style = categories[index % categories.length];
      const nameZh = `${style.name} ${String(number).padStart(2, '0')}`;
      const nameIt = `${style.nameIt} ${String(number).padStart(2, '0')}`;
      const wholesalePrice = 12 + (index % 18) * 1.5;
      const skuOptions = makeSkuOptions(styleNo, style.category);
      const galleryImages = images.slice(index * 4, index * 4 + 4);

      return {
        id,
        styleNo,
        name: nameIt,
        name_it: nameIt,
        name_zh: nameZh,
        category: style.category,
        subCategory: style.subCategory,
        brand: 'RUDA Sale Showroom',
        season: 'Sale · 2026',
        images: JSON.stringify(galleryImages),
        media: JSON.stringify(galleryImages.map((url, imageIndex) => ({
          id: `${id}-image-${imageIndex + 1}`,
          type: 'image',
          url
        }))),
        wholesalePrice,
        rrpPrice: wholesalePrice * 2.5,
        moq: 6,
        packSize: 6,
        status: 'clearance',
        inventoryStatus: 'in_stock',
        origin: 'RUDA Prato showroom',
        origin_it: 'Showroom RUDA di Prato',
        origin_zh: 'RUDA 普拉托展厅',
        fabric: '精选面料',
        fabric_it: 'Tessuto selezionato',
        fabric_zh: '精选面料',
        composition: '面料成分以商品实物标识为准。',
        weight: '0.5',
        packaging: '标准商品包装',
        washCare: '请参考商品实物洗护标识。',
        description: 'RUDA 特价市场展示款，可查看不同颜色、尺码、价格与配码选择。',
        description_it: 'Articolo in esposizione RUDA: consulta colori, taglie, prezzi e combinazioni.',
        description_zh: 'RUDA 特价市场展示款，可查看不同颜色、尺码、价格与配码选择。',
        skus: JSON.stringify(skuOptions),
        merchantId: merchant.id,
        merchantName: merchant.name,
        isExclusiveProtected: false,
        protectionLevel: 'public',
        visibility: 'public',
        lifecycleStatus: 'published',
        featuredOnHome: index < 4,
        createdAt: now,
        updatedAt: now
      };
    });

    const rows = products.map(product => Prisma.sql`(
      ${product.id},
      ${product.styleNo},
      ${product.name},
      ${product.name_it},
      ${product.name_zh},
      ${product.category},
      ${product.subCategory},
      ${product.brand},
      ${product.season},
      ${product.images},
      ${product.wholesalePrice},
      ${product.rrpPrice},
      ${product.moq},
      ${product.packSize},
      ${product.status},
      ${product.inventoryStatus},
      ${product.origin},
      ${product.origin_it},
      ${product.origin_zh},
      ${product.fabric},
      ${product.fabric_it},
      ${product.fabric_zh},
      ${product.composition},
      ${product.weight},
      ${product.packaging},
      ${product.washCare},
      ${product.description},
      ${product.description_it},
      ${product.description_zh},
      ${product.skus},
      ${product.merchantId},
      ${product.merchantName},
      ${product.isExclusiveProtected},
      ${product.protectionLevel},
      ${product.visibility},
      ${product.lifecycleStatus},
      ${product.featuredOnHome},
      ${product.createdAt},
      ${product.updatedAt},
      ${product.media}
    )`);

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "Product" (
        "id", "styleNo", "name", "name_it", "name_zh", "category", "subCategory", "brand", "season",
        "images", "wholesalePrice", "rrpPrice", "moq", "packSize", "status", "inventoryStatus",
        "origin", "origin_it", "origin_zh", "fabric", "fabric_it", "fabric_zh", "composition", "weight",
        "packaging", "washCare", "description", "description_it", "description_zh", "skus", "merchantId",
        "merchantName", "isExclusiveProtected", "protectionLevel", "visibility", "lifecycleStatus",
        "featuredOnHome", "createdAt", "updatedAt", "media"
      )
      VALUES ${Prisma.join(rows)}
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name",
        "name_it" = EXCLUDED."name_it",
        "name_zh" = EXCLUDED."name_zh",
        "brand" = EXCLUDED."brand",
        "season" = EXCLUDED."season",
        "images" = EXCLUDED."images",
        "wholesalePrice" = EXCLUDED."wholesalePrice",
        "rrpPrice" = EXCLUDED."rrpPrice",
        "moq" = EXCLUDED."moq",
        "packSize" = EXCLUDED."packSize",
        "inventoryStatus" = EXCLUDED."inventoryStatus",
        "origin" = EXCLUDED."origin",
        "origin_it" = EXCLUDED."origin_it",
        "origin_zh" = EXCLUDED."origin_zh",
        "fabric" = EXCLUDED."fabric",
        "fabric_it" = EXCLUDED."fabric_it",
        "fabric_zh" = EXCLUDED."fabric_zh",
        "composition" = EXCLUDED."composition",
        "weight" = EXCLUDED."weight",
        "packaging" = EXCLUDED."packaging",
        "washCare" = EXCLUDED."washCare",
        "description" = EXCLUDED."description",
        "description_it" = EXCLUDED."description_it",
        "description_zh" = EXCLUDED."description_zh",
        "skus" = EXCLUDED."skus",
        "featuredOnHome" = EXCLUDED."featuredOnHome",
        "updatedAt" = EXCLUDED."updatedAt",
        "media" = EXCLUDED."media"
    `);
  });

  const seededCount = await prisma.product.count({
    where: {
      id: { startsWith: demoProductPrefix },
      status: 'clearance',
      lifecycleStatus: 'published',
      visibility: 'public'
    }
  });
  if (seededCount !== 50) throw new Error(`Expected 50 demo clearance products; found ${seededCount}.`);
  console.log(`RUDA sale-market showcase is ready: ${seededCount} public products with selectable options.`);
}

main()
  .catch(error => {
    console.error('[seed-sale-market-demo] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
