import { LogoUpload } from './LogoUpload';
import { StampManager } from './StampManager';

// Wraps the two council-level branding panels for the WorkspaceSettings
// "Branding" tab. The user signature lives in ProfileSettings (per-user),
// not here.
export function BrandingTab() {
  return (
    <div className="space-y-5">
      <LogoUpload />
      <StampManager />
    </div>
  );
}
