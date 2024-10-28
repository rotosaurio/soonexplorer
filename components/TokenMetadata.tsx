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
  holders: {
    address: string;
    amount: number;
  }[];
  jsonMetadata?: {
    name: string;
    symbol: string;
    image: string;
    description: string;
    creator: {
      name: string;
      site: string;
    };
    [key: string]: any;
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

  // Ordenar holders por cantidad de tokens (mayor a menor)
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

export default function TokenMetadata() {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [holders, setHolders] = useState<{ address: string; amount: number }[]>([]);
  const [loadingHolders, setLoadingHolders] = useState(false);
  const [isHoldersModalOpen, setIsHoldersModalOpen] = useState(false);

  useEffect(() => {
    async function fetchMetadata() {
      if (!tokenAddress) return;
      
      try {
        setLoading(true);
        setError(null);

        const umi = createUmi("https://rpc.devnet.soo.network/rpc").use(mplTokenMetadata());
        
        // Registrar programas necesarios
        umi.programs.add({
          name: "mplTokenMetadata",
          publicKey: publicKey("6C4GR9AtMGF25sjXKtdB7A6NVQUudEQWw97kG61pGuA1"),
          getErrorFromCode: () => null,
          getErrorFromName: () => null,
          isOnCluster: () => true,
        }, true);

        const asset = await fetchDigitalAsset(umi, publicKey(tokenAddress));
        
        let jsonMetadata = null;
        if (asset.metadata.uri) {
          const response = await fetch(asset.metadata.uri);
          jsonMetadata = await response.json();
        }

        setMetadata({
          name: asset.metadata.name,
          symbol: asset.metadata.symbol,
          uri: asset.metadata.uri,
          supply: Number(asset.mint.supply),
          decimals: asset.mint.decimals,
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
            dataSize: 165, // Size of a token account
          },
          {
            memcmp: {
              offset: 0,
              bytes: mintPubkey.toBase58(),
            },
          },
        ],
      });

      // Process accounts to get actual holders
      const holdersData = accounts
        .map(account => {
          // Decode account data using AccountLayout
          const accountInfo = AccountLayout.decode(account.account.data);
          
          // Get balance and actual owner
          const amount = Number(accountInfo.amount);
          const ownerAddress = accountInfo.owner.toBase58();

          if (amount > 0) {
            return {
              address: ownerAddress, // Use owner address instead of ATA
              tokenAccount: account.pubkey.toBase58(), // Optional: also store ATA address
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
      ) : metadata && (
        <div className="bg-black/40 rounded-xl border border-purple-800/30 overflow-hidden mt-4">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              {metadata.jsonMetadata?.image ? (
                <div className="w-16 h-16 rounded-full overflow-hidden border border-purple-800/30">
                  <img 
                    src={metadata.jsonMetadata.image}
                    alt={metadata.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-red-500 rounded-full"></div>
              )}
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-red-300 to-purple-400 text-transparent bg-clip-text">
                  {metadata.name}
                </h2>
                <p className="text-purple-400">{metadata.jsonMetadata?.symbol}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-black/60 p-4 rounded-lg border border-purple-800/20">
                <h3 className="text-gray-400 text-sm mb-1">Token Address</h3>
                <p className="font-mono text-sm text-white break-all">{tokenAddress}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-black/60 p-4 rounded-lg border border-purple-800/20">
                  <h3 className="text-gray-400 text-sm mb-1">Current Supply</h3>
                  <p className="font-mono text-sm text-white">
                    {(metadata.supply / Math.pow(10, metadata.decimals)).toLocaleString()}
                  </p>
                </div>
                <div className="bg-black/60 p-4 rounded-lg border border-purple-800/20">
                  <h3 className="text-gray-400 text-sm mb-1">Decimals</h3>
                  <p className="font-mono text-sm text-white">{metadata.decimals}</p>
                </div>
              </div>

              {metadata.jsonMetadata && Object.entries(metadata.jsonMetadata).map(([key, value]) => {
                if (['name', 'symbol', 'image'].includes(key)) return null;
                
                if (key === 'creator') {
                  return (
                    <div key={key} className="space-y-2">
                      <h3 className="text-gray-400 text-sm mb-2 capitalize">Creator</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-black/60 p-4 rounded-lg border border-purple-800/20">
                          <h3 className="text-gray-400 text-sm mb-1">Name</h3>
                          <p className="text-white">{value.name}</p>
                        </div>
                        <div className="bg-black/60 p-4 rounded-lg border border-purple-800/20">
                          <h3 className="text-gray-400 text-sm mb-1">Site</h3>
                          <a 
                            href={value.site} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            {value.site}
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={key} className="bg-black/60 p-4 rounded-lg border border-purple-800/20">
                    <h3 className="text-gray-400 text-sm mb-1 capitalize">{key}</h3>
                    <p className="text-white break-all">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : value.toString()}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {metadata && (
        <div className="mt-4">
          <button
            onClick={() => setIsHoldersModalOpen(true)}
            className="w-full px-4 py-3 bg-black/60 rounded-lg border border-purple-800/20 hover:border-purple-500/50 transition-colors text-purple-400 hover:text-purple-300 flex items-center justify-center gap-2"
          >
            <span>Click to See Token Holders</span>
            {loadingHolders ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
            ) : (
              <span className="text-sm">({holders.length})</span>
            )}
          </button>

          <HoldersModal
            isOpen={isHoldersModalOpen}
            onClose={() => setIsHoldersModalOpen(false)}
            holders={holders}
            symbol={metadata.symbol}
            tokenName={metadata.name}
            totalSupply={metadata.supply / Math.pow(10, metadata.decimals)}
          />
        </div>
      )}

    </div>
  );
}
