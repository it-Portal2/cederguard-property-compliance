// First-run setup wizard shown when a freshly installed CedarGuard desktop
// app launches with no saved config.
//
// Step 1 (M1): backend chooser — Firebase (enabled) vs Microsoft Azure
// (disabled "Coming soon"). Choosing Firebase calls onComplete(); the App
// shell (src/App.tsx) writes the config via IPC and transitions to the
// Login page.
//
// Future milestones will reuse this wizard component and unlock the Azure
// branch (multi-step form for tenant ID, client ID, API base URL, etc.).

import { useState } from 'react';
import { Cloud, Building2 } from 'lucide-react';
import BackendChooserCard from './BackendChooserCard';

export interface FirstRunWizardProps {
  onComplete: (backend: 'firebase') => void | Promise<void>;
}

export default function FirstRunWizard({ onComplete }: FirstRunWizardProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChooseFirebase = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onComplete('firebase');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-12">
        <div className="mb-10 text-center">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="CedarGuard"
            className="mx-auto h-12 w-auto object-contain"
          />
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Welcome to CedarGuard Desktop
          </h1>
          <p className="mt-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
            Step 1 of 1 · Choose your backend
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            CedarGuard can run on two different cloud backends. Pick the one
            your organisation uses. You'll only need to do this once on this
            machine.
          </p>
        </div>

        <div className="grid w-full gap-6 md:grid-cols-2">
          <BackendChooserCard
            title="Google / Firebase"
            subtitle="Commercial · Recommended"
            description="Connect to the standard CedarGuard cloud, hosted on Firebase + Vercel. Used by all commercial customers."
            bullets={[
              'Hosted on Google Cloud (UK + EU regions)',
              'Sign in with your Google work account',
              'Same data your team already uses on the web',
            ]}
            icon={<Cloud className="h-6 w-6" />}
            enabled={!submitting}
            badge={{ label: 'Recommended', tone: 'recommended' }}
            onChoose={handleChooseFirebase}
          />

          <BackendChooserCard
            title="Microsoft Azure"
            subtitle="Government · Coming soon"
            description="On-premises-style Azure deployment for UK Government customers. Requires Azure provisioning by your IT team."
            bullets={[
              'Microsoft Entra External ID (work accounts)',
              'Azure Cosmos DB + Blob Storage (UK regions)',
              'Cyber Essentials Plus / OFFICIAL tier',
            ]}
            icon={<Building2 className="h-6 w-6" />}
            enabled={false}
            badge={{ label: 'Coming soon', tone: 'coming-soon' }}
          />
        </div>

        {error && (
          <p className="mt-6 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        {submitting && (
          <p className="mt-6 font-mono uppercase tracking-wide text-[11px] text-slate-500">
            Saving setup…
          </p>
        )}

        <p className="mt-12 max-w-xl text-center text-xs text-slate-500 dark:text-slate-500">
          By continuing, you agree to CedarGuard's terms of service and privacy
          policy. Your choice is stored encrypted on this device only.
        </p>
      </div>
    </div>
  );
}
