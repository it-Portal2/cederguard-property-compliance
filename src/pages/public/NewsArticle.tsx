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
      <div className="min-h-screen bg-slate-50 dark:bg-[#030303] pt-32 pb-20 px-6 flex items-center justify-center">
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

  return (
    <div className="min-h-screen bg-white dark:bg-[#030303] text-slate-800 dark:text-slate-300 transition-colors duration-500 selection:bg-indigo-100 dark:selection:bg-cyan-500/30">
      {/* Article Header */}
      <div className="relative pt-40 pb-32 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-white/10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 dark:from-cyan-500/10 to-transparent opacity-50" />
        
        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 dark:bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-cyan-500/10 dark:bg-indigo-500/10 rounded-full blur-3xl" />

        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link 
              to="/news"
              className="inline-flex items-center text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-400 transition-all mb-12 group bg-white dark:bg-slate-800/50 backdrop-blur-md shadow-sm dark:shadow-none px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-white/5 font-bold text-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" />
              Back to Insights
            </Link>
          </motion.div>
          
          <motion.div 
            variants={staggerChildren}
            initial="initial"
            animate="animate"
            className="space-y-8"
          >
            <motion.div variants={fadeInUp} className="flex items-center space-x-6">
              <span className="px-5 py-2 bg-indigo-100 dark:bg-cyan-500/10 text-indigo-600 dark:text-cyan-400 text-[10px] font-black rounded-full border border-indigo-200 dark:border-cyan-500/20 uppercase tracking-[0.2em]">
                {article.category}
              </span>
              <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest">
                <Calendar className="w-4 h-4 mr-2 text-indigo-500 dark:text-cyan-400/50" />
                {article.date}
              </div>
            </motion.div>

            <motion.h1 
              variants={fadeInUp}
              className="text-5xl md:text-7xl font-bold text-slate-900 dark:text-white leading-[1.1] mb-8 font-display tracking-tight"
            >
              {article.title}
            </motion.h1>
            
            <motion.p 
              variants={fadeInUp}
              className="text-2xl text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl font-light italic border-l-4 border-indigo-500/20 dark:border-cyan-500/20 pl-8 py-2"
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
        className="max-w-3xl mx-auto px-6 py-32"
      >
        <article 
          className="prose dark:prose-invert prose-2xl max-w-none 
            prose-headings:text-slate-900 dark:prose-headings:text-white prose-headings:font-bold prose-headings:font-display prose-headings:tracking-tight
            prose-p:text-slate-600 dark:prose-p:text-slate-400 prose-p:leading-relaxed prose-p:text-xl prose-p:font-light
            prose-li:text-slate-600 dark:prose-li:text-slate-400 prose-li:text-xl
            prose-strong:text-slate-900 dark:prose-strong:text-white prose-strong:font-bold
            prose-a:text-indigo-600 dark:prose-a:text-cyan-400 prose-a:font-bold prose-a:underline decoration-2 underline-offset-4
            prose-img:rounded-[2.5rem] prose-img:shadow-2xl prose-img:border prose-img:border-slate-200 dark:prose-img:border-white/10
            prose-blockquote:border-l-8 prose-blockquote:border-indigo-500 dark:prose-blockquote:border-cyan-500 prose-blockquote:bg-slate-50 dark:bg-slate-900/30 prose-blockquote:py-8 prose-blockquote:px-12 prose-blockquote:rounded-3xl prose-blockquote:not-italic prose-blockquote:text-slate-900 dark:prose-blockquote:text-white"
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
              <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-50 dark:bg-cyan-500/5 border border-indigo-100 dark:border-cyan-500/10 flex items-center justify-center shadow-inner">
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
                    className="px-8 py-3 text-sm font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-300 dark:hover:border-cyan-500/30 hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:shadow-cyan-500/10 transition-all duration-300"
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
                  className="group block h-full p-10 bg-white dark:bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:border-indigo-500/30 dark:hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-indigo-500/10 dark:hover:shadow-cyan-500/10 transition-all duration-500"
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
