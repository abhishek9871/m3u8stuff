import express from 'express';
import cors from 'cors';
import { connect } from 'puppeteer-real-browser';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 7860;

app.use(cors());
app.use(express.json());

// Providers List - Priority Order
// Updated to use official API parameters
const PROVIDERS = [
    {
        name: 'vidsrc-embed.ru',
        getUrl: (id, type, s, e) => type === 'movie'
            ? `https://vidsrc-embed.ru/embed/movie?tmdb=${id}` // Official API format
            : `https://vidsrc-embed.ru/embed/tv?tmdb=${id}&season=${s}&episode=${e}`
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

    console.log('[Browser] 🚀 Launching Real Browser (Stealth)...');
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

    // 🛡️ POPUP KILLER - Essential for vidsrc-embed
    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            try {
                const newPage = await target.page();
                // Close any new page that isn't the main extraction page
                if (newPage && newPage !== page) {
                    // console.log('[Browser] 🚨 Popup detected. Closing...');
                    await newPage.close();
                    if (page && !page.isClosed()) await page.bringToFront();
                }
            } catch (e) { }
        }
    });

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
        if ((url.includes('.m3u8') || url.includes('.mp4')) && !url.includes('sk-')) {

            const isMaster = url.includes('master.m3u8') || url.includes('playlist.m3u8');
            const isIndex = url.includes('index.m3u8'); // Often 720p/480p single quality
            const hasExisting = !!foundMedia;
            const existingIsMaster = hasExisting && (foundMedia.includes('master.m3u8') || foundMedia.includes('playlist.m3u8'));

            // LOGIC: Always upgrade to Master if we only have an Index/low-res
            // If we have nothing, take whatever we find first (as backup)
            if (!hasExisting || (isMaster && !existingIsMaster)) {
                console.log(`[Target] 🎯 Found Media (Master: ${isMaster}): ${url}`);
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
        }
    };
    page.on('response', responseHandler);

    // Loop through providers
    for (const provider of PROVIDERS) {
        // If we found a MASTER playlist, we are done. Stop strictly.
        if (foundMedia && (foundMedia.includes('master.m3u8') || foundMedia.includes('playlist.m3u8'))) break;

        // If we found ANY media, we might want to try one more provider just to be sure we can't find a master, purely for quality.
        // But for speed, let's say if we have a provider working, we stick with it unless we missed Master.

        const targetUrl = provider.getUrl(tmdbId, type, season, episode);
        console.log(`[Extract] Trying source: ${provider.name} -> ${targetUrl}`);

        try {
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

            // Interaction: Check/solve Cloudflare or Click Play
            await handlePageInteraction(page, provider.name);

            // Wait up to 60 seconds for M3U8 (Increased to handle cold starts/Cloudflare)
            let attempts = 0;
            const MAX_ATTEMPTS = 60;

            // Smart Selection: Wait loop
            while (attempts < MAX_ATTEMPTS) {
                if (foundMedia) {
                    // GOLD STANDARD: "master.m3u8"
                    if (foundMedia.includes('master.m3u8') || foundMedia.includes('playlist.m3u8')) {
                        console.log('[Extract] 🌟 Secured Master Playlist. Exiting wait.');
                        break;
                    }

                    // Lower Standard: found "index.m3u8" (usually 720p or specific quality)
                    // Wait up to 5 seconds to see if a Master playlist loads immediately after
                    let buffer = 0;
                    while (buffer < 5 && !foundMedia.includes('master.m3u8') && attempts < MAX_ATTEMPTS) {
                        await new Promise(r => setTimeout(r, 1000));
                        buffer++;
                        attempts++;
                    }
                    console.log('[Extract] ⚠️ Settling for available playlist (possibly non-Master).');
                    break;
                }

                await new Promise(r => setTimeout(r, 1000));
                attempts++;
            }

            if (foundMedia) {
                usedProvider = provider.name;
                // If we found *something*, we consider this provider a success. 
                // We only loop to next provider if foundMedia is STILL null.
                break;
            } else {
                console.log(`[Extract] ❌ No media found on ${provider.name} after ${attempts}s, trying next...`);
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
    // 1. Cloudflare Check (Aggressive)
    const title = await page.title();
    if (title.includes('Just a moment') || title.includes('Cloudflare') || title.includes('Attention')) {
        console.log('[Clicker] 🛡️ Cloudflare detected. Jiggling...');
        try {
            await page.mouse.move(100, 100);
            await page.mouse.move(200, 200);
            await page.mouse.click(200, 200); // Blind click

            // Look for IFRAMES (Turnstile)
            const frames = page.frames();
            for (const f of frames) {
                if (f.url().includes('turnstile') || f.url().includes('challenge')) {
                    const box = await f.boundingBox('body');
                    if (box) await page.mouse.click(box.x + 10, box.y + 10);
                }
            }
        } catch (e) { }
        await new Promise(r => setTimeout(r, 4000));
    }

    // 2. Play Button Click (Crucial for vidsrc)
    try {
        console.log('[Clicker] Looking for Play button...');
        // Expanded selectors for new API/Player skins
        const playSelectors = [
            '#player_code',
            '.play-btn',
            '#play-button',
            'div[class*="play"]',
            'button[class*="play"]',
            '.jw-display-icon-container', // JW Player common
            'video'
        ];

        for (const sel of playSelectors) {
            try {
                const el = await page.$(sel);
                if (el && await el.isVisible()) {
                    await el.click();
                    console.log(`[Clicker] Clicked ${sel}`);
                    await new Promise(r => setTimeout(r, 1000)); // Wait for reaction

                    // Sometimes a second click is needed (unmute/start)
                    await el.click().catch(() => { });
                }
            } catch (e) { }
        }

        // Center click backup - often works for overlays
        await page.mouse.click(640, 360);
    } catch (e) { }
}

// 🌐 PROXY ENDPOINT - Rewrites M3U8 URLs to route through proxy
app.get('/api/proxy/m3u8', async (req, res) => {
    const { url, referer } = req.query;
    if (!url) return res.status(400).send('No URL');

    const decodedUrl = decodeURIComponent(url);
    const decodedReferer = referer ? decodeURIComponent(referer) : null;

    // Log less to avoid spamming console
    // console.log('[Proxy] Fetching M3U8:', decodedUrl);

    try {
        const urlObj = new URL(decodedUrl);
        const baseUrl = decodedUrl.substring(0, decodedUrl.lastIndexOf('/') + 1);
        const effectiveReferer = decodedReferer || 'https://vidsrc-embed.ru/';

        const response = await axios({
            method: 'get',
            url: decodedUrl,
            responseType: 'text',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': effectiveReferer,
                'Origin': new URL(effectiveReferer).origin,
                'Accept': '*/*'
            }
        });

        let content = response.data;
        const proxyBase = `https://${req.get('host')}`;
        const refererParam = effectiveReferer ? `&referer=${encodeURIComponent(effectiveReferer)}` : '';

        const lines = content.split('\n');
        const rewrittenLines = lines.map(line => {
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith('#')) {
                if (trimmed.includes('URI="')) {
                    return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
                        const absoluteUri = uri.startsWith('http') ? uri : new URL(uri, baseUrl).href;
                        return `URI="${proxyBase}/api/proxy/segment?url=${encodeURIComponent(absoluteUri)}${refererParam}"`;
                    });
                }
                return line;
            }

            let absoluteUrl;
            if (trimmed.startsWith('http')) {
                absoluteUrl = trimmed;
            } else {
                absoluteUrl = new URL(trimmed, baseUrl).href;
            }

            if (absoluteUrl.includes('.m3u8') || absoluteUrl.includes('.M3U8')) {
                return `${proxyBase}/api/proxy/m3u8?url=${encodeURIComponent(absoluteUrl)}${refererParam}`;
            } else {
                return `${proxyBase}/api/proxy/segment?url=${encodeURIComponent(absoluteUrl)}${refererParam}`;
            }
        });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewrittenLines.join('\n'));

    } catch (e) {
        console.error('[Proxy] M3U8 Error:', e.message);
        res.status(500).send('Proxy Error');
    }
});

// 🎬 SEGMENT PROXY
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
                'Accept': '*/*'
            },
            timeout: 30000
        });

        if (response.headers['content-type']) res.setHeader('Content-Type', response.headers['content-type']);
        if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);
        res.setHeader('Access-Control-Allow-Origin', '*');

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
