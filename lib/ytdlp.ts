/**
 * yt-dlp wrapper module for video downloading and metadata extraction
 * Supports streaming output, progress tracking, and format selection
 */

import { spawn, ChildProcess } from "child_process";
import { VideoInfo, VideoFormat, SubtitleTrack, PlaylistItem } from "@/types";
import config from "@/config/downloader.json";

// Environment and constants
const YTDLP_PATH = process.env.YTDLP_PATH || "./yt-dlp";
const DOWNLOAD_TIMEOUT = parseInt(process.env.DOWNLOAD_TIMEOUT_MS || "300000", 10);

// Format mapping for yt-dlp
const FORMAT_MAP: Record<string, string> = {
  best: "best",
  worst: "worst",
  bestaudio: "bestaudio",
  worstaudio: "worstaudio",
  bestvideo: "bestvideo",
  worstvideo: "worstvideo",
  mp4: "best[ext=mp4]/best",
  webm: "best[ext=webm]/best",
};

// Supported platforms
const SUPPORTED_PLATFORMS: string[] = config.supportedPlatforms;

/**
 * Check if URL is from a supported platform
 */
export function isSupportedUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return SUPPORTED_PLATFORMS.some((platform) => hostname.includes(platform));
  } catch {
    return false;
  }
}

/**
 * Check if URL is a TikTok URL
 */
export function isTikTokUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return hostname.includes("tiktok.com");
  } catch {
    return false;
  }
}

/**
 * Build yt-dlp command arguments based on options
 */
export interface YtDlpOptions {
  url: string;
  format?: string;
  subtitles?: string[];
  tiktokNoWatermark?: boolean;
  outputToStdout?: boolean;
  noPlaylist?: boolean;
  playlist?: boolean;
  dumpJson?: boolean;
  timeout?: number;
}

export function buildYtDlpArgs(options: YtDlpOptions): string[] {
  const args: string[] = [];

  // Add format selection
  if (options.format && FORMAT_MAP[options.format]) {
    args.push("-f", FORMAT_MAP[options.format]);
  } else {
    args.push("-f", "best");
  }

  // TikTok no-watermark support
  if (options.tiktokNoWatermark && isTikTokUrl(options.url)) {
    args.push("--extractor-args", "tiktok:watermark=false");
  }

  // Subtitle handling
  if (options.subtitles && options.subtitles.length > 0) {
    args.push("--write-subs");
    args.push("--sub-langs", options.subtitles.join(","));
    args.push("--embed-subs");
  }

  // Output to stdout for streaming
  if (options.outputToStdout) {
    args.push("-o", "-");
    args.push("--no-part");
    args.push("--no-playlist");
  }

  // Playlist handling
  if (options.noPlaylist) {
    args.push("--no-playlist");
  }

  if (options.playlist) {
    args.push("--yes-playlist");
  }

  // JSON dump for info extraction
  if (options.dumpJson) {
    args.push("--dump-json");
  }

  // Network and timeout settings
  args.push("--socket-timeout", String(Math.floor((options.timeout || DOWNLOAD_TIMEOUT) / 1000)));
  args.push("--retries", "3");

  // Add URL at the end
  args.push(options.url);

  return args;
}

/**
 * Parse video formats from yt-dlp JSON output
 */
function parseFormats(formats: unknown[]): VideoFormat[] {
  if (!Array.isArray(formats)) return [];

  return formats.map((fmt: unknown) => {
    const f = fmt as Record<string, unknown>;
    return {
      formatId: String(f.format_id || ""),
      ext: String(f.ext || ""),
      quality: String(f.quality || ""),
      resolution: String(f.resolution || f.format_note || ""),
      filesize: typeof f.filesize === "number" ? f.filesize : undefined,
      audioCodec: String(f.acodec || ""),
      videoCodec: String(f.vcodec || ""),
    };
  });
}

/**
 * Parse subtitles from yt-dlp JSON output
 */
function parseSubtitles(subs: unknown): Record<string, SubtitleTrack[]> {
  if (!subs || typeof subs !== "object") return {};

  const result: Record<string, SubtitleTrack[]> = {};
  const subsObj = subs as Record<string, unknown[]>;

  for (const [lang, tracks] of Object.entries(subsObj)) {
    if (Array.isArray(tracks)) {
      result[lang] = tracks.map((track: unknown) => {
        const t = track as Record<string, string>;
        return {
          lang,
          name: t.name || lang,
          url: t.url || "",
        };
      });
    }
  }

  return result;
}

/**
 * Fetch video information using yt-dlp
 */
export async function fetchVideoInfo(
  url: string,
  includePlaylist: boolean = false
): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    if (!isSupportedUrl(url)) {
      reject(new Error(`Unsupported platform: ${url}`));
      return;
    }

    const args = buildYtDlpArgs({
      url,
      dumpJson: true,
      playlist: includePlaylist,
      noPlaylist: !includePlaylist,
    });

    let stdout = "";
    let stderr = "";

    const child = spawn(YTDLP_PATH, args, {
      timeout: DOWNLOAD_TIMEOUT,
    });

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Handle playlist output (multiple JSON lines)
        const lines = stdout.trim().split("\n").filter(Boolean);
        
        if (lines.length === 0) {
          reject(new Error("No video information returned"));
          return;
        }

        // First line is the main video or first playlist item
        const mainData = JSON.parse(lines[0]) as Record<string, unknown>;
        
        const videoInfo: VideoInfo = {
          id: String(mainData.id || ""),
          title: String(mainData.title || ""),
          description: mainData.description ? String(mainData.description) : undefined,
          duration: typeof mainData.duration === "number" ? mainData.duration : undefined,
          thumbnail: mainData.thumbnail ? String(mainData.thumbnail) : undefined,
          uploader: mainData.uploader ? String(mainData.uploader) : undefined,
          formats: parseFormats((mainData.formats as unknown[]) || []),
          subtitles: parseSubtitles(mainData.subtitles),
          isPlaylist: lines.length > 1 || typeof mainData.playlist_index === "number",
        };

        // Parse playlist items if multiple lines
        if (lines.length > 1) {
          videoInfo.playlistItems = lines.map((line, index) => {
            const item = JSON.parse(line) as Record<string, unknown>;
            return {
              id: String(item.id || `item_${index}`),
              title: String(item.title || ""),
              url: String(item.webpage_url || item.url || ""),
              duration: typeof item.duration === "number" ? item.duration : undefined,
            };
          });
        }

        resolve(videoInfo);
      } catch (err) {
        reject(new Error(`Failed to parse video info: ${(err as Error).message}`));
      }
    });

    child.on("error", (err: Error) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });
}

/**
 * Progress data from yt-dlp download
 */
export interface DownloadProgress {
  percent: number;
  speed?: string;
  eta?: string;
  totalSize?: string;
  downloaded?: string;
}

/**
 * Result from stream download
 */
export interface StreamResult {
  stream: NodeJS.ReadableStream;
  kill: () => void;
  waitForCompletion: () => Promise<void>;
}

/**
 * Parse progress line from yt-dlp stderr
 * Format: [download] 12.3% of ~123.45MiB at 1.23MiB/s ETA 00:45
 */
function parseProgress(line: string): DownloadProgress | null {
  const match = line.match(
    /\[download\]\s+(\d+\.?\d*)%\s+of\s+(~?[\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+(\d+:\d+)/
  );

  if (match) {
    return {
      percent: parseFloat(match[1]),
      downloaded: match[2],
      totalSize: match[2].startsWith("~") ? match[2].slice(1) : match[2],
      speed: match[3],
      eta: match[4],
    };
  }

  // Alternative format without ETA
  const simpleMatch = line.match(/\[download\]\s+(\d+\.?\d*)%/);
  if (simpleMatch) {
    return {
      percent: parseFloat(simpleMatch[1]),
    };
  }

  return null;
}

/**
 * Stream download with progress callback
 */
export function streamDownload(
  options: YtDlpOptions,
  onProgress?: (progress: DownloadProgress) => void
): StreamResult {
  const args = buildYtDlpArgs({
    ...options,
    outputToStdout: true,
    noPlaylist: true,
  });

  const child = spawn(YTDLP_PATH, args, {
    timeout: options.timeout || DOWNLOAD_TIMEOUT,
  });

  // Parse progress from stderr
  if (onProgress && child.stderr) {
    child.stderr.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        const progress = parseProgress(line);
        if (progress) {
          onProgress(progress);
        }
      }
    });
  }

  // Return stream and control functions
  return {
    stream: child.stdout as NodeJS.ReadableStream,
    kill: () => {
      if (!child.killed) {
        child.kill("SIGTERM");
        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (!child.killed) {
            child.kill("SIGKILL");
          }
        }, 5000);
      }
    },
    waitForCompletion: () =>
      new Promise((resolve, reject) => {
        child.on("close", (code: number | null) => {
          if (code === 0 || code === null) {
            resolve();
          } else {
            reject(new Error(`Download failed with exit code ${code}`));
          }
        });

        child.on("error", (err: Error) => {
          reject(err);
        });
      }),
  };
}

/**
 * Sanitize filename by replacing invalid characters
 */
export function sanitizeFilename(name: string): string {
  // Replace invalid characters with underscore
  let sanitized = name.replace(/[<>:\"/\\|?*\x00-\x1f]/g, "_");
  
  // Limit to 100 characters
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }
  
  // Trim whitespace and dots
  sanitized = sanitized.trim().replace(/\.+$/, "");
  
  // Ensure not empty
  if (!sanitized) {
    sanitized = "download";
  }
  
  return sanitized;
}

/**
 * Get available formats from downloader config
 */
export function getAvailableFormats(): { id: string; name: string; description: string }[] {
  return config.formats;
}

/**
 * Check if yt-dlp binary is available and working
 */
export async function checkYtDlpHealth(): Promise<{
  ok: boolean;
  version?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const child = spawn(YTDLP_PATH, ["--version"], {
      timeout: 10000,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolve({
          ok: true,
          version: stdout.trim(),
        });
      } else {
        resolve({
          ok: false,
          error: `yt-dlp exited with code ${code}: ${stderr || stdout}`,
        });
      }
    });

    child.on("error", (err: Error) => {
      resolve({
        ok: false,
        error: `Failed to spawn yt-dlp: ${err.message}`,
      });
    });
  });
}

/**
 * Download result type
 */
export interface DownloadResult {
  success: boolean;
  error?: string;
  fileName?: string;
  fileSize?: number;
}

export default {
  buildYtDlpArgs,
  fetchVideoInfo,
  streamDownload,
  sanitizeFilename,
  isSupportedUrl,
  isTikTokUrl,
  getAvailableFormats,
  checkYtDlpHealth,
};
