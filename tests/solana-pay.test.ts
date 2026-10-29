import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateSolanaCommissionSplit,
  createSolanaPayUrl,
  createSolanaTokenQuote,
  normalizeSolanaWalletAddress
} from '../src/payment/solanaPay';

test('quotes Solana stablecoin amounts to six decimal places', () => {
  const quote = createSolanaTokenQuote(123.45, 'USDC', 1.08, 'test-rate', new Date('2026-01-01T00:00:00Z'));

  assert.equal(quote.tokenAmount, '133.326000');
  assert.equal(quote.amountAtomic, '133326000');
  assert.equal(quote.tokenSymbol, 'USDC');
});

test('EURC quote uses the supplied EUR parity rate', () => {
  const quote = createSolanaTokenQuote(12.34, 'EURC', 1, 'EURC/EUR nominal parity', new Date('2026-01-01T00:00:00Z'));

  assert.equal(quote.tokenAmount, '12.340000');
  assert.equal(quote.amountAtomic, '12340000');
});

test('splits the exact token amount into merchant proceeds and commission', () => {
  const split = calculateSolanaCommissionSplit('100000000', '0.02');

  assert.equal(split.merchantAmountAtomic, '98000000');
  assert.equal(split.commissionAmountAtomic, '2000000');
  assert.equal(
    BigInt(split.merchantAmountAtomic) + BigInt(split.commissionAmountAtomic),
    100000000n
  );
});

test('rejects a commission that rounds to zero token units', () => {
  assert.throws(() => calculateSolanaCommissionSplit('12', '0.02'), /SOLANA_COMMISSION_AMOUNT_INVALID/);
});

test('normalizes valid wallet addresses and rejects malformed values', () => {
  assert.equal(normalizeSolanaWalletAddress('11111111111111111111111111111111'), '11111111111111111111111111111111');
  assert.throws(() => normalizeSolanaWalletAddress('not-a-wallet'), /SOLANA_WALLET_ADDRESS_INVALID/);
});

test('creates a Solana Pay request URI only for HTTPS transaction endpoints', () => {
  const uri = createSolanaPayUrl({
    requestUrl: 'https://ruda.fashion/api/payments/solana/request/secure-token',
    orderNo: 'RUDA-123'
  });

  assert.ok(uri.startsWith('solana:'));
  assert.ok(uri.includes('ruda.fashion/api/payments/solana/request/secure-token'));
  assert.throws(() => createSolanaPayUrl({ requestUrl: 'http://ruda.fashion/request', orderNo: 'RUDA-123' }), /SOLANA_TRANSACTION_REQUEST_URL_INVALID/);
});
