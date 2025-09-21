import { type NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface PricingRequest {
  query: string;
  material: string;
  unit: string;
  quantity: number;
}

interface PricingResponse {
  unitPrice: number;
  source: string;
  lastUpdated: string;
  bulkPricing?: {
    minQuantity: number;
    discountPrice: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { query, material, unit, quantity }: PricingRequest =
      await request.json();

    if (!query || !material) {
      return NextResponse.json(
        { error: "Query and material are required" },
        { status: 400 }
      );
    }

    // Use OpenAI with web search capabilities for real-time pricing
    const pricingPrompt = `Search the web for current market prices of "${material}" construction material. 
    
    I need:
    1. Current price per ${unit}
    2. Source of pricing (supplier, marketplace, industry report)
    3. Date of pricing information
    4. Any bulk pricing discounts for quantities over ${quantity}
    5. Regional price variations if applicable
    
    Provide accurate, current market pricing from reliable construction supply sources.
    Format response as JSON with: unitPrice (number), source (string), lastUpdated (string), bulkPricing (optional object).`;




    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a construction pricing expert with access to current market data. 
          Provide accurate, real-time construction material pricing information.
          Always search for the most current pricing data available.`,
        },
        {
          role: "user",
          content: pricingPrompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const responseContent = completion.choices[0]?.message?.content || "";

    // Parse the response to extract pricing information
    const pricingData = parsePricingResponse(responseContent);

    return NextResponse.json(pricingData);
  } catch (error) {
    console.error("OpenAI pricing error:", error);

    // Fallback to estimated pricing if OpenAI fails
    const fallbackPricing = getFallbackPricing(request);
    return NextResponse.json(fallbackPricing);
  }
}

function parsePricingResponse(
  response: string,

): PricingResponse {
  try {
    // Try to parse JSON response first
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        unitPrice: parsed.unitPrice || 0,
        source: parsed.source || "Market estimate",
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        bulkPricing: parsed.bulkPricing,
      };
    }
  } catch (e) {
    console.error(e instanceof Error && e.message)
    // If JSON parsing fails, extract pricing from text
  }

  // Extract pricing from text response
  const priceMatch = response.match(/\$?(\d+(?:\.\d{2})?)/g);
  const unitPrice = priceMatch
    ? Number.parseFloat(priceMatch[0].replace("$", ""))
    : 0;

  const sourceMatch = response.match(/(?:source|supplier|from):\s*([^\n]+)/i);
  const source = sourceMatch ? sourceMatch[1].trim() : "Market estimate";

  return {
    unitPrice,
    source,
    lastUpdated: new Date().toISOString(),
  };
}

async function getFallbackPricing(
  request: NextRequest
): Promise<PricingResponse> {
  const { material, unit }: PricingRequest = await request.json();

  // Fallback pricing database for common construction materials
  const fallbackPrices: Record<string, Record<string, number>> = {
    concrete: {
      "cubic yard": 120,
      "cubic foot": 4.5,
    },
    "steel rebar": {
      lb: 0.75,
      ton: 1500,
    },
    lumber: {
      piece: 8.5,
      "board foot": 2.25,
    },
    drywall: {
      sheet: 15,
      "square foot": 0.65,
    },
    insulation: {
      "square foot": 1.2,
      roll: 45,
    },
    "roofing shingles": {
      "square foot": 3.5,
      bundle: 85,
    },
    brick: {
      piece: 0.35,
      thousand: 350,
    },
    tile: {
      "square foot": 4.25,
      piece: 2.15,
    },
  };

  const materialKey = Object.keys(fallbackPrices).find((key) =>
    material.toLowerCase().includes(key.toLowerCase())
  );

  const unitPrice = materialKey ? fallbackPrices[materialKey][unit] || 0 : 0;

  return {
    unitPrice,
    source: "Estimated market price (fallback)",
    lastUpdated: new Date().toISOString(),
  };
}
