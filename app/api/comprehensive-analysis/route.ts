import { NextResponse } from "next/server";

// interface QuotationRequest {
//   sessionId: string;
//   materials: Array<{
//     name: string;
//     quantity: number;
//     unit: string;
//     description: string;
//     confidence: number;
//   }>;
// }

// interface ProcessedMaterial {
//   name: string;
//   quantity: number;
//   unit: string;
//   unitPrice: number;
//   totalPrice: number;
//   confidence: number;
//   description: string;
//   priceSource: string;
//   lastUpdated: string;
// }

// export async function POST(request: NextRequest) {
//   try {
//     const { sessionId, materials }: QuotationRequest = await request.json();

//     if (!sessionId || !materials || materials.length === 0) {
//       return NextResponse.json(
//         { error: "Session ID and materials are required" },
//         { status: 400 }
//       );
//     }

//     const processedMaterials: ProcessedMaterial[] = [];

//     // Process each material through the 5-model pipeline
//     for (const material of materials) {
//       // Step 1: Generate embeddings for better material understanding
//       const embeddingResponse = await fetch(
//         `${request.nextUrl.origin}/api/embeddings`,
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             input: [material.name, material.description],
//           }),
//         }
//       );

//       // Step 2: Rerank materials for accuracy
//       const rerankResponse = await fetch(
//         `${request.nextUrl.origin}/api/reranking`,
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             query: `construction material pricing for ${material.name}`,
//             passages: [material.description],
//           }),
//         }
//       );

//       // Step 3: Get real-time pricing via OpenAI
//       const pricingResponse = await fetch(
//         `${request.nextUrl.origin}/api/openai-pricing`,
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             query: `Current market price for ${material.name} construction material`,
//             material: material.name,
//             unit: material.unit,
//             quantity: material.quantity,
//           }),
//         }
//       );

//       const pricingData = await pricingResponse.json();

//       // Step 4: Use Llama for additional analysis if needed
//       if (material.confidence < 80) {
//         const clarificationResponse = await fetch(
//           `${request.nextUrl.origin}/api/chat`,
//           {
//             method: "GET",
//             headers: { "Content-Type": "application/json" },
//           }
//         );
//       }

//       processedMaterials.push({
//         name: material.name,
//         quantity: material.quantity,
//         unit: material.unit,
//         unitPrice: pricingData.unitPrice || 0,
//         totalPrice: (pricingData.unitPrice || 0) * material.quantity,
//         confidence: material.confidence,
//         description: material.description,
//         priceSource: pricingData.source || "Market estimate",
//         lastUpdated: pricingData.lastUpdated || new Date().toISOString(),
//       });
//     }

//     const totalCost = processedMaterials.reduce(
//       (sum, m) => sum + m.totalPrice,
//       0
//     );
//     const avgConfidence =
//       processedMaterials.reduce((sum, m) => sum + m.confidence, 0) /
//       processedMaterials.length;

//     return NextResponse.json({
//       materials: processedMaterials,
//       totalCost,
//       analysisConfidence: Math.round(avgConfidence),
//       timestamp: new Date().toISOString(),
//       modelsUsed: [
//         "Vila (Video Analysis)",
//         "Llama-3.1-70b (Reasoning)",
//         "Llama-3.2-NV-EmbedQA (Embeddings)",
//         "Llama-3.2-NV-RerankQA (Reranking)",
//         "OpenAI (Real-time Pricing)",
//       ],
//     });
//   } catch (error) {
//     console.error("Comprehensive quotation error:", error);
//     return NextResponse.json(
//       { error: error instanceof Error ? error.message : "Quotation failed" },
//       { status: 500 }
//     );
//   }
// }
export async function POST() {
  try {
    return NextResponse.json({ status: 200 });
  } catch (error) {
    console.error("Comprehensive quotation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Quotation failed" },
      { status: 500 }
    );
  }
}
