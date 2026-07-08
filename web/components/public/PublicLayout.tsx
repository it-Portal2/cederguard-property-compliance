import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Menu, X, Download, ArrowRight } from 'lucide-react';
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
    const { deferredPrompt, installPWA, user } = useStore();
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

    // Scroll to top on route change — client-side navigation keeps the
    // window's scroll position by default, so following a link while
    // scrolled down a long page (e.g. Documentation/API Reference) would
    // otherwise land on the new page already scrolled to the same offset.
    useEffect(() => {
        window.scrollTo(0, 0);
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
                ONE primary CTA, no dark-mode toggle, no APP install button
                (moved to the footer band).
            */}
            <header
                className={clsx(
                    'sticky top-0 z-50 transition-colors duration-200',
                    scrolled
                        ? 'bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/60 dark:border-white/10'
                        : 'bg-transparent border-b border-gray-200 dark:border-white/0',
                )}
                role="banner"
            >
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <Link to="/" aria-label="CedarGuard home" className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-md">
                        <img
                            src={`${import.meta.env.BASE_URL}fabIcon.svg`}
                            alt=""
                            className="h-8 w-8"
                        />
                        <span className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">
                            CedarGuard
                        </span>
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
                                            className="absolute left-0 right-0 -bottom-1.5 h-0.5 rounded-full bg-indigo-600 dark:bg-indigo-400"
                                        />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right cluster — desktop. Logged out → "Sign in";
                        logged in → "Access portal" straight to the dashboard.
                        Single button styled like the Landing "Book a demo" CTA
                        (violet accent fill, square corners, 140ms accent hover). */}
                    <div className="hidden md:flex items-center">
                        <Link
                            to={user ? '/dashboard' : '/login'}
                            className="group relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-[oklch(0.54_0.24_278)] bg-[oklch(0.62_0.24_278)] px-5 py-2.5 text-sm font-semibold text-white transition-[background] duration-[140ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:bg-[oklch(0.70_0.26_280)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                        >
                            {/* Sweeping white beam on hover */}
                            <span
                                aria-hidden
                                className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent_25%,oklch(1_0_0/0.45)_50%,transparent_75%)] transition-transform duration-700 ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:translate-x-full"
                            />
                            <span className="relative">{user ? 'Access portal' : 'Sign in'}</span>
                            <ArrowRight className="relative h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:translate-x-0.5" />
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
                                <Link to="/" aria-label="CedarGuard home" className="flex items-center gap-2.5">
                                    <img
                                        src={`${import.meta.env.BASE_URL}fabIcon.svg`}
                                        alt=""
                                        className="h-8 w-8"
                                    />
                                    <span className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">
                                        CedarGuard
                                    </span>
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

                                {!user && (
                                    <>
                                        <div className="my-4 border-t border-slate-200 dark:border-white/10" />
                                        <Link
                                            to="/login"
                                            className="px-4 py-3.5 rounded-lg text-lg font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5 transition-colors"
                                        >
                                            Sign in
                                        </Link>
                                    </>
                                )}
                            </nav>

                            {/* Sticky bottom primary CTA. Logged in → straight to
                                the dashboard; logged out → sign in first. */}
                            <div className="shrink-0 px-6 py-5 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
                                <Link
                                    to={user ? '/dashboard' : '/login'}
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
            <footer
                className="mt-auto border-t border-[oklch(0.91_0.006_270)] bg-white px-6 pt-14 pb-8 text-sm transition-colors duration-500 dark:border-white/10 dark:bg-[#050505]"
                style={{ "--accent": "oklch(0.62 0.24 278)" } as React.CSSProperties}
            >
                {/* Install-app band — preserves the install entry-point that
                    used to live as a header APP button. Quiet, single line,
                    only shows when the app isn't already installed. */}
                {!isInstalled && (
                    <div className="mx-auto mb-12 flex max-w-7xl flex-wrap items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[oklch(0.50_0.010_270)] dark:text-slate-500">
                        <span>Use CedarGuard on the go —</span>
                        <button
                            type="button"
                            onClick={deferredPrompt ? installPWA : () => setShowInstallModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[oklch(0.91_0.006_270)] bg-[oklch(0.98_0.004_270)] px-2.5 py-1 font-medium text-[oklch(0.32_0.012_270)] transition-colors hover:border-[oklch(0.62_0.24_278_/_0.40)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-indigo-300"
                        >
                            <Download className="h-3 w-3" /> Install the app
                        </button>
                    </div>
                )}

                <div className="mx-auto mb-10 grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.6fr_repeat(3,1fr)] md:gap-10">
                    {/* Brand */}
                    <div className="col-span-2 md:col-span-1">
                        <Link to="/" aria-label="CedarGuard home" className="inline-flex items-center gap-2.5">
                            <img src={`${import.meta.env.BASE_URL}fabIcon.svg`} alt="" className="h-8 w-8" />
                            <span className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">
                                CedarGuard
                            </span>
                        </Link>
                        <p className="mt-5 max-w-[30ch] text-[13.5px] leading-[1.6] text-[oklch(0.50_0.010_270)] dark:text-slate-400">
                            "AI-Powered Risk and Compliance Platform for UK Social Housing Managers."
                        </p>
                        <div className="mt-6 flex gap-3">
                            <div className="group rounded-lg border border-[oklch(0.91_0.006_270)] bg-white p-3 transition-colors duration-300 hover:border-[oklch(0.62_0.24_278_/_0.30)] dark:border-white/10 dark:bg-white/5">
                                <img src="https://www.cedarproacademy.com/wp-content/uploads/2021/04/gfg-1.png" alt="Accreditation 1" className="h-8 w-auto object-contain opacity-70 mix-blend-multiply transition-opacity group-hover:opacity-100 dark:mix-blend-normal" />
                            </div>
                            <div className="group rounded-lg border border-[oklch(0.91_0.006_270)] bg-white p-3 transition-colors duration-300 hover:border-[oklch(0.62_0.24_278_/_0.30)] dark:border-white/10 dark:bg-white/5">
                                <img src="https://www.cedarproacademy.com/wp-content/uploads/2021/04/Accreditations-affiliations-partnership2-1.jpg" alt="Accreditation 2" className="h-8 w-auto rounded object-contain opacity-70 mix-blend-multiply transition-opacity group-hover:opacity-100 dark:mix-blend-normal" />
                            </div>
                        </div>
                    </div>

                    {/* Platform */}
                    <div>
                        <h4 className="mb-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-[oklch(0.50_0.010_270)] dark:text-slate-500">
                            Platform
                        </h4>
                        <ul className="space-y-2.5">
                            {navLinks.map(l => (
                                <li key={l.href}>
                                    <Link
                                        to={l.href}
                                        className="text-[13.5px] text-[oklch(0.32_0.012_270)] transition-colors duration-150 hover:text-[var(--accent)] dark:text-slate-300 dark:hover:text-indigo-300"
                                    >
                                        {l.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Headquarters */}
                    <div>
                        <h4 className="mb-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-[oklch(0.50_0.010_270)] dark:text-slate-500">
                            Headquarters
                        </h4>
                        <address className="not-italic">
                            <a
                                href="https://maps.app.goo.gl/R64bu5P5Srdh66we9"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block space-y-2.5 text-[13.5px] leading-[1.6] text-[oklch(0.50_0.010_270)] transition-colors duration-150 hover:text-[var(--accent)] dark:text-slate-400 dark:hover:text-indigo-300"
                            >
                                <span className="block">Cedar Guard Ltd</span>
                                <span className="block">10 The New Inn Court</span>
                                <span className="block">54 Matham Road</span>
                                <span className="block">East Molesey,</span>
                                <span className="block">KT8 0BE</span>
                            </a>
                        </address>
                    </div>

                    {/* Connect */}
                    <div>
                        <h4 className="mb-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-[oklch(0.50_0.010_270)] dark:text-slate-500">
                            Connect
                        </h4>
                        <div className="space-y-2.5">
                            <a
                                href="mailto:info@cedarguard.co.uk"
                                className="block break-all text-[13.5px] font-medium text-[oklch(0.20_0.012_270)] transition-colors duration-150 hover:text-[var(--accent)] dark:text-white dark:hover:text-indigo-300"
                            >
                                info@cedarguard.co.uk
                            </a>
                            <a
                                href="tel:+442031433504"
                                className="block text-[13.5px] font-medium text-[oklch(0.20_0.012_270)] tabular-nums transition-colors duration-150 hover:text-[var(--accent)] dark:text-white dark:hover:text-indigo-300"
                            >
                                +44 (0) 2031433504
                            </a>
                        </div>
                    </div>
                </div>

                <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 border-t border-[oklch(0.91_0.006_270)] pt-6 sm:flex-row sm:items-center dark:border-white/10">
                    <p className="text-xs text-[oklch(0.50_0.010_270)] dark:text-slate-500">
                        &copy; 2026 Cedar Property Compliance & Risk Suite.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <span className="cursor-pointer rounded-md border border-[oklch(0.91_0.006_270)] bg-[oklch(0.98_0.004_270)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[oklch(0.50_0.010_270)] transition-colors hover:text-[oklch(0.20_0.012_270)] dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white">
                            Privacy Policy
                        </span>
                        <span className="cursor-pointer rounded-md border border-[oklch(0.91_0.006_270)] bg-[oklch(0.98_0.004_270)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[oklch(0.50_0.010_270)] transition-colors hover:text-[oklch(0.20_0.012_270)] dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white">
                            Terms of Service
                        </span>
                        <span className="rounded-md border border-[oklch(0.62_0.24_278_/_0.25)] bg-[oklch(0.62_0.24_278_/_0.06)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--accent)] dark:text-indigo-300">
                            Pre-market Edition
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    );
};
