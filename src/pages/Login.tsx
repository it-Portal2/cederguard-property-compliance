import React, { useState } from 'react';
import { loginWithGoogle, sendMagicLink, confirmMagicLink, isMagicLink } from '../lib/firebase';
import { Building2, ShieldCheck, Mail, AlertCircle, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isLinkSent, setIsLinkSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [verifyingLink, setVerifyingLink] = useState(false);
    const [requireEmailConfirm, setRequireEmailConfirm] = useState(false);
    const navigate = useNavigate();

    // Effect to handle sign-in link returning
    React.useEffect(() => {
        const checkMagicLink = () => {
            if (isMagicLink(window.location.href)) {
                let emailForSignIn = window.localStorage.getItem('emailForSignIn');
                if (emailForSignIn) {
                    setEmail(emailForSignIn);
                }
                // ALWAYS require a click to confirm for magic links
                // This prevents automated scanners (like Outlook Safelinks) from 
                // consuming the one-time-use token before the user clicks it.
                setRequireEmailConfirm(true);
            }
        };

        checkMagicLink();
    }, [navigate]);

    const handleGoogleLogin = async () => {
        try {
            setError('');
            setLoading(true);
            await loginWithGoogle();
        } catch (err: any) {
            setError(err.message || "Failed to log in with Google");
        } finally {
            setLoading(false);
        }
    };

    const handleSendMagicLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !email.includes('@')) {
            setError('Please enter a valid email address.');
            return;
        }

        try {
            setLoading(true);
            setError('');
            await sendMagicLink(email);
            setIsLinkSent(true);
        } catch (err: any) {
            setError(err.message || "Failed to send login link.");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError('Please provide your email for confirmation.');
            return;
        }
        setVerifyingLink(true);
        setError('');
        try {
            await confirmMagicLink(email, window.location.href);
            navigate('/dashboard');
        } catch (err: any) {
            setError('Error confirming magic link: ' + err.message);
        } finally {
            setVerifyingLink(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center flex-col items-center relative">
                    <Link to="/" className="absolute -left-4 sm:left-0 top-0 text-slate-500 hover:text-slate-900 flex items-center justify-center bg-white p-2 rounded-full shadow-sm border border-slate-100 transition-all hover:shadow-md">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="sr-only">Back to Home</span>
                    </Link>
                    <h2 className="mt-2 text-center text-3xl font-extrabold text-slate-900">
                        Cedar Risk Suite
                    </h2>
                    <p className="mt-2 text-center text-sm text-slate-600">
                        Sign in to access your compliance and risk management dashboard.
                    </p>
                </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border border-slate-100">
                    
                    {verifyingLink ? (
                        <div className="text-center py-6">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                            <p className="mt-4 text-sm text-slate-600 font-medium">Verifying your secure link...</p>
                        </div>
                    ) : requireEmailConfirm ? (
                        <form onSubmit={handleConfirmEmail} className="space-y-4">
                            <div className="bg-indigo-50 text-indigo-700 p-4 rounded-xl text-sm mb-6 border border-indigo-100 flex items-start gap-3">
                                <ShieldCheck className="w-5 h-5 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-bold mb-1">Secure Sign-In Detected</p>
                                    <p className="text-indigo-600 opacity-90">Please confirm your email address to complete your secure sign-in to the Cedar Risk Suite.</p>
                                </div>
                            </div>
                            
                            <div>
                                <label htmlFor="confirmEmail" className="block text-sm font-bold text-slate-700 mb-1">Confirm Email Address</label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        id="confirmEmail"
                                        type="email"
                                        required
                                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-3 border text-slate-900"
                                        placeholder="you@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading || verifyingLink}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {verifyingLink ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Confirming...</span>
                                    </div>
                                ) : (
                                    "Sign In to Cedar Risk Suite"
                                )}
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-6">
                            {isLinkSent ? (
                                <div className="text-center py-4 bg-emerald-50 rounded-xl border border-emerald-100 animate-in fade-in slide-in-from-bottom-2">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                                    <h3 className="text-sm font-black text-emerald-800 uppercase tracking-widest">Magic Link Sent!</h3>
                                    <p className="text-sm text-emerald-600 mt-1 max-w-[250px] mx-auto font-medium">
                                        We sent an email to <strong className="text-emerald-800">{email}</strong>. Click the link inside to sign in without a password.
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={handleSendMagicLink} className="space-y-4">
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-bold text-slate-700">Email Address</label>
                                        <div className="mt-1 relative rounded-md shadow-sm">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Mail className="h-4 w-4 text-slate-400" />
                                            </div>
                                            <input
                                                id="email"
                                                type="email"
                                                required
                                                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2.5 border text-slate-900"
                                                placeholder="you@company.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all font-semibold"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                    </button>
                                </form>
                            )}

                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white text-slate-500 font-medium">Or continue with Google</span>
                                </div>
                            </div>

                            <button
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full flex justify-center items-center gap-3 py-2.5 px-4 border border-slate-300 rounded-md shadow-sm bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                ) : null}
                                {loading ? 'Checking session...' : 'Sign in with Google'}
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
                            <AlertCircle className="w-4 h-4" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
