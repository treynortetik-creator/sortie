import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { audioUrl } = await request.json();

    if (!audioUrl) {
      return NextResponse.json(
        { error: "audioUrl is required" },
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

    const data = await whisperResponse.json();

    return NextResponse.json({ transcription: data.text });
  } catch (error) {
    console.error("Transcribe API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
