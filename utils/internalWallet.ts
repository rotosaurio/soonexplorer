import { Keypair } from '@solana/web3.js';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';

const INTERNAL_WALLET_PRIVATE_KEY = new Uint8Array([
  72,232,185,102,138,155,230,26,57,57,85,246,78,63,198,23,
  65,191,191,225,251,202,13,229,23,210,243,243,52,136,42,170,
  248,215,1,155,88,206,37,147,45,209,45,37,249,221,18,166,
  67,82,186,140,42,31,15,254,45,85,1,135,99,112,236,143
]);

export const getInternalWallet = () => {
  const web3Keypair = Keypair.fromSecretKey(INTERNAL_WALLET_PRIVATE_KEY);
  return fromWeb3JsKeypair(web3Keypair);
};

export const setupUmiWithInternalWallet = (umi: ReturnType<typeof createUmi>) => {
  const internalWallet = getInternalWallet();
  return umi.use(keypairIdentity(internalWallet));
};

export const getInternalWalletPublicKey = () => {
  const web3Keypair = Keypair.fromSecretKey(INTERNAL_WALLET_PRIVATE_KEY);
  return web3Keypair.publicKey;
}; 