const { request } = require('./api');

async function loadMerchantInventoryBalances(productIds = []) {
  const productFilter = Array.isArray(productIds) && productIds.length
    ? `&productIds=${encodeURIComponent(productIds.join(','))}`
    : '';
  const firstPage = await request(`/api/merchant/inventory/balances?page=1&pageSize=500${productFilter}`);
  if (!Array.isArray(firstPage.balances)) throw new Error('库存接口返回格式无效');
  const balances = firstPage.balances.slice();
  const total = Number(firstPage.total || balances.length);
  const pageSize = Number(firstPage.pageSize || 500);
  const pageCount = Math.ceil(total / pageSize);
  for (let page = 2; page <= pageCount; page += 1) {
    const response = await request(`/api/merchant/inventory/balances?page=${page}&pageSize=${pageSize}${productFilter}`);
    if (!Array.isArray(response.balances)) throw new Error(`第 ${page} 页库存数据格式无效`);
    response.balances.forEach(balance => balances.push(balance));
  }
  return balances;
}

module.exports = { loadMerchantInventoryBalances };
