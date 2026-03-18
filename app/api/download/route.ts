import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queueManager } from "@/lib/queue";
import { streamDownload, sanitizeFilename, isSupportedUrl } from "@/lib/ytdlp";

const DOWNLOAD_TIMEOUT_MS = parseInt(process.env.DOWNLOAD_TIMEOUT_MS || "300000", 10);
const MAX_WAIT_MS = 60 * 60 * 1000; // 1 hour max wait for queue

const downloadRequestSchema = z.object({
  url: z.string().url("Invalid URL provided"),
  format: z.string().optional(),
  subtitles: z.array(z.string()).optional(),
  tiktokNoWatermark: z.boolean().optional(),
  filename: z.string().optional(),
});

/**
 * Wait for a job to become the current (active) job in the queue
 * Polls every 100ms, rejects if job fails before starting
 */
async function waitForTurn(jobId: string): Promise<void> {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      const job = queueManager.get(jobId);
      const currentJob = queueManager.getCurrentJob();
      
      if (!job) {
        clearInterval(checkInterval);
        reject(new Error("Job not found"));
        return;
      }
      
      // Job is now current - it's our turn
      if (currentJob?.id === jobId) {
        clearInterval(checkInterval);
        resolve();
        return;
      }
      
      // Job failed before starting
      if (job.status === "error") {
        clearInterval(checkInterval);
        reject(new Error(job.error || "Job failed before starting"));
        return;
      }
      
      // Job was cancelled
      if (job.status === "cancelled") {
        clearInterval(checkInterval);
        reject(new Error("Job was cancelled"));
        return;
      }
      
      // Timeout after max wait
      if (Date.now() - startTime > MAX_WAIT_MS) {
        clearInterval(checkInterval);
        reject(new Error("Timeout waiting for turn in queue"));
        return;
      }
    }, 100);
  });
}

/**
 * POST /api/download
 * Stream download directly to client (no server storage)
 */
export async function POST(request: NextRequest) {
  let jobId: string | null = null;
  
  try {
    const body = await request.json();
    const parsed = downloadRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { url, format, subtitles, tiktokNoWatermark, filename } = parsed.data;

    // Validate URL is supported
    if (!isSupportedUrl(url)) {
      return NextResponse.json(
        { error: "Unsupported platform" },
        { status: 400 }
      );
    }

    // Add job to queue
    const job = queueManager.add(url, {
      url,
      format,
      subtitles,
      tiktokNoWatermark,
      filename,
    });
    jobId = job.id;

    // Wait for our turn in the queue
    await waitForTurn(jobId);

    // Update job status to downloading
    const updatedJob = queueManager.get(jobId);
    if (!updatedJob) {
      throw new Error("Job disappeared from queue");
    }

    // Determine content type based on format
    const isAudioOnly = format?.includes("audio") || format === "bestaudio";
    const contentType = isAudioOnly ? "audio/mpeg" : "video/mp4";
    
    // Build sanitized filename
    const sanitizedFilename = sanitizeFilename(filename || `download_${Date.now()}`);
    const extension = isAudioOnly ? ".mp3" : ".mp4";
    const finalFilename = sanitizedFilename.endsWith(extension) 
      ? sanitizedFilename 
      : sanitizedFilename + extension;

    // Start the download stream
    const { stream, kill, waitForCompletion } = streamDownload(
      {
        url,
        format,
        subtitles,
        tiktokNoWatermark,
        timeout: DOWNLOAD_TIMEOUT_MS,
      },
      (progress) => {
        // Update job progress
        queueManager.updateProgress(jobId!, progress.percent, progress.speed, progress.eta);
      }
    );

    // Convert Node.js stream to Web Stream using Readable.toWeb()
    const webStream = (stream as unknown as { getReader: () => ReadableStreamDefaultReader<Uint8Array> }).getReader 
      ? stream as unknown as ReadableStream<Uint8Array>
      : new ReadableStream({
          start(controller) {
            stream.on("data", (chunk: Buffer) => {
              controller.enqueue(new Uint8Array(chunk));
            });
            stream.on("end", () => {
              controller.close();
              queueManager.markCompleted(jobId!);
            });
            stream.on("error", (err: Error) => {
              controller.error(err);
              queueManager.markFailed(jobId!, err.message);
            });
          },
          cancel() {
            kill();
          },
        });

    // Handle completion in background
    waitForCompletion().catch((err) => {
      queueManager.markFailed(jobId!, err.message);
    });

    // Return the streaming response
    return new Response(webStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${finalFilename}"`,
        "X-Download-Id": jobId,
        "Cache-Control": "no-cache",
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Mark job as failed if it exists
    if (jobId) {
      queueManager.markFailed(jobId, errorMessage);
    }

    // Check for specific error types
    if (errorMessage.includes("Unsupported platform")) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    if (errorMessage.includes("Timeout")) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Download failed", message: errorMessage },
      { status: 500 }
    );
  }
}
