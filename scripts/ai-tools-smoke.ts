/**
 * MODAUI AI Tools 生产冒烟：验证「安装 → 工具可用 → 真实模型调用 → 停用 → 恢复 → 卸载」完整闭环。
 *
 * 用法（在生产目录，已加载 .env）：
 *   set -a && source .env && set +a && npx tsx scripts/ai-tools-smoke.ts
 *
 * 可选环境变量：
 *   SMOKE_BASE_URL      默认 https://modaui.com
 *   SMOKE_MERCHANT_ID   默认 demo-industry-apparel-production（演示商家，脚本结束时会卸载应用，不留残留）
 *
 * 安全边界：只对演示商家执行安装/停用/启用/卸载，不改任何业务数据；退出时状态回到「未安装」。
 * 需要真实模型调用时依赖服务端已配置的模型密钥；未配置时第 4/5 步会失败，属于预期内的环境缺失。
 */
import jwt from 'jsonwebtoken';

const BASE = process.env.SMOKE_BASE_URL || 'https://modaui.com';
const MERCHANT_ID = process.env.SMOKE_MERCHANT_ID || 'demo-industry-apparel-production';
const APP_ID = 'modaui-ai-tools';
const secret = process.env.JWT_MERCHANT_SECRET;
if (!secret) throw new Error('缺少 JWT_MERCHANT_SECRET（先加载 .env）');

const token = jwt.sign({ id: MERCHANT_ID, merchantId: MERCHANT_ID, code: 'SMOKE', role: 'merchant' }, secret, {
  expiresIn: '1h'
});
const headers = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

let failures = 0;

function check(label: string, passed: boolean, detail: unknown) {
  if (!passed) failures += 1;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label} :: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* 保留原始文本 */
  }
  return { status: response.status, body: parsed as any };
}

async function toolState() {
  const result = await call('GET', '/api/merchant/ai-tools');
  const tools = Array.isArray(result.body?.tools) ? result.body.tools : [];
  return {
    status: result.status,
    manifestEnabled: result.body?.manifestEnabled === true,
    availableIds: tools.filter((tool: any) => tool.availability === 'available').map((tool: any) => tool.toolId),
    blockedIds: tools.filter((tool: any) => tool.availability === 'blocked').map((tool: any) => tool.toolId),
    blockedReasons: tools.filter((tool: any) => tool.availability === 'blocked').map((tool: any) => tool.blockedReason)
  };
}

async function main() {
  const before = await toolState();
  check('未安装时无可用工具', before.status === 200 && before.availableIds.length === 0, before);

  const install = await call('POST', '/api/app-store/installations', { appId: APP_ID });
  check('安装应用', install.status === 201, { status: install.status, body: install.body });

  const installed = await toolState();
  check('安装后两个工具可用', installed.availableIds.length === 2, installed);

  const copy = await call('POST', '/api/merchant/ai-tools/ai_tools_write_copy/invoke', {
    input: { brief: '亚麻短袖衬衫，宽松版型，适合初夏通勤', language: 'zh' }
  });
  check(
    '真实模型生成商品文案',
    copy.status === 200 && typeof copy.body?.result?.headline === 'string',
    { status: copy.status, result: copy.body?.result ?? copy.body }
  );

  const translate = await call('POST', '/api/merchant/ai-tools/ai_tools_translate/invoke', {
    input: { text: '亚麻短袖衬衫，宽松版型，适合初夏通勤', targetLanguage: 'it' }
  });
  check(
    '真实模型完成意大利语翻译',
    translate.status === 200 && typeof translate.body?.result?.translation === 'string',
    { status: translate.status, result: translate.body?.result ?? translate.body }
  );

  const disable = await call('POST', `/api/app-store/installations/${APP_ID}/disable`);
  check('停用应用', disable.status === 200, { status: disable.status });

  const disabled = await toolState();
  check('停用后工具全部不可用', disabled.availableIds.length === 0, disabled);

  const blockedInvoke = await call('POST', '/api/merchant/ai-tools/ai_tools_write_copy/invoke', {
    input: { brief: 'x', language: 'zh' }
  });
  check('停用后调用被门禁拦截', blockedInvoke.status === 403, {
    status: blockedInvoke.status,
    body: blockedInvoke.body
  });

  const enable = await call('POST', `/api/app-store/installations/${APP_ID}/enable`);
  check('恢复应用', enable.status === 200, { status: enable.status });
  const enabled = await toolState();
  check('恢复后工具重新可用', enabled.availableIds.length === 2, enabled);

  const uninstall = await call('DELETE', `/api/app-store/installations/${APP_ID}`);
  check('卸载应用', uninstall.status === 200, { status: uninstall.status });
  const uninstalled = await toolState();
  check('卸载后工具全部移除', uninstalled.availableIds.length === 0 && uninstalled.blockedIds.length === 0, uninstalled);

  if (failures > 0) {
    console.error(`AI Tools 冒烟失败：${failures} 项未通过`);
    process.exit(1);
  }
  console.log('AI Tools 冒烟通过：安装 → 真实调用 → 停用 → 恢复 → 卸载 全链路符合预期。');
}

main().catch(error => {
  console.error('AI Tools 冒烟异常', error);
  process.exit(1);
});
