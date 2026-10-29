/**
 * 商家小程序行业上下文（服务端权威）。
 *
 * 规则：
 * - 行业、模块、商品字段一律来自 `/api/merchant/industry-context`，前端传参不参与判定。
 * - 每个行业有独立配置模块（`industries/<template>.js`），只提供界面文案与动作编排；
 *   模块开关、字段定义、库存模型仍以服务端返回为准，配置缺失时按不渲染处理（fail closed）。
 * - 缓存按商家 ID 校验，切换商家或退出登录后不会复用上一个商家的行业。
 */
const { request } = require('./api');
const { getSession } = require('./auth');
const { INDUSTRY_STORAGE_KEY } = require('./constants');

const STORAGE_KEY = INDUSTRY_STORAGE_KEY;
const CONTEXT_TTL_MS = 10 * 60 * 1000;

const INDUSTRY_CONFIGS = {
  apparel_production_wholesale: require('../industries/apparel-production-wholesale'),
  apparel_wholesale: require('../industries/apparel-wholesale'),
  trading_wholesale: require('../industries/trading-wholesale'),
  department_wholesale: require('../industries/department-wholesale'),
  bags_wholesale: require('../industries/bags-wholesale'),
  department_chain_retail: require('../industries/department-chain-retail'),
  general_retail: require('../industries/general-retail')
};

function merchantIdFromSession(session) {
  if (!session) return '';
  const merchant = session.merchant || {};
  const profile = session.profile || {};
  return String(merchant.id || merchant.merchantId || profile.merchantId || '');
}

function readStoredContext() {
  try {
    const stored = wx.getStorageSync(STORAGE_KEY);
    if (!stored || typeof stored !== 'object' || !stored.context) return null;
    return stored;
  } catch (error) {
    return null;
  }
}

function writeStoredContext(context) {
  try {
    wx.setStorageSync(STORAGE_KEY, { storedAt: Date.now(), context });
  } catch (error) {
    console.warn('Unable to cache merchant industry context', error);
  }
}

function clearIndustryContext() {
  try {
    wx.removeStorageSync(STORAGE_KEY);
  } catch (error) {
    console.warn('Unable to clear merchant industry context', error);
  }
}

function matchesCurrentMerchant(context, merchantId) {
  if (!context) return false;
  if (!merchantId) return true;
  return String(context.merchantId || '') === merchantId;
}

async function loadIndustryContext(options = {}) {
  const force = options.force === true;
  const session = getSession();
  if (!session) {
    throw new Error('MERCHANT_SESSION_REQUIRED');
  }
  const merchantId = merchantIdFromSession(session);
  const stored = readStoredContext();
  const cachedFresh = Boolean(stored)
    && matchesCurrentMerchant(stored.context, merchantId)
    && Date.now() - Number(stored.storedAt || 0) < CONTEXT_TTL_MS;
  if (!force && cachedFresh) return stored.context;

  try {
    const response = await request('/api/merchant/industry-context');
    const context = response && response.context;
    if (!context || typeof context !== 'object') {
      throw new Error('行业上下文返回为空。');
    }
    if (merchantId && String(context.merchantId || '') !== merchantId) {
      throw new Error('行业上下文与当前登录商家不一致，请重新登录。');
    }
    writeStoredContext(context);
    return context;
  } catch (error) {
    if (!force && stored && matchesCurrentMerchant(stored.context, merchantId)) {
      return stored.context;
    }
    throw error;
  }
}

function parseIndustryAttributes(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function getIndustryConfig(context) {
  if (!context || !context.templateId) return null;
  const config = INDUSTRY_CONFIGS[context.templateId];
  if (!config || config.templateId !== context.templateId) return null;
  return config;
}

function hasPermission(context, permission) {
  if (!permission) return true;
  if (!context) return false;
  // 商家本人（无员工 ID）拥有全部权限；员工按服务端下发的权限码判定。
  if (!context.employeeId) return true;
  return (context.permissions || []).indexOf(permission) >= 0;
}

function hasModule(context, moduleKey) {
  if (!context || !moduleKey) return false;
  return (context.modules || []).indexOf(moduleKey) >= 0;
}

function availableActions(config, context) {
  if (!config || !Array.isArray(config.actions)) return [];
  return config.actions.filter(action => {
    if (action.module && !hasModule(context, action.module)) return false;
    return hasPermission(context, action.permission);
  });
}

function metricCards(config, dashboardMetrics) {
  const metrics = dashboardMetrics || {};
  const definitions = (config && Array.isArray(config.metrics) ? config.metrics : []);
  return definitions.map(definition => {
    const value = Number(metrics[definition.key]);
    return {
      key: definition.key,
      label: definition.label,
      suffix: definition.suffix || '',
      value: Number.isFinite(value) ? String(value) : '—',
      emphasis: definition.emphasis === true
    };
  });
}

function productFieldSummary(context, config) {
  const fields = (context && Array.isArray(context.productFields) ? context.productFields : [])
    .filter(field => field && field.type !== 'media' && field.type !== 'variants');
  const order = config && Array.isArray(config.productFieldKeys) ? config.productFieldKeys : [];
  const labelByKey = {};
  fields.forEach(field => { labelByKey[field.key] = field.label || field.key; });
  const ordered = order.filter(key => labelByKey[key]).map(key => ({ key, label: labelByKey[key] }));
  const rest = fields
    .filter(field => order.indexOf(field.key) < 0)
    .map(field => ({ key: field.key, label: field.label || field.key }));
  return ordered.concat(rest).slice(0, 8);
}

module.exports = {
  STORAGE_KEY,
  INDUSTRY_CONFIGS,
  loadIndustryContext,
  clearIndustryContext,
  parseIndustryAttributes,
  getIndustryConfig,
  hasPermission,
  hasModule,
  availableActions,
  metricCards,
  productFieldSummary
};
