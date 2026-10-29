CREATE TABLE "AiEmployeeDefinition" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "department" VARCHAR(40) NOT NULL,
    "description" TEXT NOT NULL,
    "version" VARCHAR(32) NOT NULL DEFAULT '0.1.0',
    "status" VARCHAR(24) NOT NULL DEFAULT 'planned',
    "capabilities" TEXT NOT NULL DEFAULT '[]',
    "requiredPermissions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiEmployeeDefinition_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiEmployeeDefinition_status_check"
        CHECK ("status" IN ('planned', 'development', 'pilot', 'available', 'paused'))
);

CREATE UNIQUE INDEX "AiEmployeeDefinition_slug_key" ON "AiEmployeeDefinition"("slug");
CREATE INDEX "AiEmployeeDefinition_status_department_idx" ON "AiEmployeeDefinition"("status", "department");

INSERT INTO "AiEmployeeDefinition"
    ("id", "slug", "name", "department", "description", "version", "status", "capabilities", "requiredPermissions", "updatedAt")
VALUES
    ('ai_employee_product_manager', 'product-manager', 'AI 商品运营员', 'CREATE',
     '整理商品资料、生成商品内容草稿、检查商品信息完整度；发布和改价须由商家另行确认。',
     '0.1.0', 'planned',
     '["商品资料整理","标题与描述草稿","商品信息完整度检查","多语言内容规划"]', '[]', CURRENT_TIMESTAMP),
    ('ai_employee_store_manager', 'store-manager', 'AI 店铺运营员', 'OPERATE',
     '检查店铺目录和商品状态，汇总异常并提出优化建议；当前不修改线上店铺。',
     '0.1.0', 'planned',
     '["店铺健康检查","商品状态检查","分类与搜索优化建议"]', '[]', CURRENT_TIMESTAMP),
    ('ai_employee_inventory_manager', 'inventory-manager', 'AI 库存经理', 'OPERATE',
     '规划库存风险分析、断货预警与补货建议；实际库存查询和调拨工具尚未绑定。',
     '0.1.0', 'planned',
     '["库存风险分析规划","补货建议规划","滞销分析规划"]', '[]', CURRENT_TIMESTAMP),
    ('ai_employee_sales_manager', 'sales-manager', 'AI 销售与客户经理', 'GROW',
     '规划客户机会分析、跟进任务和报价草稿辅助；不会自动联系客户或创建真实报价。',
     '0.1.0', 'planned',
     '["客户机会分析规划","跟进任务草稿规划","报价辅助规划"]', '[]', CURRENT_TIMESTAMP);
