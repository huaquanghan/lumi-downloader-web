import { NextRequest, NextResponse } from "next/server";
import { queueManager } from "@/lib/queue";

/**
 * GET /api/queue
 * Get current queue status including current job and pending jobs
 */
export async function GET(_request: NextRequest) {
  try {
    const status = queueManager.getStatus();
    
    // Convert Date objects to ISO strings for JSON serialization
    const serializeJob = (job: typeof status.current) => {
      if (!job) return null;
      return {
        ...job,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
      };
    };

    const response = {
      current: serializeJob(status.current),
      queue: status.queue.map(serializeJob).filter(Boolean),
      size: status.size,
      maxSize: status.maxSize,
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to get queue status", message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/queue
 * Clear all jobs from the queue and reset state
 */
export async function DELETE(_request: NextRequest) {
  try {
    queueManager.clear();
    
    return NextResponse.json(
      { message: "Queue cleared" },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to clear queue", message: errorMessage },
      { status: 500 }
    );
  }
}
