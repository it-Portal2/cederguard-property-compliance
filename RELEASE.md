# RELEASE.md — CedarGuard Desktop release process

This is the runbook for cutting a new CedarGuard Desktop release. The process
is intentionally tiny — three commands — but the prerequisites + verification
steps below are not optional.

> **Web releases** happen automatically on push to `main` via Vercel's
> integration. This document covers **desktop releases only** (DMG artifacts).

---

## Prerequisites — one-time setup

These need to be in place before the first signed release. None are needed
to cut an unsigned development DMG (current local-build behaviour stays).

### 1. Apple Developer Program enrolment ($99/yr)
- Enrol at https://developer.apple.com/programs/
- Create a **Developer ID Application** certificate at
  https://developer.apple.com/account/resources/certificates
- Download the `.p12` and remember the password used to export it.

### 2. App-Specific Password for notarisation
- Sign in to https://appleid.apple.com → Sign-In and Security →
  App-Specific Passwords → generate one labelled `cedarguard-notarize`.

### 3. GitHub Actions secrets
Repository → Settings → Secrets and variables → Actions → New repository secret.

| Secret | Value |
|---|---|
| `APPLE_ID` | Your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | The app-specific password from step 2 |
| `APPLE_TEAM_ID` | 10-character team ID (visible at https://developer.apple.com/account → top right) |
| `CSC_NAME` | `Developer ID Application: Your Name (TEAMID)` — exact string from the .p12 |
| `CSC_LINK` | Base64-encoded `.p12` — `base64 -i ~/path/to/cert.p12 \| pbcopy` |
| `CSC_KEY_PASSWORD` | The password you set when exporting the `.p12` |
| `VITE_FIREBASE_API_KEY` + `VITE_FIREBASE_*` | From your Firebase project (public web config) |
| `VITE_GOOGLE_DESKTOP_CLIENT_ID` | From GCP Console (Desktop OAuth client) |
| `VITE_GOOGLE_DESKTOP_CLIENT_SECRET` | From the same Desktop OAuth client (`GOCSPX-...`) |
| `VITE_DESKTOP_API_URL` | `https://cedarguard.co.uk/api` (or your current production URL) |

### 4. Update feed bucket (M-UpdateRelease milestone — not required for first release)
For auto-update to actually deliver updates to installed apps, you need a
static directory at `https://cedarguard.co.uk/desktop-updates/` hosting:
- `latest-mac.yml` (electron-updater manifest)
- `CedarGuard-x.y.z-arm64.dmg`
- `CedarGuard-x.y.z-arm64.dmg.blockmap` (delta updates)

This can be Vercel Blob, S3, R2, or any HTTPS static host. Setup is a separate
milestone (M-UpdateRelease); the desktop binary tolerates the feed being
absent (404 logs silently, no user-visible error).

---

## Cutting a release

### Step 1 — Bump the version

```bash
# Pick one:
npm version patch    # 0.0.1 → 0.0.2  (bug fixes)
npm version minor    # 0.1.0 → 0.2.0  (new features, backwards compatible)
npm version major    # 1.0.0 → 2.0.0  (breaking changes)
```

`npm version` updates `package.json` + `package-lock.json` AND creates a git
commit + git tag (`v0.0.2`, `v0.1.0`, `v2.0.0`) in one operation.

### Step 2 — Push the commit AND the tag

```bash
git push --follow-tags
```

`--follow-tags` ensures the new `v*` tag pushes alongside the commit (without
it, GitHub Actions never sees the tag and the DMG job never runs).

### Step 3 — Watch the CI run

GitHub Actions → Actions tab → `Build desktop` workflow → look for the run
triggered by your `v*` tag.

The `dmg` job takes ~5-10 minutes (cert import + electron-builder + notarytool
round-trip with Apple's servers). The artifact appears under the run's
"Artifacts" section as `CedarGuard-v0.0.2-arm64.dmg`.

### Step 4 (manual until M-UpdateRelease wires CI publish) — upload to update feed

For now, download the DMG artifact from GitHub Actions and upload it to
your update bucket alongside `latest-mac.yml`. Once M-UpdateRelease is done,
the CI workflow will do this automatically via `electron-builder --publish`.

---

## Verifying a release

Before announcing or distributing the DMG:

1. **Download the DMG from the GitHub Actions artifact.**
2. **Verify the signature locally:**
   ```bash
   codesign -dvv /path/to/CedarGuard.app
   spctl -a -t exec -vv /path/to/CedarGuard.app
   ```
   Both should report a valid Developer ID signature + notarisation.
3. **Install on a fresh test Mac** (or wipe `~/Library/Application Support/CedarGuard/`).
4. **Open the DMG by double-clicking** — no Gatekeeper warning should appear if
   signing + notarisation succeeded.
5. **Walk the full flow**: wizard → Firebase → Sign in with Google → Dashboard loads.
6. **Quit + relaunch** — silent token refresh should land on Dashboard directly.

---

## Rolling back a bad release

If a release ships with a critical bug:

1. **Don't delete the tag** — once `latest-mac.yml` points at the bad version,
   installed apps that already updated to it will stay on it. Cut a new
   patch release that reverts or fixes the bug.
2. **Re-upload `latest-mac.yml`** pointing at the previous good version if
   the update feed has been corrupted.
3. **Update `package.json minimumSystemVersion`** if you need to forcibly
   prevent older OS users from updating to a broken build.

---

## Versioning policy

CedarGuard Desktop follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0) — breaking changes the user notices (UI overhaul, removed
  features, mandatory re-sign-in).
- **MINOR** (0.X.0) — new features, backwards compatible.
- **PATCH** (0.0.X) — bug fixes, small UX tweaks.

Pre-1.0.0 (current): treat as "use freely, no breaking-change promises."

---

## Future: automate this further

When the team grows past one releaser, migrate to
[release-please](https://github.com/googleapis/release-please):
- Opens a release PR that aggregates conventional commits.
- Merging the PR cuts the tag + triggers the existing CI workflow.
- Removes the manual `npm version` step.

Don't pre-optimise to release-please now — `npm version` + `git push --follow-tags`
is honest about what's happening and fits a one-person workflow.
