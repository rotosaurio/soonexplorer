import { useState, useEffect, useCallback } from 'react';

interface RecentToken {
  address: string;
  name: string;
  symbol: string;
  image?: string;
  creator: string;
  createdAt: number;
}

interface TokenResponse {
  tokens: RecentToken[];
  searchTime: number;
  isSearching?: boolean;
}

export default function RecentTokens() {
  const [tokens, setTokens] = useState<RecentToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<number>(0);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const handleTokenClick = useCallback((address: string) => {
    window.dispatchEvent(new CustomEvent('updateTokenSearch', { detail: { address } }));
  }, []);

  const fetchTokens = useCallback(async () => {
    try {
      console.log('🔄 Fetching tokens...');
      const response = await fetch('/api/recent-tokens');
      if (!response.ok) throw new Error('Server response error');
      
      const data: TokenResponse = await response.json();
      
      setTokens(prevTokens => {
        // Solo actualizar si hay cambios
        const newTokensString = JSON.stringify(data.tokens);
        const prevTokensString = JSON.stringify(prevTokens);
        if (newTokensString !== prevTokensString) {
          console.log('📥 New tokens found, updating state');
          return data.tokens;
        }
        console.log('📦 No changes in tokens, keeping current state');
        return prevTokens;
      });

      setSearchTime(data.searchTime);
      setLastUpdate(Date.now());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('❌ Error fetching tokens:', err);
    } finally {
      setLoading(false);
    }
  }, []); // Sin dependencias

  useEffect(() => {
    // Fetch inicial
    fetchTokens();
    
    // Intervalo de actualización cada 15 minutos
    const interval = setInterval(() => {
      console.log('⏰ Checking if update is needed...');
      const timeSinceLastUpdate = Date.now() - lastUpdate;
      if (timeSinceLastUpdate >= 15 * 60 * 1000) { // 15 minutos
        console.log('🔄 15 minutes passed, fetching new tokens...');
        fetchTokens();
      } else {
        console.log(`⏳ Next update in ${((15 * 60 * 1000 - timeSinceLastUpdate)/1000).toFixed(0)}s`);
      }
    }, 60 * 1000); // Revisar cada minuto
    
    return () => {
      console.log('🧹 Cleaning up interval');
      clearInterval(interval);
    };
  }, []); // Solo se ejecuta una vez al montar el componente

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-center text-purple-400">
          Recently Created Tokens
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            {tokens.length}/20 tokens
          </span>
          {searchTime > 0 && (
            <span className="text-xs text-gray-500">
              ({(searchTime / 1000).toFixed(2)}s)
            </span>
          )}
          {loading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500" />
          )}
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm mb-4 text-center">
          {error}
        </div>
      )}

      <div className="space-y-3 mb-20">
        {loading && tokens.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            <p className="text-sm text-gray-400">Buscando tokens...</p>
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No se encontraron tokens
          </div>
        ) : (
          tokens.map((token) => (
            <TokenCard 
              key={token.address} 
              token={token} 
              onClick={() => handleTokenClick(token.address)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Componente separado para el TokenCard para mejorar rendimiento
const TokenCard = ({ token, onClick }: { token: RecentToken; onClick: () => void }) => (
  <div 
    onClick={onClick}
    className="bg-black/40 rounded-lg p-3 border border-purple-800/30 hover:border-purple-500/50 transition-colors cursor-pointer"
  >
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {token.image ? (
        <img 
          src={token.image}
          alt={token.name}
          className="w-12 h-12 rounded-lg object-contain bg-black/60"
          loading="lazy"
          onError={(e) => {
            console.log(`Error loading image for ${token.name}`);
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-black/60 flex items-center justify-center">
          <span className="text-purple-400 text-xs">{token.symbol}</span>
        </div>
      )}
      <div className="flex-grow">
        <h3 className="text-purple-400 font-medium">{token.name}</h3>
        <p className="text-gray-400 text-sm">{token.symbol}</p>
      </div>
      <div className="text-right text-xs text-gray-400 w-full sm:w-auto">
        <p>Created by:</p>
        <p className="font-mono truncate max-w-[120px] sm:max-w-[200px]">
          {token.creator}
        </p>
        <p>{new Date(token.createdAt).toLocaleString()}</p>
      </div>
    </div>
  </div>
);