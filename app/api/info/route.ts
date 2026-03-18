import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchVideoInfo } from "@/lib/ytdlp";

const infoRequestSchema = z.object({
  url: z.string().url("Invalid URL provided"),
  playlist: z.boolean().optional().default(false),
});

/**
 * POST /api/info
 * Fetch video metadata using yt-dlp
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = infoRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { url, playlist } = parsed.data;

    const videoInfo = await fetchVideoInfo(url, playlist);

    return NextResponse.json(videoInfo);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Check for specific error types
    if (errorMessage.includes("Unsupported platform")) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch video info", message: errorMessage },
      { status: 500 }
    );
  }
}
