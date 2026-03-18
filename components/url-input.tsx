"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Cancel01Icon, LinkIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

interface UrlInputProps {
  urls: string[];
  onChange: (urls: string[]) => void;
  maxUrls?: number;
  placeholder?: string;
  className?: string;
}

export function UrlInput({
  urls,
  onChange,
  maxUrls = 10,
  placeholder = "Paste video URL here...",
  className,
}: UrlInputProps) {
  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    onChange(newUrls);
  };

  const handleAddUrl = () => {
    if (urls.length < maxUrls) {
      onChange([...urls, ""]);
    }
  };

  const handleRemoveUrl = (index: number) => {
    const newUrls = urls.filter((_, i) => i !== index);
    onChange(newUrls.length === 0 ? [""] : newUrls);
  };

  // Ensure at least one input field
  React.useEffect(() => {
    if (urls.length === 0) {
      onChange([""]);
    }
  }, [urls, onChange]);

  return (
    <div className={cn("space-y-2", className)}>
      {urls.map((url, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="relative flex-1">
            <HugeiconsIcon
              icon={LinkIcon}
              strokeWidth={2}
              className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground"
            />
            <Input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(index, e.target.value)}
              placeholder={placeholder}
              className="pl-8"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            onClick={() => handleRemoveUrl(index)}
            disabled={urls.length === 1 && !url}
            aria-label="Remove URL"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </Button>
        </div>
      ))}
      {urls.length < maxUrls && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAddUrl}
          className="w-full"
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
          Add another URL
        </Button>
      )}
    </div>
  );
}
