import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { photoUrl } = await request.json();

    if (!photoUrl) {
      return NextResponse.json(
        { error: "photoUrl is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

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
          "Extract contact information from this business card or name badge image. Return JSON with fields: name, company, email, phone. If a field is not visible, omit it.",
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
                text: "Extract the contact information from this image and return it as JSON.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Anthropic API error:", response.status, errorBody);
      return NextResponse.json(
        { error: "Failed to process image with Claude API" },
        { status: 502 }
      );
    }

    const data = await response.json();

    const textBlock = data.content?.find(
      (block: { type: string }) => block.type === "text"
    );
    const rawText = textBlock?.text ?? "";

    // Extract JSON from the response text (may be wrapped in markdown code fences)
    let extracted: Record<string, string>;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
      extracted = JSON.parse(jsonString);
    } catch {
      console.error("Failed to parse JSON from Claude response:", rawText);
      return NextResponse.json(
        { error: "Failed to parse extracted contact information" },
        { status: 500 }
      );
    }

    return NextResponse.json(extracted);
  } catch (error) {
    console.error("Extract API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
