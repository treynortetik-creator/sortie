import { NextResponse } from "next/server";
import { extractRequestSchema, extractedContactSchema } from "@/lib/schemas";

interface AnthropicContentBlock {
  type: "text" | "tool_use";
  text?: string;
}

interface AnthropicMessagesResponse {
  content: AnthropicContentBlock[];
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    const parsed = extractRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const { photoUrl } = parsed.data;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system:
            "You are an expert at reading business cards, name badges, and event lanyards. " +
            "Extract contact information and return ONLY a JSON object with these fields: name, company, email, phone. " +
            "Rules:\n" +
            "- If a field is not visible or legible, set it to an empty string.\n" +
            "- For partially visible text, make your best guess and include it.\n" +
            "- Handle non-English names and companies (transliterate to Latin if needed).\n" +
            "- If the image is blurry or upside-down, still attempt extraction.\n" +
            "- Clean up formatting: trim whitespace, capitalize names properly, format phone numbers.\n" +
            "- Return raw JSON only, no markdown fences or explanation.",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "url",
                    url: photoUrl,
                  },
                },
                {
                  type: "text",
                  text: "Extract the contact information from this image. Return only a JSON object with: name, company, email, phone.",
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Anthropic API error:", response.status, errorBody);
        return NextResponse.json(
          { error: "Failed to process image with Claude API" },
          { status: 502 }
        );
      }

      const data: AnthropicMessagesResponse = await response.json();

      const textBlock = data.content?.find(
        (block) => block.type === "text"
      );
      const rawText = textBlock?.text ?? "";

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
