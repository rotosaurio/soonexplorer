import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, Connection, Transaction, SystemProgram, PublicKey, Keypair } from '@solana/web3.js';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { createNft, verifyCollection, TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner, publicKey, keypairIdentity, percentAmount, some, none } from "@metaplex-foundation/umi";
import { createSignerFromWalletAdapter } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import Button from './Button';
import NftForm, { NftFormData } from './NftForm';
import { uploadImageToFilebase, uploadMetadataToFilebase } from '../utils/filebase';
import { setupUmiWithInternalWallet } from '../utils/internalWallet';
import { findMetadataPda, findMasterEditionPda, verifyCollectionV1 } from "@metaplex-foundation/mpl-token-metadata";
import { KeypairSigner } from "@metaplex-foundation/umi";

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

const createMasterNft = async (umi: any, {mint, name, symbol, uri, sellerFeeBasisPoints, creators, collection, uses}: any) => {
  return createNft(umi, {
    mint,
    name,
    symbol,
    uri,
    sellerFeeBasisPoints,
    isCollection: true,
    collection: none(),
    creators: some([{
      address: umi.identity.publicKey,
      verified: true,
      share: 100
    }]),
    uses: none(),
  });
};

export default function NftMinter({ onClose }: NftMinterProps) {
  const wallet = useWallet();
  const [balance, setBalance] = useState<number>(0);
  const [lastFreeMint, setLastFreeMint] = useState<number | null>(null);
  const [freeMintAvailable, setFreeMintAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nftMintAddress, setNftMintAddress] = useState<string>('');
  const [collectionMintSigner, setCollectionMintSigner] = useState<KeypairSigner | null>(null);
  const [collectionDetails, setCollectionDetails] = useState<{masterNft: string; collectionNfts: string[];} | null>(null);
  const [internalWalletKey, setInternalWalletKey] = useState<Uint8Array | null>(null);

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
          setBalance(0);
        }
      }
    }
    
    checkBalance();
    const interval = setInterval(checkBalance, 10000);
    return () => clearInterval(interval);
  }, [wallet.publicKey]);

  useEffect(() => {
    const getWalletKey = async () => {
      try {
        const response = await fetch('/api/get-wallet-key');
        const data = await response.json();
        if (data.key) {
          setInternalWalletKey(
            new Uint8Array(
              data.key.split(',').map((num: string): number => parseInt(num))
            )
          );
        }
      } catch (error) {
        console.error('Error fetching wallet key:', error);
      }
    };

    getWalletKey();
  }, []);

  const handleMint = async (formData: NftFormData) => {
    if (!wallet.publicKey || !wallet.signTransaction || !internalWalletKey) {
      throw new Error('Wallet not connected or internal key not loaded');
    }
    
    try {
      setLoading(true);
      setError(null);

      const internalWallet = Keypair.fromSecretKey(internalWalletKey);
      const connection = new Connection("https://rpc.devnet.soo.network/rpc");
      const internalWalletPubkey = new PublicKey(process.env.NEXT_PUBLIC_FEES_WALLET!);

      let totalCost = 0;
      if (formData.isCollection) {
        totalCost = MINTING_CONFIG.COLLECTION_CREATION_COST + 
          (MINTING_CONFIG.COLLECTION_NFT_COST * formData.collectionSize!);
      } else {
        totalCost = freeMintAvailable ? 0 : MINTING_CONFIG.PAID_NFT_COST;
      }

      if (totalCost > 0) {
        if (balance < totalCost / LAMPORTS_PER_SOL) {
          throw new Error(`Insufficient balance. Required: ${totalCost / LAMPORTS_PER_SOL} SOL`);
        }

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        const feeTransaction = new Transaction({
          feePayer: wallet.publicKey,
          blockhash,
          lastValidBlockHeight,
        }).add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: internalWalletPubkey,
            lamports: totalCost
          })
        );

        try {
          const signedTx = await wallet.signTransaction(feeTransaction);
          const txId = await connection.sendRawTransaction(signedTx.serialize());
          await connection.confirmTransaction({
            signature: txId,
            blockhash,
            lastValidBlockHeight,
          });
        } catch (txError) {
          console.error('Transaction error:', txError);
          throw new Error('Failed to process payment transaction');
        }
      }

      const umi = createUmi("https://rpc.devnet.soo.network/rpc").use(mplTokenMetadata());
      await umiSwitchToSoonDevnet(umi);
      const umiWithInternalWallet = setupUmiWithInternalWallet(umi);

      const { cid: imageCid } = await uploadImageToFilebase(formData.image!);
      const imageUri = `https://assistant-scarlet-goose.myfilebase.com/ipfs/${imageCid}`;

      if (formData.isCollection) {
        const masterNftSigner = generateSigner(umiWithInternalWallet);
        
        const collectionMetadata = {
          name: formData.name,
          symbol: formData.symbol,
          description: formData.description,
          image: imageUri,
          attributes: formData.attributes,
          creator: {
            name: formData.creatorName,
            site: formData.creatorSite
          }
        };

        const { cid: collectionMetadataCid } = await uploadMetadataToFilebase(collectionMetadata);
        const collectionMetadataUri = `https://assistant-scarlet-goose.myfilebase.com/ipfs/${collectionMetadataCid}`;
        
        await createNft(umiWithInternalWallet, {
          mint: masterNftSigner,
          name: formData.name,
          symbol: formData.symbol,
          uri: collectionMetadataUri,
          sellerFeeBasisPoints: percentAmount(0),
          isCollection: true,
          collection: none(),
          creators: some([{
            address: umiWithInternalWallet.identity.publicKey,
            verified: true,
            share: 100
          }]),
          uses: none(),
        }).sendAndConfirm(umiWithInternalWallet);

        for (let i = 0; i < formData.collectionSize!; i++) {
          const nftMint = generateSigner(umiWithInternalWallet);
          
          const metadata = {
            name: `${formData.name}`,
            symbol: formData.symbol,
            description: formData.description,
            image: imageUri,
            attributes: formData.attributes,
            creator: {
              name: formData.creatorName,
              site: formData.creatorSite
            }
          };

          const { cid: metadataCid } = await uploadMetadataToFilebase(metadata);
          const metadataUri = `https://assistant-scarlet-goose.myfilebase.com/ipfs/${metadataCid}`;

          await createNft(umiWithInternalWallet, {
            mint: nftMint,
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadataUri,
            sellerFeeBasisPoints: percentAmount(0),
            collection: some({
              key: masterNftSigner.publicKey,
              verified: false
            }),
            creators: some([{
              address: umiWithInternalWallet.identity.publicKey,
              verified: true,
              share: 100
            }]),
            uses: none(),
          }).sendAndConfirm(umiWithInternalWallet);

          const nftMetadata = findMetadataPda(umiWithInternalWallet, { 
            mint: nftMint.publicKey 
          });

          await new Promise(resolve => setTimeout(resolve, 2000));

          const verifyBuilder = verifyCollectionV1(umiWithInternalWallet, {
            metadata: nftMetadata,
            collectionMint: masterNftSigner.publicKey,
            authority: umiWithInternalWallet.identity,
          });

          await verifyBuilder.sendAndConfirm(umiWithInternalWallet);

          const nftMintPublicKey = new PublicKey(nftMint.publicKey.toString());
          const userAta = await getAssociatedTokenAddress(
            nftMintPublicKey,
            wallet.publicKey
          );
          const internalWalletAta = await getAssociatedTokenAddress(
            nftMintPublicKey,
            internalWalletPubkey
          );

          const transferTx = new Transaction().add(
            createAssociatedTokenAccountInstruction(
              internalWalletPubkey,
              userAta,
              wallet.publicKey,
              nftMintPublicKey
            ),
            createTransferInstruction(
              internalWalletAta,
              userAta,
              internalWalletPubkey,
              1
            )
          );

          await connection.sendTransaction(
            transferTx,
            [internalWallet]
          );
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
        window.location.reload();

      } else {
        const nftMint = generateSigner(umiWithInternalWallet);
        
        const metadata = {
          name: formData.name,
          symbol: formData.symbol,
          description: formData.description,
          image: imageUri,
          attributes: formData.attributes,
          creator: {
            name: formData.creatorName,
            site: formData.creatorSite
          }
        };

        const { cid: metadataCid } = await uploadMetadataToFilebase(metadata);
        const metadataUri = `https://assistant-scarlet-goose.myfilebase.com/ipfs/${metadataCid}`;
        
        await createNft(umiWithInternalWallet, {
          mint: nftMint,
          name: metadata.name,
          symbol: metadata.symbol,
          uri: metadataUri,
          sellerFeeBasisPoints: percentAmount(0),
          collection: none(),
          creators: some([{
            address: umiWithInternalWallet.identity.publicKey,
            verified: true,
            share: 100
          }]),
          uses: none(),
        }).sendAndConfirm(umiWithInternalWallet);
        
        const nftMintPublicKey = new PublicKey(nftMint.publicKey.toString());
        const userAta = await getAssociatedTokenAddress(
          nftMintPublicKey,
          wallet.publicKey
        );
        const internalWalletAta = await getAssociatedTokenAddress(
          nftMintPublicKey,
          internalWalletPubkey
        );

        const transferTx = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            internalWalletPubkey,
            userAta,
            wallet.publicKey,
            nftMintPublicKey
          ),
          createTransferInstruction(
            internalWalletAta,
            userAta,
            internalWalletPubkey,
            1
          )
        );

        await connection.sendTransaction(
          transferTx,
          [internalWallet]
        );
      }

      if (!formData.isCollection && freeMintAvailable) {
        localStorage.setItem(`lastFreeMint_${wallet.publicKey.toString()}`, Date.now().toString());
      }

      window.location.reload();

    } catch (error) {
      console.error('Mint error:', error);
      setError(error instanceof Error ? error.message : 'Error minting NFT');
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
                  Collection Successfully Created!
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Collection Master NFT:</p>
                    <div className="bg-black/40 p-3 rounded-lg break-all font-mono text-purple-400 text-sm">
                      {collectionDetails?.masterNft}
                    </div>
                  </div>

                  <div>
                    <p className="text-gray-400 text-sm mb-2">Collection NFTs:</p>
                    <div className="space-y-2">
                      {collectionDetails?.collectionNfts.map((nft, index) => (
                        <div key={nft} className="bg-black/40 p-3 rounded-lg break-all font-mono text-purple-400 text-sm">
                          NFT #{index + 1} of {collectionDetails.collectionNfts.length}: {nft}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex space-x-2">
                    <a
                      href={`https://explorer.devnet.soo.network/address/${collectionDetails?.masterNft}?type=nft`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 text-sm flex items-center"
                    >
                      View Collection in Explorer
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
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
                lastFreeMint={lastFreeMint ?? undefined}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
} 