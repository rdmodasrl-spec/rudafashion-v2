export interface ProductSupportSkuContext {
  sku: string;
  color: string;
  size: string;
  quantity: number;
}

export interface ProductSupportContext {
  productId: string;
  productName: string;
  styleNo: string;
  selectedSkus: ProductSupportSkuContext[];
}

export const createProductSupportTicketPrefill = (context: ProductSupportContext) => {
  const subject = `商品咨询：${context.productName}（${context.styleNo}）`.slice(0, 120);
  const skuDetails = context.selectedSkus.length
    ? context.selectedSkus.map(item => `${item.color} / ${item.size} · SKU ${item.sku} × ${item.quantity}`).join('\n')
    : '尚未选择 SKU';
  return {
    subject,
    message: [
      `商品：${context.productName}`,
      `款号：${context.styleNo}`,
      `商品 ID：${context.productId}`,
      '已选规格：',
      skuDetails,
      '',
      '请说明您的问题：'
    ].join('\n').slice(0, 4000)
  };
};
