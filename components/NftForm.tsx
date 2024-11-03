import { useState } from 'react';
import Button from './Button';

export interface NftFormData {
  name: string;
  symbol: string;
  description: string;
  image: File | null;
  isCollection: boolean;
  collectionSize?: number;
  creatorName: string;
  creatorSite: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}

interface NftFormProps {
  onSubmit: (data: NftFormData) => void;
  loading: boolean;
  balance?: number;
  freeMintAvailable?: boolean;
  lastFreeMint?: number;
}

const defaultFormData: NftFormData = {
  name: '',
  symbol: '',
  description: '',
  image: null,
  isCollection: false,
  creatorName: '',
  creatorSite: '',
  attributes: []
};

export default function NftForm({ 
  onSubmit, 
  loading, 
  balance = 0, 
  freeMintAvailable, 
  lastFreeMint 
}: NftFormProps) {
  const [formData, setFormData] = useState<NftFormData>(defaultFormData);
  const [attributes, setAttributes] = useState<Array<{trait_type: string, value: string}>>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'file') {
      const fileInput = e.target as HTMLInputElement;
      const file = fileInput.files?.[0];
      setFormData(prev => ({
        ...prev,
        [name]: file || null
      }));
    } else if (name === 'isCollection') {
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleAttributeChange = (index: number, field: 'trait_type' | 'value', value: string) => {
    const newAttributes = [...attributes];
    newAttributes[index] = {
      ...newAttributes[index],
      [field]: value
    };
    setAttributes(newAttributes);
  };

  const addAttribute = () => {
    setAttributes([...attributes, { trait_type: '', value: '' }]);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      attributes
    });
  };

  // Primero, definimos una función helper para calcular el costo
  const calculateMintCost = () => {
    if (formData.isCollection) {
      return 0.1 + (formData.collectionSize || 0) * 0.025;
    }
    return freeMintAvailable ? 0 : 0.05;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* Basic fields */}
        <div>
          <label className="block text-sm font-medium text-purple-300 mb-2">
            NFT Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full bg-black/50 border border-purple-800/30 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-purple-300 mb-2">
            Symbol
          </label>
          <input
            type="text"
            name="symbol"
            value={formData.symbol}
            onChange={handleChange}
            required
            className="w-full bg-black/50 border border-purple-800/30 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-purple-300 mb-2">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            className="w-full bg-black/50 border border-purple-800/30 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500/50 min-h-[100px]"
          />
        </div>

        {/* Image */}
        <div>
          <label className="block text-sm font-medium text-purple-300 mb-2">
            Image
          </label>
          <input
            type="file"
            name="image"
            onChange={handleChange}
            accept="image/*"
            required
            className="w-full bg-black/50 border border-purple-800/30 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500/50"
          />
        </div>

        {/* Creator Information */}
        <div>
          <label className="block text-sm font-medium text-purple-300 mb-2">
            Creator Name
          </label>
          <input
            type="text"
            name="creatorName"
            value={formData.creatorName}
            onChange={handleChange}
            required
            className="w-full bg-black/50 border border-purple-800/30 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-purple-300 mb-2">
            Creator Website
          </label>
          <input
            type="url"
            name="creatorSite"
            value={formData.creatorSite}
            onChange={handleChange}
            required
            className="w-full bg-black/50 border border-purple-800/30 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500/50"
          />
        </div>

        {/* Collection Option */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            name="isCollection"
            checked={formData.isCollection}
            onChange={handleChange}
            className="w-4 h-4 text-purple-600 bg-black/50 border-purple-800/30 rounded focus:ring-purple-500"
          />
          <label className="text-sm font-medium text-purple-300">
            Create as Collection
          </label>
        </div>

        {formData.isCollection && (
          <div>
            <label className="block text-sm font-medium text-purple-300 mb-2">
              Collection Size
            </label>
            <input
              type="number"
              name="collectionSize"
              value={formData.collectionSize || ''}
              onChange={handleChange}
              min="1"
              max="100"
              required={formData.isCollection}
              className="w-full bg-black/50 border border-purple-800/30 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500/50"
            />
          </div>
        )}

        {/* Attributes */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-purple-300">
              Attributes
            </label>
            <button
              type="button"
              onClick={addAttribute}
              className="text-sm text-purple-400 hover:text-purple-300"
            >
              + Add Attribute
            </button>
          </div>

          {attributes.map((attr, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                placeholder="Type"
                value={attr.trait_type}
                onChange={(e) => handleAttributeChange(index, 'trait_type', e.target.value)}
                className="flex-1 bg-black/50 border border-purple-800/30 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500/50"
              />
              <input
                type="text"
                placeholder="Value"
                value={attr.value}
                onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                className="flex-1 bg-black/50 border border-purple-800/30 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500/50"
              />
              <button
                type="button"
                onClick={() => removeAttribute(index)}
                className="px-3 text-red-400 hover:text-red-300"
              >
                
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {/* Mint Cost Information */}
        <div className="p-4 bg-black/40 rounded-lg border border-purple-800/30">
          <h3 className="text-sm font-medium text-purple-300 mb-2">Minting Cost</h3>
          
          {formData.isCollection ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Collection Creation:</span>
                <span className="text-white">0.1 SOL</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Per NFT in Collection:</span>
                <span className="text-white">0.025 SOL</span>
              </div>
              <div className="flex justify-between text-sm font-medium pt-2 border-t border-purple-800/30">
                <span className="text-purple-300">Total Cost:</span>
                <span className="text-purple-300">
                  {(0.1 + (formData.collectionSize || 0) * 0.025).toFixed(3)} SOL
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {freeMintAvailable ? (
                <div className="flex items-center text-green-400 text-sm">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Free mint available!
                </div>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Single NFT Cost:</span>
                  <span className="text-white">0.05 SOL</span>
                </div>
              )}
              
              {lastFreeMint && !freeMintAvailable && (
                <div className="text-xs text-gray-400">
                  Next free mint available in: {
                    Math.ceil(24 - (Date.now() - lastFreeMint) / (1000 * 60 * 60))
                  } hours
                </div>
              )}
            </div>
          )}
        </div>

        {/* Balance Warning */}
        {balance < calculateMintCost() && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            Insufficient balance for minting. You need at least {
              formData.isCollection ? 
              calculateMintCost().toFixed(3) : 
              (freeMintAvailable ? '0' : '0.05')
            } SOL
          </div>
        )}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={
          loading || 
          (!freeMintAvailable && !formData.isCollection && balance < 0.05) ||
          (formData.isCollection && balance < calculateMintCost())
        }
        loading={loading}
        className="w-full"
      >
        {loading ? 'Creating NFT...' : 'Create NFT'}
      </Button>

      {/* Balance Information */}
      <div className="text-sm text-gray-400">
        Balance: {balance.toFixed(4)} SOL
      </div>
    </form>
  );
} 