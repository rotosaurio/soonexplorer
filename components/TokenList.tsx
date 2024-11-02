import { useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, fetchDigitalAsset, TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";

interface TokenListProps {
  onSelectToken: (address: string) => void;
}

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  image: string;
  amount: number;
  isNft: boolean;
  collection: string;
  isCollectionNft: boolean;
  isCollectionMaster: boolean;
}

interface GroupedNfts {
  [collectionKey: string]: TokenInfo[];
}

interface Collection {
  key: { toString: () => string };
  verified: boolean;
}

interface TokenMetadata {
  collection: {
    key: { toString: () => string };
    verified: boolean;
  } | null;
  symbol: string;
  name: string;
  uri: string;
}

interface CollectionInfo {
  key: { toString: () => string };
  verified: boolean;
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

export default function TokenList({ onSelectToken }: TokenListProps) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNfts, setShowNfts] = useState(false);
  const [groupedNfts, setGroupedNfts] = useState<GroupedNfts>({});
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    async function fetchUserTokens() {
      if (!wallet.publicKey) return;
      
      try {
        setLoading(true);
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          wallet.publicKey,
          { programId: TOKEN_PROGRAM_ID }
        );

        const tokenInfos = await Promise.all(
          tokenAccounts.value
            .filter(account => Number(account.account.data.parsed.info.tokenAmount.amount) > 0)
            .map(async account => {
              const mintAddress = account.account.data.parsed.info.mint;
              const amount = Number(account.account.data.parsed.info.tokenAmount.amount) / 
                            Math.pow(10, account.account.data.parsed.info.tokenAmount.decimals);
              try {
                const umi = createUmi("https://rpc.devnet.soo.network/rpc").use(mplTokenMetadata());
                await umiSwitchToSoonDevnet(umi);

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
                  symbol: asset.metadata.symbol,
                  name: asset.metadata.name,
                  image: imageUrl,
                  amount: amount,
                  isNft,
                  collection,
                  isCollectionNft,
                  isCollectionMaster
                };
              } catch (err) {
                console.error('Error fetching token info:', err);
                return {
                  address: mintAddress,
                  symbol: 'Unknown',
                  name: 'Unknown Token',
                  image: '',
                  amount: amount,
                  isNft: false,
                  collection: 'uncategorized',
                  isCollectionNft: false,
                  isCollectionMaster: false
                };
              }
            })
        );

        const grouped = tokenInfos.reduce((acc: GroupedNfts, token) => {
          if (token.isNft) {
            let collectionKey;
            
            if (token.isCollectionMaster) {
              collectionKey = token.address;
            } else if (token.isCollectionNft) {
              collectionKey = token.collection;
            } else {
              collectionKey = 'uncategorized';
            }

            if (!acc[collectionKey]) {
              acc[collectionKey] = [];
            }
            acc[collectionKey].push(token);
          }
          return acc;
        }, {});

        setGroupedNfts(grouped);
        setTokens(tokenInfos);
      } catch (err) {
        console.error('Error fetching tokens:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUserTokens();
  }, [wallet.publicKey, connection]);

  const renderNftList = () => {
    if (!showNfts) {
      return tokens.filter(token => !token.isNft).map((token) => (
        <button
          key={token.address}
          onClick={() => onSelectToken(token.address)}
          className="w-full text-left p-4 bg-black/60 rounded-lg border border-purple-800/20 hover:border-purple-500/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {token.image ? (
              <img 
                src={token.image} 
                alt={token.name} 
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-purple-900/30 flex items-center justify-center">
                <span className="text-purple-400 text-lg">
                  {token.symbol.charAt(0)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {token.name}
              </div>
              <div className="text-xs text-purple-400">
                {token.amount} {token.symbol}
              </div>
              <div className="text-xs text-gray-400 truncate mt-1">
                {token.address}
              </div>
            </div>
          </div>
        </button>
      ));
    }

    return Object.entries(groupedNfts).map(([collectionKey, nfts]) => (
      <div key={collectionKey} className="mb-3">
        <button
          onClick={() => setExpandedCollection(expandedCollection === collectionKey ? null : collectionKey)}
          className="w-full flex items-center justify-between p-4 bg-black/60 rounded-lg border border-purple-800/20 hover:border-purple-500/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-purple-400 text-sm font-semibold">
              {collectionKey === 'uncategorized' ? 'Uncategorized' : `Collection: ${nfts[0]?.name.split('#')[0] || collectionKey}`}
            </span>
            <span className="text-gray-400 text-xs">({nfts.length})</span>
          </div>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-5 w-5 text-purple-400 transition-transform ${
              expandedCollection === collectionKey ? 'transform rotate-180' : ''
            }`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {expandedCollection === collectionKey && (
          <div className="mt-2 space-y-2 pl-2">
            {nfts.map((token) => (
              <button
                key={token.address}
                onClick={() => onSelectToken(token.address)}
                className="w-full text-left p-3 bg-black/40 rounded-lg border border-purple-800/20 hover:border-purple-500/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {token.image ? (
                    <img 
                      src={token.image} 
                      alt={token.name} 
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-purple-900/30 flex items-center justify-center">
                      <span className="text-purple-400 text-sm">
                        {token.symbol.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {token.name}
                    </div>
                    <div className="text-xs text-purple-400">
                      {token.amount} {token.symbol}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {token.address}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    ));
  };

  if (!wallet.publicKey) return null;

  return (
    <>
      <button 
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="fixed left-4 top-20 z-50 p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 transition-colors md:hidden"
      >
        <svg 
          className="w-6 h-6 text-purple-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      <div className={`
        fixed left-4 top-20 w-80 bg-black/40 rounded-xl border border-purple-800/30 p-4
        transform transition-transform duration-300 ease-in-out z-40
        md:transform-none md:h-[calc(100vh-280px)] overflow-hidden
        ${isMenuOpen ? 'translate-x-0' : '-translate-x-[120%]'}
        md:translate-x-0
      `}>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setShowNfts(false)}
            className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
              !showNfts 
                ? 'bg-purple-500/30 text-purple-300' 
                : 'bg-black/30 text-gray-400 hover:bg-purple-500/20'
            }`}
          >
            Your Tokens ({tokens.filter(t => !t.isNft).length})
          </button>
          <button
            onClick={() => setShowNfts(true)}
            className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
              showNfts 
                ? 'bg-purple-500/30 text-purple-300' 
                : 'bg-black/30 text-gray-400 hover:bg-purple-500/20'
            }`}
          >
            Your NFTs ({tokens.filter(t => t.isNft).length})
          </button>
        </div>

        <div className="h-[calc(100%-60px)] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500/30 scrollbar-track-transparent">
          {loading ? (
            <div className="flex justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
            </div>
          ) : (showNfts ? Object.keys(groupedNfts).length : tokens.filter(t => !t.isNft).length) > 0 ? (
            <div className="space-y-3">
              {renderNftList()}
            </div>
          ) : (
            <div className="text-center text-gray-400 p-4">
              No {showNfts ? 'NFTs' : 'tokens'} found
            </div>
          )}
        </div>
      </div>
    </>
  );
}