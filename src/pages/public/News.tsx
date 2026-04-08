import React, { useState } from 'react';
import { Link } from 'react-router';
import { Calendar, ArrowRight, Bell, Filter, Search } from 'lucide-react';
import { newsArticles } from '../../data/newsData';
import { motion, AnimatePresence } from 'motion/react';

export function News() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const categories = ['All', 'Regulation', 'Technology', 'Product Update', 'Policy', 'Industry News'];

  const filteredArticles = selectedCategory === 'All' 
    ? newsArticles 
    : newsArticles.filter(article => article.category === selectedCategory);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-32 pb-20 transition-colors duration-500">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-10">
          <div className="max-w-3xl text-center md:text-left mx-auto md:mx-0">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6 font-display tracking-tight transition-colors duration-500"
            >
              Latest Insights
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto md:mx-0 transition-colors duration-500"
            >
              Stay up to date with the latest from Cedar Risk: platform updates, regulatory changes, and AI innovation in property compliance.
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <button className="flex items-center space-x-3 px-8 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xl dark:shadow-[0_0_30px_rgba(0,0,0,0.4)] group">
              <Bell className="w-5 h-5 text-cyan-500 group-hover:rotate-12 transition-transform" />
              <span>Subscribe to Updates</span>
            </button>
          </motion.div>
        </div>

        {/* Categories Filtering - MOVED TO TOP */}
        <div className="mb-16">
          <div className="flex flex-col space-y-6">
            <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">
              <Filter className="w-4 h-4" />
              <span>Browse by Category</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {categories.map((cat, idx) => (
                <motion.button 
                  key={cat}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * idx }}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-6 py-2.5 rounded-xl font-bold transition-all duration-300 border ${
                    selectedCategory === cat 
                      ? 'bg-cyan-500 border-cyan-500 text-white shadow-lg shadow-cyan-500/30' 
                      : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:text-cyan-400'
                  }`}
                >
                  {cat}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* News Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 lg:gap-12 min-h-[400px]">
          <AnimatePresence mode='popLayout'>
            {filteredArticles.map((article, index) => (
              <motion.div
                layout
                key={article.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <Link 
                  to={`/news/${article.id}`}
                  className="group block h-full bg-white dark:bg-slate-900/60 backdrop-blur-md rounded-[2.5rem] border border-slate-200 dark:border-white/10 overflow-hidden hover:border-cyan-500/50 hover:shadow-2xl dark:hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] transition-all duration-500 relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  
                  <div className="p-10 flex flex-col h-full relative z-10">
                    <div className="flex items-center justify-between mb-8">
                      <span className="px-5 py-1.5 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px] font-black rounded-full uppercase tracking-[0.2em] border border-cyan-500/20">
                        {article.category}
                      </span>
                      <div className="flex items-center text-slate-400 dark:text-slate-500 text-sm font-semibold">
                        <Calendar className="w-4 h-4 mr-2" />
                        {article.date}
                      </div>
                    </div>
                    
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors leading-tight font-display tracking-tight">
                      {article.title}
                    </h2>
                    
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-10 flex-1 text-lg line-clamp-3">
                      {article.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400 font-bold group/btn pt-8 border-t border-slate-100 dark:border-white/5">
                      <span className="text-sm uppercase tracking-widest flex items-center">
                        Read Full Story
                        <ArrowRight className="w-5 h-5 ml-3 transform group-hover/btn:translate-x-3 transition-transform duration-300" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredArticles.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-6">
                <Search className="w-10 h-10 text-slate-400 dark:text-slate-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">No results found</h3>
              <p className="text-slate-500 dark:text-slate-400">There are no articles tagged under "{selectedCategory}" yet.</p>
              <button 
                onClick={() => setSelectedCategory('All')}
                className="mt-6 text-cyan-500 font-bold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
