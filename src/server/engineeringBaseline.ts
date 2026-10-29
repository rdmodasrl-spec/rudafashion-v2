import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';

export const defaultBusinessStates = [
  'draft',
  'pending',
  'approved',
  'active',
  'paused',
  'archived',
  'rejected',
  'cancelled',
  'failed',
  'retry'
] as const;

export type BusinessState = (typeof defaultBusinessStates)[number];

export type TenantScopeInput = string | null | undefined;

export interface BusinessErrorOptions {
  details?: Record<string, unknown>;
  retryable?: boolean;
  statusCode?: number;
}

export class BusinessError extends Error {
  code: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  statusCode: number;

  constructor(code: string, message: string, options: BusinessErrorOptions = {}) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
    this.statusCode = options.statusCode ?? 400;
  }
}

export class ValidationError extends BusinessError {
  constructor(message = 'Request validation failed', details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, { details, statusCode: 400 });
  }
}

export class PermissionError extends BusinessError {
  constructor(message = 'You do not have permission to perform this action') {
    super('FORBIDDEN', message, { statusCode: 403 });
  }
}

export class TenantError extends BusinessError {
  constructor(message = 'Tenant scope mismatch', code = 'TENANT_SCOPE_MISMATCH') {
    super(code, message, { statusCode: 403 });
  }
}

export class StateTransitionError extends BusinessError {
  constructor(fromState: string, toState: string) {
    super('STATE_TRANSITION_INVALID', `Transition from ${fromState} to ${toState} is not allowed`, { statusCode: 409 });
  }
}

export class NotFoundError extends BusinessError {
  constructor(message = 'Resource not found') {
    super('NOT_FOUND', message, { statusCode: 404 });
  }
}

export class ConflictError extends BusinessError {
  constructor(message = 'The request conflicts with the current resource state') {
    super('CONFLICT', message, { statusCode: 409 });
  }
}

export class ExternalProviderError extends BusinessError {
  constructor(message = 'An external service is temporarily unavailable', retryable = true) {
    super('EXTERNAL_PROVIDER_ERROR', message, { retryable, statusCode: 502 });
  }
}

export class InternalError extends BusinessError {
  constructor() {
    super('INTERNAL_ERROR', 'An unexpected error occurred', { statusCode: 500 });
  }
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
  requestId: string;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface AuditEventInput {
  eventName: string;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  merchantId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  beforeState?: BusinessState | string | null;
  afterState?: BusinessState | string | null;
  result?: 'success' | 'failure' | 'skipped' | string;
  errorCode?: string | null;
  errorMessage?: string | null;
  requestId?: string;
  correlationId?: string | null;
  details?: Record<string, unknown>;
}

export interface AuditEvent extends AuditEventInput {
  timestamp: string;
}

export interface PersistedAuditContext {
  id: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditRequestContext {
  requestId: string;
  ip?: string | null;
  userAgent?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  merchantId?: string | null;
}

const auditRequestContext = new AsyncLocalStorage<AuditRequestContext>();

export function runWithAuditRequestContext<T>(context: AuditRequestContext, callback: () => T): T {
  return auditRequestContext.run(context, callback);
}

export function getAuditRequestContext(): AuditRequestContext | undefined {
  return auditRequestContext.getStore();
}

export function updateAuditRequestContext(context: Partial<Omit<AuditRequestContext, 'requestId'>>): void {
  const current = auditRequestContext.getStore();
  if (current) Object.assign(current, context);
}

export const stateTransitionMap: Record<BusinessState, BusinessState[]> = {
  draft: ['pending', 'rejected', 'cancelled'],
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['active', 'rejected', 'cancelled'],
  active: ['paused', 'archived', 'failed'],
  paused: ['active', 'archived', 'failed'],
  archived: [],
  rejected: [],
  cancelled: [],
  failed: ['retry', 'archived'],
  retry: ['pending', 'failed', 'cancelled']
};

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function createSuccessEnvelope<T>(data: T, requestId = createRequestId()): SuccessEnvelope<T> {
  return {
    success: true,
    data,
    requestId
  };
}

export function createErrorEnvelope(
  error: BusinessError | Error,
  requestId = createRequestId()
): ErrorEnvelope {
  const businessError = error instanceof BusinessError
    ? error
    : new BusinessError('INTERNAL_ERROR', 'An unexpected error occurred', { statusCode: 500 });

  return {
    success: false,
    error: {
      code: businessError.code,
      message: String(redactAuditData(businessError.message)),
      retryable: businessError.retryable,
      ...(businessError.details ? { details: redactAuditData(businessError.details) as Record<string, unknown> } : {})
    },
    requestId
  };
}

export function assertTenantScope(
  actualTenantId: TenantScopeInput,
  expectedTenantId: TenantScopeInput,
  options: { code?: string; message?: string } = {}
): void {
  const code = options.code ?? 'TENANT_SCOPE_MISMATCH';
  const message = options.message ?? 'Tenant scope mismatch';

  if (!actualTenantId || !expectedTenantId || actualTenantId !== expectedTenantId) {
    throw new TenantError(message, code);
  }
}

export function canTransitionState(
  fromState: BusinessState | string,
  toState: BusinessState | string,
  explicitTransitions: Record<string, readonly string[]> = {}
): boolean {
  const from = fromState as BusinessState;
  const to = toState as BusinessState;

  if (explicitTransitions[fromState]?.includes(toState)) return true;
  if (!defaultBusinessStates.includes(from as BusinessState) || !defaultBusinessStates.includes(to as BusinessState)) {
    return false;
  }

  return stateTransitionMap[from].includes(to);
}

export function createAuditEvent(input: AuditEventInput): AuditEvent {
  return {
    eventName: input.eventName,
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
    actorRole: input.actorRole ?? null,
    merchantId: input.merchantId ?? null,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    beforeState: input.beforeState ?? null,
    afterState: input.afterState ?? null,
    result: input.result ?? 'success',
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage
      ? String(redactAuditData(input.errorMessage))
      : null,
    requestId: input.requestId ?? createRequestId(),
    correlationId: input.correlationId ?? input.requestId ?? null,
    details: redactAuditData(input.details ?? {}) as Record<string, unknown>,
    timestamp: new Date().toISOString()
  };
}

export function buildPersistedAuditRecord(event: AuditEvent, context: PersistedAuditContext) {
  return {
    id: context.id,
    userId: event.actorId || 'system',
    userName: event.actorName || event.actorId || 'System',
    role: event.actorRole || 'system',
    action: event.eventName,
    entity: event.targetType || 'unknown',
    entityId: event.targetId || 'unknown',
    oldValue: event.beforeState ?? null,
    newValue: event.afterState ?? null,
    timestamp: new Date(event.timestamp),
    ip: context.ip || null,
    requestId: event.requestId || null,
    merchantId: event.merchantId || null,
    targetType: event.targetType || null,
    beforeState: event.beforeState ?? null,
    afterState: event.afterState ?? null,
    result: event.result || 'success',
    errorCode: event.errorCode || null,
    metadata: JSON.stringify(redactAuditData({
      correlationId: event.correlationId,
      details: event.details || {},
      errorMessage: event.errorMessage || null,
      userAgent: context.userAgent || null
    }))
  };
}

export function redactAuditData(value: unknown, key = ''): unknown {
  if (/password|secret|token|authorization|cookie|email|phone|address|credential/i.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map(item => redactAuditData(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      redactAuditData(entryValue, entryKey)
    ]));
  }
  if (typeof value !== 'string') return value;
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b(api[_-]?key|secret|password|token)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/(?<!\w)\+?\d[\d\s().-]{7,}\d(?!\w)/g, '[REDACTED_PHONE]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]');
}

export function getHttpStatusForError(error: unknown): number {
  return error instanceof BusinessError ? error.statusCode : 500;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof BusinessError) {
    return error.retryable;
  }

  return false;
}
