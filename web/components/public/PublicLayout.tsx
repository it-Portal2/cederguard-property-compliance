import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Menu, X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { useStore } from '../../store/useStore';
import RouteSeo from './RouteSeo';

export const PublicLayout: React.FC = () => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();
    const menuTriggerRef = useRef<HTMLButtonElement>(null);

    // `isMarketingDarkMode` left in the store on purpose — other consumers
    // (e.g. landing-page hero variants) may still read it. We just don't
    // render a toggle in the marketing chrome any more, since modern B2B
    // SaaS chrome (Linear / Vercel / Stripe) doesn't carry one.
    const { deferredPrompt, installPWA } = useStore();
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

    // Close mobile menu on route change, restore focus to the hamburger.
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    // Body scroll-lock + ESC dismiss while the mobile overlay is open.
    useEffect(() => {
        if (!mobileMenuOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMobileMenuOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKey);
            // Return focus to the trigger so keyboard users don't get lost.
            menuTriggerRef.current?.focus();
        };
    }, [mobileMenuOpen]);

    const navLinks = [
        { href: '/product', label: 'Product' },
        { href: '/news', label: 'News' },
        { href: '/support', label: 'Support' },
        { href: '/contact', label: 'Contact' },
    ];

    const isActive = (href: string) =>
        href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

    return (
        <div className="min-h-screen bg-white text-slate-800 dark:bg-[#030303] dark:text-slate-300 font-sans antialiased selection:bg-indigo-500/30 selection:text-white flex flex-col transition-colors duration-500 relative overflow-x-clip">
            <RouteSeo />
            {/* Background Decorative Elements */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-500/5 dark:bg-cyan-500/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/5 dark:bg-indigo-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
            </div>

            {/* ── NAVBAR ──
                Flat sticky bar, transparent over the hero, gains opacity +
                subtle blur once the page scrolls past 10px. Mirrors the
                Linear / Vercel / Stripe chrome pattern: minimal surfaces,
                ONE primary CTA + one quiet sign-in link, no dark-mode
                toggle, no APP install button (moved to the footer band).
            */}
            <header
                className={clsx(
                    'sticky top-0 z-50 transition-colors duration-200',
                    scrolled
                        ? 'bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/60 dark:border-white/10'
                        : 'bg-transparent border-b border-transparent',
                )}
                role="banner"
            >
                <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
                    {/* Logo */}
                    <Link to="/" aria-label="CedarGuard home" className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-md">
                        <img
                            src={`${import.meta.env.BASE_URL}logo.png`}
                            alt="CedarGuard"
                            className="h-10 w-auto object-contain dark:invert-0"
                        />
                    </Link>

                    {/* Desktop nav */}
                    <nav className="hidden md:flex items-center gap-8" aria-label="Primary navigation">
                        {navLinks.map((l) => {
                            const active = isActive(l.href);
                            return (
                                <Link
                                    key={l.href}
                                    to={l.href}
                                    aria-current={active ? 'page' : undefined}
                                    className={clsx(
                                        'relative text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-sm',
                                        active
                                            ? 'text-slate-900 dark:text-white'
                                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                                    )}
                                >
                                    {l.label}
                                    {active && (
                                        <span
                                            aria-hidden
                                            className="absolute left-0 right-0 -bottom-6.5 h-0.5 bg-indigo-600 dark:bg-indigo-400"
                                        />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right cluster — desktop */}
                    <div className="hidden md:flex items-center gap-5">
                        <Link
                            to="/login"
                            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-sm"
                        >
                            Sign in
                        </Link>
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white text-sm font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                        >
                            Access portal
                            <span aria-hidden>→</span>
                        </Link>
                    </div>

                    {/* Mobile hamburger */}
                    <button
                        ref={menuTriggerRef}
                        type="button"
                        className="md:hidden p-2 -mr-2 rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                        onClick={() => setMobileMenuOpen(true)}
                        aria-label="Open navigation menu"
                        aria-expanded={mobileMenuOpen}
                        aria-controls="mobile-nav"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </div>

                {/* Mobile overlay — full-screen, NOT a floating panel */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div
                            id="mobile-nav"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Navigation"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="md:hidden fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col"
                        >
                            {/* Same-height header strip inside the overlay */}
                            <div className="max-w-7xl mx-auto w-full px-6 h-16 flex items-center justify-between shrink-0 border-b border-slate-200 dark:border-white/10">
                                <Link to="/" aria-label="CedarGuard home" className="flex items-center">
                                    <img
                                        src={`${import.meta.env.BASE_URL}logo.png`}
                                        alt="CedarGuard"
                                        className="h-10 w-auto object-contain dark:invert-0"
                                    />
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setMobileMenuOpen(false)}
                                    aria-label="Close navigation menu"
                                    className="p-2 -mr-2 rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Scrolling nav list */}
                            <nav className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-1" aria-label="Primary mobile navigation">
                                {navLinks.map((l) => {
                                    const active = isActive(l.href);
                                    return (
                                        <Link
                                            key={l.href}
                                            to={l.href}
                                            aria-current={active ? 'page' : undefined}
                                            className={clsx(
                                                'relative px-4 py-3.5 rounded-lg text-lg font-medium transition-colors',
                                                active
                                                    ? 'bg-indigo-50 text-slate-900 dark:bg-indigo-500/10 dark:text-white'
                                                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5',
                                            )}
                                        >
                                            {active && (
                                                <span
                                                    aria-hidden
                                                    className="absolute left-0 top-2 bottom-2 w-0.75 bg-indigo-600 dark:bg-indigo-400 rounded-r"
                                                />
                                            )}
                                            {l.label}
                                        </Link>
                                    );
                                })}

                                <div className="my-4 border-t border-slate-200 dark:border-white/10" />

                                <Link
                                    to="/login"
                                    className="px-4 py-3.5 rounded-lg text-lg font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5 transition-colors"
                                >
                                    Sign in
                                </Link>
                            </nav>

                            {/* Sticky bottom primary CTA */}
                            <div className="shrink-0 px-6 py-5 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
                                <Link
                                    to="/login"
                                    className="w-full inline-flex items-center justify-center gap-1.5 py-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white text-base font-semibold rounded-lg transition-colors"
                                >
                                    Access portal
                                    <span aria-hidden>→</span>
                                </Link>
                            </div>
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
                                className="relative bg-white dark:bg-slate-900 rounded-lg p-8 md:p-12 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-white/10"
                            >
                                <button 
                                    onClick={() => setShowInstallModal(false)}
                                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="flex flex-col items-center text-center">
                                    <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg flex items-center justify-center mb-8">
                                        <img src={`${import.meta.env.BASE_URL}pwa-icon.png`} alt="App Icon" className="w-12 h-12" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tight">Install Cedar Guard</h3>
                                    <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                                        Get the full experience with real-time notifications and offline access by adding Cedar Guard to your home screen.
                                    </p>

                                    <div className="w-full space-y-4 text-left">
                                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                            <p className="font-bold text-sm text-slate-900 dark:text-white mb-1">On iOS / Safari:</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Tap the <span className="font-bold text-indigo-600 dark:text-cyan-400">Share</span> button and select <span className="font-bold text-indigo-600 dark:text-cyan-400">"Add to Home Screen"</span>.</p>
                                        </div>
                                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                            <p className="font-bold text-sm text-slate-900 dark:text-white mb-1">On Android / Chrome:</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Open the menu and select <span className="font-bold text-indigo-600 dark:text-cyan-400">"Install App"</span> or <span className="font-bold text-indigo-600 dark:text-cyan-400">"Add to home screen"</span>.</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowInstallModal(false)}
                                        className="mt-10 w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-lg font-black uppercase tracking-widest text-sm hover:scale-[1.02] transition-transform"
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

                {/* Install-app band — preserves the install entry-point that
                    used to live as a header APP button. Quiet, single line,
                    only shows when the app isn't already installed. */}
                {!isInstalled && (
                    <div className="max-w-7xl mx-auto mb-16 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-500 relative z-10">
                        <span>Use CedarGuard on the go —</span>
                        <button
                            type="button"
                            onClick={deferredPrompt ? installPWA : () => setShowInstallModal(true)}
                            className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-sm"
                        >
                            <Download className="w-3.5 h-3.5" /> Install the app
                        </button>
                    </div>
                )}

                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16 mb-24 relative z-10">
                    <div className="col-span-1 md:col-span-1">
                        <Link to="/" className="inline-block mb-10 transition-transform hover:scale-105 duration-500">
                            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Cedar Logo" className="h-12 w-auto object-contain dark:invert-0" />
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
                                <div className="group bg-white dark:bg-white/5 p-4 rounded-lg border border-slate-200 dark:border-white/10 hover:border-indigo-500/20 dark:hover:border-cyan-500/20 transition-all duration-500">
                                    <img src="https://www.cedarproacademy.com/wp-content/uploads/2021/04/gfg-1.png" alt="Accreditation 1" className="h-10 w-auto object-contain opacity-70 group-hover:opacity-100 transition-opacity mix-blend-multiply dark:mix-blend-normal" />
                                </div>
                                <div className="group bg-white dark:bg-white/5 p-4 rounded-lg border border-slate-200 dark:border-white/10 hover:border-indigo-500/20 dark:hover:border-cyan-500/20 transition-all duration-500">
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
