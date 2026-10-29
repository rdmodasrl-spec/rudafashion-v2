/**
 * 商品一级分类的唯一权威目录。
 *
 * - `value` 会写入 `Product.category`，只允许新增，不允许改名或删除；
 *   历史值（women / men / children）仍通过 getProductCategoryLabel 解析显示。
 * - `merchant-miniprogram/utils/product-categories.js` 是小程序的无构建期复制件，
 *   修改本文件时必须同步该文件。
 */
export const PRODUCT_CATEGORIES = [
  { value: 'tops', zh: '上衣', it: 'Top' },
  { value: 'shirts', zh: '衬衫', it: 'Camicie' },
  { value: 'tshirts', zh: 'T恤', it: 'T-shirt' },
  { value: 'knitwear', zh: '针织衫', it: 'Maglieria' },
  { value: 'dresses', zh: '连衣裙', it: 'Abiti' },
  { value: 'skirts', zh: '裙子', it: 'Gonne' },
  { value: 'pants', zh: '裤子', it: 'Pantaloni' },
  { value: 'jeans', zh: '牛仔裤', it: 'Jeans' },
  { value: 'outerwear', zh: '外套', it: 'Cappotti' },
  { value: 'bags', zh: '箱包', it: 'Borse' },
  { value: 'shoes', zh: '鞋履', it: 'Scarpe' },
  { value: 'accessories', zh: '配饰', it: 'Accessori' },
  { value: 'home_living', zh: '家居日用', it: 'Casa' },
  { value: 'kitchen', zh: '厨房用品', it: 'Cucina' },
  { value: 'stationery', zh: '文具办公', it: 'Cancelleria' },
  { value: 'electronics', zh: '小家电', it: 'Elettronica' },
  { value: 'beauty', zh: '美妆个护', it: 'Bellezza' },
  { value: 'toys', zh: '玩具', it: 'Giochi' }
] as const;

export function getProductCategoryLabel(value: string, isIt: boolean): string {
  const category = PRODUCT_CATEGORIES.find(item => item.value === value);
  if (category) return isIt ? category.it : category.zh;
  const legacyLabels: Record<string, { zh: string; it: string }> = {
    women: { zh: '女装', it: 'Donna' },
    men: { zh: '男装', it: 'Uomo' },
    children: { zh: '童装', it: 'Bambini' }
  };
  const legacy = legacyLabels[value.toLowerCase()];
  return legacy ? (isIt ? legacy.it : legacy.zh) : value;
}
