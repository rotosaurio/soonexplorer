import { useEffect, useState } from 'react';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";
import TokenSearch from './TokenSearch';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, AccountLayout } from '@solana/spl-token';
import TokenList from './TokenList';

interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
  supply: number;
  decimals: number;
  isNft: boolean;
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

  const fetchCollectionNfts = async (collectionName: string) => {
    if (!collectionName) return;
    
    setLoadingCollection(true);
    try {
      const connection = new Connection("https://rpc.devnet.soo.network/rpc");
      const umi = createUmi("https://rpc.devnet.soo.network/rpc").use(mplTokenMetadata());
      
      await umiSwitchToSoonDevnet(umi);

      const nfts = await connection.getProgramAccounts(
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
        {
          filters: [
            {
              memcmp: {
                offset: 8,
                bytes: Buffer.from(collectionName).toString('base64')
              }
            }
          ]
        }
      );

      const collectionNftsData = await Promise.all(
        nfts.map(async (nft) => {
          try {
            const asset = await fetchDigitalAsset(umi, publicKey(nft.pubkey.toString()));
            if (!asset.metadata.uri) return null;
            
            const response = await fetch(asset.metadata.uri);
            const metadata = await response.json();
            
            return {
              address: nft.pubkey.toString(),
              name: asset.metadata.name,
              image: metadata.image || '',
              number: metadata.collection?.number || 0
            };
          } catch (error) {
            console.error('Error fetching NFT metadata:', error);
            return null;
          }
        })
      );

      const validNfts = collectionNftsData.filter((nft): nft is CollectionNft => nft !== null);
      setCollectionNfts(validNfts.sort((a, b) => a.number - b.number));
    } catch (error) {
      console.error('Error fetching collection NFTs:', error);
    } finally {
      setLoadingCollection(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 bg-gradient-to-br from-black via-purple-900/20 to-red-900/20 rounded-xl border border-purple-800/50 shadow-xl shadow-purple-500/20">
      <TokenList onSelectToken={handleTokenSelect} />
      <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-400 via-red-300 to-purple-400 text-transparent bg-clip-text mb-4 sm:mb-6">
        Token Explorer
      </h2>
      <p className="text-gray-400 text-sm sm:text-base">Enter a token address to view its metadata</p>
      <TokenSearch onSearch={setTokenAddress} />
      
      {!tokenAddress ? (
        <div className="text-center p-8 bg-black/40 rounded-xl border border-purple-800/30 mt-4">
          <h2 className="text-xl text-gray-300 mb-2">Token Explorer</h2>
          <p className="text-gray-400">Enter a token address to view its metadata</p>
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
        <div className="bg-black/90 w-full max-w-2xl rounded-xl border border-purple-800/30 p-6 mt-4">
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
        <div className="bg-black/90 w-full max-w-2xl rounded-xl border border-purple-800/30 p-6 mt-4">
          {metadata && (
            <>
              <div className="text-center mb-4">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                  metadata.isNft 
                    ? 'bg-purple-500/20 text-purple-400' 
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {metadata.isNft ? 'NFT' : 'TOKEN'}
                </span>
              </div>
              
              <h2 className="text-2xl font-bold text-purple-400 text-center mb-6">
                {metadata.name}
              </h2>

              {metadata.jsonMetadata?.image && (
                <div className="mb-6">
                  <img 
                    src={metadata.jsonMetadata.image} 
                    alt={metadata.name}
                    className="w-full rounded-lg object-cover aspect-square"
                  />
                </div>
              )}

              <div className="space-y-4">
                <div className="bg-black/60 p-4 rounded-lg border border-purple-800/20">
                  <h3 className="text-lg font-semibold text-purple-400 mb-2">Details</h3>
                  <div className="space-y-2">
                    <p className="text-gray-300">Symbol: <span className="text-purple-400">{metadata.symbol}</span></p>
                    
                    {metadata.jsonMetadata?.description && (
                      <p className="text-gray-300">Description: <span className="text-purple-400">{metadata.jsonMetadata.description}</span></p>
                    )}

                    {metadata.isNft ? (
                      <>
                        {metadata.jsonMetadata?.collection && (
                          <div className="mt-2">
                            <p className="text-gray-300">
                              Collection: <span className="text-purple-400">{metadata.jsonMetadata.collection.name}</span>
                            </p>
                            <p className="text-gray-300">
                              NFT #: <span className="text-purple-400">
                                {metadata.jsonMetadata.collection.number} of {metadata.jsonMetadata.collection.size || '?'}
                              </span>
                            </p>
                            <button
                              onClick={() => {
                                const collection = metadata.jsonMetadata?.collection;
                                if (collection?.name) {
                                  fetchCollectionNfts(collection.name);
                                  setShowCollectionModal(true);
                                }
                              }}
                              className="mt-2 w-full px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30"
                            >
                              View Collection NFTs
                            </button>
                          </div>
                        )}

                        {metadata.jsonMetadata?.attributes && (
                          <div className="mt-4">
                            <h4 className="text-gray-300 mb-2">Attributes:</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {metadata.jsonMetadata.attributes.map((attr, index) => (
                                <div key={index} className="bg-black/40 p-2 rounded">
                                  <p className="text-gray-400 text-sm">{attr.trait_type}</p>
                                  <p className="text-purple-400">{attr.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-gray-300">Supply: <span className="text-purple-400">{metadata.supply.toLocaleString()}</span></p>
                        <p className="text-gray-300">Decimals: <span className="text-purple-400">{metadata.decimals}</span></p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
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
          <div className="bg-black/90 w-full max-w-4xl rounded-xl border border-purple-800/30 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-purple-400">
                Collection: {metadata?.jsonMetadata?.collection?.name}
              </h3>
              <button
                onClick={() => setShowCollectionModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {loadingCollection ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {collectionNfts.map((nft) => (
                  <div key={nft.address} className="bg-black/60 rounded-lg p-4 border border-purple-800/20">
                    <img
                      src={nft.image}
                      alt={nft.name}
                      className="w-full aspect-square rounded-lg object-cover mb-2"
                    />
                    <p className="text-purple-400 font-medium">{nft.name}</p>
                    <p className="text-gray-400 text-sm">#{nft.number}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}