import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  createModaGptAgentContext,
  createModaGptToolRuntime,
  type ModaGptAgentRole,
  type ModaGptRiskLevel,
  type ModaGptTrustedPrincipal
} from './modagptRuntime';
import {
  createModaGptMerchantTools,
  executeModaGptMerchantDraftWorkflow,
  isCurrencyCode,
  productSnapshotFingerprint,
  quoteSnapshotFingerprint
} from './modagptMerchantTools';
import { createModaGptExecutionPlan } from './modagptOrchestration';
import type { ModaGptCoreTaskRoute } from './modagptTaskSupervisor';

export type ModaGptMerchantTaskResult = {
  taskId: string;
  traceId: string;
  status: 'needs_input' | 'draft_created' | 'approval_required' | 'published' | 'unpublished' | 'approved' | 'sent' | 'analysis_completed';
  summary: string;
  employee: ModaGptAgentRole;
  steps: string[];
  toolCalls: Array<{ toolId: string; status: 'succeeded' }>;
  artifacts: string[];
  approvalRequired: boolean;
  approvalId: string | null;
  creditsUsed: number;
  errors: string[];
};

export async function executeModaGptMerchantTask(input: {
  prisma: PrismaClient;
  merchantId: string;
  taskId: string;
  traceId: string;
  actorId: string;
  employeeId: string | null;
  message: string;
  inputs: Record<string, unknown>;
  route: ModaGptCoreTaskRoute;
  approvalId?: string | null;
  signal?: AbortSignal;
  assertLease?: () => Promise<void>;
  sendQuote?: (
    merchantId: string,
    quote: {
      quoteId: string;
      quoteNo: string;
      taskId: string;
      traceId: string;
      customerId: string;
      companyName: string;
      recipient: string;
      currency: string;
      totalAmount: number;
      validUntil: Date | null;
      paymentTerms: string | null;
      deliveryTerms: string | null;
      leadTimeDays: number | null;
      items: Array<{ styleNo: string; productName: string; sku: string; quantity: number; unitPrice: number }>;
    },
    idempotencyKey: string,
    signal?: AbortSignal
  ) => Promise<{ provider: string; providerMessageId: string }>;
}): Promise<ModaGptMerchantTaskResult> {
  if (!['product_publish', 'customer_quote_creation', 'business_analysis'].includes(input.route.workflow)
    || input.route.execution !== 'ready') {
    throw new Error('MODAGPT_MERCHANT_WORKFLOW_UNAVAILABLE');
  }
  const employee = input.route.workflow === 'product_publish'
    ? 'product-creative-manager'
    : input.route.workflow === 'business_analysis'
      ? 'business-manager'
      : 'sales-customer-manager';
  const employeePermissions = input.employeeId
    ? await input.prisma.merchantEmployee.findFirst({
      where: { id: input.employeeId, merchantId: input.merchantId, active: true },
      select: { id: true, permissions: true }
    })
    : null;
  if (input.employeeId && !employeePermissions) throw new Error('EMPLOYEE_NOT_FOUND_OR_DISABLED');
  const userPermissions = employeePermissions
    ? parsePermissions(employeePermissions.permissions)
    : ['product.catalog.read', 'product.import.draft', 'product.publish', 'sales.order.create', 'sales.quote.manage', 'business.analytics.read'];
  const agentPermissions: Partial<Record<ModaGptAgentRole, readonly string[]>> = {
    'product-creative-manager': ['product.catalog.read', 'product.import.draft', 'product.publish'],
    'business-manager': ['product.catalog.read', 'sales.order.create', 'business.analytics.read'],
    'sales-customer-manager': ['sales.order.create', 'sales.quote.manage', 'product.catalog.read'],
    'supply-chain-finance-manager': []
  };
  const tools = createModaGptMerchantTools({
    prisma: input.prisma,
    taskId: input.taskId,
    traceId: input.traceId,
    actorId: input.actorId,
    employeeId: input.employeeId,
    signal: input.signal,
    assertLease: input.assertLease,
    sendQuote: input.sendQuote
  });
  const quoteAction = typeof input.inputs.quoteAction === 'string' ? input.inputs.quoteAction : 'draft';
  if (input.route.workflow === 'customer_quote_creation'
    && ['update', 'submit', 'send'].includes(quoteAction)
    && !input.approvalId) {
    const quoteId = typeof input.inputs.quoteId === 'string' ? input.inputs.quoteId : '';
    if (!quoteId) {
      return needsInputResult(input, employee, '请提供需要修改、提交或发送的报价 ID。', ['验证报价操作目标']);
    }
    const toolId = quoteAction === 'update' ? 'update_quote'
      : quoteAction === 'submit' ? 'submit_quote' : 'send_quote';
    const quote = await input.prisma.salesQuote.findFirst({
      where: { id: quoteId, merchantId: input.merchantId },
      include: { items: true, customer: { select: { id: true, email: true, status: true } } }
    });
    if (!quote) throw new Error('MODAGPT_QUOTE_NOT_FOUND');
    const request = quoteAction === 'update'
      ? {
        items: Array.isArray(input.inputs.items)
          ? input.inputs.items
          : quote.items.map(item => ({
            productId: item.productId,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice)
          })),
        ...(typeof input.inputs.currency === 'string' ? { currency: input.inputs.currency } : {}),
        notes: typeof input.inputs.notes === 'string' ? input.inputs.notes.trim() || null : quote.notes
      }
      : undefined;
    if (quoteAction === 'update') {
      const definition = tools.definitions.find(candidate => candidate.name === 'update_quote');
      if (!definition?.validateInput({ quoteId, approvalId: 'pending-validation', ...request })) {
        return needsInputResult(input, employee, '请提供报价 ID，以及要修改的完整商品、SKU、数量和单价；金额或条款不完整时不会提交审批。', ['验证报价修改字段']);
      }
      if (quote.status !== 'draft') throw new Error('MODAGPT_QUOTE_NOT_EDITABLE');
    } else if (quoteAction === 'submit' && quote.status !== 'draft') {
      throw new Error('MODAGPT_QUOTE_NOT_SUBMITTABLE');
    } else if (quoteAction === 'send' && quote.status !== 'approved') {
      throw new Error('MODAGPT_QUOTE_NOT_SENDABLE');
    }
    if (quoteAction === 'send' && (quote.customer.status !== 'approved' || !quote.customer.email.trim())) {
      return needsInputResult(input, employee, '客户尚未审核或缺少可用邮箱，暂不能申请报价发送审批。', ['检查报价客户和收件邮箱']);
    }
    if (quoteAction === 'send' && !isCurrencyCode(quote.currency)) {
      return needsInputResult(input, employee, '报价没有明确币种；请通过已审批的报价修改设置币种后再申请发送。', ['检查报价币种']);
    }
    if (quoteAction === 'send' && quote.validUntil && quote.validUntil <= new Date()) {
      return needsInputResult(input, employee, '报价已超过有效期，不能申请发送；请先更新有效期并重新审批。', ['检查报价有效期']);
    }
    const approvalPayload = JSON.stringify({
      action: quoteAction,
      quoteId,
      fingerprint: quoteSnapshotFingerprint(quote),
      ...(quoteAction === 'send' ? { recipient: quote.customer.email.trim().toLowerCase() } : {}),
      ...(request ? { request } : {})
    });
    let approval = await input.prisma.modaGptApproval.findFirst({
      where: { merchantId: input.merchantId, taskId: input.taskId, toolId },
      select: { id: true, payload: true, status: true }
    });
    if (!approval) {
      approval = await input.prisma.modaGptApproval.create({
        data: {
          merchantId: input.merchantId,
          taskId: input.taskId,
          toolId,
          resourceId: quoteId,
          payload: approvalPayload,
          requestedBy: input.actorId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000)
        },
        select: { id: true, payload: true, status: true }
      });
    }
    if (approval.payload !== approvalPayload || approval.status !== 'pending') {
      throw new Error('MODAGPT_APPROVAL_IDEMPOTENCY_CONFLICT');
    }
    await input.prisma.employeeAuditLog.create({
      data: {
        id: crypto.randomUUID(),
        merchantId: input.merchantId,
        employeeId: input.employeeId,
        action: 'MODAGPT_APPROVAL_REQUESTED',
        entityType: 'ModaGptApproval',
        entityId: approval.id,
        metadata: JSON.stringify({ taskId: input.taskId, toolId, quoteId, traceId: input.traceId }),
        ipAddress: null
      }
    });
    return {
      taskId: input.taskId,
      traceId: input.traceId,
      status: 'approval_required',
      summary: quoteAction === 'update'
        ? '报价修改已绑定当前报价快照并进入审批；审批通过后才会应用修改。'
        : quoteAction === 'submit'
          ? '报价正式提交已进入审批；审批通过后才会提交。'
          : '报价外发已进入审批；审批通过后才会通过邮件实际发送。报价变更将使审批失效。',
      employee: 'sales-customer-manager',
      steps: ['读取租户内报价', '绑定报价快照和明确操作参数', '创建持久化审批请求'],
      toolCalls: [],
      artifacts: [`SalesQuote:${quoteId}`],
      approvalRequired: true,
      approvalId: approval.id,
      creditsUsed: 0,
      errors: []
    };
  }
  const action = typeof input.inputs.productAction === 'string' ? input.inputs.productAction : 'draft';
  if (input.route.workflow === 'product_publish' && !['draft', 'update', 'publish', 'unpublish'].includes(action)) {
    throw new Error('MODAGPT_PRODUCT_ACTION_UNSUPPORTED');
  }
  if (input.route.workflow === 'product_publish' && (action === 'publish' || action === 'unpublish')) {
    const toolId = action === 'publish' ? 'publish_product' : 'unpublish_product';
    const productId = typeof input.inputs.productId === 'string' ? input.inputs.productId : '';
    if (!productId || productId.length > 160) {
      return {
        taskId: input.taskId,
        traceId: input.traceId,
        status: 'needs_input',
        summary: '请提供要发布或下架的商品 ID。',
        employee: 'product-creative-manager',
        steps: ['验证商品操作目标'],
        toolCalls: [],
        artifacts: [],
        approvalRequired: false,
        approvalId: null,
        creditsUsed: 0,
        errors: []
      };
    }
    if (!input.approvalId) {
      const product = await input.prisma.product.findFirst({
        where: { id: productId, merchantId: input.merchantId },
        select: {
          id: true,
          merchantId: true,
          lifecycleStatus: true,
          styleNo: true,
          name: true,
          category: true,
          subCategory: true,
          season: true,
          wholesalePrice: true,
          rrpPrice: true,
          moq: true,
          packSize: true,
          description: true,
          skus: true,
          images: true,
          media: true
        }
      });
      if (!product || product.lifecycleStatus !== (action === 'publish' ? 'draft' : 'published')) {
        throw new Error('MODAGPT_PRODUCT_LIFECYCLE_SOURCE_INVALID');
      }
      if (action === 'publish' && !await isModaGptProductReadyToPublish(input.prisma, input.merchantId, product)) {
        return {
          taskId: input.taskId,
          traceId: input.traceId,
          status: 'needs_input',
          summary: '商品资料不满足发布条件。请先补齐有效商家分类、价格、MOQ、装箱数、SKU 和至少一张封面图片，再重新提交发布审批。',
          employee: 'product-creative-manager',
          steps: ['读取当前商品草稿', '检查 RUDA 发布必需字段'],
          toolCalls: [],
          artifacts: [`Product:${productId}`],
          approvalRequired: false,
          approvalId: null,
          creditsUsed: 0,
          errors: []
        };
      }
      const payload = JSON.stringify({
        productId,
        action: action === 'publish' ? 'published' : 'draft',
        fingerprint: productSnapshotFingerprint(product)
      });
      let approval = await input.prisma.modaGptApproval.findFirst({
        where: { merchantId: input.merchantId, taskId: input.taskId, toolId },
        select: { id: true, payload: true, status: true, expiresAt: true }
      });
      if (!approval) {
        approval = await input.prisma.modaGptApproval.create({
          data: {
            merchantId: input.merchantId,
            taskId: input.taskId,
            toolId,
            resourceId: productId,
            payload,
            requestedBy: input.actorId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          },
          select: { id: true, payload: true, status: true, expiresAt: true }
        });
      }
      if (approval.payload !== payload || approval.status !== 'pending') {
        throw new Error('MODAGPT_APPROVAL_IDEMPOTENCY_CONFLICT');
      }
      await input.prisma.employeeAuditLog.create({
        data: {
          id: crypto.randomUUID(),
          merchantId: input.merchantId,
          employeeId: input.employeeId,
          action: 'MODAGPT_APPROVAL_REQUESTED',
          entityType: 'ModaGptApproval',
          entityId: approval.id,
          metadata: JSON.stringify({ taskId: input.taskId, toolId, productId, traceId: input.traceId }),
          ipAddress: null
        }
      });
      return {
        taskId: input.taskId,
        traceId: input.traceId,
        status: 'approval_required',
        summary: action === 'publish' ? '商品已进入发布审批；审批通过后才会公开上架。' : '商品已进入下架审批；审批通过后才会下架。',
        employee: 'product-creative-manager',
        steps: ['检查商家商品和当前状态', '创建持久化审批请求', '等待商家管理员审批'],
        toolCalls: [],
        artifacts: [`Product:${productId}`],
        approvalRequired: true,
        approvalId: approval.id,
        creditsUsed: 0,
        errors: []
      };
    }
  }
  const productToolId = action === 'publish' ? 'publish_product' : 'unpublish_product';
  const quoteToolId = quoteAction === 'update' ? 'update_quote'
    : quoteAction === 'submit' ? 'submit_quote'
      : quoteAction === 'send' ? 'send_quote' : null;
  const expectedApprovalToolId = input.route.workflow === 'product_publish'
    ? productToolId
    : quoteToolId;
  const approval = input.approvalId && expectedApprovalToolId
    ? await input.prisma.modaGptApproval.findFirst({
      where: {
        id: input.approvalId,
        merchantId: input.merchantId,
        status: expectedApprovalToolId === 'send_quote'
          ? { in: ['approved', 'processing', 'consumed'] }
          : expectedApprovalToolId === 'update_quote' || expectedApprovalToolId === 'submit_quote'
            ? { in: ['approved', 'consumed'] }
            : 'approved',
        toolId: expectedApprovalToolId,
        OR: [
          { status: 'consumed' },
          {
            status: expectedApprovalToolId === 'send_quote' ? { in: ['approved', 'processing'] } : 'approved',
            expiresAt: { gt: new Date() }
          }
        ]
      },
      select: { id: true, status: true, expiresAt: true, payload: true }
    })
    : null;
  if (input.approvalId && !approval) throw new Error('MODAGPT_APPROVAL_NOT_VALID');
  const approvedActions = approval && input.approvalId && expectedApprovalToolId ? [{
    taskId: input.taskId,
    toolId: expectedApprovalToolId,
    tenantId: input.merchantId,
    expiresAt: approval.status === 'consumed' ? new Date(Date.now() + 1_000) : approval.expiresAt
  }] : [];
  const principal: ModaGptTrustedPrincipal = {
    tenantId: input.merchantId,
    actorId: input.actorId,
    active: true,
    permissions: userPermissions,
    agentPermissions,
    approvedActions
  };
  const runtime = createModaGptToolRuntime({
    principal,
    definitions: tools.definitions,
    handlers: tools.handlers,
    signal: input.signal,
    assertLease: input.assertLease,
    recordAudit: async event => {
      await input.prisma.employeeAuditLog.create({
        data: {
          id: crypto.randomUUID(),
          merchantId: input.merchantId,
          employeeId: input.employeeId,
          action: `MODAGPT_TOOL_${event.status.toUpperCase()}`,
          entityType: 'ModaGptTask',
          entityId: input.taskId,
          metadata: JSON.stringify({
            actorId: event.actorId,
            traceId: input.traceId,
            agentId: event.agentId,
            toolId: event.toolId,
            riskLevel: event.riskLevel as ModaGptRiskLevel,
            attempt: event.attempt,
            errorCode: event.errorCode
          }),
          ipAddress: null
        }
      });
    }
  });
  if (input.route.workflow === 'business_analysis') {
    const days = extractAnalysisPeriodDays(input.message);
    const businessToolIds = [
      'order_summary',
      'sales_summary',
      'inventory_summary',
      'product_performance',
      'customer_performance',
      'finance_summary'
    ] as const;
    const results: Record<string, Record<string, unknown>> = {};
    for (const toolId of businessToolIds) {
      await input.assertLease?.();
      const execution = await runtime.execute({
        taskId: input.taskId,
        tenantId: input.merchantId,
        agentId: 'business-manager',
        toolId,
        input: { days }
      });
      const value = execution.result;
      if (!isRecord(value) || value.source !== 'ruda_database' || value.days !== days) {
        throw new Error('MODAGPT_ANALYTICS_TOOL_VERIFY_FAILED');
      }
      results[toolId] = value;
    }
    const orders = results.order_summary;
    const sales = results.sales_summary;
    const inventory = results.inventory_summary;
    const productPerformance = results.product_performance;
    const customerPerformance = results.customer_performance;
    const finance = results.finance_summary;
    if (orders.orderCount !== sales.orderCount
      || orders.totalUnits !== sales.unitsSold
      || orders.totalAmount !== sales.grossSales) {
      throw new Error('MODAGPT_ANALYTICS_AGGREGATION_VERIFY_FAILED');
    }
    const unavailable = [
      ...(orders.dataAvailable === false ? ['order_summary', 'sales_summary'] : []),
      ...(inventory.dataAvailable === false ? ['inventory_summary'] : []),
      ...(productPerformance.dataAvailable === false ? ['product_performance'] : []),
      ...(customerPerformance.dataAvailable === false ? ['customer_performance'] : []),
      ...(finance.dataAvailable === false ? ['finance_summary'] : [])
    ];
    return {
      taskId: input.taskId,
      traceId: input.traceId,
      status: 'analysis_completed',
      summary: [
        orders.dataAvailable === false
          ? `最近 ${days} 天订单与销售数据：data_unavailable。`
          : `最近 ${days} 天 RUDA 实际数据：${String(orders.orderCount)} 笔非取消/退货订单，订单金额 ${String(sales.grossSales)}，已记录退款 ${String(sales.recordedRefundAmount)}，扣减已记录退款后 ${String(sales.amountAfterRecordedRefunds)}（币种未记录），销量 ${String(sales.unitsSold)} 件。`,
        inventory.dataAvailable === false
          ? '当前库存：data_unavailable。'
          : `库存覆盖 ${String(inventory.skuCount)} 个 SKU，现货 ${String(inventory.onHandUnits)} 件，可售 ${String(Number(inventory.onHandUnits) - Number(inventory.reservedUnits))} 件。`,
        finance.dataAvailable === false
          ? '发票财务汇总：data_unavailable。'
          : `发票金额（按状态和币种统计，不代表已确认收入）：${isRecord(finance.totalsByStatusAndCurrency)
            ? Object.entries(finance.totalsByStatusAndCurrency)
              .flatMap(([status, totals]) => isRecord(totals)
                ? Object.entries(totals).map(([currency, amount]) => `${status} ${String(amount)} ${currency}`)
                : [])
              .join('、')
            : 'data_unavailable'}。`,
        [
          productPerformance.dataAvailable === false
            ? '商品表现 data_unavailable'
            : `畅销商品 ${Array.isArray(productPerformance.products) ? productPerformance.products.length : 0} 项`,
          customerPerformance.dataAvailable === false
            ? '客户表现 data_unavailable'
            : `活跃客户 ${Array.isArray(customerPerformance.customers) ? customerPerformance.customers.length : 0} 家`
        ].join('；'),
        businessToolIds.some(toolId => results[toolId].truncated === true)
          ? '部分结果受安全行数上限截断，请缩小周期或导出原始数据复核。'
          : ''
      ].join(' '),
      employee: 'business-manager',
      steps: [
        `Supervisor 将任务交给经营总管，分析周期 ${days} 天`,
        ...businessToolIds.map(toolId => `通过 Tool Runtime 读取 ${toolId}`),
        '校验数据来源、周期和销售汇总一致性'
      ],
      toolCalls: businessToolIds.map(toolId => ({ toolId, status: 'succeeded' as const })),
      artifacts: [],
      approvalRequired: false,
      approvalId: null,
      creditsUsed: 0,
      errors: unavailable.map(toolId => `data_unavailable:${toolId}`)
    };
  }
  if (input.route.workflow === 'customer_quote_creation' && input.approvalId && quoteToolId) {
    if (!approval
      || approval.id !== input.approvalId
      || approval.payload.length === 0
      || (quoteToolId === 'send_quote' && !['approved', 'processing', 'consumed'].includes(approval.status))
      || (quoteToolId !== 'send_quote' && !['approved', 'consumed'].includes(approval.status))) {
      throw new Error('MODAGPT_APPROVAL_NOT_VALID');
    }
    if (!approvedActions.some(approved => approved.toolId === quoteToolId)) {
      throw new Error('MODAGPT_APPROVAL_NOT_VALID');
    }
    let storedApprovalPayload: unknown;
    try {
      storedApprovalPayload = JSON.parse(approval.payload);
    } catch {
      throw new Error('MODAGPT_APPROVAL_PAYLOAD_INVALID');
    }
    if (!isRecord(storedApprovalPayload)
      || storedApprovalPayload.quoteId !== input.inputs.quoteId
      || storedApprovalPayload.action !== quoteAction) {
      throw new Error('MODAGPT_APPROVAL_PAYLOAD_INVALID');
    }
    const quoteInput = quoteToolId === 'update_quote'
      ? { quoteId: input.inputs.quoteId, approvalId: input.approvalId, ...(
        isRecord(storedApprovalPayload.request) ? storedApprovalPayload.request : {}
      ) }
      : { quoteId: input.inputs.quoteId, approvalId: input.approvalId };
    let execution: Awaited<ReturnType<typeof runtime.execute>>;
    try {
      await input.assertLease?.();
      execution = await runtime.execute({
        taskId: input.taskId,
        tenantId: input.merchantId,
        agentId: 'sales-customer-manager',
        toolId: quoteToolId,
        input: quoteInput
      });
    } catch (error) {
      if (quoteToolId !== 'send_quote'
        || !(error instanceof Error)
        || error.message !== 'MODAGPT_APPROVAL_STALE') {
        throw error;
      }
      const currentQuote = await input.prisma.salesQuote.findFirst({
        where: { id: String(input.inputs.quoteId), merchantId: input.merchantId, status: 'approved' },
        include: {
          items: true,
          customer: { select: { id: true, email: true, status: true } }
        }
      });
      if (!currentQuote
        || currentQuote.customer.status !== 'approved'
        || !currentQuote.customer.email.trim()
        || (currentQuote.validUntil && currentQuote.validUntil <= new Date())) {
        return needsInputResult(input, employee, '报价或客户信息已变化或报价已过期；请先修正资料，再重新提交发送审批。', ['重新验证报价和客户']);
      }
      const payload = JSON.stringify({
        action: 'send',
        quoteId: currentQuote.id,
        fingerprint: quoteSnapshotFingerprint(currentQuote),
        recipient: currentQuote.customer.email.trim().toLowerCase()
      });
      let replacementApproval = await input.prisma.modaGptApproval.findFirst({
        where: { merchantId: input.merchantId, taskId: input.taskId, toolId: 'send_quote' },
        select: { id: true, payload: true, status: true }
      });
      if (!replacementApproval) {
        replacementApproval = await input.prisma.modaGptApproval.create({
          data: {
            merchantId: input.merchantId,
            taskId: input.taskId,
            toolId: 'send_quote',
            resourceId: currentQuote.id,
            payload,
            requestedBy: input.actorId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000)
          },
          select: { id: true, payload: true, status: true }
        });
        await input.prisma.employeeAuditLog.create({
          data: {
            id: randomUUID(),
            merchantId: input.merchantId,
            employeeId: input.employeeId,
            action: 'MODAGPT_APPROVAL_REQUESTED',
            entityType: 'ModaGptApproval',
            entityId: replacementApproval.id,
            metadata: JSON.stringify({
              taskId: input.taskId,
              traceId: input.traceId,
              toolId: 'send_quote',
              quoteId: currentQuote.id,
              replacesApprovalId: input.approvalId,
              reason: 'Quote changed after approval.'
            }),
            ipAddress: null
          }
        });
      }
      if (replacementApproval.payload !== payload || replacementApproval.status !== 'pending') {
        throw new Error('MODAGPT_APPROVAL_IDEMPOTENCY_CONFLICT');
      }
      return {
        taskId: input.taskId,
        traceId: input.traceId,
        status: 'approval_required',
        summary: '审批后报价或收件人信息发生变化；旧审批已失效，已基于当前快照创建新的发送审批。新审批通过前不会发送邮件。',
        employee: 'sales-customer-manager',
        steps: ['检测原审批快照失效', '重新读取租户内报价与客户邮箱', '创建绑定最新快照的新审批'],
        toolCalls: [],
        artifacts: [`SalesQuote:${currentQuote.id}`],
        approvalRequired: true,
        approvalId: replacementApproval.id,
        creditsUsed: 0,
        errors: []
      };
    }
    const result = execution.result as { quoteId: string; status: string; verified?: boolean };
    const expectedStatus = quoteToolId === 'send_quote' ? 'sent'
      : quoteToolId === 'submit_quote' ? 'approved' : 'draft';
    if (result.quoteId !== input.inputs.quoteId
      || result.status !== expectedStatus
      || result.verified !== true) {
      throw new Error('MODAGPT_QUOTE_ACTION_VERIFY_FAILED');
    }
    return {
      taskId: input.taskId,
      traceId: input.traceId,
      status: quoteToolId === 'send_quote' ? 'sent' : quoteToolId === 'submit_quote' ? 'approved' : 'draft_created',
      summary: quoteToolId === 'send_quote'
        ? `报价 ${result.quoteId} 已通过邮件发送并回读验证。`
        : quoteToolId === 'submit_quote'
          ? `报价 ${result.quoteId} 已完成审批后的正式提交并回读验证。`
          : `报价 ${result.quoteId} 已按审批内容修改并回读验证。`,
      employee: 'sales-customer-manager',
      steps: ['校验持久化审批及报价快照', '通过 Tool Runtime 执行报价操作', '从 RUDA 数据库重新读取并验证'],
      toolCalls: [{ toolId: quoteToolId, status: 'succeeded' }],
      artifacts: [`SalesQuote:${result.quoteId}`],
      approvalRequired: false,
      approvalId: input.approvalId,
      creditsUsed: 0,
      errors: []
    };
  }
  if (input.route.workflow === 'product_publish' && (action === 'publish' || action === 'unpublish')) {
    const toolId = action === 'publish' ? 'publish_product' : 'unpublish_product';
    await input.assertLease?.();
    const execution = await runtime.execute({
      taskId: input.taskId,
      tenantId: input.merchantId,
      agentId: 'product-creative-manager',
      toolId,
      input: { productId: input.inputs.productId, approvalId: input.approvalId }
    });
    const result = execution.result as {
      productId: string;
      lifecycleStatus: string;
      merchantId: string;
      skuCount: number;
      wholesalePrice: number;
      rrpPrice: number;
      moq: number;
      packSize: number;
      verified: boolean;
    };
    if (result.merchantId !== input.merchantId
      || result.lifecycleStatus !== (action === 'publish' ? 'published' : 'draft')
      || result.productId !== input.inputs.productId
      || !result.verified
      || !Number.isInteger(result.skuCount)
      || result.skuCount < 1
      || !Number.isFinite(result.wholesalePrice)
      || result.wholesalePrice <= 0
      || !Number.isFinite(result.rrpPrice)
      || result.rrpPrice <= 0
      || !Number.isSafeInteger(result.moq)
      || result.moq <= 0
      || !Number.isSafeInteger(result.packSize)
      || result.packSize <= 0) {
      throw new Error('MODAGPT_PRODUCT_LIFECYCLE_VERIFY_FAILED');
    }
    return {
      taskId: input.taskId,
      traceId: input.traceId,
      status: action === 'publish' ? 'published' : 'unpublished',
      summary: action === 'publish' ? `商品 ${result.productId} 已完成上架。` : `商品 ${result.productId} 已下架。`,
      employee: 'product-creative-manager',
      steps: ['读取已批准的持久化审批', '通过 Tool Runtime 执行商品状态变更', '回读并验证商家、商品和状态'],
      toolCalls: [{ toolId, status: 'succeeded' }],
      artifacts: [`Product:${result.productId}`],
      approvalRequired: false,
      approvalId: input.approvalId || null,
      creditsUsed: 0,
      errors: []
    };
  }
  const plan = createModaGptExecutionPlan({
    taskId: input.taskId,
    tenantId: input.merchantId,
    workflow: input.route.workflow,
    goal: input.route.goal,
    steps: input.route.workflow === 'product_publish'
      ? [action === 'update' ? 'validate_product_input' : 'validate_product_input', action === 'update' ? 'update_private_draft' : 'create_private_draft', 'verify_product_readback']
      : ['validate_customer_and_catalog', 'create_quote_draft', 'verify_quote_readback'],
    constraints: [
      'All tools must use the trusted merchant tenant.',
      'Never publish products, send/submit quotes, or change stock without persisted approval.',
      'Use only persisted RUDA customer, product, price and SKU facts.'
    ],
    maxReplans: 0
  });
  const context = createModaGptAgentContext({
    taskId: input.taskId,
    traceId: input.traceId,
    tenantId: input.merchantId,
    goal: plan.goal,
    constraints: [...plan.constraints],
    inputs: input.inputs
  });
  await input.assertLease?.();
  const result = await executeModaGptMerchantDraftWorkflow({
    workflow: input.route.workflow as 'product_publish' | 'customer_quote_creation',
    context,
    runtime,
    inputs: input.inputs,
    message: input.message
  });
  return {
    taskId: input.taskId,
    traceId: input.traceId,
    ...result,
    creditsUsed: 0
  };
}

function parsePermissions(serialized: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('MODAGPT_EMPLOYEE_PERMISSIONS_INVALID');
  }
  if (!Array.isArray(parsed) || parsed.some(permission => typeof permission !== 'string')) {
    throw new Error('MODAGPT_EMPLOYEE_PERMISSIONS_INVALID');
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractAnalysisPeriodDays(message: string): number {
  const match = /(?:最近|近)\s*(\d{1,3})\s*天|last\s+(\d{1,3})\s+days?/i.exec(message);
  const requested = Number(match?.[1] || match?.[2] || 30);
  return Number.isSafeInteger(requested) && requested >= 1 && requested <= 365 ? requested : 30;
}

function needsInputResult(
  input: { taskId: string; traceId: string },
  employee: ModaGptAgentRole,
  summary: string,
  steps: string[]
): ModaGptMerchantTaskResult {
  return {
    taskId: input.taskId,
    traceId: input.traceId,
    status: 'needs_input',
    summary,
    employee,
    steps,
    toolCalls: [],
    artifacts: [],
    approvalRequired: false,
    approvalId: null,
    creditsUsed: 0,
    errors: []
  };
}

async function isModaGptProductReadyToPublish(
  prisma: PrismaClient,
  merchantId: string,
  product: {
    category: string;
    wholesalePrice: unknown;
    rrpPrice: unknown;
    moq: number;
    packSize: number;
    skus: string;
    images: string;
    media: string | null;
  }
): Promise<boolean> {
  const category = await prisma.merchantStoreCategory.findFirst({
    where: { merchantId, slug: product.category, isActive: true },
    select: { id: true }
  });
  if (!category
    || !Number.isFinite(Number(product.wholesalePrice))
    || Number(product.wholesalePrice) <= 0
    || !Number.isFinite(Number(product.rrpPrice))
    || Number(product.rrpPrice) <= 0
    || product.moq <= 0
    || product.packSize <= 0) return false;
  try {
    const skus: unknown = JSON.parse(product.skus);
    const images: unknown = JSON.parse(product.images);
    const media: unknown = product.media ? JSON.parse(product.media) : [];
    if (!Array.isArray(skus)
      || !skus.length
      || !skus.every((sku: unknown) => isModaGptRecord(sku)
        && typeof sku.sku === 'string'
        && Boolean(sku.sku.trim()))
      || !Array.isArray(images)
      || !images.some(image => typeof image === 'string' && Boolean(image.trim()))
      || !Array.isArray(media)) return false;
    return media.length === 0 || media.some((item: unknown) => isModaGptRecord(item)
      && item.type === 'image'
      && typeof item.url === 'string'
      && Boolean(item.url.trim()));
  } catch {
    return false;
  }
}

function isModaGptRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
