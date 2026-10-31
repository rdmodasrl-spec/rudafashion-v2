/**
 * 模板级 3D 开关。
 *
 * 三层优先级：URL 覆盖（验收/排障）> 模板注册表默认 > 全局开。
 * 关闭时不加载 three.js，组件回落到真实商品图。
 */
export function readPremium3DFlag(templateDefault: boolean | null | undefined): boolean {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const override = params.get('visual3d');
    if (override === '0' || override === 'off') return false;
    if (override === '1' || override === 'on') return true;
  }
  return templateDefault !== false;
}
