import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const walletKey = process.env.INTERNAL_WALLET_KEY;
    if (!walletKey) {
      throw new Error('Wallet key not found');
    }

    res.status(200).json({ key: walletKey });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get wallet key' });
  }
} 