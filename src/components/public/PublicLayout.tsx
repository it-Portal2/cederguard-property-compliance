import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Menu, X, Sun, Moon, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../../store/useStore';

export const PublicLayout: React.FC = () => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();

    const { deferredPrompt, installPWA, isMarketingDarkMode, setIsMarketingDarkMode } = useStore();
    const [isInstalled, setIsInstalled] = useState(false);
    const [showInstallModal, setShowInstallModal] = useState(false);

    useEffect(() => {
        const checkInstalled = () => {
            if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
                setIsInstalled(true);
            }
        };
        checkInstalled();
        window.matchMedia('(display-mode: standalone)').addEventListener('change', checkInstalled);
        return () => window.matchMedia('(display-mode: standalone)').removeEventListener('change', checkInstalled);
    }, []);


    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    const navLinks = [
        { href: '/about', label: 'About' },
        { href: '/product', label: 'Product' },
        { href: '/news', label: 'News' },
        { href: '/support', label: 'Support' },
        { href: '/contact', label: 'Contact Us' },
    ];

    return (
        <div className="min-h-screen bg-white text-slate-800 dark:bg-[#030303] dark:text-slate-300 font-sans antialiased selection:bg-indigo-500/30 selection:text-white flex flex-col transition-colors duration-500 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-500/5 dark:bg-cyan-500/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/5 dark:bg-indigo-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
            </div>

            {/* ── NAVBAR ── */}
            <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${scrolled ? 'py-3' : 'py-5'}`} role="banner">
                <div className={`max-w-7xl mx-auto px-6 transition-all duration-700 ${scrolled ? 'scale-[0.98]' : 'scale-100'}`}>
                    <nav className={`flex items-center justify-between px-8 py-4 rounded-[2rem] transition-all duration-700 border ${scrolled ? 'bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl border-slate-200/60 dark:border-white/10 shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)]' : 'bg-transparent border-transparent'}`} aria-label="Primary navigation">
                        <Link to="/" className="flex items-center focus-visible:outline-none group">
                            <div className="h-14 flex flex-col items-center justify-center transition-transform duration-500 group-hover:scale-110 pl-2">
                                <img src="/logo.png" alt="Cedar Logo" className="h-[3.25rem] w-auto object-contain dark:invert-0 drop-shadow-sm transition-all duration-500 group-hover:drop-shadow-[0_0_15px_rgba(79,70,229,0.4)]" />
                            </div>
                        </Link>


                        <div className="hidden md:flex items-center gap-10">
                            {navLinks.map((l) => (
                                <Link 
                                    key={l.href} 
                                    to={l.href} 
                                    className={`text-sm font-bold tracking-widest uppercase transition-all duration-300 focus-visible:outline-none relative group ${location.pathname === l.href ? 'text-indigo-600 dark:text-cyan-400' : 'text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white'}`}
                                >
                                    {l.label}
                                    <span className={`absolute -bottom-2 left-0 w-full h-0.5 bg-indigo-600 dark:bg-cyan-400 transform transition-transform duration-300 ${location.pathname === l.href ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
                                </Link>
                            ))}
                        </div>

                        <div className="hidden md:flex items-center gap-6">
                            <button 
                                onClick={() => setIsMarketingDarkMode(!isMarketingDarkMode)} 
                                className="p-3 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-cyan-400 transition-all rounded-2xl bg-slate-100 dark:bg-white/5 border border-transparent hover:border-slate-200 dark:hover:border-white/10"
                                aria-label="Toggle theme"
                            >
                                {isMarketingDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            </button>

                            {!isInstalled && (
                                <button
                                    onClick={deferredPrompt ? installPWA : () => setShowInstallModal(true)}
                                    className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-cyan-400 transition-colors"
                                >
                                    <Download className="w-4 h-4" /> App
                                </button>
                            )}
                            
                            <Link to="/login" className="text-sm font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white transition-colors">
                                Sign In
                            </Link>
                            
                            <Link to="/login" className="text-xs font-black uppercase tracking-[0.2em] bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-8 py-4 rounded-2xl hover:bg-indigo-600 dark:hover:bg-cyan-400 transition-all duration-300 shadow-xl shadow-indigo-500/10 dark:shadow-cyan-500/10 hover:scale-105">
                                Access Portal
                            </Link>
                        </div>

                        <button className="md:hidden p-3 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-white transition-colors" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </nav>
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="md:hidden absolute top-full left-6 right-6 mt-4 bg-white dark:bg-slate-900/90 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-10 flex flex-col gap-8 shadow-[0_32px_64px_rgba(0,0,0,0.2)] dark:shadow-[0_32px_64px_rgba(0,0,0,0.5)] overflow-hidden z-20"
                        >
                            <div className="flex flex-col gap-6">
                                {navLinks.map((l, i) => (
                                    <motion.div
                                        key={l.href}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                    >
                                        <Link to={l.href} className={`text-3xl font-black tracking-tight font-display transition-colors ${location.pathname === l.href ? 'text-indigo-600 dark:text-cyan-400' : 'text-slate-900 dark:text-white'}`}>
                                            {l.label}
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                            
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="flex flex-col gap-6 pt-10 border-t border-slate-200 dark:border-white/5"
                            >
                                <Link to="/login" className="text-lg font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 px-2 transition-colors">Sign In</Link>
                                <Link to="/login" className="text-lg font-black uppercase tracking-[0.2em] bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-8 py-6 rounded-3xl text-center shadow-2xl shadow-indigo-500/20 dark:shadow-cyan-500/20 transition-all">
                                    Access Portal
                                </Link>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* PWA Install Instructions Modal */}
                <AnimatePresence>
                    {showInstallModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowInstallModal(false)}
                                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative bg-white dark:bg-slate-900 rounded-[2rem] p-8 md:p-12 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-white/10"
                            >
                                <button 
                                    onClick={() => setShowInstallModal(false)}
                                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="flex flex-col items-center text-center">
                                    <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-500/20 rounded-3xl flex items-center justify-center mb-8">
                                        <img src="/pwa-icon.png" alt="App Icon" className="w-12 h-12" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tight">Install Cedar Guard</h3>
                                    <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                                        Get the full experience with real-time notifications and offline access by adding Cedar Guard to your home screen.
                                    </p>

                                    <div className="w-full space-y-4 text-left">
                                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                            <p className="font-bold text-sm text-slate-900 dark:text-white mb-1">On iOS / Safari:</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Tap the <span className="font-bold text-indigo-600 dark:text-cyan-400">Share</span> button and select <span className="font-bold text-indigo-600 dark:text-cyan-400">"Add to Home Screen"</span>.</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                            <p className="font-bold text-sm text-slate-900 dark:text-white mb-1">On Android / Chrome:</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Open the menu and select <span className="font-bold text-indigo-600 dark:text-cyan-400">"Install App"</span> or <span className="font-bold text-indigo-600 dark:text-cyan-400">"Add to home screen"</span>.</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowInstallModal(false)}
                                        className="mt-10 w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-[1.02] transition-transform"
                                    >
                                        Got it
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </header>

            <main id="main-content" className="flex-grow flex flex-col">
                <Outlet />
            </main>

            {/* ── FOOTER ── */}
            <footer className="bg-slate-50 dark:bg-[#050505] px-6 py-24 text-slate-500 dark:text-slate-500 text-sm border-t border-slate-200 dark:border-white/5 mt-auto relative overflow-hidden transition-colors duration-500">
                <div className="absolute top-0 left-1/4 w-1/2 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/20 dark:via-cyan-400/30 to-transparent" />
                
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16 mb-24 relative z-10">
                    <div className="col-span-1 md:col-span-1">
                        <Link to="/" className="inline-block mb-10 transition-transform hover:scale-105 duration-500">
                            <img src="/logo.png" alt="Cedar Logo" className="h-12 w-auto object-contain dark:invert-0" />
                        </Link>
                        <p className="text-lg text-slate-500 dark:text-slate-400 font-light leading-relaxed italic">
                            "AI-Powered Risk and Compliance Platform for UK Social Housing Managers."
                        </p>
                    </div>
                    
                    <div>
                        <h4 className="text-slate-900 dark:text-white font-black tracking-[0.2em] uppercase mb-8 text-xs">Platform</h4>
                        <ul className="space-y-4">
                            {navLinks.map(l => (
                                <li key={l.href}>
                                    <Link to={l.href} className="text-base font-medium hover:text-indigo-600 dark:hover:text-cyan-400 transition-all hover:pl-2">
                                        {l.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    <div>
                        <h4 className="text-slate-900 dark:text-white font-black tracking-[0.2em] uppercase mb-8 text-xs">Headquarters</h4>
                        <ul className="space-y-4 text-slate-500 dark:text-slate-400 font-light text-base leading-relaxed">
                            <li>Cedar Property Compliance & Risk Suite</li>
                            <li>10 The New Inn Court</li>
                            <li>54 Matham Road</li>
                            <li>East Molesey, KT8 0BE</li>
                        </ul>
                    </div>
                    
                    <div>
                        <h4 className="text-slate-900 dark:text-white font-black tracking-[0.2em] uppercase mb-8 text-xs">Connect</h4>
                        <div className="space-y-6">
                            <a href="mailto:info@cedarguard.co.uk" className="block text-lg font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors">
                                info@cedarguard.co.uk
                            </a>
                            <a href="tel:+442031433504" className="block text-lg font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors">
                                +44 (0) 2031433504
                            </a>
                            <div className="pt-8 flex gap-6">
                                <div className="group bg-white dark:bg-white/5 p-4 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-indigo-500/20 dark:hover:border-cyan-500/20 transition-all duration-500">
                                    <img src="https://www.cedarproacademy.com/wp-content/uploads/2021/04/gfg-1.png" alt="Accreditation 1" className="h-10 w-auto object-contain opacity-70 group-hover:opacity-100 transition-opacity mix-blend-multiply dark:mix-blend-normal" />
                                </div>
                                <div className="group bg-white dark:bg-white/5 p-4 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-indigo-500/20 dark:hover:border-cyan-500/20 transition-all duration-500">
                                    <img src="https://www.cedarproacademy.com/wp-content/uploads/2021/04/Accreditations-affiliations-partnership2-1.jpg" alt="Accreditation 2" className="h-10 w-auto object-contain opacity-70 group-hover:opacity-100 transition-opacity rounded mix-blend-multiply dark:mix-blend-normal" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 pt-12 border-t border-slate-200 dark:border-white/5 relative z-10 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-600">
                    <p>&copy; 2026 Cedar Property Compliance & Risk Suite.</p>
                    <div className="flex gap-12">
                        <span className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">Privacy Policy</span>
                        <span className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">Terms of Service</span>
                        <span className="text-indigo-600 dark:text-cyan-500">Pre-market Edition</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};
