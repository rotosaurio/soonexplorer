import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey } from '@solana/web3.js';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";
import { Option } from '@metaplex-foundation/umi';
import NodeCache from 'node-cache';

interface Creator {
  address: string;
  verified: boolean;
  share: number;
}

const getFirstCreator = (creators: Option<Creator[]>): string => {
  if ('value' in creators && Array.isArray(creators.value) && creators.value.length > 0) {
    return creators.value[0].address.toString();
  }
  return 'Unknown';
};

const cache = new NodeCache({ stdTTL: 900 }); // 15 minutos
const CACHE_KEY = 'recent_tokens';
const TOKENS_TO_FIND = 20;

// Función helper para esperar entre requests
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchTokensFromChain() {
  const connection = new Connection("https://rpc.devnet.soo.network/rpc");
  const umi = createUmi("https://rpc.devnet.soo.network/rpc").use(mplTokenMetadata());
  
  umi.programs.add({
    name: "mplTokenMetadata",
    publicKey: publicKey("6C4GR9AtMGF25sjXKtdB7A6NVQUudEQWw97kG61pGuA1"),
    getErrorFromCode: () => null,
    getErrorFromName: () => null,
    isOnCluster: () => true,
  }, true);

  const tokens = [];
  let beforeSignature = undefined;
  
  while (tokens.length < TOKENS_TO_FIND) {
    try {
      // Obtener signatures con un límite más pequeño
      const signatures = await connection.getSignaturesForAddress(
        new PublicKey("6C4GR9AtMGF25sjXKtdB7A6NVQUudEQWw97kG61pGuA1"),
        { 
          limit: 20,
          before: beforeSignature 
        }
      );

      if (signatures.length === 0) {
        console.log('🔍 No more transactions found');
        break;
      }

      console.log(`📥 Processing batch of ${signatures.length} transactions...`);

      // Procesar transacciones una por una con delay
      for (const sig of signatures) {
        try {
          // Esperar entre cada transacción
          await sleep(200); // 200ms entre cada request

          const tx = await connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          });
          if (!tx?.meta) continue;

          const mintAddress = tx.transaction.message.staticAccountKeys[1]?.toString();
          if (!mintAddress) continue;

          const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));
          const isNft = Number(asset.mint.supply) === 1 && asset.mint.decimals === 0;
          if (isNft) continue;

          let jsonMetadata = null;
          if (asset.metadata.uri) {
            await sleep(100); // Pequeño delay antes de fetch metadata
            try {
              const response = await fetch(asset.metadata.uri);
              jsonMetadata = await response.json();
            } catch {
              // Continue without metadata
            }
          }

          const token = {
            address: mintAddress,
            name: asset.metadata.name,
            symbol: asset.metadata.symbol,
            image: jsonMetadata?.image,
            creator: getFirstCreator(asset.metadata.creators),
            createdAt: sig.blockTime ? sig.blockTime * 1000 : Date.now(),
          };

          console.log('🪙 Token found:', {
            name: token.name,
            symbol: token.symbol,
            creator: token.creator,
            date: new Date(token.createdAt).toLocaleString()
          });

          tokens.push(token);

          if (tokens.length >= TOKENS_TO_FIND) {
            console.log('✅ Token target reached');
            break;
          }
        } catch (error) {
          continue;
        }
      }

      // Esperar entre lotes de signatures
      await sleep(500); // 500ms entre lotes
      beforeSignature = signatures[signatures.length - 1].signature;

    } catch (error) {
      console.error('Batch error:', error);
      await sleep(1000); // Esperar más tiempo si hay error
      continue;
    }
  }

  console.log('✅ Search completed. Total tokens:', tokens.length);
  return tokens.slice(0, TOKENS_TO_FIND);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    let tokens = cache.get(CACHE_KEY);

    if (!tokens) {
      console.log('🔄 Cache empty, fetching new tokens...');
      tokens = await fetchTokensFromChain();
      cache.set(CACHE_KEY, tokens);
      console.log('💾 Tokens saved to cache');
    } else {
      console.log('📦 Tokens retrieved from cache');
    }

    res.status(200).json(tokens);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ error: 'Error fetching tokens' });
  }
} 