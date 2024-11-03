import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { Analytics } from "@vercel/analytics/react"
import Head from 'next/head'

require('@solana/wallet-adapter-react-ui/styles.css');

const WalletModalProviderDynamic = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletModalProvider),
  { ssr: false }
);

export default function App({ Component, pageProps }: AppProps) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = "https://rpc.devnet.soo.network/rpc";
  const wallets = [new PhantomWalletAdapter()];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProviderDynamic>
          <Head>
            <title>SoonX</title>
          </Head>
          <Component {...pageProps} />
          <Analytics />
        </WalletModalProviderDynamic>
      </WalletProvider>
    </ConnectionProvider>
  );
}
