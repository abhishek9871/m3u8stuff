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
        name: 'vidsrc.xyz',
        getUrl: (id, type, s, e) => type === 'movie'
            ? `https://vidsrc.xyz/embed/movie/${id}`
            : `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}`
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

    // Set up extraction listener for this request
    const responseHandler = (response) => {
        const url = response.url();
        if ((url.includes('.m3u8') || url.includes('.mp4')) && !url.includes('sk-') && !foundMedia) {
            console.log(`[Target] 🎯 Found Media: ${url}`);
            foundMedia = url;
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
        // Return a PROXY URL so the frontend isn't blocked by CORS
        // We encode the found URL and the referer (provider URL)
        const host = req.get('host');
        const protocol = req.protocol;
        // Construct proxy url
        const proxyUrl = `${protocol}://${host}/api/proxy?url=${encodeURIComponent(foundMedia)}`;

        console.log('[Extract] ✅ Success! Returning proxy URL.');
        res.json({
            success: true,
            url: proxyUrl,
            provider: usedProvider
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

// 🌐 PROXY ENDPOINT
app.get('/api/proxy', async (req, res) => {
    const { url, referer } = req.query;
    if (!url) return res.status(400).send('No URL');

    try {
        const response = await axios({
            method: 'get',
            url: decodeURIComponent(url),
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                // 'Referer': referer ? decodeURIComponent(referer) : 'https://vidsrc.xyz/'
            }
        });

        // Copy critical headers
        if (response.headers['content-type']) res.setHeader('Content-Type', response.headers['content-type']);
        if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);

        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');

        response.data.pipe(res);
    } catch (e) {
        console.error('[Proxy] Error:', e.message);
        res.status(500).send('Proxy Error');
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🎬 Multi-Source Scraper on ${PORT}`));
