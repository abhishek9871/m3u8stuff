import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { ExtractedStream, SubtitleTrack } from '../../types/stream';
import './NativePlayer.css';

interface NativePlayerProps {
  extracted: ExtractedStream;
  title?: string;
  poster?: string;
  autoplay?: boolean;
}

// Helper to find best English subtitle
const findEnglishSubtitle = (subtitles: SubtitleTrack[]): SubtitleTrack | null => {
  if (!subtitles || subtitles.length === 0) return null;

  // 1. Try case-insensitive "English" or "English (CC)" or "en"
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

  // 2. If no explicit English, look for 'default' flag
  const defaultSub = subtitles.find(sub => sub.default);
  if (defaultSub) return defaultSub;

  return null;
};

export const NativePlayer: React.FC<NativePlayerProps> = ({
  extracted,
  title,
  poster,
  autoplay = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [qualities, setQualities] = useState<Array<{ index: number; height: number; label: string }>>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showQualitySelector, setShowQualitySelector] = useState(false);
  const [showSubtitleSelector, setShowSubtitleSelector] = useState(false);
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);
  const [subtitlesReady, setSubtitlesReady] = useState(false);

  useEffect(() => {
    if (!videoRef.current || !extracted.m3u8Url) return;

    const video = videoRef.current;

    // Cleanup previous HLS instance if any
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Identify if HLS is supported
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        // Extract qualities
        const qualityList = data.levels.map((level, index) => ({
          index,
          height: level.height || 0,
          label: level.height ? `${level.height}p` : `Level ${index}`
        }));

        // Sort specifically by height/quality desc
        const sortedQualities = qualityList.sort((a, b) => b.height - a.height);
        setQualities(sortedQualities);

        // Start at highest available quality or auto
        if (sortedQualities.length > 0) {
          hls.startLevel = sortedQualities[0].index;
          setCurrentQuality(sortedQualities[0].index);
        } else {
          setCurrentQuality(-1);
        }

        // Add subtitles once manifest is parsed (if they were not part of m3u8)
        // Note: For external VTTs, we add them separately via tracks
        addSubtitleTracks(video);

        if (autoplay) {
          video.play().catch(e => console.error("Autoplay failed", e));
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
      hls.loadSource(extracted.m3u8Url);

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = extracted.m3u8Url;
      video.addEventListener('loadedmetadata', () => {
        if (autoplay) video.play();
      });
      addSubtitleTracks(video);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [extracted.m3u8Url]);

  const addSubtitleTracks = (video: HTMLVideoElement) => {
    // Clear existing tracks first? usually React handles this but manipulating DOM directly needs care
    // Better to let React handle tracks if possible, but HLS often needs manual track management
    // We'll append tracks manually

    // Remove existing tracks added by us
    const existingTracks = video.querySelectorAll('track');
    existingTracks.forEach(t => t.remove());

    if (!extracted.subtitles || extracted.subtitles.length === 0) {
      setSubtitlesReady(true);
      return;
    }

    extracted.subtitles.forEach((sub, index) => {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = sub.label;
      track.srclang = sub.label.toLowerCase().substring(0, 2); // approximate lang code
      track.src = sub.file;
      track.default = false; // We set default manually
      video.appendChild(track);
    });

    // Auto-select English if available
    setTimeout(() => {
      const englishSub = findEnglishSubtitle(extracted.subtitles!);
      if (englishSub) {
        console.log('Auto-selecting subtitle:', englishSub.label);
        setActiveSubtitle(englishSub.file);

        // We need to enable the track in the video element's textTracks list
        for (let i = 0; i < video.textTracks.length; i++) {
          if (video.textTracks[i].label === englishSub.label) {
            video.textTracks[i].mode = 'showing';
          } else {
            video.textTracks[i].mode = 'disabled';
          }
        }
      }
      setSubtitlesReady(true);
    }, 500); // Small delay to ensuring tracks are parsed
  };

  const handleQualityChange = (qualityIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = qualityIndex;
      setCurrentQuality(qualityIndex);
      setShowQualitySelector(false);
    }
  };

  const handleSubtitleChange = (subtitleFile: string | null) => {
    const video = videoRef.current;
    if (!video) return;

    setActiveSubtitle(subtitleFile);

    // Convert VTT file URL match to track index
    if (!subtitleFile) {
      // Off
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'disabled';
      }
    } else {
      const targetSub = extracted.subtitles?.find(s => s.file === subtitleFile);
      if (targetSub) {
        for (let i = 0; i < video.textTracks.length; i++) {
          if (video.textTracks[i].label === targetSub.label) {
            video.textTracks[i].mode = 'showing';
          } else {
            video.textTracks[i].mode = 'disabled';
          }
        }
      }
    }
    setShowSubtitleSelector(false);
  };

  return (
    <div className="native-player-container group relative bg-black aspect-video w-full h-full">
      <video
        ref={videoRef}
        controls
        poster={poster}
        className="w-full h-full object-contain"
        crossOrigin="anonymous"
        playsInline
      >
        {/* Fallback for non-JS enabled environments */}
        <p>Your browser does not support the video tag.</p>
      </video>

      {/* Custom Overlay Controls (Quality & Subtitles) */}
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">

        {/* Subtitle Selector */}
        {extracted.subtitles && extracted.subtitles.length > 0 && (
          <div className="relative">
            <button
              onClick={() => {
                setShowSubtitleSelector(!showSubtitleSelector);
                setShowQualitySelector(false);
              }}
              className="bg-black/70 hover:bg-black/90 text-white px-3 py-1.5 rounded text-sm font-medium backdrop-blur-sm border border-white/10 flex items-center gap-1"
            >
              <span>CC</span>
              {activeSubtitle && <span className="w-2 h-2 rounded-full bg-primary ml-1"></span>}
            </button>

            {showSubtitleSelector && (
              <div className="absolute top-full right-0 mt-2 bg-black/90 border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[160px] max-h-64 overflow-y-auto z-30">
                <button
                  onClick={() => handleSubtitleChange(null)}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${!activeSubtitle ? 'text-primary font-bold' : 'text-white'}`}
                >
                  Off
                </button>
                {extracted.subtitles.map((sub, i) => (
                  <button
                    key={i}
                    onClick={() => handleSubtitleChange(sub.file)}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${activeSubtitle === sub.file ? 'text-primary font-bold' : 'text-white'}`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quality Selector */}
        {qualities.length > 0 && (
          <div className="relative">
            <button
              onClick={() => {
                setShowQualitySelector(!showQualitySelector);
                setShowSubtitleSelector(false);
              }}
              className="bg-black/70 hover:bg-black/90 text-white px-3 py-1.5 rounded text-sm font-medium backdrop-blur-sm border border-white/10"
            >
              Quality
            </button>

            {showQualitySelector && (
              <div className="absolute top-full right-0 mt-2 bg-black/90 border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[120px] z-30">
                <button
                  onClick={() => handleQualityChange(-1)}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${currentQuality === -1 ? 'text-primary font-bold' : 'text-white'}`}
                >
                  Auto
                </button>
                {qualities.map((q) => (
                  <button
                    key={q.index}
                    onClick={() => handleQualityChange(q.index)}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${currentQuality === q.index ? 'text-primary font-bold' : 'text-white'}`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NativePlayer;
