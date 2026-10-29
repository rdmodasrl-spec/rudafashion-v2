import type { Product } from '../types/b2b';

export type ProductZone = 'new' | 'clearance' | 'private';

/**
 * 商品分区的唯一展示目录。
 * 值仍映射到现有 Product.status / visibility / isExclusiveProtected，不新增数据库枚举。
 */
export const PRODUCT_ZONE_OPTIONS: ReadonlyArray<{
  value: ProductZone;
  label: string;
  italianLabel: string;
  description: string;
  italianDescription: string;
}> = [
  {
    value: 'private',
    label: '授权区',
    italianLabel: 'Area autorizzata',
    description: '授权订货商品',
    italianDescription: 'Prodotti su ordine autorizzato'
  },
  {
    value: 'new',
    label: '现货区',
    italianLabel: 'Pronta consegna',
    description: '现货批发商品',
    italianDescription: 'Prodotti disponibili in stock'
  },
  {
    value: 'clearance',
    label: '折扣市场',
    italianLabel: 'Mercato outlet',
    description: '特价、折扣及倒货商品',
    italianDescription: 'Saldi, sconti e stock'
  }
];

export function getProductZoneLabel(zone: ProductZone, isItalian = false): string {
  const option = PRODUCT_ZONE_OPTIONS.find(item => item.value === zone);
  if (!option) return zone;
  return isItalian ? option.italianLabel : option.label;
}

export function getProductZone(product: Partial<Pick<Product, 'status' | 'visibility' | 'isExclusiveProtected'>>): ProductZone {
  if (product.visibility === 'private' || product.isExclusiveProtected) return 'private';
  return product.status === 'clearance' ? 'clearance' : 'new';
}

export function getProductZoneUpdates(zone: ProductZone): Pick<Product, 'status' | 'visibility' | 'isExclusiveProtected' | 'protectionLevel'> {
  if (zone === 'private') {
    return {
      status: 'new',
      visibility: 'private',
      isExclusiveProtected: true,
      protectionLevel: 'exclusive_vault'
    };
  }
  return {
    status: zone === 'clearance' ? 'clearance' : 'new',
    visibility: 'public',
    isExclusiveProtected: false,
    protectionLevel: 'public'
  };
}
