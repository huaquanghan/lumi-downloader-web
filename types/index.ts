/**
 * Video format information
 */
export interface VideoFormat {
  formatId: string;
  ext: string;
  quality: string;
  resolution: string;
  filesize?: number;
  audioCodec?: string;
  videoCodec?: string;
}

/**
 * Subtitle track information
 */
export interface SubtitleTrack {
  lang: string;
  name: string;
  url: string;
}

/**
 * Playlist item information
 */
export interface PlaylistItem {
  id: string;
  title: string;
  url: string;
  duration?: number;
}

/**
 * Video information returned by yt-dlp
 */
export interface VideoInfo {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
  formats: VideoFormat[];
  subtitles?: Record<string, SubtitleTrack[]>;
  isPlaylist: boolean;
  playlistItems?: PlaylistItem[];
}

/**
 * Download job status
 */
export type DownloadStatus = 'pending' | 'downloading' | 'processing' | 'completed' | 'error' | 'cancelled';

/**
 * Download job for queue management
 */
export interface DownloadJob {
  id: string;
  url: string;
  status: DownloadStatus;
  format: string;
  subtitles?: string[];
  tiktokNoWatermark?: boolean;
  filename?: string;
  progress: {
    percent: number;
    speed?: string;
    eta?: string;
  };
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Queue status overview
 */
export interface QueueStatus {
  current: DownloadJob | null;
  queue: DownloadJob[];
  size: number;
  maxSize: number;
}

/**
 * Options for downloading a video
 */
export interface DownloadOptions {
  url: string;
  format?: string;
  subtitles?: string[];
  tiktokNoWatermark?: boolean;
  filename?: string;
}

/**
 * Options for fetching video info
 */
export interface InfoOptions {
  url: string;
  playlist?: boolean;
}

/**
 * Request options for API calls
 */
export interface RequestOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}
