import express from 'express';
import cors from 'cors';
import { connect } from 'puppeteer-real-browser';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 7860;

app.use(cors());
app.use(express.json());

// Providers List - Priority Order
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

// Browser Session Helper
let browserInstance = null;
let pageInstance = null;

async function getBrowser() {
    if (browserInstance && pageInstance && !pageInstance.isClosed()) {
        return { browser: browserInstance, page: pageInstance };
    }

    console.log('[Browser] 🚀 Launching Real Browser (First Run)...');
    const { browser, page } = await connect({
        headless: false, // Required for Xvfb / Real Browser
        turnstile: true, // Auto-solve
        fingerprint: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,720',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    });

    browserInstance = browser;
    pageInstance = page;

    // Global Network Interceptor preparation
    await page.setRequestInterception(true);
    page.on('request', req => req.continue());

    return { browser, page };
}

app.get('/api/extract', async (req, res) => {
    const { tmdbId, season, episode, type } = req.query;

    if (!tmdbId || !type) {
        return res.status(400).json({ success: false, error: 'Missing params' });
    }

    const contentId = `${type}-${tmdbId}`;
    console.log(`[Extract] Starting for ${contentId}...`);

    let browser, page;
    try {
        ({ browser, page } = await getBrowser());
    } catch (e) {
        return res.status(500).json({ error: 'Browser launch failed: ' + e.message });
    }

    let foundMedia = null;
    let usedProvider = null;
    let capturedReferer = null;

    // Set up extraction listener for this request
    const responseHandler = (response) => {
        const url = response.url();
        if ((url.includes('.m3u8') || url.includes('.mp4')) && !url.includes('sk-') && !foundMedia) {
            console.log(`[Target] 🎯 Found Media: ${url}`);
            foundMedia = url;
            // Capture the referer from the request that triggered this response
            try {
                const request = response.request();
                capturedReferer = request.headers()['referer'] || page.url();
                console.log(`[Target] 📎 Captured Referer: ${capturedReferer}`);
            } catch (e) {
                capturedReferer = page.url();
            }
        }
    };
    page.on('response', responseHandler);

    // Loop through providers
    for (const provider of PROVIDERS) {
        if (foundMedia) break;

        const targetUrl = provider.getUrl(tmdbId, type, season, episode);
        console.log(`[Extract] Trying source: ${provider.name} -> ${targetUrl}`);

        try {
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

            // Interaction: Check/solve Cloudflare or Click Play
            await handlePageInteraction(page, provider.name);

            // Wait for media
            let attempts = 0;
            while (!foundMedia && attempts < 15) {
                await new Promise(r => setTimeout(r, 1000));
                attempts++;
            }

            if (foundMedia) {
                usedProvider = provider.name;
                break;
            } else {
                console.log(`[Extract] ❌ No media found on ${provider.name}, trying next...`);
            }
        } catch (e) {
            console.log(`[Extract] ⚠️ Error on ${provider.name}: ${e.message}`);
        }
    }

    // Cleanup listener
    page.off('response', responseHandler);

    if (foundMedia) {
        // Get the final page URL as fallback referer
        const pageReferer = capturedReferer || page.url();
        console.log('[Extract] ✅ Success! Returning RAW URL (Frontend will proxy).');
        console.log('[Extract] 📎 Referer for proxy:', pageReferer);
        res.json({
            success: true,
            m3u8Url: foundMedia,
            provider: usedProvider,
            referer: pageReferer
        });
    } else {
        const title = await page.title();
        console.log('[Extract] 💥 All providers failed. Last Title:', title);
        res.status(500).json({ success: false, error: 'Extraction failed on all sources', debug: title });
    }
});

async function handlePageInteraction(page, providerName) {
    // 1. Cloudflare Check
    const title = await page.title();
    if (title.includes('Just a moment') || title.includes('Cloudflare')) {
        console.log('[Clicker] 🛡️ Cloudflare detected. Jiggling...');
        try {
            await page.mouse.move(100, 100);
            await page.mouse.move(200, 200);
            await page.mouse.click(200, 200); // Blind click

            // Try searching for frames
            const frames = page.frames();
            for (const f of frames) {
                if (f.url().includes('turnstile')) {
                    const box = await f.boundingBox('body');
                    if (box) await page.mouse.click(box.x + 10, box.y + 10);
                }
            }
        } catch (e) { }
        await new Promise(r => setTimeout(r, 5000));
    }

    // 2. Play Button Click (Crucial for vidsrc.xyz)
    try {
        console.log('[Clicker] Looking for Play button...');
        // Common selectors for vidsrc players
        const playSelectors = ['#player_code', '.play-btn', '#play-button', 'div[class*="play"]', 'button'];
        for (const sel of playSelectors) {
            const el = await page.$(sel);
            if (el && await el.isVisible()) {
                await el.click();
                console.log(`[Clicker] Clicked ${sel}`);
                await new Promise(r => setTimeout(r, 500));
            }
        }
        // Center click backup
        await page.mouse.click(640, 360);
    } catch (e) { }
}

// 🌐 PROXY ENDPOINT - Rewrites M3U8 URLs to route through proxy
app.get('/api/proxy/m3u8', async (req, res) => {
    const { url, referer } = req.query;
    if (!url) return res.status(400).send('No URL');

    const decodedUrl = decodeURIComponent(url);
    const decodedReferer = referer ? decodeURIComponent(referer) : null;
    console.log('[Proxy] Fetching M3U8:', decodedUrl);
    console.log('[Proxy] Using Referer:', decodedReferer);

    try {
        // Determine base URL for resolving relative paths
        const urlObj = new URL(decodedUrl);
        const baseUrl = decodedUrl.substring(0, decodedUrl.lastIndexOf('/') + 1);

        // Use the captured referer from extraction, or fallback to embed URL
        const effectiveReferer = decodedReferer || 'https://vidsrc-embed.ru/';

        const response = await axios({
            method: 'get',
            url: decodedUrl,
            responseType: 'text', // Get as text to rewrite URLs
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': effectiveReferer,
                'Origin': new URL(effectiveReferer).origin,
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site'
            }
        });

        let content = response.data;
        // Force HTTPS - HF Spaces reverse proxy reports 'http' but frontend uses HTTPS
        const proxyBase = `https://${req.get('host')}`;

        // Rewrite URLs in M3U8 content, preserving the referer chain
        const refererParam = effectiveReferer ? `&referer=${encodeURIComponent(effectiveReferer)}` : '';
        const lines = content.split('\n');
        const rewrittenLines = lines.map(line => {
            const trimmed = line.trim();
            
            // Skip empty lines, comments, and tags (except URI= attributes)
            if (!trimmed || trimmed.startsWith('#')) {
                // Handle #EXT-X-KEY and #EXT-X-MAP with URI attributes
                if (trimmed.includes('URI="')) {
                    return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
                        const absoluteUri = uri.startsWith('http') ? uri : new URL(uri, baseUrl).href;
                        return `URI="${proxyBase}/api/proxy/segment?url=${encodeURIComponent(absoluteUri)}${refererParam}"`;
                    });
                }
                return line;
            }

            // This is a URL line (segment or playlist)
            let absoluteUrl;
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                absoluteUrl = trimmed;
            } else {
                // Resolve relative URL against base
                absoluteUrl = new URL(trimmed, baseUrl).href;
            }

            // Determine if it's a segment (.ts, .m4s) or another playlist (.m3u8)
            if (absoluteUrl.includes('.m3u8') || absoluteUrl.includes('.M3U8')) {
                return `${proxyBase}/api/proxy/m3u8?url=${encodeURIComponent(absoluteUrl)}${refererParam}`;
            } else {
                return `${proxyBase}/api/proxy/segment?url=${encodeURIComponent(absoluteUrl)}${refererParam}`;
            }
        });

        const rewrittenContent = rewrittenLines.join('\n');
        console.log('[Proxy] M3U8 rewritten, lines:', rewrittenLines.length);

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewrittenContent);

    } catch (e) {
        console.error('[Proxy] M3U8 Error:', e.message);
        res.status(500).send('Proxy Error: ' + e.message);
    }
});

// 🎬 SEGMENT PROXY - For .ts video segments
app.get('/api/proxy/segment', async (req, res) => {
    const { url, referer } = req.query;
    if (!url) return res.status(400).send('No URL');

    const decodedUrl = decodeURIComponent(url);
    const decodedReferer = referer ? decodeURIComponent(referer) : 'https://vidsrc-embed.ru/';

    try {
        const response = await axios({
            method: 'get',
            url: decodedUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': decodedReferer,
                'Origin': new URL(decodedReferer).origin,
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 30000
        });

        // Copy headers
        if (response.headers['content-type']) res.setHeader('Content-Type', response.headers['content-type']);
        if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);

        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

        response.data.pipe(res);
    } catch (e) {
        console.error('[Segment] Error:', e.message);
        res.status(500).send('Segment Proxy Error');
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🎬 Multi-Source Scraper on ${PORT}`));
