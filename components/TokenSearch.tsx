import { FormEvent } from 'react';

interface TokenSearchProps {
  onSearch: (address: string) => void;
}

export default function TokenSearch({ onSearch }: TokenSearchProps) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const address = formData.get('address') as string;
    if (address) onSearch(address);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 sm:mb-8">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          name="address"
          placeholder="Enter token address..."
          className="w-full px-3 sm:px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-gray-100 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button 
          type="submit"
          className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-gradient-to-r from-purple-700 to-purple-900 rounded-xl hover:from-purple-600 hover:to-purple-800 transition-colors text-sm sm:text-base whitespace-nowrap"
        >
          Search
        </button>
      </div>
    </form>
  );
}
