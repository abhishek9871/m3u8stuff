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
9. [Subtitle System (Complete Implementation)](#9-subtitle-system-complete-implementation)
10. [Deployment Guide](#10-deployment-guide)
11. [API Reference](#11-api-reference)
12. [Failed Approaches (What NOT to Do)](#12-failed-approaches-what-not-to-do)
13. [Troubleshooting Guide](#13-troubleshooting-guide)
14. [Environment Variables](#14-environment-variables)
15. [Local Development](#15-local-development)
16. [Design System](#16-design-system)
17. [MoviePlayer Component - Desktop & Mobile Adaptations](#17-movieplayer-component---desktop--mobile-adaptations)

---

## 1. Executive Summary

### What is FlixNest?

**FlixNest** is a modern streaming web application that provides:
- Movie and TV show browsing via TMDB API
- **Native HLS video playback** with quality selection (360p, 720p, 1080p)
- **Subtitle support** for movies AND TV series (English, via OpenSubtitles API)
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
✅ **Subtitles (Movies)** - 10-15 English subtitles from OpenSubtitles API  
✅ **Subtitles (TV Series)** - Season/episode aware subtitle extraction  

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

## 9. Subtitle System (Complete Implementation)

> **Last Updated:** December 8, 2025  
> **Status:** ✅ FULLY WORKING for Movies and TV Series

### 9.1 Overview

FlixNest extracts and displays subtitles from OpenSubtitles directly within the native player. Subtitles are:
- Fetched in real-time from the OpenSubtitles API
- Converted from SRT to VTT format (required for HTML5 `<track>` elements)
- Embedded as base64 data URLs (no external proxy needed)
- Filterable by English language

### 9.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUBTITLE EXTRACTION FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   1. Scraper finds `prorcp` iframe in vidsrc-embed.ru                       │
│                        │                                                    │
│                        ▼                                                    │
│   2. Extract IMDB ID from `data-i` attribute on <body>                      │
│      For TV: also extract `data-s` (season), `data-e` (episode)             │
│                        │                                                    │
│                        ▼                                                    │
│   3. Call OpenSubtitles API (inside browser context):                       │
│      Movies: /search/imdbid-{id}/sublanguageid-eng                          │
│      TV:     /search/episode-{e}/imdbid-{id}/season-{s}/sublanguageid-eng   │
│                        │                                                    │
│                        ▼                                                    │
│   4. For each subtitle result:                                              │
│      a. Fetch .gz file from SubDownloadLink                                 │
│      b. Decompress using DecompressionStream API                            │
│      c. Convert SRT → VTT format                                            │
│      d. Encode as base64 data URL                                           │
│                        │                                                    │
│                        ▼                                                    │
│   5. Return subtitles array with embedded VTT content to frontend           │
│                        │                                                    │
│                        ▼                                                    │
│   6. Frontend adds <track> elements to video, enables by label              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Backend Implementation (`backend/scraper.js`)

#### 9.3.1 Finding the Player Frame

**Critical Discovery:** The `vidsrc-embed.ru` page contains multiple iframes. The correct frame for subtitle data is the `prorcp` frame (not `rcp`):

```javascript
// Line 157-164 in scraper.js
const extractSubtitlesViaAPI = async (page, reqSeason, reqEpisode) => {
    try {
        // CRITICAL: Prefer prorcp (player) over rcp frames
        // prorcp frame has correct data-i, data-s, data-e attributes
        let playerFrame = page.frames().find(f => f.url().includes('prorcp'));
        if (!playerFrame) {
            playerFrame = page.frames().find(f => f.url().includes('cloudnestra') || f.url().includes('hash='));
        }
        if (!playerFrame) return [];
```

**Why `prorcp`?** Investigation revealed multiple cloudnestra frames:
- Frame 1 (`rcp`): Has malformed IMDB ID like `4574334_1x1` ❌
- Frame 3 (`prorcp`): Has correct IMDB ID `4574334` + season/episode data ✅

#### 9.3.2 IMDB ID Extraction

**For Movies:** The IMDB ID is in `document.body.getAttribute('data-i')`

**For TV Series:** Additional attributes `data-s` (season) and `data-e` (episode)

```javascript
// Line 170-178 in scraper.js
let id = document.body.getAttribute('data-i');
if (!id) return [];

// Clean IMDB ID - remove any suffix like "_1x1"
id = id.split('_')[0];

// Use passed season/episode if available, otherwise try data attributes
const season = s || document.body.getAttribute('data-s');
const episode = e || document.body.getAttribute('data-e');
```

#### 9.3.3 OpenSubtitles API Call

```javascript
// Line 180-192 in scraper.js
let apiUrl;
if (season && episode) {
    // TV Series - include season and episode in URL
    apiUrl = `https://rest.opensubtitles.org/search/episode-${episode}/imdbid-${id}/season-${season}/sublanguageid-eng`;
    console.log('[Subtitles] TV Mode: S' + season + 'E' + episode);
} else {
    // Movie - just IMDB ID
    apiUrl = `https://rest.opensubtitles.org/search/imdbid-${id}/sublanguageid-eng`;
    console.log('[Subtitles] Movie Mode');
}

const response = await fetch(apiUrl, {
    headers: { 'X-User-Agent': 'trailers.to-UA' }  // REQUIRED header
});
```

**Key Points:**
- The `X-User-Agent: trailers.to-UA` header is **REQUIRED** by OpenSubtitles
- Without it, API returns 403 Forbidden
- This header was discovered by reverse-engineering `subtitles_pjs.js`

#### 9.3.4 Fetching & Decompressing Subtitles

OpenSubtitles returns `.gz` compressed files. They must be decompressed in the browser:

```javascript
// Line 199-224 in scraper.js
for (const sub of limitedData) {
    const subResponse = await fetch(sub.SubDownloadLink, {
        headers: { 'X-User-Agent': 'trailers.to-UA' }
    });

    if (subResponse.ok) {
        let text;
        
        // Handle gzip compressed files
        if (sub.SubDownloadLink.includes('.gz')) {
            // Use DecompressionStream to decompress gzip
            const ds = new DecompressionStream('gzip');
            const decompressedStream = subResponse.body.pipeThrough(ds);
            const reader = decompressedStream.getReader();
            const chunks = [];
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }
            
            // Combine chunks and decode as text
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const combined = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                combined.set(chunk, offset);
                offset += chunk.length;
            }
            text = new TextDecoder('utf-8').decode(combined);
        } else {
            text = await subResponse.text();
        }
```

**Why DecompressionStream?** 
- Browser's `fetch` doesn't auto-decompress `.gz` files
- Must manually decompress using Web Streams API
- This happens in browser context, not Node.js

#### 9.3.5 SRT to VTT Conversion

HTML5 `<track>` elements **only accept VTT format**. SRT must be converted:

```javascript
// Line 226-234 in scraper.js
// Convert SRT to VTT format (required for HTML5 <track> elements)
if (sub.SubFormat === 'srt' || sub.SubDownloadLink.includes('.srt') || !text.startsWith('WEBVTT')) {
    text = 'WEBVTT\n\n' + text
        // Convert SRT timestamps (00:00:00,000) to VTT format (00:00:00.000)
        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
        // Remove SRT numeric cue identifiers (lines with just a number)
        .replace(/^\d+\s*$/gm, '');
}
```

**Differences between SRT and VTT:**
| Feature | SRT | VTT |
|---------|-----|-----|
| Header | None | `WEBVTT` required |
| Timestamp separator | `,` | `.` |
| Cue identifiers | Required (numeric) | Optional |

#### 9.3.6 Base64 Data URL Encoding

To avoid CORS issues and 403 errors, subtitle content is embedded as data URLs:

```javascript
// Line 236-240 in scraper.js
// Create data URL with VTT MIME type
const base64 = btoa(unescape(encodeURIComponent(text)));
const dataUrl = 'data:text/vtt;base64,' + base64;

found.push({
    label: label,
    file: dataUrl  // No external URL, no proxy needed!
});
```

**Benefits of data URLs:**
- No CORS issues
- No 403 errors from OpenSubtitles
- Instant loading (content already embedded)
- No need for proxy endpoint

### 9.4 Frontend Implementation (`NativePlayer.tsx`)

#### 9.4.1 Adding Track Elements

```typescript
// Line 327-344 in NativePlayer.tsx
function addSubtitleTracks(video: HTMLVideoElement) {
    if (!extracted.subtitles || extracted.subtitles.length === 0) {
        setSubtitlesReady(true);
        return;
    }

    console.log('[NativePlayer] Adding', extracted.subtitles.length, 'subtitle tracks');

    // Add track elements for each subtitle
    extracted.subtitles.forEach((sub, index) => {
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = sub.label;
        track.srclang = sub.label.toLowerCase().substring(0, 2);
        track.src = sub.file;  // Data URL with embedded VTT
        track.default = false;
        video.appendChild(track);
    });
}
```

#### 9.4.2 Subtitle Selection (Fixed)

**Original Bug:** Selection used array index which could de-sync with video.textTracks

**Fix:** Match by label instead:

```typescript
// Line 92-119 in NativePlayer.tsx
const handleSubtitleChange = useCallback((subtitleFile: string | null) => {
    const video = videoRef.current;
    if (!video) return;

    // Disable all tracks first
    for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'disabled';
    }

    if (subtitleFile) {
        // Find the matching subtitle from our list
        const targetSub = extracted.subtitles?.find(s => s.file === subtitleFile);
        if (targetSub) {
            // Match track by label (more reliable than index)
            for (let i = 0; i < video.textTracks.length; i++) {
                if (video.textTracks[i].label === targetSub.label) {
                    video.textTracks[i].mode = 'showing';
                    console.log('[NativePlayer] Enabled subtitle by label:', targetSub.label);
                    break;
                }
            }
        }
    }

    setActiveSubtitle(subtitleFile);
    setShowSubtitleMenu(false);
}, [extracted.subtitles]);
```

### 9.5 Key Discoveries from Reverse Engineering

#### Discovery 1: The `subtitles_pjs.js` File

The player uses a JavaScript file at `https://cloudnestra.com/subtitles_pjs_24.04.js` that contains:
- OpenSubtitles API call logic
- The required `X-User-Agent` header
- SRT to VTT conversion (via pako.js decompression)

#### Discovery 2: Frame Structure

```
vidsrc-embed.ru
├── Frame 0: Main page (has data-i, data-s, data-e)
├── Frame 1: cloudnestra.com/rcp/... (WRONG: data-i has "_1x1" suffix)
├── Frame 2: about:blank
├── Frame 3: cloudnestra.com/prorcp/... (CORRECT: clean data-i + PlayerJS)
├── Frame 4: about:blank
└── Frame 5+: Ad/tracking frames
```

#### Discovery 3: PlayerJS Globals

The `prorcp` frame has these subtitle-related globals:
- `the_subtitles` - Array of loaded subtitle strings
- `db_subs` - Database of subtitles
- `getSubtitle(el)` - Function to load a subtitle
- `showSubtitles()` - Toggle subtitle menu
- `addSubtitle(sub)` - Add subtitle to player

### 9.6 Subtitle Limits

| Setting | Value | Reason |
|---------|-------|--------|
| Max subtitles | 15 | Avoid timeout during fetch |
| Language filter | English only | User requirement |
| Format filter | SRT, VTT | Other formats not supported |

### 9.7 Troubleshooting Subtitles

#### Problem: 0 subtitles for TV series

**Cause:** Wrong frame being used (has `_1x1` suffix on IMDB ID)  
**Fix:** Ensure code prefers `prorcp` frame over `rcp` frame

#### Problem: 403 Forbidden on subtitle download

**Cause:** Missing `X-User-Agent` header  
**Fix:** Add `headers: { 'X-User-Agent': 'trailers.to-UA' }` to fetch

#### Problem: Subtitles not displaying in player

**Cause:** SRT format not converted to VTT  
**Fix:** Ensure VTT header and timestamp conversion applied

#### Problem: Subtitle selection doesn't change track

**Cause:** Using array index instead of label matching  
**Fix:** Match by `video.textTracks[i].label === targetSub.label`

#### Problem: Garbled/binary subtitles

**Cause:** Gzip file not decompressed  
**Fix:** Use `DecompressionStream('gzip')` in browser context

### 9.8 Test Commands

```bash
# Test movie subtitle extraction (Tron: Ares)
curl "http://localhost:7860/api/extract?tmdbId=533533&type=movie" -o test.json
node -e "const d=JSON.parse(require('fs').readFileSync('test.json')); console.log('Subtitles:', d.subtitles?.length)"

# Test TV series subtitle extraction (Stranger Things S1E1)
curl "http://localhost:7860/api/extract?tmdbId=66732&type=tv&season=1&episode=1" -o test_tv.json
node -e "const d=JSON.parse(require('fs').readFileSync('test_tv.json')); console.log('Subtitles:', d.subtitles?.length)"
```

**Expected Results:**
- Movies: 10-15 subtitles
- TV Series: 5-15 subtitles (depends on availability)

---

## 10. Deployment Guide

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
| Dec 8, 2025 | 4.0 | MoviePlayer Desktop & Mobile Adaptations: Auto-hide controls, keyboard shortcuts, volume slider fix, touch gestures (volume, brightness, seek, zoom), pinch-to-zoom, responsive UI, menu gesture blocking |
| Dec 8, 2025 | 3.0 | Complete Subtitle System: OpenSubtitles API integration, TV series support, gzip decompression, SRT→VTT conversion, data URL embedding, label-based track selection |
| Dec 8, 2025 | 2.0 | Complete rewrite with working production solution, HTTPS fix, referer handling |
| Dec 6, 2025 | 1.0 | Initial documentation |

---

**End of Documentation**

> 🎬 **For any future AI agent:** This documentation represents the WORKING state of FlixNest as of December 8, 2025.  
>
> **Key Breakthroughs:**
> 1. Using `puppeteer-real-browser` instead of standard Puppeteer for Cloudflare bypass
> 2. Deploying to Hugging Face Spaces which allows long-running browser processes
> 3. Capturing and passing the correct `referer` header through the entire proxy chain
> 4. Forcing HTTPS in proxy URLs because HF Spaces runs behind a reverse proxy
> 5. **Subtitle System:** Finding the correct `prorcp` iframe (not `rcp`), using `X-User-Agent: trailers.to-UA` header for OpenSubtitles, decompressing .gz files with DecompressionStream, converting SRT→VTT, embedding as data URLs to bypass CORS/403 errors
>
> **Files to focus on for future changes:**
> - `backend/scraper.js`: Lines 155-260 for subtitle extraction (`extractSubtitlesViaAPI`)
> - `src/components/common/NativePlayer.tsx`: Lines 92-119 for subtitle selection (`handleSubtitleChange`)
>
> **Testing commands for subtitles:**
> ```bash
> # Movie test (Tron: Ares)
> curl "http://localhost:7860/api/extract?tmdbId=533533&type=movie"
> # TV test (Stranger Things S1E1)
> curl "http://localhost:7860/api/extract?tmdbId=66732&type=tv&season=1&episode=1"
> ```

---

## 17. MoviePlayer Component - Desktop & Mobile Adaptations

> **Last Updated:** December 8, 2025  
> **Status:** ✅ FULLY IMPLEMENTED  
> **File Location:** `src/components/common/MoviePlayer.tsx`

### 17.1 Overview

The `MoviePlayer.tsx` component is the core video player for FlixNest. It has been extensively enhanced to provide a premium viewing experience on both desktop and mobile devices. This section documents ALL the changes made for future AI agents who need to continue development.

### 17.2 Desktop Enhancements

#### 17.2.1 Control Visibility System

**What:** Controls auto-hide after 3 seconds of inactivity during playback.

**Implementation:**
```typescript
// State
const [showControls, setShowControls] = useState(true);
const hideControlsTimeoutRef = useRef<number | null>(null);
const HIDE_CONTROLS_DELAY = 3000;

// Timer Reset Function
const resetHideControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) {
        window.clearTimeout(hideControlsTimeoutRef.current);
    }
    // Only hide if playing AND no menus open
    if (isPlaying && !showSubtitleMenu && !showQualityMenu) {
        hideControlsTimeoutRef.current = window.setTimeout(() => {
            setShowControls(false);
        }, HIDE_CONTROLS_DELAY);
    }
}, [isPlaying, showSubtitleMenu, showQualityMenu]);

// Mouse move shows controls
onMouseMove={handleMouseMove}
```

**Key Points:**
- Controls stay visible when paused
- Controls stay visible when CC or Quality menu is open
- Cursor hides when controls are hidden

#### 17.2.2 Volume Slider Fix

**Problem:** Volume slider wasn't tracking cursor during drag.

**Fix:** Implemented proper drag handling with global mouse events:
```typescript
const handleVolumeMouseDown = (e: React.MouseEvent) => {
    setIsVolumeScrubbing(true);
    updateVolume(e);
};

useEffect(() => {
    if (isVolumeScrubbing) {
        window.addEventListener('mousemove', handleVolumeMouseMove);
        window.addEventListener('mouseup', handleVolumeMouseUp);
    }
    return () => { /* cleanup */ };
}, [isVolumeScrubbing]);
```

#### 17.2.3 Keyboard Controls

| Key | Action |
|-----|--------|
| `Space` / `K` | Play/Pause |
| `←` | Seek -10 seconds |
| `→` | Seek +10 seconds |
| `↑` | Volume +10% |
| `↓` | Volume -10% |
| `M` | Toggle Mute |
| `F` | Toggle Fullscreen |
| `Escape` | Exit Fullscreen/Close Player |

#### 17.2.4 Subtitle Menu Redesign

- Width: `w-80` (320px)
- Unselected items: White text
- Selected items: Green text (`text-green-400`)
- Labels: `whitespace-normal break-words` for full visibility

### 17.3 Mobile Adaptations

#### 17.3.1 Touch Gesture System

**File Location:** Lines 175-296 in `MoviePlayer.tsx`

##### Volume Control (Right Half)
- **Gesture:** Swipe up/down on RIGHT half of screen
- **Sensitivity:** 200px for full 0-100% range
- **Visual Indicator:** Volume bar + percentage on right side

##### Brightness Control (Left Half)
- **Gesture:** Swipe up/down on LEFT half of screen
- **Range:** 20% to 200% (CSS filter)
- **Implementation:** `style={{ filter: \`brightness(${brightness})\` }}`
- **Visual Indicator:** Brightness bar + percentage on left side

##### Seek Control (Double Tap)
- **Gesture:** Double-tap (within 300ms) on left/right half
- **Action:** Seek ±10 seconds
- **Detection:** `lastTapRef` tracks previous tap time and position

##### Zoom to Fill (Pinch Gesture)
- **Gesture:** Pinch in/out with two fingers
- **Implementation:** Toggle between `object-contain` and `object-cover`
- **State:** `isZoomToFill` boolean
- **Button:** Zoom button visible only on mobile (md:hidden)

**Touch Handler Implementation:**
```typescript
const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Detect pinch (2 fingers)
    if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
        return;
    }
    // Single touch - record start position
    touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
        initialVolume: volume,
        initialBrightness: brightness
    };
}, [volume, brightness]);
```

#### 17.3.2 Single Tap Behavior

**Critical UX Decision:** Single tap ONLY shows controls, does NOT toggle play/pause.

**Rationale:** Users expect first tap to reveal controls, not pause the video. Play/pause is handled via double-tap or control buttons.

```typescript
if (touchDuration < 300 && deltaX < 20 && deltaY < 20) {
    lastTapRef.current = { time: now, x: touch.clientX };
    resetHideControlsTimer(); // Only show controls, don't toggle play
}
```

#### 17.3.3 Mobile Control Visibility

| Element | Mobile | Desktop |
|---------|--------|---------|
| Play/Pause Button | Hidden | Visible |
| Seek ±10s Buttons | Hidden | Visible |
| Volume Button/Slider | Hidden | Visible |
| Time Display | Visible (smaller) | Visible |
| CC Button | Visible | Visible |
| Quality Button | Visible | Visible |
| Zoom Button | Visible | Hidden |
| Fullscreen Button | Visible | Visible |

**CSS Classes Used:**
```tsx
// Hide on mobile, show on desktop
className="hidden md:flex"

// Show on mobile, hide on desktop
className="md:hidden"
```

#### 17.3.4 Menu Touch Event Handling

**Problem:** Scrolling in CC/Quality menus triggered volume/brightness gestures.

**Fix:** Stop touch event propagation on menus:
```tsx
<div 
    className="absolute bottom-12 right-0 w-64 md:w-80 ..."
    onTouchStart={(e) => e.stopPropagation()}
    onTouchMove={(e) => e.stopPropagation()}
>
```

Also, gestures are disabled when menus are open:
```typescript
if (showSubtitleMenu || showQualityMenu) return;
```

#### 17.3.5 Close Button Styling

**Mobile:** `w-8 h-8` with glassmorphism
**Desktop:** `w-10 h-10`

```tsx
className="text-white hover:text-white/80 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-all backdrop-blur-md border border-white/20"
```

#### 17.3.6 Title Responsiveness

```tsx
className="text-white font-heading text-base sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] line-clamp-1 flex-1"
```

### 17.4 Gesture Indicator System

**State Type:**
```typescript
const [gestureIndicator, setGestureIndicator] = useState<{
    type: 'volume' | 'brightness' | 'seek-forward' | 'seek-backward' | 'zoom';
    value: number | string;
} | null>(null);
```

**Auto-hide:** 800ms timeout

**Visual Placement:**
- Volume/Seek Forward: Right side of screen
- Brightness/Seek Backward: Left side of screen
- Zoom: Center

### 17.5 State Declarations Order

**CRITICAL:** State declarations must be ordered correctly to avoid "used before declaration" errors.

```typescript
// These must be declared BEFORE resetHideControlsTimer
const [showQualityMenu, setShowQualityMenu] = useState(false);
const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);

// Then this can reference them
const resetHideControlsTimer = useCallback(() => {
    if (isPlaying && !showSubtitleMenu && !showQualityMenu) { ... }
}, [isPlaying, showSubtitleMenu, showQualityMenu]);
```

### 17.6 Files Modified

| File | Changes |
|------|---------|
| `src/components/common/MoviePlayer.tsx` | All player enhancements (800+ lines) |
| `src/components/pages/MovieDetail/MovieDetail.tsx` | Removed duplicate close button overlay |

### 17.7 Testing Checklist

**Desktop:**
- [ ] Controls auto-hide after 3s of inactivity
- [ ] Controls stay visible when paused
- [ ] Controls stay visible when menus open
- [ ] Volume slider tracks cursor during drag
- [ ] All keyboard shortcuts work
- [ ] Subtitle menu shows all labels

**Mobile:**
- [ ] Swipe up/down on right = Volume
- [ ] Swipe up/down on left = Brightness
- [ ] Double-tap right = Seek +10s
- [ ] Double-tap left = Seek -10s
- [ ] Single tap = Show controls only
- [ ] Pinch = Zoom toggle
- [ ] Zoom button works
- [ ] Menu scroll doesn't trigger gestures
- [ ] Close button looks good
- [ ] Title truncates properly

### 17.8 Known Limitations

1. **Brightness is CSS filter** - Doesn't affect system brightness, only video appearance
2. **Zoom is toggle only** - No intermediate zoom levels (YouTube style)
3. **No picture-in-picture** - Could be added in future

---

**End of Documentation**

> 🎬 **For any future AI agent:** This documentation represents the WORKING state of FlixNest as of December 8, 2025.  
>
> **Key Breakthroughs:**
> 1. Using `puppeteer-real-browser` instead of standard Puppeteer for Cloudflare bypass
> 2. Deploying to Hugging Face Spaces which allows long-running browser processes
> 3. Capturing and passing the correct `referer` header through the entire proxy chain
> 4. Forcing HTTPS in proxy URLs because HF Spaces runs behind a reverse proxy
> 5. **Subtitle System:** Finding the correct `prorcp` iframe (not `rcp`), using `X-User-Agent: trailers.to-UA` header for OpenSubtitles, decompressing .gz files with DecompressionStream, converting SRT→VTT, embedding as data URLs to bypass CORS/403 errors
> 6. **MoviePlayer Mobile Adaptation:** Touch gestures for volume (right half), brightness (left half), double-tap seeking, pinch-to-zoom. Single tap shows controls only. Menus block gesture propagation.
>
> **Files to focus on for future changes:**
> - `backend/scraper.js`: Lines 155-260 for subtitle extraction (`extractSubtitlesViaAPI`)
> - `src/components/common/MoviePlayer.tsx`: Full player with gestures, controls, menus
> - `src/components/pages/MovieDetail/MovieDetail.tsx`: Play button and player integration

