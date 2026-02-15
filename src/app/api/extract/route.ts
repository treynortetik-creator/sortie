import { NextResponse } from "next/server";
import { extractRequestSchema, extractedContactSchema } from "@/lib/schemas";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { getAppSetting } from "@/lib/supabase-server";

interface OpenRouterChoice {
  message: { role: string; content: string };
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
}

// 20 extractions per user per minute
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60_000;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Auth check
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Rate limiting
    const { allowed, retryAfterMs } = rateLimit(
      `extract:${user.id}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }

    const body: unknown = await request.json();
    const parsed = extractRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const { photoUrl } = parsed.data;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Read model from app_settings (configured via /admin), fall back to env var
    const token = request.headers.get('Authorization')?.slice(7) ?? '';
    const model = await getAppSetting('extraction_model', token)
      ?? process.env.OPENROUTER_MODEL
      ?? null;
    if (!model) {
      return NextResponse.json(
        { error: "No AI model configured — set OPENROUTER_MODEL env var or visit /admin" },
        { status: 400 }
      );
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://sortie.app",
          "X-Title": "Sortie",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: [
            {
              role: "system",
              content:
                "You are an expert at reading business cards, name badges, and event lanyards. " +
                "Extract contact information and return ONLY a JSON object with these fields: name, company, email, phone, notes. " +
                "Rules:\n" +
                "- If a field is not visible or legible, set it to an empty string.\n" +
                "- For partially visible text, make your best guess and include it.\n" +
                "- Handle non-English names and companies (transliterate to Latin if needed).\n" +
                "- If the image is blurry or upside-down, still attempt extraction.\n" +
                "- Clean up formatting: trim whitespace, capitalize names properly, format phone numbers.\n" +
                "- The 'notes' field should contain any additional information visible on the card/badge that doesn't fit the other fields (job title, address, website, social media, department, etc). Separate multiple items with semicolons.\n" +
                "- Return raw JSON only, no markdown fences or explanation.",
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: photoUrl },
                },
                {
                  type: "text",
                  text: "Extract all information from this image. Return a JSON object with: name, company, email, phone, notes (any additional info like title, address, website, etc).",
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("OpenRouter API error:", response.status, "model:", model, errorBody);
        return NextResponse.json(
          { error: `AI extraction failed (${response.status}): ${errorBody.slice(0, 200)}` },
          { status: 502 }
        );
      }

      const data: OpenRouterResponse = await response.json();
      const rawText = data.choices?.[0]?.message?.content ?? "";

      // Try to find JSON in code fences first, then bare JSON object
      const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const objectMatch = rawText.match(/\{[\s\S]*\}/);
      const jsonString = fenceMatch ? fenceMatch[1].trim() : objectMatch ? objectMatch[0].trim() : rawText.trim();

      let jsonParsed: unknown;
      try {
        jsonParsed = JSON.parse(jsonString);
      } catch {
        console.error("Failed to parse JSON from Claude response:", rawText);
        return NextResponse.json(
          { error: "Failed to parse extracted contact information" },
          { status: 500 }
        );
      }

      const validated = extractedContactSchema.safeParse(jsonParsed);
      if (!validated.success) {
        console.error("Extracted data validation failed:", validated.error);
        return NextResponse.json(
          { error: "Extracted data did not match expected format" },
          { status: 500 }
        );
      }

      return NextResponse.json(validated.data);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Request timed out" },
        { status: 504 }
      );
    }
    console.error("Extract API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
