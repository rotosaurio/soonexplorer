import { useEffect, useState } from 'react';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";
import TokenSearch from './TokenSearch';
interface TokenMetadata {
    name: string;
    symbol: string;
    uri: string;
    supply: number;
    decimals: number;
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

export default function TokenMetadata() {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);

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

  return (
    <div className="max-w-4xl mx-auto">
      <TokenSearch onSearch={setTokenAddress} />
      {!tokenAddress ? (
        <div className="text-center p-8 bg-[#0B1416] rounded-xl border border-purple-800">
          <h2 className="text-xl text-gray-300 mb-2">Token Explorer</h2>
          <p className="text-gray-500">Enter a token address to view its metadata</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 p-4 text-center bg-[#0B1416] rounded-xl border border-purple-800">
          Error: {error}
        </div>
      ) : metadata && (
        <div className="bg-[#0B1416] rounded-xl border border-purple-800 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              {metadata.jsonMetadata?.image ? (
                <div className="w-16 h-16 rounded-full overflow-hidden">
                  <img 
                    src={metadata.jsonMetadata.image}
                    alt={metadata.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-yellow-500 rounded-full"></div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-white">{metadata.name}</h2>
                <p className="text-purple-400">{metadata.jsonMetadata?.symbol}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-black/20 p-4 rounded-lg">
                <h3 className="text-gray-400 text-sm mb-1">Token Address</h3>
                <p className="font-mono text-sm text-white break-all">{tokenAddress}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 p-4 rounded-lg">
                  <h3 className="text-gray-400 text-sm mb-1">Current Supply</h3>
                  <p className="font-mono text-sm text-white">
                    {(metadata.supply / Math.pow(10, metadata.decimals)).toLocaleString()}
                  </p>
                </div>
                <div className="bg-black/20 p-4 rounded-lg">
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
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/20 p-4 rounded-lg">
                          <h3 className="text-gray-400 text-sm mb-1">Name</h3>
                          <p className="text-white">{value.name}</p>
                        </div>
                        <div className="bg-black/20 p-4 rounded-lg">
                          <h3 className="text-gray-400 text-sm mb-1">Site</h3>
                          <a 
                            href={value.site} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-purple-400 hover:text-purple-300 underline"
                          >
                            {value.site}
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={key} className="bg-black/20 p-4 rounded-lg">
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
      <div className="fixed bottom-4 right-4 text-gray-500 text-sm">
        Powered by SOON • Built by Edgar Alfredo 
      </div>
    </div>
  );
}
