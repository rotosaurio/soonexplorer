import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Button from './Button';

interface NftFormProps {
  onSubmit: (formData: NftFormData) => Promise<void>;
  loading?: boolean;
  balance?: number;
  freeMintAvailable: boolean;
  lastFreeMint: number | null;
}

export interface NftFormData {
  name: string;
  symbol: string;
  description: string;
  image: File | null;
  isCollection: boolean;
  collectionSize: number;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  creatorName: string;
  creatorSite: string;
}

export default function NftForm({ onSubmit, loading, balance = 0, freeMintAvailable, lastFreeMint }: NftFormProps) {
  const [formData, setFormData] = useState<NftFormData>({
    name: '',
    symbol: '',
    description: '',
    image: null,
    isCollection: false,
    collectionSize: 0,
    attributes: [],
    creatorName: '',
    creatorSite: ''
  });

  const [attributes, setAttributes] = useState([{ trait_type: '', value: '' }]);

  const handleAttributeChange = (index: number, field: string, value: string) => {
    const newAttributes = [...attributes];
    newAttributes[index] = { ...newAttributes[index], [field]: value };
    setAttributes(newAttributes);
    setFormData({ ...formData, attributes: newAttributes });
  };

  const addAttribute = () => {
    setAttributes([...attributes, { trait_type: '', value: '' }]);
  };

  const removeAttribute = (index: number) => {
    const newAttributes = attributes.filter((_, i) => i !== index);
    setAttributes(newAttributes);
    setFormData({ ...formData, attributes: newAttributes });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'file' && e.target instanceof HTMLInputElement && e.target.files) {
      setFormData({
        ...formData,
        [name]: e.target.files[0]
      });
    } else if (type === 'checkbox' && e.target instanceof HTMLInputElement) {
      setFormData({
        ...formData,
        [name]: e.target.checked
      });
    } else if (name === 'collectionSize') {
      const newValue = parseInt(value);
      setFormData({
        ...formData,
        [name]: newValue > 0 ? newValue : 1
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error creating NFT:', error);
    }
  };

  const inputClassName = "w-full px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-purple-500 transition-all duration-200";
  const labelClassName = "block text-gray-400 text-sm mb-2";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div>
            <label className={labelClassName}>
              Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={inputClassName}
              required
            />
          </div>

          <div>
            <label className={labelClassName}>
              Symbol
            </label>
            <input
              type="text"
              name="symbol"
              value={formData.symbol}
              onChange={handleChange}
              className={inputClassName}
              required
            />
          </div>

          <div>
            <label className={labelClassName}>
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-black/40 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={4}
              required
            />
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className={labelClassName}>
              Image
            </label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col w-full h-32 border-2 border-purple-500/30 border-dashed hover:bg-black/40 hover:border-purple-500/50 rounded-lg cursor-pointer">
                <div className="flex flex-col items-center justify-center pt-7">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-400 group-hover:text-gray-600"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="pt-1 text-sm tracking-wider text-gray-400 group-hover:text-gray-600">
                    {formData.image ? formData.image.name : 'Select a file'}
                  </p>
                </div>
                <input type="file" name="image" onChange={handleChange} className="opacity-0" accept="image/*" required />
              </label>
            </div>
          </div>

          <div className="flex items-center space-x-2 p-4 bg-black/40 border border-purple-500/30 rounded-lg">
            <input
              type="checkbox"
              name="isCollection"
              checked={formData.isCollection}
              onChange={handleChange}
              className="w-4 h-4 text-purple-500 border-purple-500/30 rounded focus:ring-purple-500"
            />
            <label className="text-sm font-medium text-gray-300">
              Create Collection
            </label>
          </div>

          {formData.isCollection && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Collection Size
              </label>
              <input
                type="number"
                name="collectionSize"
                value={formData.collectionSize}
                onChange={handleChange}
                min="1"
                className="w-full px-3 py-2 bg-black/40 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 mt-4">
        <h3 className="text-lg font-medium text-purple-400">Attributes</h3>
        {attributes.map((attr, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              placeholder="Trait Type"
              value={attr.trait_type}
              onChange={(e) => handleAttributeChange(index, 'trait_type', e.target.value)}
              className="flex-1 px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white"
            />
            <input
              type="text"
              placeholder="Value"
              value={attr.value}
              onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
              className="flex-1 px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-white"
            />
            <button
              type="button"
              onClick={() => removeAttribute(index)}
              className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addAttribute}
          className="w-full px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30"
        >
          Add Attribute
        </button>
      </div>

      <div className="mt-6 p-4 bg-black/40 border border-purple-500/30 rounded-lg">
        <p className="text-sm font-medium text-gray-300">
          Balance: <span className="text-purple-400">{balance.toFixed(2)} SOL</span>
        </p>
        <p className="mt-2 text-sm text-gray-400">
          {formData.isCollection ? (
            <>Cost: 0.1 SOL + (0.025 SOL × {formData.collectionSize || 0}) = {0.1 + (0.025 * (formData.collectionSize || 0))} SOL</>
          ) : (
            <>
              Cost: {freeMintAvailable ? (
                <span className="text-green-400">FREE (you can create only one free NFT every 24 hours)</span>
              ) : (
                <>
                  <span className="text-purple-400">0.05 SOL</span>
                  {lastFreeMint && (
                    <span className="text-xs ml-2">
                      (Free mint available in {24 - Math.floor((Date.now() - lastFreeMint) / (1000 * 60 * 60))} hours)
                    </span>
                  )}
                </>
              )}
            </>
          )}
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">
              Creator Name
            </label>
            <input
              type="text"
              name="creatorName"
              value={formData.creatorName}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-700 bg-gray-900 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">
              Creator Site
            </label>
            <input
              type="text"
              name="creatorSite"
              value={formData.creatorSite}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-700 bg-gray-900 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500"
              required
            />
          </div>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-purple-500 to-red-500 text-white font-medium py-2 px-4 rounded-lg hover:from-purple-600 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
      >
        {loading ? 'Creating...' : 'Create NFT'}
      </Button>
    </form>
  );
} 