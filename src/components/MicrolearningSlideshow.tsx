import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Pause, Loader2, BookOpen, CheckCircle2 } from 'lucide-react';
import { fetchCPDContent, SlideData } from '../services/api/cpdContent';
import { clsx } from 'clsx';

interface Props {
  moduleId: string;
  onComplete: () => void;
}

export function MicrolearningSlideshow({ moduleId, onComplete }: Props) {
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [viewedSlides, setViewedSlides] = useState<Set<number>>(new Set([0]));
  
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchCPDContent(moduleId).then(data => {
      if(mounted) {
        setSlides(data);
        setLoading(false);
        setCurrentIndex(0);
        setIsPlaying(true);
        setReachedEnd(false);
        setViewedSlides(new Set([0]));
      }
    });
    return () => { mounted = false; };
  }, [moduleId]);

  // Autoplay logic
  useEffect(() => {
    if (loading || slides.length === 0 || !isPlaying || reachedEnd) return;
    
    // We give enough time for the staggered text to render and be read.
    const slideDuration = 8000;
    
    const timer = setInterval(() => {
      handleNext();
    }, slideDuration);
    
    return () => clearInterval(timer);
  }, [loading, slides.length, isPlaying, currentIndex, reachedEnd]);

  useEffect(() => {
    // Whenever currentIndex changes, add it to viewedSlides
    setViewedSlides(prev => new Set([...prev, currentIndex]));
  }, [currentIndex]);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Check if all slides have been viewed
      if (viewedSlides.size === slides.length) {
        setIsPlaying(false);
        setReachedEnd(true);
        onComplete();
      } else {
        // Find the first unviewed slide
        const firstUnviewed = slides.findIndex((_, idx) => !viewedSlides.has(idx));
        if (firstUnviewed !== -1) {
          setCurrentIndex(firstUnviewed);
        }
      }
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setReachedEnd(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-8 text-center absolute inset-0 z-10">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6" />
        <h2 className="text-xl font-bold text-white mb-2">Microlearning Content Loading</h2>
        <p className="text-slate-400">Connecting to Knowledge Hub API...</p>
      </div>
    );
  }

  if (slides.length === 0) return null;

  const currentSlide = slides[currentIndex];

  const slideVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  const containerVariants: import('framer-motion').Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.8
      }
    }
  };

  const itemVariants: import('framer-motion').Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="w-full h-full bg-slate-900 absolute inset-0 flex flex-col overflow-hidden text-white font-sans z-10">
      
      {/* Top Segmented Progress Bar */}
      <div className="w-full p-4 md:px-8 flex items-center justify-between gap-2 z-20">
        {slides.map((_, idx) => (
          <div key={idx} className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden relative">
            <motion.div
              animate={{ 
                width: idx < currentIndex ? '100%' : (idx === currentIndex ? (isPlaying ? '100%' : '100%') : '0%')
              }}
              transition={{ 
                duration: idx === currentIndex && isPlaying ? 8 : 0.3,
                ease: "linear"
              }}
              className={clsx(
                "absolute left-0 top-0 bottom-0",
                idx <= currentIndex ? "bg-indigo-500" : "bg-transparent"
              )}
              initial={{ width: idx < currentIndex ? '100%' : '0%' }}
            />
          </div>
        ))}
      </div>

      {reachedEnd ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col items-center justify-center text-center px-8 z-10"
        >
          <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <h2 className="text-3xl font-black text-white mb-4">Module Completed</h2>
          <p className="text-slate-400 text-lg max-w-md">
            You have successfully run through all slides in this microlearning session. Mark this task as completed!
          </p>
          <button 
            onClick={() => {
              setCurrentIndex(0);
              setReachedEnd(false);
              setIsPlaying(true);
            }}
            className="mt-8 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
          >
            Review Module Again
          </button>
        </motion.div>
      ) : (
        <div className="flex-1 flex flex-col px-8 md:px-16 pt-6 pb-24 overflow-y-auto z-10 no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.id}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col max-w-4xl mx-auto w-full"
            >
              <div className="mb-8 md:mb-12 flex items-start md:items-center gap-4 border-b border-white/10 pb-6">
                <div className="p-3 bg-indigo-500/20 rounded-lg text-indigo-400 shrink-0">
                  <BookOpen className="w-8 h-8 md:w-10 md:h-10" />
                </div>
                <h2 className="text-2xl md:text-4xl font-black tracking-tight text-white leading-tight">
                  {currentSlide.title}
                </h2>
              </div>

              <motion.ul 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-6 md:space-y-10 flex-1"
              >
                {(Array.isArray(currentSlide.bullets) ? currentSlide.bullets : []).map((bullet, i) => (
                  <motion.li 
                    key={i} 
                    variants={itemVariants}
                    className="flex items-start gap-5 text-slate-300 md:text-xl font-medium leading-relaxed group"
                  >
                    <div className="mt-2.5 w-3 h-3 rounded-full bg-indigo-500 shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.6)] group-hover:scale-125 transition-transform" />
                    <p className="group-hover:text-white transition-colors">{bullet}</p>
                  </motion.li>
                ))}
              </motion.ul>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Playback Controls Footer */}
      {!reachedEnd && (
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-950 via-slate-900 to-transparent flex items-center justify-between z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-14 h-14 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white transition-all backdrop-blur-md"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
            </button>
            <div className="hidden md:block text-slate-400 text-sm font-medium">
              {isPlaying ? 'Auto-playing' : 'Paused'}
            </div>
          </div>
          
          <div className="relative">
             {/* Progress indicator text */}
             <div className="absolute -top-10 right-0 text-slate-500 text-xs font-bold uppercase tracking-widest hidden md:block">
               Slide {currentIndex + 1} of {slides.length}
             </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="px-6 py-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold transition-all backdrop-blur-md flex items-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Prev</span>
              </button>
              <button 
                onClick={handleNext}
                className="px-8 py-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_25px_rgba(79,70,229,0.6)] hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
              >
                <span className="hidden sm:inline">
                  {currentIndex === slides.length - 1 
                    ? (viewedSlides.size === slides.length ? 'Finish' : 'Next Unread') 
                    : 'Next'}
                </span>
                {currentIndex !== slides.length - 1 && <ChevronRight className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
