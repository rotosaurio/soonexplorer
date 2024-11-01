import { useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
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
                  isNft
                };
              } catch (err) {
                return {
                  address: mintAddress,
                  symbol: 'Unknown',
                  name: 'Unknown Token',
                  image: '',
                  amount: amount,
                  isNft: false
                };
              }
            })
        );

        setTokens(tokenInfos);
      } catch (err) {
        console.error('Error fetching tokens:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUserTokens();
  }, [wallet.publicKey, connection]);

  const filteredTokens = tokens.filter(token => token.isNft === showNfts);

  if (!wallet.publicKey) return null;

  return (
    <div className="fixed left-4 top-20 w-80 bg-black/40 rounded-xl border border-purple-800/30 p-4">
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

      {loading ? (
        <div className="flex justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
        </div>
      ) : filteredTokens.length > 0 ? (
        <div className="space-y-3 max-h-[calc(100vh-160px)] overflow-y-auto">
          {filteredTokens.map((token) => (
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
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 p-4">
          No {showNfts ? 'NFTs' : 'tokens'} found
        </div>
      )}
    </div>
  );
}