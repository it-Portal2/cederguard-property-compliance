import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, Save, Loader2, Key, Trash2, AlertTriangle, BellRing } from 'lucide-react';
import { useNavigate } from 'react-router';
import { authBridge } from '../lib/auth/authBridge';
import { useStore } from '../store/useStore';
import { useAccessRequestStore } from '../store/accessRequestStore';
import { SignatureUpload } from '../features/governance/components/branding/SignatureUpload';

interface ProfileSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ProfileSettingsModal({ isOpen, onClose }: ProfileSettingsModalProps) {
    const [profile, setProfile] = useState({
        companyName: '',
        jobTitle: '',
        contactPhone: '',
        geminiBackupKey: '',
        // chase notification opt-out. Default opt-IN
        // (true) so existing users keep getting chases.
        chaseEnabled: true,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const navigate = useNavigate();
    const setUser = useStore(state => state.setUser);
    const user = useStore(state => state.user);

    useEffect(() => {
        if (isOpen) {
            loadProfile();
        }
    }, [isOpen]);

    const loadProfile = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            const res = await api.getProfile();
            if (res.profile) {
                setProfile({
                    companyName: res.profile.companyName || '',
                    jobTitle: res.profile.jobTitle || '',
                    contactPhone: res.profile.contactPhone || '',
                    geminiBackupKey: res.profile.geminiBackupKey || '',
                    chaseEnabled:
                        res.profile.notificationPreferences?.chase !== false,
                });
            }
        } catch (error) {
            console.error('Failed to load profile', error);
            setMessage({ type: 'error', text: 'Failed to load profile settings.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if ((user?.role || user?.profile?.role) === 'viewer') {
            useAccessRequestStore.getState().open('saveProfile');
            return;
        }
        setIsSaving(true);
        setMessage(null);
        try {
            // fold the local `chaseEnabled` toggle back into
            // the canonical `notificationPreferences.chase` shape that
            // `governanceCron.ts` reads.
            const payload = {
                companyName: profile.companyName,
                jobTitle: profile.jobTitle,
                contactPhone: profile.contactPhone,
                geminiBackupKey: profile.geminiBackupKey,
                notificationPreferences: { chase: profile.chaseEnabled },
            };
            await api.saveProfile(payload);
            setMessage({ type: 'success', text: 'Profile settings saved successfully.' });
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (error) {
            console.error('Failed to save profile', error);
            setMessage({ type: 'error', text: 'Failed to save settings.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        setMessage(null);
        try {
            await api.deleteUserAccount();
            setMessage({ type: 'success', text: 'Account deleted successfully. Logging out...' });
            setTimeout(async () => {
                await authBridge.signOut();
                setUser(null);
                onClose();
                navigate('/login');
            }, 1000);
        } catch (error: any) {
            console.error('Failed to delete account:', error);
            setMessage({ type: 'error', text: error.message || 'Failed to delete account. Please try again.' });
            setIsDeleting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-lg shadow-2xl w-full md:max-w-2xl lg:max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 self-center">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Profile Settings</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Manage your personal and professional information</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-bold text-slate-700">Company / Organization</label>
                                    <input
                                        type="text"
                                        value={profile.companyName}
                                        onChange={(e) => setProfile(p => ({ ...p, companyName: e.target.value }))}
                                        placeholder="Cedar Group Ltd"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-bold text-slate-700">Job Title</label>
                                    <input
                                        type="text"
                                        value={profile.jobTitle}
                                        onChange={(e) => setProfile(p => ({ ...p, jobTitle: e.target.value }))}
                                        placeholder="Principal Developer"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-1.5">
                                    <label className="block text-sm font-bold text-slate-700">Contact Phone</label>
                                    <input
                                        type="text"
                                        value={profile.contactPhone}
                                        onChange={(e) => setProfile(p => ({ ...p, contactPhone: e.target.value }))}
                                        placeholder="+44 20 7123 4567"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>
                            </div>

                            <hr className="border-slate-100 my-2" />

                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <Key className="w-4 h-4 text-slate-400" />
                                    Gemini API Backup Key
                                </label>
                                <p className="text-xs text-slate-500">
                                    Provide your own Gemini API key as a fallback in case the system's quota is exceeded. This is stored securely in your private profile.
                                </p>
                                <div className="relative group">
                                    <input
                                        type={showGeminiKey ? "text" : "password"}
                                        value={profile.geminiBackupKey}
                                        onChange={(e) => setProfile(p => ({ ...p, geminiBackupKey: e.target.value }))}
                                        placeholder="AIzaSy..."
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-mono tracking-wider pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    >
                                        {showGeminiKey ? <X className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Chase notification opt-out */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                    <BellRing className="w-4 h-4 text-slate-400" />
                                    Chase notifications
                                </label>
                                <p className="text-xs text-slate-500">
                                    Governance chase reminders fire 72h / 24h / at-deadline + escalate after 24h. Turn off if you'd rather rely on dashboard signals only — every chase is still recorded in the audit log.
                                </p>
                                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={profile.chaseEnabled}
                                        onChange={(e) =>
                                            setProfile((p) => ({
                                                ...p,
                                                chaseEnabled: e.target.checked,
                                            }))
                                        }
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                    Send me chase notifications
                                </label>
                            </div>

                            {message && (
                                <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {message.text}
                                </div>
                            )}

                            <hr className="border-slate-100 my-2" />

                            <SignatureUpload />

                            <hr className="border-slate-100 my-4" />

                            <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                                <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2 mb-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    Danger Zone
                                </h3>
                                <p className="text-xs text-red-600 mb-4 font-medium">
                                    Permanently delete your account and erase all associated data, files, and project contributions. This action is final and cannot be undone.
                                </p>
                                
                                {!showDeleteConfirm ? (
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="px-4 py-2 bg-white text-red-600 border border-red-200 text-sm font-medium rounded-md hover:bg-red-50 transition-colors flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete Account
                                    </button>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-sm font-medium text-red-800">Are you absolutely sure?</p>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button
                                                onClick={handleDeleteAccount}
                                                disabled={isDeleting}
                                                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                                                Yes, Delete My Account
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteConfirm(false)}
                                                disabled={isDeleting}
                                                className="px-4 py-2 bg-white text-slate-700 border border-slate-300 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || isSaving}
                        className="px-8 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
