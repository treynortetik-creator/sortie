import { NextResponse } from "next/server";
import { draftEmailRequestSchema } from "@/lib/schemas";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";

interface AnthropicContentBlock {
  type: "text" | "tool_use";
  text?: string;
}

interface AnthropicMessagesResponse {
  content: AnthropicContentBlock[];
}

// 20 drafts per user per minute
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
      `draft-email:${user.id}`,
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
    const parsed = draftEmailRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const { name, company, email, notes, eventName } = parsed.data;

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
            "You are a sales representative at SafelyYou, an AI-powered fall detection company for senior living communities. " +
            "Write a personalized follow-up email based on the event meeting details provided.\n\n" +
            "Guidelines:\n" +
            "- Start with a subject line on the first line formatted as 'Subject: ...'\n" +
            "- Reference the specific event and any conversation topics from the notes\n" +
            "- Keep it concise (3-5 short paragraphs max)\n" +
            "- Include a clear call-to-action (schedule a call, demo, etc.)\n" +
            "- Be professional but warm and genuine — not salesy or pushy\n" +
            "- If notes mention specific pain points or interests, address them directly\n" +
            "- Sign off as the SafelyYou team member (leave name as [Your Name])",
          messages: [
            {
              role: "user",
              content: userMessage,
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Anthropic API error:", response.status, errorBody);
        return NextResponse.json(
          { error: "Failed to generate email draft with Claude API" },
          { status: 502 }
        );
      }

      const data: AnthropicMessagesResponse = await response.json();

      const textBlock = data.content.find(
        (block) => block.type === "text"
      );
      const emailDraft = textBlock?.text ?? "";

      return NextResponse.json({ emailDraft });
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
    console.error("Draft email API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
