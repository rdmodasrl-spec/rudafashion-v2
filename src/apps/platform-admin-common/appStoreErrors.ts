import { ApiError } from '../../api/client';

export const APP_STORE_ERROR_TEXT: Record<string, string> = {
  ADMIN_AUTH_REQUIRED: '登录已失效，请重新登录后再打开生态应用。',
  ADMIN_PERMISSION_REQUIRED: '当前管理员账号缺少「生态应用」权限。',
  ADMIN_IP_NOT_ALLOWED: '当前网络 IP 不在管理员白名单内。',
  APP_STORE_PAYMENTS_UNAVAILABLE: '付费应用暂未开放；请将该应用设为草稿后保存。',
  APP_STORE_INPUT_INVALID: '应用信息不完整或格式不正确。',
  APP_STORE_SLUG_DUPLICATE: '应用标识已存在，请更换 appId 或 slug。'
};

/**
 * 把 API 错误体（`{ error: { code, message } }` / `Error` / 字符串）统一成可读文案。
 * 服务端失败信封里的 `error` 是对象，直接传给 `Error` 会显示 `[object Object]`。
 */
export function describeAppStoreError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const known = error.code ? APP_STORE_ERROR_TEXT[error.code] : undefined;
    if (known) return known;
    const detail = typeof error.message === 'string' && error.message && error.message !== '[object Object]'
      ? error.message
      : '';
    return detail || fallback;
  }
  if (error instanceof Error) {
    return error.message && error.message !== '[object Object]' ? error.message : fallback;
  }
  if (typeof error === 'string' && error) return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = record.message ?? (record.error as Record<string, unknown> | undefined)?.message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}
