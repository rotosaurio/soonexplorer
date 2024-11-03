import { useState } from 'react';
import Image from "next/image";
import localFont from "next/font/local";
import TokenMetadata from '../components/TokenMetadata';
import WalletButton from '../components/WalletButton';
import CreateToken from '../components/CreateToken';
import NftMinter from '../components/NftMinter';
import RecentTokens from '../components/RecentTokens';

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
  const [showTokenForm, setShowTokenForm] = useState(false);

  return (
    <div className={`${geistSans.variable} ${geistMono.variable} min-h-screen relative bg-gradient-to-br from-black via-purple-900/20 to-red-900/20`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0)1px,#000000_1px)] bg-[size:4px_4px] pointer-events-none opacity-50" />
      
      <div className="relative p-2 sm:p-4 md:p-8">
        <div className="flex flex-row justify-between items-center gap-2 sm:gap-4 mb-4 sm:mb-8">
          <div className="flex items-center">
            <Image 
              src="/soonxlogocompleto.png" 
              alt="SOON Logo" 
              width={160}
              height={53}
              className="opacity-75 hover:opacity-100 transition-opacity" 
            />
          </div>
          <WalletButton />
        </div>

        <main className="w-full max-w-7xl mx-auto px-2 sm:px-4 mb-24">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-8 text-center bg-gradient-to-r from-purple-400 via-red-300 to-purple-400 text-transparent bg-clip-text">
            Token Explorer in SOON 
          </h1>
          <div className="grid grid-cols-1 gap-4 sm:gap-8 mt-8 sm:mt-0">
            <TokenMetadata />
          </div>
          
          <div className="mt-8">
            <RecentTokens />
          </div>
        </main>

        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent pt-16 pb-4 px-4">
          <div className="max-w-7xl mx-auto flex flex-col items-center gap-4">
            {/* Logo SOON - solo visible en PC */}
            <div className="hidden sm:flex sm:justify-start">
              <Image 
                src="/NovaLaunch.png" 
                alt="Logo 2" 
                width={45} 
                height={45} 
                className="opacity-75 hover:opacity-100 transition-opacity" 
              />
            </div>

            {/* Logo SOON - solo visible en móvil */}
            <div className="sm:hidden mb-4">
              <Image 
                src="/NovaLaunch.png" 
                alt="Logo 2" 
                width={45} 
                height={45} 
                className="opacity-75 hover:opacity-100 transition-opacity" 
              />
            </div>

            {/* Botones - en móvil */}
            <div className="flex flex-row gap-2 sm:hidden">
              <button
                onClick={() => setShowTokenForm(!showTokenForm)}
                className="text-gray-400 text-sm bg-gradient-to-r from-purple-500/10 to-red-500/10 p-2 rounded-lg backdrop-blur-sm hover:from-purple-500/20 hover:to-red-500/20 transition-colors"
              >
                Create New Token
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="text-gray-400 text-sm bg-gradient-to-r from-purple-500/10 to-red-500/10 p-2 rounded-lg backdrop-blur-sm hover:from-purple-500/20 hover:to-red-500/20 transition-colors"
              >
                Mint Your Own NFT
              </button>
            </div>

            {/* Powered by SOON - en móvil */}
            <div className="flex justify-center sm:hidden">
              <div className="text-gray-400 text-xs bg-gradient-to-r from-purple-500/10 to-red-500/10 p-2 rounded-lg backdrop-blur-sm">
                Powered by SOON • Built by{" "}
                <a 
                  href="https://x.com/EdgarRi62992282" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Edgar Alfredo
                </a>
              </div>
            </div>

            {/* Contenido para PC - mantener el grid de 3 columnas */}
            <div className="hidden sm:grid sm:grid-cols-3 sm:w-full sm:items-center">
              <div className="flex justify-start">
                <CreateToken />
              </div>
              <div className="flex justify-center">
                <div className="text-gray-400 text-sm bg-gradient-to-r from-purple-500/10 to-red-500/10 p-2 rounded-lg backdrop-blur-sm">
                  Powered by SOON • Built by{" "}
                  <a 
                    href="https://x.com/EdgarRi62992282" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Edgar Alfredo
                  </a>
                </div>
              </div>
              <div className="flex justify-end">
                <span 
                  onClick={() => setShowForm(!showForm)}
                  className="text-gray-400 text-sm bg-gradient-to-r from-purple-500/10 to-red-500/10 p-2 rounded-lg backdrop-blur-sm hover:from-purple-500/20 hover:to-red-500/20 transition-colors cursor-pointer"
                >
                  Mint Your Own NFT
                </span>
              </div>
            </div>
          </div>
        </div>

        {showForm && <NftMinter onClose={() => setShowForm(false)} />}
      </div>
    </div>
  );
}