import Image from "next/image";
import localFont from "next/font/local";
import TokenMetadata from '../components/TokenMetadata';

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
  return (
    <div className={`${geistSans.variable} ${geistMono.variable} min-h-screen p-8`}>
      <main className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          Token Explorer In SOON
        </h1>
        <TokenMetadata />
      </main>
    </div>
  );
}
