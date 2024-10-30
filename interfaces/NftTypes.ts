interface NftMetadata {
  name: string;
  symbol: string;
  description: string;
  image: File | null;
  attributes?: {
    trait_type: string;
    value: string;
  }[];
}

interface CollectionMetadata {
  name: string;
  symbol: string;
  description: string;
  image: File | null;
  maxSupply: number;
}

interface MintingCosts {
  FREE_NFT_COST: number;
  PAID_NFT_COST: number;
  COLLECTION_CREATION_COST: number;
  COLLECTION_NFT_COST: number;
}

interface MintingLimits {
  FREE_MINTS_PER_DAY: number;
  FREE_MINT_COOLDOWN_HOURS: number;
} 