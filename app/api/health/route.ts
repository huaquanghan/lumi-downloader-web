import { NextResponse } from "next/server";
import { checkYtDlpHealth } from "@/lib/ytdlp";

/**
 * GET /api/health
 * Health check endpoint for Docker/container orchestration
 */
export async function GET() {
  try {
    // Check yt-dlp is available
    const ytDlpHealth = await checkYtDlpHealth();

    if (!ytDlpHealth.ok) {
      return NextResponse.json(
        {
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          checks: {
            ytdlp: {
              status: "down",
              error: ytDlpHealth.error,
            },
          },
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        checks: {
          ytdlp: {
            status: "up",
            version: ytDlpHealth.version,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
