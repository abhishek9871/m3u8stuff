/**
 * TMDB Proxy Configuration
 * 
 * All TMDB requests are routed through our Cloudflare Worker proxy to bypass
 * ISP-level blocks in India (Jio/Airtel). The proxy handles both API calls
 * and image requests.
 * 
 * Proxy Routes:
 *   /api/*  -> api.themoviedb.org/3/*
 *   /img/*  -> image.tmdb.org/t/p/*
 */
export const TMDB_PROXY_URL = import.meta.env.VITE_TMDB_PROXY_URL || 'https://tmdb-proxy.sparshrajput088.workers.dev';

// Route API requests through proxy: /api/* -> api.themoviedb.org/3/*
export const TMDB_BASE_URL = `${TMDB_PROXY_URL}/api`;

// Route image requests through proxy: /img/* -> image.tmdb.org/t/p/*
export const TMDB_IMAGE_BASE_URL = `${TMDB_PROXY_URL}/img`;

// It is highly recommended to use an environment variable for the API key.
// The user request provided a sample key, which is used here as a fallback.
export const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '61d95006877f80fb61358dbb78f153c3';

export const VIDSRC_BASE_URL = 'https://vidsrc-embed.ru/embed';