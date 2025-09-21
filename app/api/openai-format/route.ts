import { type NextRequest, NextResponse } from "next/server";
// import OpenAI from "openai";

// Commented out OpenAI API initialization
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY!,
// });

interface QAData {
  question: string;
  answer: string;
}

interface FormatRequest {
  qaData: QAData[];
}

export async function POST(request: NextRequest) {
  try {
    const { qaData }: FormatRequest = await request.json();

    if (!qaData || !Array.isArray(qaData)) {
      return NextResponse.json(
        { error: "QA data is required" },
        { status: 400 }
      );
    }

    const qaText = qaData
      .map(
        (item, index) =>
          `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`
      )
      .join("\n\n");

    const prompt = `You are an expert in construction media analysis.
Your task is to extract all measurable dimensions and physical measurements from the following question-answer pairs related to construction descriptions:

Input:
${qaText}

🔹 Instructions:

Carefully read the text and identify any numerical measurements, including lengths, widths, heights, areas, or other quantifiable physical dimensions.

Organize the extracted data into clear, well-labeled sections based on construction elements.

Only include measurements that are explicitly or reasonably inferred from the text.

If a category has no measurable data, write: "Measurements not clearly visible" for that section.

🔹 Format the final output like this (only include categories present in the text):

ROOM DIMENSIONS:

Length: X feet

Width: Y feet

Height: Z feet

Area: X sq ft

WALL MEASUREMENTS:

Wall 1 Height: X feet

Wall 1 Length: Y feet

Wall 2 Height: X feet

Wall 2 Length: Y feet

DOOR/WINDOW DIMENSIONS:

Door Height: X feet

Door Width: Y feet

Window Height: X feet

Window Width: Y feet

FLOOR MEASUREMENTS:

Floor Area: X by Y feet

Total Square Footage: Z sq ft



important:
neven include this type of things:"---

Where exact measurements were not possible, the details are noted as such. This structured format provides a clear overview of the key measurable dimensions identified in the analysis"

`;

    // Commented out OpenAI API call
    // const completion = await openai.chat.completions.create({
    //   model: "gpt-4o",
    //   messages: [
    //     {
    //       role: "system",
    //       content:
    //         "You are a construction measurement specialist. Format measurement data clearly and professionally, focusing on concrete dimensions and measurements.",
    //     },
    //     {
    //       role: "user",
    //       content: prompt,
    //     },
    //   ],
    //   temperature: 1,
    // });

    // const result =
    //   completion.choices[0]?.message?.content ||
    //   "No measurements could be determined from the analysis.";

    // Use fallback formatting since OpenAI API is disabled
    console.log(`Processing QA data with ${qaData.length} items`);
    const result = `MEASUREMENT ANALYSIS SUMMARY\n\nOpenAI API is currently disabled. This is a placeholder response.\n\nProcessed ${qaData.length} question-answer pairs:\n${qaData.map((item, index) => `${index + 1}. ${item.question}`).join('\n')}\n\nTo enable full formatting, configure the OPENAI_API_KEY environment variable.`;

    return NextResponse.json({ result });
  } catch (error) {
    console.error("OpenAI format error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to format results",
      },
      { status: 500 }
    );
  }
}
