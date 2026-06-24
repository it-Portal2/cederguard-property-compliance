Always read this entire file before starting any task.
# CLAUDE.md — Cedar Property Compliance

Project: `cedarguard-compliance-suite` — a compliance and risk management SaaS for the built environment (construction/property sector). Multi-tenant, role-gated, AI-assisted.

---

## ⚠️ STRUCTURE UPDATE (2026-06) — read this BEFORE the file-structure sections below

The repo was restructured into a production-grade, multi-target layout. **The authoritative current
structure is here; the detailed `web/...` file listings further down predate the feature reorg and are
mapped below.**

### Top-level layout (each folder = a deployment target or shared code)
```
cedar/
├── web/        ← React frontend (WAS `src/` — renamed). Vite entry: web/main.tsx
├── api/        ← Vercel serverless backend (STAYS at repo root — Vercel requirement). Unchanged internally.
├── shared/     ← code imported by BOTH web/ and api/ (relative `.js` imports, NO path alias — Vercel
│                 serverless does not resolve tsconfig path mappings)
└── apps/desktop/   ← Electron (unchanged)
```
Config (`vercel.json`, `tsconfig.json`, `vite.config.ts`, `package.json`, `firebase.*`, `*.md`) stays at
the **repo root** — it governs all targets / is read there by tooling. This is intentional, not a gap.

### `shared/` contents (moved out of the old `src/` to fix the api→src boundary violation)
- `shared/constants/roleConstants.ts`  (was `src/lib/roleConstants.ts`)
- `shared/types/historicalReporting.ts`  (was `src/types/historicalReporting.ts`)
- `shared/types/technicalAssurance.ts`  (was `src/types/technicalAssurance.ts`)
- `shared/lib/composerModels.ts`  (was `src/components/chat/composerModels.ts`)
- **`riskMetrics.ts` / `validation.ts` / `riskConversion.ts` did NOT move** — they stay in `web/lib/`
  (they have deps into `web/` and the backend doesn't import them).
- **Rule:** new code shared by web+api goes in `shared/`, imported via relative `.js` paths. Never
  `../../web/...` from `api/`. Never a path alias (breaks the Vercel serverless build).

### `web/` is now feature-first
```
web/
├── features/<domain>/          ← per-domain code. Domains:
│     governance, technicalAssurance, risk, compliance, programmes, projects, reporting, admin, learning, chat, resourcePlanner
│     • governance/, technicalAssurance/ + resourcePlanner/ have BOTH pages/ AND components/ (their components were self-contained)
│     • the other 8 domains have pages/ only (their pages moved here)
├── components/                 ← SHARED component library (kept here, NOT per-feature): layout shell
│     (Header, Sidebar, MobileHeader, MobileNav), PageHeader, PageActions, AuthProvider, RoleGuard,
│     ErrorBoundary, table/ (DynamicTable), validation/ (ValidateButton), common/, dashboard/, chat/,
│     compliance/, admin/, forms/, historicalReporting/, onboarding/, desktop/, public/
├── pages/                      ← ONLY Login.tsx, Landing.tsx, public/ (marketing) remain flat (public/auth)
├── store/  lib/  hooks/  data/  services/  constants/  utils/  types/   ← unchanged locations
```
**Mapping for stale refs below:** any `web/pages/<Flat>.tsx` in the listings below now lives at
`web/features/<domain>/pages/<Flat>.tsx`; `web/features/governance/pages/*` → `web/features/governance/pages/*`;
`web/features/governance/components/*` → `web/features/governance/components/*` (same for technicalAssurance).
`web/components/<shared subdir>` (table, common, validation, dashboard, etc.) is unchanged.

### Conventions added by the restructure
- **Feature rule:** a new domain feature is `web/features/<domain>/` (pages, and components only if
  feature-specific). Cross-cutting/reused components belong in `web/components/` (the shared lib).
- **Big files** (`useStore.ts`, large `api/routes/*`, `Dashboard.tsx`, `ComplianceSetup.tsx`) were
  relocated whole, NOT split — splitting them remains a deliberate future task.
- The verification gate (`npx tsc --noEmit` + `npm run build`) and all other standing rules are unchanged.

---

## Working Protocol — read before doing anything

### `tasks.md` is the source of truth for progress
- All multi-step work is tracked in `tasks.md` in the repo root (a checklist + a log).
- ALWAYS read `tasks.md` before starting work, and resume from the first unchecked `[ ]` item.
- You have NO memory between sessions — `tasks.md` is your memory. A task is not "done" until it is written there. Do not rely on conversation history surviving; assume it won't.

### Work one task at a time
For each task in `tasks.md`, in order:
1. Implement ONLY that task. Do not start the next one.
2. Run the verification gate: `npx tsc --noEmit` AND `npm run build`. Both must exit clean.
3. Commit locally per the Standing Rules below (no push, no `--no-verify`, no model names / co-authored-by footer).
4. Mark the task `[x]` in `tasks.md` and add a one-line entry under `## Log`: what changed + which files.
5. Only then move to the next task.
If anything is blocking or ambiguous, STOP and ask — do not guess.

### Plan before non-trivial work
- Anything touching 3+ files, `useStore.ts`, `api.ts`, `aiService.ts`, or `riskMetrics.ts` → propose a plan first (plan mode) and wait for approval before editing.
- One-sentence-diff rule: if you can describe the change in a single sentence, skip the plan and just do it.

### Context hygiene
- After finishing a task or milestone, expect the session to `/compact` or `/clear`. Keep `tasks.md` current at all times so a fresh session with zero context can pick up exactly where you stopped.

---

## Tech Stack

### Frontend
| Package | Version | Role |
|---|---|---|
| react | ^19.0.0 | UI framework |
| react-dom | ^19.0.0 | DOM renderer |
| react-router | ^7.13.1 | Client-side routing (v7 — uses `<Route>` directly, not `createBrowserRouter`) |
| zustand | ^5.0.11 | Global state management |
| tailwindcss | ^4.1.14 | Utility-first CSS (v4 — uses Vite plugin, no `tailwind.config.js`) |
| @tailwindcss/vite | ^4.1.14 | Vite integration for Tailwind v4 |
| clsx | ^2.1.1 | Conditional class names |
| tailwind-merge | ^3.5.0 | Merge conflicting Tailwind classes |
| lucide-react | ^0.546.0 | Icon set |
| motion | ^12.23.24 | Animation library (Framer Motion v12) |
| recharts | ^3.7.0 | Chart components |
| react-hot-toast | ^2.6.0 | Toast notifications |
| date-fns | ^4.1.0 | Date utilities |
| html2canvas | ^1.4.1 | DOM-to-image for reports |
| jspdf | ^4.2.0 | PDF generation |
| xlsx | ^0.18.5 | Excel export |

### Backend (Serverless — Vercel)
| Package | Version | Role |
|---|---|---|
| express | ^4.21.2 | HTTP handler (single entry point) |
| firebase | ^12.10.0 | Client SDK (auth + Firestore) |
| firebase-admin | ^13.7.0 | Admin SDK (server-side Firestore) |
| @google/genai | ^1.29.0 | Gemini AI API |
| better-sqlite3 | ^12.4.1 | SQLite (used in tests/local only) |
| dotenv | ^17.2.3 | Env var loading |

### AI
- **Google Gemini** via `@google/genai` — compliance analysis, risk identification, control suggestions, AI writer

### Build / Dev Tools
| Package | Role |
|---|---|
| vite ^6.2.0 | Build tool and dev server (port 3000) |
| @vitejs/plugin-react ^5.0.4 | React fast-refresh |
| vite-plugin-pwa ^1.2.0 | PWA manifest and service worker |
| typescript ~5.8.2 | Type checking |
| vitest ^4.1.2 | Test runner |
| @vitest/ui | Vitest browser UI |
| tsx ^4.21.0 | TypeScript execution for scripts |
| autoprefixer ^10.4.21 | PostCSS autoprefixer |
| electron ^33 | macOS arm64 desktop binary runtime |
| electron-builder ^25 | DMG packaging + (dormant) code-sign + notarytool config |
| electron-log ^5.4 | JSON-first log file at `app.getPath('logs')/main.log`; renderer→main IPC bridge |
| electron-updater ^6.8 | Auto-update foundation (pinned ≥6.3.x for CVE-2024-39698; dormant until update feed exists) |
| concurrently ^9 | Drives multi-process dev scripts (`electron:dev`, `electron:dev:full`) |
| cross-env ^7 | Cross-platform env-var setting in npm scripts |
| wait-on ^8 | Waits for Vite dev server to be reachable before starting Electron |

### Infrastructure
- **Firebase**: Auth, Firestore (database), Firebase Cloud Messaging (push notifications). Storage bucket is `cedar-risk-compliance-suite.firebasestorage.app` (post-Oct-2024 default; NOT the legacy `.appspot.com`).
- **Vercel**: Deployment (`vercel.json` present). Serverless function body limit is 4.5 MB on all plans (drives the 3 MB per-file upload cap — see Storage conventions below).
- **PWA**: Service worker via vite-plugin-pwa. Skipped on desktop bundle (guarded by `isDesktop` in `web/main.tsx`).
- **Desktop**: Electron 33 binary at `apps/desktop/main.cjs`. Single-source codebase — same React + Vite renderer, web auth-bridge swapped for desktop OAuth via Google PKCE + loopback HTTP + Firebase REST `signInWithIdp`. Tokens encrypted with `safeStorage` at `<userData>/auth.bin`. See `apps/desktop/` section below + `~/.claude/plans/cuddly-watching-lantern.md` for the full M1.x narrative.

### Key commands

**Web:**
| Command | Purpose |
|---|---|
| `npm install` | Install deps |
| `npm run dev` | Vite dev server on port 3000 (web only — no API) |
| `npx tsc --noEmit` | Type-check (the canonical "is it broken" gate — runs in ~1-2s) |
| `npm run build` | Production build (~6s; chunk-size warning on `index-*.js` is pre-existing and accepted) |
| `npm run test` | Vitest — only `api/__tests__/context.test.ts` + `dispatcher.test.ts` exist; no UI tests |
| `vercel dev` | Vite + serverless API together on port 3000 |

**Desktop (three legitimate dev flows — pick by what you're iterating on):**
| Command | Renderer | API target | When to use |
|---|---|---|---|
| `npm run electron:dev` | Vite (HMR) | **production** API via dev-only webRequest CORS rewrite in `apps/desktop/main.cjs` | Fastest inner loop with real Firestore data; no vercel dev startup overhead |
| `npm run electron:dev:full` | vercel dev (Vite + API on :3000) | localhost (same-origin) | Full-stack iteration when changing API routes + UI together |
| `npm run dev:install` / `dev:install:fast` | packaged `.app` rsync'd into `~/Applications/CedarGuard.app` (NOT `/Applications` — Gatekeeper/TCC reasons) | production (file://) | Verify packaged-only behaviour (deep links, `app.isPackaged` branches). Fast variant repacks asar only (~5-10s); full rebuilds via `electron-builder --dir`. |
| `npm run dist:mac` | builds DMG | n/a | Produces `dist-electron/CedarGuard-*-arm64.dmg` for distribution. Unsigned until Apple Dev cert lands. |

**Verification gate** for any non-trivial change: run `npx tsc --noEmit` AND `npm run build` before committing. Both must exit clean.

### Config Files
| File | Purpose |
|---|---|
| `tsconfig.json` | Target ES2022, `@/*` path alias pointing to repo root, bundler resolution |
| `vite.config.ts` | React + Tailwind + PWA plugins; manual chunk splits (vendor/firebase/utils/viz/docs/ai) |
| `vitest.config.ts` | Node env, globals, v8 coverage, tests in `api/__tests__/**` and `web/__tests__/**` |
| `firebase.json` | Firebase deployment config — wires `firestore.rules` AND `storage.rules` |
| `firestore.rules` | Firestore security rules (defence-in-depth — all production access via Admin SDK) |
| `storage.rules` | Firebase Storage rules — **deny-all-client** (defence-in-depth). No client ever touches Storage Web SDK; uploads go through `uploadAsset()` server-side. Deploy via `firebase deploy --only storage`. |
| `firestore.indexes.json` | Custom composite index definitions |
| `.firebaserc` | Firebase project reference |
| `vercel.json` | Vercel deployment config |
| `electron-builder.yml` | DMG packaging config; dormant `hardenedRuntime` + `notarize.teamId` block (lights up when Apple Dev cert + env vars present) |
| `build/entitlements.mac.plist` | macOS hardened-runtime entitlements (`allow-jit` for V8, `network.client`, `disable-library-validation` for native modules) |
| `RELEASE.md` | Cut-a-release runbook: `npm version` → `git push --follow-tags` → CI |
| `.github/workflows/build-desktop.yml` | CI: lint+build on push to `main`; full DMG (signed if cert secrets present) on tag `v*`. Uses `apple-actions/import-codesign-certs` for temporary keychain. |

---

## Current File Structure

### Root
```
/web/main.tsx                         Bootstrap: React root, PWA registration, global error handler
/web/App.tsx                          Router: HashRouter on desktop / BrowserRouter on web;
                                      auth + setup-wizard branching for desktop
/web/index.css                        Global CSS resets and Tailwind base
```

### `/apps/desktop/` — Electron main-process code (.cjs because main runs CJS)
```
main.cjs              (~500 lines)  Electron entry. Single-instance lock, BrowserWindow setup with
                                    show:false + ready-to-show (no white flash), native macOS menu
                                    (CedarGuard/File/Edit/View/Window/Help) via Menu.buildFromTemplate,
                                    About panel via app.setAboutPanelOptions, dev-mode CORS rewrite for
                                    the `electron:dev` flow (intentional — see comment block in file),
                                    all IPC handlers (auth:*, config:*, setup:*, log:write,
                                    diagnostics:get, update:*).
preload.cjs                         contextBridge: exposes `window.cedar = { isDesktop, isDev,
                                    apiBaseUrl, auth, config, setup, log, diagnostics, update, menu }`
                                    via contextIsolation: true + sandbox: true. NEVER exposes raw
                                    process.env or full ipcRenderer — only the specific resolved
                                    values + the auth/IPC channels the renderer needs.
googleOAuth.cjs                     Full Google OAuth implementation: PKCE S256, one-shot HTTP server
                                    on `127.0.0.1:0` (loopback per RFC 8252; binds to 127.0.0.1 NOT
                                    0.0.0.0 — AppAuth-JS#93 was a CVE-class issue), code exchange,
                                    Firebase REST signInWithIdp exchange, refresh-token middleware,
                                    sign-out with Google /revoke. Cancel-in-flight via `cancelSignIn()`.
secureStore.cjs                     `safeStorage`-wrapped read/write for `<userData>/config.bin`
                                    (backend chooser + setup timestamp), 0o600 perms.
logger.cjs                          electron-log wrapper. JSON format from day one (switching format
                                    mid-flight invalidates historical analysis). File sink at
                                    `app.getPath('logs')/main.log`, 5MB rotation. Defensive against
                                    electron-log v5's variable message shape — format function must
                                    NEVER throw. Convention: dot-notation event names + structured
                                    payloads, e.g. `log('info', 'auth.signin.start', { method: 'google' })`.
windowState.cjs                     Inline window position/size persistence (~75 LOC, no dep).
                                    Reads/writes `<userData>/window-state.json` with multi-monitor
                                    safety (drops saved x/y if the saved display is no longer attached).
                                    Pattern direct from Electron BrowserWindow docs.
updater.cjs                         electron-updater wrapper. autoDownload only when packaged + non-dev.
                                    Structured event listeners through electron-log. 10s + 4h check
                                    cadence. Dormant until publish URL hosts `latest-mac.yml`.
built-env.cjs                       **GITIGNORED.** Build-time bake of VITE_* env vars (Firebase API
                                    key, Google Desktop OAuth client + secret, prod API URL) into
                                    the packaged binary. Generated by `scripts/buildDesktopEnv.cjs`
                                    before each `dist:mac`. Contains the OAuth client_secret — never
                                    commit.
```

### `/scripts/` — Build + dev workflow helpers
```
buildDesktopEnv.cjs                 Reads `.env.local` and writes the 4 desktop-needed VITE_* vars to
                                    `apps/desktop/built-env.cjs` so the packaged binary has them at
                                    runtime (dotenv path doesn't work inside an asar). Wired into
                                    `dist:mac` npm script.
devInstall.cjs                      Fast `dev:install` + `dev:install:fast` workflows. Full mode:
                                    build:desktop-web → buildDesktopEnv → electron-builder --dir →
                                    rsync into ~/Applications/CedarGuard.app → ad-hoc codesign.
                                    Fast mode: skip --dir, repack asar in place. ~30-40s vs ~5-10s.
                                    User data in ~/Library/Application Support/ survives both.
```

### `/web/components/` — Shared UI components

#### Navigation & Layout
```
Header.tsx            (367 lines)   Top header: project/programme switcher, notifications bell, user menu.
                                    New/programme + New/project buttons: icon-only at lg (1024–1279px),
                                    full labels at xl (1280px+) via hidden xl:inline span + styled tooltip.
Sidebar.tsx           (367 lines)   Left nav: role-gated menu groups, auto-collapse on route change.
                                    Breakpoint: lg (1024px) — permanent at ≥1024px, drawer at <1024px.
MobileHeader.tsx                    Mobile/tablet top header (lg:hidden — visible below 1024px).
MobileNav.tsx                       Bottom tab bar (lg:hidden — visible below 1024px).
PageHeader.tsx                      CANONICAL page-level header. Props: title, subtitle?, breadcrumbs,
                                    actions?. Renders breadcrumb nav + H1 + subtitle; when actions is
                                    provided, wraps in md:flex-row responsive layout. Every authenticated
                                    page uses this. EXEMPT (keep their bespoke headers): full-screen wizards
                                    ComplianceSetup/RiskSetup, the full-screen editor ReportAuthoringPage,
                                    the dev surface EditorSandboxPage, and the back-button detail route
                                    EnquiryWorkspacePage. NEVER add an ad-hoc h1 block — always use PageHeader.
PageActions.tsx                     Reusable "Actions & options" dropdown for page-level context actions.
                                    Props: items: ActionItem[], canManage: boolean. Groups items by
                                    'Context Actions' | 'Data Tools'; shows Read-only badge when
                                    canManage===false; detects async onClick for export spinner.
                                    Used by 7 pages: ComplianceDashboard, ComplianceTracker, RiskDashboard,
                                    RiskRegister, ProgrammeRiskRegister, RiskIssues, ProgrammeIssues.
PublicationChecklist.tsx (402 lines) Pre-publication validation checklist modal
```

#### Auth & Guards
```
AuthProvider.tsx                    Firebase auth state watcher; calls store.initStore() on login
RoleGuard.tsx                       Wrapper that blocks render unless user meets role requirement
ChecklistGate.tsx                   Blocks action until setup checklist is complete
ErrorBoundary.tsx                   Top-level React error boundary
```

#### Modals & Forms
```
ProfileSettingsModal.tsx            User profile + preferences settings modal
IssueModal.tsx        (527 lines)   Issue create/edit form modal
RiskModal.tsx         (620 lines)   Risk create/edit form modal (largest modal)
KRIModal.tsx                        Key Risk Indicator management modal
MilestoneManager.tsx  (475 lines)   Milestone tracking with history timeline
DeliveryTeamCRUD.tsx                Team member add/edit/remove UI
DetailsModal.tsx                    Generic read-only details display modal
```

#### AI Components
```
AIErrorAlert.tsx                    Displays structured AI/API error messages
AIInquiryPopup.tsx                  Chat-style AI inquiry popup
AIWriter.tsx                        AI content generation interface (drafting text)
GlobalAIAssistant.tsx               App-wide floating AI-assistant FAB, mounted in the App.tsx
                                    authenticated shell. Route-aware context label + `domain`
                                    (via resolveAiDomain) passed to AIInquiryPopup for the per-page
                                    DOMAIN LOCK. On mobile it floats ABOVE the MobileNav bar (Mobile
                                    responsiveness conventions).
```

#### Misc
```
NotificationWrapper.tsx             react-hot-toast provider wrapper
InfoTooltip.tsx                     Hover tooltip component. Absolutely-positioned panel — fine inline,
                                    but it gets CLIPPED inside a scroll/overflow container (e.g. a
                                    DynamicTable cell). For tooltips inside tables use TrendingTooltip's
                                    portal pattern instead.
TrendingTooltip.tsx                 Portal-based hover tooltip for the "Trending" badge in the risk
                                    tables. Renders its panel via createPortal to document.body with
                                    position:fixed so it ESCAPES the table's overflow-x-auto clipping,
                                    at z-40 — above the table (max z-30) but BELOW modals / confirm
                                    dialogs / dropdown overlays (z-50). The reference pattern for any
                                    tooltip that must overflow a scroll container.
UserAvatar.tsx                      Shared user avatar: renders <img src={photoURL}> with onError
                                    fallback to a gradient initials badge. Three sizes (sm/md/lg).
                                    SINGLE SOURCE OF TRUTH for avatar rendering — Header, Sidebar,
                                    MobileHeader all consume this. Never inline an <img photoURL>
                                    in new code; always use <UserAvatar/>.
DemoDataControls.tsx                Admin-only (isSuperAdmin) "Load demo data ▾" dropdown (Programme
                                    demo / Project demo) + "Clear demo data" button, mounted in the
                                    Dashboard hero-header actions slot. Renders null for non-admins.
                                    Wires to loadDemoProgramme/loadDemoProject/clearDemo. See the
                                    Demo mode convention below.
DemoModeBanner.tsx                  App-wide amber "Demo mode" bar, mounted in the App.tsx
                                    authenticated shell (between <Header> and <main>). Admin-only,
                                    shown only while a demo is loaded. "Exit demo" → clearDemo;
                                    the close (X) hides the banner for the session (demo stays loaded).
```

#### `/web/components/desktop/` — Desktop-only renderer components
```
FirstRunWizard.tsx                  Multi-step backend chooser shown on first launch when no
                                    `setupCompletedAt` is present in `<userData>/config.bin`.
                                    Step 1 = Firebase (enabled) / Microsoft Azure (disabled,
                                    "Coming soon"). When Azure milestone lands, just flip the
                                    disabled flag and add the Azure-specific step components.
BackendChooserCard.tsx              Two-state card primitive used inside FirstRunWizard.
HealthBanner.tsx                    Non-blocking offline indicator. Fires `?action=ping` async on
                                    mount; renders null on success, fixed-position red banner with
                                    Retry on failure. Treats <500 as "server reachable" (so 401 from
                                    a deployment without the pre-auth ping bypass doesn't trigger
                                    a false outage banner). NEVER blocks first paint —
                                    Slack/VS Code/GitHub Desktop reference pattern.
```

#### `/web/components/dashboard/` — Dashboard primitives (v4-calibrated)
```
ActivityTimeline.tsx                Recent activity feed with All/Risks/Issues tabs
AIFollowUpPrompts.tsx               AI follow-up chip strip below the AI panel
AnimatedCounter.tsx                 motion-driven count-up for KPI bignums
ComplianceVelocityChart.tsx         Compliance "verifications over time": Recharts bar (items
                                    verified per day) + cumulative-progress line (dual Y-axis);
                                    range pills 7/30/90. Buckets by `completedAt` (the day an item
                                    is moved to Live — stamped by store.updateComplianceItem), NOT
                                    `dateAdded`: every compliance item is created at once during the
                                    AI analysis, so "items added" would be one spike. Legend shows
                                    the current Verified/In-progress/Pending snapshot + "% complete".
MiniSparkline.tsx                   38px sparkline used in KPI cards
RibaTimeline.tsx                    Horizontal stage rail (S0..S5) for project view
RiskBurnDown.tsx                    "Risk outlook · next 90 days" — data-driven projection
                                    using top-3 risks + tolerance line + real milestones
RiskCallout.tsx                     Critical-risk callout (uses calculateMatrixScore +
                                    SEVERE_SCORE_THRESHOLD from riskMetrics.ts)
ShimmerSkeleton.tsx                 Animated shimmer placeholder
```
These are the canonical typography references. Match their class strings when porting KPI
tiles / status chips / table headers / sparklines to other pages.

#### `/web/components/admin/` — Admin-only sub-components
```
OverviewTab.tsx       (329 lines)   Admin dashboard overview cards
UsersTab.tsx                        User list management (role, deactivation)
ActivityTab.tsx                     Audit / activity-log viewer. Built on DynamicTable (search,
                                    category + entity filters, sort, pagination, XLSX export).
                                    Columns: When / Who (name+email) / Category / Action / What
                                    (entity name) / Details. Reads via `api.adminGetActivity(limit)`;
                                    humanises `type` and colours by `category`. Tolerates legacy
                                    records missing the newer fields.
ProjectsTab.tsx       (615 lines)   Project list with search, filter, admin actions
PricingTab.tsx                      Pricing config editor
MappingManager.tsx                  AI system mapping directives editor
RegulationManager.tsx (594 lines)   Regulation library CRUD editor
constants.tsx                       Admin UI configuration constants. Exports `TABS`, `ROLE_CONFIG`,
                                    `ACTIVITY_ICONS` (per-type labels) and `ACTIVITY_CATEGORY_BADGES`
                                    (category → label + colour, used by ActivityTab).
DetailsModal.tsx                    Admin-specific details modal
```

#### `/web/components/compliance/`
```
ComplianceQuestionnaire.tsx         Multi-phase compliance profiler questionnaire form
AnalysisSummary.tsx   (407 lines)   Displays AI compliance analysis results with scoring
```

#### `/web/components/common/`
```
EmptyState.tsx                      Reusable empty state placeholder (icon + message)
PremiumAIBanner.tsx                 Upgrade prompt banner for AI features
```

#### `/web/components/public/`
```
PublicLayout.tsx      (281 lines)   Layout wrapper for all public-facing pages
MarketingImage.tsx                  SINGLE SOURCE OF TRUTH for responsive imagery on the marketing
                                    pages. A `<picture>` wrapper that serves AVIF → WebP → JPEG with
                                    `srcset`/`sizes` from PRE-GENERATED variants in `public/marketing/`
                                    (`<base>-{960,1600}.{avif,webp,jpg}`), lazy-loads + `decoding=async`
                                    by default (`priority` ⇒ eager + `fetchpriority=high` for an LCP image),
                                    and takes explicit `width`/`height` to avoid CLS. Props: `base`
                                    (path under public/ WITHOUT the `-<w>.<ext>` suffix, e.g.
                                    `marketing/suite-multidevice`), `alt`, `width`, `height`, `sizes?`,
                                    `className?`, `priority?`. Used by Landing's `ShowcaseBand`
                                    (alternating image+heading+sub "feature spotlight" tiles) and the
                                    Product deep-dive cards.
```

**`public/marketing/`** — optimised marketing screenshots. Each source ships 6 static variants
(`-960`/`-1600` × `avif`/`webp`/`jpg`); a visitor downloads ONE (best format the browser supports × the
right width). Generated once with `sharp` (the one-off script was removed after running — regenerate ad-hoc
if new shots are added: resize ≤2000px, AVIF q≈62 / WebP q≈80 / JPEG q≈78). Never reference a raw
multi-MB original from a marketing page — always go through `<MarketingImage>`.

#### `/web/components/table/` — Canonical table primitives
```
DynamicTable.tsx                    SINGLE SOURCE OF TRUTH for tabular list pages.
                                    Built-in search, filters, sort, pagination,
                                    selection, bulk + row actions, ConfirmDialog,
                                    skeleton, CSV/XLSX export, sticky header,
                                    column-visibility, virtualization.
ConfirmDialog.tsx                   Confirmation modal — invoked automatically by
                                    DynamicTable when a RowAction / BulkAction
                                    sets `requireConfirm`. Do NOT roll your own
                                    confirm modal in a page.
TableToolbar.tsx                    Toolbar: search input, filter dropdowns,
                                    column visibility, export, inline bulk
                                    actions, custom `toolbarActions` slot.
TableHeader.tsx / TableBody.tsx /
TableRow.tsx / TableCell.tsx        Internal renderers used by DynamicTable.
TableActions.tsx                    Per-row action menu (uses RowAction defs).
TableBulkBar.tsx                    Floating selection bar (style: 'bar' actions).
TablePagination.tsx                 Page controls + page-size selector.
TableSkeleton.tsx                   Loading state placeholder.
TableTooltip.tsx                    Tooltip used for truncated cells.
types.ts                            Public types: ColumnDef, RowAction,
                                    BulkAction, FilterDef, ConfirmConfig,
                                    PaginationConfig, DynamicTableProps.
useTableState.ts                    Hooks: useTableFilter, useTableSort,
                                    useTablePagination, useTableSelection,
                                    useTableColumns. Internal to DynamicTable.
```

---

### Route-level page components — now under `/web/features/<domain>/pages/`

> Post-restructure: these pages live in `web/features/<domain>/pages/` (the `####` category
> headers below map to the feature domains: Compliance → `features/compliance`, Risk → `features/risk`,
> Reporting → `features/reporting`, Programme/Project → `features/programmes`/`features/projects`,
> Admin/Settings → `features/admin`, Learning → `features/learning`, AI → its owning domain, Chat →
> `features/chat`). **`Login.tsx` and `Landing.tsx` (and `public/`) remain in `web/pages/`** (public/auth).
> The catalog below is grouped by domain for reference.

#### Core
```
Dashboard.tsx         (1281 lines)  Main dashboard — web/features/reporting/pages/
Login.tsx                           Firebase email/password login form — web/pages/ (public)
Landing.tsx           (826 lines)   Public marketing landing page — web/pages/ (public)
```

#### Compliance
```
ComplianceSetup.tsx   (2301 lines)  LARGEST FILE: multi-phase compliance profiler (state + AI + UI)
ComplianceDashboard.tsx             Compliance items overview with status cards
ComplianceTracker.tsx (1237 lines)  Compliance item table with inline editing and filters
ComplianceProfiler.tsx              Compliance profiling tool entry point
ComplianceAlerts.tsx                Compliance breach/alert viewer
LinkedRegs.tsx                      View regulations linked to compliance items
EvidenceDocuments.tsx               Evidence document upload and management
```

#### Risk Management
```
RiskSetup.tsx         (951 lines)   Risk profiler + KRI setup wizard (multi-phase)
RiskDashboard.tsx     (832 lines)   Risk overview: heatmap, by-category charts, KRI status
RiskRegister.tsx                    Risk register table with sorting/filtering
RiskTracker.tsx                     Risk monitoring and status tracking
RiskAlerts.tsx                      Risk threshold breach alert viewer
RiskIssues.tsx                      Issues linked to risks
AIRiskID.tsx          (802 lines)   AI-powered risk identification workflow
RiskIdentifier.tsx                  Manual risk identifier tool
RiskAggregation.tsx                 Portfolio-wide risk aggregation view
```

#### Monitoring & Reporting
```
KRITracker.tsx                      Key Risk Indicator tracking and threshold management
TrendsHeatmaps.tsx                  Risk and compliance trend heatmaps over time
ExecutiveReport.tsx                 Executive summary report (exportable PDF)
ProjectReport.tsx     (834 lines)   Project-specific report with charts
ProgrammeReport.tsx                 Programme-level report
ClientProgrammeReport.tsx           Client-facing programme report view
```

#### Programme Management
```
Programmes.tsx                      List all programmes with status cards
ProgrammeInitiation.tsx (1069 lines) Create/edit programme form (large, multi-section)
ProgrammeSetup.tsx                  Initial programme setup flow
ProgrammeContext.tsx                Programme context configuration
ProgrammeRiskRegister.tsx (768 lines) Programme-level risk register table
ProgrammeIssues.tsx                 Programme-level issue tracker
```

#### Project Management
```
Projects.tsx                        List all projects (cards/table view)
ProjectInitiation.tsx (986 lines)   Create/edit project form (multi-section)
ProjectPlan.tsx                     Project planning and milestone view
NewProgramme.tsx                    New programme creation wizard
```

#### Administrative
```
AdminPanel.tsx                      Admin dashboard container (tabs: users, activity, projects, pricing)
ClientTeamPanel.tsx                 Client team management (invite PMs, assign roles)
WorkspaceSettings.tsx               Workspace/organisation settings
BillingPanel.tsx                    Billing overview and subscription info
InvoiceManager.tsx    (1030 lines)  Invoice CRUD with PDF generation
Invoices.tsx                        Invoice list viewer (client view)
CostCalculator.tsx                  Fee/cost calculation tool
```

#### AI & Intelligence
```
AIControlSuggestions.tsx            AI-suggested control measures for risks
AIComplianceOutlook.tsx             AI compliance forecasting and outlook
```

#### Learning & Support
```
RegulationLibrary.tsx (802 lines)   Searchable regulation library with detail panels
CPDTraining.tsx                     CPD training module viewer
LessonsLearned.tsx                  Lessons learned tracker and logger
HelpCenter.tsx                      In-app help documentation
Calendar.tsx          (1189 lines)  Event calendar (compliance deadlines, milestones)
```

#### Developer
```
DeveloperSettings.tsx               API key generation and management
APIDocs.tsx                         In-app API documentation viewer
MyTasks.tsx                         Personal task list for logged-in user
```

#### `/web/features/governance/pages/` — Programme Governance page group (sidebar group "Programme Governance")
A feature module under `web/features/` (see the Structure Update at the top of this file). Pages live in
`web/features/governance/pages/` (depth 4 → `import PageHeader from '../../../components/PageHeader'`); the
feature's own components live under `web/features/governance/components/<feature>/` (archive, branding,
dashboard, editor, extensions, forwardPlan, framework, meetings, projectDocs, reports, templates) +
shared dialogs/pickers at that folder's root. Imports to the shared library use `../../../components/…`,
to shared/ use `../../../../shared/…`.
```
DashboardPage.tsx                   /governance/dashboard — role-aware briefing + StatsCards (PgM vs PM payload)
ForwardPlanPage.tsx                 /governance/forward-plan — rolling 28-day key-decision pipeline (5 view modes)
TemplatesPage.tsx                   /governance/reports — statutory report template library
ReportsListPage.tsx                 /governance/reports-list — authored reports list (routed through boards)
ReportAuthoringPage.tsx             /governance/reports-list/:id — FULL-SCREEN section editor (PageHeader-EXEMPT)
MyReportsPage.tsx                   /governance/my-reports — personal drafts/with-PgM/amendments workspace
MeetingsPage.tsx                    /governance/meetings — schedule/minutes/decisions per governance body
FrameworkPage.tsx                   /governance/framework — four-tier governance model editor + publish
ProjectGovernanceDocsPage.tsx       /governance/project-docs — versioned per-project governance documents
ArchivePage.tsx                     /governance/archive — immutable sealed-record register + FOI CSV export
BoardCalendarPage.tsx               /governance/board-calendar — read-only scheduled-meeting calendar
EditorSandboxPage.tsx               /governance/editor-sandbox — dev/test surface for the editor (PageHeader-EXEMPT)
```

#### `/web/features/technicalAssurance/pages/` — Technical Assurance page group (sidebar group "Technical Assurance")
A feature module under `web/features/` (pages in `pages/`, components in `web/features/technicalAssurance/components/`,
including `tabs/` and `utils/` subdirs). Same depth/import conventions as the governance feature above.
```
EnquiriesListPage.tsx               /technical-assurance/enquiries — enquiry list + decision-log PDF export
EnquiryWorkspacePage.tsx            /technical-assurance/enquiries/:id — detail workspace, BACK-BUTTON header (PageHeader-EXEMPT)
RfiRegisterPage.tsx                 /technical-assurance/rfis — workspace-wide RFI register
AuditDashboardPage.tsx              /technical-assurance/audit — Compliance Lead audit/feedback review
```

#### `/web/features/resourcePlanner/` — Resource Planner page group (sidebar group "Resource Planner")
A feature module that rebuilds the "Resource Profile" Excel FTE-forecasting model as 6 pages. Pages in
`pages/`, components in `components/` (same depth/import conventions as governance/TAC). The maths lives
in the pure lib `web/lib/resourcePlanner/` (above); pages/store NEVER re-derive demand inline. View = any
signed-in user; **create/edit/delete/import + assumptions + capacity inputs = Client Admin / Programme
Manager / Super Admin** (store `canManageResourcePlanner()` = `isAtLeastProgrammeManager`). Tenant-scoped
data, so NOT reset on project/programme switch.
```
pages/DashboardPage.tsx             /resource-planner/dashboard — KPIs (StatsCard): Schemes, Total homes,
                                    Peak quarter FTE, Total FTE-quarters, Total cost (£), Peak headcount
                                    (3×2 grid) + Recharts FTE-by-FY (stacked by role) + FTE-by-complexity
                                    + cost-by-FY bars + capacity supply-vs-demand; FteExplainer panel;
                                    shared SchemeFilters; skeleton while `!resourcePlannerLoaded`.
pages/SchemeRegisterPage.tsx        /resource-planner/schemes — DynamicTable register + SchemeModal
                                    (add/edit) + ImportModal (Excel import). Edit gated.
pages/DemandForecastPage.tsx        /resource-planner/forecast — per-quarter DemandGrid (By role /
                                    complexity / scheme) + FTE/£/People unit toggle + filters +
                                    peak/total summary + FteExplainer. In the By-role view, when
                                    resources-in-post exist, renders Actual + Variance rows under each
                                    Demand row (and totals).
pages/CapacityPage.tsx              /resource-planner/capacity — "By role": in-post vs required FTE per
                                    role per quarter (red/green balance grid) + editable ResourcesInPostGrid.
                                    "By person": PeopleCapacityGrid ("who can take on more"). Summary
                                    StatsCards per view. Save persists in-post + person availability via
                                    the assumptions doc. Edit gated.
pages/TimelinePage.tsx              /resource-planner/timeline — GanttTimeline (per-scheme stage bands)
                                    with calendar-date hover + "today" column marker.
pages/AssumptionsPage.tsx           /resource-planner/assumptions — RateCardEditor (5 roles × 4 stages ×
                                    6 bands) + complexity-map editor + overhead/leave % + costing
                                    (per-role day rate £ + working days/quarter) + capacity supply +
                                    horizon. Edit gated.
components/RpEmptyState.tsx         Shared empty state (stacked tiles + page icon + optional "+" badge +
                                    title/description + optional CTA via `showAction`). Reused across pages.
components/SchemeFilters.tsx        Shared Programme/Batch/Route/Status/Complexity filter bar +
                                    `applySchemeFilters` (used by Dashboard, Forecast, Timeline, Capacity).
components/FteExplainer.tsx         Collapsible "What do these numbers mean?" panel (client FTE copy + a
                                    live overhead/leave uplift worked example, e.g. 0.20 → 0.27). Props
                                    `overheadPct`/`leavePct`; presentational. On Dashboard + Demand Forecast.
components/ResourcesInPostGrid.tsx  Editable role × quarter "resources in post" grid (controlled; today
                                    highlight; read-only renders plain numbers). The shared capacity/actuals input.
components/PeopleCapacityGrid.tsx   Person × quarter committed-vs-availability grid (green headroom / red
                                    over-allocated) with an inline editable availability (FTE) per person.
components/DemandGrid.tsx           Per-quarter matrix; `unit` ('fte'|'gbp'|'people'); rows carry FTE
                                    `values` + optional precomputed `costValues` (£, per-role rates);
                                    people = ceil(FTE); tint normalised on FTE.
components/{RateCardEditor,SchemeModal,ImportModal,GanttTimeline}.tsx   other per-page building blocks.
```

#### `/web/components/historicalReporting/` — As-of-month reporting primitives
Used across governance pages (and elsewhere) to drive historical/point-in-time views.
```
MonthPicker.tsx                     As-of-month selector; drives `asOfMonth` on aggregator endpoints.
                                    Sits in the PageHeader `actions` slot on governance pages.
HistoricalBanner.tsx                Read-only banner shown when a past month is selected.
CorrectionModal / CorrectionBadge / CorrectionHistory / HistoricalContentSkeleton / HistoricalEmptyState
```
Backed by the `useHistoricalView` / `useHistoricalMonthMulti` hooks in `web/hooks/`.

#### `/web/pages/public/` — Public marketing pages
```
About.tsx             About the company
Contact.tsx           Contact form page
Product.tsx           Product feature page
News.tsx              News article list
NewsArticle.tsx       Individual news article
Support.tsx           Support/FAQ page
```

---

### `/web/store/`
```
useStore.ts           (2000+ lines) Single Zustand store: all app state, API calls, derived selectors
```

### `/web/lib/`
```
exportUtils.ts                     SINGLE SOURCE OF TRUTH for client-side Excel export. Exports
                                   `exportContextData(opts: ExportContextOpts)` — filters arrays by
                                   contextId (project or programme), then writes page-specific XLSX:
                                   'issues' → Issues Register (19 cols), 'risk' → Risk Register (25 cols),
                                   'tracker'/'compliance' → Compliance Tracker/Items (9 cols),
                                   'full' → multi-sheet bundle. Used by PageActions on all 7 pages.
                                   Never re-implement export inline in a page; always extend this file.
api.ts                             API client: all frontend→backend calls via action-dispatch pattern.
                                   `addEvidence(projectId, document, file?)` accepts optional
                                   `{ base64, mime }` file payload (server uploads via uploadAsset).
                                   API_URL resolves: desktop → `window.cedar.apiBaseUrl`; web → `/api`.
firebase.ts                        Firebase client init. Exports `auth`, `db`, `messaging`,
                                   `googleProvider`, `loginWithGoogle`, `logout`, `sendMagicLink`,
                                   `confirmMagicLink`, `isMagicLink`. Does NOT export `storage` —
                                   no client code uses the Storage Web SDK (would break on desktop).
roles.ts                           Role hierarchy helpers (isAtLeastClientAdmin, isSuperAdmin, etc.)
utils.ts                           Utility functions: ID generation, date formatting, markdown stripping
chatTransport.ts                   AI chat streaming transport. Uses `authBridge.getIdToken()` +
                                   `window.cedar.apiBaseUrl` (mirrors api.ts) so it works on web AND
                                   desktop. Never reads `auth.currentUser` directly.
riskMetrics.ts                     Shared risk-score / ALE helpers + thresholds — SINGLE SOURCE OF TRUTH for
                                   getGrossScore / getResidualScore / getGrossALE / getResidualALE /
                                   SEVERE_SCORE_THRESHOLD (= 19) / MAJOR_SCORE_THRESHOLD (= 12). Used by
                                   Dashboard, RiskBurnDown, RiskCallout, AIInquiryPopup.
riskConversion.ts                  SINGLE SOURCE OF TRUTH for the Risk-to-Issue conversion alert system.
                                   Pure module: `evaluateConversion(risk, allRisks)` → `{ isTrending,
                                   score, reasons[], factors[] }` scoring 8 signals (severity, overdue,
                                   stale review, escalated, residual-over-appetite, unmitigated,
                                   probability-trend, dependency-cascade) into a plain-English "why".
                                   Tunable constants: CONVERSION_MIN_FACTORS (= 2), STALE_REVIEW_DAYS
                                   (= 90), PROB_TREND_MIN_SNAPSHOTS (= 2), CONVERSION_SEVERITY_THRESHOLD
                                   (= MAJOR_SCORE_THRESHOLD), APPETITE_CEILING map. Also exports
                                   `conversionAction(result)`. Imports scores ONLY from riskMetrics.ts;
                                   never re-derives. Consumed by RiskRegister, ProgrammeRiskRegister,
                                   RiskAlerts.
validation.ts                      SINGLE SOURCE OF TRUTH for the Fact-Check / Validation feature
                                   (pure, framework-agnostic). Types: `ValidationStatus`
                                   (unchecked|awaiting_validation|validated|rejected), `ValidationSurface`
                                   (risk|compliance|technical|mitigation|outlook|chat), `FactCheckResult`
                                   (claims[] + ratingFlags[] + overallConfidence + summary),
                                   `ValidationCitation`, `ValidationAttachment`, `ValidationRecord`.
                                   Constant `CONFIDENCE_SOFT_FLAG` (= 0.85). Helpers `statusLabel`,
                                   `isLowConfidence`, `canValidate(role)` (→ `isAtLeastPM`),
                                   `validationKey(surface,targetId)`, `isApprovalBlocked(status)`,
                                   `hashContent(str)` + `versionedTargetId(baseId, content)` —
                                   `${baseId}::${hashContent(content)}`, used to VERSION a validation by
                                   the exact AI output it checked (a new analysis ⇒ new id ⇒ fresh check).
                                   Imports only client-safe `roles.ts`; the server route builds records
                                   structurally (never imports this).
aiScope.ts                         SINGLE SOURCE OF TRUTH for resolving the ACTIVE SCOPE → human wording in
                                   AI insight prompts + dashboard labels. Pure, no React/store import.
                                   `resolveAiScope({ activeProjectId, activeProgrammeId, activeProject,
                                   activeProgramme })` → `{ scope: 'project'|'programme'|'portfolio', noun,
                                   possessive, label, healthHeading, healthLabel }`. Precedence: a project
                                   wins over a programme, else portfolio. Wording (user-locked): project →
                                   "this project"/"Project Health"; programme → "this programme"/"Programme
                                   Health"; portfolio → "this organisation"/"Portfolio Health". Consumed by
                                   RiskDashboard, Dashboard, ExecutiveReport, AIRiskID, AIComplianceSummary
                                   to drive both the AI prompt scope wording AND the static "Health" card
                                   heading. Never hardcode "Portfolio"/"organisation" at project/programme
                                   scope — resolve through this.
aiDomain.ts                        SINGLE SOURCE OF TRUTH for resolving the ACTIVE ROUTE → the AI DOMAIN a
                                   per-page AI surface must stay within. Pure (no React/store), mirrors
                                   `aiScope.ts`. `resolveAiDomain(pathname)` → `'risk' | 'compliance' |
                                   'general'`: `/risk/*` + `/monitoring/*` + `/ai/controls` (risk-mitigation
                                   tool) → 'risk'; `/compliance/*` + `/regulations` + `/ai/compliance` →
                                   'compliance'; `/regulations/cpd` + `/training` + everything else (dashboard,
                                   reports, governance, `/chat`) → 'general'. Drives the DOMAIN LOCK on the
                                   floating assistant (`AIInquiryPopup` `domain` prop) + the `chatWithAI`
                                   `domain` arg, so a risk page's AI never surfaces compliance and vice versa.
                                   Scope (`aiScope.ts`) = which entity; domain (this) = which subject area —
                                   orthogonal, used together.
demoMode.ts                        SINGLE SOURCE OF TRUTH for the client-only "Load / Clear demo data"
                                   feature's persistence. Pure (no React/store/API). State lives ONLY in
                                   localStorage (works on web AND the Electron desktop renderer's default
                                   persistent session), NEVER the database. Exports `DEMO_KEY`,
                                   `DEMO_ID_PREFIX` (= `'cgdemo-'`), `DemoFlag`/`DemoKind` types,
                                   `getDemoFlag`/`setDemoFlag(kind, prior?)`/`clearDemoFlag`, `isDemoActive`,
                                   `isDemoId(id)`. **Prefix is `cgdemo-`, NOT `demo-`** — a blanket `demo-`
                                   would collide with the existing governance seed id `demo-aspen-court`
                                   (`api/lib/projectGovernanceSeed.ts`); `cgdemo-` is verified unused repo-wide
                                   so the store guards are inert for real data. `DemoFlag.prior` stashes the
                                   real context to restore on Clear.
demoData/index.ts                  SINGLE SOURCE OF TRUTH for the static demo fixtures. Pure data (`import
                                   type` only). `buildDemoProgramme()` → a Programme (`cgdemo-prog-1`) with
                                   child projects; `buildDemoProject()` → a standalone Project
                                   (`cgdemo-proj-solo`). Each returns a `DemoBundle` { programme, projects,
                                   risks, issues, kris, complianceItems, complianceAnalysis, projectInfo,
                                   lastAnalysisResults } reusing SEED_RISKS/SEED_ISSUES/SEED_KRIS +
                                   COMPLIANCE_ITEMS, stamped with the right context ids + realistic
                                   `stage`/`status`/`dateAdded`/`completedAt` so every dashboard/chart and the
                                   Compliance/Risk setup pages render as a fully-set-up workspace. Dates are
                                   scattered with a deterministic sine-hash (no Math.random) so charts look
                                   varied + reproducible. See the Demo mode convention below.
```

#### `/web/lib/resourcePlanner/` — Resource Planner FTE demand engine (pure, riskMetrics-style)
SINGLE SOURCE OF TRUTH for the Resource Planner's FTE resource-demand model (rebuilt from the
"Resource Profile" Excel workbook). Pure — no React/store/API imports; named exports + JSDoc.
```
types.ts                           `Role` (SPM/PM/APM/StrategicLead/DefectsPM), `ComplexityBand`
                                   (Small/Mid/Large/Complex/S106-GLA/DP), `Stage` (S1–S4),
                                   `ResourceScheme`, `RateCard`, `ResourceAssumptions` (rate card,
                                   complexity map, overhead/leave %, horizon, `supplyByRole`, + costing
                                   `dayRateByRole` (per-role £/day; legacy single `dayRate` = fallback) +
                                   `workingDaysPerQuarter`, + `inPostByRoleQuarter` and
                                   `personAvailability`), `DemandMatrix`, `CapacityResult`,
                                   `PersonCapacityRow`, `CostResult`/`HeadcountResult`, axis/aggregate types.
constants.ts                       `ROLES`/`ROLE_LABELS`, `STAGES`/`STAGE_LABELS`/`STAGE_RIBA`,
                                   `COMPLEXITY_BANDS`, `FY_BASE_YEAR=2016`, `FY_START_MONTH=4`,
                                   `DEFAULT_RATE_CARD` (seeded verbatim from the ASSUMPTIONS tab:
                                   S1=col P, S2=W, S3=AD, S4=AK; StrategicLead+DefectsPM rows all 0 for
                                   the PgM to fill; S106/GLA-S1=0), `DEFAULT_COMPLEXITY_MAP`,
                                   `DEFAULT_OVERHEAD_PCT=0.2`, `DEFAULT_LEAVE_PCT=0.15`,
                                   `DEFAULT_DAY_RATE=250`, `DEFAULT_WORKING_DAYS_PER_QUARTER=65`.
quarters.ts                        April-fiscal-year quarter maths (Q1=Apr–Jun): `dateToFyQuarterIndex`
                                   (parses `YYYY-MM-DD` as LOCAL to avoid TZ drift at quarter edges),
                                   `quarterIndexToLabel`, `quarterCalendarLabel` (→ "Apr–Jun 2026",
                                   Q4 rolls to next calendar year), `currentFyQuarterIndex` (the "today"
                                   marker), `fyOfIndex`/`financialYearOf`, `fyLabel`, `buildQuarterAxis`,
                                   `horizonFromIndices`. Mirrors the sheet's EG/EJ.
compute.ts                         `normalizeScheme` (resolve complexity band, derive all-homes),
                                   `schemeStageBoundaries`, `stageAtQuarter` (S1: PlanningSubmitted→
                                   min(PlanningAchieved,SoS); S2:→SoS; S3:SoS→Handover; S4:Handover→EOD
                                   incl; MISSING boundary ⇒ that stage contributes 0 FTE),
                                   `computeDemandMatrix`, `applyOverheadAndLeave` (flat % uplift),
                                   `aggregateByFinancialYear`, `complexityAtQuarter`, `peakQuarterFte`,
                                   `totalFte`, `computeCost` (FTE × workingDays × PER-ROLE dayRate;
                                   returns per-qtr/per-FY/total + `byRole`/`byComplexity`/`bySchemeRole` £,
                                   computed by walking `bySchemeRole` so per-role rates apply to every
                                   view; on the uplifted matrix), `computeHeadcount` (peak FTE → whole
                                   people, ceil), `computeCapacity` (supply-vs-demand by role; per-quarter
                                   supply from `inPostByRoleQuarter`, falls back to flat `supplyByRole`),
                                   `ASSIGNMENT_ROLE_FIELDS`/`personKey`/`computePeopleCapacity` (person
                                   committed load from scheme assignment fields + `bySchemeRole`, vs
                                   availability default 1.0), and `buildResourcePlan` — the one-shot entry
                                   the store memoises (also returns `cost`+`headcount`; derives the horizon
                                   from data when unset). Verified by `web/__tests__/resourcePlanner.test.ts`.
```

#### `/web/lib/auth/` — Platform-agnostic auth bridge
```
authBridge.ts                      `IAuthBridge` interface + `Account` type. Selects implementation
                                   at module-load via `isDesktop`. SINGLE SOURCE OF TRUTH for "what
                                   account is signed in?" + "give me a Firebase ID token". All
                                   consumers (useStore, api.ts, AuthProvider, chatTransport, Header,
                                   Sidebar, ProfileSettingsModal, Dashboard) read from here, NEVER
                                   from `auth.currentUser` directly. The `Account` type carries:
                                   `{ uid, email, displayName, photoURL, creationTime }`.
                                   `creationTime` is ISO 8601 string or null (web: from
                                   user.metadata.creationTime; desktop: converted from Firebase
                                   signInWithIdp's createdAt ms epoch).
firebaseWebBridge.ts               Web implementation — thin wrapper around Firebase Web SDK.
desktopIpcBridge.ts                Desktop implementation — wraps `window.cedar.auth.*` IPC with a
                                   renderer-side account cache + listener set. `normalize()` helper
                                   defends against accounts persisted by older builds missing the
                                   `creationTime` field.
```

#### `/web/lib/desktop/` — Desktop detection
```
isDesktop.ts                       `export const isDesktop = !!(window.cedar ?? VITE_DESKTOP_BUILD)`.
                                   Checked at module-load by authBridge.ts to pick the right
                                   implementation; checked at render by HealthBanner, App.tsx,
                                   Login.tsx, NotificationWrapper to gate desktop-only behaviour.
```

### `/web/services/`
```
aiService.ts          (300+ lines) AI prompt construction and response parsing (compliance + risk)
api/cpdContent.ts                  CPD content fetch service
```

### `/web/data/` — Static seed/library data
```
complianceData.ts                  100+ compliance item definitions with metadata
complianceQuestions.ts             Questionnaire phase definitions (questions, options, weights)
complianceRegisterData.ts          Sample compliance register entries
riskData.ts                        Risk category definitions, KRI templates, sample risks
regulationsLibraryData.ts          Regulations library reference data
newsData.ts                        Static news articles data
```

### `/web/constants/`
```
ribaStages.ts                      RIBA project stage definitions (0–7)
```

### `/web/utils/`
```
complianceCategorization.ts        Logic for categorising compliance items by domain/type
```

### `/web/hooks/` — Custom React hooks
```
useChatStream.ts                   AI-chat streaming hook. Wraps `openChatStream` from
                                   [web/lib/chatTransport.ts](web/lib/chatTransport.ts) with
                                   stateful render-loop, abort support, tool-call + sources
                                   event handling. Consumed by ChatPage.
useFocusTrap.ts                    Modal/dialog focus trap.
useHistoricalView.ts               Historical reporting view-state hook.
useHistoricalMonthMulti.ts         Multi-month picker state for historical reporting.
useValidationGate.ts               Fact-Check / Validation gate for a (surface, targetId). Loads the
                                   validation record from the store, exposes `status`, `isValidated`,
                                   `isBlocked` (= status !== 'validated'), `loading` (true until the first
                                   status fetch resolves — so the UI shows "Checking…" instead of flashing
                                   the unchecked CTA on refresh), `runFactCheck`, `refresh`.
                                   Used by `<ValidateButton/>` and by each surface to block its
                                   approve/submit action until validated.
```

### `/api/` — Backend (Vercel serverless)
```
index.ts                           Express entry point: CORS, auth header extraction, action dispatcher.
                                   Pre-auth `?action=ping` bypass for HealthBanner (returns 200
                                   without going through createContext).
lib/context.ts                     Firebase Admin init, ApiContext creation, multi-tenancy authZ.
                                   Exposes `getStorageBucket()` which delegates to
                                   `resolveBucketName()` from `lib/storage.ts` — single source of
                                   truth for bucket-name resolution.
lib/storage.ts                     SINGLE SOURCE OF TRUTH for file uploads. `uploadAsset(path,
                                   buffer, contentType, { makePublic?: boolean })` is the canonical
                                   server-side upload helper. `deleteAsset(path)` is the canonical
                                   delete. `readAssetAsDataUri(path)` for PDF embedding. Also
                                   exports `resolveBucketName()` (env → service-account projectId
                                   fallback) + `assetPaths` (canonical path builders). Used by
                                   governance branding, evidence, TAC, report PDF sealing.
lib/tacFileUpload.ts               TAC attachment helpers. `decodeBase64TacFile`, `tacAttachmentPath`,
                                   `uploadTacAttachment` (thin wrapper around uploadAsset with
                                   `makePublic: true`), `deleteTacAttachment`. `TAC_MAX_FILE_BYTES`
                                   = 3 MB (Vercel body limit / base64 inflation); per-enquiry
                                   `TAC_MAX_ENQUIRY_BYTES` = 200 MB.
lib/activityLog.ts                 SINGLE SOURCE OF TRUTH for user-activity / audit logging. Writes
                                   to the `activityLogs` collection via `logActivity(ctx, type, {
                                   category, entityType, entityId, entityName, details })` — captures
                                   actor name + email (auto from ctx.userData/email), the entity NAME
                                   (not just id), a coarse `category`
                                   (create|read|update|delete|approve|auth|export|system|other), and
                                   an ISO `timestamp`. `logSystemActivity` for automatic/cron events.
                                   `logArrayChanges(ctx, collection, projectId, prev, next)` diffs the
                                   item arrays saved through `saveData` (risks/issues/complianceItems/
                                   kris) to log per-item create/update/delete by title (summarised
                                   above a 12-item threshold to avoid flooding). See the activity-logging
                                   convention below — ALWAYS `await` these BEFORE sending the response.
lib/aiOperationRouter.ts           Cascading AI-operation transport (OpenRouter entries → free
                                   auto-router → Gemini-direct safety-net) behind `runAIOperation`.
                                   Editable (NOT routes/ai.ts). Supports `webSearch?: boolean` — when
                                   set it enables OpenRouter's web plugin AND Gemini `googleSearch`
                                   grounding, returning normalised `citations: WebCitation[]` on the
                                   result (best-effort: a web failure yields `[]`, never throws). This
                                   is the web-sourcing engine for the fact-check feature.
lib/aiGuard.ts                     Chat input guardrail (defense-in-depth, runs BEFORE the model in
                                   chatStream). `screenChatInput(ctx, userText)` → `{allow, reason}`:
                                   (1) safety via **Meta Llama Guard** over OpenRouter
                                   (`meta-llama/llama-guard-4-12b` — open-weight/US, honours the
                                   no-Chinese-models rule; 3-8b is Cloudflare-only here + 400s the
                                   format, do NOT switch back without re-testing), (2) topical relevance
                                   via a tiny `runAIOperation` yes/no. Runs the two in parallel and
                                   **fails OPEN** (classifier error ⇒ allow + log) so it can't take chat
                                   down. Off-topic guard still works on the Gemini fallback (topical uses
                                   the router cascade); Llama Guard is OpenRouter-only (Gemini's native
                                   safety filters cover that path).
lib/resourceSchemeXlsxImport.ts    Resource Planner scheme importer (mirrors the governance
                                   `forwardPlanXlsxImport` pattern): header auto-detect, `FIELD_ALIASES`
                                   mapping the PROGRAMME PROFILE columns → scheme fields, Excel-serial→ISO
                                   dates, error/warning flags (blank name ⇒ error/skip; blank complexity
                                   ⇒ warning). Parse-only — the commit route writes.
routes/index.ts                    Aggregates all route handler maps
routes/auth.ts                     API key generate/revoke, user account deletion
routes/ai.ts                       Gemini calls with retry, dual-key fallback, quota handling.
                                   **OUT OF BOUNDS** — standing project rule, do not edit.
routes/compliance.ts               Compliance library CRUD (admin-only writes)
routes/projects.ts                 Project CRUD with multi-tenancy authorization
routes/programmes.ts               Programme CRUD with ownership checks
routes/admin.ts                    Super-admin operations: stats, users, activity, invoices
routes/data.ts                     Generic save/getData + evidence CRUD. `addEvidence` accepts
                                   optional `{ file: { base64, mime } }` payload → uploads via
                                   `uploadAsset` with makePublic, stores URL on Firestore record.
                                   `deleteEvidence` also removes the GCS object (closes orphan).
routes/profile.ts                  User profile get/save, preferences
routes/team.ts                     Team member management, role assignment, PM invites
routes/notifications.ts            FCM push notification registration
routes/technicalAssurance.ts       TAC enquiry CRUD + attachments. `tacAttachFile` takes base64,
                                   uploads via `uploadTacAttachment` (→ uploadAsset makePublic:true),
                                   stores URL on the enquiry's attachments array.
                                   `tacRemoveAttachment` deletes the GCS object then the Firestore
                                   entry. **Per-user enquiry visibility** runs through the
                                   `isTacElevated(ctx)` + `canViewEnquiry(ctx, doc)` helpers (defined
                                   beside `loadEnquiryForMutation`) — see the TAC enquiry visibility
                                   convention below.
routes/validation.ts               Fact-Check / Validation engine. `validationRunFactCheck` is a
                                   CHUNKED two-call fact-check: `buildFactCheckChunks` splits the content
                                   (one numbered item per line) into batches of `FACTCHECK_CHUNK_ITEMS`
                                   (= 25; ≤25 / prose = single pass), run with `FACTCHECK_CONCURRENCY`
                                   (= 3), capped at `FACTCHECK_MAX_ITEMS` (= 200, noted if exceeded), then
                                   merged. Each batch (`factCheckChunk`) = Call 1 web-grounded gather via
                                   `runAIOperation({ webSearch:true })` → Call 2 strict-JSON verdict
                                   (NEVER touches routes/ai.ts). 1:1 coverage is GUARANTEED: items are
                                   numbered, the model returns each claim's `index`, and the engine
                                   reconciles to exactly one claim per item (back-filling any the model
                                   skipped as `uncertain`). Persists a `ValidationRecord` to the
                                   **`validations`** collection (id = content-versioned target per
                                   tenant+surface; status `awaiting_validation`). `validationSetStatus`
                                   (PM+ only; idempotent — re-applying the same status is a no-op),
                                   `validationGet` / `validationGetForContext` (equality-only filters →
                                   no composite index), `validationAttachSource` / `validationRemoveAttachment`
                                   (link or file via `uploadAsset`, 3 MB cap). All writes `logActivity`.
routes/resourcePlanner.ts          Resource Planner CRUD — TENANT-scoped (`clientId === ctx.primaryUid`,
                                   the same key as TAC/programmes). `resourceListSchemes` (read, any
                                   signed-in tenant user; in-memory sort, no composite index),
                                   `resourceUpsertScheme`/`resourceDeleteScheme`,
                                   `resourceGetAssumptions`/`resourceSaveAssumptions` (one
                                   `resourceAssumptions/{primaryUid}` doc per tenant), and the Excel
                                   import `resourceImportSchemes{DryRun,Commit}`. Writes are gated to
                                   `canManageRP` (= isClientAdmin || `programme_manager`) with a
                                   cross-tenant doc-hijack guard; all `logActivity` awaited BEFORE the
                                   response. Collections: `resourceSchemes`, `resourceAssumptions`.
__tests__/context.test.ts          Tests for API context creation
__tests__/dispatcher.test.ts       Tests for action route dispatching
```

---

## Problem Areas

### Oversized Files (urgent)
| File | Lines | Core issue |
|---|---|---|
| `web/features/compliance/pages/ComplianceSetup.tsx` | **2301** | 4-phase form mixing UI, form state, AI API calls, data transformation, and result display all in one file |
| `web/store/useStore.ts` | **2000+** | Single store with 100+ state properties, 50+ methods, data-fetching logic, and derived selectors — impossible to test in isolation |
| `web/features/reporting/pages/Dashboard.tsx` | **1281** | Portfolio overview + AI strategic insights + complex data loading + charts all colocated |
| `web/features/compliance/pages/ComplianceTracker.tsx` | **1237** | Table rendering, inline editing, filter state, and API persistence mixed together |
| `web/features/reporting/pages/Calendar.tsx` | **1189** | Full calendar with event CRUD, compliance deadline sync, and modal management |
| `web/features/programmes/pages/ProgrammeInitiation.tsx` | **1069** | Multi-section form: validation, state, API calls, role checks all inline |
| `web/features/admin/pages/InvoiceManager.tsx` | **1030** | Invoice CRUD + PDF generation + permission checks in one component |
| `web/features/projects/pages/ProjectInitiation.tsx` | **986** | Same pattern as ProgrammeInitiation |
| `web/features/risk/pages/RiskSetup.tsx` | **951** | Multi-phase risk profiler with embedded AI calls |

### Mixed Concerns (UI + State + API in one file)
- **ComplianceSetup.tsx**: Should be split into Phase1Form/Phase2Form/Phase3Form components, a `useComplianceQuestionnaire` hook, and a results display component.
- **Dashboard.tsx**: AI insight generation, data loading, and rendering should be separated.
- **All large pages**: Pattern of `useState` for form + direct `api.*` calls inside handlers + conditional render logic — no separation layer.
- **useStore.ts**: Mixes UI state (`isDarkMode`, `isSidebarOpen`) with domain data (`risks`, `complianceItems`) with API calls (`saveData`, `fetchProjects`) in a single flat object.

### Duplicate Logic
- **Compliance item filtering**: `ComplianceDashboard.tsx` and `ComplianceTracker.tsx` both implement identical filter logic by project, status, and domain — no shared hook or selector.
- **Risk status badge colours**: Colour maps for risk severity defined inline in multiple pages instead of a shared constant.
- **API error handling**: Each page has its own try/catch error display pattern; no centralised error handler.
- **Role/permission checks**: Frontend role checks repeated across pages instead of being encapsulated in hooks or the existing `RoleGuard`.
- **URL ↔ store sync**: At least 4 pages manually sync `searchParams.get('projectId')` with `setActiveProjectId` in separate `useEffect` calls — identical pattern repeated, could be one hook.

### Other Issues
- `/web/hooks/` is sparsely populated (chat-stream, focus-trap, historical reporting, validation gate). Most cross-page repeated logic (URL↔store sync, filter state, etc.) is still inlined in components instead of factored into hooks.
- AI prompt strings (~100 lines each) hardcoded in `aiService.ts` with manual JSON healing (`parseAIResponse`) — fragile and untestable.
- Only 2 test files exist for the entire application (`context.test.ts`, `dispatcher.test.ts`) — no component tests, no store tests, no utility tests.
- Magic numbers and status strings scattered (e.g., timeout `120000`, statuses `'Verified'`/`'Pending'`/`'Open'`) instead of named constants.
- `api/lib/context.ts` duplicates authorization logic that overlaps with `firestore.rules`.

---

## State Management

All global state lives in a **single Zustand store** at `web/store/useStore.ts`. Components read state with `const { x, setX } = useStore()`.

### Auth & Identity
| State Variable | Type | File |
|---|---|---|
| `user` | `any` (Firebase User) | useStore.ts |
| `isInitialized` | `boolean` | useStore.ts |
| `clientId` | `string \| null` | useStore.ts |
| `deferredPrompt` | `any` (PWA install event) | useStore.ts |

### UI / Theme
| State Variable | Type | File |
|---|---|---|
| `isDarkMode` | `boolean` | useStore.ts |
| `isMarketingDarkMode` | `boolean` | useStore.ts |
| `isSidebarOpen` | `boolean` | useStore.ts |
| `isProfileSettingsOpen` | `boolean` | useStore.ts |
| `isMobileMenuOpen` | `boolean` | useStore.ts |

### Project / Programme Context
| State Variable | Type | File |
|---|---|---|
| `activeProject` | `Project \| null` | useStore.ts |
| `activeProgramme` | `Programme \| null` | useStore.ts |
| `activeProjectId` | `string \| null` | useStore.ts |
| `activeProgrammeId` | `string \| null` | useStore.ts |
| `projects` | `Project[]` | useStore.ts |
| `programmes` | `Programme[]` | useStore.ts |
| `currentProject` | `any` | useStore.ts |
| `projectInfo` | `any` | useStore.ts |
| `portfolioInfo` | `any` | useStore.ts |

### Compliance Data
| State Variable | Type | File |
|---|---|---|
| `complianceItems` | `ComplianceItem[]` | useStore.ts |
| `complianceAnalysis` | `any \| null` | useStore.ts |
| `customRegulations` | `RegulationItem[]` | useStore.ts |
| `remoteDomains` | `any[]` | useStore.ts |
| `lastAnalysisResults` | `any \| null` | useStore.ts |
| `isComplianceLocked` | `boolean` | useStore.ts |

### Risk Management
| State Variable | Type | File |
|---|---|---|
| `risks` | `RiskItem[]` | useStore.ts |
| `issues` | `IssueItem[]` | useStore.ts |
| `kris` | `KRI[]` | useStore.ts |
| `suggestedRisks` | `any` | useStore.ts |
| `strategicRiskAnalysis` | `any \| null` | useStore.ts |

### Notifications & Alerts
| State Variable | Type | File |
|---|---|---|
| `notifications` | `AppNotification[]` | useStore.ts |
| `acknowledgedAlerts` | `string[]` | useStore.ts |
| `snoozedAlerts` | `Record<string, number>` | useStore.ts |

### Tasks, Training & Misc
| State Variable | Type | File |
|---|---|---|
| `tasks` | `TaskItem[]` | useStore.ts |
| `lessonsLearned` | `any[]` | useStore.ts |
| `cpdModules` | `any[]` | useStore.ts |
| `pricingConfig` | `PricingConfig \| null` | useStore.ts |

### Resource Planner (tenant-scoped; NOT reset on context switch)
| State Variable | Type | File |
|---|---|---|
| `resourceSchemes` | `ResourceScheme[]` | useStore.ts |
| `resourceAssumptions` | `ResourceAssumptions \| null` | useStore.ts |
| `resourcePlannerLoading` | `boolean` | useStore.ts |
| `resourcePlannerLoaded` | `boolean` | useStore.ts |

Actions: `loadResourcePlanner(force?)` (parallel list+assumptions, `normalizeScheme` each, falls back to
`buildDefaultAssumptions` when none saved — which seeds the rate card, complexity map, overhead/leave,
horizon AND `dayRate`/`workingDaysPerQuarter`/`inPostByRoleQuarter`/`personAvailability`),
`saveResourceScheme`, `deleteResourceScheme`, `saveResourceAssumptions`, `canManageResourcePlanner()`.
Client API methods (`web/lib/api.ts`): `resourceListSchemes` / `resourceUpsertScheme` /
`resourceDeleteScheme` / `resourceGetAssumptions` / `resourceSaveAssumptions` /
`resourceImportSchemes{DryRun,Commit}`. **Costing, "resources in post" (capacity/actuals) and
per-person availability all live ON the assumptions doc** — saved via `saveResourceAssumptions`; there is
deliberately NO new collection or API action for them (`api/routes/resourcePlanner.ts` stores the whole
`assumptions` object).

### Local Component State (representative examples)
Individual pages manage transient local state via `useState`. Common patterns:
- `loading: boolean` / `error: string | null` — every page that fetches
- `formData: {...}` — every create/edit form
- `selectedItem: T | null` — row selection in tables
- `isModalOpen: boolean` — modal visibility
- `filterText: string`, `filterStatus: string` — table filters (duplicated across pages, not in store)

No `useReducer`, `createContext`, or React Context API used for state. No Redux.

---

## API Calls

All frontend API calls go through `web/lib/api.ts` using a single action-dispatch pattern:

```
POST /api?action={actionName}
Body: JSON object
Auth: Firebase ID token in Authorization header
```

### Auth & API Keys
| Action | Caller | Purpose |
|---|---|---|
| `generateApiKey` | DeveloperSettings.tsx | Create named API key |
| `getApiKeys` | DeveloperSettings.tsx | List user's API keys (masked) |
| `revokeApiKey` | DeveloperSettings.tsx | Delete an API key |
| `deleteUserAccount` | ProfileSettingsModal.tsx | Delete account and all data |

### Projects
| Action | Caller | Purpose |
|---|---|---|
| `createProject` | ProjectInitiation.tsx | Create new project |
| `getProjects` / `clientGetProjects` | useStore.ts (fetchProjects) | List accessible projects |
| `updateProject` | useStore.ts | Update project fields |
| `deleteProject` | useStore.ts | Delete project |
| `getProjectById` | useStore.ts | Fetch single project |
| `clientGetProjectData` | useStore.ts | Enriched project data for client view |
| `adminGetProjects` | admin/ProjectsTab.tsx | Super-admin project list |
| `adminDeleteProject` | admin/ProjectsTab.tsx | Admin-force delete |
| `adminTransferProject` | admin/ProjectsTab.tsx | Reassign project owner |

### Programmes
| Action | Caller | Purpose |
|---|---|---|
| `updateProgramme` | useStore.ts | Update programme |
| `deleteProgramme` | useStore.ts | Delete programme |
| `getProgrammeById` | useStore.ts | Fetch single programme |
| `adminGetProgrammes` | admin/ProjectsTab.tsx | Admin programme list |
| `adminDeleteProgramme` | admin/ProjectsTab.tsx | Admin-force delete |
| `adminTransferProgramme` | admin/ProjectsTab.tsx | Reassign owner |

### Data Persistence (generic collections)
| Action | Caller | Purpose |
|---|---|---|
| `saveData` | useStore.ts (saveData method) | Persist any collection to Firestore |
| `getData` | useStore.ts (loadProjectData etc.) | Retrieve any collection |
| `getSystemMappings` | useStore.ts | Fetch AI directive mappings |
| `savePreference` | useStore.ts | Save user preference |
| `getPreferences` | useStore.ts | Load user preferences |

### AI Services
| Action | Caller | Purpose |
|---|---|---|
| `geminiPrompt` | DeveloperSettings.tsx (test), aiService.ts | Direct Gemini call |
| `analyzeCompliance` | ComplianceSetup.tsx, aiService.ts | AI compliance gap analysis |
| `analyzeRisks` | AIRiskID.tsx, RiskSetup.tsx, aiService.ts | AI risk identification |
| `analyzeControls` | AIControlSuggestions.tsx, aiService.ts | AI control recommendations |
| `chatWithAI` | AIInquiryPopup.tsx | Conversational AI interface |

### Team & Collaboration
| Action | Caller | Purpose |
|---|---|---|
| `inviteProjectManager` | ClientTeamPanel.tsx | Email invite for PM |
| `clientGetPMs` | ClientTeamPanel.tsx | List PMs in organisation |
| `clientGetTeam` | ClientTeamPanel.tsx | List all team members |
| `clientRemoveUser` | ClientTeamPanel.tsx | Remove user from org |
| `clientUpdateUserRole` | ClientTeamPanel.tsx | Change user's role |
| `getAssignablePMs` | ProjectInitiation.tsx | PMs available to assign |

### Evidence
| Action | Caller | Purpose |
|---|---|---|
| `getEvidence` | EvidenceDocuments.tsx | List evidence docs for project |
| `addEvidence` | EvidenceDocuments.tsx | Attach evidence document |
| `deleteEvidence` | EvidenceDocuments.tsx | Remove evidence doc |

### Profile
| Action | Caller | Purpose |
|---|---|---|
| `getProfile` | useStore.ts (initStore) | Load user profile |
| `saveProfile` | ProfileSettingsModal.tsx | Save profile changes |

### Compliance Library (admin)
| Action | Caller | Purpose |
|---|---|---|
| `getComplianceLibrary` | useStore.ts | Load compliance item library |
| `upsertComplianceLibraryItem` | admin/RegulationManager.tsx | Create/update library item |
| `deleteComplianceLibraryItem` | admin/RegulationManager.tsx | Delete library item |
| `getComplianceDomains` | useStore.ts | Load domain list |
| `upsertComplianceDomain` | admin/RegulationManager.tsx | Add/update domain |

### Admin
| Action | Caller | Purpose |
|---|---|---|
| `adminStats` | admin/OverviewTab.tsx | Platform-wide statistics |
| `adminGetUsers` | admin/UsersTab.tsx | All users list |
| `adminUpdateUser` | admin/UsersTab.tsx | Edit user (role, active) |
| `adminGetActivity` | admin/ActivityTab.tsx | Activity log |
| `adminGetMappings` | admin/MappingManager.tsx | AI mapping directives |
| `adminSaveMapping` | admin/MappingManager.tsx | Save mapping |
| `adminDeleteMapping` | admin/MappingManager.tsx | Delete mapping |
| `adminGetPricingConfig` | admin/PricingTab.tsx | Load pricing config |
| `adminUpdatePricingConfig` | admin/PricingTab.tsx | Save pricing config |
| `adminCreateInvoice` | InvoiceManager.tsx | Create invoice |
| `adminGetInvoices` | InvoiceManager.tsx | List all invoices |
| `adminDeleteInvoice` | InvoiceManager.tsx | Delete invoice |
| `clientGetInvoices` | Invoices.tsx | Client's own invoices |

### Portfolio
| Action | Caller | Purpose |
|---|---|---|
| `getPortfolioData` | useStore.ts (loadAggregateData) | Portfolio-wide aggregate data |
| `clientGetPortfolioInfo` | useStore.ts | Client portfolio overview |

---

## Components Inventory

### Navigation & Layout
| Component | File | What it does |
|---|---|---|
| `Header` | components/Header.tsx | Top bar: project/programme switcher, New programme/New project buttons (icon-only at lg, full labels at xl), notifications, user menu |
| `Sidebar` | components/Sidebar.tsx | Left nav: role-gated menu groups; permanent at ≥1024px (lg), drawer at <1024px |
| `MobileHeader` | components/MobileHeader.tsx | Mobile/tablet top header — shown below 1024px (`lg:hidden`) |
| `MobileNav` | components/MobileNav.tsx | Bottom tab bar — shown below 1024px (`lg:hidden`) |
| `PageHeader` | components/PageHeader.tsx | **Canonical** page-level header with breadcrumbs, H1, subtitle, and optional `actions` slot |
| `PageActions` | components/PageActions.tsx | **Canonical** "Actions & options" dropdown — per-page context actions + data export |
| `PublicLayout` | components/public/PublicLayout.tsx | Wrapper with public header/footer for marketing pages |
| `MarketingImage` | components/public/MarketingImage.tsx | **Canonical** responsive `<picture>` (AVIF→WebP→JPEG + srcset/sizes, lazy, CLS-safe) for marketing-page imagery; variants live in `public/marketing/` |

### Auth & Route Control
| Component | File | What it does |
|---|---|---|
| `AuthProvider` | components/AuthProvider.tsx | Firebase `onAuthStateChanged` watcher; calls `initStore()` on login |
| `RoleGuard` | components/RoleGuard.tsx | Renders children only if user meets role requirement, else shows access-denied |
| `ChecklistGate` | components/ChecklistGate.tsx | Prevents action until setup checklist is complete |
| `ErrorBoundary` | components/ErrorBoundary.tsx | Top-level React error boundary with fallback UI |

### Modals
| Component | File | What it does |
|---|---|---|
| `ProfileSettingsModal` | components/ProfileSettingsModal.tsx | Edit user profile, preferences, password |
| `IssueModal` | components/IssueModal.tsx | Create/edit issue with fields: title, description, priority, owner, due date |
| `RiskModal` | components/RiskModal.tsx | Create/edit risk with full fields: likelihood, impact, controls, links |
| `KRIModal` | components/KRIModal.tsx | Create/edit Key Risk Indicator with thresholds |
| `MilestoneManager` | components/MilestoneManager.tsx | Milestone list with add/edit/complete and history timeline |
| `DeliveryTeamCRUD` | components/DeliveryTeamCRUD.tsx | Add/edit/remove delivery team members |
| `DetailsModal` | components/DetailsModal.tsx | Generic read-only details modal |

### AI Components
| Component | File | What it does |
|---|---|---|
| `AIErrorAlert` | components/AIErrorAlert.tsx | Formats and displays AI/API errors with recovery suggestions |
| `AIInquiryPopup` | components/AIInquiryPopup.tsx | Chat popup for asking AI about compliance/risk items |
| `AIWriter` | components/AIWriter.tsx | AI-assisted text generation (risk descriptions, report text) |
| `GlobalAIAssistant` | components/GlobalAIAssistant.tsx | App-wide floating AI-assistant FAB (mounted in [`web/App.tsx`](web/App.tsx) authenticated shell). Route-aware context label (`CONTEXT_LABELS`) + `domain` (via [`resolveAiDomain`](web/lib/aiDomain.ts)) for the per-page DOMAIN LOCK. On mobile it floats above the `MobileNav` bar (see Mobile responsiveness conventions). |

### Compliance Components
| Component | File | What it does |
|---|---|---|
| `ComplianceQuestionnaire` | components/compliance/ComplianceQuestionnaire.tsx | Multi-phase questionnaire for compliance profiling |
| `AnalysisSummary` | components/compliance/AnalysisSummary.tsx | Displays AI compliance analysis with scores, gaps, recommendations |
| `PublicationChecklist` | components/PublicationChecklist.tsx | Pre-publish checklist modal with pass/fail items |

### Admin Components
| Component | File | What it does |
|---|---|---|
| `OverviewTab` | components/admin/OverviewTab.tsx | Platform stats: user count, project count, revenue |
| `UsersTab` | components/admin/UsersTab.tsx | User list with role editor and deactivation |
| `ActivityTab` | components/admin/ActivityTab.tsx | Paginated activity log |
| `ProjectsTab` | components/admin/ProjectsTab.tsx | All projects across all clients with admin actions |
| `PricingTab` | components/admin/PricingTab.tsx | Per-tier pricing configuration editor |
| `MappingManager` | components/admin/MappingManager.tsx | AI system mapping directive CRUD |
| `RegulationManager` | components/admin/RegulationManager.tsx | Regulation library item CRUD |

### Common
| Component | File | What it does |
|---|---|---|
| `EmptyState` | components/common/EmptyState.tsx | Reusable empty-list state (icon + title + description + optional CTA) |
| `PremiumAIBanner` | components/common/PremiumAIBanner.tsx | Upgrade banner shown when AI feature requires higher tier |
| `NotificationWrapper` | components/NotificationWrapper.tsx | react-hot-toast `<Toaster>` provider |
| `InfoTooltip` | components/InfoTooltip.tsx | `?` icon with hover tooltip text |
| `UserAvatar` | components/UserAvatar.tsx | Shared avatar — `<img src={photoURL}>` with `onError` fallback to gradient initials badge. Three sizes (sm/md/lg). Used by Header, Sidebar, MobileHeader; required for any new avatar rendering. |

### Pages — Compliance
| Component | File | What it does |
|---|---|---|
| `ComplianceSetup` | pages/ComplianceSetup.tsx | 4-phase compliance profiler wizard; AI analysis trigger and result display |
| `ComplianceDashboard` | pages/ComplianceDashboard.tsx | Compliance KPI cards and item status overview |
| `ComplianceTracker` | pages/ComplianceTracker.tsx | Filterable table of all compliance items with inline status updates |
| `ComplianceProfiler` | pages/ComplianceProfiler.tsx | Entry point for starting a compliance profiling session |
| `ComplianceAlerts` | pages/ComplianceAlerts.tsx | Active compliance breach and warning alerts |
| `LinkedRegs` | pages/LinkedRegs.tsx | Regulations linked to selected compliance items |
| `EvidenceDocuments` | pages/EvidenceDocuments.tsx | Upload, view, and delete evidence documents per project |

### Pages — Risk
| Component | File | What it does |
|---|---|---|
| `RiskSetup` | pages/RiskSetup.tsx | Risk profiler wizard with KRI configuration |
| `RiskDashboard` | pages/RiskDashboard.tsx | Risk overview: heat map, category pie charts, KRI gauges |
| `RiskRegister` | pages/RiskRegister.tsx | Full risk register table with sort/filter |
| `RiskTracker` | pages/RiskTracker.tsx | Risk monitoring timeline and status tracking |
| `RiskAlerts` | pages/RiskAlerts.tsx | Active risk threshold breach alerts |
| `RiskIssues` | pages/RiskIssues.tsx | Issues that escalated from or link to risks |
| `AIRiskID` | pages/AIRiskID.tsx | AI-assisted risk discovery workflow |
| `RiskIdentifier` | pages/RiskIdentifier.tsx | Manual risk identification tool |
| `RiskAggregation` | pages/RiskAggregation.tsx | Portfolio-level risk roll-up view |

### Pages — Reporting
| Component | File | What it does |
|---|---|---|
| `ExecutiveReport` | pages/ExecutiveReport.tsx | Exportable PDF executive summary |
| `ProjectReport` | pages/ProjectReport.tsx | Full project status report with charts |
| `ProgrammeReport` | pages/ProgrammeReport.tsx | Programme-level consolidated report |
| `ClientProgrammeReport` | pages/ClientProgrammeReport.tsx | Client-facing programme summary report |
| `TrendsHeatmaps` | pages/TrendsHeatmaps.tsx | Heatmap visualisations of risk/compliance trends |
| `KRITracker` | pages/KRITracker.tsx | KRI status dashboard with threshold indicators |

### Pages — Programme & Project
| Component | File | What it does |
|---|---|---|
| `Programmes` | pages/Programmes.tsx | Programme list with status cards and actions |
| `ProgrammeInitiation` | pages/ProgrammeInitiation.tsx | Create/edit programme multi-section form |
| `ProgrammeSetup` | pages/ProgrammeSetup.tsx | Initial programme setup flow |
| `ProgrammeContext` | pages/ProgrammeContext.tsx | Programme context and background configuration |
| `ProgrammeRiskRegister` | pages/ProgrammeRiskRegister.tsx | Programme-scoped risk register table |
| `ProgrammeIssues` | pages/ProgrammeIssues.tsx | Programme-level issue list |
| `Projects` | pages/Projects.tsx | Project list with status cards |
| `ProjectInitiation` | pages/ProjectInitiation.tsx | Create/edit project multi-section form |
| `ProjectPlan` | pages/ProjectPlan.tsx | Project milestone and delivery plan |
| `NewProgramme` | pages/NewProgramme.tsx | New programme creation wizard |

### Pages — Admin & Settings
| Component | File | What it does |
|---|---|---|
| `AdminPanel` | pages/AdminPanel.tsx | Super-admin dashboard with tabbed sub-sections |
| `ClientTeamPanel` | pages/ClientTeamPanel.tsx | Client admin: invite PMs, manage team, assign roles |
| `WorkspaceSettings` | pages/WorkspaceSettings.tsx | Organisation name, branding, API settings |
| `BillingPanel` | pages/BillingPanel.tsx | Subscription tier, billing info |
| `InvoiceManager` | pages/InvoiceManager.tsx | Invoice CRUD with PDF generation (admin-only) |
| `Invoices` | pages/Invoices.tsx | Invoice list for client users |
| `CostCalculator` | pages/CostCalculator.tsx | Fee estimation calculator |
| `DeveloperSettings` | pages/DeveloperSettings.tsx | API key management and Gemini test console |
| `APIDocs` | pages/APIDocs.tsx | In-app API documentation |

### Pages — Learning & Support
| Component | File | What it does |
|---|---|---|
| `RegulationLibrary` | pages/RegulationLibrary.tsx | Searchable regulations reference library |
| `CPDTraining` | pages/CPDTraining.tsx | CPD training module viewer |
| `LessonsLearned` | pages/LessonsLearned.tsx | Lessons-learned repository on `DynamicTable` (category filter, search on title/problem/resolution, delete-with-confirm). Preserves the Capture modal (with AIWriter suggestions) and the rich View modal (Problem / Resolution / Prevention). |
| `HelpCenter` | pages/HelpCenter.tsx | In-app help documentation |
| `Calendar` | pages/Calendar.tsx | Event calendar with compliance/milestone deadlines |
| `MyTasks` | pages/MyTasks.tsx | Personal action register on `DynamicTable`. Merges manual tasks + actionable compliance items + risk reviews + issue deadlines into one feed. Three filters (timeline / source / context), bulk delete with confirm, pagination. **Creating a manual task MUST stamp `owner` (the table filters manual tasks by owner) AND the active context (`projectId`/`programmeId`/`projectName`/`isProgrammeLevel`), mirroring the Calendar create flow** ([`Calendar.tsx`](web/features/reporting/pages/Calendar.tsx)) — an owner-less or context-less task is dropped from the table (it would only surface in the Calendar) and the Source column can't resolve its project/programme name. |

### Pages — AI
| Component | File | What it does |
|---|---|---|
| `AIControlSuggestions` | pages/AIControlSuggestions.tsx | AI-recommended control measures |
| `AIComplianceOutlook` | pages/AIComplianceOutlook.tsx | AI forward-looking compliance forecast |

### Pages — Public
| Component | File | What it does |
|---|---|---|
| `Landing` | pages/Landing.tsx | Public marketing landing page |
| `Login` | pages/Login.tsx | Firebase email/password login form |
| `About` | pages/public/About.tsx | About the company |
| `Contact` | pages/public/Contact.tsx | Contact form |
| `Product` | pages/public/Product.tsx | Product feature overview |
| `News` | pages/public/News.tsx | News article list |
| `NewsArticle` | pages/public/NewsArticle.tsx | Individual news article |
| `Support` | pages/public/Support.tsx | Support FAQ page |

---

## Key Conventions

### File Naming
- **Components and pages**: PascalCase — `Header.tsx`, `ComplianceSetup.tsx`, `AIRiskID.tsx`
- **Utilities, lib, services**: camelCase — `api.ts`, `firebase.ts`, `aiService.ts`, `utils.ts`
- **Data files**: camelCase — `complianceData.ts`, `riskData.ts`
- **Test files**: `*.test.ts` suffix — `context.test.ts`
- **API route files**: camelCase — `auth.ts`, `compliance.ts`, `projects.ts`

### Folder Structure Patterns
- **Feature-first** (see the Structure Update at the top): route-level pages live in
  `web/features/<domain>/pages/` for all 11 domains (governance, technicalAssurance, risk, compliance,
  programmes, projects, reporting, admin, learning, chat, resourcePlanner). Only `Login`, `Landing`, and
  `public/` stay flat in `web/pages/` (public/auth).
- `web/components/` is the **shared component library** (used across features) — lowercase sub-folders:
  `layout/`-shell pieces (Header, Sidebar, Mobile*), `common/`, `table/`, `validation/`, `dashboard/`,
  `admin/`, `compliance/`, `chat/`, `forms/`, `historicalReporting/`, `onboarding/`, `desktop/`, `public/`.
  (governance/ + technicalAssurance/ components moved INTO their features.)
- `shared/` (repo root) holds code used by BOTH `web/` and `api/`: `shared/constants/roleConstants.ts`,
  `shared/types/{historicalReporting,technicalAssurance}.ts`, `shared/lib/composerModels.ts` — relative
  `.js` imports, never a path alias.
- `/web/hooks/` holds useChatStream, useFocusTrap, useHistoricalView, useHistoricalMonthMulti, useValidationGate — new cross-page hooks go here
- No `contexts/` directory — all context via Zustand store
- Backend under `/api/` with `lib/` and `routes/` sub-folders
- Static data under `/web/data/`; app-wide constants under `/web/constants/`

### Export Style
- **Components and pages**: `export default function ComponentName()` (default exports)
- **Utilities and lib**: `export const functionName` / `export function` (named exports)
- **Store**: `export const useStore = create(...)` (named export)
- **Types**: `export type TypeName = ...` (named exports, often in same file as usage)
- **Data files**: named exports — `export const complianceItems = [...]`

### Import Style
- Absolute path alias `@/` maps to repo root (defined in `tsconfig.json`)
- Components import via `@/components/Header`, utilities via `@/lib/api`, store via `@/store/useStore`
- Relative imports rare and mostly in same-feature sub-folders
- No barrel `index.ts` files — every import targets specific file

### State & Props Patterns
- **Global/shared state**: Zustand store destructured at top of component — `const { user, risks, setActiveProject } = useStore()`
- **Local/transient state**: `useState` inline in the component where it's used
- **No prop drilling**: components read from store directly rather than receiving props
- **No React Context API** used anywhere for state

### API Call Pattern
```ts
// All calls go through web/lib/api.ts
const result = await api.someAction(params);
// Which dispatches: POST /api?action=someAction with JSON body
```
- All requests are `POST` regardless of semantics
- Firebase ID token sent in `Authorization: Bearer <token>` header
- Errors thrown as `ApiError` with `.status` and `.message`
- Default timeout: 120000ms (120s) for AI calls

### Backend Route Pattern
```ts
// Each route file exports a map of action name → handler function
export const authRoutes = {
  generateApiKey: async (req, res, ctx) => { ... },
  revokeApiKey: async (req, res, ctx) => { ... },
};
```
- `ctx` is the `ApiContext` from `api/lib/context.ts` — contains `uid`, `clientId`, `isAdmin`, `isAuthorizedForContext()`
- Authorization always checked at start of handler via `ctx.*` helpers

### Activity / audit logging convention (server-side)
All user-activity / audit logging goes through the helpers in [`api/lib/activityLog.ts`](api/lib/activityLog.ts) and writes to the **`activityLogs`** Firestore collection (read back by `adminGetActivity` → the admin **Activity Log** tab). There is one audit surface (the Activity Log tab) and one collection — do not add a parallel collection or a second tab.

- **Always `await` the log call BEFORE sending the response** — e.g. `await logActivity(ctx, 'project_updated', {...}); return res.status(200).json(...)`. This is load-bearing: a fire-and-forget write placed *after* the response (or a centralized post-response dispatcher hook) is killed by Vercel's serverless teardown when the response ends, so records are silently lost. Logging inside the handler before the response guarantees the write completes within the live invocation. (Do NOT re-introduce a post-response central hook for this.)
- **Capture who + what + when, all human-readable.** `logActivity` auto-fills the actor's `userName` (from `ctx.userData.displayName/name/companyName`) + `email` + `uid`. The caller passes the entity's **NAME** (`entityName`) — not just the id — fetching it first when the payload doesn't include it (read the doc before a delete; re-read after a partial update). `timestamp` (ISO 8601) is stamped automatically.
- **Record shape:** `{ type, category, uid, userName, email, clientId, entityType, entityId, entityName, details, timestamp }`. `category` is the coarse bucket used by the UI filters + colour: `create | read | update | delete | approve | auth | export | system | other`.
- **Array-saved collections** (`risks` / `issues` / `complianceItems` / `kris`, persisted whole through `saveData`): use `logArrayChanges(ctx, collection, projectId, prev, next)` — it diffs old vs new by item id and logs per-item create/update/delete *by title*, summarising above a 12-item threshold to avoid flooding.
- **System / automatic events** (cron, escalations) use `logSystemActivity(ctx, type, {...})` (category `system`).
- **Reads are logged sparingly (Option A — meaningful views only):** opening a specific record (e.g. `project_viewed`, `evidence_viewed`, `report_viewed`, `enquiry_viewed`). Do NOT log high-volume background reads (dashboard aggregates, `getData`, `getProfile`).
- **Coverage is app-wide.** Every CRUD handler logs — compliance, risk, projects/programmes, team, admin, auth, evidence, invoices, AND the Governance + Technical Assurance modules (meetings, forward plan, reports, project docs, framework, templates, enquiries, RFIs, cost rates). Approval transitions log via `writeReportAuditEvent` (governance) + per-handler `logActivity` (TAC). Deliberately NOT logged: meeting sub-item tweaks (minutes/decisions/action-items — captured in meeting history), RFI draft autosave (noisy; only *issued* logs), and the high-volume reads above.
- New CRUD handlers MUST add a `logActivity` call following this pattern; new event `type`s render automatically (the table humanises `type` and colours by `category` — no enum to extend, though `ACTIVITY_ICONS` in `admin/constants.tsx` can give a nicer label).

### Technical Assurance (TAC) enquiry visibility convention (server-side — load-bearing)
A TAC enquiry is **owner-scoped**, not just tenant-scoped: a regular user may only see enquiries they **created** OR that are **shared with them**; elevated roles see all. This is enforced in [`api/routes/technicalAssurance.ts`](api/routes/technicalAssurance.ts) by **two helpers defined beside `loadEnquiryForMutation`** — use these, never re-derive the rule inline:
- **`isTacElevated(ctx)`** → delegates to `isComplianceLeadCtx(ctx)`, i.e. the override set is **Super Admin + Client Admin + Compliance Lead** (the first two are already folded into `isComplianceLeadCtx`).
- **`canViewEnquiry(ctx, doc)`** → `isTacElevated(ctx) || doc.ownerUid === ctx.uid || doc.shares?.some(s => s.sharedWith === ctx.uid)`. An **owner-less** record (legacy/seeded with no `ownerUid`) matches neither regular branch, so only elevated roles see it — that is the intended default.
- **One predicate drives BOTH the list filter AND the detail guard**, so what a user sees in the list and what they can open by id/URL can never disagree. `shares[]` is an array-of-objects, so the OR can't be a Firestore query — `canViewEnquiry` is applied **in memory** after a `where clientId == primaryUid` fetch (same pattern as `tacListSharedWithMe` / `tacListAuditFlagged`); no composite index needed.

Where it applies:
- **List** (`tacListEnquiries`): `.filter(d => canViewEnquiry(ctx, d))` over the tenant fetch.
- **Detail / deliverable** (`tacGetEnquiry`, `tacGetEnquiryDeliverable`): after the tenant check, `return 403 { code: "FORBIDDEN" }` if `!canViewEnquiry`. Direct-link access is hard-blocked, not just hidden.
- **Mutations / exports** (`tacUpsertEnquiry` edit, attachments, close, archive, cost CSV, compliance pack, share, golden thread): go through `loadEnquiryForMutation` (owner-or-Client-Admin) — deliberately stricter than view (a share *recipient* can view but not mutate/export).
- **RFI register** (`tacListRfis`): RFIs have **no owner field**, so visibility is **project-based** — a single-project view requires `ctx.isAuthorizedForContext(projectId)`; the no-project register filters RFIs to projects the user is authorised for (distinct-project authz, one check per project; admin/Client-Admin/PM-of-project resolve via the existing helper). Note: a standalone Compliance Lead (not also admin/Client-Admin) sees only their own-project RFIs — RFI scope is project-based, NOT widened by `isTacElevated`.
- **Project-scoped outputs** (`tacListProjectReportEnquiries`, `tacExportDecisionLog`): already gated on `ctx.isAuthorizedForContext(projectId)` and stay **project-scoped** (not per-user) so a project report/decision-log is complete for everyone on the project.
- **Audit/oversight** (`tacListAuditFlagged`, `tacUnlockEnquiry`, flag/resolve) are Compliance-Lead gated; `tacScanCitationIntegrity` is admin gated.

Seed note: `seedTacEnquiriesIfMissing` stamps `ownerUid: ctx.uid` (the first user to open the list) and seeds once per workspace — so the seeder sees the samples and other tenant users correctly don't.

### Styling
- Pure **Tailwind CSS v4** (Vite plugin; no `tailwind.config.js`) — no CSS modules, no styled-components, no SCSS
- `clsx()` for conditional class names: `clsx('base-class', condition && 'extra-class')`
- `tailwind-merge` used where conflicting utility classes need resolution
- Dark mode via `isDarkMode` store flag + `dark:` variant classes
- Colour palette mostly Tailwind's `indigo-*`, `slate-*`, `emerald-*`, `red-*`
- **Scoped CSS exception**: [`web/pages/Login.tsx`](web/pages/Login.tsx) ships a custom OKLCH-palette design under a `.cg-login-root` scope (CSS embedded as a `<style>` block in the component). This is a deliberate exception — Login is on the typography exclusion list and the design uses features (custom OKLCH operations, scoped CSS variables, keyframe animations) that don't translate cleanly to Tailwind. **Do not extend this pattern to other pages** — Tailwind remains the rule everywhere else.

### Page wrapper convention
- The app shell wraps every authenticated page with `<main className="flex-1 overflow-y-auto p-4 lg:p-6 ...">` containing `<div className="max-w-[1600px] mx-auto">` ([`web/App.tsx`](web/App.tsx)). Pages should **not** add their own page-level padding, `max-w-*`, or `mx-auto` — that double-wraps the layout.
- Canonical page root: `<div className="space-y-6 sm:space-y-8">`. The tighter variant `space-y-5 sm:space-y-6` is reserved for sub-sections, not page roots.
- `ServiceManagementBar` has been **deleted** (M2.1). Its per-page action items now live in `PageActions` in the `PageHeader` `actions` slot.
- Every authenticated page must open with `<PageHeader title=... subtitle=... breadcrumbs={[...]} />` as the first child of the page root. Breadcrumb first item = sidebar group name (e.g. "Compliance", "Risk Management", "Account", "Programme Governance", "Technical Assurance"). **Exempt** (keep bespoke headers): full-screen wizards `ComplianceSetup` / `RiskSetup`, the full-screen editor `ReportAuthoringPage`, the dev surface `EditorSandboxPage`, and the back-button detail route `EnquiryWorkspacePage`.
- **Page-level header controls** (MonthPicker, view-mode toggles, export/publish/New buttons) go in the `PageHeader` `actions` slot — never as a sibling `<header>` block. All governance + Technical Assurance pages follow this (their former ad-hoc `<header>` blocks were migrated in the governance/TAC PageHeader batch). When the page root has no `space-y-*` (e.g. `FrameworkPage`), wrap `<PageHeader>` in a `mb-6` div to preserve spacing.

### Responsive layout breakpoints
- **Sidebar / mobile nav breakpoint: `lg` (1024px).** Below 1024px: `MobileHeader` + drawer sidebar + `MobileNav` bottom bar. At 1024px+: permanent `Sidebar` + desktop `Header`. This was changed from `md` (768px) in M2.1.
- **App shell padding**: `p-4 lg:p-6` (was `p-4 md:p-6` before M2.1).
- **Header new-context buttons**: `hidden lg:flex` container, text labels `hidden xl:inline` (icon-only at 1024–1279px, full labels at 1280px+).

### Mobile responsiveness conventions (load-bearing — verify any new two-column / form page at 375px)
Four recurring mobile-break patterns. Every new authenticated page MUST avoid them; a "responsiveness sweep" checks for them.
- **Reordered sidebars must not pin on mobile, and the primary content comes first.** A right-hand sidebar / status panel that collapses ABOVE the main content on a single-column mobile layout must (1) gate its sticky to desktop — `lg:sticky lg:top-N`, never bare `sticky top-N` (a mobile-pinned panel overlaps the content as you scroll), and (2) order the form/content FIRST on mobile (content `order-1 lg:order-1`, panel `order-2 lg:order-2`; for `flex` layouts, sidebar `order-last`, never `order-first`). Canonical examples: the `PublicationChecklist` sidebars in [`RiskSetup`](web/features/risk/pages/RiskSetup.tsx) / [`ProjectInitiation`](web/features/projects/pages/ProjectInitiation.tsx) / [`ProgrammeInitiation`](web/features/programmes/pages/ProgrammeInitiation.tsx), [`ChecklistGate`](web/components/ChecklistGate.tsx), and the stacked panels in [`Calendar`](web/features/reporting/pages/Calendar.tsx) / [`AnalysisSummary`](web/components/compliance/AnalysisSummary.tsx).
- **Never put an unprefixed `col-span-2`+ inside a `grid-cols-1` mobile grid.** A base (no `sm:`/`md:`/`lg:` prefix) `col-span-2`/`col-span-3` in a `grid-cols-1 md:grid-cols-N` grid spawns implicit columns and forces sibling fields side-by-side → overlapping labels at 375px. Always write `col-span-1 md:col-span-N` so the cell collapses to one column on mobile. (A `col-span-2` inside a *base* `grid-cols-2` parent is fine — a span is only a grid-buster when it exceeds the base column count.) This was the root cause of the New Programme / Programme Setup / MilestoneManager overlaps.
- **Fixed-width sidebars must stack on mobile.** A `flex` row holding a fixed-width sidebar (`w-80`) must be `flex-col lg:flex-row` with the sidebar `w-full lg:w-80` and the main column `flex-1 min-w-0`; a bare `flex … w-80` overflows horizontally below `lg` (see [`admin/ProjectsTab`](web/components/admin/ProjectsTab.tsx)).
- **The global AI-assistant FAB floats above the bottom nav on mobile.** [`GlobalAIAssistant`](web/components/GlobalAIAssistant.tsx) is `fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-5 lg:bottom-8 lg:right-8` so it clears the `lg:hidden` `MobileNav` bar (whose reserved height matches the app shell's `pb-[calc(env(safe-area-inset-bottom)+5rem)]`) instead of overlapping the "Projects" tab; at `lg+` (nav hidden) it sits at `bottom-8 right-8`.

### Typography — v4 calibration (load-bearing across the authenticated app)
**Geist (sans) + Geist Mono** loaded globally via Google Fonts import in [`web/index.css:1`](web/index.css#L1); Tailwind `@theme` maps `--font-sans` and `--font-mono` ([`web/index.css:7-8`](web/index.css)). `font-sans` cascades from the authenticated root in [`web/App.tsx:174`](web/App.tsx#L174).

**Canonical class strings** (lifted from [`web/features/reporting/pages/Dashboard.tsx`](web/features/reporting/pages/Dashboard.tsx) `KpiCard` at line 2349-2459):
- **Eyebrow labels** (small UPPERCASE headings): `font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500`
- **KPI big-numbers** (stat values): sans Geist + `font-medium ... tabular-nums` — NOT mono
- **Status chips / badges** (uppercase pills): `font-mono uppercase tracking-wide font-medium` + colour utilities
- **Table column headers** (`<th>`): `font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500`
- **Inline numeric badges + IDs**: `font-mono tabular-nums`
- **Kbd hints**: `font-mono text-[10px]`
- **Sub-line / footer metadata with numeric content**: `font-mono text-[11px] text-slate-500 tabular-nums`

**Bans across the authenticated app:**
- ❌ `font-black` (weight 900) — looks wrong in Geist Mono. Use `font-semibold` (600) max.
- ❌ `tracking-widest` / `tracking-tighter` on small uppercase labels. Use `tracking-wide`.
- ❌ `italic` on regular text. **PRESERVED only on**: PDF/report pages (`ExecutiveReport`, `ProjectReport`, `ProgrammeReport`, `ClientProgrammeReport`, `InvoiceManager`, `Invoices`) and rich-text editor tooling (`web/features/governance/components/{editor,extensions,templates,meetings,forwardPlan,framework,reports}/`, `web/features/technicalAssurance/components/`). Default-exclude any file using `jspdf` / `html2canvas`.
- ❌ Hardcoded score thresholds (`>= 16`, `>= 22`, etc.). Import `SEVERE_SCORE_THRESHOLD` / `MAJOR_SCORE_THRESHOLD` from [`web/lib/riskMetrics.ts`](web/lib/riskMetrics.ts).

**Stay sans (Rule 7):**
- H1 / H2 / H3 page or modal titles: `font-semibold tracking-tight`
- Body paragraphs, descriptions, helper text
- Action buttons (primary / secondary CTAs): `font-medium` — drop any inherited uppercase + tracking + bold
- Form input labels and input fields

**Exclusion list** (never touch for typography sweeps): `web/pages/Landing.tsx`, `web/pages/Login.tsx`, everything under `web/pages/public/`, `web/components/public/`, governance `.ts` extension files (HTML template strings).

### Form Handling
- **No form library** (React Hook Form, Formik, etc. not used)
- All forms: `useState` object + `onChange` handlers spread-updating state
- `onSubmit` calls store method or direct `api.*` call inline in component
- No client-side schema validation library (Zod, Yup not present)

### Modal Pattern
```tsx
const [isOpen, setIsOpen] = useState(false);
{isOpen && <SomeModal onClose={() => setIsOpen(false)} data={item} />}
// Inside modal — backdrop click to close:
onClick={(e) => e.target === e.currentTarget && onClose()}
```

### Data Flow
```
User action → Component handler → useStore method → api.ts → /api endpoint
→ Firebase Firestore → response → store.set({ ... }) → component re-render
```

### Role Values (defined in `web/lib/roles.ts`)
- `"super_admin"` — platform owner
- `"admin"` — internal admin (deprecated/same as super_admin in some checks)
- `"client_admin"` — organisation admin
- `"project_manager"` — PM within an organisation
- `"viewer"` — read-only access

### TypeScript
- `strict` mode not explicitly enabled — `noEmit` lint only via `tsc --noEmit`
- Many `any` types in store and component state (especially around Firebase user and AI responses)
- Interfaces/types defined inline in files that use them (no shared `types/` directory)

### Risk-metric conventions
- **Always import score / ALE helpers from [`web/lib/riskMetrics.ts`](web/lib/riskMetrics.ts).** Never re-derive scores inline.
  - `getGrossScore(risk)` → prefers stored `grossRating`, falls back to `calculateMatrixScore(grossL, grossI)`, then raw `L × I`.
  - `getResidualScore(risk)` → same precedence for residual.
  - `getGrossALE(risk)` / `getResidualALE(risk)` → use stored ALE if present, else recompute from `impact × probability` (handles probability as decimal or percentage).
  - `SEVERE_SCORE_THRESHOLD = 19`, `MAJOR_SCORE_THRESHOLD = 12`.
- Risk matrix cell colour bands always use `calculateMatrixScore(L, I)` from [`web/data/riskScoringMatrix.ts`](web/data/riskScoringMatrix.ts), never raw `L × I`.
- `normalizeRisk` in [`web/store/useStore.ts`](web/store/useStore.ts) backfills missing `residualALE` / `grossALE` from `impact × probability` on every risk load — downstream KPI math relies on this. It ALSO (Risk-to-Issue conversion engine) defaults `dependencies` to `[]` and seeds one stable-dated baseline `probHistory` snapshot from the current score when empty — idempotent, runs on every read site.

### Risk-to-Issue conversion conventions
- **`RiskItem` carries two engine fields** ([`web/store/useStore.ts`](web/store/useStore.ts)): `dependencies?: string[]` (ids of other risks this one depends on) and `probHistory?: ProbSnapshot[]` (`{ date, grossScore, residualScore, residualProb? }` score snapshots over time). Both are backfilled by `normalizeRisk`; `updateRisk` appends a `probHistory` snapshot whenever the calibrated score changes (the baseline seeded at load means one upward re-score is enough to register a trend). New risks pass through `normalizeRisk` so they get the baseline too.
- **All "is this risk trending toward an issue?" logic lives in [`web/lib/riskConversion.ts`](web/lib/riskConversion.ts).** Call `evaluateConversion(risk, allRisks)`; never re-implement the heuristics or hardcode the thresholds in a page. Retune the system by editing that file's constants. The engine excludes `Closed` / `convertedToIssue` risks. Scores come from `riskMetrics.ts` only.
- **Surfaces (all read from the one engine):** RiskRegister + ProgrammeRiskRegister show a "Trending" badge (with `TrendingTooltip`), an orange row tint, and a "Trending to Issue" StatsCard; RiskAlerts has a "Conversion Watch" alert group + filter tile with a "Convert to issue" button wired to the existing `convertToIssue(riskId)` store action. The dependencies multi-select lives in `RiskModal`.

### Fact-Check / Validation conventions
The "Fact Check / Validate" layer sits ON TOP of every AI output (additive — existing flows are untouched). It runs an AI fact-check, attaches sources, flags low confidence, and **blocks final approval until a PM+ validates**.
- **Types/status/threshold live in [`web/lib/validation.ts`](web/lib/validation.ts) ONLY** (pure module). Don't redefine `ValidationStatus`, `FactCheckResult`, or hardcode the soft-flag threshold — import `CONFIDENCE_SOFT_FLAG` / the helpers.
- **One Firestore collection: `validations`** — one `ValidationRecord` per `(tenant, surface, content-versioned target)`. The target id is `versionedTargetId(baseId, content)` = `${baseId}::${hashContent(content)}`, so a NEW analysis ⇒ new id ⇒ no record ⇒ a fresh check is REQUIRED (an old validation can never silently carry over to changed content). Re-running the same content overwrites; flipping status is allowed; re-applying the same status is a server-side no-op. Read back by `validationGet` / `validationGetForContext`. Do NOT add a parallel collection.
- **The AI fact-check is a CHUNKED TWO-CALL pattern, in [`api/routes/validation.ts`](api/routes/validation.ts):** the content is one NUMBERED item per line; it is batched (`FACTCHECK_CHUNK_ITEMS`=25, `FACTCHECK_CONCURRENCY`=3, cap `FACTCHECK_MAX_ITEMS`=200 with a note if exceeded), and each batch runs Call 1 = web-grounded gather via `runAIOperation({ webSearch:true })` → Call 2 = strict-JSON verdict (`responseSchema`, no web) healed by `parseAIResponse`. **1:1 coverage is guaranteed**: the model returns each claim's `index` and the engine reconciles to exactly one claim per numbered item (back-filling any the model skipped as `uncertain`), so the result count always equals the item count. Behaves identically on the OpenRouter→Gemini failover. **Never** route fact-check AI through `api/routes/ai.ts` (out of bounds) — always `aiOperationRouter`.
- **Web sourcing + citations come from `aiOperationRouter` `webSearch`** (OpenRouter web plugin + Gemini `googleSearch`, normalised to `WebCitation[]`, best-effort). The regulations corpus has NO source URLs, so the AI must never fabricate links — clickable sources are either web-search results or user-attached links/files.
- **Adding a gate to a NEW AI surface:** compute the content string at render as one **numbered, single-line, whitespace-collapsed** item per line (`` `${idx+1}. …`.replace(/\s+/g," ")``), derive `targetId = versionedTargetId(baseId, content)`, and use that SAME id for BOTH the gate selector key (`validationsByKey[\`${surface}:${targetId}\`]`) AND `<ValidateButton surface targetId content/>` (pass the content as the resolved string, not a lazy getter, so the hash matches what's sent). Gate the approve/submit action on `isBlocked` (= status !== 'validated'). For surfaces with no single approval (mitigation/outlook), one passing fact-check unlocks the per-item "Add" actions. Chat is **advisory** (per-message, immutable id — no versioning, no block).
- **PM and above validate** (`canValidate` → `isAtLeastPM`); the server re-checks the role (it can't import `roles.ts`, so it mirrors the PM+ set inline). Every fact-check / validate / reject / attach `logActivity`s (category `update`/`approve`), awaited before the response.
- **UI:** `<ValidateButton>` portals its `FactCheckPanel` modal to `document.body` (escapes transformed/animated ancestors — same rule as `TrendingTooltip`); shows the eye-catching gradient CTA only when truly `unchecked`, and a neutral disabled **"Checking…"** while `useValidationGate.loading` (the status fetch on refresh) so it never flashes the wrong state or triggers a duplicate run. On a refused/failed check it closes the panel (toast only).
- **Chat guardrail + fact-check gating:** every chat message is screened by [`api/lib/aiGuard.ts`](api/lib/aiGuard.ts) `screenChatInput` BEFORE the model (hard block, fail-open) — unsafe/off-topic prompts get the canned decline and a `factCheckable:false` flag on the `done` event. The chat Fact-check button shows ONLY when `factCheckable !== false` AND the answer has citations (so "no results / declined" answers show no button). Even then, `validationRunFactCheck` runs a cheap one-call **verifiability gate** for `surface:"chat"` — a data summary / status / "all within limits" answer (no external claims) is refused (422 "Nothing to fact-check…") before the expensive web check.
- **Chat renders markdown tables** ([`ChatMessage.tsx`](web/components/chat/ChatMessage.tsx) `renderInlineSection`) as a clean read-only styled table (mono-uppercase headers, zebra rows, h-scroll) — NOT `DynamicTable` (too heavy / needs typed columns; AI tables have arbitrary columns).

### AI chat model picker conventions
The chat model dropdown is **admin-curated and fetched fresh — no caching, no mid-view mutation.** The whole point is that a user only ever sees the models that are actually available, with no stale list flashing or models suddenly appearing/disappearing.
- **Source of truth = the Firestore doc `adminConfig/aiModelConfig`** (curated in the admin → AI Models tab; schema/validator in [`api/lib/aiModelConfig.ts`](api/lib/aiModelConfig.ts)). [`getActiveChatModels`](api/routes/admin.ts) reads this doc **DIRECTLY on every request (no in-memory/per-instance cache)** so an admin add/disable/delete is reflected on the very next read (Vercel runs multiple instances — a per-instance cache makes them disagree and is what caused the flicker; do **not** re-add one). It returns `{ chatModels: <enabled entries>, defaultModelId, hasAdminConfig }`; when the doc is MISSING it returns `chatModels: []` + `hasAdminConfig: false` (it does NOT substitute `SEED_CONFIG` — that seed still backs `loadAIModelConfig` for `chatStream`/`aiOperationRouter`, just not the picker).
- **Client = fetch ONCE on mount, skeleton until it lands, render once, never mutate** ([`ChatPage.tsx`](web/features/chat/pages/ChatPage.tsx)). No `localStorage` model-list cache, no focus/visibility revalidation, no stale-while-revalidate — those all reintroduce the "sudden change" and are banned here. The picker shows a `ShimmerSkeleton` ([`ModelSelector.tsx`](web/components/chat/ModelSelector.tsx) `loading` prop, threaded via `ChatComposer`) while the single fetch is in flight.
- **Empty / failure fallback = free-only.** When the server returns no curated models (or the fetch fails), the client renders `FREE_FALLBACK_MODELS` from [`shared/lib/composerModels.ts`](shared/lib/composerModels.ts) — `CHAT_MODELS` filtered to drop `disabled: true` rows, so the greyed-out premium "coming soon" placeholders are never shown to end users. The selection is reconciled against whatever list rendered (a stored/selected model the admin removed snaps to the default).

### AI insight scope & domain-focus conventions (load-bearing)
Every AI-generated insight must (a) name the **correct scope** and (b) **lead with the page's own domain**. Two rules:
- **Scope wording comes from [`web/lib/aiScope.ts`](web/lib/aiScope.ts) `resolveAiScope` ONLY** — never hardcode "Portfolio"/"organisation" at project/programme scope. project → "this project"/"Project Health"; programme → "this programme"/"Programme Health"; portfolio → "this organisation"/"Portfolio Health". The page computes the scope from `activeProjectId`/`activeProgrammeId` and passes it to the AI service AND uses it for the static "Health" card heading (so the label and the prose always agree).
- **`analyzeStrategicInsights(context, user, opts)` takes `{ scope?: AiScope; focus?: 'risk'|'compliance'|'portfolio' }`** ([`web/services/aiService.ts`](web/services/aiService.ts)). `focus` re-weights the prompt so each surface leads with its own domain: RiskDashboard passes `focus:'risk'` (risk/KRIs/issues/ALE first), Dashboard + ExecutiveReport pass `focus:'portfolio'` (balanced). Defaults (`focus:'portfolio'`, no scope) preserve legacy output. Compliance lifecycle/sentiment ([`analyzeComplianceLifecycle`/`analyzeComplianceSentiment`]) derive scope from the `type:'Programme'` field callers already pass (only the programme caller sets it). `analyzeContextSentence` is deliberately scope-AGNOSTIC (it analyses a user free-text sentence, not the active context).
- **Per-page DOMAIN LOCK (hard, not just `focus` re-weighting).** A single-domain page's AI must NEVER surface the other domain — a risk page's AI shows no compliance, a compliance page's AI shows no risks/issues. The domain comes from [`web/lib/aiDomain.ts`](web/lib/aiDomain.ts) `resolveAiDomain(pathname)` and the OTHER domain's data is WITHHELD at the source (not demoted):
  - **Floating assistant** ([`AIInquiryPopup.tsx`](web/components/AIInquiryPopup.tsx)): takes a `domain` prop ([`GlobalAIAssistant`](web/components/GlobalAIAssistant.tsx) passes it; per-page callers fall back to `resolveAiDomain(location.pathname)`). `buildContextData` returns `compliance: null` on a risk page / `risks:null, issues:null` on a compliance page, and withholds `lastAnalysisResults` (compliance gap analysis) on risk pages. `chatWithAI(..., domain)` then injects a "DOMAIN LOCK — RISK/COMPLIANCE ONLY" directive (default `'general'` = all data, unchanged).
  - **Insight panels**: RiskDashboard passes `compliance: null` into `analyzeStrategicInsights` (keeps `focus:'risk'`) so its summary can't reference compliance.
  - **The dedicated `/chat` page + `api/lib/chatTools.ts` stay GENERAL (cross-domain) by design** — chat tools are gated by role only, not page; do not domain-gate them.
- **`buildContextData` programme scope must include child-project rows** (`isProgLevel || belongsToProgProject`, mirroring [`Dashboard.tsx`](web/features/reporting/pages/Dashboard.tsx) ~L620) — filtering on `programmeId === activeProgrammeId` alone silently drops every child-project risk/compliance/issue at programme scope.
- **Stale per-context AI state is cleared on a context switch.** `suggestedRisks` / `strategicRiskAnalysis` are AIRiskID in-memory results NOT reloaded per-context, so `setActiveProject`/`setActiveProgramme`/`loadProjectData`/`loadProgrammeData` **and `loadAggregateData` (portfolio switch)** reset them — `loadAggregateData` also clears `complianceAnalysis`/`lastAnalysisResults` ([`web/store/useStore.ts`](web/store/useStore.ts)); RiskDashboard + Dashboard also reset their local `strategicInsights` on `activeProjectId`/`activeProgrammeId` change. Otherwise the previous context's insights linger (a "mixup").
- **Stale embedded names — resolve at the AI boundary, NEVER mutate the record.** Risk/issue records carry a denormalised `project`/`programme` NAME captured at creation and not updated on rename, so a risk on a renamed project can still embed the OLD name and the AI would name the report after it. **Fix at the prompt boundary only:** pass the authoritative `scope.label` as the CONTEXT NAME and strip the embedded `project`/`programme`/`projectName`/`programmeName`/`client` fields from any record array before serialising (see `stripStaleNames` in `analyzeStrategicInsights`, and the strip in [`ProgrammeRiskRegister.tsx`](web/features/programmes/pages/ProgrammeRiskRegister.tsx) chat context). **Do NOT "fix the root cause" by overwriting `r.project`/`r.programme` in the store** — that field is AMBIGUOUS (`ProgrammeContext.tsx` matches `p.id === r.project` as an ID; `RiskTracker.tsx` groups by it), so mutating it to always-name breaks those consumers. The backend chat tools already enrich rows with a fresh name lookup keyed by id ([`api/lib/chatTools.ts`](api/lib/chatTools.ts)).

### Refresh / skeleton conventions (dashboard surfaces)
- During `isRefreshing` (or context-switch loaders `isLoadingContent` / `loadingOverview`), every visible content surface should render a skeleton, not freeze with stale data.
- Setup-pending CTAs (`!isComplianceSetup || !isRiskSetup`) must be **gated on `!isLoadingContent && !loadingOverview && !isRefreshing`** — otherwise they flash during the gap between previous-context-clear and new-context-load.
- Available skeleton helpers in [`web/features/reporting/pages/Dashboard.tsx`](web/features/reporting/pages/Dashboard.tsx): `SkeletonStatCards`, `SkeletonBar`, `SkeletonTable`, `SkeletonMatrix`, `SkeletonCriticalList`, `SkeletonSidePanel`, `SkeletonProjectsGrid`, `SkeletonRiskSummary`, `SkeletonIssueSummary`.

### AI inquiry / StrictMode
- `<React.StrictMode>` is enabled in [`web/main.tsx`](web/main.tsx). Any effect that calls a side-effectful function (API call, navigation) must be **idempotent** or **guarded with a ref**. See [`web/components/AIInquiryPopup.tsx`](web/components/AIInquiryPopup.tsx) — `autoSentRef` prevents StrictMode from firing two AI requests for the same prefilled prompt.

### Table conventions
- **`DynamicTable` is canonical** for any list page that needs search, filters, pagination, selection, or row/bulk actions. Do not hand-roll `<table>` markup, do not introduce a separate table library, and do not build a page-level confirm modal — DynamicTable ships all of that. Component: [`web/components/table/DynamicTable.tsx`](web/components/table/DynamicTable.tsx); public types: [`web/components/table/types.ts`](web/components/table/types.ts).
- **Reference patterns** (copy from these when migrating a new page):
  - Minimal (no actions, just search + columns): [`web/features/programmes/pages/ProgrammeIssues.tsx:174-189`](web/features/programmes/pages/ProgrammeIssues.tsx#L174)
  - Full (row actions + bulk actions + filters + `requireConfirm`): [`web/features/risk/pages/RiskRegister.tsx:843-941`](web/features/risk/pages/RiskRegister.tsx#L843)
  - Merged-source feed with cross-field filters: [`web/features/learning/pages/MyTasks.tsx`](web/features/learning/pages/MyTasks.tsx)
- **Confirm dialog**: route destructive actions through `requireConfirm: ConfirmConfig` on the relevant `RowAction` / `BulkAction`. DynamicTable mounts [`ConfirmDialog`](web/components/table/ConfirmDialog.tsx) automatically and awaits the handler with a spinner. Never `window.confirm()`, never build a parallel modal.
- **Cross-field filter pattern**: `FilterDef.match(rowValue, filterValue)` only receives one row field. When a filter needs multiple fields (e.g. a "timeline" bucket derived from both `status` and `dueDate`), **flatten the bucket onto the row** as a derived `_underscorePrefixed` field at the `useMemo` that builds the data array, then point the filter at that synthetic key. See `_timeline` / `_contextId` / `_isOverdue` in [`web/features/learning/pages/MyTasks.tsx`](web/features/learning/pages/MyTasks.tsx). Do not subclass DynamicTable or move filter logic outside it.
- **Pagination default**: `pagination: { enabled: true, pageSize: 25, pageSizeOptions: [10, 25, 50] }` for any list that can plausibly exceed ~50 rows.
- **Page-level toolbar buttons** (e.g. "Add task", "Capture lesson") belong in DynamicTable's `toolbarActions` slot, not as a sibling above the table. The empty-state CTA is a separate `emptyState.action` slot.

### Auth / avatar conventions
- **Avatar rendering**: always use [`<UserAvatar/>`](web/components/UserAvatar.tsx). Never inline `<img src={user.photoURL}/>` — the component handles the `onError` → gradient initials fallback, so stale or revoked URLs never leave a broken-image icon. Three sizes (`sm`/`md`/`lg`) cover all current call sites (Header, Sidebar, MobileHeader).
- **`photoURL` is the canonical avatar field** on the user profile (set in [`api/routes/profile.ts`](api/routes/profile.ts) whitelist). Do **not** introduce a parallel `avatarUrl` field.
- **Profile keys are always initialized on first sign-in**: [`web/store/useStore.ts initStore`](web/store/useStore.ts) writes `photoURL` and `displayName` to the Firestore profile doc on first init, even for magic-link sign-ups where Firebase Auth supplies neither (the values may be `null`, but the keys always exist). Downstream code can assume those keys are present on every loaded profile.
- **Friendly auth errors**: when surfacing Firebase auth failures to the UI, map known error codes to safe copy and fall back to a generic message — never echo raw `err.message`. See `FRIENDLY_AUTH_ERRORS` + `friendlyAuthError()` in [`web/pages/Login.tsx`](web/pages/Login.tsx) for the current mapping.
- **Magic-link throttle**: client-side throttle for repeated magic-link submissions is **5 seconds** (`MAGIC_LINK_THROTTLE_MS`), enforced via a `useRef` timestamp in `Login.tsx`. Backend rate limits are layered on top, but the client guard keeps the UX honest.

### Auth-bridge enforcement (load-bearing for desktop)
The desktop binary signs in via Electron main-process OAuth, NOT the Firebase Web SDK. That means `auth.currentUser` is **always `null` on desktop** and the Web SDK's `signOut(auth)` is a no-op there. Any code reading those directly will silently break on desktop.

- **Never read `auth.currentUser` directly.** Read `useStore().user` (which is an `Account` from the bridge) or call `authBridge.getCurrentAccount()`. The `Account` type carries `{ uid, email, displayName, photoURL, creationTime }`.
- **Never call `logout()` from [`web/lib/firebase.ts`](web/lib/firebase.ts) directly.** Call [`authBridge.signOut()`](web/lib/auth/authBridge.ts) — on desktop it propagates to the main process and revokes the Google refresh token; on web it wraps the same `signOut(auth)`. Same for `loginWithGoogle` → `authBridge.signInGoogle()`.
- **Never use `firebase/storage` Web SDK.** It would fail on desktop (no auth session). All file ops go through the storage convention below.
- **`onAuthStateChanged(auth, ...)` direct subscriptions are forbidden** outside [`web/lib/auth/firebaseWebBridge.ts`](web/lib/auth/firebaseWebBridge.ts). Use `authBridge.onAuthChange(cb)`.
- **The five files that consume the bridge correctly** (use as templates): [api.ts](web/lib/api.ts), [chatTransport.ts](web/lib/chatTransport.ts), [Header.tsx](web/components/Header.tsx), [Sidebar.tsx](web/components/Sidebar.tsx), [ProfileSettingsModal.tsx](web/components/ProfileSettingsModal.tsx), [Dashboard.tsx](web/features/reporting/pages/Dashboard.tsx) (reads `user.creationTime` for the onboarding modal — does NOT read `auth.currentUser.metadata.creationTime`).

### Storage / file uploads — SINGLE PATTERN (load-bearing)
**Every file upload in the codebase uses the same pattern.** No exceptions. Adding a different pattern means adding a class of bugs we've already fought through and rolled back.

**The canonical pattern: base64 → API → `uploadAsset()` → store URL on Firestore.**

```ts
// CLIENT (any feature that uploads)
const base64 = await readAsBase64(file);                     // data URI ok; server strips prefix
await api.someUploadAction({ ..., file: { base64, mime } }); // single API call

// SERVER (the action handler)
import { uploadAsset } from '../lib/storage.js';
const { url } = await uploadAsset(storagePath, buffer, mime, { makePublic: true });
// store `url` + `storagePath` on the Firestore record
```

**Why this is the only pattern:**
- Works identically on web AND desktop (no Firebase Web SDK auth dependency).
- Same pattern governance branding has used in production for months.
- V4 signed PUT/GET URLs from `@google-cloud/storage@7.19` against `.firebasestorage.app` buckets return `SignatureDoesNotMatch` reproducibly; **do not attempt to re-introduce them** (M1.8 documented the dead-end in the plan file).

**Rules:**
- **`uploadAsset()` in [api/lib/storage.ts](api/lib/storage.ts)** is the ONLY upload helper. Don't write a new one. Don't import `firebase-admin/storage` directly in route handlers. `uploadAsset` takes `{ makePublic?: boolean }` — defaults `true` (returns stable public URL); pass `false` if you need a private object (no current feature does — see M-PrivateDownloads in `handoff.md` if/when one arises).
- **`resolveBucketName()` in [api/lib/storage.ts](api/lib/storage.ts)** is the ONLY bucket resolver. [api/lib/context.ts](api/lib/context.ts) `getStorageBucket()` delegates to it.
- **3 MB per-file cap, enforced at all three layers**: client picker (UI feedback), client-side picker validator (early reject), server-side post-decode check (source of truth). Driven by Vercel's 4.5 MB serverless body limit minus ~33% base64 inflation. **Do not raise this without also raising Vercel's body limit (it's not raisable — pick Firebase Storage SDK + custom token OR Vercel Blob first; see M-LargeUploads in `handoff.md`).**
- **Downloads = open the stored `url` directly.** No API call, no signing. URLs are stable public-but-unguessable (path includes random IDs + 13-digit timestamps). Same security posture as governance branding.
- **Deletes that involve a file MUST clean up the GCS object server-side** (see `deleteEvidence` in [api/routes/data.ts](api/routes/data.ts) and `tacRemoveAttachment` in [api/routes/technicalAssurance.ts](api/routes/technicalAssurance.ts) for the pattern).
- **External-link records** (where `storagePath === 'external-link'`) skip upload entirely; just store the user-pasted URL on the Firestore record.
- **No `firebase/storage` import anywhere in `web/`.** [web/lib/firebase.ts](web/lib/firebase.ts) deliberately does not export `storage`. Defence-in-depth: [storage.rules](storage.rules) is `allow read, write: if false` so any future direct Web SDK access fails closed.

### Desktop bridge convention (`window.cedar`)
The renderer talks to the Electron main process through a single namespaced object exposed via `contextBridge` in [apps/desktop/preload.cjs](apps/desktop/preload.cjs):

```ts
window.cedar = {
  isDesktop: true,
  isDev: boolean,                   // computed in main from !app.isPackaged || CEDAR_DEV
  apiBaseUrl: string,               // already-resolved (localhost in dev, prod in packaged)
  auth: { signInGoogle, cancelSignIn, signOut, getIdToken, getAccount },
  config: { get, set },
  setup: { complete, reset },
  log: (level, event, payload) => void,
  diagnostics: { get },
  menu: { onSignOut },
  update: { check, install },
};
```

- **Never expose raw `process.env` or full `ipcRenderer`** via contextBridge — only specific resolved values + the auth/IPC channels the renderer actually needs (DeepStrike Electron pen-test rule #1).
- **`window.cedar.apiBaseUrl` is the source of truth for the API host on desktop.** [web/lib/api.ts](web/lib/api.ts) + [web/lib/chatTransport.ts](web/lib/chatTransport.ts) read it directly. Do not duplicate the resolution logic.
- **`isDesktop` check at module-load** via [web/lib/desktop/isDesktop.ts](web/lib/desktop/isDesktop.ts) — checks `window.cedar` (preload) OR `import.meta.env.VITE_DESKTOP_BUILD` (build-time fallback for edge cases where preload runs after first render).
- **The dev-against-prod CORS rewrite in [apps/desktop/main.cjs](apps/desktop/main.cjs)** is intentional architecture, not tech debt. Three dev flows coexist by design (see Key commands table above + the comment block in main.cjs).
- **Renderer logging:** call `window.cedar.log(level, event, payload)` so renderer errors land in the same `main.log` as main-process events.

### Observability convention (electron-log)
Configured JSON-first in [apps/desktop/logger.cjs](apps/desktop/logger.cjs). File sink at `app.getPath('logs')/main.log` (macOS: `~/Library/Logs/CedarGuard/main.log`) with 5MB rotation.

- **Format: dot-notation event name + structured payload object.** Never freeform strings.
  ```ts
  // ✅
  log('info', 'auth.signin.start', { method: 'google', desktop: true });
  log('error', 'api.call.error', { action: 'getProfile', status: 500 });

  // ❌
  log('info', 'auth.signin.start for user X via google on desktop');
  ```
- **Established event namespaces:** `auth.signin.{start,success,error,cancelled}`, `auth.signout`, `auth.refresh.{success,error}`, `auth.revoke.{success,error}`, `oauth.loopback.{listening,callback,timeout,error}`, `lifecycle.boot`, `lifecycle.react.crash`, `update.check.*`.
- **The format function MUST NEVER throw.** electron-log v5 has variable message shapes; the formatter in `logger.cjs` is defensive (try/catch + fallback to `new Date().toISOString()` if `msg.date` is undefined). Don't simplify it.
- **`ErrorBoundary` Copy Diagnostics** ([web/components/ErrorBoundary.tsx](web/components/ErrorBoundary.tsx) + `diagnostics:get` IPC) bundles the last ~200 lines of `main.log` + sysinfo + React error stack — that's the support payload. Don't add a parallel error-reporting path on desktop.

### Demo mode conventions (client-only "Load / Clear demo data")
An admin-only product-demo / testing overlay: it injects a complete static dataset into the store so the whole app renders as a fully-populated workspace, and clears back to live data — **without any database writes**. Visible only to Super Admin / Admin (`isSuperAdmin`).
- **100% client-side, NEVER the DB.** No demo path calls `api.saveData` / `api.savePreference` / any DB write. State persists only via [`web/lib/demoMode.ts`](web/lib/demoMode.ts) to **localStorage** (survives refresh / re-login on web AND the Electron desktop renderer — default persistent session). Only `clearDemo`'s restore issues reads. The old `loadDemoData` store action (which DID write seed data to Firestore) is retired/unused — do not re-wire it.
- **Two SINGLE-SOURCE modules:** persistence + flag in [`web/lib/demoMode.ts`](web/lib/demoMode.ts); static fixtures in [`web/lib/demoData/index.ts`](web/lib/demoData/index.ts) (`buildDemoProgramme`/`buildDemoProject` → a `DemoBundle`). Don't fabricate demo data inline or add a parallel flag.
- **Ids use the `cgdemo-` prefix** (`DEMO_ID_PREFIX`), verified unused repo-wide — NOT `demo-` (collides with the `demo-aspen-court` governance seed). `isDemoId(id)` (= starts with `cgdemo-`) and `isDemoActive()` (localStorage flag) gate the store; both are **inert for real data**, so existing flows are unchanged when no demo is loaded.
- **Store integration** ([`web/store/useStore.ts`](web/store/useStore.ts)): `loadDemoProgramme` / `loadDemoProject` / `clearDemo` actions; local helpers `resolveDemoBundle` / `applyDemoBundle` (merge demo records by id = idempotent; runs `normalizeRisk`; sets active context via raw `set`, never `setActiveProject`/`setActiveProgramme` which persist prefs) / `keepDemo` (re-merges demo rows when a real fetch refreshes the lists). The three loaders (`loadProjectData` / `loadProgrammeData` / `loadAggregateData`) short-circuit at the top on `isDemoId`/`isDemoActive`. `initStore` re-applies the overlay on refresh via a leading `getDemoFlag()` branch. `clearDemo` raises the global `isContextSwitching` overlay and restores the stashed `prior` context directly (no null→aggregate flash).
- **Demo fixtures must carry the SAME fields the real UI reads**, so charts/KPIs/setup pages are real-driven, not faked: risks/issues get a recent spread `dateAdded`; compliance items get `stage` + `completedAt` (verification day, what the velocity chart buckets by) + `dateAdded`; the bundle includes `projectInfo` (questionnaire answers) + `complianceAnalysis`/`lastAnalysisResults` so Compliance Setup shows answered + analysed, and `riskSetupDone`/`complianceSetupDone: true` so the setup pages show their "complete" state.

### Standing rules for sweeps / refactors
- **Demo mode goes through [`web/lib/demoMode.ts`](web/lib/demoMode.ts) + [`web/lib/demoData/index.ts`](web/lib/demoData/index.ts); NEVER write to the DB on a demo path and never use the `demo-` prefix (use `cgdemo-`).** See the Demo mode convention above.
- **Resource Planner FTE/demand/cost/capacity maths goes through the pure lib [`web/lib/resourcePlanner/`](web/lib/resourcePlanner/) (`buildResourcePlan` / `computeDemandMatrix` / `computeCost` / `computeHeadcount` / `computeCapacity` / `computePeopleCapacity`); never re-derive demand, cost, quarter indices or the rate card inline in a page.** Retune via `constants.ts` (rate card seeded from the Excel ASSUMPTIONS tab; April fiscal year; missing date ⇒ 0 FTE; unmapped complexity ⇒ 0 FTE; `DEFAULT_DAY_RATE=250`, `DEFAULT_WORKING_DAYS_PER_QUARTER=65`). **Cost = `FTE × workingDaysPerQuarter × PER-ROLE dayRate` on the UPLIFTED demand** (rate via `dayRateByRole[role]` → legacy single `dayRate` → `DEFAULT_DAY_RATE`; working days stays a single shared value) — never reduce days again for leave (the FTE already carries the +leave uplift). `computeCost` returns `byRole`/`byComplexity`/`bySchemeRole` £ (walked from `bySchemeRole`) so the Demand Forecast £ view is exact in every grouping. **Headcount = `ceil(peak-quarter FTE)`** to whole people. **ONE shared manually-entered input — `inPostByRoleQuarter` ("resources in post", role × quarter) — drives BOTH the Capacity view AND the Actual-under-Demand rows on the Forecast** (mirrors the workbook). **Person-level capacity** (`computePeopleCapacity`) derives committed load from the scheme assignment NAME fields via `ASSIGNMENT_ROLE_FIELDS` + `bySchemeRole` (no per-person actuals exist anywhere); availability defaults to 1.0 FTE per person. Schemes + assumptions (incl. costing/in-post/availability — all on the assumptions doc) are TENANT-scoped via [`api/routes/resourcePlanner.ts`](api/routes/resourcePlanner.ts) (`clientId === primaryUid`) — NOT the user-scoped generic `saveData`; edits gated to `isAtLeastProgrammeManager` (Client Admin / Programme Manager / Super Admin), view open to any signed-in user. Reuse [`RpEmptyState`](web/features/resourcePlanner/components/RpEmptyState.tsx) + [`SchemeFilters`](web/features/resourcePlanner/components/SchemeFilters.tsx) across its pages; the [`FteExplainer`](web/features/resourcePlanner/components/FteExplainer.tsx) panel is the canonical place to explain FTE/uplift.
- **`PageHeader` is the ONLY way to add a page title.** Never add an ad-hoc `<h1>` or title block to an authenticated page. Props: `breadcrumbs` (first item = sidebar group name), `title`, optional `subtitle`, optional `actions` slot.
- **Marketing-page imagery goes through [`<MarketingImage>`](web/components/public/MarketingImage.tsx) with pre-generated variants in `public/marketing/`.** Never reference a raw multi-MB image from a marketing page or hand-roll a `<picture>`/`<img>` there — `MarketingImage` is the single source of truth for the AVIF→WebP→JPEG + responsive-srcset + lazy + CLS-safe pattern. New marketing shots: drop the source in `public/marketing/`, generate the 6 `sharp` variants (`-{960,1600}.{avif,webp,jpg}`), and reference by `base`. (Photographic device shots go in Landing's alternating `ShowcaseBand` spotlight tiles or the Product deep-dive cards — not a bento grid; bento is for clean UI tiles, not desk-scene photos.)
- **Risk-to-Issue "trending" logic goes through [`web/lib/riskConversion.ts`](web/lib/riskConversion.ts) `evaluateConversion` ONLY.** Don't re-implement the heuristics or hardcode its thresholds in a page; retune via that file's constants. Scores via `riskMetrics.ts`, never inline.
- **Fact-Check / Validation goes through [`web/lib/validation.ts`](web/lib/validation.ts) types + [`useValidationGate`](web/hooks/useValidationGate.ts) + [`<ValidateButton/>`](web/components/validation/ValidateButton.tsx).** One `validations` collection, keyed by a **content-versioned** target (`versionedTargetId`) so a new analysis forces a fresh check. The AI fact-check is the **chunked** two-call pattern in [`api/routes/validation.ts`](api/routes/validation.ts) via `aiOperationRouter` (`webSearch`), NEVER `api/routes/ai.ts`, with **1:1 numbered-item reconciliation** (one claim per item). PM+ validates; approval blocked until validated (gate BOTH the submit action and any step→step advance, e.g. `handleFinalise`); everything `logActivity`s. Don't fork the types, add a parallel collection, hardcode the confidence threshold, or send un-numbered/multi-line fact-check content.
- **Chat input is guarded by [`api/lib/aiGuard.ts`](api/lib/aiGuard.ts) `screenChatInput` BEFORE the model** (Llama Guard safety + topical, hard-block, fail-open). Don't bypass it or route its classifier through `api/routes/ai.ts`. The chat Fact-check button is gated on `factCheckable` + citations, and chat fact-checks run a verifiability pre-check — don't fact-check pure data-summary / "no results" answers.
- **Tooltips inside a scroll/overflow container (e.g. a `DynamicTable` cell) must portal out** — use [`TrendingTooltip`](web/components/TrendingTooltip.tsx)'s pattern (`createPortal` to `document.body`, `position:fixed`, `z-40` so it sits above the table but below `z-50` modals/dialogs/dropdowns). The plain `InfoTooltip` gets clipped there.
- **`PageActions` is the ONLY way to add a per-page context dropdown.** Pass `items: ActionItem[]` and `canManage: boolean`. Never roll a custom dropdown for page-level actions.
- **`exportContextData` in [`web/lib/exportUtils.ts`](web/lib/exportUtils.ts) is the ONLY Excel export helper.** Never write inline XLSX logic in a page. Add new sheet types to `exportUtils.ts`.
- **`ServiceManagementBar` is deleted.** Do not recreate it. Its MonthPicker and PageActions patterns replace it entirely.
- **Mobile responsiveness: honour the four patterns in "Mobile responsiveness conventions" above.** No bare `sticky top-N` on a sidebar that reorders above content (gate to `lg:`, content-first on mobile); no unprefixed `col-span-2+` inside a `grid-cols-1` mobile grid (use `col-span-1 md:col-span-N`); no fixed-width `flex` sidebar that doesn't stack (`flex-col lg:flex-row` + `w-full lg:w-80` + `flex-1 min-w-0`); the `GlobalAIAssistant` FAB stays above the `MobileNav` bar on mobile. Verify any new two-column / multi-field-form page at 375px.
- **Never run regex passes on backtick template literals.** A pattern like `(["'`])((?:[^\\]|\\.)*?)\1` matches across newlines inside backticks and corrupts JSX inside `${...}`. Always restrict regex find/replace to single-line `'...'` or `"..."` strings unless the pattern is anchored on a definite per-line attribute.
- **Never commit with `--no-verify`, never push with `--force` to `main` / `master`.** No model names, no co-authored-by footer in commit messages.
- **Never push without explicit user instruction.** Commit locally; wait for "push".
- **`api/routes/ai.ts` is out of bounds** — standing project rule. Do not edit.
- **5×5 risk matrix is user-locked** — do not change the layout shape.
- **AI insight scope/wording goes through [`web/lib/aiScope.ts`](web/lib/aiScope.ts) `resolveAiScope`; each dashboard leads with its own `focus` domain.** Never hardcode "Portfolio"/"organisation" at project/programme scope; never make a risk page headline compliance (or vice versa). See "AI insight scope & domain-focus conventions".
- **Per-page AI domain goes through [`web/lib/aiDomain.ts`](web/lib/aiDomain.ts) `resolveAiDomain`; a single-domain page's AI HARD-WITHHOLDS the other domain's data** (risk page → no compliance, compliance page → no risks/issues — for the floating `AIInquiryPopup` AND the insight panels), correct for BOTH project and programme (programme scope must include child-project rows). The `/chat` page + `api/lib/chatTools.ts` stay general/cross-domain. See "AI insight scope & domain-focus conventions".
- **Stale embedded `project`/`programme` NAMES are fixed at the AI prompt boundary, NEVER by mutating the record.** Pass the authoritative `scope.label` + strip the embedded name fields before serialising (`stripStaleNames`). Do NOT overwrite `r.project`/`r.programme` in the store — that field is used as an ID by some consumers (`ProgrammeContext`, `RiskTracker`) and mutating it to a name breaks them.
- **`aiOperationRouter` `isRetryable` treats `402` / insufficient-credit errors as advance-cascade**, not fatal — a paid OpenRouter entry that runs out of credits must fall through to the free models / owl-alpha / Gemini-direct. Don't re-classify 402 as non-retryable.
- **Never cache or stale-while-revalidate the AI chat model picker.** `getActiveChatModels` reads `adminConfig/aiModelConfig` fresh per request (no per-instance cache); the client fetches once on mount + skeleton + renders once (no `localStorage` list cache, no focus revalidation). Re-adding any cache reintroduces the model flicker — see "AI chat model picker conventions".
- **Never re-introduce V4 signed PUT/GET URLs against the Storage bucket.** Migration tried + failed in M1.8 with reproducible `SignatureDoesNotMatch` — see plan file. Use base64 → API → `uploadAsset()` per the Storage convention above.
- **Never import `firebase/storage` in `web/`.** [`web/lib/firebase.ts`](web/lib/firebase.ts) deliberately omits the `storage` export. Defence-in-depth via [`storage.rules`](storage.rules) deny-all is in place too. Server-side: only [`api/lib/storage.ts`](api/lib/storage.ts) `uploadAsset` / `deleteAsset` / `readAssetAsDataUri` may touch Storage.
- **Never read `auth.currentUser` or call `signOut(auth)` directly in app code.** Use [`authBridge`](web/lib/auth/authBridge.ts) — breaks silently on desktop otherwise.
- **`apps/desktop/built-env.cjs` must stay gitignored.** It contains the Google OAuth client secret baked at build time. Never commit, never `git add` it.
- **Never raise the 3 MB upload cap by editing constants alone.** It's bounded by Vercel's 4.5 MB serverless body limit (not configurable). Raising it requires switching pattern entirely (M-LargeUploads in `handoff.md`).
- **Activity logging goes through [`api/lib/activityLog.ts`](api/lib/activityLog.ts), awaited BEFORE the response.** Don't write to `activityLogs` ad-hoc, and never move logging to a post-response central dispatcher hook — Vercel tears the invocation down at response end and the write is lost (see the activity-logging convention above).
- **TAC enquiry visibility goes through `isTacElevated` + `canViewEnquiry` in [`api/routes/technicalAssurance.ts`](api/routes/technicalAssurance.ts).** A regular user sees only their own + shared-with-them enquiries; elevated (Super Admin / Client Admin / Compliance Lead) see all. Every enquiry **list AND detail/deliverable** read must use `canViewEnquiry` (detail = hard 403, not just hidden); never re-derive the rule inline or fall back to a tenant-only (`clientId`) filter. RFI register visibility is **project-based** (`isAuthorizedForContext`), not owner-based. See the TAC enquiry visibility convention above.
