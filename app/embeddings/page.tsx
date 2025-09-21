'use client';

import { useState, FormEvent } from 'react';

interface EmbeddingsResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export default function EmbeddingsPage() {
  const [input, setInput] = useState<string>('What is the capital of France?');
  const [response, setResponse] = useState<EmbeddingsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) {
      setError('Please enter a query.');
      return;
    }
    setResponse(null);
    setError(null);
    setLoading(true);

    try {
      console.log('Sending request with input:', input); // Debug log
      const res = await fetch('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: [input] }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch embeddings');
      }

      console.log('Received response:', data); // Debug log
      setResponse(data);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response, null, 2));
      alert('Response copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-8">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-2xl">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Generate Embeddings</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="input" className="block text-sm font-medium text-gray-700">
              Enter your query
            </label>
            <textarea
              id="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm resize-y"
              rows={4}
              placeholder="e.g., What is the capital of France?"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors duration-200"
          >
            {loading ? 'Processing...' : 'Generate Embeddings'}
          </button>
        </form>
        {error && (
          <div className="mt-6 p-4 bg-red-50 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {response && (
          <div className="mt-6 p-6 bg-gray-50 rounded-md">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm font-medium text-gray-700">Embeddings Response:</p>
              <button
                onClick={handleCopy}
                className="text-sm text-blue-600 hover:underline"
              >
                Copy to Clipboard
              </button>
            </div>
            <pre className="text-sm text-gray-600 bg-white p-4 rounded-md overflow-auto max-h-96">
              {JSON.stringify(response, null, 2)}
            </pre>
            <p className="text-sm text-gray-500 mt-2">
              Usage: {response.usage.prompt_tokens} prompt tokens, {response.usage.total_tokens} total tokens
            </p>
          </div>
        )}
      </div>
    </div>
  );
}