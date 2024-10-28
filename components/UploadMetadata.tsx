// deprecated component


import { useState } from 'react';
import axios from 'axios';

interface MetadataForm {
  name: string;
  symbol: string;
  image: string;
  description: string;
  creator: {
    name: string;
    site: string;
  };
}

export default function UploadMetadata() {
  const [metadata, setMetadata] = useState<MetadataForm>({
    name: '',
    symbol: '',
    image: '',
    description: '',
    creator: {
      name: '',
      site: ''
    }
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [ipfsHash, setIpfsHash] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`
          }
        }
      );

      const imageUrl = `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
      setMetadata(prev => ({ ...prev, image: imageUrl }));
      return imageUrl;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Error uploading image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (imageFile) {
        await handleImageUpload(imageFile);
      }

      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        metadata,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`
          }
        }
      );
      
      setIpfsHash(response.data.IpfsHash);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error uploading to IPFS');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [section, field] = name.split('.');
      setMetadata(prev => ({
        ...prev,
        [section]: {
          ...(prev[section as keyof MetadataForm] as Record<string, string>),
          [field]: value
        }
      }));
    } else {
      setMetadata(prev => ({ ...prev, [name]: value }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-[#0B1416] rounded-xl border border-purple-800">
      <h2 className="text-2xl font-bold text-white mb-6">Upload Token Metadata</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Token Name</label>
            <input
              type="text"
              name="name"
              value={metadata.name}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-2">Symbol</label>
            <input
              type="text"
              name="symbol"
              value={metadata.symbol}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-gray-400 text-sm mb-2">Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setImageFile(file);
              }
            }}
            className="w-full px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
          {metadata.image && (
            <div className="mt-2">
              <img 
                src={metadata.image} 
                alt="Preview" 
                className="w-32 h-32 object-cover rounded-lg"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-gray-400 text-sm mb-2">Description</label>
          <textarea
            name="description"
            value={metadata.description}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            rows={3}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Creator Name</label>
            <input
              type="text"
              name="creator.name"
              value={metadata.creator.name}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-2">Creator Site</label>
            <input
              type="url"
              name="creator.site"
              value={metadata.creator.site}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 bg-gradient-to-r from-purple-700 to-purple-900 rounded-xl hover:from-purple-600 hover:to-purple-800 transition-colors text-white font-bold disabled:opacity-50"
        >
          {loading ? 'Uploading...' : 'Upload to IPFS'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-black/20 rounded-lg border border-purple-800 text-purple-400">
          {error}
        </div>
      )}

      {ipfsHash && (
        <div className="mt-4 p-4 bg-black/20 rounded-lg border border-purple-800">
          <h3 className="text-gray-400 text-sm mb-2">IPFS Hash</h3>
          <p className="text-white break-all font-mono">{ipfsHash}</p>
          <a 
            href={`https://gateway.pinata.cloud/ipfs/${ipfsHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 underline text-sm mt-2 inline-block"
          >
            View on IPFS
          </a>
        </div>
      )}
    </div>
  );
}
