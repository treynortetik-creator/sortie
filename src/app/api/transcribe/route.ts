import { NextResponse } from "next/server";
import { transcribeRequestSchema, transcribeResponseSchema } from "@/lib/schemas";

export async function POST(request: Request): Promise<NextResponse> {
  try {
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

      const audioBlob = await audioResponse.blob();

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
