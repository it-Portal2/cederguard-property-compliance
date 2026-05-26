import React, { useEffect, useRef, useState } from 'react';
import { loginWithGoogle, sendMagicLink, confirmMagicLink, isMagicLink } from '../lib/firebase';
import { Link, useNavigate } from 'react-router';

// Map Firebase auth error codes to safe, user-facing copy so we never
// leak raw SDK strings (which can hint at internal service state).
const FRIENDLY_AUTH_ERRORS: Record<string, string> = {
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/missing-email': 'Please enter your email address.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/popup-blocked': 'Your browser blocked the sign-in popup. Please allow popups and retry.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/invalid-action-code': 'This sign-in link has expired or already been used. Please request a new one.',
    'auth/expired-action-code': 'This sign-in link has expired. Please request a new one.',
};

const GENERIC_AUTH_ERROR = 'Something went wrong. Please try again.';

function friendlyAuthError(err: unknown): string {
    const code = (err as { code?: string })?.code;
    if (code && FRIENDLY_AUTH_ERRORS[code]) return FRIENDLY_AUTH_ERRORS[code];
    return GENERIC_AUTH_ERROR;
}

const MAGIC_LINK_THROTTLE_MS = 5000;

function isValidEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// Animated count-up used by the marketing-pane mock dashboard tiles.
function useAnimatedNumber(target: number, decimals = 0, startDelay = 0): string {
    const [value, setValue] = useState(0);
    useEffect(() => {
        let raf = 0;
        let start = 0;
        const dur = 900;
        const trigger = window.setTimeout(() => {
            const tick = (now: number) => {
                if (!start) start = now;
                const t = Math.min(1, (now - start) / dur);
                const eased = 1 - Math.pow(1 - t, 3);
                setValue(target * eased);
                if (t < 1) raf = requestAnimationFrame(tick);
                else setValue(target);
            };
            raf = requestAnimationFrame(tick);
        }, startDelay);
        return () => {
            window.clearTimeout(trigger);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [target, startDelay]);
    return value.toFixed(decimals);
}

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isLinkSent, setIsLinkSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [verifyingLink, setVerifyingLink] = useState(false);
    const [requireEmailConfirm, setRequireEmailConfirm] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const lastMagicLinkAt = useRef<number>(0);
    const navigate = useNavigate();

    // Marketing tile animated numbers.
    const t1 = useAnimatedNumber(327, 0, 500);
    const t2 = useAnimatedNumber(53, 0, 500);
    const t3 = useAnimatedNumber(48, 0, 500);
    const t4 = useAnimatedNumber(3.7, 1, 500);

    // Detect magic-link return on mount.
    useEffect(() => {
        if (isMagicLink(window.location.href)) {
            const emailForSignIn = window.localStorage.getItem('emailForSignIn');
            if (emailForSignIn) setEmail(emailForSignIn);
            // Always require an explicit click to confirm — prevents
            // Outlook/Safelinks scanners from burning the one-time token.
            setRequireEmailConfirm(true);
        }
    }, []);

    const trimmedEmail = email.trim().toLowerCase();
    const emailValid = isValidEmail(trimmedEmail);

    const handleGoogleLogin = async () => {
        try {
            setError('');
            setGoogleLoading(true);
            await loginWithGoogle();
        } catch (err: unknown) {
            setError(friendlyAuthError(err));
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleSendMagicLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailValid) {
            setError('Please enter a valid email address.');
            return;
        }

        const now = Date.now();
        const sinceLast = now - lastMagicLinkAt.current;
        if (sinceLast < MAGIC_LINK_THROTTLE_MS) {
            const waitSecs = Math.ceil((MAGIC_LINK_THROTTLE_MS - sinceLast) / 1000);
            setError(`Please wait ${waitSecs}s before resending the link.`);
            return;
        }

        try {
            setLoading(true);
            setError('');
            lastMagicLinkAt.current = now;
            await sendMagicLink(trimmedEmail);
            setIsLinkSent(true);
        } catch (err: unknown) {
            setError(friendlyAuthError(err));
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailValid) {
            setError('Please provide your email for confirmation.');
            return;
        }
        setVerifyingLink(true);
        setError('');
        try {
            await confirmMagicLink(trimmedEmail, window.location.href);
            navigate('/dashboard');
        } catch (err: unknown) {
            setError(friendlyAuthError(err));
        } finally {
            setVerifyingLink(false);
        }
    };

    return (
        <div className="cg-login-root">
            <style>{CSS}</style>
            <div className="shell">
                {/* Form pane */}
                <section className="form-pane">
                    <header>
                        <Link className="brand" to="/">
                            <img
                                src="/logo.png"
                                alt="Cedar – Risk Intelligence & Compliance Platform"
                                className="brand-logo"
                            />
                        </Link>
                    </header>

                    <div className="form-body">
                        <div className="form-card">
                            {verifyingLink ? (
                                <div className="rise">
                                    <span className="eyebrow"><span className="dot"></span> Verifying</span>
                                    <h1 className="title">Confirming your <em>secure link</em></h1>
                                    <p className="subtitle">Hold tight — we’re completing your sign-in.</p>
                                </div>
                            ) : requireEmailConfirm ? (
                                <>
                                    <div className="rise">
                                        <span className="eyebrow"><span className="dot"></span> Secure sign-in</span>
                                        <h1 className="title">Confirm to <em>continue</em></h1>
                                        <p className="subtitle">
                                            We detected a secure sign-in link. Confirm your email to complete sign-in to CedarGuard.
                                        </p>
                                    </div>

                                    <form className="form-card" style={{ gap: '14px', margin: 0 }} onSubmit={handleConfirmEmail}>
                                        <div className="field rise d2">
                                            <label className="label" htmlFor="confirmEmail">Confirm your email</label>
                                            <div className="input-wrap">
                                                <span className="icon-l">
                                                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3.5" width="12" height="9" rx="1.5" /><path d="M2.5 4.5L8 8.5l5.5-4" /></svg>
                                                </span>
                                                <input
                                                    id="confirmEmail"
                                                    className="input"
                                                    type="email"
                                                    placeholder="you@company.com"
                                                    autoComplete="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <button type="submit" className="btn-primary rise d3" disabled={!emailValid || verifyingLink}>
                                            <span>{verifyingLink ? 'Confirming…' : 'Sign in to CedarGuard'}</span>
                                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3.5 8h9M8.5 4l4 4-4 4" /></svg>
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <>
                                    <div className="rise">
                                        <span className="eyebrow"><span className="dot"></span> Welcome</span>
                                        <h1 className="title">Sign in to <em>CedarGuard</em></h1>
                                        <p className="subtitle">
                                            One workspace for compliance, risk and governance across your housing portfolio. Sign in or create your account in seconds.
                                        </p>
                                    </div>

                                    {/* Google CTA — primary path */}
                                    <button className="btn-google rise d1" type="button" onClick={handleGoogleLogin} disabled={googleLoading}>
                                        <span className="g-icon">
                                            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                                                <path fill="#EA4335" d="M9 3.5a5 5 0 0 1 3.5 1.3l2.6-2.5A8.7 8.7 0 0 0 9 0a9 9 0 0 0-8 5l3 2.3A5.3 5.3 0 0 1 9 3.5z" />
                                                <path fill="#34A853" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7l2.9 2.3a8.8 8.8 0 0 0 2.7-6.7z" />
                                                <path fill="#FBBC05" d="M4 10.7a5.4 5.4 0 0 1 0-3.4L1 5A9 9 0 0 0 1 13l3-2.3z" />
                                                <path fill="#4285F4" d="M9 18a8.6 8.6 0 0 0 6-2.2l-2.9-2.3a5.4 5.4 0 0 1-8.1-2.8L1 13a9 9 0 0 0 8 5z" />
                                            </svg>
                                        </span>
                                        <span>{googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}</span>
                                    </button>

                                    <div className="divider-text rise d2">or with email</div>

                                    {isLinkSent ? (
                                        <div className="detect existing rise d2" style={{ marginTop: 0 }}>
                                            <span className="indicator"></span>
                                            <span>
                                                Magic link sent — check <b>{trimmedEmail}</b> for your sign-in link.
                                            </span>
                                        </div>
                                    ) : (
                                        <form className="form-card" style={{ gap: '14px', margin: 0 }} onSubmit={handleSendMagicLink}>
                                            <div className="field rise d2">
                                                <label className="label" htmlFor="email">Work email</label>
                                                <div className="input-wrap">
                                                    <span className="icon-l">
                                                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3.5" width="12" height="9" rx="1.5" /><path d="M2.5 4.5L8 8.5l5.5-4" /></svg>
                                                    </span>
                                                    <input
                                                        id="email"
                                                        className="input"
                                                        type="email"
                                                        placeholder="you@company.com"
                                                        autoComplete="email"
                                                        value={email}
                                                        onChange={(e) => setEmail(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            {emailValid && (
                                                <div className="detect new">
                                                    <span className="indicator"></span>
                                                    <span>
                                                        We’ll send a secure sign-in link to <b>{trimmedEmail}</b>. New here? Your workspace is created automatically.
                                                    </span>
                                                </div>
                                            )}

                                            <button type="submit" className="btn-primary rise d3" disabled={!emailValid || loading}>
                                                <span>{loading ? 'Sending…' : 'Continue with email'}</span>
                                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3.5 8h9M8.5 4l4 4-4 4" /></svg>
                                            </button>

                                            <div className="kbd-hint rise d4">
                                                We’ll send a magic link · no password required · <span className="kbd">↵</span> to submit
                                            </div>

                                            <p className="tos rise d5">
                                                By continuing, you agree to our <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.<br />
                                                New email? We’ll create your account automatically.
                                            </p>
                                        </form>
                                    )}
                                </>
                            )}

                            {error && (
                                <div className="cg-error rise" role="alert">
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6.5" /><path d="M8 5v3.5M8 11h.01" /></svg>
                                    <span>{error}</span>
                                </div>
                            )}
                        </div>
                    </div>

                </section>

                {/* Marketing pane */}
                <aside className="marketing">
                    <div className="mk-top">
                        <span>cedarguard.co.uk</span>
                        <span className="mk-stats">● 99.99% uptime · last 90d</span>
                    </div>

                    <div className="mk-hero">
                        <div className="mk-eyebrow rise"><span className="dot"></span> Building Safety Act · SHDF · ISO 27001</div>
                        <h2 className="mk-headline rise d1">
                            The control tower for <em>social housing compliance</em>, risk and governance.
                        </h2>
                        <p className="mk-sub rise d2">
                            Real-time intelligence across every project, programme and portfolio. Aggregate risk, automate evidence, and surface what your board actually needs to see — before the breach line.
                        </p>

                        <div className="mk-preview rise d3">
                            <div className="mk-preview-head">
                                <span>Portfolio aggregate</span>
                                <span className="pill">● Live</span>
                                <span style={{ marginLeft: 'auto' }}>Updated 2m ago</span>
                            </div>
                            <div className="mk-tiles">
                                <div className="mk-tile">
                                    <div className="lbl">Health</div>
                                    <div className="val">{t1}<small>/327</small></div>
                                </div>
                                <div className="mk-tile danger">
                                    <div className="lbl">Open risks</div>
                                    <div className="val">{t2}</div>
                                </div>
                                <div className="mk-tile warn">
                                    <div className="lbl">Critical</div>
                                    <div className="val">{t3}</div>
                                </div>
                                <div className="mk-tile">
                                    <div className="lbl">Exposure</div>
                                    <div className="val">£{t4}<small>M</small></div>
                                </div>
                            </div>
                            <div className="mk-chart">
                                <div className="mk-chart-head">
                                    <span>Risk outlook · next 90 days</span>
                                    <span className="legend">
                                        <span><i style={{ background: 'oklch(0.66 0.21 25)' }}></i>Do nothing</span>
                                        <span><i style={{ background: 'oklch(0.62 0.24 278)' }}></i>Mitigated</span>
                                    </span>
                                </div>
                                <svg viewBox="0 0 360 80" preserveAspectRatio="none" style={{ width: '100%', height: '80px', display: 'block' }}>
                                    <defs>
                                        <linearGradient id="bd1" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="oklch(0.66 0.21 25)" stopOpacity="0.4" />
                                            <stop offset="100%" stopColor="oklch(0.66 0.21 25)" stopOpacity="0" />
                                        </linearGradient>
                                        <linearGradient id="bd2" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="oklch(0.62 0.24 278)" stopOpacity="0.45" />
                                            <stop offset="100%" stopColor="oklch(0.62 0.24 278)" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <line x1="0" x2="360" y1="20" y2="20" stroke="oklch(1 0 0 / 0.05)" strokeDasharray="2 3" />
                                    <line x1="0" x2="360" y1="40" y2="40" stroke="oklch(1 0 0 / 0.05)" strokeDasharray="2 3" />
                                    <line x1="0" x2="360" y1="60" y2="60" stroke="oklch(1 0 0 / 0.05)" strokeDasharray="2 3" />
                                    <line x1="0" x2="360" y1="48" y2="48" stroke="oklch(0.78 0.20 25)" strokeWidth="1" strokeDasharray="4 3" />
                                    <text x="356" y="44" textAnchor="end" fontFamily="Geist Mono" fontSize="8" fill="oklch(0.85 0.15 25)">BREACH</text>
                                    <path d="M0 22 C40 26, 80 24, 120 32 S200 38, 240 42 320 48, 360 56" fill="none" stroke="oklch(0.66 0.21 25)" strokeWidth="1.6" strokeLinecap="round" />
                                    <path d="M0 22 C40 26, 80 24, 120 32 S200 38, 240 42 320 48, 360 56 L360 80 L0 80 Z" fill="url(#bd1)" />
                                    <path d="M0 22 C30 28, 60 42, 100 52 S180 64, 240 68 320 70, 360 72" fill="none" stroke="oklch(0.62 0.24 278)" strokeWidth="2" strokeLinecap="round" />
                                    <path d="M0 22 C30 28, 60 42, 100 52 S180 64, 240 68 320 70, 360 72 L360 80 L0 80 Z" fill="url(#bd2)" />
                                    <circle cx="360" cy="56" r="2.5" fill="oklch(0.66 0.21 25)" />
                                    <circle cx="360" cy="72" r="2.5" fill="oklch(0.62 0.24 278)" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="mk-quote rise d4">
                        <div className="avatar"></div>
                        <div>
                            <p>“CedarGuard collapsed three spreadsheets and a fortnightly compliance call into a dashboard our board actually opens.”</p>
                            <div className="cite">Sarah Henley · Director of Programme Assurance · Greater London Housing</div>
                        </div>
                    </div>

                </aside>
            </div>
        </div>
    );
};

const CSS = `
.cg-login-root {
  --accent: oklch(0.62 0.24 278);
  --accent-hot: oklch(0.70 0.26 280);
  --accent-glow: oklch(0.62 0.24 278 / 0.22);
  --accent-fg: #fff;

  --ok: oklch(0.72 0.16 155);
  --warn: oklch(0.78 0.15 78);
  --danger: oklch(0.66 0.21 25);

  --bg: oklch(0.985 0.003 270);
  --bg-elev: #fff;
  --panel-2: oklch(0.98 0.004 270);
  --hover: oklch(0.96 0.005 270);
  --border: oklch(0.91 0.006 270);
  --border-strong: oklch(0.85 0.008 270);
  --fg: oklch(0.20 0.012 270);
  --fg-2: oklch(0.32 0.012 270);
  --muted: oklch(0.50 0.010 270);
  --faint: oklch(0.68 0.010 270);

  --ease: cubic-bezier(.22,.61,.36,1);
  --t-fast: 140ms;
  --font-sans: "Geist", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--fg);
  font-feature-settings: "ss01", "cv11", "tnum";
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  min-height: 100vh;
}
.cg-login-root * { box-sizing: border-box; }
.cg-login-root button { font-family: inherit; cursor: pointer; }
.cg-login-root input { font-family: inherit; }
.cg-login-root ::selection { background: var(--accent-glow); color: var(--fg); }

.cg-login-root .shell {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--bg);
}

@media (max-width: 1100px) {
  .cg-login-root .shell { grid-template-columns: 1fr 0.85fr; }
  .cg-login-root .form-pane { padding: 24px 32px; }
  .cg-login-root .marketing { padding: 24px 28px; }
  .cg-login-root .mk-headline { font-size: 32px; }
  .cg-login-root .mk-sub { font-size: 13.5px; }
  .cg-login-root .mk-preview { display: none; }
  .cg-login-root .mk-logos { padding-top: 14px; }
  .cg-login-root .mk-logos-row { gap: 14px; }
  .cg-login-root .mk-logos-row > div { font-size: 12px; }
}

@media (max-width: 880px) {
  .cg-login-root .shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  .cg-login-root .marketing {
    padding: 18px 20px 22px;
    min-height: auto;
  }
  .cg-login-root .marketing::after { width: 280px; height: 280px; right: -100px; top: -100px; }
  .cg-login-root .mk-hero { padding: 14px 0 0; max-width: none; }
  .cg-login-root .mk-eyebrow { margin-bottom: 10px; font-size: 10px; }
  .cg-login-root .mk-headline { font-size: 22px; }
  .cg-login-root .mk-sub { display: none; }
  .cg-login-root .mk-quote, .cg-login-root .mk-logos { display: none; }
  .cg-login-root .form-pane { padding: 22px 24px 28px; }
  .cg-login-root .form-body { padding: 16px 0; }
  .cg-login-root .form-card { max-width: none; }
}

@media (max-width: 560px) {
  .cg-login-root .marketing { padding: 14px 18px 18px; }
  .cg-login-root .mk-top { font-size: 11px; }
  .cg-login-root .mk-stats { font-size: 10px; padding: 4px 8px; }
  .cg-login-root .mk-headline { font-size: 20px; letter-spacing: -0.025em; }
  .cg-login-root .form-pane { padding: 18px 18px 22px; }
  .cg-login-root .form-pane header { gap: 8px; flex-wrap: wrap; }
  .cg-login-root .helpline { font-size: 11.5px; }
  .cg-login-root .form-card { gap: 18px; }
  .cg-login-root h1.title { font-size: 26px; margin: 10px 0 8px; }
  .cg-login-root .subtitle { font-size: 13px; }
  .cg-login-root .btn-google, .cg-login-root .btn-primary { height: 48px; font-size: 14px; }
  .cg-login-root .input { height: 48px; font-size: 15px; }
  .cg-login-root .form-foot { flex-direction: column; align-items: flex-start; gap: 10px; }
  .cg-login-root .legal-chips { flex-wrap: wrap; }
}

@media (max-width: 380px) {
  .cg-login-root .marketing { display: none; }
  .cg-login-root .shell { grid-template-rows: 1fr; }
  .cg-login-root .form-pane header { flex-direction: column; align-items: flex-start; }
}

.cg-login-root .form-pane {
  display: flex; flex-direction: column;
  padding: 28px 40px;
  position: relative;
  min-height: 100vh;
}
.cg-login-root .form-pane header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px;
}
.cg-login-root .brand {
  display: inline-flex; align-items: center;
  text-decoration: none;
  color: var(--fg);
}
.cg-login-root .brand-logo {
  height: 44px;
  width: auto;
  max-width: 200px;
  object-fit: contain;
  display: block;
}

.cg-login-root .helpline {
  font-size: 12.5px; color: var(--muted);
  display: inline-flex; align-items: center; gap: 6px;
}
.cg-login-root .helpline a {
  color: var(--fg);
  font-weight: 500;
  text-decoration: none;
  border-bottom: 1px dashed var(--border-strong);
  padding-bottom: 1px;
}
.cg-login-root .helpline a:hover { color: var(--accent); border-color: var(--accent); }

.cg-login-root .form-body {
  flex: 1;
  display: grid; place-items: center;
  padding: 24px 0;
}
.cg-login-root .form-card {
  width: 100%;
  max-width: 408px;
  display: flex; flex-direction: column;
  gap: 24px;
}

.cg-login-root .eyebrow {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  font-weight: 500;
  display: inline-flex; align-items: center; gap: 8px;
}
.cg-login-root .eyebrow .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px oklch(from var(--accent) l c h / 0.18);
  animation: cg-pulse 2.4s ease-out infinite;
}
@keyframes cg-pulse {
  0%, 100% { box-shadow: 0 0 0 3px oklch(from var(--accent) l c h / 0.18); }
  50% { box-shadow: 0 0 0 7px oklch(from var(--accent) l c h / 0.02); }
}

.cg-login-root h1.title {
  font-size: 32px;
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1.08;
  margin: 12px 0 10px;
  color: var(--fg);
}
.cg-login-root h1.title em {
  font-style: normal;
  background: linear-gradient(135deg, var(--accent), oklch(from var(--accent) calc(l - 0.12) calc(c + 0.04) calc(h - 16)));
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
.cg-login-root .subtitle {
  font-size: 13.5px;
  color: var(--muted);
  line-height: 1.55;
  margin: 0;
  max-width: 38ch;
}

.cg-login-root .btn-google {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%; height: 48px;
  font-size: 14px; font-weight: 500;
  background: var(--bg-elev);
  color: var(--fg);
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
  position: relative;
  overflow: hidden;
}
.cg-login-root .btn-google:hover {
  background: var(--hover);
  border-color: var(--fg-2);
  transform: translateY(-1px);
  box-shadow: 0 8px 20px -10px oklch(0 0 0 / 0.18);
}
.cg-login-root .btn-google:active { transform: translateY(0); }
.cg-login-root .btn-google::after {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(110deg, transparent 30%, oklch(from var(--accent) l c h / 0.06) 50%, transparent 70%);
  transform: translateX(-100%);
  transition: transform 700ms var(--ease);
}
.cg-login-root .btn-google:hover::after { transform: translateX(100%); }
.cg-login-root .btn-google:disabled { opacity: 0.7; cursor: not-allowed; }
.cg-login-root .btn-google .g-icon {
  width: 18px; height: 18px;
  display: grid; place-items: center;
}

.cg-login-root .divider-text {
  display: flex; align-items: center; gap: 10px;
  font-family: var(--font-mono);
  font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--faint);
}
.cg-login-root .divider-text::before, .cg-login-root .divider-text::after {
  content: ""; flex: 1; height: 1px;
  background: var(--border);
}

.cg-login-root .field { display: flex; flex-direction: column; gap: 6px; }
.cg-login-root .label {
  font-size: 12px; font-weight: 500;
  color: var(--fg-2);
  display: flex; align-items: center; justify-content: space-between;
}

.cg-login-root .input-wrap { position: relative; display: flex; align-items: center; }
.cg-login-root .input-wrap > .icon-l {
  position: absolute; left: 13px;
  color: var(--muted);
  pointer-events: none;
}
.cg-login-root .input {
  width: 100%; height: 46px;
  padding: 0 14px 0 40px;
  font-size: 14px;
  color: var(--fg);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 10px;
  outline: none;
  transition: all var(--t-fast) var(--ease);
}
.cg-login-root .input:hover { border-color: var(--border-strong); }
.cg-login-root .input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px oklch(from var(--accent) l c h / 0.14);
}
.cg-login-root .input::placeholder { color: var(--faint); }

.cg-login-root .btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; height: 46px;
  font-size: 14px; font-weight: 500;
  background: var(--accent);
  color: var(--accent-fg);
  border: 1px solid oklch(from var(--accent) calc(l - 0.08) c h);
  border-radius: 10px;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
  position: relative;
  overflow: hidden;
  box-shadow:
    0 0 0 1px oklch(from var(--accent) calc(l - 0.10) c h) inset,
    0 8px 22px -10px var(--accent-glow);
}
.cg-login-root .btn-primary:hover {
  background: var(--accent-hot);
  box-shadow:
    0 0 0 1px oklch(from var(--accent) calc(l - 0.08) c h) inset,
    0 12px 28px -10px var(--accent-glow);
}
.cg-login-root .btn-primary::after {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(110deg, transparent 30%, oklch(1 0 0 / 0.18) 50%, transparent 70%);
  transform: translateX(-100%);
  transition: transform 600ms var(--ease);
}
.cg-login-root .btn-primary:hover::after { transform: translateX(100%); }
.cg-login-root .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.cg-login-root .kbd-hint {
  font-size: 11.5px; color: var(--muted);
  display: inline-flex; align-items: center; gap: 6px;
  justify-content: center;
}
.cg-login-root .kbd {
  font-family: var(--font-mono); font-size: 10px;
  padding: 2px 5px; border-radius: 4px;
  background: var(--panel-2); border: 1px solid var(--border);
  color: var(--fg-2);
  line-height: 1;
}

.cg-login-root .detect {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--fg-2);
  margin-top: -8px;
}
.cg-login-root .detect .indicator { width: 6px; height: 6px; border-radius: 6px; flex-shrink: 0; }
.cg-login-root .detect.new .indicator { background: var(--accent); box-shadow: 0 0 0 3px oklch(from var(--accent) l c h / 0.18); }
.cg-login-root .detect.existing .indicator { background: var(--ok); box-shadow: 0 0 0 3px oklch(from var(--ok) l c h / 0.18); }
.cg-login-root .detect b { color: var(--fg); font-weight: 500; }

.cg-login-root .cg-error {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  background: oklch(from var(--danger) l c h / 0.08);
  border: 1px solid oklch(from var(--danger) l c h / 0.30);
  border-radius: 8px;
  font-size: 12.5px;
  color: oklch(from var(--danger) calc(l - 0.12) c h);
  margin-top: 4px;
}

.cg-login-root .form-foot {
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px;
  font-size: 12px; color: var(--muted);
  padding-top: 18px;
}
.cg-login-root .form-foot a { color: var(--fg-2); text-decoration: none; }
.cg-login-root .form-foot a:hover { color: var(--accent); }
.cg-login-root .legal-chips { display: inline-flex; gap: 6px; }
.cg-login-root .legal-chips span {
  font-family: var(--font-mono);
  font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--muted);
  padding: 3px 7px; border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--panel-2);
}

.cg-login-root .tos {
  font-size: 11.5px; color: var(--muted); text-align: center;
  line-height: 1.55;
}
.cg-login-root .tos a { color: var(--fg-2); text-decoration: none; border-bottom: 1px dashed var(--border-strong); }
.cg-login-root .tos a:hover { color: var(--accent); border-color: var(--accent); }

.cg-login-root .marketing {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(110% 70% at 0% 0%, oklch(from var(--accent) l c h / 0.18), transparent 55%),
    radial-gradient(80% 60% at 100% 100%, oklch(from var(--accent) calc(l + 0.06) c calc(h - 30) / 0.12), transparent 50%),
    linear-gradient(180deg, oklch(0.18 0.018 270), oklch(0.13 0.012 270));
  color: #fff;
  padding: 28px 36px;
  display: flex; flex-direction: column;
}
.cg-login-root .marketing::before {
  content: "";
  position: absolute; inset: 0;
  background-image:
    linear-gradient(oklch(1 0 0 / 0.04) 1px, transparent 1px),
    linear-gradient(90deg, oklch(1 0 0 / 0.04) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: radial-gradient(120% 80% at 50% 30%, #000 30%, transparent 80%);
  -webkit-mask-image: radial-gradient(120% 80% at 50% 30%, #000 30%, transparent 80%);
  pointer-events: none;
}
.cg-login-root .marketing::after {
  content: "";
  position: absolute;
  right: -160px; top: -140px;
  width: 460px; height: 460px; border-radius: 50%;
  background: radial-gradient(closest-side, oklch(from var(--accent) l c h / 0.55), transparent 70%);
  filter: blur(40px);
  pointer-events: none;
}

.cg-login-root .mk-top {
  display: flex; justify-content: space-between; align-items: center;
  position: relative; z-index: 2;
  color: oklch(1 0 0 / 0.6);
  font-size: 12px;
}
.cg-login-root .mk-stats {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px;
  background: oklch(1 0 0 / 0.06);
  border: 1px solid oklch(1 0 0 / 0.12);
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 11px; letter-spacing: 0.04em;
  color: oklch(1 0 0 / 0.85);
}

.cg-login-root .mk-hero {
  flex: 1;
  display: flex; flex-direction: column; justify-content: center;
  position: relative; z-index: 2;
  padding: 30px 0;
  max-width: 540px;
}
.cg-login-root .mk-eyebrow {
  font-family: var(--font-mono);
  font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
  color: oklch(from var(--accent) calc(l + 0.18) c h);
  margin-bottom: 18px;
  display: inline-flex; align-items: center; gap: 8px;
}
.cg-login-root .mk-eyebrow .dot {
  width: 6px; height: 6px; border-radius: 6px;
  background: oklch(from var(--accent) calc(l + 0.18) c h);
  box-shadow: 0 0 12px oklch(from var(--accent) calc(l + 0.18) c h);
}

.cg-login-root .mk-headline {
  font-size: 40px;
  font-weight: 500;
  letter-spacing: -0.035em;
  line-height: 1.05;
  margin: 0;
  color: #fff;
  text-wrap: balance;
}
.cg-login-root .mk-headline em {
  font-style: normal;
  background: linear-gradient(135deg, oklch(0.85 0.04 270), oklch(from var(--accent) calc(l + 0.22) c h));
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
.cg-login-root .mk-sub {
  font-size: 14.5px;
  line-height: 1.6;
  color: oklch(1 0 0 / 0.7);
  margin-top: 18px;
  max-width: 46ch;
}

.cg-login-root .mk-preview {
  margin-top: 28px;
  position: relative;
  padding: 14px;
  background: linear-gradient(180deg, oklch(1 0 0 / 0.05), oklch(1 0 0 / 0.02));
  border: 1px solid oklch(1 0 0 / 0.10);
  border-radius: 14px;
  box-shadow:
    0 30px 60px -20px oklch(0 0 0 / 0.5),
    inset 0 1px 0 oklch(1 0 0 / 0.06);
}
.cg-login-root .mk-preview-head {
  display: flex; align-items: center; gap: 10px;
  font-family: var(--font-mono);
  font-size: 10.5px; color: oklch(1 0 0 / 0.55);
  letter-spacing: 0.06em; text-transform: uppercase;
  margin-bottom: 10px; padding: 0 4px;
}
.cg-login-root .mk-preview-head .pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 7px;
  background: oklch(from var(--accent) l c h / 0.18);
  border: 1px solid oklch(from var(--accent) l c h / 0.30);
  border-radius: 4px;
  color: oklch(from var(--accent) calc(l + 0.20) c h);
}
.cg-login-root .mk-tiles {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  margin-bottom: 10px;
}
.cg-login-root .mk-tile {
  padding: 10px 12px;
  background: oklch(1 0 0 / 0.04);
  border: 1px solid oklch(1 0 0 / 0.08);
  border-radius: 9px;
}
.cg-login-root .mk-tile .lbl {
  font-family: var(--font-mono);
  font-size: 9.5px; color: oklch(1 0 0 / 0.5);
  letter-spacing: 0.05em; text-transform: uppercase;
  margin-bottom: 6px;
}
.cg-login-root .mk-tile .val {
  font-size: 18px; font-weight: 500; letter-spacing: -0.025em;
  color: #fff;
}
.cg-login-root .mk-tile .val small { font-size: 11px; color: oklch(1 0 0 / 0.5); margin-left: 2px; }
.cg-login-root .mk-tile.danger .val { color: oklch(0.78 0.20 25); }
.cg-login-root .mk-tile.warn   .val { color: oklch(0.85 0.15 78); }

.cg-login-root .mk-chart {
  padding: 10px 12px;
  background: oklch(1 0 0 / 0.04);
  border: 1px solid oklch(1 0 0 / 0.08);
  border-radius: 9px;
}
.cg-login-root .mk-chart-head {
  display: flex; align-items: center; justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 10px; color: oklch(1 0 0 / 0.55);
  letter-spacing: 0.05em; text-transform: uppercase;
  margin-bottom: 6px;
}
.cg-login-root .mk-chart-head .legend {
  display: inline-flex; align-items: center; gap: 10px; text-transform: none;
}
.cg-login-root .mk-chart-head .legend i {
  display: inline-block; width: 7px; height: 7px; border-radius: 2px;
  margin-right: 4px; vertical-align: middle;
}

.cg-login-root .mk-logos {
  margin-top: auto;
  padding-top: 22px;
  position: relative; z-index: 2;
}
.cg-login-root .mk-logos .label {
  font-family: var(--font-mono);
  font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color: oklch(1 0 0 / 0.4);
  margin-bottom: 14px;
}
.cg-login-root .mk-logos-row {
  display: grid; grid-template-columns: repeat(4, 1fr);
  align-items: center;
  gap: 22px;
  color: oklch(1 0 0 / 0.55);
}
.cg-login-root .mk-logos-row > div { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; letter-spacing: -0.02em; }

.cg-login-root .mk-quote {
  position: relative; z-index: 2;
  margin-top: 22px;
  padding: 16px 18px;
  background: oklch(1 0 0 / 0.04);
  border: 1px solid oklch(1 0 0 / 0.10);
  border-radius: 12px;
  display: grid; grid-template-columns: 36px 1fr; gap: 12px; align-items: start;
}
.cg-login-root .mk-quote .avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: linear-gradient(135deg, oklch(0.7 0.13 60), oklch(0.55 0.17 25));
}
.cg-login-root .mk-quote p {
  font-size: 13.5px; line-height: 1.55;
  color: oklch(1 0 0 / 0.85);
  margin: 0 0 6px;
  font-weight: 400;
}
.cg-login-root .mk-quote .cite {
  font-family: var(--font-mono);
  font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase;
  color: oklch(1 0 0 / 0.5);
}

@keyframes cg-rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.cg-login-root .rise { animation: cg-rise 520ms var(--ease) both; }
.cg-login-root .rise.d1 { animation-delay: 60ms; }
.cg-login-root .rise.d2 { animation-delay: 120ms; }
.cg-login-root .rise.d3 { animation-delay: 180ms; }
.cg-login-root .rise.d4 { animation-delay: 240ms; }
.cg-login-root .rise.d5 { animation-delay: 300ms; }

.cg-login-root button:focus-visible,
.cg-login-root input:focus-visible,
.cg-login-root a:focus-visible {
  outline: 2px solid oklch(from var(--accent) l c h / 0.55);
  outline-offset: 2px;
}
`;
