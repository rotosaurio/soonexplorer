import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, Connection, Transaction, SystemProgram, PublicKey } from '@solana/web3.js';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { percentAmount, generateSigner, some, publicKey } from "@metaplex-foundation/umi";
import { createSignerFromWalletAdapter } from '@metaplex-foundation/umi-signer-wallet-adapters';
import axios from 'axios';
import Button from './Button';
import NftForm, { NftFormData } from './NftForm';

const MINTING_CONFIG = {
  FREE_NFT_COST: 0,
  PAID_NFT_COST: 0.05 * LAMPORTS_PER_SOL,
  COLLECTION_NFT_COST: 0.025 * LAMPORTS_PER_SOL,
  COLLECTION_CREATION_COST: 0.1 * LAMPORTS_PER_SOL,
  FREE_MINT_COOLDOWN_HOURS: 24,
};

interface NftMinterProps {
  onClose: () => void;
}

async function umiSwitchToSoonDevnet(umi: any) {
  umi.programs.add({
    name: "mplTokenMetadata",
    publicKey: publicKey("6C4GR9AtMGF25sjXKtdB7A6NVQUudEQWw97kG61pGuA1"),
    getErrorFromCode: () => null,
    getErrorFromName: () => null,
    isOnCluster: () => true,
  }, true);
}

const handleImageUpload = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`
        }
      }
    );

    return response.data.IpfsHash;
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Error uploading image');
  }
};

export default function NftMinter({ onClose }: NftMinterProps) {
  const wallet = useWallet();
  const [balance, setBalance] = useState<number>(0);
  const [lastFreeMint, setLastFreeMint] = useState<number | null>(null);
  const [freeMintAvailable, setFreeMintAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nftMintAddress, setNftMintAddress] = useState<string>('');

  const checkFreeMintAvailability = (lastMintTime: number) => {
    const hoursElapsed = (Date.now() - lastMintTime) / (1000 * 60 * 60);
    setFreeMintAvailable(hoursElapsed >= MINTING_CONFIG.FREE_MINT_COOLDOWN_HOURS);
  };

  const calculateMintCost = (isCollection: boolean = false): number => {
    if (!isCollection && freeMintAvailable) return MINTING_CONFIG.FREE_NFT_COST;
    if (isCollection) return MINTING_CONFIG.COLLECTION_CREATION_COST;
    return MINTING_CONFIG.PAID_NFT_COST;
  };

  useEffect(() => {
    if (wallet.publicKey) {
      const stored = localStorage.getItem(`lastFreeMint_${wallet.publicKey.toString()}`);
      if (stored) {
        setLastFreeMint(Number(stored));
        checkFreeMintAvailability(Number(stored));
      } else {
        setFreeMintAvailable(true);
      }
    }
  }, [wallet.publicKey]);

  useEffect(() => {
    async function checkBalance() {
      if (wallet.publicKey) {
        try {
          const soonConnection = new Connection("https://rpc.devnet.soo.network/rpc");
          const balance = await soonConnection.getBalance(wallet.publicKey);
          setBalance(balance / LAMPORTS_PER_SOL);
        } catch (error) {
          console.error('Error fetching balance:', error);
          setBalance(0);
        }
      }
    }
    
    checkBalance();
    const interval = setInterval(checkBalance, 10000);
    return () => clearInterval(interval);
  }, [wallet.publicKey]);

  const handleMint = async (formData: NftFormData) => {
    if (!wallet.publicKey) throw new Error('Wallet not connected');
    if (!wallet.signTransaction) throw new Error('Wallet does not support transaction signing');
    
    try {
      const totalCost = formData.isCollection 
        ? MINTING_CONFIG.COLLECTION_CREATION_COST + (MINTING_CONFIG.COLLECTION_NFT_COST * formData.collectionSize!)
        : calculateMintCost(false);

      if (balance < totalCost / LAMPORTS_PER_SOL) {
        throw new Error(`Insufficient balance. Required: ${totalCost / LAMPORTS_PER_SOL} SOL`);
      }

      setLoading(true);
      setError(null);

      // Pago de fees
      if (!freeMintAvailable || formData.isCollection) {
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: new PublicKey(process.env.NEXT_PUBLIC_FEES_WALLET!),
            lamports: totalCost
          })
        );
        const signature = await wallet.sendTransaction(transaction, new Connection("https://rpc.devnet.soo.network/rpc"));
        await new Connection("https://rpc.devnet.soo.network/rpc").confirmTransaction(signature);
      }

      // Subir imagen a Pinata (una sola vez para toda la colección)
      const ipfsImageHash = await handleImageUpload(formData.image!);
      const imageUri = `https://gateway.pinata.cloud/ipfs/${ipfsImageHash}`;

      if (formData.isCollection) {
        // Crear cada NFT de la colección
        for (let i = 0; i < formData.collectionSize!; i++) {
          const metadata = {
            name: `${formData.name} #${i + 1}`,
            symbol: formData.symbol,
            description: formData.description,
            image: imageUri,
            attributes: formData.attributes || [],
            collection: {
              name: formData.name,
              size: formData.collectionSize || 0,
              number: i + 1
            }
          };

          const metadataResponse = await axios.post(
            'https://api.pinata.cloud/pinning/pinJSONToIPFS',
            metadata,
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`
              }
            }
          );

          const metadataUri = `https://gateway.pinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`;
          const umi = createUmi("https://rpc.devnet.soo.network/rpc").use(mplTokenMetadata());
          await umiSwitchToSoonDevnet(umi);
          
          const walletAdapter = createSignerFromWalletAdapter(wallet);
          umi.identity = walletAdapter;
          umi.payer = walletAdapter;
          
          const mint = generateSigner(umi);
          
          await createNft(umi, {
            mint,
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadataUri,
            sellerFeeBasisPoints: percentAmount(0),
            isCollection: i === 0
          }).sendAndConfirm(umi);

          if (i === 0) {
            setNftMintAddress(mint.publicKey.toString());
          }
        }
      } else {
        // Código existente para mint individual...
      }

      onClose();
    } catch (err) {
      console.error('Error in mint process:', err);
      setError(err instanceof Error ? err.message : 'Error minting NFT');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-black/90 to-purple-900/20 w-full max-w-2xl max-h-[80vh] rounded-xl border border-purple-800/30 p-6 m-4 backdrop-blur-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-purple-400">Create NFT</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="overflow-y-auto max-h-[calc(80vh-8rem)]">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
              {error}
            </div>
          )}

          {nftMintAddress ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <h3 className="text-lg font-semibold text-green-400 mb-2">
                  NFT Created Successfully!
                </h3>
                <p className="text-gray-400 text-sm mb-2">
                  Your NFT has been minted with the following address:
                </p>
                <div className="bg-black/40 p-3 rounded-lg break-all font-mono text-purple-400 text-sm">
                  {nftMintAddress}
                </div>
                <div className="mt-4 flex space-x-2">
                  <a
                    href={`https://explorer.devnet.soo.network/address/${nftMintAddress}?type=nft`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 text-sm flex items-center"
                  >
                    View in Explorer
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
              <Button
                onClick={onClose}
                className="w-full bg-gradient-to-r from-purple-500 to-red-500 text-white"
              >
                Close
              </Button>
            </div>
          ) : (
            !wallet.publicKey ? (
              <p className="text-gray-400 mb-4">Connect your wallet to continue</p>
            ) : balance < 0.1 ? (
              <div className="space-y-4">
                <p className="text-red-400">You need at least 0.1 SOL to mint NFTs</p>
                <p className="text-gray-400">
                  Get SOL from our faucet: 
                  <a 
                    href="https://faucet.soo.network/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 ml-1"
                  >
                    https://faucet.soo.network/
                  </a>
                </p>
              </div>
            ) : (
              <NftForm 
                onSubmit={handleMint} 
                loading={loading} 
                balance={balance} 
                freeMintAvailable={freeMintAvailable}
                lastFreeMint={lastFreeMint}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
} 