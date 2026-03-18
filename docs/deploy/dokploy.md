# Deploy to Dokploy

This guide covers deploying the Lumi Downloader API to [Dokploy](https://dokploy.com/) - a self-hosted PaaS alternative to Vercel/Netlify.

## Prerequisites

- A Dokploy instance (self-hosted or managed)
- A server with Docker support
- (Optional) A Vercel frontend that will call this API

## Deployment Steps

### 1. Create New Application in Dokploy

1. Log in to your Dokploy dashboard
2. Click **"Create Service"** → **"Application"**
3. Configure:
   - **Name**: `lumi-downloader-api`
   - **Repository**: Your Git repository URL
   - **Branch**: `main` (or your deployment branch)

### 2. Build Configuration

Dokploy will automatically detect the `Dockerfile`. No additional build config needed.

The Dockerfile uses multi-stage build:
- **Builder stage**: Compiles Next.js with Node 20 + Python + yt-dlp
- **Runner stage**: Minimal image with only runtime dependencies

### 3. Environment Variables

Add these in Dokploy → Your App → **Environment** tab:

```bash
# Required
YTDLP_PATH=/usr/local/bin/yt-dlp

# Optional (defaults shown)
DOWNLOAD_TIMEOUT_MS=300000
NODE_ENV=production
```

| Variable | Description | Default |
|----------|-------------|---------|
| `YTDLP_PATH` | Path to yt-dlp binary | `/usr/local/bin/yt-dlp` |
| `DOWNLOAD_TIMEOUT_MS` | Download timeout in milliseconds | `300000` (5 min) |

### 4. Port Configuration

In Dokploy → Your App → **Settings**:

- **Port**: `3000`
- Dokploy will automatically expose this port via Traefik

### 5. Domain Configuration

In Dokploy → Your App → **Domains**:

1. Click **"Add Domain"**
2. Enter your domain: `api.yourdomain.com`
3. Enable HTTPS (Let's Encrypt)
4. Dokploy handles SSL automatically via Traefik

Example domains:
- `api.lumi-downloader.example.com`
- `lumi-api.yourdomain.com`

### 6. Deploy

1. Click **"Deploy"** in Dokploy
2. Monitor build logs
3. Wait for health check to pass

## API Endpoints

Once deployed, your API will be available at:

```
https://your-domain.com/api/info       # Get video metadata
https://your-domain.com/api/download   # Stream download
https://your-domain.com/api/queue      # Queue status
```

## Frontend Integration (Vercel)

If your frontend is hosted on Vercel, update your API calls:

```typescript
// .env.local (Vercel frontend)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

```typescript
// Example API call from Vercel frontend
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/info`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: videoUrl }),
});
```

### CORS Notes

The API allows cross-origin requests. If you need to restrict to your Vercel domain:

```typescript
// In your Next.js API routes, update CORS headers
const allowedOrigins = ['https://your-vercel-app.vercel.app'];
```

## Troubleshooting

### Build Failures

```bash
# Check if yt-dlp is installed correctly
docker exec <container-id> which yt-dlp
docker exec <container-id> yt-dlp --version
```

### Download Timeouts

Increase `DOWNLOAD_TIMEOUT_MS` for large files:
```bash
DOWNLOAD_TIMEOUT_MS=600000  # 10 minutes
```

### ffmpeg Issues

The Dockerfile installs ffmpeg. Verify:
```bash
docker exec <container-id> ffmpeg -version
```

### Storage Notes

This API **streams downloads directly to clients** - no persistent storage needed on the server. Each download request:
1. Fetches video info via yt-dlp
2. Streams bytes directly to response
3. No files saved on disk

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Vercel Frontend │────▶│  Dokploy API     │────▶│  YouTube/TikTok │
│  (Next.js)       │     │  (This Repo)     │     │  etc.           │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  yt-dlp +    │
                        │  ffmpeg      │
                        └──────────────┘
```

## Updates

To update yt-dlp to the latest version:

1. Dokploy will rebuild on every push
2. The Dockerfile runs `pip3 install yt-dlp` which always gets latest
3. Or trigger a manual redeploy in Dokploy

## Security Considerations

- Runs as non-root user (`nextjs`)
- No persistent volumes needed
- Downloads stream directly (no temp files)
- Health check endpoint available at `/api/health`
