import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import type { ExtractedStream, SubtitleTrack } from '../../types/stream';
import './NativePlayer.css';

interface NativePlayerProps {
  extracted: ExtractedStream;
  title?: string;
  poster?: string;
  autoplay?: boolean;
}

// Seek amount in seconds
const SEEK_SECONDS = 10;

// Helper to find best English subtitle
const findEnglishSubtitle = (subtitles: SubtitleTrack[]): SubtitleTrack | null => {
  if (!subtitles || subtitles.length === 0) return null;

  // Priority order for English subtitles
  const englishPatterns = [
    /^english$/i,
    /^english\s*\(cc\)$/i,
    /^english\s*-\s*cc$/i,
    /^eng$/i,
    /^en$/i,
    /english/i,
    /eng/i,
  ];

  for (const pattern of englishPatterns) {
    const match = subtitles.find(sub => pattern.test(sub.label));
    if (match) return match;
  }

  // If no English found, check for default
  const defaultSub = subtitles.find(sub => sub.default);
  if (defaultSub) return defaultSub;

  return null;
};

export const NativePlayer: React.FC<NativePlayerProps> = ({
  extracted,
  title = 'Video Player',
  poster,
  autoplay = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekOverlayRef = useRef<HTMLDivElement>(null);

  // Quality state
  const [quality, setQuality] = useState<number>(-1);
  const [qualities, setQualities] = useState<Array<{ index: number; height: number; label: string }>>([]);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Subtitle state
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [subtitlesReady, setSubtitlesReady] = useState(false);

  // Player state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Seek indicator state
  const [seekIndicator, setSeekIndicator] = useState<{
    show: boolean;
    direction: 'forward' | 'backward';
    position: { x: number; y: number };
  }>({ show: false, direction: 'forward', position: { x: 0, y: 0 } });

  // Click tracking for double/triple click detection
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastClickPositionRef = useRef<{ x: number; isRightHalf: boolean } | null>(null);

  // Get current quality label
  const currentQualityLabel = quality === -1
    ? 'Auto'
    : qualities.find(q => q.index === quality)?.label || 'Auto';

  // Get active subtitle label
  const activeSubtitleLabel = activeSubtitle
    ? extracted.subtitles?.find(s => s.file === activeSubtitle)?.label || 'On'
    : 'Off';

  // Handle subtitle selection
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

  // Seek video forward or backward
  const seekVideo = useCallback((direction: 'forward' | 'backward', clickX: number, clickY: number) => {
    const video = videoRef.current;
    if (!video || video.readyState < 1) return;

    const seekAmount = direction === 'forward' ? SEEK_SECONDS : -SEEK_SECONDS;
    const newTime = Math.max(0, Math.min(video.duration, video.currentTime + seekAmount));
    video.currentTime = newTime;

    // Show seek indicator
    setSeekIndicator({
      show: true,
      direction,
      position: { x: clickX, y: clickY }
    });

    // Hide indicator after animation
    setTimeout(() => {
      setSeekIndicator(prev => ({ ...prev, show: false }));
    }, 600);

    console.log(`[NativePlayer] Seeked ${direction}: ${newTime.toFixed(1)}s`);
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.error('Exit fullscreen error:', err));
    } else {
      container.requestFullscreen().catch(err => console.error('Fullscreen error:', err));
    }
  }, []);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(err => console.error('Play error:', err));
    } else {
      video.pause();
    }
  }, []);

  // Handle click on seek overlay (single = play/pause, double = seek, triple = fullscreen)
  const handleSeekAreaClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore if clicking on controls
    const target = e.target as HTMLElement;
    if (target.closest('.native-player__controls') ||
      target.closest('.native-player__control-group')) {
      return;
    }

    const overlay = seekOverlayRef.current;
    if (!overlay) return;

    const rect = overlay.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const isRightHalf = clickX > rect.width / 2;

    // Store click position for later use
    lastClickPositionRef.current = { x: clickX, isRightHalf };

    // Increment click count
    clickCountRef.current += 1;
    const currentClickCount = clickCountRef.current;

    // Clear any existing timer
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    // Set timer to process clicks after delay
    clickTimerRef.current = setTimeout(() => {
      const lastPos = lastClickPositionRef.current;

      if (currentClickCount === 1) {
        // Single click: toggle play/pause
        togglePlayPause();
      } else if (currentClickCount === 2 && lastPos) {
        // Double-click: seek only (no play/pause)
        seekVideo(lastPos.isRightHalf ? 'forward' : 'backward', lastPos.x, clickY);
      } else if (currentClickCount >= 3) {
        // Triple-click: fullscreen only (no seek)
        toggleFullscreen();
      }

      // Reset
      clickCountRef.current = 0;
      lastClickPositionRef.current = null;
    }, 250); // Reduced delay for snappier response
  }, [seekVideo, toggleFullscreen, togglePlayPause]);

  // Cleanup click timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  // Initialize HLS and subtitles
  useEffect(() => {
    if (!videoRef.current || !extracted.m3u8Url) return;

    const video = videoRef.current;
    setLoading(true);
    setError(null);
    setSubtitlesReady(false);

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Remove existing track elements
    const existingTracks = video.querySelectorAll('track');
    existingTracks.forEach(track => track.remove());

    try {
      if (Hls.isSupported()) {
        console.log('[NativePlayer] Initializing hls.js');
        initHls(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('[NativePlayer] Using native Safari HLS');
        video.src = extracted.m3u8Url;
        video.play().catch(err => console.error('Play error:', err));
        setLoading(false);
        addSubtitleTracks(video);
      } else {
        setError('HLS streaming not supported in your browser');
        setLoading(false);
      }
    } catch (err) {
      console.error('[NativePlayer] Setup error:', err);
      setError(String(err));
      setLoading(false);
    }

    function initHls(video: HTMLVideoElement) {
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        maxLoadingDelay: 4,
        minAutoBitrate: 0,
      });

      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        console.log('[NativePlayer] Manifest parsed, levels:', data.levels.length);

        const qualityList = data.levels
          .map((level, index) => ({
            index,
            height: level.height || 0,
            label: level.height ? `${level.height}p` : `Level ${index}`
          }))
          .sort((a, b) => b.height - a.height); // Sort highest first

        setQualities(qualityList);

        // Force start at highest quality (index 0 after sort)
        if (qualityList.length > 0) {
          const bestQualityIndex = qualityList[0].index;
          console.log(`[NativePlayer] Force starting at highest quality: ${qualityList[0].label} (index ${bestQualityIndex})`);
          hls.startLevel = bestQualityIndex;
          hls.currentLevel = bestQualityIndex;
          setQuality(bestQualityIndex);
        } else {
          setQuality(-1);
        }

        setLoading(false);

        // Add subtitle tracks after manifest is ready
        addSubtitleTracks(video);

        if (autoplay) {
          video.play().catch(err => console.error('Play error:', err));
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('[NativePlayer] HLS Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError(`Playback error: ${data.type}`);
              hls.destroy();
              break;
          }
        }
      });

      hls.loadSource(extracted.m3u8Url);
      hlsRef.current = hls;
    }

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
        track.src = sub.file;
        track.default = false;
        video.appendChild(track);
      });

      // Wait a bit for tracks to load, then auto-select English
      setTimeout(() => {
        const englishSub = findEnglishSubtitle(extracted.subtitles!);
        if (englishSub) {
          console.log('[NativePlayer] Auto-selecting English subtitle:', englishSub.label);

          // Find the track index
          const trackIndex = extracted.subtitles!.findIndex(s => s.file === englishSub.file);
          if (trackIndex >= 0 && video.textTracks[trackIndex]) {
            video.textTracks[trackIndex].mode = 'showing';
            setActiveSubtitle(englishSub.file);
          }
        }
        setSubtitlesReady(true);
      }, 500);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [extracted.m3u8Url, autoplay, extracted.subtitles]);

  // Handle quality change
  useEffect(() => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = quality;
    console.log('[NativePlayer] Quality set to:', quality === -1 ? 'Auto' : qualities.find(q => q.index === quality)?.label);
  }, [quality, qualities]);

  // Hide menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowQualityMenu(false);
        setShowSubtitleMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-hide controls
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const container = containerRef.current;
    if (!container) return;

    const showControls = () => {
      setControlsVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setControlsVisible(false), 3000);
    };

    container.addEventListener('mousemove', showControls);
    container.addEventListener('mouseenter', showControls);

    return () => {
      container.removeEventListener('mousemove', showControls);
      container.removeEventListener('mouseenter', showControls);
      clearTimeout(timeout);
    };
  }, []);

  if (error) {
    return (
      <div className="native-player native-player--error">
        <div className="native-player__error-message">
          <span className="native-player__error-icon">!</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="native-player" ref={containerRef}>
      <div className="native-player__container">
        {loading && (
          <div className="native-player__loading">
            <div className="native-player__spinner"></div>
            <span>Loading stream...</span>
          </div>
        )}

        <video
          ref={videoRef}
          className="native-player__video"
          controls
          poster={poster}
          title={title}
          crossOrigin="anonymous"
          playsInline
        />

        {/* Seek Overlay - captures clicks for play/pause, double-click seek, triple-click fullscreen */}
        {!loading && (
          <div
            ref={seekOverlayRef}
            className="native-player__seek-overlay"
            onClick={handleSeekAreaClick}
          >
            {/* Left half zone (backward seek) */}
            <div className="native-player__seek-zone native-player__seek-zone--left" />
            {/* Right half zone (forward seek) */}
            <div className="native-player__seek-zone native-player__seek-zone--right" />
          </div>
        )}

        {/* Seek Indicator Animation */}
        {seekIndicator.show && (
          <div
            className={`native-player__seek-indicator native-player__seek-indicator--${seekIndicator.direction}`}
            style={{
              left: seekIndicator.direction === 'forward' ? 'auto' : '15%',
              right: seekIndicator.direction === 'forward' ? '15%' : 'auto',
            }}
          >
            <div className="native-player__seek-indicator-ripple"></div>
            <div className="native-player__seek-indicator-content">
              {seekIndicator.direction === 'forward' ? (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                    <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
                  </svg>
                  <span>{SEEK_SECONDS}s</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                    <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
                  </svg>
                  <span>{SEEK_SECONDS}s</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Custom Controls Overlay */}
        {!loading && (
          <div className={`native-player__controls ${controlsVisible ? 'visible' : ''}`}>
            {/* Quality Selector */}
            {qualities.length > 0 && (
              <div className="native-player__control-group">
                <button
                  className="native-player__control-btn"
                  onClick={() => {
                    setShowQualityMenu(!showQualityMenu);
                    setShowSubtitleMenu(false);
                  }}
                  title="Video Quality"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 12H9.5v-2h-2v2H6V9h1.5v2.5h2V9H11v6zm7-1c0 .55-.45 1-1 1h-.75v1.5h-1.5V15H14c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v4zm-3.5-.5h2v-3h-2v3z" />
                  </svg>
                  <span className="native-player__control-label">{currentQualityLabel}</span>
                </button>

                {showQualityMenu && (
                  <div className="native-player__menu">
                    <div className="native-player__menu-header">Quality</div>
                    <button
                      className={`native-player__menu-item ${quality === -1 ? 'active' : ''}`}
                      onClick={() => { setQuality(-1); setShowQualityMenu(false); }}
                    >
                      <span>Auto</span>
                      {quality === -1 && <span className="native-player__check">✓</span>}
                    </button>
                    {qualities.map(q => (
                      <button
                        key={q.index}
                        className={`native-player__menu-item ${quality === q.index ? 'active' : ''}`}
                        onClick={() => { setQuality(q.index); setShowQualityMenu(false); }}
                      >
                        <span>{q.label}</span>
                        {quality === q.index && <span className="native-player__check">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Subtitle Selector */}
            {extracted.subtitles && extracted.subtitles.length > 0 && subtitlesReady && (
              <div className="native-player__control-group">
                <button
                  className="native-player__control-btn"
                  onClick={() => {
                    setShowSubtitleMenu(!showSubtitleMenu);
                    setShowQualityMenu(false);
                  }}
                  title="Subtitles"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z" />
                  </svg>
                  <span className="native-player__control-label">{activeSubtitleLabel}</span>
                </button>

                {showSubtitleMenu && (
                  <div className="native-player__menu native-player__menu--subtitles">
                    <div className="native-player__menu-header">Subtitles</div>
                    <button
                      className={`native-player__menu-item ${!activeSubtitle ? 'active' : ''}`}
                      onClick={() => handleSubtitleChange(null)}
                    >
                      <span>Off</span>
                      {!activeSubtitle && <span className="native-player__check">✓</span>}
                    </button>
                    {extracted.subtitles.map((sub, index) => (
                      <button
                        key={index}
                        className={`native-player__menu-item ${activeSubtitle === sub.file ? 'active' : ''}`}
                        onClick={() => handleSubtitleChange(sub.file)}
                      >
                        <span>{sub.label}</span>
                        {activeSubtitle === sub.file && <span className="native-player__check">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NativePlayer;
