import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface ChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
    };
    finish_reason: string;
  }>;
}

const apiKey = process.env.META_llama_3_1_70b_instruct_API_KEY;
if (!apiKey) {
  throw new Error('TEST_NVCF_API_KEY is not set in .env.local');
}

const openai = new OpenAI({
  apiKey,
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

export async function GET(request: NextRequest) {
  const prompt = request.nextUrl.searchParams.get('prompt');
  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }

  try {
    console.log('Initiating chat completion with prompt:', prompt); 
    const completion:ChatCompletion = await openai.chat.completions.create({
      model: 'meta/llama-3.1-70b-instruct',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      top_p: 0.7,
      max_tokens: 1024,
      stream: false,
    });

    const content = completion.choices[0]?.message?.content || '';
    console.log('Completion response:', content); // Debug log

    return NextResponse.json({ content });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}