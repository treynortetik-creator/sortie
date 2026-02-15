import { NextResponse } from "next/server";
import { draftEmailRequestSchema } from "@/lib/schemas";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";

interface OpenRouterChoice {
  message: { role: string; content: string };
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
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

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is not configured" },
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

    const model = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-20250514";
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
            },
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
        console.error("OpenRouter API error:", response.status, errorBody);
        return NextResponse.json(
          { error: "Failed to generate email draft with AI API" },
          { status: 502 }
        );
      }

      const data: OpenRouterResponse = await response.json();
      const emailDraft = data.choices?.[0]?.message?.content ?? "";

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
