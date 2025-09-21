"use client";

import { useState, FormEvent, useCallback } from "react";

interface RerankingResponse {
  rankings: Array<{
    index: number;
    logit: number;
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
  passages: string[];
}

interface Toast {
  message: string;
  type: "success" | "error";
}

export default function RerankingPage() {
  const [query, setQuery] = useState<string>(
    "What is the GPU memory bandwidth of H100 SXM?"
  );
  const [passages, setPassages] = useState<string[]>([
    "The Hopper GPU is paired with the Grace CPU using NVIDIA’s ultra-fast chip-to-chip interconnect, delivering 900GB/s of bandwidth, 7X faster than PCIe Gen5. This innovative design will deliver up to 30X higher aggregate system memory bandwidth to the GPU compared to today’s fastest servers and up to 10X higher performance for applications running terabytes of data.",
    "A100 provides up to 20X higher performance over the prior generation and can be partitioned into seven GPU instances to dynamically adjust to shifting demands. The A100 80GB debuts the world’s fastest memory bandwidth at over 2 terabytes per second (TB/s) to run the largest models and datasets.",
    "Accelerated servers with H100 deliver the compute power—along with 3 terabytes per second (TB/s) of memory bandwidth per GPU and scalability with NVLink and NVSwitch™.",
  ]);
  const [response, setResponse] = useState<RerankingResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!query.trim()) {
      setError("Query cannot be empty.");
      showToast("Please enter a query.", "error");
      return;
    }
    if (passages.length === 0) {
      setError("At least one passage is required.");
      showToast("Please add at least one passage.", "error");
      return;
    }
    if (passages.some((p) => !p.trim())) {
      setError("Passages cannot be empty.");
      showToast("Please fill in all passages.", "error");
      return;
    }
    setResponse(null);
    setError(null);
    setLoading(true);

    try {
      console.log(
        "Sending request with query:",
        query,
        "and passages:",
        passages
      ); // Debug log
      const res = await fetch("/api/reranking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, passages }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch reranking response");
      }

      console.log("Received response:", data); // Debug log
      setResponse(data);
      showToast("Reranking completed successfully!", "success");
    } catch (err) {
      console.error("Fetch error:", err);
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePassageChange = (index: number, value: string) => {
    const newPassages = [...passages];
    newPassages[index] = value;
    setPassages(newPassages);
  };

  const addPassage = () => {
    if (passages.length < 5) {
      setPassages([...passages, ""]);
    } else {
      showToast("Maximum 5 passages allowed.", "error");
    }
  };

  const removePassage = (index: number) => {
    setPassages(passages.filter((_, i) => i !== index));
  };

  const handleCopy = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response, null, 2));
      showToast("Response copied to clipboard!", "success");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8 text-black">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            Passage Reranker
          </h1>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="query"
                className="block text-sm font-medium text-gray-700"
              >
                Query
              </label>
              <textarea
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm resize-y"
                rows={3}
                placeholder="e.g., What is the GPU memory bandwidth of H100 SXM?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Passages (1-5)
              </label>
              {passages.map((passage, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-4"
                >
                  <div className="flex-grow">
                    <textarea
                      value={passage}
                      onChange={(e) =>
                        handlePassageChange(index, e.target.value)
                      }
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm resize-y"
                      rows={4}
                      placeholder={`Passage ${index + 1}`}
                    />
                  </div>
                  {passages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePassage(index)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addPassage}
                className="text-blue-600 hover:underline text-sm font-medium"
                disabled={passages.length >= 5}
              >
                + Add Passage
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors duration-200 flex items-center justify-center"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin h-5 w-5 mr-2 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                "Rerank Passages"
              )}
            </button>
          </form>
          {error && (
            <div className="mt-6 p-4 bg-red-50 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          {response && (
            <div className="mt-8 p-6 bg-gray-50 rounded-md">
              <div className="flex justify-between items-center mb-4">
                <p className="text-lg font-semibold text-gray-800">
                  Reranking Results
                </p>
                <button
                  onClick={handleCopy}
                  className="text-sm text-blue-600 hover:underline font-medium"
                >
                  Copy to Clipboard
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-600 border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 font-medium text-gray-700">
                        Passage
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-700">
                        Logit Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {response.rankings.map(({ index, logit }) => (
                      <tr key={index} className="border-t hover:bg-gray-100">
                        <td className="px-4 py-3">
                          {response.passages[index]}
                        </td>
                        <td className="px-4 py-3">{logit.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm font-medium text-gray-700 mt-6">Usage</p>
              <p className="text-sm text-gray-600">
                Prompt Tokens: {response.usage.prompt_tokens}, Total Tokens:{" "}
                {response.usage.total_tokens}
              </p>
              <p className="text-sm font-medium text-gray-700 mt-4">
                Raw Response
              </p>
              <pre className="text-sm text-gray-600 bg-white p-4 rounded-md overflow-auto max-h-96 border border-gray-200">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}
        </div>
        {toast && (
          <div
            className={`fixed bottom-4 right-4 p-4 rounded-md shadow-lg text-white ${
              toast.type === "success" ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
