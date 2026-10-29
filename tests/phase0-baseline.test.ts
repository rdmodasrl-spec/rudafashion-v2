import test from 'node:test';
import assert from 'node:assert/strict';
import 'express-async-errors';
import express from 'express';
import type { AddressInfo } from 'node:net';

import {
  BusinessError,
  buildPersistedAuditRecord,
  createAuditEvent,
  assertTenantScope,
  canTransitionState,
  createErrorEnvelope,
  createSuccessEnvelope,
  defaultBusinessStates,
  getAuditRequestContext,
  getHttpStatusForError,
  runWithAuditRequestContext,
  updateAuditRequestContext
} from '../src/server/engineeringBaseline';

test('assertTenantScope rejects cross-tenant access', () => {
  assert.throws(() => {
    assertTenantScope('merchant-1', 'merchant-2');
  }, /tenant/i);
  assert.throws(() => {
    assertTenantScope('merchant-1', 'merchant-2', { code: 'COMPANY_MERCHANT_FORBIDDEN' });
  }, error => error instanceof Error && 'code' in error && error.code === 'COMPANY_MERCHANT_FORBIDDEN');
});

test('createErrorEnvelope wraps business errors consistently', () => {
  const envelope = createErrorEnvelope(new BusinessError('FORBIDDEN', 'No access', { retryable: false }));

  assert.equal(envelope.success, false);
  assert.equal(envelope.error.code, 'FORBIDDEN');
  assert.equal(envelope.error.message, 'No access');
  assert.equal(envelope.error.retryable, false);
  const redacted = createErrorEnvelope(new BusinessError(
    'PROVIDER_FAILURE',
    'Unable to reach person@example.com at +39 333 123 4567'
  ));
  assert.equal(redacted.error.message, 'Unable to reach [REDACTED_EMAIL] at [REDACTED_PHONE]');
});

test('createErrorEnvelope never exposes internal error details', () => {
  const envelope = createErrorEnvelope(new Error('postgres://user:secret@db.internal/app'));

  assert.equal(envelope.error.code, 'INTERNAL_ERROR');
  assert.equal(envelope.error.message, 'An unexpected error occurred');
  assert.equal(envelope.error.details, undefined);
  assert.equal(getHttpStatusForError(new Error('private stack')), 500);
});

test('standard states allow expected transitions', () => {
  assert.equal(canTransitionState('draft', 'pending'), true);
  assert.equal(canTransitionState('pending', 'approved'), true);
  assert.equal(canTransitionState('approved', 'active'), true);
  assert.equal(canTransitionState('active', 'paused'), true);
  assert.equal(canTransitionState('paused', 'active'), true);
  assert.equal(canTransitionState('active', 'archived'), true);
  assert.equal(canTransitionState('failed', 'retry'), true);
  assert.equal(canTransitionState('retry', 'pending'), true);
  assert.equal(canTransitionState('draft', 'active'), false);
  assert.equal(canTransitionState('failed', 'pending'), false);
  assert.equal(canTransitionState('archived', 'active'), false);
  assert.equal(canTransitionState('requested', 'active'), false);
  assert.equal(canTransitionState('requested', 'active', { requested: ['active', 'declined'] }), true);
  assert.equal(canTransitionState('requested', 'declined', { requested: ['active', 'declined'] }), true);
  assert.equal(canTransitionState('active', 'requested', { requested: ['active', 'declined'] }), false);
});

test('audit events include request context and role metadata', () => {
  const event = createAuditEvent({
    eventName: 'ai.employee.approve',
    actorId: 'admin-1',
    actorName: 'Admin One',
    actorRole: 'admin',
    merchantId: 'merchant-1',
    targetType: 'ai_employee_installation',
    targetId: 'install-1',
    beforeState: 'pending',
    afterState: 'active',
    result: 'success'
  });

  assert.equal(event.eventName, 'ai.employee.approve');
  assert.equal(event.actorName, 'Admin One');
  assert.equal(event.actorRole, 'admin');
  assert.equal(event.merchantId, 'merchant-1');
  assert.equal(event.result, 'success');
  const sensitiveEvent = createAuditEvent({
    eventName: 'auth.login',
    errorCode: 'PROVIDER_UNAVAILABLE',
    errorMessage: 'Provider failed for person@example.com at +39 333 123 4567',
    details: { email: 'person@example.com', authorization: 'Bearer private-token', note: 'Contact person@example.com, +39 333 123 4567' }
  });
  assert.equal(sensitiveEvent.details?.email, '[REDACTED]');
  assert.equal(sensitiveEvent.details?.authorization, '[REDACTED]');
  assert.equal(sensitiveEvent.details?.note, 'Contact [REDACTED_EMAIL], [REDACTED_PHONE]');
  assert.equal(sensitiveEvent.errorMessage, 'Provider failed for [REDACTED_EMAIL] at [REDACTED_PHONE]');
  assert.equal(event.beforeState, 'pending');

  const persisted = buildPersistedAuditRecord(sensitiveEvent, {
    id: 'audit-1',
    ip: '192.0.2.1',
    userAgent: 'Browser/1.0'
  });
  assert.equal(persisted.requestId, sensitiveEvent.requestId);
  assert.equal(persisted.userName, 'System');
  assert.equal(persisted.errorCode, 'PROVIDER_UNAVAILABLE');
  assert.equal(persisted.ip, '192.0.2.1');
  assert.equal(JSON.parse(persisted.metadata).details.authorization, '[REDACTED]');
  assert.equal(JSON.parse(persisted.metadata).userAgent, 'Browser/1.0');
  assert.equal(JSON.parse(persisted.metadata).errorMessage, sensitiveEvent.errorMessage);
});

test('success envelope includes standard metadata', () => {
  const envelope = createSuccessEnvelope({ ok: true });

  assert.equal(envelope.success, true);
  assert.equal(envelope.data.ok, true);
  assert.ok(typeof envelope.requestId === 'string');
});

test('audit request context preserves request and actor data across concurrent async flows', async () => {
  const results = await Promise.all(['request-a', 'request-b'].map(requestId =>
    runWithAuditRequestContext({ requestId, ip: '127.0.0.1' }, async () => {
      await Promise.resolve();
      updateAuditRequestContext({ actorId: requestId, actorRole: 'merchant', merchantId: `tenant-${requestId}` });
      const context = getAuditRequestContext();
      return {
        requestId: context?.requestId,
        actorId: context?.actorId,
        merchantId: context?.merchantId
      };
    })
  ));

  assert.deepEqual(results, [
    { requestId: 'request-a', actorId: 'request-a', merchantId: 'tenant-request-a' },
    { requestId: 'request-b', actorId: 'request-b', merchantId: 'tenant-request-b' }
  ]);
  assert.equal(getAuditRequestContext(), undefined);
});

test('Express 4 forwards rejected async handlers to the error boundary', async () => {
  const app = express();
  app.get('/failure', async () => {
    throw new Error('private database connection details');
  });
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json(createErrorEnvelope(error instanceof Error ? error : new Error('Unexpected error'), 'request-test'));
  });
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/failure`);
    const body = await response.json() as ReturnType<typeof createErrorEnvelope>;
    assert.equal(response.status, 500);
    assert.equal(body.requestId, 'request-test');
    assert.equal(body.error.message, 'An unexpected error occurred');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
