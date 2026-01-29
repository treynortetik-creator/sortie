import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { name, company, email, notes, eventName } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
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

    const userMessage = [
      `Contact name: ${name}`,
      company ? `Company: ${company}` : null,
      email ? `Email: ${email}` : null,
      eventName ? `Event: ${eventName}` : null,
      notes ? `Meeting notes: ${notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

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
          "You are a sales representative at SafelyYou, an AI-powered fall detection company for senior living communities. Write a brief, personalized follow-up email based on the event meeting details provided. Be professional but warm.",
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Anthropic API error:", response.status, errorBody);
      return NextResponse.json(
        { error: "Failed to generate email draft with Claude API" },
        { status: 502 }
      );
    }

    const data = await response.json();

    const textBlock = data.content?.find(
      (block: { type: string }) => block.type === "text"
    );
    const emailDraft = textBlock?.text ?? "";

    return NextResponse.json({ emailDraft });
  } catch (error) {
    console.error("Draft email API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
