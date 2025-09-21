import { type NextRequest, NextResponse } from "next/server";
// import OpenAI from "openai";

// Commented out OpenAI API initialization
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY!,
// });

interface QuestionRequest {
  summary: string;
  mediaType: "video" | "image";
}

export async function POST(request: NextRequest) {
  try {
    const { summary, mediaType }: QuestionRequest = await request.json();

    if (!summary) {
      return NextResponse.json(
        { error: "Summary is required" },
        { status: 400 }
      );
    }

    const prompt = `Based on this ${mediaType} summary, generate 20-25 specific questions to extract precise measurements and dimensions. Focus on:

Summary: "${summary}"

Generate questions that will help identify:
- Wall heights, lengths, widths
- Room dimensions (length x width x height)
- Floor areas and measurements
- Ceiling heights
- Door and window dimensions
- Any visible structural elements with measurable dimensions
- Distance between objects
- Scale references (people, furniture, tools for size comparison)
- Any numerical measurements visible in the ${mediaType}

Make each question specific and focused on extracting exact measurements. Format as a JSON array of strings.

Example format:
["What is the height of the main wall visible in the ${mediaType}?", "What are the dimensions of the room shown?", ...]`;

    // Commented out OpenAI API call
    // const completion = await openai.chat.completions.create({
    //   model: "gpt-4o",
    //   messages: [
    //     {
    //       role: "system",
    //       content:
    //         "You are a construction measurement expert. Generate specific questions to extract precise measurements from construction media. Always respond with a valid JSON array of question strings.",
    //     },
    //     {
    //       role: "user",
    //       content: prompt,
    //     },
    //   ],
    //   temperature: 1,
    // });

    // const responseContent = completion.choices[0]?.message?.content || "";

    // try {
    //   // Try to parse as JSON
    //   const questions = JSON.parse(responseContent);
    //   if (Array.isArray(questions)) {
    //     return NextResponse.json({ questions });
    //   }
    // } catch (parseError) {
    //   console.error(parseError instanceof Error && parseError.message);
    //   // If JSON parsing fails, extract questions from text
    //   const lines = responseContent.split("\n");
    //   const questions = lines
    //     .filter(
    //       (line) =>
    //         line.trim().length > 10 &&
    //         (line.includes("?") ||
    //           line.includes("dimension") ||
    //           line.includes("measure"))
    //     )
    //     .map((line) =>
    //       line
    //         .replace(/^\d+\.?\s*/, "")
    //         .replace(/^[-*]\s*/, "")
    //         .trim()
    //     )
    //     .filter((q) => q.length > 0)
    //     .slice(0, 25);

    //   return NextResponse.json({ questions });
    // }

    // Use fallback questions directly since OpenAI API is disabled
    console.log(`Generating fallback questions for ${mediaType} summary: ${summary}`);

    // Fallback questions if parsing fails
    const fallbackQuestions = [
      "What is the height of the main wall visible?",
      "What are the length and width dimensions of the room?",
      "What is the ceiling height?",
      "Are there any doors visible and what are their dimensions?",
      "Are there any windows visible and what are their dimensions?",
      "What is the floor area measurement?",
      "Are there any people or objects that can be used for scale reference?",
      "What structural elements are visible that could be measured?",
      "Are there any numerical measurements or dimensions visible?",
      "What is the approximate square footage of the space?",
    ];

    return NextResponse.json({ questions: fallbackQuestions });
  } catch (error) {
    console.error("OpenAI questions error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate questions",
      },
      { status: 500 }
    );
  }
}
