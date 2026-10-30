/**
 * MODAUI AI Tools 的能力真值（纯逻辑）。
 *
 * 规则：能力"可用"必须对应真实引擎或真实 API 已配置；
 * 没有供应商凭据的能力一律返回 `not_connected`，前端据此隐藏入口或显示"未接通"，
 * 不允许渲染可点击按钮再抛错，更不允许返回伪造结果。
 *
 * 设计文档：docs/engineering/architecture/MODaUI-AI-TOOLS-PLATFORM.md §1.1 / §1.2
 */

export const AI_TOOL_CENTER_IDS = [
  'copywriting',
  'image',
  'video',
  'voice',
  'publish',
  'analytics'
] as const;

export type AiToolCenterId = (typeof AI_TOOL_CENTER_IDS)[number];

export type AiToolCenterStatus = 'ready' | 'not_connected';

export type AiToolCenterBlockedReason =
  | 'provider_not_configured'
  | 'adapter_not_built'
  | 'missing_credentials';

export type AiToolCenter = {
  id: AiToolCenterId;
  labelZh: string;
  labelIt: string;
  status: AiToolCenterStatus;
  reason: AiToolCenterBlockedReason | null;
  /** 该中心下已接通、可真实调用的工具 ID；未接通时为空数组。 */
  toolIds: string[];
};

export type AiToolEngineSnapshot = {
  /** 文本/推理引擎：本地模型已部署或远端 provider 已配置 Key。 */
  textReady: boolean;
  /** 图片引擎：fal 已配置 Key 或本地推理服务已就绪。 */
  imageReady: boolean;
  /** 视频引擎：当前没有实现任何 Provider Adapter。 */
  videoReady?: boolean;
  /** 语音引擎：当前没有实现任何 TTS/ASR Provider Adapter。 */
  voiceReady?: boolean;
  /** 发布引擎：需要平台 OAuth 授权，当前未接入。 */
  publishReady?: boolean;
  /** 分析引擎：需要平台数据授权，当前未接入。 */
  analyticsReady?: boolean;
};

/**
 * 计算六个工作中心的真实可用状态。
 * `toolIds` 只按已注册的真实工具填充，未接通的中心永远为空。
 */
export function resolveAiToolCenters(
  engines: AiToolEngineSnapshot,
  registeredToolIds: readonly string[]
): AiToolCenter[] {
  const has = (toolId: string) => registeredToolIds.includes(toolId);
  const copyToolIds = ['ai_tools_write_copy', 'ai_tools_translate'].filter(has);
  const imageToolIds = ['ai_tools_generate_image'].filter(has);
  const voiceToolIds = ['ai_tools_speak'].filter(has);

  const textReady = engines.textReady && copyToolIds.length > 0;
  const imageReady = Boolean(engines.imageReady) && imageToolIds.length > 0;
  const videoReady = Boolean(engines.videoReady) && has('ai_tools_generate_video');
  const voiceReady = Boolean(engines.voiceReady) && voiceToolIds.length > 0;
  const publishReady = Boolean(engines.publishReady) && has('ai_tools_publish_post');
  const analyticsReady = Boolean(engines.analyticsReady) && has('ai_tools_marketing_report');

  return [
    {
      id: 'copywriting',
      labelZh: '文案中心',
      labelIt: 'Copywriting',
      status: textReady ? 'ready' : 'not_connected',
      reason: textReady ? null : 'provider_not_configured',
      toolIds: textReady ? copyToolIds : []
    },
    {
      id: 'image',
      labelZh: '图片中心',
      labelIt: 'Immagini',
      status: imageReady ? 'ready' : 'not_connected',
      reason: imageReady ? null : imageToolIds.length ? 'provider_not_configured' : 'adapter_not_built',
      toolIds: imageReady ? imageToolIds : []
    },
    {
      id: 'video',
      labelZh: '视频中心',
      labelIt: 'Video',
      status: videoReady ? 'ready' : 'not_connected',
      reason: videoReady ? null : 'adapter_not_built',
      toolIds: videoReady ? ['ai_tools_generate_video'] : []
    },
    {
      id: 'voice',
      labelZh: '语音中心',
      labelIt: 'Voce',
      status: voiceReady ? 'ready' : 'not_connected',
      reason: voiceReady ? null : 'adapter_not_built',
      toolIds: voiceReady ? voiceToolIds : []
    },
    {
      id: 'publish',
      labelZh: '发布中心',
      labelIt: 'Pubblicazione',
      status: publishReady ? 'ready' : 'not_connected',
      reason: publishReady ? null : 'missing_credentials',
      toolIds: publishReady ? ['ai_tools_publish_post'] : []
    },
    {
      id: 'analytics',
      labelZh: '分析中心',
      labelIt: 'Analisi',
      status: analyticsReady ? 'ready' : 'not_connected',
      reason: analyticsReady ? null : 'missing_credentials',
      toolIds: analyticsReady ? ['ai_tools_marketing_report'] : []
    }
  ];
}

/**
 * 由 provider 运行时设置推导引擎就绪状态。
 * 只判断"是否已配置"，不做网络探测：真实调用失败会以错误码返回，不会被伪装成成功。
 */
export function resolveAiToolEngines(input: {
  textProvider: { provider: string; apiKey: string; model?: string; fallbackToLocal?: boolean };
  imageProvider: { provider: string; apiKey: string; model?: string; fallbackToLocal?: boolean };
}): AiToolEngineSnapshot {
  const textReady = input.textProvider.provider === 'ollama'
    ? true
    : Boolean(input.textProvider.apiKey);
  // 图片：只有 fal 具备真实凭据判定；本地 Automatic1111 需要额外的可达性探测，
  // 在没有探测实现前一律按未接通处理，避免给商家一个点了就失败的入口。
  const imageReady = input.imageProvider.provider === 'fal' && Boolean(input.imageProvider.apiKey);
  return {
    textReady,
    imageReady,
    videoReady: false,
    voiceReady: false,
    publishReady: false,
    analyticsReady: false
  };
}
