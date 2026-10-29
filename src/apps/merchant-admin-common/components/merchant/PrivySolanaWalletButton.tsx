import React, { useState } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { useCreateWallet, useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || 'cmuka952h01hm0dl6ndm4m8x7';

const WalletConnectButton: React.FC<{
  disabled: boolean;
  onWalletAddress: (address: string) => void;
}> = ({ disabled, onWalletAddress }) => {
  const { ready, authenticated, login, user } = usePrivy();
  const { ready: walletsReady } = useSolanaWallets();
  const { createWallet } = useCreateWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const connectWallet = async () => {
    setError('');
    if (!ready || !walletsReady) {
      setError('Privy 钱包服务正在初始化，请稍后重试。');
      return;
    }
    if (!authenticated) {
      login();
      return;
    }
    setBusy(true);
    try {
      const existingWallet = user?.linkedAccounts.find(account =>
        account.type === 'wallet' &&
        account.chainType === 'solana' &&
        account.walletClientType === 'privy'
      );
      const address = existingWallet?.type === 'wallet'
        ? existingWallet.address
        : (await createWallet()).wallet.address;
      onWalletAddress(address);
    } catch (walletError) {
      setError(walletError instanceof Error ? walletError.message : '无法创建或读取 Privy Solana 钱包。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void connectWallet()}
        disabled={disabled || busy || !ready}
        className="h-10 rounded-lg border border-violet-300 bg-white px-4 text-xs font-semibold text-violet-900 disabled:opacity-50"
      >
        {busy ? '创建/读取中…' : !ready ? 'Privy 初始化中…' : authenticated ? '获取 Privy 嵌入式钱包' : '登录 Privy'}
      </button>
      {error && <p role="alert" className="text-[10px] leading-4 text-rose-700 sm:col-span-3">{error}</p>}
    </>
  );
};

// Privy only backs this optional "create an embedded wallet" convenience button, so it is code-split
// and mounted on demand here instead of wrapping the whole app. Wrapping the whole app previously
// forced every page on every domain (including the platform admin backend) to boot the Privy/Coinbase/
// Base wallet SDKs and their auth iframe on load, which fails outside Privy's allow-listed domains and
// surfaced as CSP "frame-ancestors" errors and uncaught exceptions unrelated to the current page.
const PrivySolanaWalletButton: React.FC<{
  disabled: boolean;
  onWalletAddress: (address: string) => void;
}> = ({ disabled, onWalletAddress }) => (
  <PrivyProvider appId={PRIVY_APP_ID} config={{ embeddedWallets: { solana: { createOnLogin: 'off' } } }}>
    <WalletConnectButton disabled={disabled} onWalletAddress={onWalletAddress} />
  </PrivyProvider>
);

export default PrivySolanaWalletButton;
