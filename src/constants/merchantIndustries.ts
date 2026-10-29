export const merchantIndustries = [
  { id: 'FASHION_COMPANY', zh: '服装公司', it: 'Azienda moda' },
  { id: 'LEATHER_GOODS', zh: '皮包批发', it: 'Ingrosso pelletteria' },
  { id: 'TRADING_COMPANY', zh: '贸易公司', it: 'Società commerciale' },
  { id: 'DEPARTMENT_STORE', zh: '百货货行', it: 'Grande magazzino' },
  { id: 'RESTAURANT', zh: '餐馆外卖', it: 'Ristoranti e asporto' },
  { id: 'RETAIL_STORE', zh: '零售店', it: 'Negozio retail' }
] as const;

export type MerchantIndustry = typeof merchantIndustries[number]['id'];
