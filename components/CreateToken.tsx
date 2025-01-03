import { useState, useEffect } from 'react';
import axios from 'axios';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { createFungible, mintV1, TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
import { percentAmount, generateSigner, some, publicKey, Pda } from "@metaplex-foundation/umi";
import { createSignerFromWalletAdapter } from '@metaplex-foundation/umi-signer-wallet-adapters';
import Button from './Button';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { uploadImageToFilebase, uploadMetadataToFilebase, getFilebaseUrl } from '../utils/filebase';

interface TokenForm {
  name: string;
  symbol: string;
  description: string;
  image: File | null;
  mintAmount: string;
  decimals: string;
  sellerFeeBasisPoints: string;
  creatorName: string;
  creatorSite: string;
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

export default function CreateToken() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number>(0);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<TokenForm>({
    name: '',
    symbol: '',
    description: '',
    image: null,
    mintAmount: '0',
    decimals: '9',
    sellerFeeBasisPoints: '0',
    creatorName: '',
    creatorSite: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenMintAddress, setTokenMintAddress] = useState<string>('');

  useEffect(() => {
    async function checkBalance() {
      if (wallet.publicKey) {
        try {
          const balance = await connection.getBalance(wallet.publicKey);
          setBalance(balance / LAMPORTS_PER_SOL);
        } catch (error) {
          console.error('Error fetching balance:', error);
          setBalance(0);
        }
      }
    }

    checkBalance();
    const interval = setInterval(checkBalance, 30000);
    return () => clearInterval(interval);
  }, [wallet.publicKey, connection]);

  const hasMinimumBalance = balance >= 0.1;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (e.target instanceof HTMLInputElement && e.target.files) {
      setFormData({
        ...formData,
        [name]: e.target.files[0]
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const createToken = async (uri: string) => {
    if (!wallet.publicKey) throw new Error('Please connect your wallet first');

    const umi = createUmi("https://rpc.devnet.soo.network/rpc")
      .use(mplTokenMetadata());
  
    const walletAdapter = createSignerFromWalletAdapter(wallet);
    umi.identity = walletAdapter;
    umi.payer = walletAdapter;
    
    await umiSwitchToSoonDevnet(umi);

    const mint = generateSigner(umi);

    await createFungible(umi, {
      mint,
      name: formData.name,
      symbol: formData.symbol,
      uri,
      sellerFeeBasisPoints: percentAmount(Number(formData.sellerFeeBasisPoints)),
      decimals: some(Number(formData.decimals)),
    }).sendAndConfirm(umi);

    const amount = BigInt(parseFloat(formData.mintAmount) * Math.pow(10, Number(formData.decimals)));
    
    await mintV1(umi, {
      mint: mint.publicKey,
      authority: umi.identity,
      amount,
      tokenOwner: publicKey(wallet.publicKey.toBase58()) as unknown as Pda,
      tokenStandard: TokenStandard.Fungible,
    }).sendAndConfirm(umi);

    return mint.publicKey;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.image) throw new Error('Image is required');

      const { url: imageIpfsUrl, cid: imageCid } = await uploadImageToFilebase(formData.image);
      
      const metadata = {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        image: `https://assistant-scarlet-goose.myfilebase.com/ipfs/${imageCid}`,
        creator: {
          name: formData.creatorName,
          site: formData.creatorSite
        }
      };

      console.log('Token Metadata a ser minteada:', {
        ...metadata,
        mintAmount: formData.mintAmount,
        decimals: formData.decimals,
        sellerFeeBasisPoints: formData.sellerFeeBasisPoints
      });

      const { url: metadataUrl, cid: metadataCid } = await uploadMetadataToFilebase(metadata);
      
      console.log('Image CID:', imageCid);
      console.log('Metadata CID:', metadataCid);
      console.log('Metadata URL:', getFilebaseUrl(metadataCid));

      const mintAddress = await createToken(getFilebaseUrl(metadataCid));
      setTokenMintAddress(mintAddress.toString());
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {wallet.publicKey ? (
        <div>
          {hasMinimumBalance ? (
            <>
              <button
                onClick={() => setShowForm(!showForm)}
                className="text-gray-400 text-sm bg-gradient-to-r from-purple-500/10 to-red-500/10 p-2 rounded-lg backdrop-blur-sm hover:from-purple-500/20 hover:to-red-500/20 transition-colors"
              >
                Create New Token
              </button>

              {showForm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                  <div className="bg-gradient-to-br from-black via-purple-900/20 to-red-900/20 p-4 sm:p-6 rounded-xl border border-purple-800/50 w-full max-w-5xl m-2 sm:m-4 overflow-y-auto max-h-[95vh] sm:max-h-[90vh] shadow-xl shadow-purple-500/20">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold text-white">Create New Token</h2>
                      <button
                        onClick={() => setShowForm(false)}
                        className="!p-2"
                      >
                        ×
                      </button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-gray-400 text-sm mb-2">Token Name</label>
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-purple-500 transition-all duration-200"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 text-sm mb-2">Symbol</label>
                          <input
                            type="text"
                            name="symbol"
                            value={formData.symbol}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-purple-500 transition-all duration-200"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 text-sm mb-2">Description</label>
                          <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-purple-500 transition-all duration-200"
                            rows={3}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 text-sm mb-2">Image</label>
                          <input
                            type="file"
                            name="image"
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 file:bg-purple-800 file:text-white file:border-0 file:rounded-lg file:px-4 file:py-2 file:mr-4 file:hover:bg-purple-700"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 text-sm mb-2">Decimals</label>
                          <input
                            type="number"
                            name="decimals"
                            value={formData.decimals}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-purple-500 transition-all duration-200"
                            required
                            min="0"
                            max="9"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 text-sm mb-2">Initial Supply</label>
                          <input
                            type="number"
                            name="mintAmount"
                            value={formData.mintAmount}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-purple-500 transition-all duration-200"
                            required
                            min="0"
                            step="0.000000001"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 text-sm mb-2">Creator Name</label>
                          <input
                            type="text"
                            name="creatorName"
                            value={formData.creatorName}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-purple-500 transition-all duration-200"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 text-sm mb-2">Creator Site</label>
                          <input
                            type="text"
                            name="creatorSite"
                            value={formData.creatorSite}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-purple-500 transition-all duration-200"
                            required
                          />
                        </div>
                      </div>

                      <div className="mt-6 p-4 bg-black/20 rounded-lg border border-purple-800/30 text-gray-400 text-sm space-y-4">
                        <p>Make sure you have enough SOL to deploy and mint the Token.</p>
                        <p>If you don't have SOL and Sepolia ETH, go to our faucet to get them. 
                          <a href="https://faucet.soo.network/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 ml-1">
                            https://faucet.soo.network/
                          </a>
                        </p>
                        <p>If you have Sepolia ETH, go to SOON Devnet bridge to bridge in. 
                          <a href="https://bridge.devnet.soo.network/home" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 ml-1">
                            https://bridge.devnet.soo.network/home
                          </a>
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !wallet.publicKey}
                        className="w-full mt-4"
                      >
                        {loading ? 'Creating Token...' : 'Create Token'}
                      </button>
                    </form>

                    {error && (
                      <div className="mt-4 p-4 bg-black/20 rounded-lg border border-purple-800 text-purple-400">
                        {error}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              disabled
              className="text-gray-400 text-sm bg-gradient-to-r from-purple-500/10 to-red-500/10 p-2 rounded-lg backdrop-blur-sm opacity-50 cursor-not-allowed"
            >
              Create New Token
            </button>
          )}
        </div>
      ) : (
        <button
          disabled
          className="text-gray-400 text-sm bg-gradient-to-r from-purple-500/10 to-red-500/10 p-2 rounded-lg backdrop-blur-sm opacity-50 cursor-not-allowed"
        >
          Connect Wallet to Create Tokens
        </button>
      )}
    </div>
  );
}
