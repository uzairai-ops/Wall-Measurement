import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

interface RerankingRequest {
  model: string;
  query: {
    text: string;
  };
  passages: Array<{
    text: string;
  }>;
}

interface RerankingResponse {
  data: Array<{
    index: number;
    score: number;
  }>;
}

const apiKey = process.env.NVIDIA_llama_3_2_nv_rerankqa_1b_v2_API_KEY;
if (!apiKey) {
  throw new Error("TEST_NVCF_API_KEY is not set in .env.local");
}

const invokeUrl =
  "https://ai.api.nvidia.com/v1/retrieval/nvidia/llama-3_2-nv-rerankqa-1b-v2/reranking";

export async function POST(request: NextRequest) {
  try {
    const { query, passages } = await request.json();
    if (
      !query ||
      typeof query !== "string" ||
      !passages ||
      !Array.isArray(passages) ||
      passages.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Query must be a string and passages must be a non-empty array",
        },
        { status: 400 }
      );
    }

    const payload: RerankingRequest = {
      model: "nvidia/llama-3.2-nv-rerankqa-1b-v2",
      query: { text: query },
      passages: passages.map((text: string) => ({ text })),
    };

    console.log(
      "Sending reranking request with query:",
      query,
      "and passages:",
      passages
    ); // Debug log

    const response = await axios.post<RerankingResponse>(invokeUrl, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    console.log("Received reranking response:", response.data); // Debug log

    return NextResponse.json({ ...response.data, passages });
  } catch (error) {
    console.error("API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
export const dynamic = "force-dynamic"; // Ensure this route is always fresh