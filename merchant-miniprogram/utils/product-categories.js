/**
 * 商品一级分类的小程序侧目录。
 *
 * 权威定义在 src/constants/productCategories.ts：小程序没有构建期共享模块，
 * 修改分类时必须同步两处。`value` 会写入 Product.category，只允许新增，
 * 不允许改名或删除；历史值（women / men / children）仅用于解析旧数据显示。
 */
const PRODUCT_CATEGORIES = [
  { value: 'tops', label: '上衣' },
  { value: 'shirts', label: '衬衫' },
  { value: 'tshirts', label: 'T恤' },
  { value: 'knitwear', label: '针织衫' },
  { value: 'dresses', label: '连衣裙' },
  { value: 'skirts', label: '裙子' },
  { value: 'pants', label: '裤子' },
  { value: 'jeans', label: '牛仔裤' },
  { value: 'outerwear', label: '外套' },
  { value: 'bags', label: '箱包' },
  { value: 'shoes', label: '鞋履' },
  { value: 'accessories', label: '配饰' },
  { value: 'home_living', label: '家居日用' },
  { value: 'kitchen', label: '厨房用品' },
  { value: 'stationery', label: '文具办公' },
  { value: 'electronics', label: '小家电' },
  { value: 'beauty', label: '美妆个护' },
  { value: 'toys', label: '玩具' }
];

const LEGACY_CATEGORY_LABELS = {
  women: '女装',
  men: '男装',
  children: '童装'
};

function getProductCategoryLabel(value) {
  if (!value) return '';
  const category = PRODUCT_CATEGORIES.find(item => item.value === value);
  if (category) return category.label;
  const key = String(value).toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEGACY_CATEGORY_LABELS, key) ? LEGACY_CATEGORY_LABELS[key] : String(value);
}

module.exports = { PRODUCT_CATEGORIES, getProductCategoryLabel };
