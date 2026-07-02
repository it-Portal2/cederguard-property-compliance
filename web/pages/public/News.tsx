import React, { useState } from 'react';
import { Link } from 'react-router';
import { Calendar, ArrowRight, Filter, Search } from 'lucide-react';
import { newsArticles } from '../../data/newsData';
import { motion, AnimatePresence } from 'motion/react';

const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

const CARD_CLASS =
  'group relative flex h-full flex-col overflow-hidden rounded-xl border border-[oklch(0.91_0.006_270)] bg-white p-7 transition-[transform,border-color,box-shadow,background] duration-[320ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:-translate-y-1 hover:scale-[1.01] hover:border-[oklch(0.62_0.24_278_/_0.45)] hover:shadow-[0_0_0_1px_oklch(0.62_0.24_278_/_0.20),0_20px_40px_-16px_oklch(0.62_0.24_278_/_0.30),0_0_60px_-10px_oklch(0.62_0.24_278_/_0.22)] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[radial-gradient(60%_80%_at_50%_0%,oklch(0.62_0.24_278_/_0.14),transparent_70%)] before:opacity-0 before:transition-opacity before:duration-[320ms] before:content-[""] hover:before:opacity-100 dark:border-white/10 dark:bg-white/3';

export function News() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const categories = ['All', 'Regulation', 'Technology', 'Product Update', 'Policy', 'Industry News'];
  const categoryCounts: Record<string, number> = { All: newsArticles.length };
  categories.slice(1).forEach((cat) => {
    categoryCounts[cat] = newsArticles.filter((article) => article.category === cat).length;
  });

  const filteredArticles = selectedCategory === 'All'
    ? newsArticles
    : newsArticles.filter(article => article.category === selectedCategory);

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-slate-50 pt-12 pb-20 transition-colors duration-500 md:pt-16 dark:bg-slate-950"
      style={{ "--accent": "oklch(0.62 0.24 278)" } as React.CSSProperties}
    >
      {/* Hero backdrop — masked accent grid + radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-130"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.62 0.24 278 / 0.06) 1px, transparent 1px), linear-gradient(90deg, oklch(0.62 0.24 278 / 0.06) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
          WebkitMaskImage:
            "radial-gradient(70% 60% at 50% 18%, #000 35%, transparent 85%)",
          maskImage:
            "radial-gradient(70% 60% at 50% 18%, #000 35%, transparent 85%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-80px] h-[460px] w-[1200px] max-w-none -translate-x-1/2"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 30%, oklch(0.62 0.24 278 / 0.16), transparent 65%), radial-gradient(45% 40% at 30% 25%, oklch(0.68 0.24 248 / 0.10), transparent 70%)",
          filter: "blur(2px)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Hero header */}
        <div className="mx-auto max-w-2xl text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.91_0.006_270)] bg-white px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[oklch(0.32_0.012_270)] shadow-[0_2px_8px_-4px_oklch(0_0_0_/_0.06)] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            </span>
            News · Product · Regulation
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
            className="mt-[22px] text-[clamp(36px,5.4vw,60px)] font-medium leading-[1.02] tracking-[-0.035em] text-[oklch(0.20_0.012_270)] dark:text-white"
          >
            Latest{' '}
            <em
              className="not-italic bg-[linear-gradient(135deg,oklch(0.62_0.24_278),oklch(0.50_0.28_254))] bg-clip-text text-transparent"
            >
              Insights
            </em>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
            className="mx-auto mt-4 max-w-[560px] text-[16px] leading-[1.6] text-[oklch(0.50_0.010_270)] dark:text-slate-400"
          >
            Stay up to date with the latest from Cedar Risk: platform updates, regulatory changes, and AI innovation in property compliance.
          </motion.p>
        </div>

        {/* Categories Filtering */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
          className="mt-14 mb-14 border-b border-[oklch(0.91_0.006_270)] pb-8 dark:border-white/10"
        >
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[oklch(0.50_0.010_270)] dark:text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              <span>Browse by category</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`inline-flex h-8 items-center gap-2 rounded-full border px-3.5 font-mono text-[11.5px] uppercase tracking-[0.04em] transition-all duration-[140ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] ${
                    selectedCategory === cat
                      ? 'border-[oklch(0.20_0.012_270)] bg-[oklch(0.20_0.012_270)] text-white dark:border-white dark:bg-white dark:text-slate-900'
                      : 'border-[oklch(0.91_0.006_270)] bg-white text-[oklch(0.50_0.010_270)] hover:border-[oklch(0.85_0.008_270)] hover:text-[oklch(0.20_0.012_270)] dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {cat}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      selectedCategory === cat
                        ? 'bg-white/16 text-white/85 dark:bg-slate-900/16 dark:text-slate-900/85'
                        : 'bg-[oklch(0.98_0.004_270)] text-[oklch(0.50_0.010_270)] dark:bg-white/5 dark:text-slate-500'
                    }`}
                  >
                    {categoryCounts[cat]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

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
                  style={{ "--accent": "oklch(0.62 0.24 278)" } as React.CSSProperties}
                  className={CARD_CLASS}
                >
                  <div className="relative z-[1] flex items-center justify-between mb-6">
                    <span className="rounded-full border border-[oklch(0.62_0.24_278_/_0.20)] bg-[oklch(0.62_0.24_278_/_0.10)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent)] dark:bg-[oklch(0.62_0.24_278_/_0.14)] dark:text-indigo-300">
                      {article.category}
                    </span>
                    <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-[oklch(0.50_0.010_270)] dark:text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      {article.date}
                    </div>
                  </div>

                  <h2 className="relative z-[1] mb-4 text-2xl font-bold leading-tight tracking-tight text-[oklch(0.20_0.012_270)] dark:text-white">
                    {article.title}
                  </h2>

                  <p className="relative z-[1] mb-8 flex-1 text-[15px] leading-relaxed text-[oklch(0.50_0.010_270)] line-clamp-3 dark:text-slate-400">
                    {article.description}
                  </p>

                  <div className="relative z-[1] mt-auto flex items-center justify-between border-t border-[oklch(0.91_0.006_270)] pt-6 dark:border-white/5">
                    <span className="group/btn flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--accent)] transition-[gap] duration-[140ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:gap-2.5">
                      Read full story
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
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
