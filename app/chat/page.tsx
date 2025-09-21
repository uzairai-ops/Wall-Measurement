"use client";

import { useState, FormEvent } from "react";

interface ChatResponse {
  content: string;
}

export default function ChatPage() {
  const [prompt, setPrompt] = useState<string>("");
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setError("Please enter a prompt.");
      return;
    }
    setResponse("");
    setError(null);
    setLoading(true);

    try {
      console.log("Sending request with prompt:", prompt); // Debug log
      const res = await fetch(`/api/chat?prompt=${encodeURIComponent(prompt)}`);
      const data: ChatResponse | { error: string } = await res.json();

      if (!res.ok) {
        throw new Error(
          (data as { error: string }).error || "Failed to fetch response"
        );
      }

      const content = (data as ChatResponse).content;
      console.log("Received response:", content); // Debug log
      setResponse(content);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 text-black">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Chat with AI</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="prompt"
              className="block text-sm font-medium text-gray-700"
            >
              Enter your prompt
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              rows={4}
              placeholder="Type your message here..."
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
          >
            {loading ? "Processing..." : "Send"}
          </button>
        </form>
        {error && (
          <div className="mt-4 p-4 bg-red-50 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {response && (
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <p className="text-sm font-medium text-gray-700">Response:</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {response}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
