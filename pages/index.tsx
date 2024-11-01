import { useState } from 'react';
import Image from "next/image";
import localFont from "next/font/local";
import TokenMetadata from '../components/TokenMetadata';
import WalletButton from '../components/WalletButton';
import CreateToken from '../components/CreateToken';
import NftMinter from '../components/NftMinter';

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export default function Home() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className={`${geistSans.variable} ${geistMono.variable} min-h-screen relative bg-gradient-to-br from-black via-purple-900/20 to-red-900/20`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0)1px,#000000_1px)] bg-[size:4px_4px] pointer-events-none opacity-50" />
      
      <div className="relative p-2 sm:p-4 md:p-8">
        <div className="flex flex-row justify-center sm:justify-between items-center gap-2 sm:gap-4 mb-4 sm:mb-8">
          <WalletButton />
          <CreateToken />
        </div>

        <main className="w-full max-w-7xl mx-auto px-2 sm:px-4">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-8 text-center bg-gradient-to-r from-purple-400 via-red-300 to-purple-400 text-transparent bg-clip-text">
            Token Explorer in SOON 
          </h1>
          <div className="grid grid-cols-1 gap-4 sm:gap-8">
            <TokenMetadata />
          </div>
        </main>

        <div className="fixed bottom-2 sm:bottom-4 left-2 sm:left-4 flex items-center gap-2 scale-75 sm:scale-100">

          <Image 
            src="/NovaLaunch.png" 
            alt="Logo 2" 
            width={45} 
            height={45} 
            className="opacity-75 hover:opacity-100 transition-opacity -ml-2" 
          />
        </div>

        <div className="fixed bottom-14 sm:bottom-16 right-2 sm:right-4 text-gray-400 text-[10px] sm:text-xs md:text-sm bg-gradient-to-r from-purple-500/10 to-red-500/10 p-2 rounded-lg backdrop-blur-sm cursor-pointer hover:from-purple-500/20 hover:to-red-500/20 transition-colors">
          <span onClick={() => setShowForm(!showForm)}>
            Mint Your Own NFT
          </span>
        </div>

        {showForm && <NftMinter onClose={() => setShowForm(false)} />}

        <div className="fixed bottom-2 sm:bottom-4 right-2 sm:right-4 text-gray-400 text-[10px] sm:text-xs md:text-sm bg-gradient-to-r from-purple-500/10 to-red-500/10 p-2 rounded-lg backdrop-blur-sm">
          Powered by SOON • Built by <a 
            href="https://x.com/EdgarRi62992282" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            Edgar Alfredo
          </a>
        </div>
      </div>
    </div>
  );
}