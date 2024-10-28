# Token Explorer

# Token Explorer

A Next.js project for exploring and creating tokens on the Solana blockchain.

## Features

- Token exploration
- Fungible token creation
- Token metadata visualization
- Solana wallet integration
- IPFS metadata and image storage via Pinata

## Prerequisites

- Node.js 18.x or higher
- Phantom wallet installed
- SOL on Devnet (minimum 0.1 SOL for token creation)
- Pinata account for IPFS

## Environment Variables

Create a `.env.local` file in the root directory with:

NEXT_PUBLIC_PINATA_API_KEY=your_pinata_api_key
NEXT_PUBLIC_PINATA_SECRET_KEY=your_pinata_secret_key
NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt

## Installation

npm install

# or

yarn install

# or

pnpm install

## Running the Project

npm run dev

# or

yarn dev

# or

pnpm dev

Open http://localhost:3000 in your browser.

## Usage

1. Connect your backpack wallet with the SOON RPC (https://rpc.devnet.soo.network/rpc)
2. Ensure you have SOL on SOON RPC

    - Get sep ETH from SOON faucet (https://faucet.soo.network/)
    - Or use SOON bridge if you have ETH on Sepolia (https://bridge.devnet.soo.network/home)
3. To create a token:

    - Click on "Create New Token"
    - Fill in token details
    - Upload an image for the token
    - Confirm the transaction in your wallet

## Technologies Used

- Next.js
- TypeScript
- Solana Web3.js
- Metaplex Foundation SDK
- Tailwind CSS
- Pinata (IPFS)

## Contributions

Contributions are welcome. Please open an issue or submit a pull request.

## Developer

Edgar Alfredo - [@EdgarRi62992282](https://twitter.com/EdgarRi62992282)