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
    <form onSubmit={handleSubmit} className="mb-8">
      <div className="flex gap-2">
        <input
          type="text"
          name="address"
          placeholder="Enter token address..."
          className="flex-1 px-4 py-2 bg-black/40 rounded-xl border border-purple-800/30 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button 
          type="submit"
          className="px-6 py-2 bg-gradient-to-r from-purple-700 to-purple-900 rounded-xl hover:from-purple-600 hover:to-purple-800 transition-colors"
        >
          Search
        </button>
      </div>
    </form>
  );
}
