"use client";

import * as React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { UrlInput } from "@/components/url-input";
import { FormatSelector } from "@/components/format-selector";
import { QueueList } from "@/components/queue-list";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Download02Icon,
  InformationCircleIcon,
  SubtitleIcon,
  PlaylistIcon,
  Remove02Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";

// Check if URL is from TikTok
function isTikTokUrl(url: string): boolean {
  return /tiktok\.com/i.test(url) || /vt\.tiktok\.com/i.test(url);
}

// Check if any URL is a playlist
function hasPlaylistUrl(urls: string[]): boolean {
  return urls.some(url => 
    /youtube\.com\/playlist|youtube\.com\/.*list=/i.test(url) ||
    /youtu\.be\/.*list=/i.test(url)
  );
}

export default function HomePage() {
  // State management
  const [urls, setUrls] = React.useState<string[]>([""]);
  const [format, setFormat] = React.useState<string>("best");
  const [tiktokNoWatermark, setTiktokNoWatermark] = React.useState(false);
  const [includeSubtitles, setIncludeSubtitles] = React.useState(false);
  const [downloadPlaylist, setDownloadPlaylist] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [fetchingInfo, setFetchingInfo] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Derived state
  const hasTikTokUrl = urls.some(url => isTikTokUrl(url));
  const hasPlaylist = hasPlaylistUrl(urls);
  const validUrls = urls.filter(url => url.trim() !== "");
  const hasValidUrls = validUrls.length > 0;

  // Clear error when inputs change
  React.useEffect(() => {
    setError(null);
  }, [urls, format]);

  // Handle fetch video info
  const handleFetchInfo = async () => {
    if (!hasValidUrls) {
      setError("Please enter at least one URL");
      toast.error("Please enter at least one URL");
      return;
    }

    setFetchingInfo(true);
    setError(null);

    try {
      // Fetch info for first URL only (info is for preview)
      const url = validUrls[0];
      const response = await fetch("/api/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, playlist: downloadPlaylist }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const info = await response.json();
      
      if (info.isPlaylist && info.playlistItems) {
        toast.success(`Playlist detected: ${info.playlistItems.length} items`);
      } else {
        toast.success(`Video info: ${info.title || "Unknown title"}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch info";
      setError(message);
      toast.error(message);
    } finally {
      setFetchingInfo(false);
    }
  };

  // Handle download
  const handleDownload = async () => {
    if (!hasValidUrls) {
      setError("Please enter at least one URL");
      toast.error("Please enter at least one URL");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Download each URL sequentially
      for (const url of validUrls) {
        toast.info(`Starting download: ${url.slice(0, 40)}...`);

        const response = await fetch("/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            format,
            subtitles: includeSubtitles ? ["en"] : undefined,
            tiktokNoWatermark: hasTikTokUrl ? tiktokNoWatermark : undefined,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        // Get filename from Content-Disposition header
        const contentDisposition = response.headers.get("Content-Disposition");
        let filename = "download";
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="([^"]+)"/);
          if (match) {
            filename = match[1];
          }
        }

        // Create blob from response
        const blob = await response.blob();

        // Trigger browser download
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);

        toast.success(`Downloaded: ${filename}`);
      }

      // Clear URLs after successful download
      setUrls([""]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col p-4 lg:p-6">
          <div className="mx-auto w-full max-w-4xl space-y-6">
            {/* Title */}
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                Lumi Downloader
              </h1>
              <p className="text-muted-foreground text-sm">
                Download videos from YouTube, TikTok, and other platforms
              </p>
            </div>

            {/* Main Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Download Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* URL Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Video URLs</label>
                  <UrlInput
                    urls={urls}
                    onChange={setUrls}
                    maxUrls={10}
                    placeholder="Paste video URL here (YouTube, TikTok, etc.)"
                  />
                </div>

                {/* Format + Options Row */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <FormatSelector
                    value={format}
                    onChange={setFormat}
                    disabled={loading}
                    className="flex-1"
                  />

                  {/* Options Checkboxes */}
                  <div className="flex flex-wrap gap-4 sm:pt-5">
                    {hasPlaylist && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={downloadPlaylist}
                          onCheckedChange={(checked) =>
                            setDownloadPlaylist(checked === true)
                          }
                          disabled={loading}
                        />
                        <HugeiconsIcon
                          icon={PlaylistIcon}
                          strokeWidth={2}
                          className="size-4 text-muted-foreground"
                        />
                        <span>Download playlist</span>
                      </label>
                    )}

                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={includeSubtitles}
                        onCheckedChange={(checked) =>
                          setIncludeSubtitles(checked === true)
                        }
                        disabled={loading}
                      />
                      <HugeiconsIcon
                        icon={SubtitleIcon}
                        strokeWidth={2}
                        className="size-4 text-muted-foreground"
                      />
                      <span>Include subtitles</span>
                    </label>

                    {hasTikTokUrl && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={tiktokNoWatermark}
                          onCheckedChange={(checked) =>
                            setTiktokNoWatermark(checked === true)
                          }
                          disabled={loading}
                        />
                        <HugeiconsIcon
                          icon={Remove02Icon}
                          strokeWidth={2}
                          className="size-4 text-muted-foreground"
                        />
                        <span>No watermark (TikTok)</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={handleFetchInfo}
                    disabled={!hasValidUrls || fetchingInfo || loading}
                    className="flex-1 sm:flex-none"
                  >
                    <HugeiconsIcon
                      icon={InformationCircleIcon}
                      strokeWidth={2}
                    />
                    {fetchingInfo ? "Fetching..." : "Fetch Info"}
                  </Button>

                  <Button
                    onClick={handleDownload}
                    disabled={!hasValidUrls || loading || fetchingInfo}
                    className="flex-1"
                  >
                    <HugeiconsIcon icon={Download02Icon} strokeWidth={2} />
                    {loading
                      ? `Downloading (${validUrls.length} items)...`
                      : `Download${validUrls.length > 1 ? ` (${validUrls.length})` : ""}`}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Queue List */}
            <QueueList pollInterval={2000} maxHeight="500px" />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
