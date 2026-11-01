/**
 * 3D 商品模型审核凭证（review credential）的判定规则。
 *
 * 背景：仅凭 `reviewStatus: 'approved'` 无法区分「真的被管理员审核过」和
 * 「被脚本或旧代码直接写成 approved」。因此引入凭证：
 *
 * ```ts
 * modelReview: {
 *   reviewerId: string;        // 管理员在 AuthAccount 里的真实 ID（唯一可信来源）
 *   reviewerUsername: string;  // 仅用于展示，不参与授权判断
 *   reviewedAt: string;        // ISO 时间
 *   decision: 'approved' | 'rejected';
 *   reason?: string;           // 驳回原因
 * }
 * ```
 *
 * 判定原则：缺凭证 = 未审核。缺失字段、非 approved、时间无效、ID 不像数据库 ID，
 * 一律按未审核处理，不因为 `reviewStatus` 写了 approved 就放行。
 */

export type ModelReviewDecision = 'approved' | 'rejected';

export type ModelReviewCredential = {
  reviewerId: string;
  reviewerUsername?: string;
  reviewedAt: string;
  decision: ModelReviewDecision;
  reason?: string;
};

/**
 * AuthAccount.id 是 uuid（Prisma `@default(uuid())`）。
 * 这里做形态校验，挡住「用用户名冒充 ID」这类伪造；
 * 真正可信的来源是审核接口只能由已认证的管理员会话写入。
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 允许 5 分钟时钟偏差，避免服务器间轻微漂移误判 */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export function isValidModelReviewCredential(value: unknown, now: number = Date.now()): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const credential = value as Record<string, unknown>;

  if (credential.decision !== 'approved') return false;

  const reviewerId = credential.reviewerId;
  if (typeof reviewerId !== 'string' || !UUID_PATTERN.test(reviewerId.trim())) return false;

  const reviewedAt = credential.reviewedAt;
  if (typeof reviewedAt !== 'string' || !reviewedAt) return false;
  const timestamp = Date.parse(reviewedAt);
  if (!Number.isFinite(timestamp)) return false;
  // 未来时间说明凭证是被构造的
  if (timestamp > now + CLOCK_SKEW_MS) return false;

  if (credential.reviewerUsername !== undefined && typeof credential.reviewerUsername !== 'string') return false;
  if (credential.reason !== undefined && typeof credential.reason !== 'string') return false;

  return true;
}

/**
 * 模型媒体是否可以公开给买家。
 * 三个条件必须同时成立：类型是 model、状态 approved、凭证合法（含真实管理员 ID）。
 */
export function isModelPubliclyVisible(item: unknown, now: number = Date.now()): boolean {
  if (!item || typeof item !== 'object') return false;
  const media = item as Record<string, unknown>;
  if (media.type !== 'model') return false;
  if (media.reviewStatus !== 'approved') return false;
  return isValidModelReviewCredential(media.modelReview, now);
}

/** 从商品 media 数组中剔除不可公开的模型条目；图片/视频不受影响。 */
export function stripUnapprovedModels<T>(media: T, now: number = Date.now()): T {
  if (!Array.isArray(media)) return media;
  return media.filter(item => {
    const entry = item as Record<string, unknown> | null;
    if (!entry || entry.type !== 'model') return true;
    return isModelPubliclyVisible(entry, now);
  }) as unknown as T;
}
