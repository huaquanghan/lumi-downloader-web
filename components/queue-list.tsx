"use client";

import * as React from "react";
import { DownloadCard } from "./download-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { QueueStatus, DownloadJob } from "@/types";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Delete01Icon, CircleArrowReload01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

interface QueueListProps {
  pollInterval?: number;
  className?: string;
  maxHeight?: string;
}

export function QueueList({
  pollInterval = 1000,
  className,
  maxHeight = "400px",
}: QueueListProps) {
  const [queueStatus, setQueueStatus] = React.useState<QueueStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isClearing, setIsClearing] = React.useState(false);

  // Fetch queue status
  const fetchQueueStatus = React.useCallback(async () => {
    try {
      const response = await fetch("/api/queue");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setQueueStatus(data);
    } catch (error) {
      console.error("Failed to fetch queue status:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll for updates
  React.useEffect(() => {
    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, pollInterval);
    return () => clearInterval(interval);
  }, [fetchQueueStatus, pollInterval]);

  // Clear queue
  const handleClearQueue = async () => {
    setIsClearing(true);
    try {
      const response = await fetch("/api/queue", { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      toast.success("Queue cleared");
      await fetchQueueStatus();
    } catch (error) {
      toast.error("Failed to clear queue");
      console.error("Failed to clear queue:", error);
    } finally {
      setIsClearing(false);
    }
  };

  // Cancel current job
  const handleCancel = async () => {
    // Note: Cancel functionality would need a dedicated API endpoint
    // For now, just show a toast
    toast.info("Cancel functionality not yet implemented");
  };

  // Parse dates from API response
  const parseJob = (job: DownloadJob): DownloadJob => ({
    ...job,
    createdAt: new Date(job.createdAt),
    startedAt: job.startedAt ? new Date(job.startedAt) : undefined,
    completedAt: job.completedAt ? new Date(job.completedAt) : undefined,
  });

  const current = queueStatus?.current ? parseJob(queueStatus.current) : null;
  const queue = queueStatus?.queue.map(parseJob) ?? [];
  const hasItems = current !== null || queue.length > 0;

  // Show nothing if empty
  if (!hasItems && !isLoading) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Download Queue</h3>
          {isLoading && (
            <HugeiconsIcon
              icon={CircleArrowReload01Icon}
              strokeWidth={2}
              className="size-3.5 animate-spin text-muted-foreground"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {current?.status === "downloading" && (
            <Button
              variant="outline"
              size="xs"
              onClick={handleCancel}
              disabled={isClearing}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              Cancel
            </Button>
          )}
          {hasItems && (
            <Button
              variant="outline"
              size="xs"
              onClick={handleClearQueue}
              disabled={isClearing}
            >
              <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Queue size indicator */}
      <div className="text-xs text-muted-foreground">
        {current && queue.length === 0
          ? "1 item processing"
          : current
          ? `${queue.length + 1} items (${queue.length} waiting)`
          : queue.length > 0
          ? `${queue.length} items waiting`
          : "Queue empty"}
        {queueStatus?.maxSize && ` / Max: ${queueStatus.maxSize}`}
      </div>

      {/* Queue list */}
      <ScrollArea className="w-full" style={{ maxHeight }}>
        <div className="space-y-3 pr-3">
          {/* Current job */}
          {current && (
            <DownloadCard job={current} isActive={true} />
          )}

          {/* Queue items */}
          {queue.map((job) => (
            <DownloadCard key={job.id} job={job} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
