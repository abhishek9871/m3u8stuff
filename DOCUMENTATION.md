# FlixNest - Complete Technical Documentation

> **⚠️ SINGLE SOURCE OF TRUTH**  
> This document is the authoritative reference for the FlixNest project.  
> Last Updated: **December 8, 2025**  
> Status: **✅ PRODUCTION - FULLY WORKING**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Production Architecture](#2-production-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [The Core Problem & Solution](#5-the-core-problem--solution)
6. [Backend Scraper (Hugging Face Spaces)](#6-backend-scraper-hugging-face-spaces)
7. [Frontend Integration](#7-frontend-integration)
8. [Critical Fixes Applied](#8-critical-fixes-applied)
9. [Deployment Guide](#9-deployment-guide)
10. [API Reference](#10-api-reference)
11. [Failed Approaches (What NOT to Do)](#11-failed-approaches-what-not-to-do)
12. [Troubleshooting Guide](#12-troubleshooting-guide)
13. [Environment Variables](#13-environment-variables)
14. [Local Development](#14-local-development)
15. [Design System](#15-design-system)

---

## 1. Executive Summary

### What is FlixNest?

**FlixNest** is a modern streaming web application that provides:
- Movie and TV show browsing via TMDB API
- **Native HLS video playback** with quality selection (360p, 720p, 1080p)
- Watchlist and episode tracking
- Ad-free viewing experience

### Production URLs

| Component | URL | Purpose |
|-----------|-----|---------|
| **Frontend** | `https://flixnest.pages.dev` | React app on Cloudflare Pages |
| **Backend** | `https://abhishek1996-flixnest-scraper.hf.space` | Puppeteer scraper on Hugging Face Spaces |

### What Actually Works (Verified December 8, 2025)

✅ **M3U8 Extraction** - Backend extracts streaming URLs from `vidsrc-embed.ru`  
✅ **HLS Playback** - hls.js plays video with 3 quality levels  
✅ **Proxy Chain** - All requests routed through backend to bypass CORS  
✅ **Referer Handling** - Correct referer (`cloudnestra.com`) passed for auth  
✅ **HTTPS Enforcement** - Proxy URLs use HTTPS to avoid Mixed Content errors  

---

## 2. Production Architecture

### System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER BROWSER                                   │
│                                                                             │
│   1. User visits https://flixnest.pages.dev                                 │
│   2. Clicks "Play" on a movie/TV show                                       │
│   3. Frontend calls backend extraction API                                  │
└─────────────────────────────────────────────────────────┬───────────────────┘
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE PAGES (Frontend)                              │
│                    https://flixnest.pages.dev                               │
│                                                                             │
│   React 18 + TypeScript + Vite + TailwindCSS                                │
│   ├── src/services/streamExtractor.ts  → Calls backend API                  │
│   ├── src/components/common/NativePlayer.tsx → hls.js video player          │
│   └── src/components/pages/MovieDetail/MovieDetail.tsx → Play button logic  │
└─────────────────────────────────────────────────────────┬───────────────────┘
                                                          │
                          GET /api/extract?tmdbId=X&type=movie
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HUGGING FACE SPACES (Backend)                            │
│                    https://abhishek1996-flixnest-scraper.hf.space           │
│                    Port: 7860                                               │
│                                                                             │
│   Node.js + Express + puppeteer-real-browser                                │
│   └── backend/scraper.js                                                    │
│       ├── GET /api/extract      → Launch Puppeteer, extract M3U8            │
│       ├── GET /api/proxy/m3u8   → Fetch & rewrite M3U8 playlists            │
│       ├── GET /api/proxy/segment→ Proxy .ts video segments                  │
│       └── GET /health           → Health check                              │
└─────────────────────────────────────────────────────────┬───────────────────┘
                                                          │
                          Puppeteer navigates to embed page
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VIDEO PROVIDER                                      │
│                         vidsrc-embed.ru                                     │
│                                                                             │
│   Embed URL: https://vidsrc-embed.ru/embed/movie/{tmdbId}                   │
│   Streams from: cloudnestra.com → thrumbleandjaxon.com                      │
│   M3U8 Format: HLS with 3 quality levels (360p, 720p, 1080p)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow for Video Playback

```
Step 1: User clicks Play
        ↓
Step 2: Frontend calls: GET https://abhishek1996-flixnest-scraper.hf.space/api/extract?tmdbId=701387&type=movie
        ↓
Step 3: Backend launches Puppeteer, navigates to vidsrc-embed.ru/embed/movie/701387
        ↓
Step 4: Backend intercepts network response containing M3U8 URL
        Returns: { success: true, m3u8Url: "https://tmstr4.thrumbleandjaxon.com/...", referer: "https://cloudnestra.com/" }
        ↓
Step 5: Frontend constructs proxied URL:
        https://abhishek1996-flixnest-scraper.hf.space/api/proxy/m3u8?url={encodedM3u8}&referer={encodedReferer}
        ↓
Step 6: hls.js loads the proxied M3U8, backend rewrites all URLs to go through proxy
        ↓
Step 7: Video plays with quality selection!
```

---

## 3. Tech Stack

### Frontend (Cloudflare Pages)

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI Framework |
| TypeScript | ~5.8.2 | Type Safety |
| Vite | ^6.2.0 | Build Tool & Dev Server |
| TailwindCSS | CDN | Styling |
| React Router DOM | 6.23.1 | Client-side Routing (HashRouter) |
| hls.js | ^1.5.7 | HLS Video Playback |
| Axios | 1.7.2 | HTTP Client |
| React Toastify | 10.0.5 | Toast Notifications |

### Backend (Hugging Face Spaces)

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| Express | ^4.18.2 | HTTP Server |
| puppeteer-real-browser | ^1.3.10 | Browser automation (bypasses Cloudflare) |
| Axios | ^1.6.2 | HTTP requests for proxying |
| CORS | ^2.8.5 | Cross-origin support |

### Why These Choices?

1. **puppeteer-real-browser over standard Puppeteer**  
   - Standard Puppeteer gets blocked by Cloudflare  
   - `puppeteer-real-browser` uses `turnstile: true` for auto-solving captchas  
   - Includes fingerprint evasion to appear as real browser

2. **Hugging Face Spaces over Cloudflare Workers**  
   - Workers have 10ms CPU limit (Puppeteer needs seconds)  
   - HF Spaces provides free Docker containers with full Node.js  
   - Supports Xvfb for headless browser rendering

3. **hls.js over native video**  
   - Works in Chrome, Firefox, Edge (native HLS only in Safari)  
   - Provides quality level switching API  
   - Better error recovery

---

## 4. Project Structure

```
FlixNest/
├── backend/                          # Backend scraper (deployed to HF Spaces)
│   └── scraper.js                    # Express server with Puppeteer extraction
│
├── src/                              # Frontend source (deployed to Cloudflare)
│   ├── components/
│   │   ├── common/
│   │   │   ├── NativePlayer.tsx      # ⭐ hls.js video player with quality selector
│   │   │   ├── NativePlayer.css      # Player styles
│   │   │   ├── ContentCard.tsx
│   │   │   ├── Loader.tsx
│   │   │   └── SkeletonCard.tsx
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   └── Header.tsx
│   │   └── pages/
│   │       ├── MovieDetail/
│   │       │   └── MovieDetail.tsx   # ⭐ Calls streamExtractor on Play click
│   │       ├── TVDetail/
│   │       │   └── TVDetail.tsx      # ⭐ Calls streamExtractor for TV episodes
│   │       ├── Home/
│   │       ├── Settings/
│   │       ├── SearchPage.tsx
│   │       └── WatchlistPage.tsx
│   │
│   ├── services/
│   │   ├── streamExtractor.ts        # ⭐ Calls backend /api/extract, builds proxy URL
│   │   ├── tmdb.ts                   # TMDB API client
│   │   └── vidsrc.ts                 # Legacy iframe URL builder
│   │
│   ├── types/
│   │   └── stream.ts                 # TypeScript interfaces for streams
│   │
│   ├── context/
│   │   ├── WatchlistContext.tsx
│   │   └── WatchedEpisodesContext.tsx
│   │
│   └── App.tsx
│
├── DOCUMENTATION.md                  # ⭐ THIS FILE - Single source of truth
├── package.json
├── vite.config.ts
└── wrangler.toml                     # Cloudflare Pages config
```

### Key Files Explained

| File | Purpose | Critical Code |
|------|---------|---------------|
| `backend/scraper.js` | Backend server | Lines 232: Force HTTPS in proxy URLs |
| `src/services/streamExtractor.ts` | Frontend extraction | Line 367: Build proxied M3U8 URL with referer |
| `src/components/common/NativePlayer.tsx` | Video player | hls.js initialization with quality selector |
| `src/components/pages/MovieDetail/MovieDetail.tsx` | Movie page | `handlePlayClick()` triggers extraction |

---

## 5. The Core Problem & Solution

### The Problem

**Goal:** Play videos natively in FlixNest with quality selection, instead of embedding third-party iframes full of ads.

**Challenge:** Video providers like `vidsrc-embed.ru` have multiple protections:

1. **CORS** - Browser blocks cross-origin requests to their APIs
2. **Origin Validation** - Server checks `Origin` header matches their domain
3. **Referer Validation** - M3U8 servers require correct `Referer` header
4. **Cloudflare Protection** - Bot detection blocks automated requests

### The Solution

**Run a real browser on the backend** that:
1. Navigates to the embed page like a real user
2. Intercepts the M3U8 URL from network responses
3. Captures the correct `Referer` header
4. Proxies all requests through our server with proper headers

### Why This Works

```
Frontend (Browser)                 Backend (Puppeteer)              Video Provider
       │                                   │                              │
       │ Can't call APIs directly          │ Real browser - no CORS       │
       │ (CORS blocks it)                  │ (first-party requests)       │
       │                                   │                              │
       │ GET /api/extract ─────────────────►│                              │
       │                                   │ goto(embed page) ────────────►│
       │                                   │                              │
       │                                   │◄─────── M3U8 URL in response │
       │                                   │         + Referer captured   │
       │◄─────────── { m3u8Url, referer } ─┤                              │
       │                                   │                              │
       │ hls.js loads proxied URL          │                              │
       │ GET /api/proxy/m3u8 ──────────────►│ fetch(m3u8, {Referer}) ─────►│
       │                                   │◄─────────── M3U8 content ────│
       │◄─────────── Rewritten M3U8 ───────┤                              │
       │                                   │                              │
       │ GET /api/proxy/segment ───────────►│ fetch(segment, {Referer}) ──►│
       │                                   │◄─────────── Video data ──────│
       │◄─────────── Video stream ─────────┤                              │
       │                                   │                              │
     VIDEO PLAYS! 🎬
```

---

## 6. Backend Scraper (Hugging Face Spaces)

### File: `backend/scraper.js`

**Total Lines:** 328  
**Deployed To:** `https://abhishek1996-flixnest-scraper.hf.space`  
**Port:** 7860

### Provider Configuration

```javascript
const PROVIDERS = [
    {
        name: 'vidsrc-embed.ru',
        getUrl: (id, type, s, e) => type === 'movie'
            ? `https://vidsrc-embed.ru/embed/movie/${id}`
            : `https://vidsrc-embed.ru/embed/tv/${id}/${s}/${e}`
    },
    {
        name: 'vidsrc.cc',
        getUrl: (id, type, s, e) => type === 'movie'
            ? `https://vidsrc.cc/v2/embed/movie/${id}`
            : `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`
    }
];
```

> **Note:** `vidsrc-embed.ru` is the PRIMARY provider. `vidsrc.cc` is a fallback.

### Browser Session Management

```javascript
let browserInstance = null;
let pageInstance = null;

async function getBrowser() {
    if (browserInstance && pageInstance && !pageInstance.isClosed()) {
        return { browser: browserInstance, page: pageInstance };
    }

    const { browser, page } = await connect({
        headless: false,     // Required for Xvfb
        turnstile: true,     // Auto-solve Cloudflare captchas
        fingerprint: true,   // Evade bot detection
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,720',
            '--disable-dev-shm-usage'
        ]
    });

    browserInstance = browser;
    pageInstance = page;
    
    await page.setRequestInterception(true);
    page.on('request', req => req.continue());

    return { browser, page };
}
```

### Extraction Logic

```javascript
app.get('/api/extract', async (req, res) => {
    const { tmdbId, season, episode, type } = req.query;
    
    let foundMedia = null;
    let capturedReferer = null;

    // Network interception - capture M3U8 URL
    const responseHandler = (response) => {
        const url = response.url();
        if ((url.includes('.m3u8') || url.includes('.mp4')) && !url.includes('sk-')) {
            foundMedia = url;
            capturedReferer = response.request().headers()['referer'] || page.url();
        }
    };
    page.on('response', responseHandler);

    // Try each provider
    for (const provider of PROVIDERS) {
        const targetUrl = provider.getUrl(tmdbId, type, season, episode);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await handlePageInteraction(page, provider.name);
        
        // Wait up to 15 seconds for M3U8
        let attempts = 0;
        while (!foundMedia && attempts < 15) {
            await new Promise(r => setTimeout(r, 1000));
            attempts++;
        }
        
        if (foundMedia) break;
    }

    // Return result with referer
    res.json({
        success: true,
        m3u8Url: foundMedia,
        provider: usedProvider,
        referer: capturedReferer  // ⭐ CRITICAL: Frontend needs this for proxy
    });
});
```

### M3U8 Proxy with URL Rewriting

```javascript
app.get('/api/proxy/m3u8', async (req, res) => {
    const { url, referer } = req.query;
    const decodedUrl = decodeURIComponent(url);
    const decodedReferer = referer ? decodeURIComponent(referer) : 'https://vidsrc-embed.ru/';

    // Fetch M3U8 with correct headers
    const response = await axios({
        method: 'get',
        url: decodedUrl,
        headers: {
            'User-Agent': 'Mozilla/5.0...',
            'Referer': decodedReferer,           // ⭐ CRITICAL
            'Origin': new URL(decodedReferer).origin
        }
    });

    // ⭐ CRITICAL FIX: Force HTTPS (HF Spaces reports 'http' internally)
    const proxyBase = `https://${req.get('host')}`;

    // Rewrite all URLs in M3U8 to go through our proxy
    const rewrittenLines = lines.map(line => {
        if (line.includes('.m3u8')) {
            return `${proxyBase}/api/proxy/m3u8?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(decodedReferer)}`;
        } else {
            return `${proxyBase}/api/proxy/segment?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(decodedReferer)}`;
        }
    });

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(rewrittenContent);
});
```

### Segment Proxy (Binary Passthrough)

```javascript
app.get('/api/proxy/segment', async (req, res) => {
    const { url, referer } = req.query;
    
    const response = await axios({
        method: 'get',
        url: decodeURIComponent(url),
        responseType: 'stream',
        headers: {
            'Referer': decodeURIComponent(referer),
            'Origin': new URL(decodeURIComponent(referer)).origin
        }
    });

    response.data.pipe(res);
});
```

---

## 7. Frontend Integration

### Stream Extractor Service

**File:** `src/services/streamExtractor.ts`

```typescript
const SCRAPER_CONFIG = {
  get url(): string {
    return 'https://abhishek1996-flixnest-scraper.hf.space/api/extract';
  },
  timeout: 45000,
};

async tryBackendScraper(request: StreamExtractionRequest): Promise<StreamExtractionResult> {
    const params = new URLSearchParams({ tmdbId, type });
    if (type === 'tv') {
        params.set('season', String(season));
        params.set('episode', String(episode));
    }

    const response = await fetch(`${SCRAPER_CONFIG.url}?${params}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
    });

    const data = await response.json();
    
    // ⭐ Build proxied URL with referer parameter
    const scraperBaseUrl = SCRAPER_CONFIG.url.replace('/api/extract', '');
    const refererParam = data.referer ? `&referer=${encodeURIComponent(data.referer)}` : '';
    const proxiedM3u8Url = `${scraperBaseUrl}/api/proxy/m3u8?url=${encodeURIComponent(data.m3u8Url)}${refererParam}`;

    return {
        success: true,
        extractedStream: {
            m3u8Url: proxiedM3u8Url,
            subtitles: data.subtitles || [],
            provider: 'vidsrc',
        },
    };
}
```

### NativePlayer Component

**File:** `src/components/common/NativePlayer.tsx`

```typescript
import Hls from 'hls.js';

const NativePlayer: React.FC<Props> = ({ extractedStream, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [quality, setQuality] = useState<string>('Auto');

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !extractedStream.m3u8Url) return;

        // Prefer hls.js (works in Chrome, Firefox, Edge)
        if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
            });
            hlsRef.current = hls;
            hls.loadSource(extractedStream.m3u8Url);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                // Quality levels available: e.g., [360p, 720p, 1080p]
                console.log('[NativePlayer] Quality levels:', data.levels.length);
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    hls.destroy();
                }
            });
        }
        // Safari fallback (native HLS)
        else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = extractedStream.m3u8Url;
        }

        return () => hlsRef.current?.destroy();
    }, [extractedStream.m3u8Url]);

    return (
        <div className="native-player">
            <video ref={videoRef} controls autoPlay />
            <QualitySelector quality={quality} onChange={setQuality} />
        </div>
    );
};
```

### MovieDetail Integration

**File:** `src/components/pages/MovieDetail/MovieDetail.tsx`

```typescript
const handlePlayClick = async () => {
    setIsPlaying(true);
    setExtracting(true);

    const result = await streamExtractor.extract({
        type: 'movie',
        tmdbId: movie.id.toString(),
    });

    setExtracting(false);

    if (result.success && result.extractedStream) {
        setExtractedStream(result.extractedStream);
        setUseFallbackIframe(false);
    } else {
        // Fallback to iframe if extraction fails
        setUseFallbackIframe(true);
    }
};

// In render:
{isPlaying && extractedStream && !useFallbackIframe && (
    <NativePlayer
        extractedStream={extractedStream}
        onClose={() => setIsPlaying(false)}
    />
)}
```

---

## 8. Critical Fixes Applied

### Fix 1: HTTPS Enforcement (Mixed Content Error)

**Problem:** Browser blocked video because proxy returned `http://` URLs while frontend is on `https://`.

**Root Cause:** Hugging Face Spaces runs behind a reverse proxy. Express's `req.protocol` returns `http` (internal) even though public access is via HTTPS.

**Fix Location:** `backend/scraper.js`, Line 232

```javascript
// ❌ BEFORE (broken):
const proxyBase = `${req.protocol}://${req.get('host')}`;

// ✅ AFTER (working):
const proxyBase = `https://${req.get('host')}`;
```

### Fix 2: Referer Capture & Passthrough

**Problem:** M3U8 server returned 403 Forbidden because referer was wrong.

**Root Cause:** The M3U8 server (`thrumbleandjaxon.com`) validates that requests come from `cloudnestra.com`, not directly.

**Fix:** Capture referer during extraction, pass through entire proxy chain.

```javascript
// backend/scraper.js - Capture during extraction
const responseHandler = (response) => {
    if (url.includes('.m3u8')) {
        capturedReferer = response.request().headers()['referer'] || page.url();
    }
};

// Return referer to frontend
res.json({ m3u8Url, referer: capturedReferer });

// Proxy uses referer
const response = await axios({
    url: decodedUrl,
    headers: { 'Referer': decodedReferer }
});
```

### Fix 3: URL Rewriting in M3U8

**Problem:** hls.js got 404 errors because M3U8 contained relative URLs that couldn't be resolved.

**Fix:** Backend rewrites ALL URLs (segments, playlists, keys) to absolute proxied URLs.

```javascript
// Rewrite relative URLs to absolute
const absoluteUrl = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseUrl).href;

// Route through proxy
return `${proxyBase}/api/proxy/segment?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer)}`;
```

### Fix 4: puppeteer-real-browser for Cloudflare Bypass

**Problem:** Standard Puppeteer got blocked by Cloudflare with "Just a moment..." page.

**Fix:** Use `puppeteer-real-browser` with turnstile and fingerprint evasion.

```javascript
import { connect } from 'puppeteer-real-browser';

const { browser, page } = await connect({
    headless: false,
    turnstile: true,      // Auto-solve Cloudflare
    fingerprint: true,    // Evade bot detection
});
```

---

## 9. Deployment Guide

### Frontend Deployment (Cloudflare Pages)

```bash
# Build the project
npm run build

# Deploy to production
npx wrangler pages deploy dist --project-name=flixnest --branch=production
```

**Production URL:** `https://flixnest.pages.dev`

### Backend Deployment (Hugging Face Spaces)

1. Create a new Space at `https://huggingface.co/spaces`
2. Choose **Docker** as the SDK
3. Upload the `backend/` folder
4. Create `Dockerfile`:

```dockerfile
FROM node:18-slim

# Install dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Start Xvfb and the app
CMD xvfb-run --auto-servernum --server-args="-screen 0 1280x720x24" node scraper.js
```

5. Push to the Space repository
6. Space auto-deploys and runs on port 7860

**Production URL:** `https://abhishek1996-flixnest-scraper.hf.space`

---

## 10. API Reference

### Backend Endpoints

#### `GET /api/extract`

Extract M3U8 URL from video provider.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| tmdbId | string | Yes | TMDB movie/show ID |
| type | string | Yes | `movie` or `tv` |
| season | number | TV only | Season number |
| episode | number | TV only | Episode number |

**Example:**
```bash
curl "https://abhishek1996-flixnest-scraper.hf.space/api/extract?tmdbId=701387&type=movie"
```

**Response:**
```json
{
    "success": true,
    "m3u8Url": "https://tmstr4.thrumbleandjaxon.com/pl/H4sI.../master.m3u8",
    "provider": "vidsrc-embed.ru",
    "referer": "https://cloudnestra.com/"
}
```

#### `GET /api/proxy/m3u8`

Proxy and rewrite M3U8 playlist.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| url | string | Yes | URL-encoded M3U8 URL |
| referer | string | No | URL-encoded referer |

**Response:** Rewritten M3U8 content with proxied URLs.

#### `GET /api/proxy/segment`

Proxy video segment (.ts file).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| url | string | Yes | URL-encoded segment URL |
| referer | string | No | URL-encoded referer |

**Response:** Binary video data stream.

#### `GET /health`

Health check endpoint.

**Response:**
```json
{
    "status": "ok",
    "uptime": 3600.5
}
```

---

## 11. Failed Approaches (What NOT to Do)

### ❌ Approach 1: Direct API Calls from Frontend

**What we tried:** Call vidsrc.cc APIs directly from React  
**Why it failed:** CORS policy blocks all cross-origin requests  
**Error:** `Access-Control-Allow-Origin` header missing

### ❌ Approach 2: Cloudflare Worker Proxy

**What we tried:** Deploy a Cloudflare Worker as same-origin proxy  
**Why it failed:**
- Workers have 10ms CPU limit (can't run Puppeteer)
- Origin validation happens at application layer
- VRF tokens are browser-session bound

### ❌ Approach 3: VRF Algorithm Reverse Engineering

**What we tried:** Deobfuscate vidsrc.cc JavaScript to find VRF generation  
**Why it failed:**
- Algorithm is heavily obfuscated
- Changes frequently
- Not sustainable

### ❌ Approach 4: Standard Puppeteer

**What we tried:** Use standard Puppeteer package  
**Why it failed:** Cloudflare detected it as bot, showed captcha page forever

### ❌ Approach 5: Railway/Render Deployment

**What we tried:** Deploy to Railway and Render  
**Why it failed:**
- Railway: Free tier too limited
- Render: Cold starts killed the browser session

### ✅ What Actually Worked

**puppeteer-real-browser on Hugging Face Spaces** with:
- `turnstile: true` for Cloudflare bypass
- Xvfb for headless rendering
- Browser session reuse
- Full proxy chain with referer passthrough

---

## 12. Troubleshooting Guide

### Problem: Video shows "Mixed Content" error

**Cause:** Proxy returning `http://` URLs on HTTPS page  
**Fix:** Ensure `backend/scraper.js` line 232 uses:
```javascript
const proxyBase = `https://${req.get('host')}`;
```

### Problem: 403 Forbidden on M3U8 or segments

**Cause:** Wrong or missing referer header  
**Fix:** 
1. Check extraction returns `referer` field
2. Check frontend passes `&referer=` param to proxy
3. Check proxy uses referer in axios headers

### Problem: Cloudflare "Just a moment" page forever

**Cause:** Bot detection blocking Puppeteer  
**Fix:** Use `puppeteer-real-browser` with `turnstile: true`

### Problem: No M3U8 found (extraction timeout)

**Cause:** Provider changed structure or is blocking  
**Fix:**
1. Check provider is still working manually
2. Try switching provider order in `PROVIDERS` array
3. Add new provider if needed

### Problem: hls.js not loading video

**Cause:** M3U8 content has wrong URLs  
**Fix:** Check proxy rewrites ALL URLs (segments, keys, maps)

### Problem: Quality selector shows only "Auto"

**Cause:** hls.js not parsing quality levels  
**Fix:** Check `MANIFEST_PARSED` event fires with `data.levels`

---

## 13. Environment Variables

### Frontend (.env.local)

```bash
# TMDB API Key (required for movie/TV metadata)
VITE_TMDB_API_KEY=your_tmdb_api_key

# Backend scraper URL (optional, has default)
VITE_SCRAPER_URL=https://abhishek1996-flixnest-scraper.hf.space/api/extract
```

### Backend (Hugging Face Spaces)

No environment variables required. Port 7860 is used by default (HF Spaces standard).

---

## 14. Local Development

### Frontend

```bash
cd FlixNest
npm install
npm run dev
# Opens at http://localhost:5173
```

### Backend (requires Linux/WSL for Puppeteer)

```bash
cd FlixNest/backend
npm install
node scraper.js
# Runs at http://localhost:7860
```

For local testing, update `src/services/streamExtractor.ts`:
```typescript
return 'http://localhost:7860/api/extract';
```

---

## 15. Design System

### Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| bg-primary | `#0A0E14` | Main background |
| bg-secondary | `#141821` | Secondary background |
| surface | `#1A1F2E` | Card backgrounds |
| accent-primary | `#E50914` | Primary accent (Netflix red) |
| text-primary | `#FFFFFF` | Primary text |
| text-secondary | `#A0AEC0` | Secondary text |

### Typography

- **Body Font:** Inter
- **Heading Font:** Poppins

---

## Appendix A: Verification Commands

### Test Backend Health
```bash
curl https://abhishek1996-flixnest-scraper.hf.space/health
```

### Test Extraction
```bash
curl "https://abhishek1996-flixnest-scraper.hf.space/api/extract?tmdbId=701387&type=movie"
```

### Test M3U8 Proxy (use URL from extraction response)
```bash
curl "https://abhishek1996-flixnest-scraper.hf.space/api/proxy/m3u8?url=<encoded_m3u8_url>&referer=<encoded_referer>"
```

---

## Appendix B: Full Working Request Chain

Here's a complete example of the request chain for playing "Bugonia" (TMDB ID: 701387):

```bash
# Step 1: Extract M3U8 URL
curl "https://abhishek1996-flixnest-scraper.hf.space/api/extract?tmdbId=701387&type=movie"
# Response:
# {
#   "success": true,
#   "m3u8Url": "https://tmstr4.thrumbleandjaxon.com/pl/H4sI.../master.m3u8",
#   "provider": "vidsrc-embed.ru",
#   "referer": "https://cloudnestra.com/"
# }

# Step 2: Frontend constructs proxied URL (this is what hls.js loads):
# https://abhishek1996-flixnest-scraper.hf.space/api/proxy/m3u8?url=https%3A%2F%2Ftmstr4...&referer=https%3A%2F%2Fcloudnestra.com%2F

# Step 3: Proxy returns rewritten M3U8:
# #EXTM3U
# #EXT-X-STREAM-INF:BANDWIDTH=746951,RESOLUTION=540x360
# https://abhishek1996-flixnest-scraper.hf.space/api/proxy/m3u8?url=...360p/index.m3u8&referer=...
# #EXT-X-STREAM-INF:BANDWIDTH=2694514,RESOLUTION=1080x720
# https://abhishek1996-flixnest-scraper.hf.space/api/proxy/m3u8?url=...720p/index.m3u8&referer=...
# #EXT-X-STREAM-INF:BANDWIDTH=5251003,RESOLUTION=1620x1080
# https://abhishek1996-flixnest-scraper.hf.space/api/proxy/m3u8?url=...1080p/index.m3u8&referer=...

# Step 4: hls.js loads quality-specific playlist, segments stream through /api/proxy/segment
# Video plays!
```

---

## Document History

| Date | Version | Changes |
|------|---------|---------|
| Dec 8, 2025 | 2.0 | Complete rewrite with working production solution, HTTPS fix, referer handling |
| Dec 6, 2025 | 1.0 | Initial documentation |

---

**End of Documentation**

> 🎬 **For any future AI agent:** This documentation represents the WORKING state of FlixNest as of December 8, 2025. The key breakthroughs were: (1) Using `puppeteer-real-browser` instead of standard Puppeteer for Cloudflare bypass, (2) Deploying to Hugging Face Spaces which allows long-running browser processes, (3) Capturing and passing the correct `referer` header through the entire proxy chain, and (4) Forcing HTTPS in proxy URLs because HF Spaces runs behind a reverse proxy that reports `http` internally.
