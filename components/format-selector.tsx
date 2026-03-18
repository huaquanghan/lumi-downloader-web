"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Format options from config/downloader.json
const FORMAT_OPTIONS = [
  { id: "best", name: "Best Quality", description: "Best available quality" },
  { id: "worst", name: "Worst Quality", description: "Lowest quality (smallest file)" },
  { id: "bestaudio", name: "Best Audio", description: "Best audio only" },
  { id: "worstaudio", name: "Worst Audio", description: "Lowest audio quality" },
  { id: "bestvideo", name: "Best Video", description: "Best video only (no audio)" },
  { id: "worstvideo", name: "Worst Video", description: "Lowest video quality" },
  { id: "mp4", name: "MP4 Format", description: "MP4 container with best quality" },
  { id: "webm", name: "WebM Format", description: "WebM container with best quality" },
] as const;

export type FormatOption = (typeof FORMAT_OPTIONS)[number]["id"];

interface FormatSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function FormatSelector({
  value,
  onChange,
  className,
  disabled,
}: FormatSelectorProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-xs font-medium text-muted-foreground">
        Format
      </label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select format..." />
        </SelectTrigger>
        <SelectContent>
          {FORMAT_OPTIONS.map((format) => (
            <SelectItem key={format.id} value={format.id}>
              <div className="flex flex-col">
                <span>{format.name}</span>
                <span className="text-xs text-muted-foreground">
                  {format.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Export format options for use elsewhere
export { FORMAT_OPTIONS };
