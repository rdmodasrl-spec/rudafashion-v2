import { useEffect, useState } from 'react';
import { apiGet } from '../../api/client';

/**
 * 平台全局功能开关的渲染副本（fashion_enabled / modaui_enabled）。
 *
 * 约定（见 docs/engineering/modules/platform-feature-flags.md §3.5）：
 * - 只用于隐藏入口与渲染「暂不可用」提示，**不是**授权依据；服务端每个请求都会重新判断。
 * - 同一页面内多处使用只发一次请求，进程内共享一份快照。
 * - 请求失败时保持上次成功值（首次失败按「可用」渲染），避免网络抖动把功能永久隐藏；
 *   真正的拦截由服务端 403 完成。
 */
export type ModuleAvailability = {
  fashionEnabled: boolean;
  modauiEnabled: boolean;
  loaded: boolean;
};

type PublicFeatureFlagResponse = {
  success?: boolean;
  flags?: Record<string, unknown>;
};

const DEFAULT_AVAILABILITY: ModuleAvailability = {
  fashionEnabled: true,
  modauiEnabled: true,
  loaded: false
};

let snapshot: ModuleAvailability = DEFAULT_AVAILABILITY;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function getModuleAvailability(): ModuleAvailability {
  return snapshot;
}

export async function refreshModuleAvailability(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const result = await apiGet<PublicFeatureFlagResponse>('/api/public/feature-flags');
      const flags = result && typeof result.flags === 'object' && result.flags ? result.flags : {};
      snapshot = {
        fashionEnabled: flags.fashion_enabled !== false,
        modauiEnabled: flags.modaui_enabled !== false,
        loaded: true
      };
    } catch (error) {
      console.warn('[module-availability]', error);
      snapshot = { ...snapshot, loaded: true };
    } finally {
      inflight = null;
      notify();
    }
  })();
  return inflight;
}

export function useModuleAvailability(): ModuleAvailability {
  const [value, setValue] = useState<ModuleAvailability>(snapshot);

  useEffect(() => {
    const listener = () => setValue(snapshot);
    listeners.add(listener);
    // 订阅期间快照可能已更新（其它组件先完成请求）。
    listener();
    if (!snapshot.loaded) void refreshModuleAvailability();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return value;
}
