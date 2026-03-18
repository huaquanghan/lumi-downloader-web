import { DownloadJob, QueueStatus, DownloadOptions } from "@/types";

/**
 * QueueManager - In-memory FIFO queue for download jobs
 * Single-worker async processor with configurable max queue size
 */
export class QueueManager {
  private jobs: Map<string, DownloadJob> = new Map();
  private queue: string[] = []; // Job IDs in FIFO order
  private currentJobId: string | null = null;
  private maxSize: number;
  private isProcessing: boolean = false;

  constructor(maxSize: number = 10) {
    this.maxSize = maxSize;
  }

  /**
   * Add a new job to the queue
   * @throws Error if queue is full
   */
  add(url: string, options: DownloadOptions): DownloadJob {
    if (this.queue.length >= this.maxSize) {
      throw new Error(`Queue is full (max ${this.maxSize} items)`);
    }

    const id = this.generateId();
    const job: DownloadJob = {
      id,
      url,
      status: "pending",
      format: options.format || "best",
      subtitles: options.subtitles,
      tiktokNoWatermark: options.tiktokNoWatermark,
      filename: options.filename,
      progress: {
        percent: 0,
      },
      createdAt: new Date(),
    };

    this.jobs.set(id, job);
    this.queue.push(id);

    // Trigger queue processing
    this.processQueue();

    return job;
  }

  /**
   * Get a job by ID
   */
  get(id: string): DownloadJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * Get the currently processing job
   */
  getCurrentJob(): DownloadJob | null {
    if (!this.currentJobId) return null;
    return this.jobs.get(this.currentJobId) || null;
  }

  /**
   * Get full queue status
   */
  getStatus(): QueueStatus {
    const current = this.getCurrentJob();
    const pending = this.queue
      .filter((id) => id !== this.currentJobId)
      .map((id) => this.jobs.get(id)!)
      .filter(Boolean);

    return {
      current,
      queue: pending,
      size: this.queue.length,
      maxSize: this.maxSize,
    };
  }

  /**
   * Update job progress
   */
  updateProgress(id: string, progress: number, speed?: string, eta?: string): void {
    const job = this.jobs.get(id);
    if (!job) return;

    job.progress = {
      percent: Math.min(100, Math.max(0, progress)),
      speed,
      eta,
    };
  }

  /**
   * Mark job as completed and trigger next
   */
  markCompleted(id: string): void {
    const job = this.jobs.get(id);
    if (!job) return;

    job.status = "completed";
    job.progress.percent = 100;
    job.completedAt = new Date();

    if (this.currentJobId === id) {
      this.currentJobId = null;
      this.isProcessing = false;
    }

    // Trigger next job
    this.processQueue();
  }

  /**
   * Mark job as failed and trigger next
   */
  markFailed(id: string, error: string): void {
    const job = this.jobs.get(id);
    if (!job) return;

    job.status = "error";
    job.error = error;
    job.completedAt = new Date();

    if (this.currentJobId === id) {
      this.currentJobId = null;
      this.isProcessing = false;
    }

    // Trigger next job
    this.processQueue();
  }

  /**
   * Cancel a pending job
   */
  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    // Can't cancel if already completed/failed
    if (job.status === "completed" || job.status === "error") {
      return false;
    }

    // If currently processing, mark as cancelled
    if (this.currentJobId === id) {
      job.status = "cancelled";
      job.completedAt = new Date();
      this.currentJobId = null;
      this.isProcessing = false;
      this.processQueue();
      return true;
    }

    // If pending, remove from queue
    const index = this.queue.indexOf(id);
    if (index > -1) {
      this.queue.splice(index, 1);
      job.status = "cancelled";
      job.completedAt = new Date();
      return true;
    }

    return false;
  }

  /**
   * Clear entire queue and reset state
   */
  clear(): void {
    this.jobs.clear();
    this.queue = [];
    this.currentJobId = null;
    this.isProcessing = false;
  }

  /**
   * Process queue with single-worker concurrency
   */
  private async processQueue(): Promise<void> {
    // Only one worker at a time
    if (this.isProcessing) return;

    // Get next pending job
    const nextJobId = this.queue.find((id) => {
      const job = this.jobs.get(id);
      return job?.status === "pending";
    });

    if (!nextJobId) return;

    const job = this.jobs.get(nextJobId);
    if (!job) return;

    this.isProcessing = true;
    this.currentJobId = nextJobId;
    job.status = "downloading";
    job.startedAt = new Date();

    // Note: Actual download implementation will be added in Phase 04
    // For now, this is a placeholder for the processor loop
    // The job will be processed by external download handler
  }

  /**
   * Generate unique job ID
   */
  private generateId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all jobs (for debugging/admin)
   */
  getAllJobs(): DownloadJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Remove completed/failed jobs older than TTL
   */
  cleanup(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let removed = 0;

    const entries = Array.from(this.jobs.entries());
    for (const [id, job] of entries) {
      if (job.status === "completed" || job.status === "error" || job.status === "cancelled") {
        const completedTime = job.completedAt?.getTime() || 0;
        if (now - completedTime > maxAgeMs) {
          this.jobs.delete(id);
          const queueIndex = this.queue.indexOf(id);
          if (queueIndex > -1) {
            this.queue.splice(queueIndex, 1);
          }
          removed++;
        }
      }
    }

    return removed;
  }
}

// Singleton instance with max queue size from env
const maxQueueSize = parseInt(process.env.MAX_QUEUE_SIZE || "10", 10);
export const queueManager = new QueueManager(maxQueueSize);
