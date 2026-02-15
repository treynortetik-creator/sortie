import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
  context_length?: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
  };
  top_provider?: {
    max_completion_tokens?: number;
  };
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export async function GET(request: Request): Promise<NextResponse> {
  // Auth check
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENROUTER_API_KEY is not configured' },
      { status: 500 },
    );
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('OpenRouter models API error:', response.status, body);
      return NextResponse.json(
        { error: 'Failed to fetch models from OpenRouter' },
        { status: 502 },
      );
    }

    const data: OpenRouterModelsResponse = await response.json();

    // Return a simplified model list
    const models = data.data.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      pricing: m.pricing,
      contextLength: m.context_length,
      inputModalities: m.architecture?.input_modalities,
      modality: m.architecture?.modality,
    }));

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Models proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
