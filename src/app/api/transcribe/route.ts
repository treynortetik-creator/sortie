import { NextResponse } from "next/server";

interface WhisperResponse {
  text: string;
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const { audioUrl } = body as { audioUrl: string };

    if (!audioUrl || typeof audioUrl !== 'string' || (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://'))) {
      return NextResponse.json(
        { error: "audioUrl must be a valid HTTP or HTTPS URL" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Download the audio file from the provided URL
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return NextResponse.json(
        { error: "Failed to download audio from the provided URL" },
        { status: 400 }
      );
    }

    const audioBlob = await audioResponse.blob();

    // Build multipart form data for the Whisper API
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

    const data: WhisperResponse = await whisperResponse.json();

    return NextResponse.json({ transcription: data.text });
  } catch (error) {
    console.error("Transcribe API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
