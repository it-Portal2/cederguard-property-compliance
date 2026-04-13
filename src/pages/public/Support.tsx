import React from 'react';
import { Link } from 'react-router';
import { Book, Code, MessageCircle, Bug, Search, ChevronRight, Mail, Phone, Globe } from 'lucide-react';
import { motion } from 'motion/react';

export function Support() {
  const options = [
    {
      icon: <Book className="w-8 h-8 text-cyan-500" />,
      title: 'Documentation',
      description: 'Comprehensive guides and tutorials to help you get the most out of Cedar Risk.',
      action: 'Read Docs',
      link: '/help'
    },
    {
      icon: <Code className="w-8 h-8 text-cyan-500" />,
      title: 'API Reference',
      description: 'Detailed API documentation for developers looking to integrate with our platform.',
      action: 'View API',
      link: '/api-docs'
    },
    {
      icon: <MessageCircle className="w-8 h-8 text-cyan-500" />,
      title: 'Community Forum',
      description: 'Connect with other users, share best practices, and get your questions answered.',
      action: 'Visit Forum',
      link: '#'
    },
    {
      icon: <Bug className="w-8 h-8 text-cyan-500" />,
      title: 'Technical Support',
      description: 'Need help with something specific? Our support team is here to assist you.',
      action: 'Contact Us',
      link: '/contact'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-32 pb-20 text-slate-600 dark:text-slate-300 transition-colors duration-500">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <h1 className="text-5xl font-black text-slate-900 dark:text-white mb-8 font-display tracking-tight">How can we help?</h1>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-teal-400 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-6 h-6" />
              <input 
                type="text" 
                placeholder="Search help articles, guides, and documentation..." 
                className="w-full pl-14 pr-8 py-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all shadow-xl dark:shadow-2xl outline-none text-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {options.map((option, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-slate-900/50 backdrop-blur-sm p-10 rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:border-cyan-500/30 hover:shadow-xl dark:hover:shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-500 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-8 border border-white/5 shadow-inner group-hover:scale-110 transition-transform duration-500 relative z-10">
                {React.cloneElement(option.icon as React.ReactElement<any>, { className: "w-8 h-8 text-cyan-400" })}
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 font-display tracking-tight relative z-10">{option.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed text-lg relative z-10">{option.description}</p>
              <Link 
                to={option.link}
                className="inline-flex items-center text-cyan-600 dark:text-cyan-400 font-black group/link hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors uppercase tracking-widest text-sm relative z-20"
                onClick={(e) => option.link === '#' && e.preventDefault()}
              >
                {option.action}
                <ChevronRight className="w-5 h-5 ml-2 transform group-hover/link:translate-x-2 transition-transform" />
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Contact info footer */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-32 p-16 bg-gradient-to-br from-slate-900 to-cyan-950 rounded-[4rem] text-white relative overflow-hidden shadow-2xl border border-white/10"
        >
          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-16">
            <div className="max-w-xl text-center lg:text-left">
              <h2 className="text-4xl font-black mb-6 font-display tracking-tight">Still need assistance?</h2>
              <p className="text-cyan-100 text-xl leading-relaxed font-light">
                Our specialist support team is available 24/7 to help you resolve any issues or provide detailed guidance on platform features.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12 w-full lg:w-auto">
              {/* Similar items as before but with cyan-400 icons */}
              <div className="flex flex-col items-center lg:items-start group/contact text-center lg:text-left">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-cyan-500/20 transition-colors">
                  <Mail className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="font-bold mb-2 uppercase tracking-widest text-[10px] opacity-70">Email us</div>
                <div className="text-white text-base md:text-lg font-medium break-all">support@cedarrisk.com</div>
              </div>
              <div className="flex flex-col items-center lg:items-start group/contact text-center lg:text-left">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-cyan-500/20 transition-colors">
                  <Phone className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="font-bold mb-2 uppercase tracking-widest text-[10px] opacity-70">Call us</div>
                <div className="text-white text-base md:text-lg font-medium">+44 (0) 2031433504</div>
              </div>
              <div className="flex flex-col items-center lg:items-start group/contact text-center lg:text-left sm:col-span-2 lg:col-span-1">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-cyan-500/20 transition-colors">
                  <Globe className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="font-bold mb-2 uppercase tracking-widest text-[10px] opacity-70">Region</div>
                <div className="text-white text-base md:text-lg font-medium">UK & Europe</div>
              </div>
            </div>
          </div>
          
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-400 rounded-full -mr-48 -mt-48 opacity-20 blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-400 rounded-full -ml-48 -mb-48 opacity-20 blur-[100px]" />
        </motion.div>
      </div>
    </div>
  );
}
