"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DownloadJob, DownloadStatus } from "@/types";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FileDownloadIcon,
  Alert01Icon,
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  Loading02Icon,
  TimeScheduleIcon,
} from "@hugeicons/core-free-icons";

interface DownloadCardProps {
  job: DownloadJob;
  isActive?: boolean;
  className?: string;
}

const statusConfig: Record<DownloadStatus, {
  variant: "default" | "secondary" | "destructive" | "outline";
  label: string;
  icon: typeof FileDownloadIcon;
}> = {
  pending: { variant: "outline", label: "Pending", icon: TimeScheduleIcon },
  downloading: { variant: "default", label: "Downloading", icon: Loading02Icon },
  processing: { variant: "secondary", label: "Processing", icon: Loading02Icon },
  completed: { variant: "default", label: "Completed", icon: CheckmarkCircle02Icon },
  error: { variant: "destructive", label: "Error", icon: Alert01Icon },
  cancelled: { variant: "outline", label: "Cancelled", icon: CancelCircleIcon },
};

export function DownloadCard({ job, isActive, className }: DownloadCardProps) {
  const status = statusConfig[job.status];
  const isInProgress = job.status === "downloading" || job.status === "processing";
  const showProgress = isInProgress && job.progress.percent > 0;

  // Truncate URL for display
  const displayUrl = React.useMemo(() => {
    try {
      const url = new URL(job.url);
      const path = url.pathname + url.search;
      return path.length > 40 ? path.slice(0, 40) + "..." : path;
    } catch {
      return job.url.length > 50 ? job.url.slice(0, 50) + "..." : job.url;
    }
  }, [job.url]);

  return (
    <Card
      className={cn(
        "transition-all",
        isActive && "ring-2 ring-primary",
        job.status === "error" && "border-destructive/50",
        job.status === "completed" && "border-green-500/50",
        className
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm truncate" title={job.url}>
              {displayUrl}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <HugeiconsIcon icon={status.icon} strokeWidth={2} className="size-3" />
              <span className="capitalize">{job.status}</span>
              {job.progress.speed && (
                <span className="text-xs">• {job.progress.speed}</span>
              )}
            </CardDescription>
          </div>
          <Badge variant={status.variant} className="shrink-0">
            {status.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Progress bar */}
        {(showProgress || job.status === "completed") && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{job.progress.percent.toFixed(1)}%</span>
              {job.progress.eta && <span>ETA: {job.progress.eta}</span>}
            </div>
            <Progress value={job.progress.percent} />
          </div>
        )}

        {/* Format and options */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-0.5 bg-muted rounded text-muted-foreground">
            Format: {job.format}
          </span>
          {job.subtitles && job.subtitles.length > 0 && (
            <span className="px-2 py-0.5 bg-muted rounded text-muted-foreground">
              Subtitles: {job.subtitles.join(", ")}
            </span>
          )}
          {job.tiktokNoWatermark && (
            <span className="px-2 py-0.5 bg-muted rounded text-muted-foreground">
              No watermark
            </span>
          )}
        </div>

        {/* Error message */}
        {job.error && (
          <div className="p-2 bg-destructive/10 text-destructive text-xs rounded">
            <div className="flex items-start gap-1.5">
              <HugeiconsIcon icon={Alert01Icon} strokeWidth={2} className="size-3.5 shrink-0 mt-0.5" />
              <span>{job.error}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
