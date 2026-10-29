import { ApiError } from '../../../../api/client';

/**
 * Admin API failures must stay readable: surface the server error code and, for the
 * IP allowlist gate, the exact client IP the backend observed so an operator can fix
 * the allowlist without guessing.
 */
export function describeGrowthError(error: unknown): string {
  if (error instanceof ApiError) {
    const clientIp = typeof error.details?.clientIp === 'string' ? error.details.clientIp : '';
    const code = error.code ? `（${error.code}）` : '';
    if (clientIp || error.code === 'ADMIN_IP_NOT_ALLOWED') {
      const observed = clientIp ? ` ${clientIp}` : '';
      return `当前访问 IP${observed} 不在平台后台白名单内。请将该地址（IPv6 可写成 CIDR，如 2001:db8::/64）加入服务器环境变量 ADMIN_IP_WHITELIST，多个地址用逗号分隔，重启服务后生效。${code}`;
    }
    if (error.code === 'GROWTH_PROSPECT_SEARCH_NOT_CONFIGURED') {
      const required = Array.isArray(error.details?.required)
        ? error.details.required.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
        : [];
      return `潜在商家检索未接通：请配置${required.length ? ` ${required.join(' 与 ')} ` : '搜索供应商'}后重启服务。系统不会返回默认或虚构企业数据。${code}`;
    }
    if (error.code === 'GROWTH_COPY_AI_PROVIDER_FAILED' || error.code === 'GROWTH_ANALYSIS_AI_PROVIDER_FAILED') {
      return `AI 服务未配置或调用失败：请到 AI 员工设置检查提供方、模型与密钥后重试。${code}`;
    }
    if (error.message === error.code) return error.code;
    return `${error.message}${code}`;
  }
  return error instanceof Error ? error.message : '请求失败，请稍后重试';
}
