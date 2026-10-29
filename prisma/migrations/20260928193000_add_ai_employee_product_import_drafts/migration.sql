CREATE TABLE "AiEmployeeProductImportDraft" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "sourceFilename" VARCHAR(255) NOT NULL,
    "sourceType" VARCHAR(16) NOT NULL,
    "extractedData" TEXT NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
    "productId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiEmployeeProductImportDraft_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiEmployeeProductImportDraft_status_check"
        CHECK ("status" IN ('pending', 'created', 'rejected')),
    CONSTRAINT "AiEmployeeProductImportDraft_sourceType_check"
        CHECK ("sourceType" IN ('image', 'pdf', 'csv', 'xlsx'))
);

CREATE INDEX "AiEmployeeProductImportDraft_merchantId_status_createdAt_idx"
ON "AiEmployeeProductImportDraft"("merchantId", "status", "createdAt");

CREATE INDEX "AiEmployeeProductImportDraft_installationId_status_createdAt_idx"
ON "AiEmployeeProductImportDraft"("installationId", "status", "createdAt");

ALTER TABLE "AiEmployeeProductImportDraft"
ADD CONSTRAINT "AiEmployeeProductImportDraft_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiEmployeeProductImportDraft"
ADD CONSTRAINT "AiEmployeeProductImportDraft_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "MerchantAiEmployeeInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiEmployeeProductImportDraft"
ADD CONSTRAINT "AiEmployeeProductImportDraft_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MerchantAiEmployeeInstallation"
DROP CONSTRAINT "MerchantAiEmployeeInstallation_status_check";

ALTER TABLE "MerchantAiEmployeeInstallation"
ADD CONSTRAINT "MerchantAiEmployeeInstallation_status_check"
CHECK ("status" IN ('requested', 'active', 'paused', 'declined'));

INSERT INTO "AiEmployeeDefinition"
    ("id", "slug", "name", "department", "description", "version", "status", "capabilities", "requiredPermissions", "updatedAt")
VALUES
    ('ai_employee_team_manager', 'team-manager', 'AI 团队总管', 'MANAGER',
     '协调垂直领域 AI 员工并汇总工作结果；当前尚未开放跨员工任务调度。',
     '0.1.0', 'planned', '["任务理解规划","员工协同规划","结果汇总规划"]', '[]', CURRENT_TIMESTAMP),
    ('ai_employee_designer', 'designer', 'AI 设计师', 'CREATE',
     '规划服装设计方向、系列主题和视觉概念；设计生成工具尚未接入。',
     '0.1.0', 'planned', '["设计方向规划","系列概念规划","视觉风格规划"]', '[]', CURRENT_TIMESTAMP),
    ('ai_employee_photo_editor', 'photo-editor', 'AI 照片编辑师', 'CREATE',
     '规划商品图片编辑与场景素材工作流；图像生成和编辑工具尚未接入。',
     '0.1.0', 'planned', '["图片质量检查规划","商品图片编辑规划","场景素材规划"]', '[]', CURRENT_TIMESTAMP),
    ('ai_employee_writer', 'writer', 'AI 文案撰写员', 'CREATE',
     '规划商品文案、品牌内容和多语言表达；当前仅商品经理文案草稿已接入。',
     '0.1.0', 'planned', '["商品文案规划","品牌内容规划","多语言内容规划"]', '[]', CURRENT_TIMESTAMP),
    ('ai_employee_tech_support', 'tech-support', 'AI 技术支持', 'OPERATE',
     '规划商家工作台和店铺运营问题的排查与指引；业务工具尚未授权接入。',
     '0.1.0', 'planned', '["工作台支持规划","店铺问题排查规划","操作指引规划"]', '[]', CURRENT_TIMESTAMP),
    ('ai_employee_marketer', 'marketer', 'AI 营销专家', 'GROW',
     '规划活动、受众和营销素材建议；营销投放及客户联系工具尚未接入。',
     '0.1.0', 'planned', '["活动策划规划","受众分析规划","营销内容规划"]', '[]', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
