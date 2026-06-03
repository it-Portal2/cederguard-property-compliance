import React from 'react';
import { useParams, Link } from 'react-router';
import { newsArticles } from '../../data/newsData';
import { ArrowLeft, Calendar, Tag, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export function NewsArticle() {
  const { id } = useParams<{ id: string }>();
  const article = newsArticles.find(a => a.id === id);

  if (!article) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#030303] pt-12 md:pt-16 pb-20 px-6 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-3xl mx-auto text-center"
        >
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-8 font-display">Article Not Found</h1>
          <Link 
            to="/news"
            className="inline-flex items-center text-indigo-600 dark:text-cyan-400 font-bold hover:gap-3 transition-all group"
          >
            <ArrowLeft className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform" />
            Back to Insights
          </Link>
        </motion.div>
      </div>
    );
  }

  const words = article.content
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const readMinutes = Math.max(1, Math.round(words / 200));

  return (
    <div className="min-h-screen bg-white dark:bg-[#030303] text-slate-800 dark:text-slate-300 transition-colors duration-500 selection:bg-indigo-100 dark:selection:bg-cyan-500/30">
      {/* Article Header */}
      <div className="relative pt-10 md:pt-14 pb-12 md:pb-16 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-white/10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 dark:from-cyan-500/10 to-transparent opacity-50" />

        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 dark:bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-cyan-500/10 dark:bg-indigo-500/10 rounded-full blur-3xl" />

        {/* Constrained to the article measure so the header lines up with the body. */}
        <div className="max-w-2xl mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link
              to="/news"
              className="inline-flex items-center text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors mb-8 group text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5 transform group-hover:-translate-x-1 transition-transform" />
              Back to Insights
            </Link>
          </motion.div>

          <motion.div
            variants={staggerChildren}
            initial="initial"
            animate="animate"
            className="space-y-5"
          >
            <motion.div
              variants={fadeInUp}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
            >
              <span className="px-3 py-1 bg-indigo-100 dark:bg-cyan-500/10 text-indigo-700 dark:text-cyan-300 text-[11px] font-semibold rounded-full border border-indigo-200 dark:border-cyan-500/20 uppercase tracking-wide">
                {article.category}
              </span>
              <span className="flex items-center text-slate-500 dark:text-slate-400 font-medium">
                <Calendar className="w-4 h-4 mr-1.5 text-slate-400 dark:text-slate-500" />
                {article.date}
              </span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                {readMinutes} min read
              </span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-3xl md:text-[2.75rem] font-bold text-slate-900 dark:text-white leading-[1.15] font-display tracking-tight"
            >
              {article.title}
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-lg md:text-xl text-slate-600 dark:text-slate-400 leading-relaxed"
            >
              {article.description}
            </motion.p>
          </motion.div>
        </div>
      </div>

      {/* Article Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="max-w-2xl mx-auto px-6 py-14 md:py-20"
      >
        <article
          className="prose prose-lg dark:prose-invert max-w-none
            prose-headings:font-display prose-headings:tracking-tight prose-headings:text-slate-900 dark:prose-headings:text-white
            prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-12 prose-h2:mb-4
            prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-10 prose-h3:mb-3
            prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-[1.8]
            prose-ul:my-6 prose-li:text-slate-700 dark:prose-li:text-slate-300 prose-li:my-2 prose-li:leading-[1.7]
            prose-strong:text-slate-900 dark:prose-strong:text-white prose-strong:font-semibold
            prose-a:text-indigo-600 dark:prose-a:text-cyan-400 prose-a:font-medium prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-indigo-700 dark:hover:prose-a:text-cyan-300
            prose-blockquote:border-l-4 prose-blockquote:border-indigo-400 dark:prose-blockquote:border-cyan-500/60 prose-blockquote:bg-slate-50 dark:prose-blockquote:bg-white/5 prose-blockquote:py-1 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:font-normal prose-blockquote:text-slate-700 dark:prose-blockquote:text-slate-200
            prose-img:rounded-xl prose-img:shadow-lg prose-img:border prose-img:border-slate-200 dark:prose-img:border-white/10"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-32 pt-16 border-t border-slate-200 dark:border-white/10"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-12">
            <div className="flex items-center space-x-6">
              <div className="w-16 h-16 rounded-lg bg-indigo-50 dark:bg-cyan-500/5 border border-indigo-100 dark:border-cyan-500/10 flex items-center justify-center shadow-inner">
                <Tag className="w-8 h-8 text-indigo-500 dark:text-cyan-400" />
              </div>
              <div>
                <div className="text-xs font-black text-indigo-500 dark:text-cyan-400/50 uppercase tracking-[0.2em] mb-1">Posted in</div>
                <div className="text-xl text-slate-900 dark:text-white font-bold font-display">{article.category}</div>
              </div>
            </div>
            
            <div className="flex flex-col space-y-4">
              <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Share Update</span>
              <div className="flex space-x-4">
                {['Twitter', 'LinkedIn'].map(platform => (
                  <button 
                    key={platform}
                    className="px-8 py-3 text-sm font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-300 dark:hover:border-cyan-500/30 hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:shadow-cyan-500/10 transition-all duration-300"
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Related Articles */}
      <div className="bg-slate-50 dark:bg-[#050505] py-32 border-t border-slate-200 dark:border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-cyan-500/5 opacity-50" />
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-slate-900 dark:text-white mb-16 font-display tracking-tight text-center"
          >
            Continue Reading
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {newsArticles.filter(a => a.id !== id).slice(0, 2).map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Link 
                  to={`/news/${item.id}`}
                  className="group block h-full p-10 bg-white dark:bg-slate-900/40 backdrop-blur-xl rounded-lg border border-slate-200 dark:border-white/5 hover:border-indigo-500/30 dark:hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-indigo-500/10 dark:hover:shadow-cyan-500/10 transition-all duration-500"
                >
                  <div className="flex items-center space-x-3 mb-8">
                    <span className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black rounded-full border border-slate-200 dark:border-white/5 uppercase tracking-[0.15em]">
                      {item.category}
                    </span>
                  </div>
                  <h3 className="text-3xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors mb-8 font-display leading-tight">
                    {item.title}
                  </h3>
                  <div className="flex items-center text-indigo-600 dark:text-cyan-400 font-black text-sm uppercase tracking-[0.2em] group/link">
                    <span>Read More</span>
                    <ChevronRight className="w-5 h-5 ml-2 transform group-hover/link:translate-x-2 transition-transform" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
