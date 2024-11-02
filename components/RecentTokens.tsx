import { useState, useEffect } from 'react';

interface RecentToken {
  address: string;
  name: string;
  symbol: string;
  image?: string;
  creator: string;
  createdAt: number;
  isNft: boolean;
}

export default function RecentTokens() {
  const [tokens, setTokens] = useState<RecentToken[]>([]);
  const [loading, setLoading] = useState(true);

  const handleTokenClick = (address: string) => {
    const event = new CustomEvent('updateTokenSearch', {
      detail: { address }
    });
    window.dispatchEvent(event);
  };

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const response = await fetch('/api/recent-tokens');
        const data = await response.json();
        setTokens(prevTokens => {
          if (JSON.stringify(prevTokens) !== JSON.stringify(data)) {
            return data;
          }
          return prevTokens;
        });
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
    const interval = setInterval(fetchTokens, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4 text-center text-purple-400">
        Recently Created Tokens
      </h2>

      <div className="space-y-3 mb-20">
        {loading && tokens.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          tokens.map((token) => (
            <div 
              key={token.address}
              onClick={() => handleTokenClick(token.address)}
              className="bg-black/40 rounded-lg p-3 border border-purple-800/30 hover:border-purple-500/50 transition-colors cursor-pointer"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {token.image && (
                  <img 
                    src={token.image}
                    alt={token.name}
                    className="w-12 h-12 rounded-lg object-contain bg-black/60"
                  />
                )}
                <div className="flex-grow">
                  <h3 className="text-purple-400 font-medium">{token.name}</h3>
                  <p className="text-gray-400 text-sm">{token.symbol}</p>
                </div>
                <div className="text-right text-xs text-gray-400 w-full sm:w-auto">
                  <p>Created by:</p>
                  <p className="font-mono truncate max-w-[120px] sm:max-w-[200px]">{token.creator}</p>
                  <p>{new Date(token.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 