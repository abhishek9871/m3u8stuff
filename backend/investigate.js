import { connect } from 'puppeteer-real-browser';
import fs from 'fs';
import axios from 'axios';

async function run() {
    console.log('[Investigate] Launching browser...');
    const { browser, page } = await connect({
        headless: false,
        turnstile: true,
        fingerprint: true,
        args: ['--no-sandbox', '--window-size=1280,720']
    });

    // 🛡️ POPUP KILLER
    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            try {
                const newPage = await target.page();
                if (newPage && newPage !== page) {
                    console.log('[Popup] 🚨 Detected new tab/popup. Closing it...');
                    await newPage.close();
                    console.log('[Popup] ⚔️ Popup eliminated. Refocusing main page.');
                    await page.bringToFront();
                }
            } catch (e) { }
        }
    });

    try {
        // Shared M3U8 Listener
        let m3u8Found = null;
        page.on('response', async resp => {
            const url = resp.url();
            if ((url.includes('.m3u8') || url.includes('.mp4')) && !url.includes('sk-')) {
                console.log(`[Network] 🎯 Found Media: ${url}`);
                if (url.includes('master') || url.includes('playlist')) {
                    m3u8Found = url;
                } else if (!m3u8Found) {
                    m3u8Found = url;
                }
            }
        });

        // ==========================================
        // TEST 1: KANTARA (Verify Playback Logic)
        // ==========================================
        console.log('\n[Investigate] 🕵️ Starting Test 1: Kantara (1083637)...');
        m3u8Found = null;
        await page.goto('https://vidsrc-embed.ru/embed/movie?tmdb=1083637', { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 5000));

        // Click Logic with Retry for Popups
        console.log('[Investigate] 🖱️ Attempting Clicks...');
        for (let i = 1; i <= 3; i++) {
            if (m3u8Found) break;
            console.log(`[Investigate] Click Attempt #${i} (Center)...`);
            try {
                await page.mouse.click(640, 360);
            } catch (e) { }

            // Wait to see if popup spawns or media loads
            await new Promise(r => setTimeout(r, 3000));
        }

        if (m3u8Found) {
            console.log('[Result] ✅ Kantara M3U8 Found:', m3u8Found);
        } else {
            console.log('[Result] ❌ Kantara M3U8 NOT Found.');
            await page.screenshot({ path: 'kantara_failed.png' });
        }

        // ==========================================
        // TEST 2: TRON (Verify Quality)
        // ==========================================
        console.log('\n[Investigate] 🕵️ Starting Test 2: Tron (533533)...');
        m3u8Found = null;
        await page.goto('https://vidsrc-embed.ru/embed/movie?tmdb=533533', { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 5000));

        console.log('[Investigate] 🖱️ Attempting Clicks for Tron...');
        for (let i = 1; i <= 3; i++) {
            if (m3u8Found && m3u8Found.includes('master')) break;

            // Try specific play button if visible
            const playBtn = await page.$('.play-btn, #play-button, .jw-display-icon-container');
            if (playBtn) {
                console.log(`[Investigate] Click Attempt #${i} (Specific Button)...`);
                await playBtn.click().catch(() => { });
            } else {
                console.log(`[Investigate] Click Attempt #${i} (Center)...`);
                await page.mouse.click(640, 360);
            }
            await new Promise(r => setTimeout(r, 3000));
        }

        if (m3u8Found) {
            console.log('[Result] ✅ Tron M3U8 Found:', m3u8Found);
            console.log('[Investigate] Downloading Playlist Content...');
            try {
                const response = await axios.get(m3u8Found);
                console.log('\n----- M3U8 CONTENT -----');
                console.log(response.data);
                console.log('------------------------\n');
            } catch (e) {
                console.log('Failed to download M3U8:', e.message);
            }
        } else {
            console.log('[Result] ❌ Tron M3U8 NOT Found.');
        }

    } catch (e) {
        console.error('[Investigate] Error:', e);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

run();
