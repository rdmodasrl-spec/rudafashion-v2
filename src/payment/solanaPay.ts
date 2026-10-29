import BigNumber from 'bignumber.js';
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAccount, getAssociatedTokenAddress, getMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { encodeURL } from '@solana/pay';
import { Connection, Keypair, PublicKey, Transaction, type TransactionSignature } from '@solana/web3.js';

export const SOLANA_TOKEN_MINTS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  EURC: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr'
} as const;

export type SolanaTokenSymbol = keyof typeof SOLANA_TOKEN_MINTS;

const TOKEN_SCALE = new BigNumber(1_000_000);
const MAX_FX_RATE_AGE_SECONDS = 36 * 60 * 60;
const SOLANA_MAINNET_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
let mainnetVerifiedAt = 0;
let mainnetVerifiedRpc = '';
let mainnetVerification: Promise<void> | null = null;

export interface SolanaTokenQuote {
  tokenSymbol: SolanaTokenSymbol;
  mint: string;
  exchangeRate: string;
  exchangeRateSource: string;
  exchangeRateUpdatedAt: Date;
  tokenAmount: string;
  amountAtomic: string;
}

export interface SolanaCommissionSplit {
  commissionRate: string;
  merchantAmountAtomic: string;
  commissionAmountAtomic: string;
  merchantAmount: string;
  commissionAmount: string;
}

export function normalizeSolanaWalletAddress(value: string): string {
  try {
    const publicKey = new PublicKey(value.trim());
    const address = publicKey.toBase58();
    if (address !== value.trim()) throw new Error('SOLANA_WALLET_ADDRESS_INVALID');
    return address;
  } catch {
    throw new Error('SOLANA_WALLET_ADDRESS_INVALID');
  }
}

export function getSolanaPlatformWalletAddress(): string {
  const value = process.env.SOLANA_PLATFORM_WALLET_ADDRESS?.trim();
  if (!value) throw new Error('SOLANA_PLATFORM_WALLET_NOT_CONFIGURED');
  return normalizeSolanaWalletAddress(value);
}

export function getSolanaConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim();
  if (!rpcUrl) throw new Error('SOLANA_RPC_NOT_CONFIGURED');
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rpcUrl);
  } catch {
    throw new Error('SOLANA_RPC_URL_INVALID');
  }
  if (
    (parsedUrl.protocol !== 'https:' && !(parsedUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsedUrl.hostname))) ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error('SOLANA_RPC_URL_INVALID');
  }
  return new Connection(rpcUrl, 'confirmed');
}

export async function assertSolanaMainnet(): Promise<void> {
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || '';
  if (rpcUrl === mainnetVerifiedRpc && Date.now() - mainnetVerifiedAt < 5 * 60 * 1000) return;
  if (rpcUrl !== mainnetVerifiedRpc) {
    mainnetVerifiedRpc = rpcUrl;
    mainnetVerifiedAt = 0;
    mainnetVerification = null;
  }
  if (!mainnetVerification) {
    mainnetVerification = getSolanaConnection().getGenesisHash().then(genesisHash => {
      if (genesisHash !== SOLANA_MAINNET_GENESIS_HASH) throw new Error('SOLANA_RPC_NOT_MAINNET');
      mainnetVerifiedAt = Date.now();
    }).catch(error => {
      mainnetVerification = null;
      throw error;
    });
  }
  await mainnetVerification;
}

export function createSolanaTokenQuote(
  eurAmount: number,
  tokenSymbol: SolanaTokenSymbol,
  rate: number,
  source: string,
  rateUpdatedAt: Date
): SolanaTokenQuote {
  if (!Number.isFinite(eurAmount) || eurAmount <= 0) throw new Error('SOLANA_ORDER_AMOUNT_INVALID');
  if (!Number.isFinite(rate) || rate <= 0 || rate > 10) throw new Error('SOLANA_EXCHANGE_RATE_INVALID');
  if (!source || source.length > 64 || Number.isNaN(rateUpdatedAt.getTime())) throw new Error('SOLANA_EXCHANGE_RATE_INVALID');

  const amountAtomic = new BigNumber(eurAmount)
    .multipliedBy(rate)
    .decimalPlaces(6, BigNumber.ROUND_HALF_UP)
    .multipliedBy(TOKEN_SCALE)
    .toFixed(0);
  if (!/^[1-9]\d*$/.test(amountAtomic)) throw new Error('SOLANA_ORDER_AMOUNT_INVALID');

  return {
    tokenSymbol,
    mint: SOLANA_TOKEN_MINTS[tokenSymbol],
    exchangeRate: new BigNumber(rate).toFixed(10),
    exchangeRateSource: source,
    exchangeRateUpdatedAt: rateUpdatedAt,
    tokenAmount: new BigNumber(amountAtomic).dividedBy(TOKEN_SCALE).toFixed(6),
    amountAtomic
  };
}

export function calculateSolanaCommissionSplit(amountAtomic: string, commissionRate: string): SolanaCommissionSplit {
  if (!/^[1-9]\d*$/.test(amountAtomic)) throw new Error('SOLANA_ORDER_AMOUNT_INVALID');
  const rate = new BigNumber(commissionRate);
  const basisPoints = rate.multipliedBy(10_000);
  if (!rate.isFinite() || rate.isNegative() || rate.gt(0.2) || !basisPoints.isInteger()) {
    throw new Error('SOLANA_COMMISSION_RATE_INVALID');
  }
  const grossAtomic = BigInt(amountAtomic);
  const commissionAtomic = (grossAtomic * BigInt(basisPoints.toFixed(0)) + 5_000n) / 10_000n;
  const merchantAtomic = grossAtomic - commissionAtomic;
  if (commissionAtomic <= 0n || merchantAtomic <= 0n) throw new Error('SOLANA_COMMISSION_AMOUNT_INVALID');
  return {
    commissionRate: rate.toFixed(4),
    merchantAmountAtomic: merchantAtomic.toString(),
    commissionAmountAtomic: commissionAtomic.toString(),
    merchantAmount: new BigNumber(merchantAtomic.toString()).dividedBy(TOKEN_SCALE).toFixed(6),
    commissionAmount: new BigNumber(commissionAtomic.toString()).dividedBy(TOKEN_SCALE).toFixed(6)
  };
}

export async function fetchLatestEurUsdRate(now = Date.now()): Promise<{ rate: number; source: string; updatedAt: Date }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/EUR', { signal: controller.signal });
    if (!response.ok) throw new Error(`SOLANA_EXCHANGE_RATE_HTTP_${response.status}`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object') throw new Error('SOLANA_EXCHANGE_RATE_RESPONSE_INVALID');
    const data = payload as { result?: unknown; base_code?: unknown; rates?: { USD?: unknown }; time_last_update_unix?: unknown };
    const timestampSeconds = Number(data.time_last_update_unix);
    const rate = Number(data.rates?.USD);
    if (
      data.result !== 'success' ||
      data.base_code !== 'EUR' ||
      !Number.isFinite(timestampSeconds) ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      rate > 10
    ) {
      throw new Error('SOLANA_EXCHANGE_RATE_RESPONSE_INVALID');
    }
    const ageSeconds = Math.floor(now / 1000) - timestampSeconds;
    if (ageSeconds < -300 || ageSeconds > MAX_FX_RATE_AGE_SECONDS) throw new Error('SOLANA_EXCHANGE_RATE_STALE');
    return { rate, source: 'open.er-api.com', updatedAt: new Date(timestampSeconds * 1000) };
  } finally {
    clearTimeout(timeout);
  }
}

export function createSolanaPayUrl(input: {
  requestUrl: string;
  orderNo: string;
}): string {
  const requestUrl = new URL(input.requestUrl);
  if (requestUrl.protocol !== 'https:') throw new Error('SOLANA_TRANSACTION_REQUEST_URL_INVALID');
  return encodeURL({
    link: requestUrl,
    label: 'RUDA',
    message: `Order ${input.orderNo}`
  }).toString();
}

export async function createSolanaSplitTransaction(input: {
  payer: PublicKey;
  recipient: string;
  platformWallet: string;
  reference: string;
  mint: string;
  merchantAmountAtomic: string;
  commissionAmountAtomic: string;
}): Promise<Transaction> {
  const connection = getSolanaConnection();
  const recipient = new PublicKey(input.recipient);
  const platformWallet = new PublicKey(input.platformWallet);
  const mintAddress = new PublicKey(input.mint);
  const reference = new PublicKey(input.reference);
  const mint = await getMint(connection, mintAddress, 'confirmed', TOKEN_PROGRAM_ID);
  if (!mint.isInitialized || mint.decimals !== 6) throw new Error('SOLANA_STABLECOIN_MINT_INVALID');

  const payerAccount = await getAccount(
    connection,
    await getAssociatedTokenAddress(mintAddress, input.payer, false, TOKEN_PROGRAM_ID),
    'confirmed',
    TOKEN_PROGRAM_ID
  );
  const grossAmount = BigInt(input.merchantAmountAtomic) + BigInt(input.commissionAmountAtomic);
  if (!payerAccount.isInitialized || payerAccount.isFrozen || payerAccount.amount < grossAmount) {
    throw new Error('SOLANA_BUYER_TOKEN_BALANCE_INSUFFICIENT');
  }

  const merchantAta = await getAssociatedTokenAddress(mintAddress, recipient, false, TOKEN_PROGRAM_ID);
  const platformAta = await getAssociatedTokenAddress(mintAddress, platformWallet, false, TOKEN_PROGRAM_ID);
  const recipientAccounts = await connection.getMultipleAccountsInfo([merchantAta, platformAta], 'confirmed');
  const transaction = new Transaction();
  transaction.feePayer = input.payer;
  transaction.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
  if (!recipientAccounts[0]) {
    transaction.add(createAssociatedTokenAccountIdempotentInstruction(
      input.payer, merchantAta, recipient, mintAddress, TOKEN_PROGRAM_ID
    ));
  }
  if (!recipientAccounts[1]) {
    transaction.add(createAssociatedTokenAccountIdempotentInstruction(
      input.payer, platformAta, platformWallet, mintAddress, TOKEN_PROGRAM_ID
    ));
  }
  const merchantTransfer = createTransferCheckedInstruction(
    payerAccount.address,
    mintAddress,
    merchantAta,
    input.payer,
    BigInt(input.merchantAmountAtomic),
    mint.decimals,
    [],
    TOKEN_PROGRAM_ID
  );
  const commissionTransfer = createTransferCheckedInstruction(
    payerAccount.address,
    mintAddress,
    platformAta,
    input.payer,
    BigInt(input.commissionAmountAtomic),
    mint.decimals,
    [],
    TOKEN_PROGRAM_ID
  );
  merchantTransfer.keys.push({ pubkey: reference, isWritable: false, isSigner: false });
  commissionTransfer.keys.push({ pubkey: reference, isWritable: false, isSigner: false });
  transaction.add(merchantTransfer, commissionTransfer);
  return transaction;
}

export async function findVerifiedSolanaSplitTransfer(input: {
  recipient: string;
  platformWallet: string;
  reference: string;
  mint: string;
  merchantAmountAtomic: string;
  commissionAmountAtomic: string;
}): Promise<{ signature: TransactionSignature; blockTime: number | null } | { invalidTransactionFound: true } | null> {
  const connection = getSolanaConnection();
  const recipient = new PublicKey(input.recipient);
  const platformWallet = new PublicKey(input.platformWallet);
  const mint = new PublicKey(input.mint);
  const reference = new PublicKey(input.reference);
  const signatures = await connection.getSignaturesForAddress(reference, { limit: 20 }, 'confirmed');
  let invalidTransactionFound = false;

  for (const entry of signatures) {
    if (entry.err) {
      invalidTransactionFound = true;
      continue;
    }
    const transaction = await connection.getTransaction(entry.signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });
    if (!transaction?.meta || transaction.meta.err) {
      invalidTransactionFound = true;
      continue;
    }
    const message = transaction.transaction.message;
    const keys = message.getAccountKeys({
      accountKeysFromLookups: transaction.meta.loadedAddresses || undefined
    }).keySegments().flat();
    if (!keys.some(key => key.equals(reference))) {
      invalidTransactionFound = true;
      continue;
    }
    const merchantAta = await getAssociatedTokenAddress(mint, recipient, false, TOKEN_PROGRAM_ID);
    const platformAta = await getAssociatedTokenAddress(mint, platformWallet, false, TOKEN_PROGRAM_ID);
    const tokenDelta = (address: PublicKey): bigint => {
      const accountIndex = keys.findIndex(key => key.equals(address));
      if (accountIndex < 0) return 0n;
      const preAmount = transaction.meta!.preTokenBalances?.find(balance =>
        balance.accountIndex === accountIndex && balance.mint === mint.toBase58()
      )?.uiTokenAmount.amount || '0';
      const postAmount = transaction.meta!.postTokenBalances?.find(balance =>
        balance.accountIndex === accountIndex && balance.mint === mint.toBase58()
      )?.uiTokenAmount.amount || '0';
      return BigInt(postAmount) - BigInt(preAmount);
    };
    if (
      tokenDelta(merchantAta) === BigInt(input.merchantAmountAtomic) &&
      tokenDelta(platformAta) === BigInt(input.commissionAmountAtomic)
    ) {
      return { signature: entry.signature, blockTime: transaction.blockTime ?? null };
    }
    invalidTransactionFound = true;
  }

  return invalidTransactionFound ? { invalidTransactionFound: true } : null;
}

export function createSolanaReference(): string {
  return Keypair.generate().publicKey.toBase58();
}
