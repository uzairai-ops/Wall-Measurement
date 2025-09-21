import { type NextRequest, NextResponse } from "next/server";

interface Material {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

interface QuotationResult {
  materials: Material[];
  subtotal: number;
  laborCost: number;
  equipmentCost: number;
  overhead: number;
  totalCost: number;
  projectName: string;
  date: string;
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, videoName } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      );
    }

    // Step 1: Analyze video with Vila
    const vilaAnalysis = await analyzeVideoWithVila(sessionId);

    // Step 2: Process with Llama for structured data
    const structuredData = await processWithLlama(vilaAnalysis);

    // Step 3: Get pricing for materials
    const pricedMaterials = await getPricingForMaterials(structuredData);

    // Step 4: Generate final quotation
    const quotation = generateQuotation(pricedMaterials, videoName);

    return NextResponse.json(quotation);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}

async function analyzeVideoWithVila(sessionId: string): Promise<string> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/process-media?action=chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        query: `Analyze this construction video and identify ALL materials, tools, and equipment visible. For each item, provide:

1. Exact name of the material/tool/equipment
2. Estimated quantity (count each individual item)
3. Appropriate unit of measurement

Include EVERYTHING you see:
- Structural materials (concrete, steel, lumber, etc.)
- Tools (hammers, drills, saws, etc.)
- Hardware (nails, screws, bolts, etc.)
- Equipment (ladders, scaffolding, etc.)
- Finishing materials (paint, tiles, etc.)
- Safety equipment (helmets, gloves, etc.)

Be very detailed and count individual items where possible.`,
        stream: false,
      }),
    }
  );

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function processWithLlama(analysis: string): Promise<Material[]> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/chat?prompt=${encodeURIComponent(`
Extract structured material data from this construction analysis:

${analysis}

For each material/tool/item mentioned, extract:
- Material name (be specific)
- Quantity (number only)
- Unit (pieces, lbs, cubic yards, square feet, etc.)

Format as a clear list. Only include items that have clear quantities mentioned.
`)}`
  );

  const data = await response.json();
  return extractMaterialsFromText(data.content || analysis);
}

function extractMaterialsFromText(text: string): Material[] {
  const materials: Material[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.length < 5) continue;

    // Look for patterns like "Material: quantity unit" or "quantity unit of material"
    const patterns = [
      /(.+?):\s*(\d+(?:\.\d+)?)\s*(\w+)/,
      /(\d+(?:\.\d+)?)\s*(\w+)\s+(?:of\s+)?(.+)/,
      /(.+?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(\w+)/,
    ];

    for (const pattern of patterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        let name, quantity, unit;

        if (pattern === patterns[1]) {
          // Pattern: "quantity unit of material"
          quantity = Number.parseFloat(match[1]);
          unit = match[2];
          name = match[3];
        } else {
          // Pattern: "material: quantity unit" or "material - quantity unit"
          name = match[1];
          quantity = Number.parseFloat(match[2]);
          unit = match[3];
        }

        if (name && quantity > 0 && unit) {
          materials.push({
            name: cleanMaterialName(name),
            quantity,
            unit: standardizeUnit(unit),
            unitPrice: 0,
            totalPrice: 0,
          });
          break;
        }
      }
    }
  }

  return materials.slice(0, 50); // Limit to 50 materials
}

function cleanMaterialName(name: string): string {
  return name
    .replace(/^\d+\.?\s*/, "")
    .replace(/^[-*•]\s*/, "")
    .replace(/:\s*$/, "")
    .trim()
    .replace(/\b\w/g, (l) => l.toUpperCase()); // Title case
}

function standardizeUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    pc: "pieces",
    pcs: "pieces",
    piece: "pieces",
    each: "pieces",
    lb: "lbs",
    pound: "lbs",
    pounds: "lbs",
    ft: "feet",
    foot: "feet",
    yd: "yards",
    yard: "yards",
    sqft: "sq ft",
    "square feet": "sq ft",
    cuft: "cu ft",
    "cubic feet": "cu ft",
    cuyd: "cu yd",
    "cubic yards": "cu yd",
  };

  return unitMap[unit.toLowerCase()] || unit;
}

async function getPricingForMaterials(materials: Material[]): Promise<Material[]> {
  const pricedMaterials: Material[] = [];

  for (const material of materials) {
    const unitPrice = getMarketPrice(material.name, material.unit);

    pricedMaterials.push({
      name: material.name,
      quantity: material.quantity,
      unit: material.unit,
      unitPrice,
      totalPrice: unitPrice * material.quantity,
    });
  }

  return pricedMaterials;
}

function getMarketPrice(materialName: string, unit: string): number {
  const priceDatabase: Record<string, Record<string, number>> = {
    // Structural Materials
    concrete: { "cu yd": 120, "cu ft": 4.5 },
    "ready mix concrete": { "cu yd": 120, "cu ft": 4.5 },
    "steel rebar": { lbs: 0.75, pieces: 8.5 },
    rebar: { lbs: 0.75, pieces: 8.5 },
    lumber: { pieces: 8.5, "board ft": 2.25 },
    "2x4 lumber": { pieces: 8.5 },
    "2x6 lumber": { pieces: 12.5 },
    "2x8 lumber": { pieces: 18.5 },
    plywood: { pieces: 35, "sq ft": 1.25 },

    // Tools
    hammer: { pieces: 25 },
    drill: { pieces: 85 },
    saw: { pieces: 150 },
    "circular saw": { pieces: 180 },
    screwdriver: { pieces: 15 },
    wrench: { pieces: 20 },
    pliers: { pieces: 18 },
    level: { pieces: 35 },
    "measuring tape": { pieces: 25 },

    // Hardware
    nails: { lbs: 3.5, pieces: 0.05 },
    screws: { lbs: 4.2, pieces: 0.08 },
    bolts: { pieces: 1.25 },
    nuts: { pieces: 0.35 },
    washers: { pieces: 0.15 },

    // Finishing Materials
    drywall: { pieces: 15, "sq ft": 0.65 },
    paint: { gallons: 45, pieces: 45 },
    tile: { "sq ft": 4.25, pieces: 2.15 },
    insulation: { "sq ft": 1.2, pieces: 45 },

    // Equipment
    ladder: { pieces: 125 },
    scaffolding: { pieces: 85 },
    "safety helmet": { pieces: 25 },
    "safety gloves": { pieces: 12 },
    "safety glasses": { pieces: 8 },

    // Electrical
    wire: { feet: 2.25, lbs: 3.8 },
    "electrical wire": { feet: 2.25, lbs: 3.8 },
    outlet: { pieces: 8.5 },
    switch: { pieces: 6.5 },

    // Plumbing
    pipe: { feet: 4.8 },
    "pvc pipe": { feet: 4.8 },
    fitting: { pieces: 3.25 },
    valve: { pieces: 15.5 },
  };

  // Find matching material
  const materialKey = Object.keys(priceDatabase).find((key) =>
    materialName.toLowerCase().includes(key.toLowerCase())
  );

  if (materialKey && priceDatabase[materialKey][unit]) {
    return priceDatabase[materialKey][unit];
  }

  // Fallback pricing based on unit
  const fallbackPrices: Record<string, number> = {
    pieces: 10,
    lbs: 2.5,
    feet: 3.5,
    "sq ft": 2.8,
    "cu ft": 8.5,
    "cu yd": 85,
    gallons: 35,
  };

  return fallbackPrices[unit] || 5;
}

function generateQuotation(
  materials: Material[],
  videoName: string
): QuotationResult {
  const subtotal = materials.reduce((sum, m) => sum + m.totalPrice, 0);
  const laborCost = subtotal * 0.6; // 60% of materials
  const equipmentCost = subtotal * 0.15; // 15% of materials
  const overhead = (subtotal + laborCost + equipmentCost) * 0.2; // 20% overhead

  return {
    materials,
    subtotal,
    laborCost,
    equipmentCost,
    overhead,
    totalCost: subtotal + laborCost + equipmentCost + overhead,
    projectName: videoName.replace(/\.[^/.]+$/, ""), // Remove file extension
    date: new Date().toLocaleDateString(),
  };
}
