import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function OPENAI() {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: ``,
        },
        {
          role: "user",
          content: ``,
        },
      ],

      model: "gpt-4o",
    });
    const responseContent = completion.choices[0]?.message?.content;
    return responseContent;
  } catch (error) {
    console.error("Error:", error);
  }
}
