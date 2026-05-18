import React from 'react';
import { Rocket, Eye, Users } from 'lucide-react';
import { motion } from 'motion/react';

export const About: React.FC = () => {
    return (
        <div className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-300 font-sans min-h-screen pt-12 md:pt-16 pb-32 px-6 relative overflow-hidden transition-colors duration-500">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-900/10 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-teal-900/10 blur-[150px] rounded-full pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-24"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 text-xs font-bold uppercase tracking-widest mb-8">
                        Our Story
                    </div>
                    <h1 className="text-6xl md:text-7xl font-extrabold text-slate-900 dark:text-white mb-8 tracking-tight">
                        About <span className="text-cyan-600 dark:text-cyan-400">Us</span>
                    </h1>
                    <p className="text-2xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto font-light leading-relaxed">
                        We are a dedicated team bridging the gap between cutting-edge AI technology and the stringent compliance requirements of UK Social Housing.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                        { icon: Rocket, title: "Our Mission", desc: "To automate complex compliance workflows using AI, ensuring resident safety through proactive risk discovery and real-time oversight." },
                        { icon: Eye, title: "Our Vision", desc: "A total intelligence ecosystem where risk is predicted, not just tracked, enabling housing leaders to protect their communities with absolute certainty." },
                        { icon: Users, title: "Our Team", desc: "Comprised of regulatory experts and AI engineers dedicated to solving complex housing compliance challenges." }
                    ].map((item, idx) => (
                        <motion.div 
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-[2rem] p-10 backdrop-blur-xl hover:bg-slate-100 dark:hover:bg-slate-900/60 hover:border-cyan-500/30 transition-all duration-500 group shadow-sm hover:shadow-xl dark:shadow-none"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-8 border border-slate-200 dark:border-white/5 group-hover:scale-110 transition-transform duration-500">
                                <item.icon className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">{item.title}</h3>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg">{item.desc}</p>
                        </motion.div>
                    ))}
                </div>

                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="mt-40 p-16 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-[3rem] backdrop-blur-sm relative overflow-hidden text-center transition-all duration-500 shadow-sm"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent pointer-events-none" />
                    <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-8 tracking-tight">Our Values</h2>
                    <p className="text-xl text-slate-600 dark:text-slate-400 max-w-4xl mx-auto font-light leading-relaxed">
                        We believe in transparency, safety, and innovation. Every line of code and every regulatory insight we provide is focused on one goal: making social housing safer and more compliant for everyone.
                    </p>
                </motion.div>
            </div>
        </div>
    );
};
