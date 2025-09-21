import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

interface EmbeddingsRequest {
  input: string[];
  model: string;
  input_type: string;
  encoding_format: string;
  truncate: string;
}

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

const apiKey = process.env.NVIDIA_llama_3_2_nv_embedqa_1b_v2_API_KEY;
if (!apiKey) {
  throw new Error("TEST_NVCF_API_KEY is not set in .env.local");
}

export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json();
    if (!input || !Array.isArray(input) || input.length === 0) {
      return NextResponse.json(
        { error: "Input must be a non-empty array of strings" },
        { status: 400 }
      );
    }

    const payload: EmbeddingsRequest = {
      input,
      model: "nvidia/llama-3.2-nv-embedqa-1b-v2",
      input_type: "query",
      encoding_format: "float",
      truncate: "NONE",
    };

    console.log("Sending embeddings request with input:", input); // Debug log

    const response = await axios.post<EmbeddingsResponse>(
      "https://integrate.api.nvidia.com/v1/embeddings",
      payload,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Received embeddings response:", response.data); // Debug log

    return NextResponse.json(response.data);
  } catch (error) {
    console.error("API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
