import { useEffect, useState } from 'react';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, fetchDigitalAsset, burnNft, findMasterEditionPda } from "@metaplex-foundation/mpl-token-metadata";
import { none, publicKey } from "@metaplex-foundation/umi";
import TokenSearch from './TokenSearch';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, AccountLayout } from '@solana/spl-token';
import TokenList from './TokenList';
import { useWallet } from '@solana/wallet-adapter-react';
import { createSignerFromKeypair, signerIdentity, generateSigner } from "@metaplex-foundation/umi";
import { createSignerFromWalletAdapter } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { 
  getOrCreateAssociatedTokenAccount, 
  createTransferInstruction, 
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress
} from '@solana/spl-token';

interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
  supply: number;
  decimals: number;
  isNft: boolean;
  isCollectionMaster?: boolean;
  holders: {
    address: string;
    amount: number;
  }[];
  jsonMetadata?: {
    name: string;
    symbol: string;
    image: string;
    description: string;
    collection?: {
      name: string;
      size: number;
      number: number;
      key?: string;
    };
    attributes?: {
      trait_type: string;
      value: string;
    }[];
    creator?: {
      name: string;
      site: string;
    };
  };
}

interface HoldersModalProps {
  isOpen: boolean;
  onClose: () => void;
  holders: { address: string; amount: number }[];
  symbol: string;
  tokenName: string;
  totalSupply: number;
}

function HoldersModal({ isOpen, onClose, holders, symbol, tokenName, totalSupply }: HoldersModalProps) {
  if (!isOpen) return null;

  const sortedHolders = [...holders].sort((a, b) => b.amount - a.amount);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-black/90 w-full max-w-2xl max-h-[80vh] rounded-xl border border-purple-800/30 p-6 m-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-purple-400">
            Token Holders of {tokenName} ({holders.length})
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="overflow-y-auto max-h-[calc(80vh-8rem)]">
          {sortedHolders.map((holder) => {
            const percentage = (holder.amount / totalSupply) * 100;
            return (
              <div 
                key={holder.address} 
                className="bg-black/60 p-4 rounded-lg border border-purple-800/20 mb-2"
              >
                <div className="flex justify-between items-center">
                  <div className="font-mono text-sm text-white break-all">
                    {holder.address}
                  </div>
                  <div className="text-right">
                    <div className="text-purple-400">
                      {holder.amount.toLocaleString()} {symbol}
                    </div>
                    <div className="text-xs text-gray-400">
                      {percentage.toFixed(2)}% of supply
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface CollectionNft {
  address: string;
  name: string;
  image: string;
  number: number;
  owner: string;
  tokenAccount: string;
  collection: string;
  isCollectionNft: boolean;
  isCollectionMaster: boolean;
}

export default function TokenMetadata() {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [holders, setHolders] = useState<{ address: string; amount: number }[]>([]);
  const [loadingHolders, setLoadingHolders] = useState(false);
  const [isHoldersModalOpen, setIsHoldersModalOpen] = useState(false);
  const [collectionNfts, setCollectionNfts] = useState<CollectionNft[]>([]);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferAddress, setTransferAddress] = useState<string>('');
  const wallet = useWallet();

  async function umiSwitchToSoonDevnet(umi: any) {
    umi.programs.add({
      name: "mplTokenMetadata",
      publicKey: publicKey("6C4GR9AtMGF25sjXKtdB7A6NVQUudEQWw97kG61pGuA1"),
      getErrorFromCode: () => null,
      getErrorFromName: () => null,
      isOnCluster: () => true,
    }, true);
  }

  useEffect(() => {
    async function fetchMetadata() {
      if (!tokenAddress) return;
      
      try {
        setLoading(true);
        setError(null);

        const umi = createUmi("https://rpc.devnet.soo.network/rpc").use(mplTokenMetadata());
        
        umi.programs.add({
          name: "mplTokenMetadata",
          publicKey: publicKey("6C4GR9AtMGF25sjXKtdB7A6NVQUudEQWw97kG61pGuA1"),
          getErrorFromCode: () => null,
          getErrorFromName: () => null,
          isOnCluster: () => true,
        }, true);

        const asset = await fetchDigitalAsset(umi, publicKey(tokenAddress));
        const isNft = Number(asset.mint.supply) === 1 && asset.mint.decimals === 0;

        let jsonMetadata = null;
        if (asset.metadata.uri) {
          try {
            const response = await fetch(asset.metadata.uri);
            jsonMetadata = await response.json();
          } catch (err) {
            console.error('Error fetching metadata:', err);
          }
        }

        setMetadata({
          name: asset.metadata.name,
          symbol: asset.metadata.symbol,
          uri: asset.metadata.uri,
          supply: Number(asset.mint.supply),
          decimals: asset.mint.decimals,
          isNft,
          holders: [],
          jsonMetadata
        });

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setMetadata(null);
      } finally {
        setLoading(false);
      }
    }

    fetchMetadata();
  }, [tokenAddress]);

  const fetchTokenHolders = async (mintAddress: string) => {
    setLoadingHolders(true);
    try {
      const connection = new Connection("https://rpc.devnet.soo.network/rpc");
      const mintPubkey = new PublicKey(mintAddress);
      
      const accounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
        filters: [
          {
            dataSize: 165,
          },
          {
            memcmp: {
              offset: 0,
              bytes: mintPubkey.toBase58(),
            },
          },
        ],
      });

      const holdersData = accounts
        .map(account => {
          const accountInfo = AccountLayout.decode(account.account.data);
          const amount = Number(accountInfo.amount);
          const ownerAddress = accountInfo.owner.toBase58();

          if (amount > 0) {
            return {
              address: ownerAddress,
              tokenAccount: account.pubkey.toBase58(),
              amount: amount / Math.pow(10, metadata?.decimals || 0),
            };
          }
          return null;
        })
        .filter((holder): holder is { address: string; tokenAccount: string; amount: number } => holder !== null);

      setHolders(holdersData);
    } catch (err) {
      console.error('Error fetching holders:', err);
    } finally {
      setLoadingHolders(false);
    }
  };

  useEffect(() => {
    if (tokenAddress && metadata) {
      fetchTokenHolders(tokenAddress);
    }
  }, [tokenAddress, metadata]);

  const handleTokenSelect = (address: string) => {
    setTokenAddress(address);
  };

  const fetchCollectionNfts = async (collectionAddress: string) => {
    if (!collectionAddress) return;
    
    setLoadingCollection(true);
    try {
      const connection = new Connection("https://rpc.devnet.soo.network/rpc");
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        new PublicKey(collectionAddress),
        { programId: TOKEN_PROGRAM_ID }
      );

      const umi = createUmi("https://rpc.devnet.soo.network/rpc").use(mplTokenMetadata());
      await umiSwitchToSoonDevnet(umi);

      const nftsData = await Promise.all(
        tokenAccounts.value
          .filter(account => Number(account.account.data.parsed.info.tokenAmount.amount) > 0)
          .map(async account => {
            const mintAddress = account.account.data.parsed.info.mint;
            try {
              const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));
              let imageUrl = '';
              let isNft = Number(asset.mint.supply) === 1 && asset.mint.decimals === 0;
              
              let collection = 'uncategorized';
              let isCollectionNft = false;
              let isCollectionMaster = false;

              if (asset.metadata.collectionDetails && 
                  'some' in asset.metadata.tokenStandard && 
                  asset.metadata.tokenStandard.some === 'NonFungible') {
                isCollectionMaster = true;
                collection = mintAddress;
              } 
              else if (asset.metadata.collection) {
                type CollectionOption = { 
                  __option: 'Some'; 
                  value: {
                    key: { toString: () => string };
                    verified: boolean;
                  }
                };
                
                const collectionData = asset.metadata.collection as unknown as CollectionOption;
                
                if (collectionData.__option === 'Some' && 
                    collectionData.value && 
                    collectionData.value.verified) {
                  collection = collectionData.value.key.toString();
                  isCollectionNft = true;
                }
              }

              if (asset.metadata.uri) {
                const response = await fetch(asset.metadata.uri);
                const jsonMetadata = await response.json();
                imageUrl = jsonMetadata.image || '';
              }

              return {
                address: mintAddress,
                name: asset.metadata.name,
                image: imageUrl,
                number: parseInt(asset.metadata.name.split('#')[1]) || 0,
                owner: account.account.data.parsed.info.owner,
                tokenAccount: account.pubkey.toString(),
                collection,
                isCollectionNft,
                isCollectionMaster
              } as CollectionNft;
            } catch (err) {
              console.error('Error fetching NFT data:', err);
              return null;
            }
          })
      );

      const validNfts = nftsData.filter((nft): nft is CollectionNft => nft !== null);
      setCollectionNfts(validNfts);
    } catch (error) {
      console.error('Error fetching collection NFTs:', error);
    } finally {
      setLoadingCollection(false);
    }
  };

  const handleTransferNft = async (mintAddress: string) => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Wallet no conectada');
      return;
    }

    if (!transferAddress) {
      setError('Ingresa una dirección de wallet');
      return;
    }

    try {
      setIsTransferring(true);
      const connection = new Connection("https://rpc.devnet.soo.network/rpc");
      
      // Obtener o crear token accounts
      const sourceTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(mintAddress),
        wallet.publicKey
      );

      const destinationTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(mintAddress),
        new PublicKey(transferAddress)
      );

      const transaction = new Transaction();

      // Verificar si la cuenta destino existe
      const destinationAccount = await connection.getAccountInfo(destinationTokenAccount);
      
      if (!destinationAccount) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            destinationTokenAccount,
            new PublicKey(transferAddress),
            new PublicKey(mintAddress)
          )
        );
      }

      // Añadir instrucción de transferencia
      transaction.add(
        createTransferInstruction(
          sourceTokenAccount,
          destinationTokenAccount,
          wallet.publicKey,
          1
        )
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signedTx = await wallet.signTransaction(transaction);
      const txId = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction({
        signature: txId,
        blockhash,
        lastValidBlockHeight
      });

      setError(null);
      setTransferAddress('');
      // Opcional: Actualizar la UI o mostrar mensaje de éxito
    } catch (err) {
      console.error('Error al transferir:', err);
      setError(err instanceof Error ? err.message : 'Error al transferir el NFT');
    } finally {
      setIsTransferring(false);
    }
  };

  useEffect(() => {
    // Función para manejar la búsqueda de tokens
    const handleTokenSearch = (event: CustomEvent) => {
      const { address } = event.detail;
      setTokenAddress(address);
    };

    // Agregar el event listener
    window.addEventListener('updateTokenSearch', handleTokenSearch as EventListener);

    // Limpiar el event listener
    return () => {
      window.removeEventListener('updateTokenSearch', handleTokenSearch as EventListener);
    };
  }, []);

  // Añadir esta función para obtener los NFTs de la colección
  const handleViewCollection = async () => {
    if (!metadata?.jsonMetadata?.collection?.name) return;
    
    setShowCollectionModal(true);
    await fetchCollectionNfts(metadata.jsonMetadata.collection.name);
  };

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 bg-gradient-to-br from-black/0 via-purple-900/20 to-red-900/20 rounded-xl border border-purple-800/50 shadow-xl shadow-purple-500/20">
      <TokenList onSelectToken={handleTokenSelect} />
      <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-400 via-red-300 to-purple-400 text-transparent bg-clip-text mb-4 sm:mb-6 text-center">
        Token Explorer
      </h2>
      <TokenSearch onSearch={setTokenAddress} />
      
      {!tokenAddress ? (
        <div className="text-center p-8 bg-black/40 rounded-xl border border-purple-800/30 mt-4">
          <h2 className="text-xl text-gray-300 mb-2">Token Explorer</h2>
          <p className="text-gray-400">Enter a token address to view its Information</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      ) : error ? (
        <div className="text-red-400 p-4 text-center bg-black/40 rounded-xl border border-purple-800/30 mt-4">
          Error: {error}
        </div>
      ) : metadata && !metadata.isNft ? (
        <div className="bg-transparent w-full max-w-2xl rounded-xl border border-purple-800/30 p-6 mt-4">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full overflow-hidden flex-shrink-0">
              {metadata.jsonMetadata?.image ? (
                <img 
                  src={metadata.jsonMetadata.image} 
                  alt={metadata.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-purple-500/20 flex items-center justify-center">
                  <span className="text-2xl text-purple-400">{metadata.symbol.charAt(0)}</span>
                </div>
              )}
            </div>
            
            <div className="flex-grow">
              <h2 className="text-2xl font-bold text-purple-400 mb-2">
                {metadata.name}
              </h2>
              <p className="text-gray-400 text-sm mb-4">{metadata.symbol}</p>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <h3 className="text-sm text-gray-400 mb-1">Token Address</h3>
                  <p className="font-mono text-purple-400 text-sm break-all">
                    {tokenAddress}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm text-gray-400 mb-1">Current Supply</h3>
                    <p className="text-purple-400">{metadata.supply.toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm text-gray-400 mb-1">Decimals</h3>
                    <p className="text-purple-400">{metadata.decimals}</p>
                  </div>
                </div>

                {metadata.jsonMetadata?.description && (
                  <div>
                    <h3 className="text-sm text-gray-400 mb-1">Description</h3>
                    <p className="text-purple-400">{metadata.jsonMetadata.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={() => setIsHoldersModalOpen(true)}
              className="w-full px-4 py-3 bg-purple-500/20 rounded-lg hover:bg-purple-500/30 transition-colors text-purple-400 hover:text-purple-300 flex items-center justify-center gap-2"
            >
              <span>Click to See Token Holders</span>
              {loadingHolders ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              ) : (
                <span className="text-sm">({holders.length})</span>
              )}
            </button>
          </div>
        </div>
      ) : metadata && metadata.isNft ? (
        <div className="bg-transparent w-full max-w-md mx-auto rounded-xl border border-purple-800/30 p-3 mt-4">
          {/* Header & Image */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-purple-400">
                {metadata.name}
              </h2>
              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400">
                NFT
              </span>
            </div>
            
            {/* Imagen más pequeña pero centrada */}
            <div className="flex justify-center">
              <div className="w-48 h-48 rounded-lg overflow-hidden bg-black/60">
                <img
                  src={metadata.jsonMetadata?.image}
                  alt={metadata.name}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="mt-3 space-y-2 text-sm">
            {/* Basic Info Grid */}
            <div className="grid grid-cols-2 gap-2 bg-black/40 rounded-lg p-2">
              <div>
                <p className="text-gray-400 text-xs">Symbol</p>
                <p className="text-purple-400">{metadata.symbol}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Creator</p>
                <p className="text-purple-400 truncate">{metadata.jsonMetadata?.creator?.name || 'Unknown'}</p>
              </div>
            </div>

            {/* Collection Info */}
            {metadata.jsonMetadata?.collection && (
              <div className="bg-black/40 p-2 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-xs">Collection</span>
                  <span className="text-purple-400 text-xs">
                    #{metadata.jsonMetadata.collection.number} of {metadata.jsonMetadata.collection.size}
                  </span>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="bg-black/40 p-2 rounded-lg">
              <p className="text-gray-400 text-xs">Description</p>
              <p className="text-purple-400 text-xs line-clamp-2">{metadata.jsonMetadata?.description}</p>
            </div>

            {/* Attributes */}
            {metadata.jsonMetadata?.attributes && (
              <div className="bg-black/40 p-2 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Attributes</p>
                <div className="grid grid-cols-2 gap-1">
                  {metadata.jsonMetadata.attributes.map((attr, index) => (
                    <div key={index} className="bg-black/20 p-1.5 rounded">
                      <p className="text-gray-400 text-xs">{attr.trait_type}</p>
                      <p className="text-purple-400 text-xs truncate">{attr.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transfer Controls */}
            <div className="space-y-1.5 mt-3">
              <input
                type="text"
                placeholder="Destination wallet address"
                value={transferAddress}
                onChange={(e) => setTransferAddress(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded bg-black/60 border border-purple-800/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={() => handleTransferNft(tokenAddress)}
                disabled={isTransferring || !transferAddress}
                className={`w-full px-2 py-1.5 rounded flex items-center justify-center space-x-1 text-xs ${
                  isTransferring || !transferAddress
                    ? 'bg-purple-500/30 text-purple-300 cursor-not-allowed'
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                }`}
              >
                {isTransferring ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    <span>Transferring...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" />
                    </svg>
                    <span>Transfer NFT</span>
                  </>
                )}
              </button>
            </div>

            {/* Token Address */}
            <div className="text-[10px] font-mono text-gray-400 break-all mt-2">
              Address: {tokenAddress}
            </div>
          </div>
        </div>
      ) : null}

      <HoldersModal
        isOpen={isHoldersModalOpen}
        onClose={() => setIsHoldersModalOpen(false)}
        holders={holders}
        symbol={metadata?.symbol || ''}
        tokenName={metadata?.name || ''}
        totalSupply={metadata ? metadata.supply / Math.pow(10, metadata.decimals) : 0}
      />

      {showCollectionModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-black/90 w-full max-w-4xl max-h-[80vh] rounded-xl border border-purple-800/30 p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold text-purple-400">
                  {metadata?.jsonMetadata?.collection?.name}
                </h3>
                <p className="text-sm text-gray-400">
                  Total NFTs: {collectionNfts.length}
                </p>
              </div>
              <button
                onClick={() => setShowCollectionModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {loadingCollection ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[calc(80vh-8rem)]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {collectionNfts.map((nft) => (
                    <div key={nft.address} 
                      className={`bg-black/60 rounded-lg p-4 border ${
                        nft.owner === wallet.publicKey?.toBase58() 
                          ? 'border-purple-500' 
                          : 'border-purple-800/20'
                      }`}
                    >
                      <div className="relative">
                        <img
                          src={nft.image}
                          alt={nft.name}
                          className="w-full aspect-square rounded-lg object-cover mb-2"
                        />
                        {nft.owner === wallet.publicKey?.toBase58() && (
                          <div className="absolute top-2 right-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                            Tu NFT
                          </div>
                        )}
                      </div>
                      <p className="text-purple-400 font-medium">{nft.name}</p>
                      <p className="text-gray-400 text-sm">#{nft.number}</p>
                      <div className="mt-2 pt-2 border-t border-purple-800/20">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-sm">Owner:</span>
                          <a
                            href={`https://explorer.devnet.soo.network/address/${nft.owner}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 text-sm truncate ml-2 flex-1 text-right"
                          >
                            {nft.owner === wallet.publicKey?.toBase58() 
                              ? 'You' 
                              : `${nft.owner.slice(0, 4)}...${nft.owner.slice(-4)}`
                            }
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}