import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey, ConfirmedSignatureInfo } from '@solana/web3.js';
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

interface Token {
  address: string;
  name: string;
  symbol: string;
  image?: string;
  creator: string;
  createdAt: number;
}

interface FetchTokensResponse {
  tokens: Token[];
  timeElapsed: number;
}

interface TransactionSignature {
  signature: string;
  blockTime?: number | null;
}

interface RpcError {
  message?: string;
  code?: number;
}

const getFirstCreator = (creators: Option<Creator[]>): string => {
  if ('value' in creators && Array.isArray(creators.value) && creators.value.length > 0) {
    return creators.value[0].address.toString();
  }
  return 'Unknown';
};

const cache = new NodeCache({ 
  stdTTL: 900,
  checkperiod: 120,
  useClones: false,
  deleteOnExpire: false
});

const CACHE_KEY = 'recent_tokens';
const TOKENS_TO_FIND = 20;
const CACHE_TTL = 15 * 60;
const BATCH_SIZE = 65;
const MAX_CONCURRENT = 28;
const BATCH_DELAY = 32;
const MINI_BATCH_SIZE = 56;
const MINI_REST = 60;
const BATCH_REST = 200;
const TARGET_SPEED = 29;
const INITIAL_DELAY = 5;
const MAX_RETRIES = 1;
const ERROR_THRESHOLD = 0.3;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function processTransactionWithRetry(
  sig: ConfirmedSignatureInfo, 
  connection: Connection, 
  umi: any,
  retryCount = 0
): Promise<Token | null> {
  try {
    if (retryCount > 0) {
      await sleep(INITIAL_DELAY * retryCount);
    }

    const tx = await connection.getTransaction(sig.signature, {
      maxSupportedTransactionVersion: 0
    });

    if (!tx?.meta) return null;
    const mintAddress = tx.transaction.message.staticAccountKeys[1]?.toString();
    if (!mintAddress) return null;

    try {
      const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));
      
      if (!asset?.metadata?.name || !asset?.metadata?.symbol) return null;
      
      if (asset.mint.decimals === 0 && Number(asset.mint.supply) === 1) {
        return null;
      }

      if (asset.mint.decimals === 0) {
        return null;
      }

      let imageUrl = '';
      try {
        const metadataResponse = await fetch(asset.metadata.uri);
        if (!metadataResponse.ok) throw new Error('Metadata fetch failed');
        const metadata = await metadataResponse.json();
        imageUrl = metadata.image || '';
      } catch (error) {
        console.log(`Error fetching metadata for ${mintAddress}:`, error);
      }

      return {
        address: mintAddress,
        name: asset.metadata.name,
        symbol: asset.metadata.symbol,
        image: imageUrl,
        creator: getFirstCreator(asset.metadata.creators),
        createdAt: sig.blockTime ? sig.blockTime * 1000 : Date.now(),
      };
    } catch (error: unknown) {
      const rpcError = error as RpcError;
      if (rpcError.message?.includes('429') && retryCount < MAX_RETRIES) {
        await sleep(INITIAL_DELAY * retryCount);
        return processTransactionWithRetry(sig, connection, umi, retryCount + 1);
      }
      return null;
    }
  } catch (error: unknown) {
    const rpcError = error as RpcError;
    if (rpcError.message?.includes('429') && retryCount < MAX_RETRIES) {
      await sleep(INITIAL_DELAY * retryCount);
      return processTransactionWithRetry(sig, connection, umi, retryCount + 1);
    }
    return null;
  }
}

async function processBatchWithThrottle(
  signatures: ConfirmedSignatureInfo[],
  connection: Connection,
  umi: any,
  currentTotal: number
): Promise<Token[]> {
  const tokens: Token[] = [];
  const batchStartTime = performance.now();
  let processedTx = 0;
  let currentDelay = BATCH_DELAY;
  let batchNumber = Math.floor(currentTotal / BATCH_SIZE) + 1;

  for (let i = 0; i < signatures.length && currentTotal + tokens.length < TOKENS_TO_FIND; i += MINI_BATCH_SIZE) {
    const remainingNeeded = TOKENS_TO_FIND - (currentTotal + tokens.length);
    const currentBatchSize = Math.min(MINI_BATCH_SIZE, remainingNeeded, signatures.length - i);
    
    // Solo ser conservador en el tercer batch
    if (batchNumber === 3) {
      currentDelay = Math.max(currentDelay, 36);
    }

    for (let j = 0; j < currentBatchSize; j += MAX_CONCURRENT) {
      const batchSize = Math.min(MAX_CONCURRENT, currentBatchSize - j);
      const batch = signatures.slice(i + j, i + j + batchSize);

      await sleep(currentDelay);

      const results = await Promise.all(
        batch.map(sig => processTransactionWithRetry(sig, connection, umi, 0))
      );
      
      const validTokens = results.filter((t): t is Token => t !== null);
      const errorCount = results.filter(r => r === null).length;
      
      tokens.push(...validTokens);
      processedTx += batchSize;
      
      const txPerSecond = processedTx / ((performance.now() - batchStartTime) / 1000);
      
      // Control de velocidad más permisivo
      if (batchNumber === 3) {
        if (txPerSecond > TARGET_SPEED - 2) {
          currentDelay = Math.min(40, currentDelay + 2);
        }
      } else {
        if (txPerSecond > TARGET_SPEED + 3) {
          currentDelay = Math.min(36, currentDelay + 2);
        } else if (txPerSecond < TARGET_SPEED - 3) {
          currentDelay = Math.max(30, currentDelay - 1);
        }
      }

      console.log(`📊 Stats: ${processedTx} tx, ${txPerSecond.toFixed(1)} tx/s (errors: ${errorCount}, delay: ${currentDelay}ms)`);
    }

    if (i + MINI_BATCH_SIZE < signatures.length && processedTx < TOKENS_TO_FIND) {
      const extraRest = batchNumber === 3 ? 40 : 0;
      await sleep(MINI_REST + extraRest);
    }
  }

  return tokens;
}

let isProcessing = false; 

async function fetchTokensFromChain(): Promise<FetchTokensResponse> {
  if (isProcessing) {
    return { tokens: [], timeElapsed: 0 };
  }

  isProcessing = true;
  const startTime = performance.now();
  console.log('Starting token search...');

  let totalTxProcessed = 0;
  let totalBatches = 0;
  const speedMeasurements: number[] = [];

  try {
    const connection = new Connection("https://rpc.devnet.soo.network/rpc", {
      commitment: 'confirmed'
    });
    
    const umi = createUmi("https://rpc.devnet.soo.network/rpc").use(mplTokenMetadata());
    umi.programs.add({
      name: "mplTokenMetadata",
      publicKey: publicKey("6C4GR9AtMGF25sjXKtdB7A6NVQUudEQWw97kG61pGuA1"),
      getErrorFromCode: () => null,
      getErrorFromName: () => null,
      isOnCluster: () => true,
    }, true);

    const tokens: Token[] = [];
    let lastSignature: string | undefined = undefined;
    let batchCount = 0;

    while (tokens.length < TOKENS_TO_FIND) {
      batchCount++;
      totalBatches++;
      const batchStartTime = performance.now();
      
      const signatures = await connection.getSignaturesForAddress(
        new PublicKey("6C4GR9AtMGF25sjXKtdB7A6NVQUudEQWw97kG61pGuA1"),
        { limit: BATCH_SIZE, before: lastSignature }
      );

      if (signatures.length === 0) break;

      if (batchCount > 1) {
        if (batchCount === 4) {
          console.log('Special pause after the fourth batch...');
          await sleep(1500);
        } else {
          await sleep(BATCH_REST);
        }
      }

      const batchTokens = await processBatchWithThrottle(signatures, connection, umi, tokens.length);
      tokens.push(...batchTokens.slice(0, TOKENS_TO_FIND - tokens.length));
      
      const batchTime = (performance.now() - batchStartTime) / 1000;
      const batchSpeed = signatures.length / batchTime;
      speedMeasurements.push(batchSpeed);
      totalTxProcessed += signatures.length;

      console.log(`Batch ${batchCount}: ${signatures.length} txs in ${batchTime.toFixed(1)}s - Found ${batchTokens.length} tokens (Total: ${tokens.length})`);

      if (tokens.length >= TOKENS_TO_FIND) break;
      lastSignature = signatures[signatures.length - 1].signature;
    }

    const totalTime = (performance.now() - startTime) / 1000;
    const averageSpeed = speedMeasurements.reduce((a, b) => a + b, 0) / speedMeasurements.length;
    
    console.log(`Performance Summary:`);
    console.log(`Total Transactions: ${totalTxProcessed}`);
    console.log(`Total Batches: ${totalBatches}`);
    console.log(`Average Speed: ${averageSpeed.toFixed(1)} tx/s`);
    console.log(`Total Time: ${totalTime.toFixed(1)}s`);

    return {
      tokens: tokens.slice(0, TOKENS_TO_FIND),
      timeElapsed: totalTime * 1000
    };
  } finally {
    isProcessing = false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const handlerStart = performance.now();
  
  try {
    console.log('Checking cache...');
    const cachedTokens = cache.get(CACHE_KEY) as Token[];
    
    if (cachedTokens?.length === TOKENS_TO_FIND) {
      const cacheAge = (Date.now() - cachedTokens[0].createdAt) / 1000;
      console.log(`Found ${cachedTokens.length} tokens in cache (${cacheAge.toFixed(0)}s old)`);
      
      return res.status(200).json({
        tokens: cachedTokens,
        searchTime: 0
      });
    }

    console.log('Cache miss, fetching new tokens...');
    const result = await fetchTokensFromChain();
    
    if (result.tokens.length > 0) {
      console.log(`Saving ${result.tokens.length} tokens to cache (TTL: ${CACHE_TTL}s)`);
      cache.set(CACHE_KEY, result.tokens, CACHE_TTL);
    }
    
    const totalTime = performance.now() - handlerStart;
    console.log(`Total handler time: ${(totalTime/1000).toFixed(2)}s`);

    return res.status(200).json({
      tokens: result.tokens,
      searchTime: result.timeElapsed
    });

  } catch (error) {
    console.error('Handler error:', error);
    const cachedTokens = cache.get(CACHE_KEY) as Token[] || [];
    console.log(`Falling back to cache (${cachedTokens.length} tokens)`);
    
    return res.status(200).json({
      tokens: cachedTokens,
      searchTime: 0
    });
  }
}

declare global {
  var __tokenCache: Token[] | undefined;
}