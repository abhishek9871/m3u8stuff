import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FaPlay, FaInfoCircle, FaStar, FaTv, FaFilm } from 'react-icons/fa';
import type { ContentItem } from '../../../types';
import { TMDB_IMAGE_BASE_URL } from '../../../utils/constants';
import Loader from '../../common/Loader';

interface HeroSectionProps {
  items: ContentItem[];
}

const HeroSection: React.FC<HeroSectionProps> = ({ items }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; time: number } | null>(null);
  const autoPlayRef = useRef<number | null>(null);

  // Reset auto-play timer
  const resetAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
    }
    if (items.length > 1) {
      autoPlayRef.current = window.setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
      }, 7000);
    }
  }, [items.length]);

  useEffect(() => {
    resetAutoPlay();
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [resetAutoPlay]);

  // Navigate to specific slide
  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
    resetAutoPlay();
  }, [resetAutoPlay]);

  // Navigate to next/prev slide
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
    resetAutoPlay();
  }, [items.length, resetAutoPlay]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    resetAutoPlay();
  }, [items.length, resetAutoPlay]);

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartRef.current = { x: e.touches[0].clientX, time: Date.now() };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!dragStartRef.current) return;

    const deltaX = e.changedTouches[0].clientX - dragStartRef.current.x;
    const deltaTime = Date.now() - dragStartRef.current.time;

    // Swipe threshold: at least 50px or fast swipe (velocity > 0.3px/ms)
    const velocity = Math.abs(deltaX) / deltaTime;
    if (Math.abs(deltaX) > 50 || velocity > 0.3) {
      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }

    dragStartRef.current = null;
  }, [goToNext, goToPrev]);

  // Mouse handlers for desktop drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Ignore if clicking on buttons or links
    if ((e.target as HTMLElement).closest('a, button')) return;

    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, time: Date.now() };
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
  }, [isDragging]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current) {
      setIsDragging(false);
      return;
    }

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaTime = Date.now() - dragStartRef.current.time;

    // Drag threshold
    const velocity = Math.abs(deltaX) / deltaTime;
    if (Math.abs(deltaX) > 50 || velocity > 0.3) {
      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }

    setIsDragging(false);
    dragStartRef.current = null;
  }, [isDragging, goToNext, goToPrev]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
    }
  }, [isDragging]);

  if (items.length === 0) {
    return <div className="h-screen bg-bg-secondary flex items-center justify-center"><Loader /></div>;
  }

  const activeItem = items[currentIndex];
  const title = 'title' in activeItem ? activeItem.title : activeItem.name;
  const mediaType = activeItem.media_type || ('title' in activeItem ? 'movie' : 'tv');
  const releaseDate = 'release_date' in activeItem ? activeItem.release_date : activeItem.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';

  return (
    <div
      className={`relative h-screen w-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
        >
          <img
            src={`${TMDB_IMAGE_BASE_URL}/original${item.backdrop_path}`}
            alt={'title' in item ? item.title : item.name}
            className="w-full h-full object-cover pointer-events-none select-none"
            loading="lazy"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/70 to-transparent"></div>
        </div>
      ))}

      <div className="relative z-10 flex flex-col justify-end h-full container mx-auto px-4 pb-36 md:pb-56">
        <div key={activeItem.id} className="max-w-3xl text-white">
          <h1 className="text-4xl md:text-6xl font-bold font-heading mb-4 animate-fade-in-down">{title}</h1>
          <div className="flex items-center flex-wrap gap-4 mb-4 text-text-secondary animate-fade-in-up">
            <div className="flex items-center gap-1">
              <span className="text-yellow-400"><FaStar /></span>
              <span>{activeItem.vote_average.toFixed(1)}</span>
            </div>
            <span>|</span>
            <span>{year}</span>
            <span>|</span>
            <span className="flex items-center gap-2 border border-text-muted px-2 py-1 rounded-md text-sm">
              {mediaType === 'tv' ? <FaTv /> : <FaFilm />}
              {mediaType.toUpperCase()}
            </span>
          </div>
          <p className="text-text-secondary text-sm md:text-base line-clamp-3 mb-6 animate-fade-in-up animation-delay-200">{activeItem.overview}</p>
          <div className="flex items-center gap-4 animate-fade-in-up animation-delay-400">
            <Link to={`/${mediaType}/${activeItem.id}?autoplay=true`} className="flex items-center gap-2 px-6 py-3 bg-accent-primary text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-lg">
              <FaPlay />
              <span>Play Now</span>
            </Link>
            <Link to={`/${mediaType}/${activeItem.id}`} className="flex items-center gap-2 px-6 py-3 bg-surface/80 backdrop-blur-sm text-white font-semibold rounded-lg hover:bg-surface transition-colors">
              <FaInfoCircle />
              <span>More Info</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Dot Indicators - Positioned higher to clear the negative margin of the next section */}
      <div className="absolute bottom-24 md:bottom-40 left-1/2 -translate-x-1/2 z-20 flex gap-3">
        {items.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`transition-all duration-300 rounded-full ${index === currentIndex
              ? 'w-8 h-2.5 bg-accent-primary shadow-lg shadow-accent-primary/50'
              : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/70'
              }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroSection;