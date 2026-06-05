import React from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import { motion } from 'motion/react';

export const Contact: React.FC = () => {
    return (
        <div className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 font-sans min-h-screen pt-12 md:pt-16 pb-32 px-6 relative overflow-hidden transition-colors duration-500">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-900/10 blur-[150px] rounded-full pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10 flex flex-col lg:grid lg:grid-cols-2 gap-24">

                {/* Left Col - Info */}
                <motion.div 
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col justify-center"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-300 text-xs font-bold uppercase tracking-widest mb-8 w-fit">
                        Get In Touch
                    </div>
                    <h1 className="text-6xl md:text-7xl font-black text-slate-900 dark:text-white mb-8 tracking-tight leading-tight">
                        Reach <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">Out</span>
                    </h1>
                    <p className="text-2xl text-slate-600 dark:text-slate-400 mb-16 font-light leading-relaxed">
                        Interested in deploying our platform for your social housing portfolio? Our team is ready to provide a tailored demonstration.
                    </p>

                    <div className="space-y-12">
                        <div className="flex items-center gap-6 group">
                            <div className="w-16 h-16 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 border border-white/5 group-hover:scale-110 transition-transform duration-500">
                                <Mail className="w-7 h-7" />
                            </div>
                            <div>
                                <h4 className="text-slate-900 dark:text-white font-bold text-xl mb-1 tracking-tight">Email Us</h4>
                                <p className="text-slate-500 dark:text-slate-400 text-lg">info@cedarguard.co.uk</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 group">
                            <div className="w-16 h-16 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0 border border-white/5 group-hover:scale-110 transition-transform duration-500">
                                <Phone className="w-7 h-7" />
                            </div>
                            <div>
                                <h4 className="text-slate-900 dark:text-white font-bold text-xl mb-1 tracking-tight">Call Us</h4>
                                <p className="text-slate-500 dark:text-slate-400 text-lg">+44 (0) 2031433504</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-6 group">
                            <div className="w-16 h-16 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-white/5 group-hover:scale-110 transition-transform duration-500">
                                <MapPin className="w-7 h-7" />
                            </div>
                            <div>
                                <h4 className="text-slate-900 dark:text-white font-bold text-xl mb-1 tracking-tight">Office</h4>
                                <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">10 The New Inn Court<br />54 Matham Road<br />East Molesey, KT8 0BE</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Right Col - Form */}
                <motion.div 
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative"
                >
                    <div className="absolute -inset-1 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg blur opacity-20" />
                    <div className="relative bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-lg p-12 backdrop-blur-2xl shadow-2xl transition-all duration-500">
                        <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-10 tracking-tight">Send a Message</h3>
                        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest px-1">First Name</label>
                                    <input type="text" className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-lg px-6 py-4 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-lg" placeholder="John" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest px-1">Last Name</label>
                                    <input type="text" className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-lg px-6 py-4 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 focus:border-transparent focus:ring-2 focus:ring-cyan-500/50 transition-all text-lg shadow-sm" placeholder="Doe" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest px-1">Work Email</label>
                                <input type="email" className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-lg px-6 py-4 text-slate-900 dark:text-white focus:outline-none focus:border-transparent focus:ring-2 focus:ring-cyan-500/50 transition-all text-lg shadow-sm" placeholder="john@council.gov.uk" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest px-1">Message</label>
                                <textarea rows={5} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-lg px-6 py-4 text-slate-900 dark:text-white focus:outline-none focus:border-transparent focus:ring-2 focus:ring-cyan-500/50 transition-all resize-none text-lg shadow-sm" placeholder="How can we help you..."></textarea>
                            </div>
                            <button className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black py-5 rounded-lg transition-all duration-300 mt-6 shadow-xl shadow-teal-500/20 text-xl transform hover:scale-[1.02]">
                                Submit Request
                            </button>
                        </form>
                    </div>
                </motion.div>

            </div>
        </div>
    );
};
