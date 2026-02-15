import { NextResponse } from "next/server";
import { transcribeRequestSchema, transcribeResponseSchema } from "@/lib/schemas";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";

// 20 transcriptions per user per minute
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60_000;

// Max audio download size: 25 MB (Whisper API limit)
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

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
      `transcribe:${user.id}`,
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
    const parsed = transcribeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const { audioUrl } = parsed.data;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const audioResponse = await fetch(audioUrl, { signal: controller.signal });
      if (!audioResponse.ok) {
        return NextResponse.json(
          { error: "Failed to download audio from the provided URL" },
          { status: 400 }
        );
      }

      // Check Content-Length before downloading the full body
      const contentLength = audioResponse.headers.get("Content-Length");
      if (contentLength && parseInt(contentLength, 10) > MAX_AUDIO_BYTES) {
        return NextResponse.json(
          { error: `Audio file too large. Maximum size is ${MAX_AUDIO_BYTES / (1024 * 1024)} MB.` },
          { status: 413 }
        );
      }

      const audioBlob = await audioResponse.blob();

      // Double-check actual blob size
      if (audioBlob.size > MAX_AUDIO_BYTES) {
        return NextResponse.json(
          { error: `Audio file too large. Maximum size is ${MAX_AUDIO_BYTES / (1024 * 1024)} MB.` },
          { status: 413 }
        );
      }

      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");
      formData.append("model", "whisper-1");

      const whisperResponse = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
          signal: controller.signal,
        }
      );

      if (!whisperResponse.ok) {
        const errorBody = await whisperResponse.text();
        console.error("OpenAI Whisper API error:", whisperResponse.status, errorBody);
        return NextResponse.json(
          { error: "Failed to transcribe audio with Whisper API" },
          { status: 502 }
        );
      }

      const data: unknown = await whisperResponse.json();
      const validated = transcribeResponseSchema.safeParse(data);

      if (!validated.success) {
        console.error("Whisper response validation failed:", validated.error);
        return NextResponse.json(
          { error: "Unexpected response from Whisper API" },
          { status: 502 }
        );
      }

      return NextResponse.json({ transcription: validated.data.text });
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
    console.error("Transcribe API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
